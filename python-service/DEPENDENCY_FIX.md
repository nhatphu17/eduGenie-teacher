# 🔧 Fix LangChain Dependency Conflict

## ❌ Lỗi

```
ERROR: Cannot install -r requirements.txt (line 15) and langchain because these package versions have conflicting dependencies.
```

## ✅ Giải pháp

### Vấn đề:
- `langchain==0.1.0` có conflict với `langchain-community`
- Code chỉ cần `RecursiveCharacterTextSplitter` từ `langchain-text-splitters`

### Fix:
1. ✅ **Xóa** `langchain==0.1.0` khỏi requirements.txt
2. ✅ **Giữ** `langchain-text-splitters` (package độc lập)
3. ✅ **Update import** trong `smart_chunker.py`:
   ```python
   # OLD:
   from langchain.text_splitter import RecursiveCharacterTextSplitter
   
   # NEW:
   from langchain_text_splitters import RecursiveCharacterTextSplitter
   ```

## 🚀 Install lại

```bash
cd python-service

# Uninstall conflicting packages (nếu đã cài)
pip uninstall langchain langchain-community -y

# Install lại
pip install -r requirements.txt
```

## ✅ Verify

```bash
# Test import
python -c "from langchain_text_splitters import RecursiveCharacterTextSplitter; print('✅ OK')"
```

## 📋 Alternative: Nếu vẫn conflict

Nếu vẫn có conflict, có thể implement chunking đơn giản không cần langchain:

```python
# Simple chunking without langchain
def chunk_text(text: str, chunk_size: int, overlap: int) -> List[str]:
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunk = text[start:end]
        chunks.append(chunk)
        start = end - overlap
    return chunks
```

Nhưng `langchain-text-splitters` tốt hơn vì có smart separators.

---

**Sau khi fix, chạy lại:**
```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

