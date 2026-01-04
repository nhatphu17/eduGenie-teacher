# 🐍 EduGenie Python Document Processing Service

Python microservice for processing documents (PDF, DOCX, Excel), chunking, and generating embeddings.

## 🎯 Features

- ✅ **PDF Parsing**: Extract text and detect chapters using PyMuPDF
- ✅ **DOCX Parsing**: Parse Word documents with structure detection
- ✅ **Excel Parsing**: Extract data from spreadsheets
- ✅ **Smart Chunking**: Context-aware chunking with LangChain
- ✅ **Embedding Generation**: OpenAI embeddings (text-embedding-3-large)
- ✅ **Database Integration**: Save chunks to MySQL via SQLAlchemy
- ✅ **Async Processing**: Background task processing
- ✅ **REST API**: FastAPI endpoints for NestJS integration

## 📋 Prerequisites

- Python 3.11+
- MySQL database (same as NestJS backend)
- OpenAI API key
- Node.js/NestJS backend running

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd python-service
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your settings:
# - OPENAI_API_KEY
# - DATABASE_URL (MySQL connection string)
```

### 3. Run Service

```bash
# Development
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Or using Python
python -m app.main
```

Service will run on: `http://localhost:8000`

## 📡 API Endpoints

### Health Check
```bash
GET /health
```

### Process Document (Async)
```bash
POST /api/v1/process
Content-Type: multipart/form-data

{
  "document_id": "cmjv9wide001mzkz8r22vbcm2",
  "subject_id": "toan-6",
  "document_type": "TEXTBOOK",
  "user_id": "user123",
  "original_filename": "SGK_Toan_6.pdf",
  "file": <binary>
}
```

Response:
```json
{
  "status": "queued",
  "document_id": "cmjv9wide001mzkz8r22vbcm2",
  "message": "Document queued for processing"
}
```

### Process Document (Sync - for testing)
```bash
POST /api/v1/process-sync
# Same parameters as above
```

## 🔗 Integration with NestJS

### Option 1: HTTP Call (Simple)

Update `backend/src/documents/documents.service.ts`:

```typescript
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
  
  // 3. Call Python service
  const formData = new FormData();
  formData.append('file', file.buffer, file.originalname);
  formData.append('document_id', document.id);
  formData.append('subject_id', subjectId);
  formData.append('document_type', type);
  formData.append('user_id', userId);
  formData.append('original_filename', file.originalname);
  
  try {
    await axios.post('http://localhost:8000/api/v1/process', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    
    return {
      documentId: document.id,
      message: 'Document queued for processing',
    };
  } catch (error) {
    console.error('Python service error:', error);
    // Fallback: process locally or mark as failed
    throw error;
  }
}
```

### Option 2: Queue-based (Advanced)

Use RabbitMQ or Redis Queue to decouple services.

## 🐳 Docker

### Build and Run

```bash
docker-compose up -d
```

### View Logs

```bash
docker-compose logs -f python-service
```

## 📊 Processing Flow

```
1. NestJS receives file upload
   ↓
2. Creates Document record (status: PENDING)
   ↓
3. Calls Python service API
   ↓
4. Python service:
   - Parses document (PDF/DOCX/Excel)
   - Detects chapters
   - Chunks content
   - Generates embeddings
   - Saves chunks to MySQL
   ↓
5. Updates Document status (COMPLETED/FAILED)
   ↓
6. NestJS can query chunks for RAG
```

## 🔧 Configuration

Edit `.env`:

```env
# Chunking
CHUNK_SIZE=1000          # Target tokens per chunk
CHUNK_OVERLAP=200       # Overlap between chunks
MAX_CHUNKS_PER_DOCUMENT=100

# OpenAI
OPENAI_EMBEDDING_MODEL=text-embedding-3-large
OPENAI_EMBEDDING_DIMENSIONS=3072

# Database
DATABASE_URL=mysql+pymysql://user:pass@host:port/db
```

## 🧪 Testing

### Test with curl:

```bash
curl -X POST http://localhost:8000/api/v1/process-sync \
  -F "document_id=test123" \
  -F "subject_id=toan-6" \
  -F "document_type=TEXTBOOK" \
  -F "file=@/path/to/test.pdf"
```

### Test PDF parsing:

```python
from app.parsers.pdf_parser import PDFParser

parser = PDFParser()
result = parser.parse("test.pdf")
print(f"Chapters: {len(result['chapters'])}")
```

## 📝 Logs

Logs are written to:
- Console (stdout)
- `logs/app.log` (file, rotates at 10MB)

## 🐛 Troubleshooting

### Error: "OPENAI_API_KEY not set"
- Check `.env` file has `OPENAI_API_KEY=your_key`

### Error: "Database connection failed"
- Verify `DATABASE_URL` format: `mysql+pymysql://user:pass@host:port/db`
- Ensure MySQL is running and accessible

### Error: "File too large"
- Increase `MAX_FILE_SIZE` in `.env` (in bytes)

### Chunks not saving to database
- Check database schema matches (chunks table exists)
- Verify table/column names in `app/database/client.py`

## 🚀 Production Deployment

1. Use Docker with proper environment variables
2. Set up reverse proxy (Nginx) for HTTPS
3. Use process manager (systemd, PM2, or Docker Compose)
4. Monitor logs and set up alerts
5. Scale horizontally if needed (multiple instances)

## 📚 Next Steps

- [ ] Add Redis queue for better job management
- [ ] Implement retry logic with exponential backoff
- [ ] Add progress tracking (WebSocket or polling)
- [ ] Support more file types (PPTX, images with OCR)
- [ ] Add local embedding models (sentence-transformers)
- [ ] Implement caching for repeated queries

## 📄 License

Same as main EduGenie Teacher project.


