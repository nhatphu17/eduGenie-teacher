# 🔒 Remove Secrets from Git History

## Vấn đề

GitHub Secret Scanning phát hiện secret trong **git history**, không chỉ commit hiện tại. Cần xóa khỏi toàn bộ history.

## ✅ Giải pháp

### Option 1: Tạo Commit Mới (Đơn giản nhất)

```powershell
# 1. Đảm bảo đã fix file
git add MACOS_FIX.md .gitignore

# 2. Tạo commit mới
git commit -m "fix: Remove API keys from documentation files"

# 3. Push (nếu vẫn bị chặn, dùng Option 2)
git push origin main
```

### Option 2: Xóa Commit Cũ Khỏi History (Triệt để)

**⚠️ CẨN THẬN: Sẽ rewrite git history!**

```powershell
# 1. Tìm commit có secret
git log --all --full-history -- MACOS_FIX.md

# 2. Xóa secret khỏi history bằng git filter-branch
git filter-branch --force --index-filter `
  "git rm --cached --ignore-unmatch MACOS_FIX.md" `
  --prune-empty --tag-name-filter cat -- --all

# 3. Force push (sẽ rewrite history)
git push origin --force --all
```

### Option 3: Dùng BFG Repo-Cleaner (Khuyên dùng)

BFG nhanh hơn và an toàn hơn git filter-branch:

```powershell
# 1. Download BFG (nếu chưa có)
# https://rtyley.github.io/bfg-repo-cleaner/

# 2. Clone repo mới (bare)
git clone --mirror https://github.com/nhatphu17/eduGenie-teacher.git

# 3. Xóa secret
java -jar bfg.jar --replace-text secrets.txt eduGenie-teacher.git

# 4. Clean up
cd eduGenie-teacher.git
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 5. Push
git push --force
```

### Option 4: Tạo Branch Mới (Nhanh nhất)

Nếu không muốn rewrite history:

```powershell
# 1. Tạo branch mới từ commit trước khi có secret
git log --oneline
# Tìm commit hash TRƯỚC commit có secret

# 2. Tạo branch mới
git checkout -b main-clean <commit-hash-before-secret>

# 3. Cherry-pick các commit sau (không có secret)
git cherry-pick <commit-hash-1> <commit-hash-2> ...

# 4. Add file đã fix
git add MACOS_FIX.md .gitignore
git commit -m "fix: Remove secrets"

# 5. Force push branch mới
git push origin main-clean:main --force
```

## 🎯 Recommended: Quick Fix

**Cách nhanh nhất và an toàn:**

```powershell
# 1. Đảm bảo file đã được fix (không còn secret)
git status

# 2. Stage files
git add MACOS_FIX.md .gitignore FIX_SECRETS.md

# 3. Commit
git commit -m "fix: Remove API keys from documentation"

# 4. Push
git push origin main
```

Nếu vẫn bị chặn, GitHub có thể đang cache. Thử:

1. **Đợi vài phút** - GitHub có thể cần thời gian để rescan
2. **Tạo commit mới** với message khác
3. **Contact GitHub Support** nếu vẫn bị chặn

## 🔍 Verify No Secrets

```powershell
# Tìm tất cả API keys trong codebase
git grep -i "sk-proj-" --all

# Nếu không có output → OK
```

## 📋 Checklist

- [x] Xóa secret khỏi `MACOS_FIX.md`
- [x] Update `.gitignore`
- [ ] Commit changes
- [ ] Push to GitHub
- [ ] Verify no secrets in current files
- [ ] (Optional) Clean git history nếu cần

## 🚨 Important Notes

1. **Never commit secrets again:**
   - Luôn dùng `.env` files (đã trong `.gitignore`)
   - Dùng placeholder trong docs: `your-api-key-here`
   - Review code trước khi commit

2. **If working with team:**
   - Coordinate trước khi force push
   - Có thể cần reset local repos sau khi clean history

3. **GitHub Secret Scanning:**
   - Scan cả history, không chỉ HEAD
   - Có thể mất vài phút để rescan sau khi push

---

**Sau khi push, nếu vẫn bị chặn, có thể cần contact GitHub support hoặc dùng Option 2/3 để clean history.**

