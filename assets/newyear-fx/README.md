# newyear-fx — 過年氛圍動畫疊層（v2.0，含 3D 質感層）

獨立的 CSS + JS，不改頁面 HTML 結構與背景圖。目前只掛在 `preview-yuandeng/`（草稿預覽），可重複使用於其他報名頁。

## 安裝（只加兩行標籤）
```html
<link rel="stylesheet" href="/assets/newyear-fx/newyear-fx.css?v=20261115-fx-3">   <!-- 放 <head> 內，其他 CSS 之後 -->
<script src="/assets/newyear-fx/newyear-fx.js?v=20261115-fx-3" defer></script>      <!-- 放 </body> 前、頁面 app.js 之後 -->
```
選用：在 `newyear-fx.js` 之前用 `window.LYYUAN_FX = {...}` 覆寫參數（不需要就不寫）。

## 配色（無紅色）
主金 `#C9A063`／淺香檳金 `#EAD8B4`／暖金 `#A58254`／底色 `#0A100C`／內文 `#F5F0E8`／輔助 `#B6B6A5`（CSS 變數 `--fx-gold/--fx-champagne/--fx-warm/--fx-ink/--fx-text/--fx-muted`，可由 `colors` 參數覆寫）。

## 參數（`window.LYYUAN_FX`）
| 參數 | 預設 | 說明 |
|---|---|---|
| `enabled` | `true` | `false`＝完全關閉 |
| `count.desktop` / `count.mobile` | 36 / 12 | 背景光點數；硬上限 桌機 60、手機 30（含深度粒子與成功爆點，由 `room()` 統一控管） |
| `depth.desktop` / `depth.mobile` | `{far:8,near:4}` / `{far:2,near:1}` | 暗色區（主視覺、頁尾、成功彈窗）每區遠／近兩層粒子數；近層較快較亮、遠層較慢較淡 |
| `lift` | 3 | 勾選亮起時卡片上浮 px（0–12） |
| `haloIntensity` | 1 | 亮燈光暈強度（0–1.5） |
| `flicker` | `true` | 亮燈火光極輕微閃動（4 秒週期） |
| `parallax` | 6 | 背景祥雲／回紋視差位移 px（0＝關；建議 2–6） |
| `ctaSweep` | `true` | CTA 每 6 秒一次掃光 |
| `speed` | 1 | 光點上升速度倍率 |
| `size` | 1 | 光點大小倍率 |
| `opacity` | 1 | 背景光點整體透明度 |
| `colors` | 見上 | 三色金與底/文字色 |
| `assetBase` / `assets` | `/assets/yuandeng/` + 8 個檔名 | 素材；檔名留空＝停用；載入前先探測，缺檔自動備援 |
| `effects` | 全開 | `ambient,title,lamp,amount,steps,success,dialog,cta,parallax,card3d` 可個別關閉（`card3d:false`＝關閉卡片／標題列的 3D 質感） |
| `quietWhileTyping` | `true` | 文字欄位取得焦點時，背景光點淡出並暫停 |
| `successText` / `successMs` | 圓滿回向 / 2600 | 成功動畫文字與時長 |
| `selectors` | 見檔內 | 對應頁面元素（標題、燈別勾選、金額、步驟、結果彈窗…） |
| `steps` | `null` | 傳入 3 個函式覆寫 01/02/03 的完成判斷 |

## 關閉開關
- 全域：`window.LYYUAN_FX = { enabled: false }`
- 單次：網址加 `?fx=0`；記住關閉：`?fx=off`（存 localStorage `lyyuan.fx`）；恢復：`?fx=on`
- 執行中：`LYYUAN_FX_API.off()` / `.on()` / `.destroy()`；查看素材：`LYYUAN_FX_API.assets()`（`loaded` / `missing`）
- 使用者系統開啟「減少動態效果」（prefers-reduced-motion）：完全不啟動（不插入任何節點、不載入素材）；執行中切換也即時生效。
- 最快撤除：從頁面移除那兩行標籤即可，頁面無任何相依。

