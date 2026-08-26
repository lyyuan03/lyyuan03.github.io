# 付費文章會員權限固定規格

此規格為網站付費文章的唯一權限來源。除非明確決定改變會員制度，否則不得修改判斷邏輯。

## 固定規則

1. 靈極會員：可閱讀全部付費文章。
2. 養生頻道一般會員，且 `articleAccess === true`：可閱讀全部付費文章。
3. 養生頻道一般會員，且 `articleAccess !== true`：不可閱讀付費文章。
4. 有效的「贊助付費文章會員」：可閱讀全部贊助專屬文章。
5. 贊助付費文章會員的資格必須獨立判斷，不得要求同時具有零級會員、一般會員、養生會員或任何 `memberAccess` 資格。
6. 其他狀態：預設拒絕。

## 唯一前台權限來源

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
