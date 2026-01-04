# 🔒 Database Concurrency: NestJS + Python Service

## ❓ Câu hỏi

**Có sợ conflict khi NestJS và Python cùng dùng chung 1 database không?**

## ✅ Trả lời ngắn gọn

**KHÔNG SỢ** nếu implement đúng. MySQL/PostgreSQL được thiết kế để handle concurrent connections tốt.

## 🔍 Phân tích chi tiết

### 1. Database Concurrency Support

**MySQL/PostgreSQL hỗ trợ:**
- ✅ **Multiple connections** từ nhiều services
- ✅ **ACID transactions** với isolation levels
- ✅ **Row-level locking** (không lock toàn bộ table)
- ✅ **Optimistic locking** (version fields)

### 2. Các trường hợp có thể conflict

#### ⚠️ Case 1: Cùng update 1 record

```python
# Python Service
UPDATE documents SET status = 'COMPLETED' WHERE id = 'doc123'

# NestJS (cùng lúc)
UPDATE documents SET status = 'FAILED' WHERE id = 'doc123'
```

**Kết quả:** Last write wins (MySQL default) hoặc conflict nếu dùng version field.

#### ⚠️ Case 2: Insert duplicate chunks

```python
# Python Service
INSERT INTO chunks (id, documentId, ...) VALUES ('chunk1', 'doc123', ...)

# NestJS (cùng lúc - không có trong code hiện tại)
INSERT INTO chunks (id, documentId, ...) VALUES ('chunk1', 'doc123', ...)
```

**Kết quả:** Primary key constraint violation (nếu cùng ID).

#### ⚠️ Case 3: Read-while-write

```python
# Python đang insert chunks
INSERT INTO chunks ... (100 chunks, mất 5 giây)

# NestJS đọc chunks (cùng lúc)
SELECT * FROM chunks WHERE documentId = 'doc123'
```

**Kết quả:** Có thể đọc partial data (depends on isolation level).

## 🛡️ Giải pháp

### Solution 1: Transaction Isolation (Quan trọng nhất)

**MySQL Default:** `REPEATABLE READ`

```python
# Python Service - Dùng transaction
async with prisma.tx() as transaction:
    # Insert chunks
    await transaction.chunk.create_many(...)
    # Update document
    await transaction.document.update(...)
    # Commit atomic - all or nothing
```

**NestJS Prisma:**
```typescript
// NestJS - Cũng dùng transaction
await this.prisma.$transaction(async (tx) => {
  await tx.document.update(...);
  await tx.chunk.createMany(...);
});
```

### Solution 2: Optimistic Locking (Version field)

**Thêm version field:**

```prisma
model Document {
  id        String   @id
  status    String
  version   Int      @default(0)  // NEW
  // ...
}
```

**Update với version check:**

```python
# Python Service
document = await prisma.document.find_unique(
    where={'id': document_id}
)
if document.version != expected_version:
    raise ConflictError("Document was modified by another process")

await prisma.document.update(
    where={'id': document_id, 'version': document.version},
    data={'status': 'COMPLETED', 'version': {'increment': 1}}
)
```

### Solution 3: Row-level Locking (SELECT FOR UPDATE)

```python
# Python Service - Lock document trước khi update
async with prisma.tx() as tx:
    # Lock row
    document = await tx.document.find_unique(
        where={'id': document_id},
        # Prisma Python không có FOR UPDATE, cần raw query
    )
    
    # Raw SQL với lock
    await tx.query_raw(
        "SELECT * FROM documents WHERE id = ? FOR UPDATE",
        document_id
    )
    
    # Now safe to update
    await tx.chunk.create_many(...)
    await tx.document.update(...)
```

### Solution 4: Separate Responsibilities (Best Practice)

**Phân chia rõ ràng:**

```
NestJS:
- CREATE documents (status: PENDING)
- READ documents & chunks
- UPDATE documents (metadata, status: FAILED nếu cần)
- DELETE documents

Python Service:
- READ documents (status: PENDING)
- INSERT chunks (chỉ insert, không update document trực tiếp)
- UPDATE documents.status (chỉ status: PROCESSING → COMPLETED/FAILED)
```

