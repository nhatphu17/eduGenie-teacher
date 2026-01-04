# 🚀 EduGenie Teacher - Production Upgrade Roadmap

## 📋 Tổng quan

Roadmap nâng cấp hệ thống từ MVP → Production-Ready với kiến trúc scalable, RAG chính xác, và UX tốt hơn.

---

## 🎯 Core Improvements

### 1. ⚡ Architecture: Microservices + Queue-based Processing

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (React + PWA)                  │
│  Upload Wizard → Job Progress → Preview → Approve → Export  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────┐
│                   NESTJS BACKEND API                        │
│  • Authentication • Authorization • Business Logic          │
│  • Queue Job Management • API Gateway                       │
└──────────┬─────────────────────────────┬───────────────────┘
           │                             │
           ▼                             ▼
┌──────────────────────┐    ┌─────────────────────────────┐
│   MESSAGE QUEUE      │    │    MYSQL DATABASE           │
│   (BullMQ/RabbitMQ)  │    │  • User, Subscription       │
│  • Document Jobs     │    │  • Document, Chunk          │
│  • Embedding Jobs    │    │  • Question, Exam           │
│  • Export Jobs       │    │  • LessonPlan, Usage        │
└──────────┬───────────┘    └─────────────┬───────────────┘
           │                              │
           ▼                              │
┌──────────────────────────────────────┐  │
│   PYTHON PROCESSING SERVICE          │  │
│  • PDF/DOCX Parser (PyMuPDF)         │  │
│  • Chapter Detection (regex/ML)      │  │
│  • Smart Chunking (LangChain)        │◄─┘
│  • Embedding Generation (OpenAI)     │
│  • Metadata Extraction               │
└──────────┬───────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│      VECTOR DATABASE                 │
│   (Qdrant / Pinecone / PGVector)     │
│  • Fast similarity search            │
│  • Filter by chapter/topic/grade     │
│  • Metadata indexing                 │
└──────────────────────────────────────┘
```

---

## 📊 Phase 1: Database Schema Upgrade (Week 1-2)

### Current Issues:
- ❌ Document chứa toàn bộ content → embedding không chính xác
- ❌ Không có chapter/topic metadata → không filter được
- ❌ Question không link source → không trace được
- ❌ Exam không có scope → tạo đề không flexible

### New Schema:

```prisma
// ===== CORE ENTITIES =====

model Subject {
  id          String       @id @default(cuid())
  name        String       // Toán, Lý, Hóa...
  grade       Int          // 6, 7, 8, 9
  documents   Document[]
  questions   Question[]
  exams       Exam[]
  lessonPlans LessonPlan[]
  
  @@unique([name, grade])
  @@index([name, grade])
  @@map("subjects")
}

// ===== DOCUMENT & CHUNKS =====

model Document {
  id              String       @id @default(cuid())
  subjectId       String
  subject         Subject      @relation(fields: [subjectId], references: [id])
  
  // Metadata
  type            DocumentType // TEXTBOOK, TEACHER_GUIDE, REFERENCE, EXAM_BANK
  title           String       // "Toán 6 - Tập 1"
  author          String?      // "Bộ GD&ĐT"
  publisher       String?      // "NXB Giáo dục Việt Nam"
  publishYear     Int?         // 2024
  edition         String?      // "2024", "Chân trời sáng tạo", "Kết nối tri thức"
  isbn            String?
  
  // Structure info
  totalChapters   Int?
  totalPages      Int?
  
  // File info
  originalFileName String
  filePath        String?      // S3/local path to original file
  fileSize        Int?
  mimeType        String?
  
  // Processing status
  status          ProcessingStatus @default(PENDING) // PENDING, PROCESSING, COMPLETED, FAILED
  processedAt     DateTime?
  errorMessage    String?
  
  // Relations
  chunks          Chunk[]
  uploadedBy      String?
  uploader        User?        @relation("DocumentUploader", fields: [uploadedBy], references: [id])
  
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
  
  @@index([subjectId])
  @@index([type])
  @@index([status])
  @@map("documents")
}

enum ProcessingStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
  PARTIALLY_COMPLETED
}

