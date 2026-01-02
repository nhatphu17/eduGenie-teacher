# 🔧 Fix AI Exam Generation - No Questions

## ❌ Vấn đề

AI không generate questions, trả về error:
```json
{
  "error": "The source materials do not contain enough information to create a complete test with the specified requirements."
}
```

**Nguyên nhân:**
- Prompt quá strict - yêu cầu AI chỉ dùng source materials
- AI quá conservative - không dám tạo questions nếu thiếu thông tin
- System prompt không cho phép AI adapt

## ✅ Đã Fix

### 1. Improved Prompt

**File: `backend/src/exams/exams.service.ts`**

**Thay đổi:**
- Prompt chi tiết hơn với hướng dẫn rõ ràng
- Giải thích từng loại câu hỏi (NB/TH/VD)
- Hướng dẫn format câu hỏi
- Cho phép AI adapt nếu thiếu thông tin

**Code:**
```typescript
const prompt = `Bạn là giáo viên Toán lớp ${grade}. Hãy tạo một đề thi...

YÊU CẦU ĐỀ THI:
- Tổng số câu hỏi: ${totalQuestions}
- Phân bố độ khó: NB/TH/VD với giải thích rõ ràng
- Loại câu hỏi: ${questionTypes.join(', ')}
- Thời gian: ${duration} phút

HƯỚNG DẪN TẠO CÂU HỎI:
1. Dựa vào nội dung trong tài liệu nguồn
2. Tạo câu hỏi phù hợp với chương trình lớp ${grade}
3. Format chi tiết cho MCQ và ESSAY
4. Điểm số và giải thích

LƯU Ý:
- Nếu tài liệu có đủ nội dung, tạo đầy đủ ${totalQuestions} câu
- Nếu thiếu một số phần, tạo câu hỏi dựa trên phần có sẵn
- Đảm bảo phù hợp với độ khó yêu cầu
`;
```

### 2. Relaxed System Prompt

**File: `backend/src/ai/ai.service.ts`**

**Thay đổi:**
- Cho phép AI dùng general knowledge về THCS curriculum
- Yêu cầu questions relate to source materials (không cần 100% từ source)
- Cho phép adapt/simplify nếu cần
- Luôn return questions (ít nhất một số) thay vì error

**Code:**
```typescript
const systemPrompt = `You are an AI assistant helping Vietnamese THCS teachers.

IMPORTANT GUIDELINES:
1. You MUST primarily use information from the provided source materials.
2. You CAN use your general knowledge about Vietnamese THCS curriculum (grades 6-9) to create appropriate questions, BUT questions should relate to topics mentioned in the source materials.
3. You MUST return valid JSON matching this schema.
4. If source materials contain some content, create questions based on what's available. Only return an error if source materials are completely empty or irrelevant.
5. All text must be in Vietnamese.
6. For exam generation: Create questions that test understanding of the concepts in the source materials, even if you need to adapt or simplify them slightly.
7. Always return a valid JSON structure with at least some questions, even if fewer than requested.`;
```

## 🚀 Test

### Step 1: Restart Backend

```bash
cd backend
npm run start:dev
```

### Step 2: Test Exam Generation

1. Go to `/exams/generate`
2. Chọn subject và grade
3. Generate exam
4. Check backend logs:

**Expected logs:**
```
🤖 Generating exam with 29 context chunks...
✅ AI response received: { title: "...", questions: [...] }
📝 Questions in response: 6
📝 Creating question: { content: "...", ... }
✅ Created question: cmjx...
✅ Created 6 questions for exam cmjx...
```

**Nếu vẫn không có questions:**
- Check context chunks có đủ nội dung không
- Check similarity scores
- Try với query khác

## 🔍 Debug

### Nếu AI vẫn không generate questions

**Có thể do:**
1. **Context chunks quá ngắn hoặc không liên quan**
   - Check similarity scores trong logs
   - Lower similarity threshold nếu cần
   - Upload documents với nội dung phù hợp hơn

2. **Prompt vẫn quá strict**
   - Có thể cần relax thêm system prompt
   - Hoặc improve context chunks quality

3. **JSON schema không match**
   - Check AI response format
   - Verify JSON parsing

**Fix:**
- Check backend logs để xem AI response
- Verify context chunks có đủ nội dung
- Try với documents khác

## 📋 Checklist

- [ ] Backend đã restart
- [ ] Prompt đã được update
- [ ] System prompt đã được relax
- [ ] Context chunks có đủ nội dung
- [ ] AI response có questions array
- [ ] Questions được tạo trong DB

## 🎯 Expected Behavior

**After fix:**
- AI response có questions array (ít nhất một số questions)
- Questions được tạo trong DB
- ExamQuestions được link đúng
- Frontend hiện exam với questions

---

**Sau khi fix, test lại exam generation!** 🎯

