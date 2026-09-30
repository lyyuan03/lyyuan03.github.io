# 付費文章會員權限固定規格

此規格為網站付費文章的唯一權限來源。除非明確決定改變會員制度，否則不得修改判斷邏輯。

## 固定規則

1. 靈極會員：可閱讀付費文章（依下方「付費文章閱讀範圍」）。
2. 養生頻道一般會員，且 `articleAccess === true`：可閱讀付費文章（依下方「付費文章閱讀範圍」）。
3. 養生頻道一般會員，且 `articleAccess !== true`：不可閱讀付費文章。
4. 有效的「贊助付費文章會員」：可閱讀贊助專屬文章（依下方「付費文章閱讀範圍」）。
5. 贊助付費文章會員的資格必須獨立判斷，不得要求同時具有零級會員、一般會員、養生會員或任何 `memberAccess` 資格。
6. 其他狀態：預設拒絕。

## 付費文章閱讀範圍（2026-10-01 起生效）

以上各類會員（靈極會員、已開通文章權限的養生頻道會員、贊助付費文章會員）一律套用同一個閱讀範圍：

1. 只能閱讀「本期連續會員開通日前 30 天起」發表的付費文章，一直到資格到期為止。文章以第一次正式發布時間 `articles/{id}.publishedAt` 判斷。
2. 資格到期、停權或取消後，新舊付費文章一律不能閱讀。
3. 仍在有效期間內續約，不會重設起算日；資格中斷後重新加入，起算日改為重新開通當天。
4. 規則生效前（2026-10-01 00:00 臺北時間）已在期間內的舊會員，本期到期前維持可閱讀全部付費文章；續約或重新加入後套用新規則。
5. 贊助付費文章方案以天數計算：1 個月 = 30 天、3 個月 = 90 天。養生頻道方案維持原本月份計算。

資料欄位：

- 會員來源資料 `sponsorMemberAccess/{email}`、`memberAccess/{email}`：`articleWindowStartsAt` 為本期連續會員的起算日（付款或後台開通時寫入）。沒有此欄位時，`startsAt` 晚於生效日即以 `startsAt` 起算，否則視為生效前的舊會員。
- `memberEntitlements/{email}`：`sponsorArticleWindowStartsAt`、`wellnessArticleWindowStartsAt` 為可閱讀的最早發表時間（起算日減 30 天；`1970-01-01` 代表舊會員本期不受限制），並以 `articleWindowPolicy = "join-minus-30d-v1"` 標示。
- 排程重建（`.github/scripts/rebuild-member-entitlements.py`，在 GitHub Actions 執行，不依賴 Cloud Functions 版本）會把起算日寫回會員來源資料的 `articleWindowStartsAt`，並以 `articleWindowSeenExpiresAt` 記錄上次看到的到期日：新的 `startsAt` 早於該到期日視為連續續約、沿用起算日；晚於或等於則視為中斷後重新加入、重新起算。
- `memberEntitlements` 尚未寫入閱讀範圍時（舊版後端剛建立），Firestore 規則改以會員來源資料的起算日判斷。
- 同一規則實作於 `functions/article-window.js`、`functions/member-entitlements-sync.js`、`.github/scripts/rebuild-member-entitlements.py`、`member-access-resolver.js` 與 `firestore.rules`，任何一處修改都必須同步其他各處。



前台不得再由各頁面分別自行判斷會員種類。登入後一律先讀取：

`memberEntitlements/{email}`

此文件只保存最終有效權限，包括：

- `paidArticleAccess`
- `sponsorArticleAccess`
- `wellnessArticleAccess`
- `wellnessVideoAccess`
- `lingjiAccess`
- `sponsorExpiresAt`
- `wellnessExpiresAt`
- `sponsorArticleWindowStartsAt`
- `wellnessArticleWindowStartsAt`
- `articleWindowPolicy`
- `schemaVersion`
- `computedAt`

前台付費文章只呼叫 `member-access-resolver.js`，不得在文章頁重複實作另一套會員判斷。

## 贊助付費文章會員固定判斷

有效的 `sponsorMemberAccess/{email}` 必須獨立成立，不依賴任何其他會員種類。

有效狀態以以下資料為準：

- `memberType === "sponsor-member"`
- `status === "active"`
- `paymentStatus === "paid"`
- `articleAccess === true`
- `accessScope === "sponsor-paid-articles"`
- 資格尚未到期，且未停權、未撤銷

任何舊資料只要已明確屬於有效、已付款的 `sponsor-member`，系統應先正規化並重建 `memberEntitlements`，不得因缺少一般會員或養生會員資料而拒絕閱讀。

## 同步與自我修復

1. `sponsorMemberAccess` 或 `memberAccess` 變更後，後端同步器應重建對應的 `memberEntitlements`。
2. GitHub Firestore 工作流程會固定重建全部 `memberEntitlements`，用來修復遺漏、舊格式或同步失敗資料。
3. 在新資料尚未同步完成前，Firestore 可短暫使用來源會員資料作為相容性 fallback；只要 entitlement 已更新，就以 canonical entitlement 為主。
4. 既有 ISO 日期字串必須轉換或由 entitlement 重建為 Firestore Timestamp，避免前台與 Firestore 判斷不一致。
5. 不得因 entitlement 暫時缺少而把一名已確認有效的會員直接錯判成其他會員種類。

## 禁止拿來直接放行付費文章的條件

- 只有 `wellnessAccess === true`
- 只有「目前是有效養生會員」
- 曾經是會員或有歷史會員紀錄
- 年度累積消費金額
- `annualSpend >= 100000`
- 下一年度符合靈極資格，但目前尚未正式成為靈極會員

## 安全原則

- Firestore 規則為最終權限防線。
- `memberEntitlements` 為前台統一權限來源，原始會員資料為同步來源與短暫 fallback。
- 前端只能鏡射相同規則，不可自行擴大權限。
- 所有付費文章一律共用同一套 resolver，不得單篇例外。
- 贊助付費文章會員不得依賴 `memberAccess`、養生會員等級或其他會員身分才能閱讀。
- 欄位缺失、資料讀取失敗、狀態不明時，一律採預設拒絕；但已確認為有效已付款的舊版 `sponsor-member` 資料必須先正規化與重建 entitlement。
- 每次網站部署前必須執行 `scripts/lock-paid-article-access-policy.mjs`。
- 每次 Firestore 規則部署前也必須執行同一個鎖定檢查；檢查失敗即停止部署。
- 每次會員權限相關程式變更都必須通過固定會員情境測試。

此檔案與自動測試共同構成「付費文章權限防回歸鎖」。