model Chunk {
  id              String       @id @default(cuid())
  documentId      String
  document        Document     @relation(fields: [documentId], references: [id], onDelete: Cascade)
  
  // Location metadata
  chapterNumber   Int?         // 1, 2, 3... (NULL for intro/appendix)
  chapterTitle    String?      // "Số nguyên"
  sectionNumber   String?      // "1.1", "2.3"
  sectionTitle    String?      // "Tập hợp số nguyên"
  pageStart       Int?
  pageEnd         Int?
  
  // Content
  content         String       @db.LongText
  contentLength   Int          // Character count
  tokenCount      Int?         // Estimated tokens
  
  // Embedding (stored locally in MySQL as JSON)
  // For production: use Vector DB (Qdrant/Pinecone) instead
  embedding       Json?        // [float, float, ...] - 3072 dimensions
  embeddingModel  String?      // "text-embedding-3-large"
  
  // Chunk metadata
  chunkIndex      Int          // Order within document
  chunkType       ChunkType    @default(TEXT) // TEXT, TABLE, FORMULA, IMAGE_TEXT
  
  // AI-extracted metadata
  topics          String[]     // ["Số nguyên", "Phép cộng"]
  keywords        String[]     // Auto-extracted
  difficulty      Difficulty?  // AUTO_DETECTED or MANUAL
  
  // Relations
  questions       Question[]   // Questions generated from this chunk
  
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
  
  @@index([documentId])
  @@index([chapterNumber])
  @@index([chunkType])
  @@map("chunks")
}

enum ChunkType {
  TEXT           // Normal text content
  TABLE          // Table or structured data
  FORMULA        // Math formula
  IMAGE_TEXT     // OCR text from image
  EXERCISE       // Exercise section
  SUMMARY        // Chapter summary
}

// ===== QUESTIONS =====

model Question {
  id              String       @id @default(cuid())
  subjectId       String
  subject         Subject      @relation(fields: [subjectId], references: [id])
  
  // Source tracking (CRITICAL for zero hallucination)
  sourceChunkId   String?      // Link to source chunk
  sourceChunk     Chunk?       @relation(fields: [sourceChunkId], references: [id])
  sourceDocument  String?      // Document title
  chapterNumber   Int?         // For filtering
  chapterTitle    String?
  pageNumber      Int?
  
  // Content
  type            QuestionType
  content         String       @db.LongText
  options         Json?        // For MCQ: ["A. ...", "B. ...", "C. ...", "D. ..."]
  correctAnswer   String       // "A", "B", "C", "D" or full text
  explanation     String?      @db.LongText
  
  // Metadata
  difficulty      Difficulty   @default(MEDIUM)
  points          Float        @default(1.0)
  timeEstimate    Int?         // Seconds
  bloomLevel      String?      // "Remember", "Understand", "Apply", "Analyze"
  
  // Topics & Keywords
  topics          String[]     // ["Phương trình bậc 2", "Công thức nghiệm"]
  keywords        String[]
  
  // AI generation metadata
  generatedBy     GenerationMethod @default(AI)
  aiPrompt        String?      // Prompt used to generate
  aiConfidence    Float?       // 0.0 - 1.0
  
  // Status
  status          QuestionStatus @default(DRAFT)
  reviewedBy      String?
  reviewer        User?        @relation("QuestionReviewer", fields: [reviewedBy], references: [id])
  reviewedAt      DateTime?
  
  // Relations
  exams           ExamQuestion[]
  createdBy       String?
  creator         User?        @relation("QuestionCreator", fields: [createdBy], references: [id])
  
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
  
  @@index([subjectId])
  @@index([chapterNumber])
  @@index([difficulty])
  @@index([status])
  @@index([sourceChunkId])
  @@map("questions")
}

enum GenerationMethod {
  AI              // Generated by AI
  MANUAL          // Created manually by teacher
  IMPORTED        // Imported from external source
  MIXED           // AI-generated but heavily edited
}

enum QuestionStatus {
  DRAFT           // Just created, not reviewed
  REVIEWED        // Teacher reviewed and approved
  PUBLISHED       // Available for use
  ARCHIVED        // Deprecated/old
}

// ===== EXAMS =====