**Rule:**
- ✅ NestJS quản lý Document lifecycle
- ✅ Python chỉ xử lý processing và insert chunks
- ✅ Không overlap operations

### Solution 5: Use Prisma (Type-safe + Better concurrency)

**Prisma tự động handle:**
- ✅ Connection pooling
- ✅ Transaction management
- ✅ Retry logic
- ✅ Type safety

```python
# Prisma Python
from prisma import Prisma

prisma = Prisma()
await prisma.connect()

# Transaction tự động
async with prisma.tx() as tx:
    await tx.chunk.create_many(data=chunks)
    await tx.document.update(
        where={'id': document_id},
        data={'status': 'COMPLETED'}
    )
```

## 📊 Current Implementation Analysis

### ✅ Hiện tại đã OK:

1. **Separate tables:**
   - NestJS: `documents` (create)
   - Python: `chunks` (insert) + `documents.status` (update)

2. **No overlap:**
   - NestJS không insert chunks
   - Python không create documents

3. **Status-based workflow:**
   ```
   PENDING (NestJS) → PROCESSING (Python) → COMPLETED (Python)
   ```

### ⚠️ Cần cải thiện:

1. **Dùng transaction:**
   ```python
   # Hiện tại: 2 queries riêng
   INSERT chunks...
   UPDATE documents...
   
   # Nên: 1 transaction
   async with prisma.tx() as tx:
       await tx.chunk.create_many(...)
       await tx.document.update(...)
   ```

2. **Thêm error handling:**
   ```python
   try:
       # Insert chunks
   except Exception:
       # Rollback, update status = FAILED
   ```

3. **Validate document exists:**
   ```python
   document = await prisma.document.find_unique(...)
   if not document or document.status != 'PENDING':
       raise ValueError("Invalid document state")
   ```

## 🎯 Best Practices

### 1. **Use Transactions**

```python
async with prisma.tx() as tx:
    # All operations atomic
    await tx.chunk.create_many(...)
    await tx.document.update(...)
```

### 2. **Status-based State Machine**

```
PENDING → PROCESSING → COMPLETED
         ↓
       FAILED
```

**Check status trước khi update:**
```python
document = await prisma.document.find_unique(...)
if document.status != 'PENDING':
    raise InvalidStateError(f"Document is {document.status}")
```

### 3. **Idempotent Operations**

```python
# Check if chunks already exist
existing = await prisma.chunk.find_many(
    where={'documentId': document_id}
)
if existing:
    logger.warning("Chunks already exist, skipping")
    return
```

### 4. **Connection Pooling**

```python
# Prisma tự động pool connections
prisma = Prisma(
    datasource={'url': DATABASE_URL},
    # Prisma handles pooling
)
```

### 5. **Retry Logic**

```python
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10)
)
async def save_chunks_with_retry(...):
    await prisma.chunk.create_many(...)
```

## 📋 Checklist

- [x] Separate responsibilities (NestJS vs Python)
- [ ] Use transactions (atomic operations)
- [ ] Add status validation
- [ ] Error handling & rollback
- [ ] Connection pooling (Prisma tự động)
- [ ] Retry logic for transient errors
- [ ] Logging for debugging conflicts

## ✅ Kết luận

### **KHÔNG SỢ conflict nếu:**

1. ✅ **Dùng transactions** (atomic operations)
2. ✅ **Phân chia rõ responsibilities** (NestJS vs Python)
3. ✅ **Status-based workflow** (state machine)
4. ✅ **Validate trước khi update** (check status)
5. ✅ **Error handling tốt** (rollback on failure)

### **Có thể conflict nếu:**

1. ❌ Không dùng transaction (partial updates)
2. ❌ Cùng update 1 record (last write wins)
3. ❌ Không validate state (race conditions)

### **Recommendation:**

**Giữ nguyên architecture hiện tại, nhưng:**
1. ✅ Dùng Prisma Python (thay raw SQL)
2. ✅ Wrap trong transactions
3. ✅ Thêm status validation
4. ✅ Better error handling

---

**Tóm lại: MySQL/PostgreSQL handle concurrency tốt. Chỉ cần implement đúng best practices!** 🎯


