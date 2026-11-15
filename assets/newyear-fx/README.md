# newyear-fx — 過年氛圍動畫疊層（v1.0）

獨立的 CSS + JS，不改頁面 HTML 結構與背景圖。目前只掛在 `preview-yuandeng/`（草稿預覽），可重複使用於其他報名頁。

## 安裝（只加兩行標籤）
```html
<link rel="stylesheet" href="/assets/newyear-fx/newyear-fx.css?v=20261115-fx-1">   <!-- 放 <head> 內，其他 CSS 之後 -->
<script src="/assets/newyear-fx/newyear-fx.js?v=20261115-fx-1" defer></script>      <!-- 放 </body> 前、頁面 app.js 之後 -->
```
選用：在 `newyear-fx.js` 之前用 `window.LYYUAN_FX = {...}` 覆寫參數（不需要就不寫）。

## 配色（無紅色）
主金 `#C9A063`／淺香檳金 `#EAD8B4`／暖金 `#A58254`／底色 `#0A100C`／內文 `#F5F0E8`／輔助 `#B6B6A5`（CSS 變數 `--fx-gold/--fx-champagne/--fx-warm/--fx-ink/--fx-text/--fx-muted`，可由 `colors` 參數覆寫）。

## 參數（`window.LYYUAN_FX`）
| 參數 | 預設 | 說明 |
|---|---|---|
| `enabled` | `true` | `false`＝完全關閉 |
| `count.desktop` / `count.mobile` | 36 / 16 | 背景光點數；硬上限 桌機 60、手機 30（不可超過） |
| `speed` | 1 | 光點上升速度倍率 |
| `size` | 1 | 光點大小倍率 |
| `opacity` | 1 | 背景光點整體透明度 |
| `colors` | 見上 | 三色金與底/文字色 |
| `assetBase` / `assets` | `/assets/yuandeng/` + 8 個檔名 | 素材；檔名留空＝停用；載入前先探測，缺檔自動備援 |
| `effects` | 全開 | `ambient,title,lamp,amount,steps,success,dialog` 可個別關閉 |
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

## 素材（SVG，由設計提供，放 `/assets/yuandeng/`）
| 檔名 | 用途 |
|---|---|
| `yuandeng-title-halo.svg` | 主視覺標題後方光暈，淡入一次（缺檔：CSS 漸層光暈） |
| `yuandeng-embers-medium.svg` | 主視覺緩慢上升；**手機只用這張** |
| `yuandeng-embers-large.svg` | 僅桌機：主視覺與成功畫面背景 |
| `yuandeng-embers-small.svg` | 區塊右上角裝飾（靜態、僅桌機） |
| `yuandeng-flame-mark.svg` | 區塊標題前的小火焰（靜態，CSS 偽元素） |
| `yuandeng-lantern-unlit.svg` / `yuandeng-lantern-lit.svg` | 每個燈別選項勾選框右側，隨勾選切換（缺檔：CSS 繪製小燈籠）；不改原勾選邏輯 |
| `yuandeng-success-circle.svg` | 成功畫面圓環，只在伺服器回報成功後出現（缺檔：CSS 圓環） |
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
