import { staticArticles } from "./static-articles.js?v=20260824-article-system-repair-1";

const root = document.getElementById("article-root");
const params = new URLSearchParams(location.search);
const activeId = params.get("id") || "";
const activeCategory = params.get("category") || "";
const rawAccess = params.get("access") || "all";
const activeAccess = rawAccess === "free" ? "open" : (["all", "open", "paid", "event"].includes(rawAccess) ? rawAccess : "all");
const paidMarker = "<!-- paid-only -->";

const categoryLabels = {
  spiritual: "靈．修行",
  worldly: "人．俗世",
  "spirit-world": "異．靈界",
  reading: "思．讀物"
};

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

function articleKey(article) { return article?.id || article?.slug || ""; }
function articleAccess(article) {
  if (article?.accessType === "event" || article?.eventId) return "event";
  if (article?.accessType === "paid" || String(article?.content || "").includes(paidMarker)) return "paid";
  return "open";
}

const publishedArticles = staticArticles
  .filter((article) => article?.status === "published" && article?.hidden !== true && article?.systemRecord !== true)
  .sort((a, b) => Date.parse(b.publishedAt || b.updatedAt || 0) - Date.parse(a.publishedAt || a.updatedAt || 0));

function currentArticles() {
  return publishedArticles.filter((article) => {
    const categoryOk = !activeCategory || article.category === activeCategory;
    const accessOk = activeAccess === "all" || articleAccess(article) === activeAccess;
    return categoryOk && accessOk;
  });
}

function firstImage(article) { return article?.thumbnailImage || article?.coverImage || ""; }

function renderListFallback() {
  if (!root || activeId) return false;
  const articles = currentArticles();
  if (!articles.length) return false;
  const cards = articles.map((article) => {
    const id = articleKey(article);
    const access = articleAccess(article);
    const accessLabel = access === "paid" ? "贊助專屬" : access === "event" ? "活動限定" : "免費閱讀";
    const badgeClass = access === "open" ? "free" : access;
    const image = firstImage(article);
    return `<a class="article-card" data-article-id="${escapeHtml(id)}" href="articles.html?id=${encodeURIComponent(id)}">
      <div class="article-card-media">
        ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(article.title || "靈元院文選")}" loading="lazy" decoding="async">` : '<div class="article-card-placeholder" aria-hidden="true">靈元院文選</div>'}
        <div class="article-card-media-gradient" aria-hidden="true"></div>
      </div>
      <div class="article-card-content">
        <div class="article-card-heading"><div class="article-meta">${escapeHtml(categoryLabels[article.category] || "文選")}</div><span class="article-access-badge is-${badgeClass}">${accessLabel}</span></div>
        <h2 class="article-list-title">${escapeHtml(article.title || "未命名文章")}</h2>
        ${article.excerpt ? `<p class="article-hook">${escapeHtml(article.excerpt)}</p>` : ""}
      </div>
    </a>`;
  }).join("");
  root.innerHTML = `<div class="article-result-summary"><span>共 ${articles.length} 篇文章</span><a href="articles.html">重新選擇分類</a></div><div class="article-grid">${cards}</div>`;
  root.dataset.articleRescued = "true";
  return true;
}

function pageNeedsRescue() {
  if (!root || activeId) return false;
  return !root.querySelector(".article-card");
}

function rescueNow() {
  if (!pageNeedsRescue()) return false;
  return renderListFallback();
}

if (root) document.addEventListener("lyyuan:article-rendered", rescueNow);
