# 🐍 Python Service Setup Guide

## ❌ Lỗi: "No module named uvicorn"

**Nguyên nhân:** Chưa activate virtual environment hoặc chưa install dependencies.

## ✅ Giải pháp

### Step 1: Activate Virtual Environment

**macOS/Linux:**
```bash
cd python-service
source venv/bin/activate
```

**Windows:**
```bash
cd python-service
venv\Scripts\activate
```

**Verify:** Bạn sẽ thấy `(venv)` ở đầu prompt:
```bash
(venv) user@macbook python-service %
```

### Step 2: Install Dependencies

```bash
# Đảm bảo đã activate venv (thấy (venv) ở đầu)
pip install -r requirements.txt
```

### Step 3: Verify Installation

```bash
# Check uvicorn
python -c "import uvicorn; print('✅ uvicorn installed')"

# Check other key packages
python -c "import fastapi; print('✅ fastapi installed')"
python -c "import pymysql; print('✅ pymysql installed')"
```

### Step 4: Run Service

```bash
# Cách 1: Dùng uvicorn command
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Cách 2: Dùng Python module
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## 🔍 Troubleshooting

### Nếu vẫn báo "No module named uvicorn"

**1. Kiểm tra đã activate venv chưa:**
```bash
which python
# Phải trả về: /Users/anhbao/Downloads/eduGenie-teacher/python-service/venv/bin/python
```

**2. Nếu chưa có venv, tạo mới:**
```bash
cd python-service
python3 -m venv venv
source venv/bin/activate  # macOS/Linux
# hoặc
venv\Scripts\activate  # Windows
```

**3. Install lại dependencies:**
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### Nếu pip install bị lỗi

**Clear cache và install lại:**
```bash
pip cache purge
pip install --no-cache-dir -r requirements.txt
```

### Nếu vẫn conflict dependencies

**Install từng package quan trọng:**
```bash
pip install fastapi uvicorn[standard] pymysql sqlalchemy
pip install pydantic pydantic-settings
pip install openai
pip install langchain-text-splitters
```

## 📋 Quick Start (Full Setup)

```bash
# 1. Navigate to python-service
cd python-service

# 2. Create virtual environment (nếu chưa có)
python3 -m venv venv

# 3. Activate venv
source venv/bin/activate  # macOS/Linux
# hoặc
venv\Scripts\activate  # Windows

# 4. Upgrade pip
pip install --upgrade pip

# 5. Install dependencies
pip install -r requirements.txt

# 6. Configure .env
cp .env.example .env
# Edit .env với DATABASE_URL và OPENAI_API_KEY

# 7. Run service
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## ✅ Verify Service Running

```bash
# Test health endpoint
curl http://localhost:8000/health

# Hoặc mở browser
open http://localhost:8000/health
```

## 🔧 Common Issues

### Issue 1: "venv/bin/python: No module named uvicorn"

**Fix:**
```bash
source venv/bin/activate
pip install uvicorn[standard]
```

### Issue 2: "Permission denied"

**Fix:**
```bash
chmod +x venv/bin/python
```

### Issue 3: "Python version mismatch"

**Fix:**
```bash
# Tạo venv với Python 3.11+
python3.11 -m venv venv
# hoặc
python3.12 -m venv venv
```

---

**Sau khi setup xong, service sẽ chạy tại:** `http://localhost:8000` ✅

