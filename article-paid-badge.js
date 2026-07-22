import { db } from "./firebase-config.js";
import { staticArticles } from "./static-articles.js?v=20260722-paid-pilot-3";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const paidMarker = "<!-- paid-only -->";
const paidIds = new Set(
  staticArticles
    .filter((article) => (article.content || "").includes(paidMarker))
    .map((article) => article.id || article.slug)
    .filter(Boolean)
);

function addStyles() {
  if (document.getElementById("paid-article-badge-style")) return;
  const style = document.createElement("style");
  style.id = "paid-article-badge-style";
  style.textContent = `
    .article-card h2{display:flex;align-items:flex-start;gap:9px}
    .paid-article-badge{display:inline-flex;flex:0 0 auto;align-items:center;justify-content:center;margin-top:.18em;padding:3px 7px;border:1px solid rgba(165,130,84,.5);background:rgba(165,130,84,.14);color:#C5A26F;font-family:var(--sans);font-size:10px;font-weight:500;line-height:1.35;letter-spacing:.08em;white-space:nowrap;border-radius:999px}
    .paid-article-badge:before{content:'◇';margin-right:4px;font-size:9px}
    @media(max-width:520px){.article-card h2{gap:7px}.paid-article-badge{font-size:9px;padding:3px 6px}}
  `;
  document.head.appendChild(style);
}

function markPaidCards() {
  document.querySelectorAll('.article-card[href*="articles.html?id="]').forEach((card) => {
    const href = new URL(card.href, location.href);
    const id = href.searchParams.get("id");
    const title = card.querySelector("h2");
    if (!id || !title || !paidIds.has(id) || title.querySelector(".paid-article-badge")) return;
    const badge = document.createElement("span");
    badge.className = "paid-article-badge";
    badge.textContent = "付費";
    badge.setAttribute("aria-label", "付費文章");
    title.prepend(badge);
  });
}

async function loadPaidIds() {
  try {
    const publishedQuery = query(collection(db, "articles"), where("status", "==", "published"));
    const snapshot = await getDocs(publishedQuery);
    snapshot.docs.forEach((item) => {
      const article = { id: item.id, ...item.data() };
      if ((article.content || "").includes(paidMarker)) paidIds.add(article.id || article.slug);
    });
  } catch (error) {
    console.warn("付費文章標示暫時僅使用靜態資料。", error);
  }
  markPaidCards();
}

addStyles();
const observer = new MutationObserver(markPaidCards);
const root = document.getElementById("article-root");
if (root) observer.observe(root, { childList: true, subtree: true });
markPaidCards();
loadPaidIds();
