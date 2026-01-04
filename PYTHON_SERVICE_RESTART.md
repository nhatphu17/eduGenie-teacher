# 🔄 Python Service Restart Required

## ❌ Vấn đề

Log cho thấy Python service vẫn đang chạy code cũ với lỗi `dimensions` parameter:

```
TypeError: Embeddings.create() got an unexpected keyword argument 'dimensions'
```

**Nguyên nhân:** Python service chưa restart sau khi fix code.

## ✅ Giải pháp

### Step 1: Stop Python Service

**Nếu đang chạy trong terminal:**
- Press `Ctrl+C` để stop

**Nếu đang chạy trong background:**
```bash
# Find process
ps aux | grep uvicorn

# Kill process
kill <PID>
```

### Step 2: Verify Code Fix

**File: `python-service/app/embeddings/openai_embedder.py`**

Code đã được fix - không còn `dimensions` parameter:
```python
response = self.client.embeddings.create(
    model=self.model,
    input=texts,  # or text for single
)
```

### Step 3: Restart Python Service

```bash
cd python-service
source venv/bin/activate  # hoặc: . venv/bin/activate
uvicorn app.main:app --reload --port 8001
```

**Hoặc nếu dùng Docker:**
```bash
cd python-service
docker-compose restart
```

### Step 4: Test

1. Upload document lại
2. Check logs - should see:
```
✅ [PROCESSOR] Generated embeddings for batch 1: 10/100
Generated 10 embeddings in batch (model: text-embedding-3-large, dimensions: 3072)
```

**Không còn lỗi `dimensions`!**

## 🔍 Verify

**Check Python service logs:**
- Should NOT see: `TypeError: Embeddings.create() got an unexpected keyword argument 'dimensions'`
- Should see: `Generated X embeddings in batch`

**Check document status:**
- Should be `COMPLETED` (not `FAILED`)
- Chunks should be saved in database

---

**Sau khi restart, test lại document upload!** 🎯


