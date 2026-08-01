import { staticArticles as baseArticles } from "./static-articles-base.js?v=20260730-safe-base-1";
import { wealthDisciplineArticle } from "./article-wealth-discipline.js?v=20260730-wealth-discipline-6";
import { celebrityDreamSpiritArticle } from "./article-celebrity-dream-spirit.js?v=20260731-celebrity-dream-4";
import { fantasyIntuitionYuanshenArticle } from "./article-fantasy-intuition-yuanshen-display.js?v=20260801-fantasy-modern-2";
import { wealthAsWaterArticle } from "./article-wealth-as-water.js?v=20260801-body-image-1";

const featuredWealthDisciplineArticle = {
  ...wealthDisciplineArticle,
  publishedAt: "2026-07-30T23:59:00.000Z",
  updatedAt: "2026-07-30T23:59:00.000Z",
  coverImage: "assets/articles/wealth-discipline/book-cover-photo.jpg?v=20260730-book-cover-2"
};

export const staticArticles = [wealthAsWaterArticle, fantasyIntuitionYuanshenArticle, celebrityDreamSpiritArticle, featuredWealthDisciplineArticle, ...baseArticles];
