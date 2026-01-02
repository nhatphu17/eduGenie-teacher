# 🐍 Python Service Database Architecture

## 📊 Hiện trạng

### ✅ Python Service **INSERT TRỰC TIẾP** vào Database

**File:** `python-service/app/database/client.py`

```python
class DatabaseClient:
    def save_chunks(...):
        # Insert trực tiếp vào MySQL
        query = text("""
            INSERT INTO chunks (
                id, documentId, chapterNumber, ...
            ) VALUES (...)
        """)
        session.execute(query, {...})
        session.commit()
```

**Flow hiện tại:**
```
NestJS → Python Service (HTTP) → Python Service INSERT trực tiếp vào MySQL
```

## 🔍 Chi tiết

### 1. Python Service làm gì:

- ✅ **Parse** document (PDF/DOCX/Excel)
- ✅ **Chunk** content
- ✅ **Generate** embeddings
- ✅ **INSERT trực tiếp** vào `chunks` table
- ✅ **UPDATE** `documents.status` = COMPLETED

### 2. NestJS làm gì:

- ✅ **Tạo** Document record (status: PENDING)
- ✅ **Gọi** Python service API
- ✅ **Đọc** chunks từ DB (sau khi Python insert)

## ⚖️ So sánh: Trực tiếp vs Gián tiếp

### Option A: INSERT Trực tiếp (Hiện tại) ✅

**Ưu điểm:**
- ✅ **Nhanh**: Không cần round-trip qua NestJS
- ✅ **Đơn giản**: Python tự quản lý transaction
- ✅ **Hiệu quả**: Batch insert nhiều chunks cùng lúc
- ✅ **Decoupled**: Python service độc lập, có thể scale riêng

**Nhược điểm:**
- ❌ **Bypass validation**: Không qua NestJS validation/authorization
- ❌ **Schema mismatch risk**: Raw SQL có thể không match Prisma schema
- ❌ **No business logic**: Không có middleware, hooks, events
- ❌ **Harder to maintain**: 2 nơi write DB (NestJS + Python)

### Option B: Qua NestJS API (Gián tiếp)

**Ưu điểm:**
- ✅ **Centralized**: Tất cả DB operations qua NestJS
- ✅ **Validation**: Dùng Prisma + DTOs
- ✅ **Authorization**: Có thể check permissions
- ✅ **Business logic**: Hooks, events, middleware
- ✅ **Consistency**: Single source of truth

**Nhược điểm:**
- ❌ **Slower**: Thêm HTTP round-trip
- ❌ **Complex**: Cần tạo API endpoints cho Python
- ❌ **Coupling**: Python phụ thuộc NestJS
- ❌ **Bottleneck**: NestJS có thể thành bottleneck

## 🎯 Khuyến nghị

### ✅ **GIỮ INSERT TRỰC TIẾP** (Hiện tại là tốt)

**Lý do:**
1. **Performance**: Insert nhiều chunks (30-100) → HTTP calls sẽ chậm
2. **Decoupling**: Python service có thể scale độc lập
3. **Simplicity**: Không cần tạo thêm API endpoints

### ⚠️ **Nhưng cần cải thiện:**

#### 1. **Dùng Prisma Python Client** (Thay vì raw SQL)

```python
# Thay vì raw SQL
from prisma import Prisma

prisma = Prisma()
await prisma.connect()

# Dùng Prisma client
await prisma.chunk.create_many(
    data=[...chunks...]
)
```

**Lợi ích:**
- ✅ Type-safe
- ✅ Auto-sync với Prisma schema
- ✅ Không lo schema mismatch

#### 2. **Thêm Validation**

```python
# Validate document_id tồn tại
document = await prisma.document.find_unique(
    where={'id': document_id}
)
if not document:
    raise ValueError(f"Document {document_id} not found")
```

#### 3. **Error Handling tốt hơn**

```python
try:
    # Insert chunks
    await prisma.chunk.create_many(...)
    # Update document
    await prisma.document.update(...)
except Exception as e:
    # Rollback, log, notify
    await prisma.document.update(
        where={'id': document_id},
        data={'status': 'FAILED', 'errorMessage': str(e)}
    )
```

## 🔄 Alternative: Hybrid Approach

**Kết hợp cả 2:**

```
Python Service:
- INSERT chunks trực tiếp (nhiều, nhanh)
- UPDATE document status trực tiếp
- Gọi NestJS API cho business logic (nếu cần)
```

**Ví dụ:**
```python
# Insert chunks trực tiếp (nhanh)
await prisma.chunk.create_many(...)

# Gọi NestJS để trigger events/notifications
async with httpx.AsyncClient() as client:
    await client.post(
        f"{NESTJS_URL}/api/documents/{document_id}/processed",
        json={'chunks_count': len(chunks)}
    )
```

## 📋 Implementation: Dùng Prisma Python

### Step 1: Install Prisma Python

```bash
cd python-service
pip install prisma
```

### Step 2: Generate Prisma Client

```bash
# Copy schema từ backend
cp ../backend/prisma/schema.prisma ./prisma/schema.prisma

# Generate Python client
prisma generate
```

### Step 3: Update DatabaseClient

```python
from prisma import Prisma
from prisma.models import Chunk, Document

class DatabaseClient:
    def __init__(self):
        self.prisma = Prisma()
    
    async def connect(self):
        await self.prisma.connect()
    
    async def save_chunks(self, document_id: str, chunks: List[Dict]):
        # Validate document exists
        document = await self.prisma.document.find_unique(
            where={'id': document_id}
        )
        if not document:
            raise ValueError(f"Document {document_id} not found")
        
        # Create chunks
        chunk_data = [
            {
                'documentId': document_id,
                'chapterNumber': chunk.get('chapter_number'),
                'content': chunk.get('content'),
                'embedding': chunk.get('embedding'),
                # ... other fields
            }
            for chunk in chunks
        ]
        
        await self.prisma.chunk.create_many(data=chunk_data)
        
        # Update document status
        await self.prisma.document.update(
            where={'id': document_id},
            data={
                'status': 'COMPLETED',
                'processedAt': datetime.now(),
            }
        )
```

## ✅ Kết luận

### **Hiện tại: INSERT trực tiếp là ĐÚNG**

**Nhưng cần:**
1. ✅ Dùng Prisma Python thay raw SQL
2. ✅ Thêm validation
3. ✅ Better error handling
4. ✅ Logging & monitoring

**Không cần:**
- ❌ Qua NestJS API (sẽ chậm và phức tạp hơn)
- ❌ Tạo thêm endpoints chỉ để insert

---

**Tóm lại: Giữ nguyên INSERT trực tiếp, nhưng cải thiện bằng Prisma Python!** 🎯

