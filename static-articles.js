import { dragonCanonConsciousnessFieldArticle } from "./article-dragon-canon-consciousness-field.js?v=20260822-paid-highlight-1&paid-private=20260824-article-system-repair-1";
import { staticArticles as baseArticles } from "./static-articles-base.js?v=20260730-safe-base-1&paid-private=20260824-article-system-repair-1";
import { ghostGateAlwaysOpenArticle } from "./article-ghost-gate-always-open.js?v=20260813-draft-1&paid-private=20260824-article-system-repair-1";
import { futurePerson2058ProphecyArticle } from "./article-2058-future-person-prophecy.js?v=20260816-toc-images-1&paid-private=20260824-article-system-repair-1";
import { quantumFrequencyWorkWishArticle } from "./article-quantum-frequency-work-wish.js?v=20260813-content-restore-2&paid-private=20260824-article-system-repair-1";
import { wealthDisciplineArticle } from "./article-wealth-discipline.js?v=20260730-wealth-discipline-6&paid-private=20260824-article-system-repair-1";
import { celebrityDreamSpiritArticle } from "./article-celebrity-dream-spirit.js?v=20260731-celebrity-dream-4&paid-private=20260824-article-system-repair-1";
import { fantasyIntuitionYuanshenArticle } from "./article-fantasy-intuition-yuanshen-display.js?v=20260801-fantasy-full-1&paid-private=20260824-article-system-repair-1";
import { wealthAsWaterArticle } from "./article-wealth-as-water.js?v=20260801-wealth-consciousness-1&paid-private=20260824-article-system-repair-1";
import { youCanNotFearDeathArticle } from "./article-you-can-not-fear-death.js?v=20260802-3&paid-private=20260824-article-system-repair-1";
import { howToJudgeTrueLingxiuUnderstandingArticle } from "./article-how-to-judge-true-lingxiu-understanding-display.js?v=20260813-fixed-reading-footer-3&paid-private=20260824-article-system-repair-1";
import { loveBeyondFilialPietyArticle } from "./article-love-beyond-filial-piety-photo.js?v=20260810-original-photo-fix-1&paid-private=20260824-article-system-repair-1";
import { yuanshenDestinyArchetypeArticle } from "./article-yuanshen-destiny-archetype.js?v=20260807-final-1&paid-private=20260824-article-system-repair-1";
import { thisBookTookThirtyYearsArticle } from "./article-this-book-took-thirty-years.js?v=20260810-complete-ending-1&paid-private=20260824-article-system-repair-1";
import { dragonChantYoutubeAwakeningArticle } from "./article-dragon-chant-youtube-awakening.js?v=20260826-paid-1&paid-private=20260824-article-system-repair-1";
import { yuanqinDebtHeartArticle } from "./article-yuanqin-debt-heart.js?v=20260828-clean-text-2&paid-private=20260824-article-system-repair-1";
import { yuanshenAwakeningOldManuscriptArticle } from "./article-yuanshen-awakening-old-manuscript.js?v=20260828-draft-1";

const featuredWealthDisciplineArticle = {
  ...wealthDisciplineArticle,
  publishedAt: "2026-07-30T23:59:00.000Z",
  updatedAt: "2026-07-30T23:59:00.000Z",
  coverImage: "assets/articles/wealth-discipline/book-cover-photo.jpg?v=20260730-book-cover-2"
};

const ghostGateAlwaysOpenEnhancedArticle = (() => {
  let content = String(ghostGateAlwaysOpenArticle.content || "");
  const waterImage = "![不要把每一場意外都交給鬼來解釋](assets/articles/ghost-gate-always-open/water-rationality.webp?v=20260813-1)";
  const practiceImage = "![修行不是拿來試鬼的](assets/articles/ghost-gate-always-open/practice-not-test.webp?v=20260813-1)";
  const puduImage = "![普渡不是交換，是敬意](assets/articles/ghost-gate-always-open/pudu-respect.webp?v=20260813-1)";

  if (!content.includes("water-rationality.webp")) {
    content = content.replace(
      "## 第二章｜不要把每一場意外,都交給鬼來解釋",
      `${waterImage}\n\n## 第二章｜不要把每一場意外,都交給鬼來解釋`
    );
  }

  if (!content.includes("practice-not-test.webp")) {
    const anchor = "我真正不建議的,是另一件事——**拿修行的工具去測靈、鬥靈、試膽,或是證明自己有什麼能耐。**";
    content = content.replace(anchor, `${anchor}\n\n${practiceImage}`);
  }

  if (!content.includes("pudu-respect.webp")) {
    const anchor = "這份心意,不只是給看不見的存在,也給我們自己。面對所有看得見與看不見的生命,保持一份敬意與慈悲,這才是普渡真正想教會我們的事,而不是一場單純的驅趕儀式。";
    content = content.replace(anchor, `${anchor}\n\n${puduImage}`);
  }

  return {
    ...ghostGateAlwaysOpenArticle,
    updatedAt: "2026-08-13T10:09:00.000Z",
    bookTitle: "請問鬼怪：穿越台日幽冥幻境，無極瑤池金母讓你看見內在恐懼與執念",
    bookAuthor: "宇色Osel",
    bookPublisher: "橡樹林",
    bookPurchaseUrl: "https://www.books.com.tw/products/0011029318",
    content
  };
})();

const categoryNames = {
  spiritual: "靈修",
  worldly: "人生",
  "spirit-world": "靈界",
  reading: "宇色書房"
};

const seriesById = {
  "this-book-took-thirty-years": "靈修辨證",
  "yuanshen-destiny-archetype": "靈修辨證",
  "love-beyond-filial-piety-and-ancestor-worship": "家族與靈魂",
  "how-to-judge-true-lingxiu-understanding": "靈修辨證",
  "reading-you-can-not-fear-death": "生命轉化",
  "fantasy-intuition-or-yuanshen": "靈修辨證",
  "yuanshen-awakening-eleven-principles": "靈修辨證",
  "lingxiu-yuanshen-reality": "靈修辨證",
  "lingxiu-zouhuo-rumo": "靈修辨證",
  "celebrity-death-dream-spirit-five-checks": "靈界辨證",
  "quantum-frequency-work-wish": "宇色書房",
  "wealth-discipline-investing-and-self-mastery": "宇色書房",
  "wealth-as-water": "財富與生命",
  "market-crash-money-self-control": "財富與生命",
  "good-fortune-believe-in-yourself-choices": "生命選擇"
};

function normalizeArticle(article) {
  return {
    ...article,
    displayCategory: article.displayCategory || categoryNames[article.category] || "文選",
    series: article.series || seriesById[article.id] || ""
  };
}

export const staticArticles = [
  dragonCanonConsciousnessFieldArticle,
  ghostGateAlwaysOpenEnhancedArticle,
  futurePerson2058ProphecyArticle,
  quantumFrequencyWorkWishArticle,
  dragonChantYoutubeAwakeningArticle,
  yuanqinDebtHeartArticle,
  yuanshenAwakeningOldManuscriptArticle,
  thisBookTookThirtyYearsArticle,
  yuanshenDestinyArchetypeArticle,
  loveBeyondFilialPietyArticle,
  howToJudgeTrueLingxiuUnderstandingArticle,
  youCanNotFearDeathArticle,
  wealthAsWaterArticle,
  fantasyIntuitionYuanshenArticle,
  celebrityDreamSpiritArticle,
  featuredWealthDisciplineArticle,
  ...baseArticles
].map(normalizeArticle);