import { db } from "./firebase-config.js";
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

function escapeHtml(value = "") {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function renderContent(value = "") {
  return escapeHtml(value)
    .split(/\n{2,}/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (trimmed.startsWith("### ")) return `<h3>${trimmed.slice(4)}</h3>`;
      if (trimmed.startsWith("## ")) return `<h2>${trimmed.slice(3)}</h2>`;
      if (trimmed.startsWith("# ")) return `<h1>${trimmed.slice(2)}</h1>`;
      return `<p>${trimmed.replace(/\n/g, "<br>")}</p>`;
    })
    .join("");
}

function sortPublished(a, b) {
  const at = a.publishedAt?.toMillis?.() || a.updatedAt?.toMillis?.() || 0;
  const bt = b.publishedAt?.toMillis?.() || b.updatedAt?.toMillis?.() || 0;
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
      <div class="article-meta">${categoryLabels[article.category] || "文選"}</div>
      <h2>${escapeHtml(article.title || "未命名文章")}</h2>
      <p>${escapeHtml(article.excerpt || "")}</p>
    </a>
  `).join("")}</div>`;
}

function renderArticle(article) {
  if (!article) {
    root.innerHTML = '<div class="empty">找不到這篇文章，或文章尚未發布。</div>';
    return;
  }
  document.title = `${article.title}｜靈元院文選`;
  root.innerHTML = `
    <article class="article-view">
      <div class="article-meta">${categoryLabels[article.category] || "文選"}</div>
      <h2>${escapeHtml(article.title || "未命名文章")}</h2>
      ${article.coverImage ? `<img class="article-cover" src="${escapeHtml(article.coverImage)}" alt="">` : ""}
      <div class="article-body">${renderContent(article.content || "")}</div>
    </article>
  `;
}

async function loadArticles() {
  renderTabs();
  const publishedQuery = query(collection(db, "articles"), where("status", "==", "published"));
  const snapshot = await getDocs(publishedQuery);
  const articles = snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort(sortPublished);

  if (activeId) {
    renderArticle(articles.find((article) => article.id === activeId));
  } else {
    renderList(articles);
  }
}

loadArticles().catch((error) => {
  console.error(error);
  root.innerHTML = '<div class="empty">文章暫時無法載入，請稍後再試。</div>';
});
