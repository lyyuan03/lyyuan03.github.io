# AI Agent Hub

這個目錄把網站的 AI 自動化分成三層，避免把第三方 Agent 直接塞進前台或 Firebase Functions，降低權限、Cookie、API Key 與供應鏈風險。

## 架構

1. **Research / Agent-Reach**
   - 用途：讀取與搜尋公開網頁、YouTube、RSS、GitHub 等來源。
   - 執行位置：本機 Agent 或手動 GitHub Actions。
   - 原則：需要登入狀態的平台（X、Reddit、Facebook、Instagram、小紅書等）只在使用者控制的本機環境設定，不把 Cookie 放進本 repo。

2. **Execution / Goose**
   - 用途：讀檔、改程式、執行測試、處理網站工作。
   - 執行位置：本機工作站／可執行 shell 的 Agent 環境。
   - 原則：Goose 不嵌入 GitHub Pages 前台。它應操作本 repo 的 clone，完成後再透過 Git 提交變更。

3. **Publish / AiToEarn**
   - 用途：內容生成、跨平台發布與互動工作流。
   - 執行位置：AiToEarn MCP 或其服務端。
   - 原則：API Key 只存 GitHub Secrets、Secret Manager 或本機環境變數，絕不寫入公開 repo。

## 建議工作流

```text
選題／任務
   ↓
Agent-Reach：蒐集外部資料與來源
   ↓
人工確認研究方向
   ↓
Goose：整理檔案、修改網站、執行測試
   ↓
人工確認內容與網站結果
   ↓
AiToEarn：建立社群版本／排程／發布
```

## 已內建的安全骨架

- `config/agents.json`：三層 Agent 設定與啟用條件。
- `scripts/check-agent-reach.sh`：安裝固定版本的 Agent-Reach 並執行 doctor。
- `config/aitoearn.mcp.example.json`：AiToEarn MCP 範例；不含 API Key。
- `.github/workflows/ai-agent-hub-check.yml`：只允許手動執行的健康檢查，不會定時自動抓資料或發布內容。

## 啟用順序

### 第一階段：Agent-Reach

到 GitHub → Actions → **AI Agent Hub Check** → Run workflow → 選 `agent-reach`。

此模式只做環境安裝與健康檢查，不會登入你的社群帳號，也不會修改網站內容。

### 第二階段：Goose

在本機安裝 Goose，將本 repo clone 到電腦後，讓 Goose 只在工作分支執行任務。建議指令原則：

```text
先分析，不修改；列出將變更的檔案與風險。
確認後才修改；修改後執行測試；測試成功才提交。
```

### 第三階段：AiToEarn

先向 AiToEarn 取得 API Key，再將 Key 存於安全環境，不要寫進 `config/aitoearn.mcp.example.json`。

預設採「產生草稿 → 人工確認 → 發布」，不啟用無人審核的自動公開發布。

## 安全規則

- 禁止提交任何 API Key、OAuth Token、Cookie、Session、私鑰。
- 禁止 Agent 直接修改 `main` 而未先檢查差異；重大變更應使用分支／PR。
- 對外發布預設需要人工確認。
- Agent-Reach 的登入型平台只在本機使用既有登入狀態，不把登入資訊帶進 GitHub Actions。
- 第三方套件更新前先重新檢查版本與權限，不自動追蹤 `latest`。
