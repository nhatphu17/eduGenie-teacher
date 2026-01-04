# 📊 Phân tích Document Processing Flow Hiện tại

## 🎯 Yêu cầu vs Thực tế

### Checklist So sánh:

| Bước | Yêu cầu | Hiện tại | Status |
|------|---------|----------|--------|
| **1. Queue** | Receives jobs from queue | FastAPI BackgroundTasks | ⚠️ **Không có queue thật** |
| **2. Parse** | PDF, DOCX, TXT, Excel | PDF ✅, DOCX ✅, Excel ✅, TXT ❌ | ⚠️ **Thiếu TXT parser** |
| **3. Clean text** | Clean text | ❌ Không có bước clean | ❌ **Thiếu** |
| **4. Detect** | Chapter, Section/Topic, Page range | Chapter ✅, Page ✅, Section/Topic ❌ | ⚠️ **Thiếu Section/Topic** |
| **5. Chunk** | ~500-1000 tokens | 1000 tokens (3000 chars) | ✅ **OK** |
| **6. Embeddings** | Generate embeddings | OpenAI ✅ | ✅ **OK** |
| **7. Storage** | MySQL + Vector DB | Chỉ MySQL | ⚠️ **Thiếu Vector DB** |

---

## 📋 Flow Hiện tại

### Architecture:

```
┌─────────────────────────────────────────────────────────┐
│  Frontend: Upload Document                              │
└──────────────────┬────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│  NestJS Backend                                         │
│  1. Create Document (status: PENDING)                   │
│  2. Check Python service health                         │
│  3. HTTP POST → Python service                          │
└──────────────────┬────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│  Python Service (FastAPI)                               │
│  - Receives HTTP request (KHÔNG phải queue)             │
│  - BackgroundTasks.add_task() → async processing        │
└──────────────────┬────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│  DocumentProcessor.process_document()                    │
│                                                          │
│  1. Parse (PDF/DOCX/Excel)                              │
│     ✅ PDFParser: PyMuPDF                                │
│     ✅ DOCXParser: python-docx                           │
│     ✅ ExcelParser: openpyxl                             │
│     ❌ TXT: Chưa có parser riêng                        │
│                                                          │
│  2. Detect Structure                                     │
│     ✅ Chapter detection (regex patterns)                │
│     ✅ Page range (từ PDF/DOCX)                         │
│     ❌ Section/Topic: Chưa detect                         │
│     ❌ Text cleaning: Không có                            │
│                                                          │
│  3. Chunk                                                │
│     ✅ SmartChunker (custom, không dùng langchain)       │
│     ✅ Size: 1000 tokens (~3000 chars)                  │
│     ✅ Overlap: 200 tokens (~600 chars)                  │
│     ✅ Separators: \n\n\n, \n\n, \n, . , space          │
│                                                          │
│  4. Generate Embeddings                                  │
│     ✅ OpenAIEmbedder                                    │
│     ✅ Model: text-embedding-3-large                     │
│     ✅ Batch processing (10 chunks/batch)                │
│                                                          │
│  5. Save to Database                                     │
│     ✅ DatabaseClient.save_chunks()                      │
│     ✅ INSERT vào MySQL `chunks` table                   │
│     ✅ Embeddings lưu trong JSON field                    │
│     ❌ KHÔNG có Vector DB riêng (Qdrant/Pinecone)       │
└──────────────────┬────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│  MySQL Database                                          │
│  - documents table (metadata)                            │
│  - chunks table (content + embedding JSON)              │
│  ❌ Embeddings lưu trong MySQL, không có Vector DB      │
└─────────────────────────────────────────────────────────┘
```

---

## ✅ Những gì ĐÃ CÓ

### 1. ✅ Parsing (3/4 file types)

**PDF:**
- ✅ PyMuPDF (fitz)
- ✅ Extract text page by page
- ✅ Detect chapters (regex patterns)
- ✅ Extract metadata (title, author)

**DOCX:**
- ✅ python-docx
- ✅ Extract paragraphs
- ✅ Detect chapters (regex + style detection)
- ✅ Extract metadata

**Excel:**
- ✅ openpyxl
- ✅ Extract all sheets
- ✅ Convert to text

**TXT:**
- ❌ Chưa có parser riêng
- ⚠️ Có thể parse như text file đơn giản

### 2. ✅ Chapter Detection

**PDF:**
```python
# Patterns:
- CHƯƠNG 1, Chương 1
- CHƯƠNG I, II, III (Roman)
- BÀI 1, Bài 1
```

**DOCX:**
```python
# Detect by:
- Heading styles
- Regex patterns
```

### 3. ✅ Chunking

**SmartChunker:**
- ✅ Recursive splitting với separators
- ✅ Preserve paragraph structure
- ✅ Overlap giữa chunks
- ✅ Size: 1000 tokens (~3000 chars)

