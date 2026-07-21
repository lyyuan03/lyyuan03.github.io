import { auth, db, provider } from "./firebase-config.js";
import { staticArticles } from "./static-articles.js";
import { onAuthStateChanged, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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
const bookUrl = "https://lyyuan.tw/books.html?v=spiritual-books-20260703-refresh";

let currentUser = null;
let authReady = false;
let loadedArticles = [];

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

function renderList(articles) {
  const filtered = activeCategory ? articles.filter((article) => article.category === activeCategory) : articles;
  if (!filtered.length) {
    root.innerHTML = '<div class="empty">目前尚無文章。</div>';
    return;
  }
  root.innerHTML = `<div class="article-grid">${filtered.map((article) => `
    <a class="article-card" href="articles.html?id=${encodeURIComponent(article.id)}">
      ${article.coverImage ? `<img src="${escapeHtml(article.coverImage)}" alt="">` : ""}
      <div class="article-meta">${categoryLabels[article.category] || "文選"}${article.content?.includes?.(memberMarker) ? "｜會員全文" : ""}</div>
      <h2>${escapeHtml(article.title || "未命名文章")}</h2>
      <p>${escapeHtml(article.excerpt || "")}</p>
    </a>
  `).join("")}</div>`;
}

function splitMemberContent(content = "") {
  if (!content.includes(memberMarker)) {
    return { publicContent: content, lockedContent: "", isLocked: false };
  }
  const [publicContent, ...rest] = content.split(memberMarker);
  return {
    publicContent: publicContent.trim(),
    lockedContent: rest.join(memberMarker).trim(),
    isLocked: true
  };
}

function renderBookCta() {
  return `
    <div class="article-book-link-wrap">
      <a class="article-book-link" href="${bookUrl}">延伸閱讀｜宇色靈修著作</a>
    </div>
  `;
}

function renderMemberGate(lockedContent = "") {
  const preview = lockedContent.trim() || "登入會員後，即可閱讀完整文章內容。";
  return `
    <section class="member-lock-zone" aria-label="訂閱看完整內容">
      <div class="article-body member-lock-preview" aria-hidden="true">${renderContent(preview)}</div>
      <div class="member-lock-card">
        <div class="member-lock-icon" aria-hidden="true">⌕</div>
        <h3>訂閱看完整內容</h3>
        <p>免費會員限閱文章</p>
        <ul>
          <li>支持會員觀看全文</li>
          <li>宇色老師靈修解析</li>
          <li>靈異政治人間社會</li>
          <li>付費暢讀全網文章</li>
        </ul>
        <button id="article-login-button" type="button">會員登入看全文</button>
      </div>
    </section>
  `;
}

function renderArticleShare(article) {
  const shareUrl = `${location.origin}${location.pathname}?id=${encodeURIComponent(article.id || article.slug || activeId)}`;
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
  return `
    <div class="article-share" aria-label="分享文章">
      <span>分享</span>
      <button class="article-share-facebook" type="button" data-share-url="${escapeHtml(shareUrl)}" data-facebook-url="${escapeHtml(facebookUrl)}" aria-label="使用 Facebook 分享" title="分享到 Facebook">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 8h3V4.4c-.5-.1-2.1-.2-4-.2-3.9 0-6.6 2.4-6.6 6.8v3.8H2v4h4.4V24h5.4v-5.2h4.5l.7-4h-5.2v-3.4C11.8 9.8 12.2 8 14 8Z" fill="currentColor"/></svg>
      </button>
      <button class="article-share-instagram" type="button" data-share-url="${escapeHtml(shareUrl)}" aria-label="開啟 Instagram，文章連結會先複製" title="分享到 Instagram">
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="17.4" cy="6.7" r="1.1" fill="currentColor"/></svg>
      </button>
      <button class="article-share-copy" type="button" data-share-url="${escapeHtml(shareUrl)}" aria-label="複製文章連結" title="複製文章連結">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 8V6a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-2M6 9h6a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3Z" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>
      </button>
      <span class="article-share-status" role="status" aria-live="polite"></span>
    </div>
  `;
}

async function copyArticleUrl(button) {
  const status = document.querySelector(".article-share-status");
  try {
    await navigator.clipboard.writeText(button.dataset.shareUrl);
    if (status) status.textContent = "已複製連結";
  } catch {
    window.prompt("請複製文章連結", button.dataset.shareUrl);
  }
}

function openAppWithFallback(appUrl, fallbackUrl) {
  let appOpened = false;
  const markOpened = () => {
    if (document.hidden) appOpened = true;
  };
  document.addEventListener("visibilitychange", markOpened, { once: true });
  location.href = appUrl;
  window.setTimeout(() => {
    document.removeEventListener("visibilitychange", markOpened);
    if (!appOpened && fallbackUrl) location.href = fallbackUrl;
  }, 1200);
}

function bindArticleShare() {
  const copyButton = document.querySelector(".article-share-copy");
  const facebookButton = document.querySelector(".article-share-facebook");
  const instagramButton = document.querySelector(".article-share-instagram");
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  copyButton?.addEventListener("click", () => copyArticleUrl(copyButton));
  facebookButton?.addEventListener("click", () => {
    if (!isMobile) {
      window.open(facebookButton.dataset.facebookUrl, "_blank", "noopener,noreferrer");
      return;
    }
    const appUrl = `fb://facewebmodal/f?href=${encodeURIComponent(facebookButton.dataset.facebookUrl)}`;
    openAppWithFallback(appUrl, facebookButton.dataset.facebookUrl);
  });
  instagramButton?.addEventListener("click", () => {
    navigator.clipboard?.writeText(instagramButton.dataset.shareUrl).catch(() => {});
    const status = document.querySelector(".article-share-status");
    if (status) status.textContent = "連結已複製，請在 Instagram 貼上";
    if (!isMobile) {
      window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
      return;
    }
    openAppWithFallback("instagram://app", "https://www.instagram.com/");
  });
}

function bindArticleLogin() {
  const button = document.getElementById("article-login-button");
  if (!button) return;
  button.addEventListener("click", async () => {
    button.disabled = true;
    button.textContent = "登入中…";
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error(error);
      alert("目前無法完成 Google 登入，請稍後再試。");
      button.disabled = false;
      button.textContent = "使用 Google 登入";
    }
  });
}

