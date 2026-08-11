# 靈元院 YouTube 頻道管理設定

本功能採用 Google OAuth 2.0、YouTube Data API v3、YouTube Analytics API 與 Firebase Functions。

## 已實作功能

- 僅限 `lyyuan03@gmail.com` 管理員操作
- Google OAuth 授權與撤銷
- 讀取頻道及最近 25 支影片
- 顯示觀看、按讚、留言及隱私狀態
- 修改影片標題及說明
- 寫入前顯示修改前後差異
- 必須再次確認才會寫入
- Firestore 留存修改前後資料與操作者
- OAuth Client Secret 與 Refresh Token 不會出現在 GitHub Pages 前端

## 一、Google Cloud 設定

1. 開啟與 Firebase 專案相同的 Google Cloud 專案。
2. 在「API 和服務」啟用：
   - YouTube Data API v3
   - YouTube Analytics API
3. 設定 OAuth 同意畫面。
4. 建立「網頁應用程式」OAuth 2.0 用戶端。
5. 加入正式重新導向 URI：

```text
https://asia-east1-lyyuan03-membership.cloudfunctions.net/youtubeOAuthCallback
```

6. OAuth 同意畫面若仍為測試模式，將頻道擁有者的 Google 帳號加入測試使用者。

## 二、設定 Firebase Secret

在具有 Firebase CLI 權限的環境執行：

```bash
firebase functions:secrets:set YOUTUBE_OAUTH_CONFIG
```

輸入單行 JSON：

```json
{
  "clientId": "YOUR_GOOGLE_CLIENT_ID",
  "clientSecret": "YOUR_GOOGLE_CLIENT_SECRET",
  "redirectUri": "https://asia-east1-lyyuan03-membership.cloudfunctions.net/youtubeOAuthCallback"
}
```

不得將實際 client secret 寫入本檔、GitHub Issue、前端 JavaScript 或任何公開版本庫。

## 三、部署

```bash
firebase deploy --only functions
```

網站由 GitHub Pages 部署完成後，開啟：

```text
https://lyyuan.tw/youtube-admin.html
```

登入管理員 Gmail，按「連接 YouTube 帳號」，完成 Google 授權。

## 四、Firestore 資料

系統使用以下後端集合：

- `privateIntegrations/youtube`：OAuth token 與頻道資料
- `youtubeOAuthStates`：十分鐘有效的 OAuth state
- `youtubeAdminAudit`：影片修改稽核紀錄

請勿開放一般前端直接讀取上述集合；所有存取均應經由 Firebase callable functions。

## 五、安全操作原則

- 預設只讀取，不自動批次修改。
- 每次修改必須先呼叫預覽，再由管理員確認。
- 寫入前重新取得完整影片 snippet，保留未修改欄位，避免 YouTube 更新 API 清除既有資料。
- 不在前端保存 refresh token。
- 離職、帳號異動或疑似外洩時，立即在管理頁撤銷授權，並輪替 OAuth client secret。

## 六、後續擴充

目前第一版先處理頻道影片讀取與單支影片標題／說明修改。後續可依相同安全流程加入：

- YouTube Analytics 報表與影片成效排序
- 播放清單管理
- 自訂縮圖上傳
- 留言審核與回覆
- 批次修改草稿與逐筆核准
