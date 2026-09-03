# 靈元院官網 Production Stability Lock

本檔案適用所有人工與 AI/Codex 修改。目標只有一個：已驗證正常的正式站，不得因下一個功能修改而被破壞。

## 最高優先規則

1. 不得把「修一個功能」拆成多個直接寫入 main 的半成品提交。跨檔案修改必須在分支完成並一次合併。
2. `articles.html`、`articles-v6.js`、`articles-core-20260810-v6.js`、付費 gate、會員權限、Firestore rules、付款流程屬於受保護核心。
3. 文章詳細頁的 `#article-root` 只允許文章核心負責主要 render。備援 renderer 不得介入詳細頁。
4. 不得新增會監聽整個 `#article-root` 的 MutationObserver，除非僅處理自己的 DOM、有明確範圍、有防重入/節流，且不會因自己修改 DOM 再觸發自己。
5. 不得在非目標文章頁啟動 setInterval、重試迴圈或背景 Firestore 輪詢。
6. 不得為單一已發布文章在通用 runtime 中硬寫 `status = draft`、`accessType` 或特殊 render 分支。
7. Firestore 是文章發布狀態與 accessType 的權威來源；GitHub 靜態稿只能作公開首屏/備援，公開段必須與 Firestore 對齊。
8. 付費正文只允許從受保護的 Firestore 私有來源載入；公開 GitHub 不得含 marker 後的私密正文。
9. Cache token 必須在同一個變更中一次完成，不可先改 runtime、下一個 commit 才補 token。
10. 任何文章核心修改，上線前必須通過 JavaScript syntax、paid access policy audit、production stability contract、Chromium candidate 5-load smoke test。
11. GitHub Actions 的診斷/部署紀錄不得因單純寫入 `.github/diagnostics/**` 或 `.github/deploy-triggers/**` 觸發 GitHub Pages 重新部署。
12. 未通過測試時，優先回到最近 stable 分支；不得在壞版本上連續疊加 rescue/repair/restore 模組。

## 現行穩定基準

- Stable snapshot branch: `stable/2026-09-03-paid-article`
- Baseline commit: `ff8528963c1297e78975c31cb4002227f66cabba`
- 付費文章 Chromium 5/5 驗證：PASS（2026-09-03）