// 首頁「接續你的閱讀」：依讀者在這台裝置上的閱讀紀錄推薦文章。
// 第一次來訪、或沒有紀錄的讀者看不到這一區，首頁維持原樣。

import { readHistory, clearHistory } from "./reading-history.js?v=20261116-reader-1";
import { recommendForReader, articleGuides } from "./article-reading-resources.js?v=20261116-reader-1";
import { resolveArticleThumbnailUrl } from "./article-thumbnail-url.js?v=20260918-photo-3";

const categoryLabels = {
  spiritual: "靈・修行",
  worldly: "人・俗世",
  human: "人・俗世",
  "spirit-world": "異・靈界",
  reading: "思・讀物"
};

const escapeHtml = (value = "") => String(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

const articleKey = (article = {}) => article.id || article.slug || "";

function thumbnailFor(article = {}) {
  const markdownImage = String(article.content || "").match(/!\[[^\]]*\]\(([^)\s]+)\)/)?.[1] || "";
  const raw = article.thumbnailImage || article.coverImage || markdownImage;
  try {
    return resolveArticleThumbnailUrl(article, raw) || raw;
  } catch {
    return raw;
  }
}

function isPaid(article = {}) {
  return article.accessType === "paid" || String(article.content || "").includes("<!-- paid-only -->");
}

function shortTitle(title = "", length = 14) {
  const text = String(title || "");
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

function card({ article, reason, action }, index) {
  const image = thumbnailFor(article);
  const label = `${categoryLabels[article.category] || "文選"}${isPaid(article) ? "・贊助專屬" : ""}`;
  return `
    <a class="featured-card is-visible reader-card" data-reveal-delay="${index}" href="articles.html?id=${encodeURIComponent(articleKey(article))}">
      ${image ? `<img src="${escapeHtml(image)}" alt="" loading="lazy">` : ""}
      <div class="featured-copy">
        <small class="reader-reason">${escapeHtml(reason)}</small>
        <h3>${escapeHtml(article.title || "未命名文章")}</h3>
        <p>${escapeHtml(article.excerpt || "")}</p>
        <span>${escapeHtml(label)}　${escapeHtml(action)} →</span>
      </div>
    </a>`;
}

export function renderReaderRecommendations(articles = []) {
  const section = document.getElementById("reader-reading");
  const grid = document.getElementById("reader-reading-grid");
  if (!section || !grid) return;

  const history = readHistory();
  if (!history.length) return;

  const topicsOf = (article) => (Array.isArray(article.topics) && article.topics.length
    ? article.topics
    : articleGuides[articleKey(article)]?.topics || []);
  const result = recommendForReader(history, articles, { topicsOf });
  if (!result) return;

  const cards = [];
  if (result.continueReading) {
    const percent = Math.round((result.continueReading.depth || 0) * 100);
    cards.push({
      article: result.continueReading.article,
      reason: percent >= 10 ? `上次讀到 ${percent}%` : "上次打開還沒讀完",
      action: "繼續閱讀"
    });
  }
  result.picks.forEach((pick) => {
    cards.push({
      article: pick.article,
      reason: pick.because ? `延續〈${shortTitle(pick.because.title)}〉` : "延續你讀過的主題",
      action: "開始閱讀"
    });
  });
  if (result.otherAngle) {
    cards.push({ article: result.otherAngle.article, reason: "換個角度", action: "開始閱讀" });
  }
  if (!cards.length) return;

  grid.innerHTML = cards.slice(0, 3).map(card).join("");
  section.hidden = false;

  document.getElementById("reader-reading-clear")?.addEventListener("click", () => {
    clearHistory();
    section.hidden = true;
    grid.innerHTML = "";
  });
}
