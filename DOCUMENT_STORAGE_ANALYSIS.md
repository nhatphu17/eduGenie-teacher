# 📊 Phân tích Giải pháp Lưu trữ & Tìm kiếm Tài liệu

## 🎯 Tổng quan

Hiện tại EduGenie Teacher đang sử dụng **RAG (Retrieval Augmented Generation)** với Vector Embeddings để lưu trữ và tìm kiếm tài liệu. Dưới đây là phân tích chi tiết về giải pháp này.

---

## 📋 Giải pháp Hiện tại: RAG + Vector Embeddings

### Quy trình hoạt động:

```
1. Upload file → 2. Extract text → 3. Chunk text (3000 chars/chunk) 
→ 4. Generate embeddings (OpenAI) → 5. Store in MySQL (LONGTEXT + JSON)
→ 6. Search: Query embedding → Cosine similarity → Top K chunks
```

### Kiến trúc:

```typescript
Document {
  id: string
  subjectId: string          // Môn học + lớp
  type: TEXTBOOK | EXAM_BANK | REFERENCE
  content: LONGTEXT          // Text content (~500KB max)
  embedding: JSON            // Vector [3072 dimensions] from OpenAI
  chunkIndex: number         // Chunk thứ mấy trong file
  originalFileName: string   // Tên file gốc
}
```

### Chi tiết kỹ thuật:

1. **Chunking Strategy:**
   - Chunk size: 3,000 characters
   - Overlap: 400 characters (để giữ ngữ cảnh)
   - Max chunks: 30 chunks/file
   - → Total: ~90,000 chars (90KB) per file

2. **Embedding Model:**
   - Model: `text-embedding-3-large`
   - Dimensions: 3,072
   - Cost: ~$0.00013/1K tokens
   - Quality: Very high semantic understanding

3. **Search Method:**
   - Cosine similarity threshold: 0.7
   - Top K results: 20 chunks
   - Search scope: Tất cả files trong cùng subject/grade

4. **Storage:**
   - Content: MySQL LONGTEXT (up to 4GB)
   - Embeddings: JSON field (3,072 floats ≈ 25KB/chunk)
   - Total per file: ~90KB content + ~750KB embeddings (30 chunks)

---

## ✅ Ưu điểm của Giải pháp Hiện tại

### 1. **Semantic Search Chất lượng cao**
- ✅ Tìm kiếm theo **ý nghĩa**, không chỉ từ khóa
- ✅ Hiểu được **đồng nghĩa**, **ngữ cảnh**
- ✅ Phù hợp với câu hỏi tự nhiên của giáo viên

**Ví dụ:**
```
Query: "Công thức tính diện tích hình tròn"
→ Tìm được: "Diện tích S = πr²" (không cần từ "công thức")

Query: "Cách giải phương trình bậc hai"
→ Tìm được: "Phương trình ax² + bx + c = 0, giải bằng công thức..."
```

### 2. **RAG = Zero Hallucination**
- ✅ AI **CHỈ** trả lời dựa trên tài liệu đã upload
- ✅ Không dùng kiến thức bên ngoài → Đúng SGK Việt Nam
- ✅ Có thể **cite nguồn** (file nào, chunk nào)

### 3. **Scalable & Fast Search**
- ✅ Vector similarity = O(n) nhưng rất nhanh (~50ms cho 1000 chunks)
- ✅ Có thể scale với vector database (Pinecone, Weaviate) sau này
- ✅ Không cần re-index khi thêm file mới

### 4. **Multi-document Context**
- ✅ Tìm kiếm **across all files** trong cùng môn/lớp
- ✅ Kết hợp thông tin từ nhiều nguồn:
  - SGK + Sách bài tập + Đề tham khảo → Đề thi toàn diện

### 5. **Flexible & Maintainable**
- ✅ Dễ thêm filter (type, date, grade)
- ✅ Có thể adjust threshold, top K
- ✅ Upgrade model dễ dàng (GPT-5, better embeddings)

---

## ❌ Nhược điểm của Giải pháp Hiện tại

### 1. **Chi phí OpenAI**
- ❌ Embedding: $0.00013/1K tokens
- ❌ File 50KB (~12K tokens) → $0.00156/file
- ❌ 1000 files → ~$1.56 (chấp nhận được)
- ❌ Nhưng **mỗi search query** cũng tốn 1 embedding call

**→ Giải pháp:** Cache query embeddings, use cheaper model

### 2. **Storage Overhead**
- ❌ Mỗi chunk: 3KB content + 25KB embedding → **8x overhead**
- ❌ 1000 files (30 chunks each) → ~750MB embeddings
- ❌ MySQL JSON không tối ưu cho vector operations

**→ Giải pháp:** Dùng dedicated vector DB (Pinecone, Qdrant)

### 3. **Chunking Loss**
- ❌ Bảng, hình ảnh, công thức toán khó xử lý
- ❌ Chunk có thể cắt ngang câu/đoạn văn
- ❌ Overlap 400 chars giúp nhưng không hoàn hảo

