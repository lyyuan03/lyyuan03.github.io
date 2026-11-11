# 丁未年點燈：共用商品庫存（後端接線待完成）

## 已建立於靈元院原始報名試算表
- `商品庫存`：廣財運通香 64 盒、鎮煞護安香粉 33 包；已保留及剩餘由異動流水帳自動計算。
- `_庫存異動`：初始為空，正式登記、修改及取消後由 Apps Script 寫入。
- `_庫存測試登記`：初始化時存在的 2 筆測試報名 ID，編修時也必須豁免。
- 計算：香單盒 1，香會員／一般三盒組各 3，香總燈首每位贈品 2；香粉會員／一般三包組各 3。

## 重要：目前尚未連到正式接單程式
本資料夾的 `stock.gs` 為 Google Apps Script 伺服端模組，不是 GitHub Pages 可執行的後端。
請將其加入目前受理 `POST /exec` 的 Google Apps Script 專案，並修改**原有** `doGet`、`doPost` 的既有路由；完成部署前，網站仍可能超賣。**不可在客戶端宣稱已完成即時防超賣。**

### 一、原有 GET 路由加入
在原有 `doGet(e)` **最前方**辨認 `e.parameter.action==='inventory'`：
```js
if (e && e.parameter && e.parameter.action === 'inventory') {
  return ContentService.createTextOutput(
    JSON.stringify(lyStockPublicStatus_(e.parameter.event))
  ).setMimeType(ContentService.MimeType.JSON);
}
```
其他原有 action（config、stats、load、edit）不要刪改。

### 二、原有 POST 新登記／編修路由加入
在現有程式產生／解析出與儲存共用的「同一個」報名編號 `orderId` 後，**在原本真正寫入訂單之前**使用：
```js
var result = lyStockGuardSave_(payload, orderId, function () {
  return existingSaveSignup_(payload, orderId); // 請換成既有後端程式真正的函式
});
```
請勿把 `existingSaveSignup_` 範例函式名直接原樣貼上。現有 Apps Script 原始碼尚未能透過連線讀取，因此無法在此檔案內推斷現行的實際處理函式、儲存時序及訂單編號取得方式。

### 三、既有取消／修改流程
- 修改訂單沿用相同 orderId 呼叫 `lyStockGuardSave_`，會自動以差額補扣／釋回庫存。
- 取消訂單呼叫 `lyStockReleaseOrder_(orderId, existingCancelCallback)`。
- 舊測試 ID 不扣庫存；也不應在新啟用流程追溯匯入測試登記。
- 專屬贈品：head_guangcai 每一位實際芳名扣 2 盒。
- 如果原系統儲存資料與庫存流水帳在不同試算表，必須使庫存函式定位到本報名試算表；請勿把表單資料覆寫。

### 四、正確上線順序
1. 取回目前**實際部署中**的 Apps Script 原始程式，核對 `doPost` 如何產生報名編號、編修取消、錯誤處理、主表更新。
2. 在同一個 Apps Script 專案整合 `stock.gs`，測試不會與舊流程重複扣除，並部署新版本到原 /exec URL。
3. 開啟 `?action=inventory&event=lamp-116-dingwei`，驗證回傳 64／33。
4. 前端再加入/啟用即時庫存顯示、單盒與三盒組共用計算、售完停賣。
5. 逐案測試：64 單盒、21 三盒組＋1 單盒、11 香粉三包組、總燈首 2 盒、兩人同時下最後一組、重送同一訂單、修改、取消、測試登記豁免。

## 邊界
商品庫存僅追蹤「正式送出預留」；已登記尚未付款仍占庫存。超賣防護必須在 Apps Script 的資料寫入臨界區執行，純前端/Sheet 公式不能取代。
