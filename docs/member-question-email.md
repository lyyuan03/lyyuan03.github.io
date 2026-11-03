# 會員提問通知：不升級 Firebase

會員提問與回覆保留原有 Firestore 流程。GitHub Actions 每半小時掃描最多 500 筆（保存游標，下一次接續），以 SMTP 寄出通知。不部署 Cloud Functions，不啟用 API，不更動 Firebase 帳務或會員權限。排程可能因 GitHub 負載延遲；資料多於 500 筆時，一輪掃描需多次執行。

## 擁有者啟用

1. 審查、合併此 PR（本次作業不合併）。先確認沒有另一個服務同時處理 memberQuestions 寄信；若有，先決定唯一寄信者。
2. 在 GitHub repository → Settings → Secrets and variables → Actions 新增 **SMTP_CONFIG** secret。現有 FIREBASE_SERVICE_ACCOUNT 已供其他工作流程使用；不得把私鑰或 SMTP 密碼放入版本庫。
   ```json
   {"host":"smtp.gmail.com","port":465,"secure":true,"user":"lyyuan03@gmail.com","pass":"帳號擁有者的 Google 應用程式密碼","from":"LYY靈元院行政團隊 <lyyuan03@gmail.com>"}
   ```
   應用程式密碼需要帳號啟用兩步驟驗證且帳號政策允許。也可使用擁有者已有的 SMTP 服務；不需要設定 Firebase 付款。
3. 執行 **Member Question Email (no Firebase deployment)**，先保持 `send=false`：只讀取與計數，不寫入、不寄信。確認服務帳號可讀 Firestore 與 Firebase Auth。
4. 經擁有者確認後以 `send=true` 寄出待通知資料（含先前未寄出的提問／回覆），檢查管理 Gmail 與會員收件匣。SMTP accepted 只代表郵件伺服器接受，不能保證進入收件匣。

## 寄送狀態與失敗

`_memberQuestionMail/{sha256}` 保存 sending / sent / review-required。Firestore 現有預設 deny 規則禁止客戶端讀寫；僅使用服務帳號存取，無需改 rules。固定管理員收件者；會員收件者必須與 Firebase Auth 同一 uid 的 email 相符。停權或已刪除帳號不寄送。

同一提問、同一回覆文字不重寄；修改回覆會產生新通知。成功寄送後在提問記錄寫入 adminNotifiedAt / memberNotifiedAt 與回覆雜湊，不改提問／回覆內容或任何付費權限。

SMTP 與 Firestore 不能原子提交：當寄出後寫入失敗、連線中斷或程式中止，保留 sending / review-required，不自動重寄。擁有者應先比對 Gmail 寄件備份與固定 Message-ID；確認未寄出後才刪除該 receipt 允許下一輪重試。不要刪除 sent receipt。工作流程只記錄總數，不記錄信箱、問題或回覆。

每次最多 500 筆提問讀取，48 次／日約 24,000 筆，加上通知 receipt、Auth 查詢及其他站台用量仍需留意 Spark 配額。新增提問或回覆在下一輪掃描處理；排程不是即時觸發。未設定 SMTP_CONFIG 時，寄信工作會明確失敗，不會假裝成功。

原 member-question Cloud Functions 模組保留供歷史參照，但已移出 functions/main.js 匯出，避免日後部署後與此工作重複寄送。本 PR 不變更其他 Cloud Functions 或付費存取邏輯。

## 唯讀盤點

既有 Deploy Firebase Membership Backend 新增 `mode=inventory`，只列可見專案、函式與 extension，不啟用 API、不寫 main、不部署 Pages。mode=deploy 保留原有部署行為；本修復不需執行。
