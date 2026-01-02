# 🔧 Fix File Upload Validation Error

## ❌ Lỗi

```
Validation failed (current file type is application/vnd.oper officedocument.wordprocessingml.document, 
expected /(applicationVpdf|textVplain|applicationVmsword|...)
```

**Nguyên nhân:**
- FileInterceptor có validation quá strict
- Mime type từ browser có thể khác nhau
- ValidationPipe reject file trước khi đến service

## ✅ Đã Fix

### 1. Remove Strict File Filter

**File: `backend/src/documents/documents.controller.ts`**

- Thêm `fileFilter` để accept tất cả file types
- Log mime type để debug
- Để Python service handle validation

### 2. Add File Type Validation in Service

**File: `backend/src/documents/documents.service.ts`**

- Check file extension (không reject, chỉ warn)
- Log file details để debug
- Let Python service handle unsupported types

### 3. Enhanced Logging

- Log file name, size, mimeType khi upload
- Log Python service health check
- Log processing status

## 🚀 Test

### Step 1: Restart Backend

```bash
cd backend
npm run start:dev
```

### Step 2: Upload Document

1. Go to `/documents`
2. Chọn subject và grade
3. Upload file (DOCX, PDF, Excel, TXT)
4. Check backend logs:
   ```
   📥 Upload request: filename.docx, size: ..., mimeType: ...
   🔍 Checking Python service health...
   📤 Sending document ... to Python service
   ✅ Document ... queued for Python processing
   ```

### Step 3: Check Python Service Logs

```
🚀 [BACKGROUND TASK] Starting processing for document ...
📖 [PROCESSOR] Step 1: Parsing document...
✅ [PROCESSOR] Parsed document: X chapters
✂️ [PROCESSOR] Step 2: Chunking chapters...
💾 [PROCESSOR] Step 4: Saving chunks to database...
✅ [DB] Successfully saved Z chunks
```

## 🔍 Debug "Không có chunks trong database"

### Check Documents

```sql
SELECT 
    id,
    originalFileName,
    subjectId,
    status,
    processedAt,
    errorMessage
FROM documents 
WHERE subjectId = 'your-subject-id'
ORDER BY createdAt DESC;
```

**Expected:**
- `status = 'COMPLETED'`
- `processedAt` không null
- `errorMessage` null

### Check Chunks

```sql
SELECT 
    COUNT(*) as chunk_count,
    SUM(CASE WHEN embedding IS NOT NULL THEN 1 ELSE 0 END) as chunks_with_embedding
FROM chunks c
JOIN documents d ON d.id = c.documentId
WHERE d.subjectId = 'your-subject-id'
AND d.status = 'COMPLETED';
```

**Expected:**
- `chunk_count > 0`
- `chunks_with_embedding = chunk_count`

### If No Chunks

1. **Check Python service logs** - có lỗi không?
2. **Check document status** - có COMPLETED không?
3. **Check errorMessage** - có lỗi gì không?
4. **Upload lại document** - có thể processing failed

## 📋 Checklist

- [ ] File upload không còn validation error
- [ ] Backend logs show file details
- [ ] Python service receives file
- [ ] Python service processes successfully
- [ ] Chunks saved to database
- [ ] Document status = COMPLETED

---

**Sau khi fix, upload lại document và check logs!** 🎯

