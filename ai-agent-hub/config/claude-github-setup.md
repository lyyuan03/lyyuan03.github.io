# Claude 連接 GitHub 與網站專案

本 Repository 已加入 `CLAUDE.md`，用來讓 Claude Code 或 Claude 的 GitHub／程式碼工作流程讀取專案規範。它不包含任何帳號憑證，也不會讓公開網站取得 GitHub 權限。

## 你要完成的連接

### Claude Code（本機工作流程）

1. 將 Repository clone 到本機：
   ```bash
   git clone https://github.com/lyyuan03/lyyuan03.github.io.git
   cd lyyuan03.github.io
   ```
2. 在 Claude Code 開啟這個資料夾。
3. 先輸入：
   ```text
   請先讀取 CLAUDE.md、AGENTS.md 與 README.md，只分析，不修改。
   ```
4. 需要寫入 GitHub 時，使用你自己的 GitHub CLI 登入狀態或 SSH 金鑰；不要把 Token 寫進專案。

### Claude 的 GitHub Connector／MCP

若你使用的是 Claude 網頁版或 Claude Desktop，請在 Claude 的設定中連接 GitHub，授權範圍只選取必要的 Repository，並確認可以讀取：

```text
lyyuan03/lyyuan03.github.io
```

連接完成後，先測試：

```text
請讀取 lyyuan03/lyyuan03.github.io 的 CLAUDE.md、AGENTS.md 與 README.md。
只回報目前的網站架構與安全規則，不要修改任何檔案。
```

## 建議權限

- 第一次：只讀取 Repository。
- 要求 Claude 提出修改時：先產生差異或 Pull Request。
- 要部署正式網站：人工檢查差異後再合併。
- 不建議開啟無人審核、直接推送 `main` 或自動發布內容。

## 重要限制

這份設定檔只能提供專案規則，不能代替 Claude 帳號的授權。Claude 是否能直接讀寫 GitHub，取決於你在 Claude 端啟用的 Connector／MCP 權限。若 Claude 端尚未連接 GitHub，請先完成登入與授權；不要將 Personal Access Token 貼到對話或提交到這個公開 Repository。

## 影片中的製作模式對應

影片示範的是「先分析、提出問題、取得確認，再執行」的工作流程。本專案已將它固定成：

```text
讀取規範 → 分析影響 → 提出修改計畫 → 人工確認
→ 修改最小範圍 → 執行檢查 → 建立 PR → 人工合併
```
