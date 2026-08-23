import { thisBookTookThirtyYearsArticle as baseArticle } from "./article-this-book-took-thirty-years.js?v=20260810-2";

const assetVersion = "20260810-photoreal-1";

const content = String(baseArticle.content || "")
  .replace(
    /assets\/articles\/this-book-took-thirty-years\/inline-1\.svg(?:\?[^)\s"']*)?/g,
    `assets/articles/fantasy-intuition-yuanshen/mirror-desire-voice.webp?v=${assetVersion}`
  )
  .replace(
    /assets\/articles\/this-book-took-thirty-years\/inline-2\.svg(?:\?[^)\s"']*)?/g,
    `assets/articles/fantasy-intuition-yuanshen/awakening-reality-test.webp?v=${assetVersion}`
  );

export const thisBookTookThirtyYearsArticle = {
  ...baseArticle,
  updatedAt: "2026-08-10T12:40:00.000Z",
  coverImage: `assets/articles/fantasy-intuition-yuanshen/cover.webp?v=${assetVersion}`,
  content
};