model Exam {
  id              String       @id @default(cuid())
  subjectId       String
  subject         Subject      @relation(fields: [subjectId], references: [id])
  
  title           String       // "Kiểm tra 15' - Chương 2"
  description     String?
  
  // Scope definition (NEW)
  scope           ExamScope    @default(SINGLE_CHAPTER)
  targetChapters  Int[]        // [2] or [1,2,3] or [] for full
  
  // Distribution (NEW) - How many questions per chapter
  chapterDistribution Json?    // {"1": 5, "2": 10, "3": 5}
  
  // Exam config
  totalPoints     Float
  duration        Int?         // Minutes
  passingScore    Float?
  
  // Difficulty distribution
  difficultyDistribution Json? // {"EASY": 30, "MEDIUM": 50, "HARD": 20}
  
  // Question type distribution
  typeDistribution Json?       // {"MCQ": 60, "SHORT_ANSWER": 30, "ESSAY": 10}
  
  // Status
  status          ExamStatus   @default(DRAFT)
  publishedAt     DateTime?
  
  // Relations
  questions       ExamQuestion[]
  submissions     StudentSubmission[]
  
  createdBy       String?
  creator         User?        @relation("ExamCreator", fields: [createdBy], references: [id])
  
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
  
  @@index([subjectId])
  @@index([scope])
  @@index([status])
  @@map("exams")
}

enum ExamScope {
  SINGLE_CHAPTER    // Kiểm tra 1 chương
  MULTI_CHAPTER     // Kiểm tra nhiều chương
  MIDTERM           // Giữa kỳ (1/2 sách)
  FINAL             // Cuối kỳ (toàn bộ)
  FULL_BOOK         // Ôn tập toàn bộ
}

enum ExamStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

// ===== LESSON PLANS =====

model LessonPlan {
  id              String       @id @default(cuid())
  subjectId       String
  subject         Subject      @relation(fields: [subjectId], references: [id])
  
  // Scope
  chapterNumber   Int
  chapterTitle    String
  lessonNumber    Int?         // Lesson within chapter
  lessonTitle     String
  
  // MOET structure
  duration        Int          // Minutes (usually 45)
  objectives      Json         // {knowledge: [], skills: [], attitude: []}
  teachingMethods Json         // ["Thảo luận nhóm", "Giải quyết vấn đề"]
  materials       String[]     // ["SGK", "Bảng phụ", "Máy chiếu"]
  
  // Activities
  warmUp          String?      @db.LongText
  teacherActivities String     @db.LongText
  studentActivities String     @db.LongText
  assessment      Json         // Criteria and methods
  homework        String?      @db.LongText
  
  // Linked resources
  suggestedQuestions String[]  // Question IDs
  sourceChunks    String[]     // Chunk IDs used
  
  // Full content (generated by AI)
  content         String?      @db.LongText
  
  // Status
  status          LessonPlanStatus @default(DRAFT)
  
  createdBy       String?
  creator         User?        @relation("LessonPlanCreator", fields: [createdBy], references: [id])
  
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
  
  @@index([subjectId])
  @@index([chapterNumber])
  @@index([status])
  @@map("lesson_plans")
}

enum LessonPlanStatus {
  DRAFT
  REVIEWED
  PUBLISHED
  ARCHIVED
}

// ===== AI USAGE TRACKING =====

model AIUsageLog {
  id              String       @id @default(cuid())
  userId          String
  user            User         @relation(fields: [userId], references: [id])
  
  actionType      ActionType
  
  // Context (NEW)
  subjectId       String?
  chapterNumber   Int?         // Track usage per chapter
  scope           String?      // "chapter-2", "full-book"
  
  // Tokens
  tokenUsed       Int
  inputTokens     Int?
  outputTokens    Int?
  
  // Model info
  model           String       @default("gpt-4o")
  cost            Float?       // Estimated cost in USD
  
  // Performance
  duration        Int?         // Milliseconds
  
  // Request/Response
  prompt          String?      @db.LongText
  response        String?      @db.LongText
  
  createdAt       DateTime     @default(now())
  
  @@index([userId])
  @@index([actionType])
  @@index([chapterNumber])
  @@index([createdAt])
  @@map("ai_usage_logs")
}

// ===== PROCESSING JOBS =====

model ProcessingJob {
  id              String       @id @default(cuid())
  type            JobType
  
  // Document reference
  documentId      String?
  userId          String
  
  // Status
  status          JobStatus    @default(QUEUED)
  progress        Int          @default(0) // 0-100
  
  // Timing
  queuedAt        DateTime     @default(now())
  startedAt       DateTime?
  completedAt     DateTime?
  
  // Results
  result          Json?        // Success data
  error           String?      @db.LongText
  
  // Retry
  attempts        Int          @default(0)
  maxAttempts     Int          @default(3)
  
  @@index([userId])
  @@index([status])
  @@index([type])
  @@map("processing_jobs")
}