### 4. ✅ Embeddings

**OpenAIEmbedder:**
- ✅ Model: text-embedding-3-large
- ✅ Dimensions: 3072
- ✅ Batch processing
- ✅ Error handling

### 5. ✅ Storage

**MySQL:**
- ✅ `chunks` table với metadata
- ✅ Embeddings lưu trong JSON field
- ✅ Document status tracking

---

## ❌ Những gì THIẾU

### 1. ❌ Queue System

**Hiện tại:**
- FastAPI `BackgroundTasks` (in-memory, không persistent)
- Nếu service restart → mất jobs

**Cần:**
- ✅ Redis + BullMQ / RabbitMQ
- ✅ Persistent queue
- ✅ Job retry & monitoring
- ✅ Progress tracking

### 2. ❌ TXT Parser

**Hiện tại:**
- Chưa có parser riêng cho .txt files

**Cần:**
```python
class TXTParser:
    def parse(self, file_path: str) -> Dict:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        # Detect chapters, sections
        # Return structured data
```

### 3. ❌ Text Cleaning

**Hiện tại:**
- Không có bước clean text

**Cần:**
- Remove extra whitespace
- Normalize unicode
- Remove headers/footers
- Clean special characters

### 4. ❌ Section/Topic Detection

**Hiện tại:**
- Chỉ detect chapters
- Không detect sections/topics

**Cần:**
- Detect section numbers (1.1, 1.2, 2.3)
- Extract topic keywords
- Link sections to chapters

### 5. ❌ Vector Database

**Hiện tại:**
- Embeddings lưu trong MySQL JSON field
- Search bằng cosine similarity trong Python (chậm)

**Cần:**
- ✅ Qdrant / Pinecone / PGVector
- ✅ Fast similarity search
- ✅ Metadata filtering
- ✅ Scalable

---

## 🔄 So sánh: Yêu cầu vs Hiện tại

### Queue:

| Yêu cầu | Hiện tại |
|---------|----------|
| Receives from queue | HTTP POST (không phải queue) |
| Persistent | BackgroundTasks (in-memory) |
| Retry logic | ❌ Không có |
| Monitoring | ❌ Không có |

### Parsing:

| File Type | Yêu cầu | Hiện tại |
|-----------|---------|----------|
| PDF | ✅ | ✅ |
| DOCX | ✅ | ✅ |
| TXT | ✅ | ❌ |
| Excel | ✅ | ✅ |

### Detection:

| Feature | Yêu cầu | Hiện tại |
|---------|---------|----------|
| Chapter | ✅ | ✅ |
| Section/Topic | ✅ | ❌ |
| Page range | ✅ | ✅ |

### Storage:

| Storage | Yêu cầu | Hiện tại |
|---------|---------|----------|
| MySQL (metadata) | ✅ | ✅ |
| Vector DB (embeddings) | ✅ | ❌ (chỉ MySQL JSON) |

---

## 🎯 Khuyến nghị Cải thiện

### Priority 1: Critical (Cần ngay)

1. **Add TXT Parser**
   ```python
   # python-service/app/parsers/txt_parser.py
   class TXTParser:
       def parse(self, file_path: str) -> Dict:
           # Simple text file parsing
   ```

2. **Add Text Cleaning**
   ```python
   def clean_text(text: str) -> str:
       # Remove extra whitespace
       # Normalize
       # Remove headers/footers
   ```

### Priority 2: Important (Nên có)

3. **Add Section/Topic Detection**
   ```python
   def detect_sections(text: str) -> List[Dict]:
       # Detect 1.1, 1.2, 2.3 patterns
       # Extract topic keywords
   ```

4. **Add Queue System**
   ```python
   # Redis + Celery hoặc BullMQ
   # Persistent jobs
   # Retry logic
   ```

### Priority 3: Nice to Have (Có thể sau)

5. **Add Vector Database**
   ```python
   # Qdrant / Pinecone
   # Fast similarity search
   # Better scalability
   ```

---

## 📊 Tóm tắt

### ✅ Đã có (70%):

- ✅ PDF/DOCX/Excel parsing
- ✅ Chapter detection
- ✅ Smart chunking
- ✅ Embedding generation
- ✅ MySQL storage

### ❌ Thiếu (30%):

- ❌ Queue system (dùng BackgroundTasks)
- ❌ TXT parser
- ❌ Text cleaning
- ❌ Section/Topic detection
- ❌ Vector DB (chỉ MySQL)

### 🎯 Kết luận:

**Hiện tại xử lý từ Python service** (không phải NestJS), nhưng:
- ⚠️ Không có queue thật (chỉ BackgroundTasks)
- ⚠️ Thiếu một số features (TXT, cleaning, sections)
- ⚠️ Không có Vector DB riêng (chỉ MySQL)

**Cần cải thiện để đạt 100% yêu cầu!**


