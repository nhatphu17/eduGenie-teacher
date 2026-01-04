# 🔧 Fix 400 Bad Request khi tạo đề thi

## ❌ Lỗi

```
Failed to load resource: the server responded with a status of 400 (Bad Request)
```

## 🔍 Nguyên nhân

**Có thể do:**
1. Không tìm thấy chunks (relevantChunks.length === 0)
2. Similarity threshold quá cao (0.7) → không match được
3. Chunks chưa được insert vào database

## ✅ Đã Fix

### 1. Lower Similarity Threshold

**Trước:**
```typescript
.filter((item) => item !== null && item.similarity > 0.7) // Quá cao
```

**Sau:**
```typescript
.filter((item) => item !== null && item.similarity > 0.5) // Lower threshold
```

### 2. Better Error Messages

**Thêm debug info:**
```typescript
// Check available chunks
const availableChunks = await this.prisma.chunk.findMany(...);

if (relevantChunks.length === 0) {
  const errorMessage = availableChunks.length === 0
    ? 'Không tìm thấy tài liệu phù hợp. Vui lòng tải lên sách giáo khoa hoặc tài liệu giảng dạy trước. (Không có chunks trong database)'
    : `Không tìm thấy tài liệu phù hợp với query. Có ${availableChunks.length} chunks trong database nhưng không match với query.`;
  
  throw new BadRequestException(errorMessage);
}
```

### 3. Added Logging

**Thêm logs để debug:**
- Log query, subjectId, grade
- Log số chunks tìm được
- Log similarity scores

## 🚀 Cần làm

### Step 1: Restart Backend

```bash
cd backend
npm run start:dev
```

### Step 2: Verify Chunks trong Database

```sql
-- Check documents
SELECT id, originalFileName, status, processedAt 
FROM documents 
WHERE subjectId = 'your-subject-id'
ORDER BY createdAt DESC;

-- Check chunks
SELECT 
    COUNT(*) as total_chunks,
    COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as chunks_with_embedding
FROM chunks 
WHERE documentId IN (
    SELECT id FROM documents WHERE subjectId = 'your-subject-id' AND status = 'COMPLETED'
);
```

### Step 3: Test lại

1. Go to frontend: `/exams/generate`
2. Select subject và grade
3. Generate exam
4. Check backend logs để xem:
   - Số chunks tìm được
   - Similarity scores
   - Error messages

## 🔍 Debug Steps

### Nếu vẫn 400:

1. **Check logs:**
   ```
   Found X chunks for subjectId=...
   Found Y relevant chunks
   ```

2. **Check database:**
   ```sql
   SELECT COUNT(*) FROM chunks WHERE documentId IN (...);
   ```

3. **Check similarity:**
   - Có thể cần lower threshold hơn nữa (0.3-0.4)
   - Hoặc chunks không match với query

### Nếu không có chunks:

1. **Upload lại document**
2. **Verify processing completed:**
   ```sql
   SELECT status, processedAt FROM documents WHERE id = '...';
   ```
3. **Check Python service logs**

## 📋 Checklist

- [ ] Backend đã restart
- [ ] Chunks có trong database
- [ ] Chunks có embedding (không null)
- [ ] Document status = COMPLETED
- [ ] Similarity threshold = 0.5 (lower)
- [ ] Check backend logs khi generate exam

---

**Sau khi fix, test lại tạo đề thi và check logs!** 🎯


