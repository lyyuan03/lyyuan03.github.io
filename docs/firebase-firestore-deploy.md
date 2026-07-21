# Firebase Firestore 部署設定

這個 repo 已經準備好從 GitHub Actions 發布 Firestore 規則。

## 已完成

- `firebase.json` 指向 `firestore.rules`
- `.firebaserc` 指向 Firebase 專案 `lyyuan03-membership`
- `.github/workflows/firebase-firestore.yml` 會：
  - 檢查 Firestore 預設資料庫是否存在
  - 不存在時建立 `(default)` 資料庫
  - 資料庫地區：`asia-east1`
  - 模式：Firestore Native
  - 發布 `firestore.rules`

## GitHub Secret

需要在 GitHub repo 新增 Actions secret：

`FIREBASE_SERVICE_ACCOUNT`

內容請放 Google Cloud / Firebase 服務帳號 JSON 金鑰全文。

## 建議服務帳號權限

服務帳號至少需要以下權限：

- Cloud Datastore Owner
- Firebase Rules Admin
- Service Usage Consumer

如果第一次建立 Firestore Database 失敗，可暫時給予：

- Owner

等 Firestore 建立與規則發布完成後，再改回較小權限。

## 手動執行

GitHub repo → Actions → Deploy Firebase Firestore → Run workflow

成功後，`admin.html` 才能安全寫入 `articles`，前台 `articles.html` 也能讀取已發布文章。
