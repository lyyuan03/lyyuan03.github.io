import { loveBeyondFilialPietyArticle as baseArticle } from "./article-love-beyond-filial-piety.js?v=20260806-1";

// Reverted photo replacements: the JPG files were low-resolution (480px) and two had broken JPEG data streams.
// Restoring original SVG assets which are resolution-independent and designed for the content.
export const loveBeyondFilialPietyArticle = {
  ...baseArticle,
  updatedAt: "2026-08-10T03:20:00.000Z",
  coverImage: "assets/articles/love-beyond-filial-piety/cover.svg?v=20260806-1",
  content: baseArticle.content
};
