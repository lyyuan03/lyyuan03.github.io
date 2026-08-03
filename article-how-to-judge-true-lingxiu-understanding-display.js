import { howToJudgeTrueLingxiuUnderstandingArticle as baseArticle } from "./article-how-to-judge-true-lingxiu-understanding.js?v=20260803-full-1";

const ARTICLE_ID = "how-to-judge-true-lingxiu-understanding";
const RELATED_ID = "fantasy-intuition-or-yuanshen";
const PREVIEW_END = "這兩件事，決定了一個人只是接觸過靈修，還是真正走進了修行。";
const OLD_IMAGE = "assets/articles/how-to-judge-true-lingxiu-understanding/mind-expansion.jpg?v=20260803-1";
const DISCERNMENT_IMAGE = "assets/articles/how-to-judge-true-lingxiu-understanding/discernment.webp?v=20260803-1";
const REALITY_IMAGE = "assets/articles/how-to-judge-true-lingxiu-understanding/reality-test.webp?v=20260803-1";

function prepareContent(content = "") {
  let next = content
    .replace(/\n*<!-- paid-only -->\n*/g, "\n\n")
    .replace(OLD_IMAGE, DISCERNMENT_IMAGE);

  if (!next.includes(`![真正的覺醒，最後仍要回到現實生活接受檢驗](${REALITY_IMAGE})`)) {
    next = next.replace(
      "\n\n## 元神出竅真正打開的，是心智結構",
      `\n\n![真正的覺醒，最後仍要回到現實生活接受檢驗](${REALITY_IMAGE})\n\n## 元神出竅真正打開的，是心智結構`
    );
  }

  if (next.includes(PREVIEW_END)) {
    next = next.replace(PREVIEW_END, `${PREVIEW_END}\n\n<!-- paid-only -->`);
  } else {
    next = `<!-- paid-only -->\n\n${next}`;
  }
  return next;
}

export const howToJudgeTrueLingxiuUnderstandingArticle = {
  ...baseArticle,
  category: "spiritual",
  accessType: "paid",
  publishedAt: "2026-08-03T01:38:00.000Z",
  updatedAt: "2026-08-03T01:38:00.000Z",
  coverImage: "assets/articles/how-to-judge-true-lingxiu-understanding/cover.jpg?v=20260803-1",
  sharePath: "articles.html?id=how-to-judge-true-lingxiu-understanding",
  excerpt: "真正的理解，不只是能說出答案；而是當人生把熟悉的答案拿走之後，那份理解仍然能在生命裡運作。",
  topics: ["元神覺醒", "修行辨識", "生命驗證"],
  readingLevel: "深度",
  displayCategory: "靈修",
  series: "靈修辨證",
  bookTitle: "靈修人關鍵報告",
  bookAuthor: "宇色 Osel",
  bookPublisher: "柿子文化",
  bookPurchaseUrl: "https://www.books.com.tw/products/0010784866?loc=P_0005_087",
  content: prepareContent(baseArticle.content || "")
};

function installRelatedReading() {
  if (typeof document === "undefined" || !document.getElementById("article-root")) return;

  const inject = () => {
    const view = document.querySelector(`.article-view[data-article-id="${ARTICLE_ID}"]`);
    if (!view || view.querySelector(`[data-related-reading="${ARTICLE_ID}"]`)) return;

    const aside = document.createElement("aside");
    aside.className = "next-reading";
    aside.dataset.relatedReading = ARTICLE_ID;
    aside.setAttribute("aria-label", "下一篇延伸閱讀");
    aside.innerHTML = `
      <div class="next-reading-eyebrow">沿著這個主題繼續閱讀</div>
      <a href="articles.html?id=${RELATED_ID}">
        <strong>那是幻想、直覺，還是元神在說話？</strong>
        <span>直覺辨識・元神與識神</span>
      </a>
    `;

    const anchor = view.querySelector(".recommended-book, .article-book-link-wrap, .article-share");
    view.insertBefore(aside, anchor || null);
  };

  const start = () => {
    inject();
    const observer = new MutationObserver(inject);
    observer.observe(document.body, { childList: true, subtree: true });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
}

installRelatedReading();
