# 🔍 Debug: No Documents/Chunks Found

## ❌ Vấn đề

```
⚠️ No chunks found, but found 0 COMPLETED documents for subjectId=...
```

## 🔍 Nguyên nhân có thể

1. **Chưa upload document** cho subject đó
2. **Document đang processing** (PENDING hoặc PROCESSING)
3. **Document failed** (FAILED status)
4. **Subject ID không đúng** (typo hoặc wrong ID)

## ✅ Đã Fix - Enhanced Logging

### Backend Logs sẽ hiện:

```
⚠️ No chunks found for subjectId=...
📊 Document status summary:
  - Total documents: X
  - COMPLETED: Y
  - PENDING: Z
  - PROCESSING: W
  - FAILED: V
📄 All documents for subjectId=...:
  - COMPLETED: filename.docx (ID: ..., 5m ago)
  - PROCESSING: filename2.pdf (ID: ..., 2m ago)
  - FAILED: filename3.xlsx (ID: ..., 10m ago, Error: ...)
```

## 🚀 Debug Steps

### Step 1: Check Backend Logs

Sau khi tạo đề thi, check logs để xem:
- Có documents không?
- Status của documents là gì?
- Có lỗi gì không?

### Step 2: Check Database

```sql
-- Check ALL documents for subject
SELECT 
    id,
    originalFileName,
    status,
    processedAt,
    errorMessage,
    createdAt,
    TIMESTAMPDIFF(MINUTE, createdAt, NOW()) as minutes_ago
FROM documents 
WHERE subjectId = 'cmjv9id7100026s6ubrxf0rmx'
ORDER BY createdAt DESC;
```

**Expected results:**
- Có ít nhất 1 document
- Status = COMPLETED
- processedAt không null
- errorMessage null

### Step 3: Check Chunks

```sql
-- Check chunks for documents
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

## 🔧 Solutions

### Solution 1: Upload Document

Nếu không có documents:
1. Go to `/documents`
2. Chọn đúng subject và grade
3. Upload document
4. Đợi processing hoàn tất (status = COMPLETED)

### Solution 2: Wait for Processing

Nếu status = PROCESSING:
- Đợi Python service xử lý xong
- Check Python service logs
- Có thể mất vài phút tùy file size

### Solution 3: Fix Failed Documents

Nếu status = FAILED:
```sql
-- Check error message
SELECT id, originalFileName, errorMessage 
FROM documents 
WHERE status = 'FAILED' 
AND subjectId = 'cmjv9id7100026s6ubrxf0rmx';
```

**Fix:**
- Upload lại document
- Check Python service logs
- Fix lỗi (nếu có)

### Solution 4: Verify Subject ID

```sql
-- Check subject exists
SELECT id, name, grade 
FROM subjects 
WHERE id = 'cmjv9id7100026s6ubrxf0rmx';
```

**Fix:**
- Dùng đúng subject ID
- Hoặc tạo subject mới nếu chưa có

## 📋 Checklist

- [ ] Có documents trong database cho subject đó?
- [ ] Document status = COMPLETED?
- [ ] Có chunks với embedding?
- [ ] Python service đang chạy?
- [ ] Python service logs show successful processing?
- [ ] Subject ID đúng?

## 🎯 Quick Fix

1. **Upload document mới:**
   - Go to `/documents`
   - Chọn subject và grade
   - Upload file
   - Đợi processing

2. **Check status:**
   ```sql
   SELECT status, COUNT(*) 
   FROM documents 
   WHERE subjectId = '...' 
   GROUP BY status;
   ```

3. **If FAILED, check error:**
   ```sql
   SELECT errorMessage 
   FROM documents 
   WHERE status = 'FAILED' 
   LIMIT 1;
   ```

---

**Sau khi check logs, sẽ biết chính xác vấn đề!** 🎯