## 素材（v3 素材包，已放在 `/assets/yuandeng/`；來源說明見該資料夾 README.md）
只用三階金（#EAD8B4／#C9A063／#A58254），無紅色、無腳本。載入前先探測，缺檔自動備援。
| `assets` 鍵 | 檔案 | 用途 |
|---|---|---|
| `titleHalo` | `yuandeng-title-halo.svg` | 主視覺標題後方光暈，淡入一次 |
| `embersMedium` / `embersLarge` | `yuandeng-embers-medium/large.svg` | 主視覺緩慢上升；Large 僅桌機（含成功畫面背景）；手機只用 Medium |
| `flameMark` | `yuandeng-flame-mark.svg` | 區塊標題前小火焰（靜態） |
| `lanternUnlit` / `lanternLit` | `yuandeng-lantern-unlit/lit.svg` | 燈別選項左側，隨勾選切換 |
| `successCircle` | `yuandeng-success-circle.svg` | 成功畫面「燈＋光暈」，伺服器回報成功後才出現；文字由 HTML 負責 |
| `cardCorners` | `yuandeng-card-corners.svg` | 米色卡片四角（以 4 塊 1:1 裁切，不變形） |
| `cloudFretTile` | `yuandeng-cloud-fret-tile.svg` | 米色區祥雲／回紋視差底紋，整層 opacity .04（`tileOpacity`） |
| `beigeSpecksTile` | `yuandeng-beige-specks-tile.svg` | 米色區稀疏深金光點，視差較快（`specksOpacity`） |
| `sponsorLandscape` / `sponsorRitual` / `sponsorHardware` | `yuandeng-sponsor-*.svg` | 三項贊助圖示（依標題「景觀園藝／神像供具／硬體設備」對應） |
| `stepDivider` | `yuandeng-step-divider.svg` | 步驟標題列雙線菱形分隔 |
| `depthFar` / `depthNear` | `yuandeng-depth-far/near.svg` | 暗色區遠／近景粒子層（慢速視差；有素材時取代 CSS 備援粒子） |
未使用：`yuandeng-embers-small.svg`（深色區低密度點綴）。
所有裝飾節點皆 `aria-hidden="true"`、`pointer-events:none`。

## 觸發時機
1. 進場：金色光點緩慢上升（背景層 `z-index:-1`，在面板與所有彈窗之下）。
2. 標題淡入＋光暈，只播一次。
3. 勾選燈別 → 該燈亮起；金額更新 → 輕微光感。
4. 步驟 01/02/03 完成 → 進度點亮（01 資料齊、02 已選燈且芳名皆填、03 有金額且注意事項全勾）。
5. **送出成功**：僅在伺服器回報成功後（結果彈窗 eyebrow 變為 `SIGNUP COMPLETE` 且彈窗已開）才播放「一盞燈點亮→放大→淡出＋圓滿回向」；送出中／失敗不會觸發。亦可由頁面 `window.dispatchEvent(new CustomEvent('lyyuan:signup-success'))` 觸發。
6. 彈窗柔和淡入（opacity＋8px 位移），不搶焦點。

## 效能與無障礙
只用 transform／opacity（標題與金額為一次性短暫 filter／text-shadow）；分頁隱藏時暫停；表單填寫時背景淡出。

## v2：3D 質感層（`html.fx-3d`）
1. 卡片（`.panel .lamp .summary`）雙層陰影：近 `0 2px 4px` 暖金 15%、遠 `0 12px 28px` 深色 12%；頂 1px 內高光、底 1px 內暗線。
2. 勾選＝亮起（`.lamp.fx-lit`）：上浮 `lift`、邊框 `#C9A063`、暖金內漸層、燈籠換亮版、光暈層淡入、火光層 4 秒極輕閃動；取消後平順回復。
3. 步驟標題列（`.sectionline`）：深色底、頂部高光線、底部陰影、雕刻金細線＋菱形分隔。
4. CTA／確認送出：`#EAD8B4→#C9A063→#A58254` 金屬漸層、內高光、6 秒一次掃光、按下下沉 2px。
5. 底部金額列：浮起陰影；金額更新時數字微升＋一次高光。
6. 背景視差：祥雲／回紋底紋，位移 ≤ `parallax` px，rAF 節流。
7. 暗色區遠近兩層粒子（近快遠慢）。
8. 成功（僅伺服器回報成功後）：燈由小放大、光暈擴散、「圓滿回向」HTML 文字淡入。
所有裝飾皆 `aria-hidden`、`pointer-events:none`；`prefers-reduced-motion` 開啟時整個疊層不啟動。

## 頁面層修正（不屬於特效，不受主開關影響，在 `preview-yuandeng/yuandeng.css` + `app.js`）
- 右側浮動「限定選物」按鈕：桌機捲動時縮成貼邊半圓，停止捲動 900ms 後展開；滑過／聚焦即展開。
- 頂部固定列（導覽＋會員登入）改為不透明底 `#faf6ee`（移除半透明與 backdrop-filter）。