enum JobType {
  DOCUMENT_UPLOAD
  DOCUMENT_PARSE
  CHUNK_GENERATION
  EMBEDDING_GENERATION
  EXAM_GENERATION
  LESSON_PLAN_GENERATION
  EXPORT_PDF
  EXPORT_WORD
}

enum JobStatus {
  QUEUED
  PROCESSING
  COMPLETED
  FAILED
  CANCELLED
}
```

---

## 🐍 Phase 2: Python Document Processing Service (Week 2-3)

### Tech Stack:
- **Framework**: FastAPI
- **PDF Parser**: PyMuPDF (fitz), pdfplumber
- **DOCX Parser**: python-docx, mammoth
- **Chunking**: LangChain TextSplitter
- **Embedding**: OpenAI API / sentence-transformers (local)
- **Queue**: Celery + Redis / RabbitMQ

### Service Structure:

```
python-service/
├── app/
│   ├── main.py                 # FastAPI app
│   ├── config.py               # Settings
│   ├── celery_app.py           # Celery configuration
│   │
│   ├── parsers/
│   │   ├── pdf_parser.py       # Extract text, detect structure
│   │   ├── docx_parser.py      # Parse Word documents
│   │   ├── excel_parser.py     # Parse Excel
│   │   └── structure_detector.py # Detect chapters, sections
│   │
│   ├── chunking/
│   │   ├── smart_chunker.py    # Context-aware chunking
│   │   └── metadata_extractor.py # Extract topics, keywords
│   │
│   ├── embeddings/
│   │   ├── openai_embedder.py  # OpenAI embeddings
│   │   └── local_embedder.py   # Local model (optional)
│   │
│   ├── tasks/
│   │   ├── process_document.py # Celery task
│   │   ├── generate_embeddings.py
│   │   └── export_document.py
│   │
│   └── utils/
│       ├── vector_db.py        # Qdrant/Pinecone client
│       └── database.py         # MySQL connection
│
├── requirements.txt
└── Dockerfile
```

### Key Functions:

```python
# app/parsers/pdf_parser.py
from typing import List, Dict
import fitz  # PyMuPDF

class PDFParser:
    def parse(self, file_path: str) -> Dict:
        doc = fitz.open(file_path)
        
        chapters = []
        current_chapter = None
        
        for page_num, page in enumerate(doc, start=1):
            text = page.get_text()
            
            # Detect chapter header (regex or ML)
            if self._is_chapter_header(text):
                if current_chapter:
                    chapters.append(current_chapter)
                current_chapter = {
                    'number': len(chapters) + 1,
                    'title': self._extract_chapter_title(text),
                    'start_page': page_num,
                    'content': ''
                }
            
            if current_chapter:
                current_chapter['content'] += text
                current_chapter['end_page'] = page_num
        
        if current_chapter:
            chapters.append(current_chapter)
        
        return {
            'total_pages': len(doc),
            'chapters': chapters,
            'metadata': self._extract_metadata(doc)
        }

# app/chunking/smart_chunker.py
from langchain.text_splitter import RecursiveCharacterTextSplitter

class SmartChunker:
    def __init__(self, chunk_size=1000, chunk_overlap=200):
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            separators=["\n\n", "\n", ". ", " ", ""]
        )
    
    def chunk_chapter(self, chapter: Dict) -> List[Dict]:
        """Chunk a chapter into smaller pieces with metadata"""
        chunks = []
        texts = self.splitter.split_text(chapter['content'])
        
        for i, text in enumerate(texts):
            chunks.append({
                'content': text,
                'chapter_number': chapter['number'],
                'chapter_title': chapter['title'],
                'page_start': chapter['start_page'],
                'page_end': chapter['end_page'],
                'chunk_index': i,
                'topics': self._extract_topics(text),
                'keywords': self._extract_keywords(text)
            })
        
        return chunks

# app/tasks/process_document.py
from celery import Task
from app.celery_app import celery_app

@celery_app.task(bind=True, max_retries=3)
def process_document_task(self: Task, document_id: str, file_path: str):
    try:
        # 1. Parse document
        parser = PDFParser()
        parsed_data = parser.parse(file_path)
        
        # 2. Chunk content
        chunker = SmartChunker()
        all_chunks = []
        for chapter in parsed_data['chapters']:
            chunks = chunker.chunk_chapter(chapter)
            all_chunks.extend(chunks)
        
        # 3. Generate embeddings
        embedder = OpenAIEmbedder()
        for chunk in all_chunks:
            chunk['embedding'] = embedder.embed(chunk['content'])
        
        # 4. Save to database
        database.save_chunks(document_id, all_chunks)
        
        # 5. Update document status
        database.update_document_status(document_id, 'COMPLETED')
        
        return {'status': 'success', 'chunks_count': len(all_chunks)}
        
    except Exception as e:
        # Retry with exponential backoff
        self.retry(countdown=2 ** self.request.retries, exc=e)
