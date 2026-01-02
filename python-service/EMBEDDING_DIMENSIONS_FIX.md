# 🔧 Fix Embedding Dimensions Error

## ❌ Vấn đề

```
TypeError: Embeddings.create() got an unexpected keyword argument 'dimensions'
```

**Nguyên nhân:**
- OpenAI Python client version cũ không support `dimensions` parameter
- Hoặc cách sử dụng parameter không đúng với version hiện tại

## ✅ Đã Fix

### File: `python-service/app/embeddings/openai_embedder.py`

**Thay đổi:**
- **Trước:** Pass `dimensions` parameter explicitly
- **Sau:** Không pass `dimensions`, để OpenAI API tự động dùng default dimensions

**Lý do:**
- `text-embedding-3-large` có default dimensions là 3072
- Không cần pass `dimensions` parameter nếu muốn dùng default
- Tránh compatibility issues với các version khác nhau của OpenAI client

**Code fix:**
```python
# Trước (có lỗi):
if 'text-embedding-3' in self.model:
    params['dimensions'] = self.dimensions
response = self.client.embeddings.create(**params)

# Sau (fixed):
response = self.client.embeddings.create(
    model=self.model,
    input=texts,  # or text for single
)
# OpenAI sẽ tự động dùng default dimensions (3072 cho text-embedding-3-large)
```

## 🚀 Test

### Step 1: Restart Python Service

```bash
cd python-service
source venv/bin/activate
uvicorn app.main:app --reload --port 8001
```

### Step 2: Test Document Upload

1. Go to `/documents`
2. Upload a document
3. Check Python service logs:

**Expected logs:**
```
✅ [PROCESSOR] Step 3: Generating embeddings...
✅ [PROCESSOR] Generated embeddings for batch 1: 10/30
Generated 10 embeddings in batch (model: text-embedding-3-large, dimensions: 3072)
✅ [PROCESSOR] Step 4: Saving chunks to database...
✅ [PROCESSOR] Successfully processed document: 30 chunks saved.
```

**Nếu vẫn có lỗi:**
- Check OpenAI client version: `pip show openai`
- Update nếu cần: `pip install --upgrade openai`

## 📋 Notes

### Default Dimensions

- **text-embedding-3-small:** 1536 dimensions
- **text-embedding-3-large:** 3072 dimensions (default)

### Nếu muốn custom dimensions

Nếu thực sự cần custom dimensions (ví dụ: 256, 512, 1024), cần:
1. Update OpenAI client: `pip install --upgrade openai>=1.0.0`
2. Verify version: `pip show openai`
3. Uncomment và sử dụng lại code với `dimensions` parameter

**Nhưng hiện tại không cần vì:**
- 3072 dimensions là optimal cho text-embedding-3-large
- Không cần giảm dimensions (sẽ giảm quality)
- Không cần tăng dimensions (không support)

## ✅ Checklist

- [ ] Python service đã restart
- [ ] Embeddings được generate thành công
- [ ] Không còn lỗi `dimensions` parameter
- [ ] Chunks được save vào database
- [ ] Document status = COMPLETED

---

**Sau khi fix, test lại document upload!** 🎯

