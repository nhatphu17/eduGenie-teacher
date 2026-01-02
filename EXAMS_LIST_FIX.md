# 🔧 Fix Exams List Page

## ✅ Đã Fix

### 1. Error Handling

**File: `frontend/src/pages/ExamsList.tsx`**

- Thêm error handling để hiển thị lỗi nếu API fail
- Thêm console.log để debug
- Fix token authentication (dùng axios defaults thay vì localStorage)

### 2. Dashboard Link

**File: `frontend/src/pages/Dashboard.tsx`**

- Thêm "Danh sách đề thi" vào quick actions
- Link đến `/exams`

### 3. Questions Count Fix

**File: `frontend/src/pages/ExamsList.tsx`**

- Fix để hiển thị đúng số câu hỏi (check cả `questions` và `examQuestions`)

## 🚀 Test

### Step 1: Check Browser Console

1. Go to `/exams`
2. Open browser console (F12)
3. Check logs:
   - Should see: `Exams API response: [...]`
   - If error: Check error details

### Step 2: Verify API Response

**Expected response:**
```json
[
  {
    "id": "...",
    "title": "Đề thi Toán lớp 6",
    "description": "...",
    "grade": 6,
    "duration": 45,
    "subject": {
      "id": "...",
      "name": "Toán"
    },
    "questions": [
      {
        "id": "...",
        "question": { ... }
      }
    ]
  }
]
```

### Step 3: Check Authentication

- Verify token is set in axios defaults
- Check Network tab in browser DevTools
- Request should have `Authorization: Bearer <token>` header

## 🔍 Debug

### Nếu không thấy exams

**Check:**
1. **API response có data không?**
   - Check console logs
   - Check Network tab

2. **Authentication có đúng không?**
   - Check axios defaults headers
   - Verify token is valid

3. **Backend có trả về exams không?**
   - Check backend logs
   - Verify `getExams` method works

### Nếu thấy error

**Common errors:**
- `401 Unauthorized` → Token expired or invalid
- `404 Not Found` → API endpoint wrong
- `500 Internal Server Error` → Backend error

**Fix:**
- Re-login to get new token
- Check API URL in `.env`
- Check backend logs

## 📋 Checklist

- [ ] Page `/exams` loads without errors
- [ ] Exams are displayed in grid
- [ ] Each exam card shows: title, description, questions count, duration, grade
- [ ] "Xem chi tiết" button works
- [ ] "Trộn đề" button works
- [ ] "Tạo đề thi mới" button works
- [ ] Sidebar link "Danh sách đề thi" works
- [ ] Dashboard quick action "Danh sách đề thi" works

---

**Sau khi fix, test lại trang danh sách đề thi!** 🎯

