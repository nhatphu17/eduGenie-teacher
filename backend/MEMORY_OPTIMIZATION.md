# Memory Optimization Guide

## Vấn đề: JavaScript Heap Out of Memory

### Nguyên nhân gốc rễ:

1. **File Buffer được giữ quá lâu**: File buffer từ multer được giữ trong memory cho đến khi request kết thúc
2. **Text Content quá lớn**: Sau khi extract, text content có thể rất lớn và được giữ trong memory
3. **Chunks Array**: Tất cả chunks được tạo ra cùng lúc trước khi xử lý
4. **Embeddings**: Mỗi embedding là một array lớn (1536 hoặc 3072 số) được giữ trong memory
5. **Hot Reload trong Dev Mode**: NestJS watch mode có thể giữ thêm memory

### Giải pháp đã áp dụng:

1. ✅ **Giảm file size limit**: 10MB → 5MB → 3MB
2. ✅ **Giảm text content limit**: 500KB → 300KB → 200KB
3. ✅ **Streaming processing**: Xử lý chunks một cách tuần tự, không tạo tất cả cùng lúc
4. ✅ **Tăng heap size**: 4GB → 6GB → 8GB
5. ✅ **Clear references**: Xóa file.buffer và textContent sau khi dùng
6. ✅ **Giảm số chunks tối đa**: 50 → 30
7. ✅ **Tăng delay giữa chunks**: 200ms → 300ms

### Nếu vẫn gặp lỗi:

1. **Giảm file size hơn nữa**: Upload file < 1MB
2. **Tăng heap size**: Thay đổi trong package.json:
   ```json
   "start:dev": "NODE_OPTIONS='--max-old-space-size=12288' nest start --watch"
   ```
3. **Tắt hot reload tạm thời**: Dùng `npm run start` thay vì `start:dev`
4. **Chia nhỏ file**: Upload nhiều file nhỏ thay vì 1 file lớn
5. **Xử lý background job**: Chuyển sang queue system (Bull, BullMQ) để xử lý async

### Best Practices:

- Upload file nhỏ hơn 2MB
- Chia file lớn thành nhiều phần
- Sử dụng background processing cho file lớn
- Monitor memory usage trong production



