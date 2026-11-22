# 靈元院文選流量分析｜啟用與驗收

本功能分為三份資料，切勿混為同一個數字。

1. **既有 Firestore `articleMetrics`**：累積文章開啟、分享及複製次數。歷史資料仍可在後台查閱，未區分會員，無法依月份回補。
2. **新增 Firestore `articleMonthlyReaders/{YYYY-MM}/readers`**：依臺灣時間按月記錄登入帳號對每篇文章的首次開啟、首次付費解鎖、到達內文 90%（且頁面前景停留至少 15 秒）。一位 Firebase UID 在同一篇文章、同一個月份只存一筆，不包含 Gmail、姓名、電話或私有正文。管理員才能列出名單，訪客與會員無法讀取。
3. **GA4**：網站整體流量、未登入訪客、來源與事件。需要有效的 Google 評估 ID 才會真的送出資料，不會自動補回啟用前的歷史流量。

## Google 端一次性設定

1. 開啟 [Google Analytics](https://analytics.google.com/) 建立 `lyyuan.tw` 的 GA4 資源，新增網站資料串流。
2. 如欲透過 GTM 管理事件，另外在 [Google Tag Manager](https://tagmanager.google.com/) 建立網頁容器，新增 Google 代碼標籤並填入 GA4 的 `G-...` 評估 ID，再發布容器。
3. 到儲存庫根目錄 `analytics-config.js` 填入**其中一種載入方式**：
   - 使用 GTM：`gtmId: "GTM-..."`，`measurementId: ""`。GTM 內必須設定 GA4 的 Google 代碼標籤。
   - 直接使用 GA4：`gtmId: ""`，`measurementId: "G-..."`。文選模組會使用 `gtag("event", ...)` 發送自訂事件。
4. 在 GA4 的「管理 → 自訂定義」註冊事件範圍自訂維度：`article_id`、`access_type`、`member_tier`、`traffic_source`、`read_threshold`。
5. 若使用 GTM，為下列事件建立「自訂事件」觸發條件，從 `dataLayer` 讀取上述參數，交由 GA4 事件標籤送出。避免重複安裝另一份 GA4 程式碼，造成重複計數。
6. 正式啟用前，確認網站隱私權聲明、Cookie 與同意機制符合實際讀者所在地及資料蒐集方式。不要向 GA4 傳送 Email、姓名、電話或文章私密正文。

## 文選事件清單

| 事件 | 何時送出 | 重要參數 |
| --- | --- | --- |
| `article_view` | 文章詳細頁實際呈現後 | `article_id`、`access_type`、`member_tier`、`traffic_source` |
| `paid_article_unlock` | Firebase 權限核對後，付費私有正文真正插入畫面 | 同上 |
| `article_read_progress` | 文章內文到達 25／50／75／90%，90% 另須至少 15 秒前景停留 | 同上及 `read_threshold` |

`member_tier` 可能為 `guest`、`signed_in`、`sponsor`、`wellness`、`lingji`、`admin`。管理員自身的文章事件不計入新統計。登入時使用 Firebase UID 作為 Google User-ID，不傳送 Gmail。

文章核心只多提供 `articleDocId` 供 Firestore 規則核對公開文章（避免後台文件 ID 與靜態文章代稱不同）；閱讀及付費授權規則沿用既有程式，沒有增加新的解鎖途徑。

## 後台與測試

- 使用指定管理員 Gmail 登入 [文章後台](https://lyyuan.tw/admin.html)，點選「文章流量分析」。
- 選月份、查看本月付費文章前三名或前十名、跨月數字、來源比例、歷來熱門文章，以及匯出 CSV。
- 透過 GA4 即時報表、DebugView 及 GTM 預覽確認 `article_view`、`paid_article_unlock`、`article_read_progress` 到站；文章列表、公開文章、尚未取得權限的付費 gate 也要檢查。
- 每個月的會員紀錄保留在 Firestore，後台切換月份即可回看，不必另設每月複製快照。
- Firestore 規則須先在 PR 執行模擬器測試；規則部署由既有 `.github/workflows/firebase-firestore.yml` 在合併進 `main` 後執行。若部署失敗，停止驗收，不得宣稱月報已啟用。

## 使用限制

- Firestore 月報只包含**已登入**且有成功寫入紀錄的讀者；未登入訪客須以 GA4 觀察。
- 付費「解鎖率」是每月不重複登入讀者中，實際載入私有正文的比例，與 Google 搜尋結果的點閱率（CTR）不同。
- 來源辨識優先使用 UTM，否則使用瀏覽器引薦資訊；LINE、Facebook 內建瀏覽器可能沒有完整來源。
- 新資料不能回補上線前的月份；既有 `articleMetrics` 不會被清除。
- Google Analytics、Firestore 與 GitHub Actions 均有各自的使用額度，超過免費額度或啟用特定付費服務可能產生費用。
