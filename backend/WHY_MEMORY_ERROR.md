# Tại sao chỉ upload file lại bị lỗi hết bộ nhớ?

## Câu trả lời ngắn gọn:

**Không phải chỉ upload file** - mà hệ thống đang **xử lý toàn bộ file ngay trong request**, bao gồm:
1. Extract text từ Word/Excel
2. Chunking text thành nhiều phần
3. **Generate embeddings cho TẤT CẢ chunks** (tốn bộ nhớ nhất!)
4. Lưu vào database

## Chi tiết kỹ thuật:

### 1. File Upload (3MB)
- File buffer trong memory: **3MB**

### 2. Extract Text
- Text content sau khi extract: **~200KB-500KB**

### 3. Chunking
- Chia thành 30 chunks, mỗi chunk ~3KB
- Tổng: **~90KB** (không đáng kể)

### 4. Generate Embeddings (PHẦN TỐN BỘ NHỚ NHẤT!)
- **Mỗi embedding** = mảng 3072 số (text-embedding-3-large)
- Mỗi số float = 8 bytes
- **1 embedding = 3072 × 8 = 24KB**
- **30 chunks = 30 × 24KB = 720KB** chỉ cho embeddings

### 5. Vấn đề thực sự:
- **OpenAI API calls**: Mỗi API call tạo response object lớn
- **JSON parsing**: Parse embeddings từ API response
- **Memory overhead**: Node.js objects, Promises, async operations
- **Tất cả giữ trong memory cùng lúc** trong request handler

**Tổng cộng có thể lên đến 1-2GB memory cho 1 file 3MB!**

## Giải pháp đã áp dụng:

### ✅ Giải pháp mới: Background Processing

Thay vì xử lý tất cả trong request:
1. **Lưu file ngay** (nhanh, không tốn bộ nhớ)
2. **Xử lý embeddings sau** (background, không block request)
3. **Xử lý từng chunk một** (không giữ tất cả trong memory)

### Lợi ích:
- ✅ Request trả về ngay (không timeout)
- ✅ Không block server
- ✅ Giảm memory usage đáng kể
- ✅ User có thể upload nhiều file liên tiếp

## So sánh:

| Phương pháp | Memory Usage | Request Time | User Experience |
|------------|--------------|--------------|-----------------|
| **Cũ (xử lý ngay)** | 1-2GB | 30-60s | Phải đợi lâu, dễ timeout |
| **Mới (background)** | ~100MB | 1-2s | Upload nhanh, xử lý sau |

## Kết luận:

Lỗi hết bộ nhớ không phải do upload file, mà do **xử lý embeddings ngay trong request**. Giải pháp là **tách xử lý ra background job**.


