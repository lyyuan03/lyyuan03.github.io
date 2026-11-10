# 報名頁犯太歲生肖卡片 CI

僅修改卡片 CSS 與 style.css、app.js 引用快取版本 `20261110-zodiac-ci-1`。文字、escape、config、grid 與 stats 成功後隱藏卡片的行為均沿用既有程式。

## 品牌色與對應

| 卡片 | 色名 | CI hex | 實際出處 | 漸層終點 |
| --- | --- | --- | --- | --- |
| 羊（值太歲） | 鎏金 | #C9A063 | preview-vokdayja/style.css 的 :root --gold | #EAD8B4（同檔 --pale） |
| 牛（正沖） | 朱紅 | #A33B2B | preview-vokdayja/style.css 既有 .error 文字色與 var(--shu,#a33b2b) fallback | #873024（朱紅加深） |
| 龍（偏沖） | 森林綠 | #0F1A14 | index.html 的 meta theme-color | #172218（首頁既有色） |
| 狗（偏沖） | 苔橄欖 | #606330 | index.html 既有 CSS 色值、報名頁既有背景色 | #505329（苔橄欖加深） |

以 nth-child(1–4) 對應既有模板順序，不加 JS hook。首頁 --gold 為 #A58254；報名頁亦有 #81571f。以上金棕、森林與朱紅系統構成此次色盤來源。未從 logo 猜測不存在的色碼。

## 對比實算

採 WCAG sRGB 相對亮度：通道正規化後，s ≤ 0.04045 時取 s/12.92，其餘取 ((s+0.055)/1.055)^2.4；L = 0.2126R + 0.7152G + 0.0722B；比值為 (L亮+0.05)/(L暗+0.05)。

| 文字用途 | 前景 | 背景兩端 | 兩端對比 | 最低值 |
| --- | --- | --- | --- | --- |
| 羊標題／內文 | #1A1208 | #C9A063 → #EAD8B4 | 7.67 / 13.21 | 7.67:1 |
| 牛標題／內文 | #F5F0E8 | #A33B2B → #873024 | 5.75 / 7.47 | 5.75:1 |
| 龍標題／內文 | #F5F0E8 | #0F1A14 → #172218 | 15.71 / 14.48 | 14.48:1 |
| 狗標題／內文 | #F5F0E8 | #606330 → #505329 | 5.57 / 7.09 | 5.57:1 |
| 羊／牛優先標籤 | #F5F0E8 | #1A1208（不透明） | 16.33 | 16.33:1 |

各漸層 RGB 通道均單調增減，因此端點涵蓋其內文背景最差亮度；inset 高光及暗邊只在邊緣，不覆蓋文字。所有文字皆超過一般文字 AA 4.5:1。

## 立體與動態

多層接觸陰影、柔影、品牌光暈，搭配 inset 高光與暗邊、145 度漸層。羊牛採 2px 邊框、5px 頂緣、更強光暈及黑底金框標籤；龍狗採較輕陰影。

卡片以 transform 上下浮動 2px、週期 9 秒，延遲為 0 / -2.25 / -4.5 / -6.75 秒。hover 僅在 `(hover:hover) and (pointer:fine)` 生效；hover／focus-within 透過 transform 個別屬性 translate、rotate 再抬升 3px、傾斜 -0.4 度。不引入計時器、observer、JS 動畫或 shimmer。卡片目前無可聚焦內容，focus-within 規則預留給未來既有內容包含互動元素時使用，不新增 tab stop。

reduced-motion 關閉 animation、transition、互動位移及旋轉，保留靜態抬升與陰影。未改 grid、卡片外不套用任何新樣式。

## 本機驗證（2026-11-10）

- Chrome `/usr/bin/google-chrome`、puppeteer-core；本機靜態伺服器 :4173。阻擋外部請求以驗證 config／stats 不可達時的預設四張卡，無提交資料。
- 1280px：雙欄；390px：單欄。頁面無水平溢出，各卡 scrollWidth 未超過 clientWidth，截圖檢查無截字。
- 一般與 hover 截圖：`/workspace/signup-zodiac-ci/codex-shots/zodiac-{1280,390}{,-hover}.png`。手機不啟用 hover 效果。
- 兩種尺寸 reduced-motion：四張卡 computed animation-name 均為 none，transition-duration 均為 0s。
- deploy.yml validate：全站 JS syntax、paid access policy lock、paid runtime audit、production stability audit、male-yoga-admin 8 項測試全部通過。
- deploy.yml candidate-smoke：Playwright 1.55.0 Chromium runtime；文章 5-load、admin gate、歷史 restricted body recovery 全部通過。測試依賴安裝於 /tmp，未納入提交。
