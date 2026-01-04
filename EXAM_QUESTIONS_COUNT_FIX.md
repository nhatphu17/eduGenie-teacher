# 🔧 Fix Exam Questions Count - Only 6 Questions Created

## ❌ Vấn đề

Đề thi chỉ có 6 câu hỏi thay vì số lượng yêu cầu (ví dụ: 10, 15, 20 câu).

**Nguyên nhân có thể:**
1. AI chỉ generate 6 câu (default: 2 NB + 3 TH + 1 VD = 6)
2. AI không hiểu rõ yêu cầu về số lượng
3. Có validation/filter loại bỏ một số questions
4. Fallback logic chỉ tạo 6 câu

## ✅ Đã Fix

### 1. Improved Prompt - Emphasize Exact Count

**File: `backend/src/exams/exams.service.ts`**

- Thêm nhấn mạnh về số lượng chính xác
- Yêu cầu AI tạo ĐÚNG số lượng câu hỏi
- Nhắc lại phân bố độ khó trong prompt

**Code:**
```typescript
LƯU Ý QUAN TRỌNG:
- BẠN PHẢI TẠO ĐÚNG ${totalQuestions} CÂU HỎI (không được ít hơn)
- Phân bố độ khó PHẢI chính xác: ${difficultyDistribution.NB} câu NB, ${difficultyDistribution.TH} câu TH, ${difficultyDistribution.VD} câu VD
- TRẢ VỀ ĐÚNG ${totalQuestions} CÂU HỎI TRONG MẢNG "questions"
```

### 2. Improved System Prompt

**File: `backend/src/ai/ai.service.ts`**

- Yêu cầu AI tạo ĐÚNG số lượng questions được yêu cầu
- Cho phép AI dùng general knowledge nếu source materials thiếu
- Không cho phép return ít hơn số lượng yêu cầu

**Code:**
```typescript
7. You MUST create the EXACT number of questions specified in the prompt. If the prompt says "Tổng số câu hỏi: X", you MUST return exactly X questions.
9. If you need to create more questions than available in source materials, use your knowledge of Vietnamese THCS curriculum to create appropriate questions on the same topics.
```

### 3. Enhanced Logging

**File: `backend/src/exams/exams.service.ts`**

- Log expected vs actual questions count
- Log số questions bị skip
- Warning nếu số lượng không đủ

**Code:**
```typescript
console.log(`📝 Expected total questions: ${totalQuestions} (NB: ${difficultyDistribution.NB}, TH: ${difficultyDistribution.TH}, VD: ${difficultyDistribution.VD})`);

if (examData.questions && examData.questions.length < totalQuestions) {
  console.warn(`⚠️ AI only generated ${examData.questions.length} questions, expected ${totalQuestions}.`);
}

console.log(`✅ Created ${createdQuestions.length} questions for exam ${exam.id} (skipped: ${skippedCount}, expected: ${totalQuestions})`);
```

## 🚀 Test

### Step 1: Restart Backend

```bash
cd backend
npm run start:dev
```

### Step 2: Test Exam Generation

1. Go to `/exams/generate`
2. Set difficulty distribution:
   - NB: 5
   - TH: 5
   - VD: 5
   - Total: 15 questions
3. Generate exam
4. Check backend logs:

**Expected logs:**
```
📝 Expected total questions: 15 (NB: 5, TH: 5, VD: 5)
📝 Questions count: 15
📝 Starting to create 15 questions...
✅ Created 15 questions for exam cmjx... (skipped: 0, expected: 15)
```

**Nếu vẫn chỉ có 6 câu:**
```
⚠️ AI only generated 6 questions, expected 15.
⚠️ Warning: Only 6/15 questions were created.
```

## 🔍 Debug

### Nếu AI vẫn chỉ generate 6 câu

**Có thể do:**
1. **AI không hiểu yêu cầu** → Check prompt có rõ ràng không
2. **Context chunks không đủ** → Check similarity scores
3. **AI limitations** → Có thể cần retry hoặc split thành nhiều requests

**Fix:**
- Check backend logs để xem AI response
- Verify prompt có nhấn mạnh số lượng không
- Try với số lượng nhỏ hơn trước (ví dụ: 10 câu)
- Check context chunks có đủ nội dung không

### Nếu Questions bị skip nhiều

**Có thể do:**
1. **Validation fail** → Check logs for "Skipping question"
2. **Missing required fields** → Check question data structure

**Fix:**
- Check logs để xem questions nào bị skip
- Verify question data structure
- Fix validation logic nếu cần

## 📋 Checklist

- [ ] Backend đã restart
- [ ] Prompt đã nhấn mạnh số lượng chính xác
- [ ] System prompt đã yêu cầu exact count
- [ ] Logs hiển thị expected vs actual count
- [ ] Exam có đúng số lượng questions yêu cầu

## 🎯 Expected Behavior

**After fix:**
- AI sẽ tạo ĐÚNG số lượng questions được yêu cầu
- Logs sẽ hiển thị expected vs actual count
- Warning nếu số lượng không đủ
- Exam sẽ có đúng số lượng questions

---

**Sau khi fix, test lại với số lượng lớn hơn (ví dụ: 15-20 câu)!** 🎯