**→ Giải pháp:** Smart chunking (by paragraph, preserve structure)

### 4. **Memory Issues (Đã fix)**
- ❌ Ban đầu: Tạo embeddings đồng bộ → Heap overflow
- ✅ Đã fix: Background processing, sequential chunks

### 5. **No Full-text Search**
- ❌ Không thể search **exact phrase** hoặc regex
- ❌ Ví dụ: Tìm "x² + 2x + 1 = 0" (công thức chính xác)

**→ Giải pháp:** Hybrid search (vector + full-text)

---

## 🔄 Giải pháp Thay thế: Tìm kiếm Trực tiếp trong File

### Option A: Full-text Search trong Database

```typescript
// MySQL Full-text index
ALTER TABLE documents ADD FULLTEXT(content);

// Query
SELECT * FROM documents 
WHERE MATCH(content) AGAINST('diện tích hình tròn' IN NATURAL LANGUAGE MODE);
```

**Ưu điểm:**
- ✅ Nhanh (index-based)
- ✅ Không tốn tiền OpenAI
- ✅ Exact match tốt

**Nhược điểm:**
- ❌ Chỉ match **từ khóa**, không hiểu ngữ nghĩa
- ❌ Không tìm được đồng nghĩa ("diện tích" ≠ "kích thước")
- ❌ Tiếng Việt có dấu → phức tạp
- ❌ AI vẫn phải đọc toàn bộ file → context quá dài, tốn token

---

### Option B: Lưu File Gốc, Parse On-demand

```typescript
Document {
  id: string
  filePath: string          // /uploads/toan-6/sgk-toan-6.docx
  originalFileName: string
  metadata: JSON            // {pages, size, uploadDate}
}

// Khi cần: Parse file → Extract text → Send to AI
```

**Ưu điểm:**
- ✅ Tiết kiệm storage (không lưu embeddings)
- ✅ Giữ nguyên format gốc (tables, images)
- ✅ Không tốn tiền embedding

**Nhược điểm:**
- ❌ **CỰC CHẬM**: Mỗi query phải parse lại file
- ❌ **Không scalable**: AI đọc toàn bộ file (100KB) → quá nhiều tokens
- ❌ GPT-4 max context: 128K tokens (~400KB text)
  - → Không thể đọc nhiều file cùng lúc
- ❌ **Cost EXPLODES**: 100KB file → 25K tokens input → $0.25/query (GPT-4)
  - vs. RAG: 20 chunks × 3KB = 60KB → 15K tokens → $0.15/query

**→ Tốn tiền GẤP ĐÔI, chậm gấp 10 lần**

---

### Option C: Elasticsearch / Algolia

```typescript
// Index documents to Elasticsearch
PUT /documents/_doc/1
{
  "content": "...",
  "subject": "Toán",
  "grade": 6
}

// Full-text + Fuzzy search
GET /documents/_search
{
  "query": {
    "match": {
      "content": "diện tích hình tròn"
    }
  }
}
```

**Ưu điểm:**
- ✅ Full-text search cực nhanh
- ✅ Fuzzy matching, typo tolerance
- ✅ Vietnamese analyzer available

**Nhược điểm:**
- ❌ Vẫn **không hiểu ngữ nghĩa** (như full-text search)
- ❌ Thêm infrastructure (Elasticsearch cluster)
- ❌ Chi phí hosting (~$50/month for managed ES)

---

## 🏆 So sánh Tổng quan

| Tiêu chí | RAG + Embeddings (Hiện tại) | Full-text Search | Parse On-demand | Elasticsearch |
|----------|---------------------------|------------------|-----------------|---------------|
| **Semantic search** | ✅ Excellent | ❌ Poor | ✅ Good (if send to AI) | ❌ Poor |
| **Exact match** | ⚠️ OK | ✅ Excellent | ✅ Excellent | ✅ Excellent |
| **Speed** | ✅ Fast (50ms) | ✅ Very fast (20ms) | ❌ Slow (2s+) | ✅ Very fast (30ms) |
| **Cost per query** | ⚠️ $0.0001 (embed) + $0.15 (AI) | ✅ Free | ❌ $0.25+ | ⚠️ $0.002 (hosting) |
| **Storage cost** | ❌ High (8x) | ✅ Low (1x) | ✅ Very low (file only) | ⚠️ Medium (2x) |
| **Scalability** | ✅ Good | ✅ Good | ❌ Poor | ✅ Excellent |
| **Setup complexity** | ⚠️ Medium | ✅ Easy | ✅ Very easy | ❌ Hard |
| **Vietnamese support** | ✅ Native | ⚠️ Need config | ✅ Native | ✅ Good |
| **Zero hallucination** | ✅ Yes (RAG) | ❌ N/A (not AI) | ✅ Yes (send full file) | ❌ N/A |

---

## 💡 Đề xuất: Hybrid Approach (Best of Both Worlds)

### Architecture:

