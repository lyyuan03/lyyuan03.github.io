# 報名頁犯太歲生肖卡片 CI

卡片 CSS、renderZodiacCards 的靜態圖片對應與 style.css、app.js 引用快取版本更新為 `20261111-ink-hd-1`。既有文字、esc() 轉義、config 結構與 stats 成功後隱藏卡片／顯示 #zodiacBars 的行為不變。

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
| 羊／牛優先標籤 | #4A2A08 | #FFD97A → #F4B942（不透明） | 9.50768 / 7.29759 | 7.30:1 |

各漸層 RGB 通道均單調增減，因此端點涵蓋其內文背景最差亮度；inset 高光及暗邊只在邊緣，不覆蓋文字。所有文字皆超過一般文字 AA 4.5:1。

## 立體與動態

多層接觸陰影、柔影、品牌光暈，搭配 inset 高光與暗邊、145 度漸層。羊牛採 2px 邊框、5px 頂緣、更強光暈及暖金／琥珀漸層標籤（深褐字、#9B681E 邊框、細緻 inset 高光與棕色柔影，在金底仍有區隔）；龍狗採較輕陰影。

卡片以 transform 上下浮動 2px、週期 9 秒，延遲為 0 / -2.25 / -4.5 / -6.75 秒。hover 僅在 `(hover:hover) and (pointer:fine)` 生效；hover／focus-within 透過 transform 個別屬性 translate、rotate 再抬升 3px、傾斜 -0.4 度。不引入計時器、observer、JS 動畫或 shimmer。卡片目前無可聚焦內容，focus-within 規則預留給未來既有內容包含互動元素時使用，不新增 tab stop。

reduced-motion 關閉 animation、transition、互動位移及旋轉，保留靜態抬升與陰影。外層維持桌機雙欄、手機單欄；有圖片的卡片內採 grid，文字與圖片分欄，間距 14px／手機 10px。圖片寬 112px／手機 88px，不覆蓋文字；卡片外不套用新樣式。

## 本機驗證（2026-11-11）

- Chrome `/usr/bin/google-chrome`、puppeteer-core；本機靜態伺服器 :4173。阻擋外部請求以驗證 config／stats 不可達時的預設四張卡，無提交資料。
- 1280px：雙欄；390px：單欄。頁面無水平溢出，各卡 scrollWidth 未超過 clientWidth，截圖檢查無截字。
- 一般與 hover 截圖：`/workspace/signup-zodiac-ci/v4/codex-shots/zodiac-{1280,390}{,-hover}.png`。手機不啟用 hover 效果。
- 兩種尺寸 reduced-motion：四張卡 computed animation-name 均為 none，transition-duration 均為 0s。
- deploy.yml validate：全站 JS syntax、paid access policy lock、paid runtime audit、production stability audit、male-yoga-admin 8 項測試全部通過。
- deploy.yml candidate-smoke：Playwright 1.55.0 Chromium runtime；文章 5-load、admin gate、歷史 restricted body recovery 全部通過。測試依賴安裝於 /tmp，未納入提交。

## 動物圖片來源與處理

圖片以海報水墨風 AI 生成，羊、牛、龍、狗均無任何文字，背景為柔和沙色的不透明正方形。將使用者提供的 /workspace/signup-zodiac-ci/v4/assets/ 內 taisui-ink-{goat,ox,dragon,dog}.webp、@2x.webp、@3x.webp 共 12 檔逐位元複製到公開 assets，未改圖。已確認舊圓形圖無其他引用並刪除 8 檔。

`renderZodiacCards()` 的靜態 Map 只對應羊／牛／龍／狗，src、1x/2x/3x srcset 使用固定新路徑，不拼接 config。其他生肖完全不輸出 img。所有 config 文字繼續 esc()；alt、loading="lazy"、decoding="async" 維持。四圖 width/height 均為 128；1x 為 128×128，2x 為 256×256，3x 為 384×384。

CSS 顯示尺寸統一為桌機 112×112、≤480px 手機 88×88，aspect-ratio:1、object-fit:cover、border-radius:50%。標準與 WebKit mask-image 都使用 `radial-gradient(circle closest-side,#000 50%,rgba(0,0,0,.55) 76%,transparent 100%)`，mask-size 為 100% 100% 且不重複，讓邊緣平滑融入四種卡色。移除圖片 drop-shadow，避免奶油色光圈與貼紙感。保留 translateZ(6px) 與卡片既有 CSS 浮動；reduced-motion 下卡片與圖片 animation-name 均為 none。

補充驗證：四張已知生肖 naturalWidth 均為 128；兩個尺寸的圖片顯示尺寸一致，文字區與圖片區無重疊，頁面無水平溢出。實際檢視四種卡色的一般／hover 截圖，邊緣平滑漸隱，龍卡深底仍可辨識沙色中心，但外緣平順淡出，無硬圓盤邊界，保留指定 50%／76% 遮罩。13 個新圖片（含高解析海報）與使用者原檔逐位元相同。


## 海報高解析燈箱

image-03-hd.webp 為使用者提供的 Real-ESRGAN x4plus 3x 放大版本（3165×4473），內容未改，逐位元複製。一般顯示與雲端 images.zodiac.src 仍使用 assets/image-03.webp。只在點擊 .poster-open 時，以 URL pathname 檔名對照改用同目錄 image-03-hd.webp，保留 origin、路徑與 query；其他海報及「原尺寸閱讀」邏輯維持。初次載入不請求高解析檔。

本次燈箱驗證：1280／390 初次網路請求均無 image-03-hd.webp；點開生肖海報後 #imageLarge naturalWidth 為 3165，原尺寸閱讀切換正常；image-02 燈箱仍使用原檔。13 個新檔均與來源逐位元一致。
