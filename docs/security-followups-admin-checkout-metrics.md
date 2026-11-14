# 安全後續：管理員驗證、結帳、文章統計（issue 2–4）

## 本 PR 已完成

### Issue 2：`isAdmin` 必須 Email 已驗證
- `firestore.rules` / `storage.rules`：`isAdmin()` 改為要求 `email_verified == true`
- Cloud Functions：`isAdminRequest()`（`index.js`、`article-notify-functions.js`、`sponsor-offer-functions.js`）同樣要求已驗證

### Issue 3：公開／續期結帳
- Email 檢查改為嚴格 `email_verified !== true`（缺值／undefined 一併拒絕）
- 新增 `functions/checkout-guards.js`：每位登入 uid 新建結帳至少間隔 60 秒
- **尚未**開啟 `enforceAppCheck: true`：前端 `firebase-config.js` 尚未初始化 App Check，也尚未在 Firebase Console 設定 reCAPTCHA／站台金鑰。貿然開啟會讓結帳全面失敗。

### Issue 4：`articleMetrics` 匿名寫入
- 規則改為：未登入不可 create／update；已登入仍受限於 +1 增量條件
- 管理員仍可寫入（含 publication status index）
- 前端 `articles-core`：未登入時略過統計寫入，避免 console 噪音

## 部署順序建議
1. 合併本 PR 後部署 **Firestore rules**（與 Pages 靜態檔）
2. 部署 **Cloud Functions**（`checkout-guards` + 結帳／管理員相關函式）
3. 以未驗證／已驗證管理員、匿名／已登入會員各抽測一次

## 後續：App Check（建議另開 PR）
1. Firebase Console → App Check → 註冊 Web 應用（reCAPTCHA Enterprise 或 v3）
2. 在 `firebase-config.js` 初始化 `initializeAppCheck`
3. 將公開結帳 callable 改為 `enforceAppCheck: true`
4. 觀察 metrics 一段時間後再考慮對 Firestore 強制 App Check
