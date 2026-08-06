import { loveBeyondFilialPietyArticle as baseArticle } from "./article-love-beyond-filial-piety.js?v=20260806-1";

const content = baseArticle.content
  .replace(
    "assets/articles/love-beyond-filial-piety/family-roots.svg?v=20260806-1",
    "assets/articles/love-beyond-filial-piety/from-duty-to-love.jpg?v=20260806-photo-1"
  )
  .replace(
    "assets/articles/love-beyond-filial-piety/transforming-lineage.svg?v=20260806-1",
    "assets/articles/love-beyond-filial-piety/lineage-transformation.jpg?v=20260806-photo-1"
  );

export const loveBeyondFilialPietyArticle = {
  ...baseArticle,
  updatedAt: "2026-08-06T05:15:00.000Z",
  coverImage: "assets/articles/love-beyond-filial-piety/cover-photo.jpg?v=20260806-photo-1",
  content
};