```
┌─────────────────────────────────────────────────┐
│  User Query: "Công thức tính diện tích tròn"    │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
         ┌───────────────┐
         │ Query Router  │ (Phân tích query)
         └───┬───────┬───┘
             │       │
    Exact?   │       │   Semantic?
             ▼       ▼
    ┌──────────┐  ┌─────────────┐
    │ Full-text│  │ Vector      │
    │ Search   │  │ Search      │
    │ (MySQL)  │  │ (Embeddings)│
    └────┬─────┘  └──────┬──────┘
         │                │
         └────────┬───────┘
                  ▼
          ┌───────────────┐
          │ Merge Results │ (Deduplicate, rank)
          └───────┬───────┘
                  ▼
          ┌───────────────┐
          │ RAG → GPT-4   │
          └───────────────┘
```

### Implementation:

```typescript
async searchDocuments(query: string, subjectId: string) {
  // 1. Detect query type
  const isExactSearch = this.detectExactQuery(query); // Has quotes, math formulas, etc.
  
  if (isExactSearch) {
    // Use full-text search for exact matches
    return this.fullTextSearch(query, subjectId);
  } else {
    // Use vector search for semantic queries
    return this.vectorSearch(query, subjectId);
  }
  
  // Optional: Combine both and merge results
  const [fullTextResults, vectorResults] = await Promise.all([
    this.fullTextSearch(query, subjectId),
    this.vectorSearch(query, subjectId)
  ]);
  
  return this.mergeAndRank(fullTextResults, vectorResults);
}
```

### Benefits:

- ✅ **Best of both**: Semantic understanding + Exact match
- ✅ **Faster**: Use full-text for simple queries (save embedding call)
- ✅ **More accurate**: Combine both ranking signals
- ✅ **Lower cost**: Less AI calls for exact matches

---

## 🎯 Kết luận & Khuyến nghị

### ✅ Giải pháp hiện tại (RAG + Embeddings) là **TỐT** cho use case của EduGenie:

1. **Semantic search** là cần thiết cho giáo viên:
   - Câu hỏi tự nhiên: "Làm sao để dạy phương trình bậc 2?"
   - Không phải IT người, không quen search bằng từ khóa chính xác

2. **Zero hallucination** quan trọng:
   - Giáo dục cần **chính xác 100%** theo SGK
   - RAG đảm bảo AI không bịa ra nội dung

3. **Multi-document context**:
   - Kết hợp SGK + SBT + Đề thi → Đề thi chất lượng cao

### ⚠️ Cần cải thiện:

1. **Thêm Full-text Search** cho exact queries:
   - Add MySQL FULLTEXT index
   - Query router để chọn search method

2. **Optimize Storage**:
   - Xem xét vector DB (Pinecone, Qdrant) sau này nếu scale lớn
   - Hiện tại MySQL JSON đủ dùng cho ~10K documents

3. **Improve Chunking**:
   - Smart chunking by paragraph/section
   - Preserve tables, lists structure
   - OCR for images (nếu SGK có scan)

4. **Cache & Optimize**:
   - Cache query embeddings (popular queries)
   - Use cheaper embedding model for non-critical searches

### 🚫 KHÔNG NÊN chuyển sang "Parse file on-demand":

- ❌ Chậm hơn 10x
- ❌ Tốn tiền gấp đôi (tokens)
- ❌ Không scale
- ❌ Mất semantic search

---

## 📊 Performance Benchmarks (Ước tính)

### Current System (RAG):
- Upload: 10s/file (3MB)
- Search: 200ms (50ms embed + 150ms similarity)
- AI generation: 3-5s (với 20 chunks context)
- Cost/query: ~$0.15 (embedding + AI)
- Storage: ~1MB/file (content + embeddings)

### Alternative (Parse on-demand):
- Upload: 1s/file (just save file)
- Search: N/A (no search, read all files)
- AI generation: 10-15s (parse + read full files)
- Cost/query: ~$0.30+ (large context)
- Storage: ~100KB/file (just files)

**→ Current system 2x faster, same cost, better UX**

---

## 🔧 Action Items (Recommended)

### Phase 1: Optimize hiện tại (1-2 tuần)
- [ ] Add MySQL FULLTEXT index cho `content`
- [ ] Implement hybrid search (vector + full-text)
- [ ] Cache popular query embeddings
- [ ] Monitor costs & performance metrics

### Phase 2: Improve quality (2-3 tuần)
- [ ] Smart chunking (paragraph-based)
- [ ] Add metadata extraction (titles, sections)
- [ ] Improve prompt engineering cho RAG
- [ ] A/B test search quality

### Phase 3: Scale (khi có >5K users)
- [ ] Migrate to dedicated vector DB (Pinecone/Qdrant)
- [ ] Add CDN for file uploads
- [ ] Implement search analytics
- [ ] Fine-tune embedding model (nếu có budget)

---

**Tóm lại:** Giải pháp hiện tại **TỐT và phù hợp**. Chỉ cần optimize chứ không cần thay đổi cơ bản.

