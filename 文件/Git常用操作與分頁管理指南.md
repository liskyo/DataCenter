# DataCenter 專案 Git 工作流程指南

本指南說明如何在 DataCenter 專案中使用 Git 進行開發，特別是針對 `main` 分支與 `leia0` 分支的同步與合併流程。

## 1. 核心觀念
- **`main` 分支**: 穩定、正式的程式碼。目前開發以此為主。
- **`leia0` 分支**: Leia 的開發分支（位於 `origin/leia0`），包含最新的 3D 設備功能。
- **`origin`**: GitHub 上的遠端儲存庫。

---

## 2. 常用操作流程

### A. 開始工作前 (同步遠端進度)
每次開始開發前，建議先抓取遠端的最新資訊：
```bash
git fetch origin
```

### B. 查看目前同步狀態
檢查你的 `main` 跟 GitHub 上的 `main` 是否同步：
```bash
git status
```

### C. 查看 Leia 的最新進度 (只看紀錄，不合併)
這可以讓你在不改變目前程式碼的情況下，看到 Leia 最近推播了哪些更新：
```bash
git log origin/leia0 -n 5 --oneline
```

### D. 合併 Leia 的進度 (`leia0` -> `main`)
當你要把 Leia 寫好的功能整合到你的 `main` 時，請執行：
```bash
# 確保你在 main 分支
git checkout main

# 執行合併
git merge origin/leia0
```

---

## 3. 處理合併衝突 (Merge Conflict)
如果 Git 顯示「Conflict」，請按照以下步驟：

1. **尋找衝突區塊**: 在程式碼中尋找 `<<<<<<<`, `=======`, `>>>>>>>`。
2. **手動決定程式碼**:
   - `HEAD` (你的變動)
   - `origin/leia0` (Leia 的變動)
3. **標記為已解決**:
   ```bash
   git add <發生衝突的檔案>
   ```
4. **完成合併提交**:
   ```bash
   git commit -m "Merge leia0 and resolve conflicts"
   ```

> [!TIP]
> 如果你在解衝突時覺得太混亂想放棄，可以輸入 `git merge --abort` 恢復原狀。

---

## 4. 如何「後悔」(Revert Changes)

### 尚未合併完成 (正在解衝突)
```bash
git merge --abort
```

### 已經合併完成，但想要回到合併前
```bash
git reset --hard HEAD~1
```

---

## 5. 開發建議
- **頻率**: 建議每天至少執行一次 `git fetch` 看看 Leia 是否有新進度。
- **提交訊息**: Commit 訊息請盡量簡潔明瞭，例如：`fix: 修正 3D 閃爍問題` 或 `feat: 新增伺服器機架模型`。
