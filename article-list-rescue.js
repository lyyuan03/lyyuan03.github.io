import { staticArticles } from "./static-articles.js?v=20260824-article-system-repair-1";

const root = document.getElementById("article-root");
const params = new URLSearchParams(location.search);
const activeId = params.get("id") || "";
const activeCategory = params.get("category") || "";
const rawAccess = params.get("access") || "all";
const activeAccess = rawAccess === "free" ? "open" : (["all", "open", "paid", "event"].includes(rawAccess) ? rawAccess : "all");
const paidMarker = "<!-- paid-only -->";
const memberMarker = "<!-- member-only -->";

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

function renderInline(value = "") {
  return escapeHtml(value).replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1">');
}
function renderContent(value = "") {
  return String(value || "").split(/\n{2,}/).map((block) => {
    const text = block.trim();
    if (!text) return "";
    if (text.startsWith("### ")) return `<h3>${renderInline(text.slice(4))}</h3>`;
    if (text.startsWith("## ")) return `<h2>${renderInline(text.slice(3))}</h2>`;
    if (text.startsWith("# ")) return `<h1>${renderInline(text.slice(2))}</h1>`;
    if (/^!\[[^\]]*\]\([^)]+\)$/.test(text)) return `<figure>${renderInline(text)}</figure>`;
    return `<p>${renderInline(text).replace(/\n/g, "<br>")}</p>`;
  }).join("");
}

function renderDetailFallback() {
  if (!root || !activeId) return false;
  const article = publishedArticles.find((item) => articleKey(item) === activeId || item.slug === activeId);
  if (!article) return false;
  const access = articleAccess(article);
  const rawContent = String(article.content || "");
  const marker = access === "paid" ? paidMarker : memberMarker;
  const publicContent = rawContent.includes(marker) ? rawContent.split(marker)[0] : rawContent;
  const gate = access === "paid" ? '<section class="article-paid-gate"><strong>贊助專屬文章</strong><p>此篇為贊助專屬內容，請使用具有閱讀資格的 Gmail 登入。</p><button class="article-paid-login" type="button">會員登入</button></section>' : "";
  const eventGate = access === "event" ? '<section class="article-paid-gate"><strong>活動限定文章</strong><p>請使用具有這篇文章閱讀資格的 Email 登入。</p><button class="article-paid-login" type="button">會員登入</button></section>' : "";
  const safeContent = access === "event" ? String(article.excerpt || "") : publicContent;
  root.innerHTML = `<article class="article-view" data-article-id="${escapeHtml(articleKey(article))}"><a class="article-back" href="articles.html">← 返回全部文選</a><div class="article-meta">${escapeHtml(categoryLabels[article.category] || "文選")}</div><h2>${escapeHtml(article.title || "未命名文章")}</h2>${article.coverImage ? `<img class="article-cover" src="${escapeHtml(article.coverImage)}" alt="">` : ""}<div class="article-body">${renderContent(safeContent)}</div>${gate}${eventGate}</article>`;
  root.querySelector(".article-paid-login")?.addEventListener("click", () => document.getElementById("member-login-button")?.click());
  document.title = `${article.title}｜靈元院文選`;
  root.dataset.articleRescued = "true";
  return true;
}

function pageNeedsRescue() {
  if (!root) return false;
  if (activeId) return !root.querySelector(".article-view");
  return !root.querySelector(".article-card");
}

function rescueNow() {
  if (!pageNeedsRescue()) return false;
  return activeId ? renderDetailFallback() : renderListFallback();
}

if (root) {
  rescueNow();
  [120, 350, 800, 1500, 3000, 6000].forEach((delay) => window.setTimeout(rescueNow, delay));
  const observer = new MutationObserver(() => {
    window.clearTimeout(window.__lyyuanArticleRescueTimer);
    window.__lyyuanArticleRescueTimer = window.setTimeout(rescueNow, 30);
  });
  observer.observe(root, { childList: true, subtree: true });
  window.setInterval(() => {
    if (document.visibilityState === "visible") rescueNow();
  }, 2000);
}
