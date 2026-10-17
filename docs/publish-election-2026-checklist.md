# 2026 地方選舉集體意識・贊助文章發布清單

文章：眾心所向，時勢所生（下）：從占卜看臺灣、臺北、臺中與高雄的集體意識  
ID：`collective-unconscious-election-2026-analysis`  
分類：`worldly`（人生）  
權限：`paid`（贊助專屬文章）

## 待匯入檔案

此分支已含文章分享頁、Firestore 加密會員正文發布程式與 GitHub Action。**未上傳以下檔案前，不可合併 PR 或發布文章**：

- `secure-imports/collective-unconscious-election-2026-analysis-20261017.enc.json`：全文已使用網站既有 Firebase 發布服務帳號公開金鑰加密。公開 GitHub 不可保存全文明文。
- `assets/articles/collective-unconscious-election-2026-analysis/00-cover.jpg`
- `assets/articles/collective-unconscious-election-2026-analysis/01-taipei.jpg`
- `assets/articles/collective-unconscious-election-2026-analysis/02-taichung.jpg`
- `assets/articles/collective-unconscious-election-2026-analysis/03-kaohsiung.jpg`
- `assets/articles/collective-unconscious-election-2026-analysis/04-conclusion.jpg`
- `assets/articles/collective-unconscious-election-2026-analysis/thumbnail-vertical.jpg`

完整發布檔案已另行交付網站負責人以便匯入。

## 安全驗證

1. `node --check .github/scripts/publish-election-collective-2026.mjs`
2. `node scripts/lock-paid-article-access-policy.mjs`
3. `node scripts/audit-paid-article-runtime.mjs`
4. `node scripts/audit-production-stability.mjs`
5. 原站 Chromium 連續五次付費文章載入測試。
6. 確認以上圖片均由正式站提供，且 SHA-256 與加密 payload 相符。
7. GitHub Action 更新 `articles/{id}` 公開試閱與 `paidArticleBodies/{id}` 會員正文；確認匿名讀取私密正文回 403。
8. 實際以訪客及符合閱讀期間的贊助會員帳號驗證正確顯示。

**不得修改會員授權規則，也不可將密文解密後存回公開 GitHub。**
