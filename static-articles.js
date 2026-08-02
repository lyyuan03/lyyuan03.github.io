import { staticArticles as baseArticles } from "./static-articles-base.js?v=20260730-safe-base-1";
import { wealthDisciplineArticle } from "./article-wealth-discipline.js?v=20260730-wealth-discipline-6";
import { celebrityDreamSpiritArticle } from "./article-celebrity-dream-spirit.js?v=20260731-celebrity-dream-4";
import { fantasyIntuitionYuanshenArticle } from "./article-fantasy-intuition-yuanshen-display.js?v=20260801-fantasy-full-1";
import { wealthAsWaterArticle } from "./article-wealth-as-water.js?v=20260801-wealth-consciousness-1";
import { guanyinVowLampRecordArticle } from "./article-2026-guanyin-vow-lamp-record.js?v=20260801-event-1";
import { youCanNotFearDeathArticle } from "./article-you-can-not-fear-death.js?v=20260802-1";

const featuredWealthDisciplineArticle = {
  ...wealthDisciplineArticle,
  publishedAt: "2026-07-30T23:59:00.000Z",
  updatedAt: "2026-07-30T23:59:00.000Z",
  coverImage: "assets/articles/wealth-discipline/book-cover-photo.jpg?v=20260730-book-cover-2"
};

const categoryNames = {
  spiritual: "靈修",
  worldly: "人生",
  "spirit-world": "靈界",
  reading: "宇色書房"
};

const seriesById = {
  "reading-you-can-not-fear-death": "生命轉化",
  "fantasy-intuition-or-yuanshen": "靈修辨證",
  "yuanshen-awakening-eleven-principles": "靈修辨證",
  "lingxiu-yuanshen-reality": "靈修辨證",
  "lingxiu-zouhuo-rumo": "靈修辨證",
  "2026-guanyin-vow-lamp-record": "觀音修行",
  "celebrity-death-dream-spirit-five-checks": "靈界辨證",
  "wealth-discipline-investing-and-self-mastery": "宇色書房",
  "wealth-as-water": "財富與生命",
  "market-crash-money-self-control": "財富與生命",
  "good-fortune-believe-in-yourself-choices": "生命選擇"
};

function normalizeArticle(article) {
  const isEvent = article.accessType === "event" || article.id === "2026-guanyin-vow-lamp-record";
  return {
    ...article,
    displayCategory: article.displayCategory || (isEvent ? "法會紀實" : categoryNames[article.category] || "文選"),
    series: article.series || seriesById[article.id] || ""
  };
}

export const staticArticles = [
  youCanNotFearDeathArticle,
  guanyinVowLampRecordArticle,
  wealthAsWaterArticle,
  fantasyIntuitionYuanshenArticle,
  celebrityDreamSpiritArticle,
  featuredWealthDisciplineArticle,
  ...baseArticles
].map(normalizeArticle);
