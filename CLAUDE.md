# CLAUDE.md

## 專案定位

這是靈元院網站（lyyuan.tw）的 GitHub Pages Repository。請以繁體中文、臺灣用語處理內容，保留既有 Firebase Auth／Firestore、付費文章權限與網站部署邏輯。

## Claude 工作規則

1. 先讀取根目錄的 `AGENTS.md`、`README.md`，以及與任務直接相關的規範檔案。
2. 先分析，不修改；先列出預計變更的檔案、原因與風險。
3. 未經明確確認，不直接修改 `main`、不刪除檔案、不改動 Firebase 權限規則。
4. 每次修改保持最小範圍，避免重寫整個大型 JavaScript 檔案。
5. 修改後先檢查語法、引用路徑、Firebase 設定與登入／付費文章流程。
6. 不得讀取、輸出或提交 API Key、OAuth Token、Cookie、Session、私鑰或 Firebase Admin 憑證。
7. 不得把秘密放在前端檔案、Markdown、GitHub Actions log 或 Repository。
8. 完成後回報：變更檔案、驗證結果、尚未驗證的項目與建議的 commit／PR 說明。

## 全站一致性規則（強制）

- 全站頁尾只有一份範本：`partials/site-footer.html`，樣式在 `site-footer.css`。各頁不得自行撰寫或修改頁尾，也不得用 JavaScript 另行插入頁尾。
- 修改頁尾時，只改範本與 `site-footer.css`，再執行 `node scripts/sync-footer.mjs` 同步全站；新增頁面時，放一個空的 `<footer></footer>` 後執行同一個指令即可。
- `node scripts/sync-footer.mjs --check` 已納入 `scripts/audit-production-stability.mjs`，頁尾與範本不一致時審查會失敗。
- 所有課程頁（初階班、進階班、精煉對話、男力瑜伽、線上課程等）的共用區塊（導覽列、頁尾、報名與聯絡資訊、督導說明）日後修改時，必須同步檢查並更新全部課程頁，不可只改單一頁面。

## 內容風格

- 使用繁體中文與臺灣用語。
- 保留宇色老師既有觀點與語氣，不自行添加宗教教義或個案結論。
- 避免制式 AI 排比、逐行短句、過度聳動標題與「其實不是……而是……」句型。
- 文章、公告與社群文案先提出草稿，等待確認後再寫入正式頁面。

## 建議提示詞

```text
先分析這個任務，不要修改檔案。請讀取相關規範，列出：
1. 需要檢查的檔案
2. 建議的最小變更
3. 可能影響的功能
4. 驗證方式
等我確認後再執行。
```