function renderArticle(article) {
  if (!article) {
    root.innerHTML = '<div class="empty">找不到這篇文章，或文章尚未發布。</div>';
    return;
  }
  document.title = `${article.title}｜靈元院文選`;
  const { publicContent, lockedContent, isLocked } = splitMemberContent(article.content || "");
  const canReadFull = !isLocked || currentUser;
  const visibleContent = canReadFull ? [publicContent, lockedContent].filter(Boolean).join("\n\n") : publicContent;
  root.innerHTML = `
    <article class="article-view">
      <div class="article-meta">${categoryLabels[article.category] || "文選"}</div>
      <h2>${escapeHtml(article.title || "未命名文章")}</h2>
      ${article.coverImage ? `<img class="article-cover" src="${escapeHtml(article.coverImage)}" alt="">` : ""}
      <div class="article-body">${renderContent(visibleContent)}</div>
      ${!canReadFull ? renderMemberGate(lockedContent) : ""}
      ${renderBookCta()}
      ${renderArticleShare(article)}
    </article>
  `;
  bindArticleLogin();
  bindArticleShare();
}

function renderCurrentView() {
  if (!authReady) return;
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

  renderCurrentView();
}

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  authReady = true;
  renderCurrentView();
});

loadArticles().catch((error) => {
  console.error(error);
  root.innerHTML = '<div class="empty">文章暫時無法載入，請稍後再試。</div>';
});
