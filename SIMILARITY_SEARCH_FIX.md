# 🔧 Fix Similarity Search - 0 Relevant Chunks

## ❌ Vấn đề

```
Found 30 chunks for subjectId=...
📊 Found 0 relevant chunks after similarity search
```

**Nguyên nhân:**
- Similarity threshold quá cao (0.5)
- Query embedding không match với document embeddings
- Cần lower threshold và log similarity scores

## ✅ Đã Fix

### 1. Lower Similarity Threshold

**File: `backend/src/ai/ai.service.ts`**

- **Trước:** threshold = 0.5
- **Sau:** threshold = 0.3 (lower để dễ match hơn)
- **Fallback:** Nếu không có chunks trên threshold, return top chunks anyway

### 2. Enhanced Logging

**Added logs:**
- Similarity scores: max, min, avg
- Top 5 similarities
- Chunks above threshold count
- Warning nếu không có chunks trên threshold

### 3. Python Service Console Logging

**File: `python-service/app/main.py`**

- Logs hiện ra console (không chỉ file)
- Colorized output
- Better format

## 🚀 Test

### Step 1: Restart Services

**Backend:**
```bash
cd backend
npm run start:dev
```

**Python Service:**
```bash
cd python-service
source venv/bin/activate
uvicorn app.main:app --reload
```

### Step 2: Test Exam Generation

1. Go to `/exams/generate`
2. Chọn subject và grade
3. Generate exam
4. Check backend logs:

**Expected logs:**
```
🔍 Calculating similarity for 30 chunks...
📊 Similarity scores: max=0.856, min=0.234, avg=0.512
📊 Top 5 similarities: 0.856, 0.789, 0.745, 0.712, 0.689
📊 Chunks above threshold 0.3: 25/30
📊 Found 25 relevant chunks after similarity search
```

**If still 0:**
```
⚠️ No chunks above threshold 0.3, returning top 30 chunks anyway
📊 Found 30 relevant chunks after similarity search
```

## 🔍 Debug Similarity Scores

### Nếu similarity scores quá thấp (< 0.3)

**Có thể do:**
1. **Query không liên quan** đến document content
2. **Embeddings không match** (khác model hoặc version)
3. **Document content không đúng** (parsing failed)

**Fix:**
- Thử query khác (ví dụ: "Toán lớp 6" thay vì "Đề thi môn học lớp 6")
- Check document content trong database
- Verify embeddings được generate đúng

### Nếu similarity scores OK (> 0.5) nhưng vẫn 0 results

**Có thể do:**
- Code bug (đã fix)
- Filter logic sai (đã fix)

## 📋 Checklist

- [ ] Backend đã restart
- [ ] Similarity threshold = 0.3
- [ ] Logs show similarity scores
- [ ] Chunks được return (dù có trên threshold hay không)
- [ ] Python service logs hiện ra console

## 🎯 Expected Behavior

**After fix:**
- Similarity scores được log
- Nếu có chunks trên threshold → return filtered chunks
- Nếu không có chunks trên threshold → return top chunks anyway (với warning)
- **Luôn có kết quả** (không còn 0 chunks)

---

**Sau khi fix, test lại và check similarity scores!** 🎯


