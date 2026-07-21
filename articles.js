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

function renderMemberGate() {
  return `
    <div class="member-article-gate">
      <div class="member-article-gate-label">MEMBER ONLY</div>
      <h3>登入會員後，繼續閱讀完整文章</h3>
      <p>這篇文章後段內容僅開放登入會員閱讀。登入後會自動展開全文。</p>
      <button id="article-login-button" type="button">使用 Google 登入</button>
    </div>
  `;
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
      ${!canReadFull ? renderMemberGate() : ""}
    </article>
  `;
  bindArticleLogin();
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
