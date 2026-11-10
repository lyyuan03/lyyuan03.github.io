# 點燈報名頁：活動內容設定（Phase 1）

報名頁（`preview-vokdayja/`）的「每個活動會變的內容」都放在一份設定裡，不再寫死在程式。

- **內建預設**：`preview-vokdayja/config.default.js`（`window.LYYUAN_SIGNUP_DEFAULT_CONFIG`）。頁面先用它立即渲染；Google 連不上時頁面照常運作。
- **雲端設定**：Google 試算表「活動內容設定」分頁，每個活動一列（活動代碼、版本、最後更新、更新者、設定 JSON）。Apps Script 以
  `GET ?action=config&event=<活動代碼>` 公開提供（快取 120 秒），頁面每次載入只抓一次；內容與內建預設相同就不重繪，不同才重繪並保留已填資料。
- **私密設定**（匯款帳號、確認信文案、報名總表分頁名、報名頁網址）存在隱藏分頁「_私密設定」，只有伺服器讀取，**不會**經過 config 端點，也不在此 repo。
- 伺服器端金額（燈種單價、商品單價與限購、贊助固定金額、運費門檻）一律以設定計算，不信任瀏覽器送來的數字。

## 設定結構（schema 1）

`meta`（頁名、頁面標題、年度標籤、`deadline` 截止時間，台北時間，空白＝不限）、`shipping`（`freeThreshold`、`fee`）、`families`（燈別分頁）、
`roleOrder`／`roleLabels`、`lamps`（key、family、name、role＝個人／公司／總燈首、price、purpose、fortune 籤詩、gift 特贈、hot 熱門、enabled）、
`sponsors`（key、title、fixed；0＝隨喜）、`products`（id、name、price、limit、photo、detail）、`zodiac`（犯太歲卡片與統計）、`stats`（門檻、熱門數）、
`agreements`（注意事項標題與內文）、`copy`（燈卡與統計文字）、`page`（頁面各區標題／說明）、`images`（四張主圖的路徑與說明）。

文字可用 `{{freeThreshold}}`、`{{shippingFee}}`、`{{limit}}`、`{{deadline}}` 代入數字；籤詩／特贈／說明只允許 `<strong>`、`<br>`、`<b>`，其餘會被轉義。

## 尚未可設定

版面與樣式、登記人資料欄位（標籤與提示字）、導覽列與頁尾、送出結果視窗、運費試算訊息、示意用管理面板、圖片檔本身（只能改路徑與說明）。
