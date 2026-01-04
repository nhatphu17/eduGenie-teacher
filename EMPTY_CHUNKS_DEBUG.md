# 🔍 Debug: Chunks Table Empty

## ❌ Vấn đề

Upload file thành công nhưng bảng `chunks` vẫn empty.

## 🔍 Nguyên nhân có thể

1. **Python service không chạy**
2. **Background task fail nhưng không log**
3. **Database connection fail**
4. **SQL query fail (column names không match)**
5. **No chunks generated** (parsing failed)

## ✅ Đã Fix - Enhanced Logging

### 1. Python Service - Background Task

**File: `python-service/app/main.py`**
- Log khi background task bắt đầu
- Log full error với stack trace
- Update document status to FAILED nếu có lỗi

### 2. Python Service - Database Client

**File: `python-service/app/database/client.py`**
- Check chunks list trước khi save
- Log sample chunk data
- Validate required fields
- Log từng bước insert
- Full error logging với stack trace

## 🚀 Debug Steps

### Step 1: Check Python Service Logs

Sau khi upload, check Python service logs:

**Expected logs:**
```
🚀 [BACKGROUND TASK] Starting processing for document ...
📖 [PROCESSOR] Step 1: Parsing document...
✅ [PROCESSOR] Parsed document: X chapters
✂️ [PROCESSOR] Step 2: Chunking chapters...
✅ [PROCESSOR] Created total Y chunks
🧮 [PROCESSOR] Step 3: Generating embeddings...
💾 [PROCESSOR] Step 4: Saving chunks to database...
💾 [DB] Starting save_chunks for document ...
📊 [DB] Total chunks to save: Y
🔄 [DB] Starting to insert Y chunks...
✅ [DB] First chunk inserted successfully
✅ [DB] Successfully saved Y chunks
```

**If error:**
```
❌ [DB] Error saving chunks: ...
❌ [DB] Error type: ...
```

### Step 2: Check Document Status

```sql
SELECT 
    id,
    originalFileName,
    status,
    processedAt,
    errorMessage,
    createdAt
FROM documents 
ORDER BY createdAt DESC 
LIMIT 5;
```

**Expected:**
- `status = 'COMPLETED'` (nếu thành công)
- `status = 'FAILED'` (nếu có lỗi, check errorMessage)
- `status = 'PROCESSING'` (đang xử lý)

### Step 3: Check Chunks

```sql
SELECT 
    COUNT(*) as total_chunks,
    COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as chunks_with_embedding
FROM chunks;
```

**Expected:**
- `total_chunks > 0`
- `chunks_with_embedding = total_chunks`

### Step 4: Check Python Service Health

```bash
curl http://localhost:8000/health
```

**Expected:**
```json
{"status": "healthy"}
```

## 🔧 Common Issues & Fixes

### Issue 1: Python Service Not Running

**Symptoms:**
- Backend logs: "Python service unavailable"
- No Python service logs

**Fix:**
```bash
cd python-service
source venv/bin/activate
uvicorn app.main:app --reload
```

### Issue 2: Database Connection Failed

**Symptoms:**
- Python logs: "Error connecting to database"
- Document status = FAILED

**Fix:**
- Check DATABASE_URL in `.env`
- Verify MySQL is running
- Check credentials

### Issue 3: SQL Query Failed

**Symptoms:**
- Python logs: "Error inserting chunk"
- Error about column names

**Fix:**
- Check Prisma schema column names
- Verify table exists: `SHOW TABLES LIKE 'chunks';`
- Check column names: `DESCRIBE chunks;`

### Issue 4: No Chunks Generated

**Symptoms:**
- Python logs: "Created 0 chunks"
- Document status = FAILED

**Fix:**
- Check file content (có thể empty)
- Check parser logs
- Try different file

### Issue 5: Background Task Not Executed

**Symptoms:**
- Document status = PENDING
- No Python service logs

**Fix:**
- Check Python service is running
- Check health endpoint
- Restart Python service

## 📋 Checklist

- [ ] Python service đang chạy?
- [ ] Python service logs show processing?
- [ ] Document status = COMPLETED?
- [ ] Chunks được insert vào database?
- [ ] Chunks có embedding?
- [ ] No errors in Python logs?

## 🎯 Quick Test

### Test 1: Check Python Service

```bash
curl http://localhost:8000/health
```

### Test 2: Check Database

```sql
-- Check recent documents
SELECT id, originalFileName, status, errorMessage 
FROM documents 
ORDER BY createdAt DESC 
LIMIT 1;

-- Check chunks for that document
SELECT COUNT(*) 
FROM chunks 
WHERE documentId = 'document-id-from-above';
```

### Test 3: Check Logs

**Backend logs:**
```
📤 Sending document ... to Python service
✅ Document ... queued for Python processing
```

**Python service logs:**
```
🚀 [BACKGROUND TASK] Starting processing...
✅ [DB] Successfully saved X chunks
```

---

**Sau khi check logs, sẽ biết chính xác vấn đề!** 🎯