```

---

## 🔄 Phase 3: Queue System Integration (Week 3-4)

### NestJS Queue Module:

```bash
npm install @nestjs/bull bull
npm install @nestjs/bullmq bullmq
```

### Implementation:

```typescript
// backend/src/queue/queue.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { DocumentQueue } from './document.queue';

@Module({
  imports: [
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT),
      },
    }),
    BullModule.registerQueue({
      name: 'document-processing',
    }),
  ],
  providers: [DocumentQueue],
  exports: [DocumentQueue],
})
export class QueueModule {}

// backend/src/queue/document.queue.ts
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class DocumentQueue {
  constructor(
    @InjectQueue('document-processing') private queue: Queue,
  ) {}

  async addDocumentProcessingJob(documentId: string, filePath: string) {
    return this.queue.add('process-document', {
      documentId,
      filePath,
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });
  }

  async getJobStatus(jobId: string) {
    const job = await this.queue.getJob(jobId);
    return {
      id: job.id,
      progress: job.progress(),
      state: await job.getState(),
      result: job.returnvalue,
      error: job.failedReason,
    };
  }
}

// backend/src/documents/documents.service.ts (Updated)
async uploadDocument(userId: string, file: Express.Multer.File) {
  // 1. Save file to storage
  const filePath = await this.saveFile(file);
  
  // 2. Create document record
  const document = await this.prisma.document.create({
    data: {
      title: file.originalname,
      originalFileName: file.originalname,
      filePath,
      status: 'PENDING',
      uploadedBy: userId,
    },
  });
  
  // 3. Add to processing queue
  const job = await this.documentQueue.addDocumentProcessingJob(
    document.id,
    filePath,
  );
  
  // 4. Create job tracking record
  await this.prisma.processingJob.create({
    data: {
      id: job.id.toString(),
      type: 'DOCUMENT_UPLOAD',
      documentId: document.id,
      userId,
      status: 'QUEUED',
    },
  });
  
  return {
    documentId: document.id,
    jobId: job.id,
    message: 'Document queued for processing',
  };
}
```

---

## 🤖 Phase 4: Enhanced AI Orchestrator (Week 4-5)

### Strict RAG with Chapter Filtering:

```typescript
// backend/src/ai/rag.service.ts
@Injectable()
export class RAGService {
  async generateExamQuestions(request: {
    userId: string;
    subjectId: string;
    chapters: number[]; // [2] or [1,2,3] or [] for all
    questionCount: number;
    difficulty: Difficulty;
  }) {
    // 1. Retrieve relevant chunks ONLY from specified chapters
    const chunks = await this.prisma.chunk.findMany({
      where: {
        document: { subjectId: request.subjectId },
        ...(request.chapters.length > 0 && {
          chapterNumber: { in: request.chapters },
        }),
      },
      include: {
        document: true,
      },
    });

    if (chunks.length === 0) {
      throw new BadRequestException(
        `No content found for chapters ${request.chapters.join(', ')}`,
      );
    }

    // 2. Generate query embedding
    const queryText = `Generate ${request.difficulty} level exam questions about chapters ${request.chapters.join(', ')}`;
    const queryEmbedding = await this.aiService.generateEmbedding(queryText);

    // 3. Rank chunks by relevance
    const rankedChunks = await this.rankChunksBySimilarity(
      queryEmbedding,
      chunks,
      20,
    );

    // 4. Build strict context
    const context = rankedChunks.map((chunk, idx) => ({
      content: chunk.content,
      source: `${chunk.document.title} - Chương ${chunk.chapterNumber} - Trang ${chunk.pageStart}-${chunk.pageEnd}`,
      chunkId: chunk.id,
    }));

    // 5. Generate questions with strict prompt
    const systemPrompt = `Bạn là trợ lý AI tạo đề thi cho giáo viên THCS.

QUY TẮC NGHIÊM NGẶT:
1. CHỈ sử dụng thông tin từ tài liệu nguồn được cung cấp bên dưới.
2. KHÔNG sử dụng kiến thức bên ngoài hoặc thông tin chung.
3. MỖI câu hỏi PHẢI cite nguồn chính xác (chương, trang).
4. Nếu không đủ thông tin, trả về lỗi rõ ràng.
5. Câu hỏi phải theo chương trình THCS Việt Nam.
6. Format JSON: { "questions": [{ "content", "options", "correctAnswer", "explanation", "source", "chunkId" }] }`;

    const userPrompt = `Tạo ${request.questionCount} câu hỏi ${request.difficulty} về Chương ${request.chapters.join(', ')}.

TÀI LIỆU NGUỒN:
${context.map((c, i) => `[${i + 1}] ${c.source}\n${c.content}`).join('\n\n---\n\n')}

Yêu cầu:
- ${request.questionCount} câu hỏi
- Độ khó: ${request.difficulty}
- Phân bố đều trong các chương được chọn
- Mỗi câu PHẢI có "source" và "chunkId"`;

    const result = await this.aiService.generateStructuredJSON(
      request.userId,
      ActionType.EXAM_GENERATE,
      userPrompt,
      context,
      systemPrompt,
    );

    // 6. Save questions to database
    const questions = await Promise.all(
      result.questions.map((q) =>
        this.prisma.question.create({
          data: {
            subjectId: request.subjectId,
            sourceChunkId: q.chunkId,
            chapterNumber: chunks.find((c) => c.id === q.chunkId)?.chapterNumber,
            content: q.content,
            options: q.options,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
            difficulty: request.difficulty,
            status: 'DRAFT',
            generatedBy: 'AI',
            createdBy: request.userId,
          },
        }),
      ),
    );

    return { questions };
  }
}
```

---

## 📅 Implementation Timeline

### Week 1-2: Database Migration
- [ ] Design new schema
- [ ] Create Prisma migration
- [ ] Data migration script (if needed)
- [ ] Test integrity

### Week 2-3: Python Service
- [ ] Setup FastAPI + Celery
- [ ] Implement PDF/DOCX parsers
- [ ] Smart chunking logic
- [ ] Chapter detection
- [ ] Embedding generation
- [ ] Testing with real textbooks

### Week 3-4: Queue Integration
- [ ] Setup BullMQ + Redis
- [ ] NestJS queue module
- [ ] Job tracking UI
- [ ] Error handling & retry
- [ ] Progress updates

### Week 4-5: Enhanced RAG
- [ ] Chapter-filtered search
- [ ] Strict prompt engineering
- [ ] Source citation
- [ ] Confidence scoring
- [ ] A/B testing

### Week 5-6: Frontend UX
- [ ] Wizard-style generators
- [ ] Job progress tracking
- [ ] Preview & approve flows
- [ ] Export improvements
- [ ] PWA enhancements

### Week 6-7: Testing & Polish
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Documentation
- [ ] Deployment

---

## 💰 Cost Estimation

### Development:
- Backend: 6-7 weeks × 40h = 240-280h
- Python Service: 2-3 weeks × 40h = 80-120h
- Frontend: 2 weeks × 40h = 80h
- Testing: 1 week × 40h = 40h
- **Total**: ~440-520h

### Infrastructure (monthly):
- Redis: $10-20 (managed)
- Vector DB (Qdrant Cloud): $50-100
- OpenAI API: ~$100-500 (depends on usage)
- Storage (S3): ~$10-30
- **Total**: ~$170-650/month

---

## 🎯 Success Metrics

### Performance:
- Document processing: <2 min for 100-page textbook
- Search latency: <300ms
- Exam generation: <30s for 20 questions

### Quality:
- Question source traceability: 100%
- Teacher approval rate: >80%
- Zero hallucination rate: >95%

### Usage:
- Document upload success rate: >95%
- Job completion rate: >98%
- User satisfaction: >4.5/5

---

## 📝 Next Steps

Choose one of these paths:

### Option A: Full Implementation (Recommended for Production)
Implement all phases sequentially for a production-ready system.

### Option B: MVP+ (Quick wins)
Focus on Phase 1 (Database) + Phase 4 (Enhanced RAG) first, defer Python service.

### Option C: Proof of Concept
Build Python service separately, test with sample documents, integrate later.

---

**Bạn muốn implement Option nào? Hoặc tôi nên bắt đầu với Phase 1 (Database) ngay?**


