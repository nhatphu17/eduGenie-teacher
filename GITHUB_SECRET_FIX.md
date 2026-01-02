# 🔒 Fix GitHub Secret Scanning - Step by Step

## Vấn đề

Commit `45c4c22` chứa OpenAI API key trong `MACOS_FIX.md`. GitHub Secret Scanning chặn push vì secret vẫn còn trong git history.

## ✅ Giải pháp: Xóa Secret Khỏi History

### Cách 1: Dùng git filter-branch (Built-in)

```powershell
# 1. Backup branch hiện tại (an toàn)
git branch backup-main

# 2. Xóa file MACOS_FIX.md khỏi toàn bộ history
git filter-branch --force --index-filter `
  "git rm --cached --ignore-unmatch MACOS_FIX.md" `
  --prune-empty --tag-name-filter cat -- --all

# 3. Force push (sẽ rewrite history)
git push origin --force --all

# 4. Clean up
git for-each-ref --format="delete %(refname)" refs/original | git update-ref --stdin
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

### Cách 2: Tạo File Mới (Đơn giản hơn)

```powershell
# 1. Tạo file mới với tên khác (đã fix secret)
# File MACOS_FIX.md đã được fix, nhưng vì commit cũ có secret,
# ta sẽ tạo file mới

# 2. Xóa file cũ khỏi git
git rm --cached MACOS_FIX.md 2>$null

# 3. Tạo file mới (copy từ file đã fix)
Copy-Item MACOS_FIX.md MACOS_FIX_CLEAN.md

# 4. Add file mới
git add MACOS_FIX_CLEAN.md .gitignore

# 5. Commit
git commit -m "fix: Replace MACOS_FIX.md with clean version (no secrets)"

# 6. Push
git push origin main
```

### Cách 3: Interactive Rebase (Nếu commit gần đây)

```powershell
# 1. Rebase interactive từ commit trước secret
git rebase -i 419609f  # Commit trước 45c4c22

# 2. Trong editor, thay "pick" thành "edit" cho commit 45c4c22
# 3. Git sẽ dừng ở commit đó
# 4. Xóa file hoặc fix file
git rm MACOS_FIX.md
# hoặc
# Fix file và add lại
git add MACOS_FIX.md

# 5. Amend commit
git commit --amend --no-edit

# 6. Continue rebase
git rebase --continue

# 7. Force push
git push -f origin main
```

## 🎯 Recommended: Quick Fix

**Cách nhanh nhất và an toàn:**

```powershell
# 1. Xóa file MACOS_FIX.md khỏi commit cũ bằng filter-branch
git filter-branch --force --index-filter `
  "git rm --cached --ignore-unmatch MACOS_FIX.md" `
  --prune-empty --tag-name-filter cat -- --all

# 2. Add file mới (đã fix, không có secret)
# File MACOS_FIX.md hiện tại đã được fix
git add MACOS_FIX.md .gitignore

# 3. Commit
git commit -m "docs: Add MACOS_FIX.md without secrets"

# 4. Force push
git push -f origin main
```

## ⚠️ Lưu ý

1. **Force push sẽ rewrite history:**
   - Nếu làm việc nhóm, cần coordinate
   - Mọi người cần reset local repo sau khi push

2. **Sau khi force push:**
   ```powershell
   # Team members cần:
   git fetch origin
   git reset --hard origin/main
   ```

3. **Nếu vẫn bị chặn:**
   - Đợi vài phút (GitHub có thể cần thời gian rescan)
   - Hoặc contact GitHub support

## 🔍 Verify

```powershell
# Kiểm tra không còn secret trong history
git log --all --full-history -p | Select-String -Pattern "sk-proj-"

# Nếu không có output → OK
```

---

**Sau khi xóa secret khỏi history, GitHub sẽ không còn chặn push!** ✅

