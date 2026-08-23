import { loveBeyondFilialPietyArticle as baseArticle } from "./article-love-beyond-filial-piety.js?v=20260806-1";

// 使用同一組原始攝影內容的修復版 WebP；不更換照片主題與構圖。
// v2 檔案是為處理原 JPG 資料流破損而建立，尺寸亦由 480×270 提升為 560×315。
const assetVersion = "20260810-original-photo-fix-1";

const content = baseArticle.content
  .replace(
    "assets/articles/love-beyond-filial-piety/family-roots.svg?v=20260806-1",
    `assets/articles/love-beyond-filial-piety/from-duty-to-love-v2.webp?v=${assetVersion}`
  )
  .replace(
    "assets/articles/love-beyond-filial-piety/transforming-lineage.svg?v=20260806-1",
    `assets/articles/love-beyond-filial-piety/lineage-transformation-v2.webp?v=${assetVersion}`
  );

export const loveBeyondFilialPietyArticle = {
  ...baseArticle,
  updatedAt: "2026-08-10T08:00:00.000Z",
  coverImage: `assets/articles/love-beyond-filial-piety/cover-photo-v2.webp?v=${assetVersion}`,
  content
};
