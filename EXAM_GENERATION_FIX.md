# 🔧 Fix Exam Generation - Full Stack

## ❌ Vấn đề

1. **Frontend**: Không có option chọn môn học, chỉ có input text "Nhập ID môn học"
2. **Backend**: Không tìm thấy tài liệu phù hợp
3. **Database**: Chunks có thể chưa được insert hoặc không match với query

## ✅ Đã Fix

### 1. Frontend - Thêm Subject Selector

**Trước:**
```tsx
<input
  type="text"
  value={formData.subjectId}
  placeholder="Nhập ID môn học"
  required
/>
```

**Sau:**
```tsx
// Fetch subjects from backend
const { data: subjects, isLoading: subjectsLoading } = useQuery({
  queryKey: ['subjects'],
  queryFn: async () => {
    const res = await axios.get(`${API_URL}/subjects`);
    return res.data;
  },
});

// Subject selector
<select
  value={formData.subjectId}
  onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
  className="input"
  required
>
  <option value="">Chọn môn học</option>
  {subjects
    ?.filter((s: any) => s.grade === formData.grade)
    .map((subject: any) => (
      <option key={subject.id} value={subject.id}>
        {subject.name}
      </option>
    ))}
</select>
```

### 2. Backend - Lower Similarity Threshold

**File: `backend/src/ai/ai.service.ts`**
```typescript
// Trước: threshold = 0.7 (quá cao)
.filter((item) => item !== null && item.similarity > 0.7)

// Sau: threshold = 0.5 (dễ match hơn)
.filter((item) => item !== null && item.similarity > 0.5)
```

### 3. Backend - Better Error Messages

**File: `backend/src/exams/exams.service.ts`**
```typescript
// Check available chunks
const availableChunks = await this.prisma.chunk.findMany({
  where: {
    document: { subjectId, status: 'COMPLETED' },
    embedding: { not: null },
  },
  take: 5,
});

if (relevantChunks.length === 0) {
  const errorMessage = availableChunks.length === 0
    ? 'Không tìm thấy tài liệu phù hợp. Vui lòng tải lên sách giáo khoa hoặc tài liệu giảng dạy trước. (Không có chunks trong database)'
    : `Không tìm thấy tài liệu phù hợp với query. Có ${availableChunks.length} chunks trong database nhưng không match với query.`;
  
  throw new BadRequestException(errorMessage);
}
```

### 4. Python - Fix Embedding & Database

**File: `python-service/app/embeddings/openai_embedder.py`**
```python
# Only add dimensions if model supports it
if 'text-embedding-3' in self.model:
    params['dimensions'] = self.dimensions
```

**File: `python-service/app/database/client.py`**
```python
# Remove PostgreSQL-specific parameters
if '?schema=' in db_url:
    db_url = db_url.split('?schema=')[0]
```

## 🚀 Cần làm

### Step 1: Restart Services

**Backend:**
```bash
cd backend
npm run start:dev
```

**Python Service:**
```bash
cd python-service
source venv/bin/activate  # macOS/Linux
# hoặc
venv\Scripts\activate  # Windows
uvicorn app.main:app --reload
```

### Step 2: Verify Database

```sql
-- Check subjects
SELECT id, name, grade FROM subjects ORDER BY name, grade;

-- Check documents
SELECT id, originalFileName, subjectId, status, processedAt 
FROM documents 
ORDER BY createdAt DESC 
LIMIT 10;

-- Check chunks
SELECT 
    d.subjectId,
    s.name as subject_name,
    COUNT(c.id) as chunk_count,
    SUM(CASE WHEN c.embedding IS NOT NULL THEN 1 ELSE 0 END) as chunks_with_embedding
FROM documents d
LEFT JOIN chunks c ON c.documentId = d.id
LEFT JOIN subjects s ON s.id = d.subjectId
WHERE d.status = 'COMPLETED'
GROUP BY d.subjectId, s.name;
```

### Step 3: Upload Document (nếu chưa có)

1. Go to frontend: `/documents`
2. Chọn môn học và lớp
3. Upload document (DOCX, PDF, Excel)
4. Đợi processing hoàn tất (status = COMPLETED)

### Step 4: Test Exam Generation

1. Go to frontend: `/exams/generate`
2. **Chọn lớp trước** (6, 7, 8, hoặc 9)
3. **Chọn môn học** từ dropdown (chỉ hiện môn của lớp đã chọn)
4. Nhập thời gian, phân bố độ khó
5. Click "Tạo đề thi"

## 🔍 Debug Checklist

### Frontend:
- [ ] Subject dropdown hiện danh sách môn học
- [ ] Môn học filter theo lớp đã chọn
- [ ] SubjectId được gửi đúng trong request

### Backend:
- [ ] Log: "Searching documents: query=..., subjectId=..., grade=..."
- [ ] Log: "Found X chunks for subjectId=..."
- [ ] Log: "Found Y relevant chunks"

### Database:
- [ ] Có subjects trong database
- [ ] Có documents với status = COMPLETED
- [ ] Có chunks với embedding không null
- [ ] SubjectId match giữa documents và subjects

### Python Service:
- [ ] Service đang chạy (http://localhost:8000/health)
- [ ] Không có lỗi embedding
- [ ] Không có lỗi database connection

## 📊 Expected Flow

```
1. User chọn lớp → Filter subjects theo lớp
2. User chọn môn → Set formData.subjectId
3. User click "Tạo đề thi"
4. Frontend POST /exams/generate với { subjectId, grade, ... }
5. Backend searchDocuments(query, subjectId, grade)
6. Backend generateEmbedding(query)
7. Backend retrieveRelevantChunks(embedding, subjectId, grade)
8. Database query chunks WHERE subjectId = ... AND status = 'COMPLETED'
9. Calculate similarity scores
10. Filter chunks với similarity > 0.5
11. Return top N chunks
12. Generate exam với AI + RAG
```

## ❌ Nếu vẫn lỗi

### "Không tìm thấy tài liệu phù hợp (Không có chunks trong database)"

→ Upload document cho môn học và lớp đó

### "Không tìm thấy tài liệu phù hợp với query. Có X chunks..."

→ Chunks không match với query:
- Lower threshold hơn nữa (0.3-0.4)
- Hoặc query quá specific
- Hoặc document content không liên quan

### "SubjectId không hợp lệ"

→ Check subjects table:
```sql
SELECT * FROM subjects;
```

---

**Sau khi fix, test lại toàn bộ flow!** 🎯


