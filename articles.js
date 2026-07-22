import { db } from "./firebase-config.js";
import { staticArticles } from "./static-articles.js?v=20260722-paid-pilot-3";
import { collection, doc, getDocs, query, runTransaction, serverTimestamp, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const categoryLabels = {
  spiritual: "靈．修行",
  worldly: "人．俗世",
  "spirit-world": "異．靈界",
  reading: "思．讀物"
};

const root = document.getElementById("article-root");
const tabs = document.getElementById("category-tabs");
const params = new URLSearchParams(location.search);
const activeCategory = params.get("category") || "";
const activeId = params.get("id") || "";
const memberMarker = "<!-- member-only -->";
const paidMarker = "<!-- paid-only -->";
const bookUrl = "https://lyyuan.tw/books.html?v=spiritual-books-20260703-refresh";

let loadedArticles = [];
let articleMetrics = new Map();

function escapeHtml(value = "") {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function renderInline(value = "") {
  return escapeHtml(value).replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1">');
}

function renderContent(value = "") {
  return value
    .replace(memberMarker, "")
    .replace(paidMarker, "")
    .split(/\n{2,}/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (trimmed.startsWith("### ")) return `<h3>${renderInline(trimmed.slice(4))}</h3>`;
      if (trimmed.startsWith("## ")) return `<h2>${renderInline(trimmed.slice(3))}</h2>`;
      if (trimmed.startsWith("# ")) return `<h1>${renderInline(trimmed.slice(2))}</h1>`;
      return `<p>${renderInline(trimmed).replace(/\n/g, "<br>")}</p>`;
    })
    .join("");
}

function getTimeValue(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value === "number") return value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function sortPublished(a, b) {
  const at = getTimeValue(a.publishedAt) || getTimeValue(a.updatedAt);
  const bt = getTimeValue(b.publishedAt) || getTimeValue(b.updatedAt);
  return bt - at;
}

function renderTabs() {
  const items = [["", "全部"], ...Object.entries(categoryLabels)];
  tabs.innerHTML = items.map(([key, label]) => {
    const href = key ? `articles.html?category=${encodeURIComponent(key)}` : "articles.html";
    return `<a class="${key === activeCategory ? "is-active" : ""}" href="${href}">${label}</a>`;
  }).join("");
}

function metricValue(articleId, key) {
  return Number(articleMetrics.get(articleId)?.[key] || 0);
}

function renderMetricSummary(articleId, compact = false) {
  const views = metricValue(articleId, "views");
  const shares = metricValue(articleId, "shares");
  const copies = metricValue(articleId, "copies");
  return `
    <div class="article-engagement${compact ? " is-compact" : ""}" data-metric-article="${escapeHtml(articleId)}">
      <span>閱讀 <b data-metric-value="views">${views.toLocaleString("zh-TW")}</b></span>
      <span>分享 <b data-metric-value="shares">${shares.toLocaleString("zh-TW")}</b></span>
      <span>複製 <b data-metric-value="copies">${copies.toLocaleString("zh-TW")}</b></span>
    </div>
  `;
}

function updateMetricSummary(articleId) {
  document.querySelectorAll(`[data-metric-article="${CSS.escape(articleId)}"]`).forEach((node) => {
    ["views", "shares", "copies"].forEach((key) => {
      const target = node.querySelector(`[data-metric-value="${key}"]`);
      if (target) target.textContent = metricValue(articleId, key).toLocaleString("zh-TW");
    });
  });
}

async function loadArticleMetrics() {
  try {
    const snapshot = await getDocs(collection(db, "articleMetrics"));
    articleMetrics = new Map(snapshot.docs.map((item) => [item.id, item.data()]));
  } catch (error) {
    console.warn("文章統計暫時無法載入。", error);
    articleMetrics = new Map();
  }
}

async function incrementArticleMetric(articleId, metric) {
  if (!articleId || !["views", "shares", "copies"].includes(metric)) return;
  const metricRef = doc(db, "articleMetrics", articleId);
  try {
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(metricRef);
      const current = snapshot.exists() ? snapshot.data() : {};
      transaction.set(metricRef, {
        articleId,
        views: Number(current.views || 0) + (metric === "views" ? 1 : 0),
        shares: Number(current.shares || 0) + (metric === "shares" ? 1 : 0),
        copies: Number(current.copies || 0) + (metric === "copies" ? 1 : 0),
        updatedAt: serverTimestamp()
      });
    });
    const current = articleMetrics.get(articleId) || {};
    articleMetrics.set(articleId, {
      ...current,
      articleId,
      [metric]: Number(current[metric] || 0) + 1
    });
    updateMetricSummary(articleId);
  } catch (error) {
    console.warn(`文章${metric}統計寫入失敗。`, error);
  }
}

