# 🍎 macOS MySQL Connection Fix

## ❌ Lỗi

```
ImportError: dlopen(...): Library not loaded: @rpath/libmysqlclient.24.dylib
```

**Nguyên nhân:** MySQLdb (mysqlclient) cần MySQL client library system, nhưng không tìm thấy trên macOS.

## ✅ Giải pháp: Dùng PyMySQL

PyMySQL là pure Python, không cần system library.

### Step 1: Đảm bảo PyMySQL đã install

```bash
cd python-service
pip install pymysql
```

### Step 2: Update DATABASE_URL trong .env

**Format đúng:**
```env
DATABASE_URL=mysql+pymysql://root:password@localhost:3306/edugenie_teacher
```

**KHÔNG dùng:**
```env
DATABASE_URL=mysql://...  # ❌ Sẽ dùng MySQLdb
DATABASE_URL=mysql+mysqldb://...  # ❌ Cũng dùng MySQLdb
```

### Step 3: Code đã được fix

File `app/database/client.py` đã được update để:
- Tự động convert `mysql://` → `mysql+pymysql://`
- Dùng PyMySQL thay MySQLdb

### Step 4: Restart service

```bash
# Stop service (Ctrl+C)
# Start lại
uvicorn app.main:app --reload
```

## 🔍 Verify

```bash
# Test connection
python -c "from app.database.client import DatabaseClient; db = DatabaseClient(); print('✅ Connected')"
```

## 📋 Alternative: Cài MySQL Client (nếu muốn dùng MySQLdb)

Nếu vẫn muốn dùng MySQLdb:

```bash
# Install MySQL client via Homebrew
brew install mysql-client

# Set library path
export DYLD_LIBRARY_PATH=/opt/homebrew/lib:$DYLD_LIBRARY_PATH

# Reinstall mysqlclient
pip uninstall mysqlclient
pip install mysqlclient
```

**Nhưng PyMySQL đơn giản hơn và đủ dùng!** ✅


