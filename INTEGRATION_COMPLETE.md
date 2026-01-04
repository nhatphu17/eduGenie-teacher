# ✅ Integration Complete: Python Service ↔ NestJS

## 🎉 What's Been Done

### 1. ✅ Prisma Schema Updated
- Added `Chunk` model for storing processed chunks
- Added `ProcessingStatus` enum (PENDING, PROCESSING, COMPLETED, FAILED, PARTIALLY_COMPLETED)
- Updated `Document` model with:
  - `status` field for tracking processing
  - `filePath`, `fileSize`, `mimeType` for file metadata
  - `processedAt`, `errorMessage` for status tracking
  - Relation to `Chunk[]`
- Updated `Question` model with:
  - `sourceChunkId` to link questions to source chunks
  - `chapterNumber` for filtering

### 2. ✅ Python Service Client Created
- `backend/src/documents/python-service.client.ts`
- HTTP client to communicate with Python service
- Health check method
- Async document processing method
- Error handling and logging

### 3. ✅ Documents Service Updated
- Now tries Python service first
- Falls back to local processing if Python service unavailable
- Updates document status (PENDING → PROCESSING → COMPLETED/FAILED)
- Better error handling

### 4. ✅ RAG Service Updated
- Now uses `Chunk` model (preferred)
- Falls back to old `Document` method for backward compatibility
- Returns chunk metadata (chapter, page numbers)

### 5. ✅ Documents Module Updated
- Added `PythonServiceClient` provider
- Added `ConfigModule` for environment variables
- Added `PrismaModule` for database access

---

## 🚀 Next Steps

### Step 1: Install Dependencies

```bash
cd backend
npm install axios form-data
```

### Step 2: Run Prisma Migration

```bash
cd backend
npx prisma migrate dev --name add_chunks_and_processing_status
npx prisma generate
```

This will:
- Create `chunks` table
- Add new fields to `documents` table
- Add new fields to `questions` table

### Step 3: Add Environment Variable

Add to `backend/.env`:

```env
PYTHON_SERVICE_URL=http://localhost:8000
```

### Step 4: Start Python Service

```bash
cd python-service
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Configure .env
cp .env.example .env
# Edit .env with your DATABASE_URL and OPENAI_API_KEY

# Run service
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Step 5: Start NestJS Backend

```bash
cd backend
npm run start:dev
```

### Step 6: Test Integration

1. Go to frontend: `http://localhost:5173/documents`
2. Upload a PDF/DOCX file
3. Check NestJS logs: Should see "Sending document to Python service"
4. Check Python service logs: Should see parsing and embedding generation
5. Check database:
   ```sql
   SELECT id, originalFileName, status FROM documents ORDER BY createdAt DESC LIMIT 5;
   SELECT COUNT(*) as chunk_count, documentId FROM chunks GROUP BY documentId;
   ```

---

## 🔍 How It Works

### Upload Flow:

```
1. User uploads file via Frontend
   ↓
2. NestJS receives file
   ↓
3. Creates Document record (status: PENDING)
   ↓
4. Checks Python service health
   ↓
5a. If available → Sends to Python service
    → Python: Parse → Chunk → Embed → Save chunks to DB
    → Updates Document status: PROCESSING → COMPLETED
   ↓
5b. If unavailable → Local processing (fallback)
    → Extract text → Chunk → Embed → Save
   ↓
6. Document ready for RAG search
```

### RAG Search Flow:

```
1. User queries: "Công thức tính diện tích hình tròn"
   ↓
2. Generate query embedding
   ↓
3. Search in Chunks table (preferred)
   - Filter by subjectId
   - Calculate cosine similarity
   - Return top K chunks
   ↓
4. Build context from chunks
   ↓
5. Send to GPT-4 with strict RAG prompt
   ↓
6. Return answer with citations
```

---

## 🐛 Troubleshooting

### Python service not responding

**Check:**
```bash
curl http://localhost:8000/health
```

**Solution:**
- Ensure Python service is running
- Check `PYTHON_SERVICE_URL` in backend `.env`
- Check Python service logs

### Chunks not saving

**Check database:**
```sql
SELECT * FROM chunks LIMIT 5;
```

**Solution:**
- Verify `chunks` table exists (run migration)
- Check Python service logs for errors
- Verify `DATABASE_URL` in Python service `.env`

### Documents stuck in PROCESSING

**Check:**
```sql
SELECT id, originalFileName, status, errorMessage 
FROM documents 
WHERE status = 'PROCESSING' 
AND createdAt < DATE_SUB(NOW(), INTERVAL 1 HOUR);
```

**Solution:**
- Check Python service logs
- Manually update status if needed:
  ```sql
  UPDATE documents SET status = 'FAILED', errorMessage = 'Timeout' WHERE id = '...';
  ```

### Fallback to local processing

If you see: `"Python service unavailable, using local processing"`

**Solution:**
- Start Python service
- Check health endpoint
- Verify network connectivity

---

## 📊 Database Schema

### New Tables:

**chunks**
- `id` (String, PK)
- `documentId` (String, FK → documents)
- `chapterNumber` (Int?)
- `chapterTitle` (String?)
- `pageStart`, `pageEnd` (Int?)
- `content` (LONGTEXT)
- `embedding` (JSON)
- `chunkIndex` (Int)
- `chunkType` (String)

### Updated Tables:

**documents**
- Added: `status`, `filePath`, `fileSize`, `mimeType`, `processedAt`, `errorMessage`
- `content` made nullable (content now in chunks)

**questions**
- Added: `sourceChunkId`, `chapterNumber`

---

## ✅ Testing Checklist

- [ ] Python service running on port 8000
- [ ] NestJS can reach Python service (health check passes)
- [ ] Database migration completed
- [ ] Environment variables configured
- [ ] Upload test successful
- [ ] Chunks saved to database
- [ ] Document status updates correctly
- [ ] RAG search uses chunks
- [ ] Fallback to local processing works

---

## 🎯 Success Indicators

✅ **Working correctly if:**
- Documents upload successfully
- Status changes: PENDING → PROCESSING → COMPLETED
- Chunks appear in database
- RAG search returns results with chapter/page info
- No errors in logs

---

**Ready to test! Start both services and upload a document.** 🚀


