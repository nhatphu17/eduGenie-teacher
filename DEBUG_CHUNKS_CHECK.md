# 🔍 Debug: Kiểm tra Chunks trong Database

## ❌ Vấn đề

Backend log: "Found 0 relevant chunks" và "Không có chunks trong database"

## 🔍 Debug Steps

### Step 1: Kiểm tra Documents

```sql
-- Check documents cho subject
SELECT 
    id,
    originalFileName,
    subjectId,
    status,
    processedAt,
    errorMessage,
    createdAt
FROM documents 
WHERE subjectId = 'cmjv9id7100026s6ubrxf0rmx'
ORDER BY createdAt DESC;
```

**Expected:**
- Có ít nhất 1 document với `status = 'COMPLETED'`
- `processedAt` không null
- `errorMessage` null

### Step 2: Kiểm tra Chunks

```sql
-- Check chunks cho documents
SELECT 
    c.id,
    c.documentId,
    c.chunkIndex,
    c.contentLength,
    c.embedding IS NOT NULL as has_embedding,
    d.originalFileName,
    d.status as doc_status
FROM chunks c
JOIN documents d ON d.id = c.documentId
WHERE d.subjectId = 'cmjv9id7100026s6ubrxf0rmx'
ORDER BY c.documentId, c.chunkIndex
LIMIT 20;
```

**Expected:**
- Có chunks với `has_embedding = 1`
- `doc_status = 'COMPLETED'`

### Step 3: Kiểm tra Python Service Logs

Sau khi upload document, check Python service logs:

```
🚀 [BACKGROUND TASK] Starting processing for document ...
📖 [PROCESSOR] Step 1: Parsing document...
✅ [PROCESSOR] Parsed document: X chapters
✂️ [PROCESSOR] Step 2: Chunking chapters...
✅ [PROCESSOR] Created total Y chunks
🧮 [PROCESSOR] Step 3: Generating embeddings...
💾 [PROCESSOR] Step 4: Saving chunks to database...
✅ [DB] Successfully saved Z chunks
```

### Step 4: Verify Processing

```sql
-- Count chunks per document
SELECT 
    d.id as document_id,
    d.originalFileName,
    d.status,
    COUNT(c.id) as chunk_count,
    SUM(CASE WHEN c.embedding IS NOT NULL THEN 1 ELSE 0 END) as chunks_with_embedding
FROM documents d
LEFT JOIN chunks c ON c.documentId = d.id
WHERE d.subjectId = 'cmjv9id7100026s6ubrxf0rmx'
GROUP BY d.id, d.originalFileName, d.status;
```

**Expected:**
- `chunk_count > 0`
- `chunks_with_embedding = chunk_count`

## 🐛 Common Issues

### Issue 1: Document Status = PENDING hoặc PROCESSING

**Fix:**
- Check Python service đang chạy
- Check Python service logs
- Wait for processing to complete

### Issue 2: Document Status = FAILED

**Fix:**
```sql
SELECT errorMessage FROM documents WHERE id = '...';
```
- Check error message
- Upload lại document

### Issue 3: Chunks không có embedding

**Fix:**
- Check OpenAI API key
- Check Python service logs for embedding errors
- Reprocess document

### Issue 4: Subject ID không match

**Fix:**
```sql
-- Verify subject ID
SELECT id, name, grade FROM subjects WHERE id = 'cmjv9id7100026s6ubrxf0rmx';
```

## ✅ Checklist

- [ ] Document status = COMPLETED
- [ ] Chunks exist in database
- [ ] Chunks have embeddings (not null)
- [ ] Subject ID matches between documents and query
- [ ] Python service logs show successful processing
- [ ] Backend logs show chunks found

---

**Sau khi check, sẽ biết chính xác vấn đề ở đâu!** 🎯

