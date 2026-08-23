# github.io
靈元院網頁

## Repository 維護規則

- 任何為了修正單一問題而建立的一次性 GitHub Actions workflow，在完成修正並驗證結果後，必須於當天直接刪除。
- 一次性 workflow 不得僅以移除觸發條件、改成手動觸發或停用的方式，繼續保留在 `.github/workflows/`。
- 修改網頁內容時，應直接編輯對應檔案並使用一般 commit 提交，不得透過 workflow 腳本間接覆寫網頁。
- `.github/workflows/` 僅保留部署、Firebase 同步等確實需要長期自動執行的流程。
