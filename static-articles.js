import { staticArticles as baseArticles } from "./static-articles-base.js?v=20260730-safe-base-1";
import { wealthDisciplineArticle } from "./article-wealth-discipline.js?v=20260730-wealth-discipline-3";

const featuredWealthDisciplineArticle = {
  ...wealthDisciplineArticle,
  publishedAt: "2026-07-30T23:59:00.000Z",
  updatedAt: "2026-07-30T23:59:00.000Z",
  coverImage: "assets/articles/wealth-discipline/book-cover-photo.svg?v=20260730-book-cover-1"
};

export const staticArticles = [featuredWealthDisciplineArticle, ...baseArticles];