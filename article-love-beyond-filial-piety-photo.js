import { loveBeyondFilialPietyArticle as baseArticle } from "./article-love-beyond-filial-piety.js?v=20260806-1";

const assetVersion = "20260806-photo-2";

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
  updatedAt: "2026-08-06T06:58:00.000Z",
  coverImage: `assets/articles/love-beyond-filial-piety/cover-photo-v2.webp?v=${assetVersion}`,
  content
};
