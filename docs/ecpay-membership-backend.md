# 綠界會員自動開通後端

本後端使用 Firebase Functions、Firestore 與綠界全方位金流，處理：

1. 管理員在文章後台建立會員付款訂單。
2. 系統寄出會員專屬綠界付款連結。
3. 綠界透過 `ReturnURL` 通知付款結果。
4. 後端驗證 `CheckMacValue`、特店編號、金額與 `RtnCode`。
5. 以 Firestore transaction 防止同一通知重複延長會期。
6. 自動更新 `memberAccess` 並寄出開通信。

## 部署前必要設定

Firebase 專案必須採 Blaze 方案，才能部署第 2 代 Cloud Functions。

設定綠界秘密：

```bash
firebase functions:secrets:set ECPAY_CONFIG --project lyyuan03-membership
```

輸入單行 JSON：

```json
{"merchantId":"正式特店編號","hashKey":"正式HashKey","hashIV":"正式HashIV","environment":"production"}
```

正式上線前可先使用 `environment: "stage"` 與綠界測試特店資料。

設定寄信 SMTP 秘密：

```bash
firebase functions:secrets:set SMTP_CONFIG --project lyyuan03-membership
```

輸入單行 JSON：

```json
{"host":"smtp.gmail.com","port":465,"secure":true,"user":"lyyuan03@gmail.com","pass":"Google應用程式密碼","from":"LYY靈元院行政團隊 <lyyuan03@gmail.com>"}
```

請使用 Google「應用程式密碼」，不可使用 Gmail 一般登入密碼。

## 正式部署

GitHub Actions → `Deploy Firebase Membership Backend` → `Run workflow`

或在本機執行：

```bash
firebase deploy --only functions,firestore:rules --project lyyuan03-membership
```

## Function 端點

- 建立訂單：`createMembershipCheckout`（Callable，僅限管理員）
- 後端狀態：`membershipBackendStatus`
- 會員付款轉址：`membershipPayment`
- 綠界付款通知：`ecpayMembershipCallback`

秘密資料只存放在 Google Cloud Secret Manager，不得加入 GitHub。
