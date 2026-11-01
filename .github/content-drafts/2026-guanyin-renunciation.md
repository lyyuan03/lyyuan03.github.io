# 2026（丙午）年觀音出家日｜限定文章待匯入紀錄

狀態：未公開草稿／僅供匯入前核對。此檔不含完整正文或任何 Email、金鑰。

## 文章設定
- 文章 ID：`2026-guanyin-renunciation-reflections`
- 標題：拜觀音多年，為什麼人生還是有這麼多苦難？
- 副標：2026（丙午）年觀音出家日法儀專文
- 分類：`spiritual`（靈修）
- 發布狀態：`draft`
- 閱讀模式：`event`
- `eventId`：`2026-guanyin-renunciation`
- `requiredPermission`：`2026-guanyin-renunciation`
- 未授權任何信眾 Email，未設定發布日。

## 待匯入的圖片（僅列檔名；圖片尚未上傳 GitHub）
- `assets/articles/2026-guanyin-renunciation-reflections/01-cover.webp`：封面（不重複插入正文）
- `assets/articles/2026-guanyin-renunciation-reflections/02-suffering-compassion.webp`
- `assets/articles/2026-guanyin-renunciation-reflections/03-great-compassion-mantra.webp`
- `assets/articles/2026-guanyin-renunciation-reflections/04-transforming-anger.webp`
- `assets/articles/2026-guanyin-renunciation-reflections/05-guanyin-dream.webp`
- `assets/articles/2026-guanyin-renunciation-reflections/06-ceremony-compassion.webp`
- `assets/articles/2026-guanyin-renunciation-reflections/thumbnail-9x16.webp`：衍生直式縮圖

## Firebase 正確儲存位置
- `articles/{articleId}`：僅寫入公開安全 metadata，`status=draft`、`content=""`、`accessType=event`，不可含全文或備份。
- `eventArticleBodies/{articleId}`：僅於管理員授權下，將完整全文寫入 `content`，`status=draft`、`active=true`、`requiredPermission=2026-guanyin-renunciation`。
- 待活動登記 Email 名單核對後才更新 `memberEntitlements/{email}.permissions`；目前 Firestore 現行條件需要 **已驗證的 Gmail**。
- 發布前驗證未登錄、一般會員、錯誤活動權限一律拒絕；僅核准登記者放行。

## 安全約束
本倉庫為公開儲存庫，**不得**將中文全文、含正文的 JSON、圖片匯入 ZIP、個人 Email 名單、身分資料或解密金鑰加入此倉庫。正式匯入須使用管理員 Firebase 寫入管道；在完整內容安全寫入、圖片上傳、權限驗證前不得發布。此待辦紀錄尚不代表網站 Firebase 草稿建立成功。
