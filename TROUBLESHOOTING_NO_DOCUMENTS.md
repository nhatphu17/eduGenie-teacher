# 🔍 Troubleshooting: "Không tìm thấy tài liệu phù hợp"

## ❌ Lỗi

```
Không tìm thấy tài liệu phù hợp. Vui lòng tải lên sách giáo khoa hoặc tài liệu giảng dạy trước.
```

## 🔍 Nguyên nhân có thể

### 1. Chunks chưa được insert (do lỗi embedding)

**Kiểm tra:**
```sql
-- Check document status
SELECT id, originalFileName, status, processedAt, errorMessage 
FROM documents 
WHERE subjectId = 'your-subject-id'
ORDER BY createdAt DESC;

-- Check chunks
SELECT COUNT(*) as chunk_count, documentId 
FROM chunks 
WHERE documentId IN (
    SELECT id FROM documents WHERE subjectId = 'your-subject-id'
)
GROUP BY documentId;
```

**Nếu chunks = 0:**
- Document processing failed (do lỗi embedding trước đó)
- Cần upload lại document sau khi fix lỗi

### 2. Document status chưa COMPLETED

**Kiểm tra:**
```sql
SELECT id, status, processedAt, errorMessage 
FROM documents 
WHERE subjectId = 'your-subject-id';
```

**Nếu status = PENDING hoặc PROCESSING:**
- Document đang được xử lý hoặc bị stuck
- Check Python service logs

### 3. Chunks không có embedding

**Kiểm tra:**
```sql
SELECT COUNT(*) 
FROM chunks 
WHERE documentId IN (
    SELECT id FROM documents WHERE subjectId = 'your-subject-id' AND status = 'COMPLETED'
)
AND embedding IS NOT NULL;
```

**Nếu count = 0:**
- Embeddings chưa được generate
- Cần reprocess document

## ✅ Giải pháp

### Step 1: Fix lỗi embedding (ĐÃ FIX)

- ✅ Remove `dimensions` parameter nếu model không hỗ trợ
- ✅ Fix database URL (remove `schema=public`)

### Step 2: Restart Python service

```bash
cd python-service
source venv/bin/activate
uvicorn app.main:app --reload
```

### Step 3: Upload lại document

1. Go to frontend: `/documents`
2. Upload document mới
3. Wait for processing (check status)
4. Verify chunks được insert

### Step 4: Verify database

```sql
-- Check document
SELECT id, originalFileName, status, processedAt 
FROM documents 
WHERE subjectId = 'your-subject-id'
ORDER BY createdAt DESC 
LIMIT 5;

-- Check chunks
SELECT 
    d.originalFileName,
    COUNT(c.id) as chunk_count,
    SUM(CASE WHEN c.embedding IS NOT NULL THEN 1 ELSE 0 END) as chunks_with_embedding
FROM documents d
LEFT JOIN chunks c ON c.documentId = d.id
WHERE d.subjectId = 'your-subject-id'
GROUP BY d.id, d.originalFileName;
```

### Step 5: Test tạo đề thi

- Go to frontend: `/exams/generate`
- Select subject và grade
- Generate exam
- Should work now!

## 🔧 Nếu vẫn không tìm thấy

### Option 1: Reprocess document

```sql
-- Update document status để reprocess
UPDATE documents 
SET status = 'PENDING', processedAt = NULL, errorMessage = NULL
WHERE id = 'document-id';

-- Delete old chunks
DELETE FROM chunks WHERE documentId = 'document-id';
```

Sau đó upload lại file hoặc trigger processing manually.

### Option 2: Check search query

```typescript
// backend/src/documents/documents.service.ts
// searchDocuments() có thể không tìm thấy chunks

// Verify chunks exist:
const chunks = await this.prisma.chunk.findMany({
  where: {
    document: { subjectId, status: 'COMPLETED' },
    embedding: { not: null },
  },
});
console.log(`Found ${chunks.length} chunks for subject ${subjectId}`);
```

### Option 3: Lower similarity threshold

```typescript
// backend/src/ai/ai.service.ts
// retrieveRelevantChunks() có threshold = 0.7

// Có thể quá cao, thử lower:
.filter((item) => item !== null && item.similarity > 0.5) // Lower threshold
```

## 📋 Checklist

- [ ] Python service đã restart sau khi fix
- [ ] Document đã upload lại (sau khi fix)
- [ ] Document status = COMPLETED
- [ ] Chunks được insert vào database
- [ ] Chunks có embedding (không null)
- [ ] Subject ID đúng khi search
- [ ] Similarity threshold không quá cao

---

**Sau khi fix embedding errors, upload lại document và test!** 🎯


