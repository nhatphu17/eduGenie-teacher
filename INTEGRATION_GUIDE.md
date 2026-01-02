# 🔗 Integration Guide: NestJS ↔ Python Service

## Overview

This guide shows how to integrate the Python Document Processing Service with your NestJS backend.

---

## 🎯 Architecture

```
┌─────────────────┐
│   Frontend      │
│   (React)       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   NestJS API    │
│   (Port 3001)   │
└────────┬────────┘
         │
         │ HTTP POST
         │ /api/v1/process
         ▼
┌─────────────────┐
│  Python Service │
│  (Port 8000)    │
└────────┬────────┘
         │
         │ Save chunks
         ▼
┌─────────────────┐
│   MySQL DB      │
│   (chunks table)│
└─────────────────┘
```

---

## 📋 Step 1: Update NestJS Documents Service

### 1.1. Install HTTP Client

```bash
cd backend
npm install axios
```

### 1.2. Create Python Service Client

Create: `backend/src/documents/python-service.client.ts`

```typescript
import { Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PythonServiceClient {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('PYTHON_SERVICE_URL') || 'http://localhost:8000';
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 300000, // 5 minutes
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  async processDocument(
    file: Express.Multer.File,
    documentId: string,
    subjectId: string,
    documentType: string,
    userId: string,
    originalFilename: string,
  ): Promise<{ status: string; document_id: string }> {
    const formData = new FormData();
    
    // Convert Buffer to Blob for FormData
    const blob = new Blob([file.buffer], { type: file.mimetype });
    formData.append('file', blob, file.originalname);
    
    formData.append('document_id', documentId);
    formData.append('subject_id', subjectId);
    formData.append('document_type', documentType);
    formData.append('user_id', userId);
    formData.append('original_filename', originalFilename);

    try {
      const response = await this.client.post('/api/v1/process', formData);
      return response.data;
    } catch (error) {
      console.error('Python service error:', error.response?.data || error.message);
      throw new Error(`Failed to process document: ${error.message}`);
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.data.status === 'healthy';
    } catch (error) {
      return false;
    }
  }
}
```

### 1.3. Update Documents Module

```typescript
// backend/src/documents/documents.module.ts
import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { PythonServiceClient } from './python-service.client'; // NEW
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';
import { ConfigModule } from '@nestjs/config'; // NEW

@Module({
  imports: [PrismaModule, AiModule, ConfigModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, PythonServiceClient], // Add PythonServiceClient
  exports: [DocumentsService],
})
export class DocumentsModule {}
```

### 1.4. Update Documents Service

```typescript
// backend/src/documents/documents.service.ts
import { PythonServiceClient } from './python-service.client';

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private pythonService: PythonServiceClient, // NEW
  ) {}

  async uploadDocument(
    userId: string,
    subjectId: string,
    type: DocumentType,
    file: Express.Multer.File,
  ) {
    // Check file size
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new BadRequestException(`File too large. Max: ${maxSize / 1024 / 1024}MB`);
    }

    // 1. Create document record
    const document = await this.prisma.document.create({
      data: {
        subjectId,
        type,
        originalFileName: file.originalname,
        status: 'PENDING', // NEW: Processing status
        uploadedBy: userId,
      },
    });

    // 2. Check if Python service is available
    const isPythonServiceAvailable = await this.pythonService.checkHealth();
    
    if (isPythonServiceAvailable) {
      // 3. Send to Python service for processing
      try {
        await this.pythonService.processDocument(
          file,
          document.id,
          subjectId,
          type,
          userId,
          file.originalname,
        );
        
        return {
          message: 'Document uploaded and queued for processing',
          documentId: document.id,
          status: 'processing',
        };
      } catch (error) {
        // Fallback: mark as failed or process locally
        await this.prisma.document.update({
          where: { id: document.id },
          data: { status: 'FAILED', errorMessage: error.message },
        });
        
        throw new BadRequestException('Failed to process document. Please try again.');
      }
    } else {
      // Fallback: Process locally (old method)
      console.warn('Python service unavailable, processing locally...');
      return this.processDocumentLocally(document.id, file, subjectId, type, userId);
    }
  }

  private async processDocumentLocally(
    documentId: string,
    file: Express.Multer.File,
    subjectId: string,
    type: DocumentType,
    userId: string,
  ) {
    // Your existing local processing logic
    // ...
  }
}
```

### 1.5. Add Environment Variable

Add to `backend/.env`:

```env
PYTHON_SERVICE_URL=http://localhost:8000
```

---

## 📋 Step 2: Update Database Schema (if needed)

Ensure your Prisma schema has the `chunks` table. If not, add it:

```prisma
model Chunk {
  id              String       @id @default(cuid())
  documentId      String
  document        Document     @relation(fields: [documentId], references: [id], onDelete: Cascade)
  
  chapterNumber   Int?
  chapterTitle    String?
  pageStart       Int?
  pageEnd         Int?
  
  content         String       @db.LongText
  contentLength   Int
  tokenCount      Int?
  
  embedding       Json?
  embeddingModel  String?
  
  chunkIndex      Int
  chunkType       String       @default("TEXT")
  
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
  
  @@index([documentId])
  @@map("chunks")
}

model Document {
  // ... existing fields
  status          String?      @default("PENDING") // PENDING, PROCESSING, COMPLETED, FAILED
  processedAt     DateTime?
  errorMessage    String?
  chunks          Chunk[]
}
```

Run migration:

```bash
cd backend
npx prisma migrate dev --name add_chunks_table
npx prisma generate
```

---

## 📋 Step 3: Update RAG Service to Use Chunks

Update `backend/src/ai/ai.service.ts`:

```typescript
async retrieveRelevantChunks(
  queryEmbedding: number[],
  subjectId: string,
  grade: number,
  limit: number = 20,
) {
  // Get chunks instead of documents
  const chunks = await this.prisma.chunk.findMany({
    where: {
      document: {
        subjectId,
        status: 'COMPLETED', // Only processed documents
      },
      embedding: { not: null },
    },
    include: {
      document: true,
    },
    take: 100, // Get more for similarity calculation
  });

  // Calculate similarity
  const scoredChunks = chunks
    .map((chunk) => {
      if (!chunk.embedding) return null;
      const embedding = chunk.embedding as number[];
      const similarity = this.cosineSimilarity(queryEmbedding, embedding);
      return {
        chunk,
        similarity,
      };
    })
    .filter((item) => item !== null && item.similarity > 0.7)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return scoredChunks.map((item) => ({
    id: item.chunk.id,
    content: item.chunk.content,
    source: `${item.chunk.document.originalFileName} - Chương ${item.chunk.chapterNumber || 'N/A'} - Trang ${item.chunk.pageStart}-${item.chunk.pageEnd}`,
    chunkId: item.chunk.id,
    chapterNumber: item.chunk.chapterNumber,
  }));
}
```

---

## 🧪 Step 4: Testing

### 4.1. Start Python Service

```bash
cd python-service
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### 4.2. Start NestJS Backend

```bash
cd backend
npm run start:dev
```

### 4.3. Test Upload

1. Go to frontend: `http://localhost:5173/documents`
2. Upload a PDF/DOCX file
3. Check NestJS logs: Should see "Document queued for processing"
4. Check Python service logs: Should see parsing and embedding generation
5. Check database: Should see chunks in `chunks` table

### 4.4. Verify Processing

```sql
-- Check document status
SELECT id, originalFileName, status, processedAt 
FROM documents 
ORDER BY createdAt DESC 
LIMIT 5;

-- Check chunks
SELECT COUNT(*) as chunk_count, documentId 
FROM chunks 
GROUP BY documentId;
```

---

## 🐛 Troubleshooting

### Python service not responding

```bash
# Check if running
curl http://localhost:8000/health

# Check logs
cd python-service
tail -f logs/app.log
```

### Database connection errors

- Verify `DATABASE_URL` in Python service `.env`
- Ensure MySQL is accessible from Python service
- Check table/column names match Prisma schema

### Chunks not saving

- Check Python service logs for errors
- Verify `chunks` table exists in database
- Check column names in `app/database/client.py` match schema

### Fallback to local processing

If Python service is down, NestJS will fallback to local processing (old method). This ensures system continues working.

---

## 🚀 Production Deployment

### Option 1: Docker Compose

```yaml
# docker-compose.yml (root)
services:
  backend:
    # ... existing config
  
  python-service:
    build: ./python-service
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    depends_on:
      - db
    networks:
      - app-network
```

### Option 2: Separate Services

- Deploy Python service separately (EC2, Kubernetes, etc.)
- Use environment variable `PYTHON_SERVICE_URL` to point to production URL
- Add authentication if needed (API key in headers)

---

## ✅ Checklist

- [ ] Python service running on port 8000
- [ ] NestJS can reach Python service (health check passes)
- [ ] Database schema updated with `chunks` table
- [ ] Environment variables configured
- [ ] Upload test successful
- [ ] Chunks saved to database
- [ ] RAG service uses chunks instead of documents
- [ ] Error handling and fallback working

---

**Ready to test! Start both services and try uploading a document.** 🎉

