# 靈元院 115 年圓燈報名頁・v3 氛圍素材包

## 色彩規範
- 高光 `#EAD8B4`、主體 `#C9A063`、陰影 `#A58254`
- 底色 `#0A100C`、米白 `#F5F0E8`
- 未使用紅色；無額外琥珀色（遵守本次「只用三階金」的規格）。
- SVG 保持透明背景，絕不覆寫原頁背景圖片。實際底色由原網頁控制。

## 放置原則
**米色表單區**：使用深金線條／點綴，優先 `card-corners`、`cloud-fret-tile`、`beige-specks-tile`、三枚贊助圖示；不放淺金光暈。
**深色首屏、頁尾、成功彈窗**：可使用 `title-halo`、`embers`、`depth-far`、`depth-near`、`step-divider` 與成功燈。
圖示分成 aura、body、flame、highlight 圖層（無此元素時該圖層為空），用 `id` 可針對單層作動畫。
燈籠本體已加上上緣 1px 高光與下緣 1px 陰影，應保留原始 `viewBox` 比例。

## 所有 SVG（17 個）

| 檔案 | 建議位置 |
|---|---|
| `yuandeng-embers-small.svg` | 深色區：首屏局部點綴，低密度 |
| `yuandeng-embers-medium.svg` | 深色區：標題周圍與段落過場 |
| `yuandeng-embers-large.svg` | 深色區：首屏或成功彈窗的較豐富粒子 |
| `yuandeng-flame-mark.svg` | 卡片小圖示／標題，米色底宜深金 |
| `yuandeng-lantern-unlit.svg` | 燈別未選取狀態，建議固定尺寸 |
| `yuandeng-lantern-lit.svg` | 燈別已選取狀態；可個別動畫火焰或光暈 |
| `yuandeng-success-circle.svg` | 深色成功彈窗：純燈與光暈；HTML 負責「圓滿迴向」 |
| `yuandeng-title-halo.svg` | 深色首屏主標題正後方，勿用在米色表單 |
| `yuandeng-card-corners.svg` | 米色表單卡片四角整組；可作覆蓋層 |
| `yuandeng-cloud-fret-tile.svg` | 米色表單區：祥雲／回紋無縫重複，建議整層 opacity: .04 |
| `yuandeng-sponsor-landscape.svg` | 米色贊助項目「景觀園藝」蓮花 |
| `yuandeng-sponsor-ritual.svg` | 米色贊助項目「神像供具」寶珠 |
| `yuandeng-sponsor-hardware.svg` | 米色贊助項目「硬體設備」回紋基石 |
| `yuandeng-step-divider.svg` | 深色區：步驟標題雙線雕刻式菱形分隔 |
| `yuandeng-beige-specks-tile.svg` | 米色表單區：稀疏深金細光點，可無縫重複 |
| `yuandeng-depth-far.svg` | 深色首屏／頁尾：遠景小而清晰，可慢速視差 |
| `yuandeng-depth-near.svg` | 深色首屏／頁尾：近景大而柔焦，可慢速視差 |

## 使用與注意
- `success-circle.svg` 無文字；請在 HTML 另放文字，例如 `<h2 class="yd-success-title">圓滿迴向</h2>`；只在伺服端確認報名成功後顯示。
- 透明 tile 重複請使用 CSS `background-repeat: repeat`，`cloud-fret-tile` 用獨立透明層的 `opacity: .04`，避免讓卡片文字一起變淡。
- 光點視差建議只動畫 CSS `transform`；移動幅度小，並依 `prefers-reduced-motion` 停用動畫。附 `yuandeng-v3-usage.css` 作為獨立參考。
- SVG 的 `<g id="檔名前綴-layer-名稱">`、gradient ID 均有獨立命名。內嵌同一 SVG 多次於同一份 HTML 時，仍應為每個實例再加唯一前綴，或以外部 `<img>` 引入，以免重複 ID。
- 不更動網頁、背景、表單欄位、送出流程或 GitHub；本交付僅素材檔。