function trackArticleView(articleId) {
  const key = `lyyuan-article-viewed:${articleId}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch {}
  incrementArticleMetric(articleId, "views");
}

function renderList(articles) {
  const filtered = activeCategory ? articles.filter((article) => article.category === activeCategory) : articles;
  if (!filtered.length) {
    root.innerHTML = '<div class="empty">目前尚無文章。</div>';
    return;
  }
  root.innerHTML = `<div class="article-grid">${filtered.map((article) => `
    <a class="article-card" href="articles.html?id=${encodeURIComponent(article.id)}">
      ${article.coverImage ? `<img src="${escapeHtml(article.coverImage)}" alt="">` : ""}
      <div class="article-meta">${categoryLabels[article.category] || "文選"}</div>
      <h2>${escapeHtml(article.title || "未命名文章")}</h2>
      ${renderMetricSummary(article.id || article.slug || activeId)}
      <p>${escapeHtml(article.excerpt || "")}</p>
    </a>
  `).join("")}</div>`;
}

function splitMemberContent(content = "") {
  const accessType = content.includes(paidMarker)
    ? "paid"
    : content.includes(memberMarker)
      ? "member"
      : "open";
  if (accessType === "open") {
    return { publicContent: content, lockedContent: "", accessType };
  }
  const marker = accessType === "paid" ? paidMarker : memberMarker;
  const [publicContent, ...rest] = content.split(marker);
  return {
    publicContent: publicContent.trim(),
    lockedContent: rest.join(marker).trim(),
    accessType
  };
}

function renderBookCta() {
  return `
    <div class="article-book-link-wrap">
      <a class="article-book-link" href="${bookUrl}">延伸閱讀｜宇色靈修著作</a>
    </div>
  `;
}

function renderSupportGate(lockedContent = "") {
  const preview = lockedContent.trim() || "更多宇色老師的靈修解析與生命觀察。";
  return `
    <section class="member-lock-zone" id="article-support-gate" aria-label="支持宇色老師">
      <div class="article-body member-lock-preview" aria-hidden="true">${renderContent(preview)}</div>
      <div class="member-lock-card article-support-card">
        <div class="member-lock-icon" aria-hidden="true">◇</div>
        <h3>文章未完，繼續閱讀</h3>
        <p>若這篇文章對你有所啟發，歡迎訂閱<br><span>YouTube、追蹤 Facebook，持續收到新的靈修解析。</span></p>
        <div class="article-support-actions">
          <a class="article-support-link youtube" href="https://www.youtube.com/@lyyuan03" target="_blank" rel="noopener noreferrer">訂閱 靈元院YouTube</a>
          <a class="article-support-link facebook" href="https://www.facebook.com/share/18zfvhPkBF/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer">追蹤 靈元院 Facebook</a>
        </div>
        <button id="article-continue-button" type="button">繼續閱讀全文</button>
        <div class="article-author-links" aria-label="宇色老師社群">
          <span>更多宇色老師</span>
          <a href="https://www.youtube.com/KINKIOSEL" target="_blank" rel="noopener noreferrer">影音</a>
          <i aria-hidden="true">·</i>
          <a href="https://www.facebook.com/authorosel/" target="_blank" rel="noopener noreferrer">文章</a>
        </div>
      </div>
    </section>
  `;
}

function renderPaidGate(article) {
  const subject = encodeURIComponent(`詢問付費閱讀｜${article.title || "靈元院文選"}`);
  const body = encodeURIComponent(`您好，我想詢問〈${article.title || "這篇文章"}〉的付費閱讀方式。`);
  return `
    <section class="member-lock-zone paid-lock-zone" aria-label="付費會員限定">
      <div class="paid-lock-preview" aria-hidden="true">
        <span></span><span></span><span></span><span></span><span></span><span></span>
      </div>
      <div class="member-lock-card paid-lock-card">
        <div class="member-lock-icon" aria-hidden="true">◇</div>
        <h3>本文為付費會員限定</h3>
        <p>本篇目前僅開放前段試閱。若希望閱讀全文，歡迎聯繫靈元院，了解付費會員開放方式。</p>
        <div class="paid-inquiry-actions">
          <a class="paid-inquiry-primary" href="https://t.me/lyyuan" target="_blank" rel="noopener noreferrer">詢問付費閱讀方式</a>
          <a class="paid-inquiry-secondary" href="mailto:lyyuan03@gmail.com?subject=${subject}&body=${body}">使用 Email 詢問</a>
        </div>
        <small>完整內容不會在本頁直接展開</small>
      </div>
    </section>
  `;
}

function bindArticleContinue() {
  const button = document.getElementById("article-continue-button");
  const gate = document.getElementById("article-support-gate");
  const remaining = document.getElementById("article-remaining-content");
  if (!button || !gate || !remaining) return;
  button.addEventListener("click", () => {
    gate.remove();
    remaining.hidden = false;
    remaining.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function renderArticleShare(article) {
  const articleKey = article.id || article.slug || activeId;
  const shareUrl = article.sharePath
    ? new URL(article.sharePath, `${location.origin}/`).href
    : `${location.origin}${location.pathname}?id=${encodeURIComponent(articleKey)}`;
  const shareTitle = article.title || "靈元院文選";
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(shareTitle);
  return `
    <div class="article-share" aria-label="靈元院社群平台">
      <a class="article-social-facebook" data-share-metric="true" href="https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}" target="_blank" rel="noopener noreferrer" aria-label="分享到 Facebook" title="分享到 Facebook">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 8h3V4.4c-.5-.1-2.1-.2-4-.2-3.9 0-6.6 2.4-6.6 6.8v3.8H2v4h4.4V24h5.4v-5.2h4.5l.7-4h-5.2v-3.4C11.8 9.8 12.2 8 14 8Z" fill="currentColor"/></svg>
      </a>
      <a class="article-social-instagram" href="https://www.instagram.com/lyyuan03/" target="_blank" rel="noopener noreferrer" aria-label="前往靈元院 Instagram" title="靈元院 Instagram">
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="17.4" cy="6.7" r="1.1" fill="currentColor"/></svg>
      </a>
      <a class="article-share-line" data-share-metric="true" href="https://social-plugins.line.me/lineit/share?url=${encodedUrl}&text=${encodedTitle}" target="_blank" rel="noopener noreferrer" aria-label="分享到 LINE" title="分享到 LINE">
        <span class="article-line-mark" aria-hidden="true">LINE</span>
      </a>
      <a class="article-share-telegram" data-share-metric="true" href="https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}" target="_blank" rel="noopener noreferrer" aria-label="分享到 Telegram" title="分享到 Telegram">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.5 3.3 18.4 20c-.2 1.2-.9 1.5-1.9.9l-4.7-3.5-2.3 2.2c-.2.3-.5.5-1 .5l.4-4.8 8.7-7.9c.4-.3-.1-.5-.6-.2L6.2 14 1.6 12.5c-1-.3-1-1 .2-1.5L20 4c.8-.3 1.6.2 1.5 1.3Z" fill="currentColor"/></svg>
      </a>
      <a class="article-share-email" data-share-metric="true" href="mailto:?subject=${encodedTitle}&body=${encodeURIComponent(`${shareTitle}\n\n${shareUrl}`)}" aria-label="使用 Email 分享" title="使用 Email 分享">
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.8" y="5.2" width="18.4" height="13.6" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m4 7 8 6 8-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </a>
      <button class="article-share-copy" type="button" data-share-url="${escapeHtml(shareUrl)}" aria-label="複製文章連結" title="複製文章連結">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 8V6a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-2M6 9h6a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3Z" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>
      </button>
      <span class="article-share-status" role="status" aria-live="polite"></span>
    </div>
  `;
}

async function copyArticleUrl(button, articleId) {
  const status = document.querySelector(".article-share-status");
  try {
    await navigator.clipboard.writeText(button.dataset.shareUrl);
    if (status) status.textContent = "已複製連結";
    incrementArticleMetric(articleId, "copies");
  } catch {
    window.prompt("請複製文章連結", button.dataset.shareUrl);
  }
}

function bindArticleShare(articleId) {
  const copyButton = document.querySelector(".article-share-copy");
  copyButton?.addEventListener("click", () => copyArticleUrl(copyButton, articleId));
  document.querySelectorAll("[data-share-metric]").forEach((link) => {
    link.addEventListener("click", () => incrementArticleMetric(articleId, "shares"));
  });
}

function renderArticle(article) {
  if (!article) {
    root.innerHTML = '<div class="empty">找不到這篇文章，或文章尚未發布。</div>';
    return;
  }
  document.title = `${article.title}｜靈元院文選`;
  const { publicContent, lockedContent, accessType } = splitMemberContent(article.content || "");
  root.innerHTML = `
    <article class="article-view">
      <div class="article-meta">${categoryLabels[article.category] || "文選"}</div>
      <h2>${escapeHtml(article.title || "未命名文章")}</h2>
      ${article.coverImage ? `<img class="article-cover" src="${escapeHtml(article.coverImage)}" alt="">` : ""}
      <div class="article-body">${renderContent(publicContent)}</div>
      ${accessType === "member" ? renderSupportGate(lockedContent) : ""}
      ${accessType === "paid" ? renderPaidGate(article) : ""}
      ${accessType === "member" ? `<div class="article-body" id="article-remaining-content" hidden>${renderContent(lockedContent)}</div>` : ""}
      ${renderBookCta()}
      ${renderArticleShare(article)}
    </article>
  `;
  if (accessType === "member") bindArticleContinue();
  const articleKey = article.id || article.slug || activeId;
  bindArticleShare(articleKey);
  trackArticleView(articleKey);
}

function renderCurrentView() {
  if (activeId) {
    renderArticle(loadedArticles.find((article) => article.id === activeId || article.slug === activeId));
  } else {
    renderList(loadedArticles);
  }
}

async function loadArticles() {
  renderTabs();
  let articles = [];
  try {
    const publishedQuery = query(collection(db, "articles"), where("status", "==", "published"));
    const snapshot = await getDocs(publishedQuery);
    articles = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .sort(sortPublished);
  } catch (error) {
    console.warn("Firebase 文章暫時無法載入，改顯示靜態文章。", error);
  }
  const merged = [...staticArticles, ...articles].reduce((items, article) => {
    if (!items.some((item) => item.id === article.id)) items.push(article);
    return items;
  }, []);
  loadedArticles = merged.sort(sortPublished);
  await loadArticleMetrics();

  renderCurrentView();
}

loadArticles().catch((error) => {
  console.error(error);
  root.innerHTML = '<div class="empty">文章暫時無法載入，請稍後再試。</div>';
});
