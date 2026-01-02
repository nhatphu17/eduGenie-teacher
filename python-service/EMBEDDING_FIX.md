# 🔧 Fix Embedding & Database Errors

## ❌ Lỗi 1: OpenAI Embeddings

```
Embeddings.create() got an unexpected keyword argument 'dimensions'
```

**Nguyên nhân:**
- `dimensions` parameter chỉ hỗ trợ với `text-embedding-3-*` models
- Cần check model name trước khi add parameter

**Đã fix:**
```python
# Chỉ add dimensions nếu model hỗ trợ
if 'text-embedding-3' in self.model:
    params['dimensions'] = self.dimensions
```

## ❌ Lỗi 2: Database Connection

```
Connection.__init__() got an unexpected keyword argument 'schema'
```

**Nguyên nhân:**
- DATABASE_URL có `?schema=public` (PostgreSQL syntax)
- MySQL không hỗ trợ `schema` parameter

**Đã fix:**
```python
# Remove PostgreSQL-specific parameters
if '?schema=' in db_url:
    db_url = db_url.split('?schema=')[0]
```

## ✅ Đã Fix

1. ✅ OpenAI embeddings - chỉ add `dimensions` nếu model hỗ trợ
2. ✅ Database URL - remove `schema=public` parameter

## 🚀 Restart Service

```bash
cd python-service
source venv/bin/activate
# Stop service (Ctrl+C)
uvicorn app.main:app --reload
```

## 🔍 Verify

Sau khi restart, test upload document:
- ✅ Không còn lỗi embedding
- ✅ Không còn lỗi database connection
- ✅ Chunks được insert vào database
- ✅ Document status: COMPLETED

---

**Sau khi fix, upload lại document và test tạo đề thi!** 🎯

