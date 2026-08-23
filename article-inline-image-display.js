import { db } from "./firebase-config.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const SETTINGS_DOC_ID = "__article-thumbnail-settings";
const MAX_IMAGES = 6;
const SCALE_MIN = 100;
const SCALE_MAX = 250;
let settingsByArticle = new Map();

function clamp(value, fallback, min, max) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function normalize(item = {}) {
  return {
    src: String(item.src || "").trim(),
    positionX: clamp(item.positionX, 50, 0, 100),
    positionY: clamp(item.positionY, 50, 0, 100),
    scale: clamp(item.scale, 100, SCALE_MIN, SCALE_MAX)
  };
}

function absoluteUrl(value = "") {
  try { return new URL(value, location.href).href; } catch { return value; }
}

function installStyles() {
  if (document.getElementById("article-inline-image-display-styles")) return;
  const style = document.createElement("style");
  style.id = "article-inline-image-display-styles";
  style.textContent = `
    .article-body p.article-inline-image-frame{
      position:relative!important;
      width:100%!important;
      max-width:100%!important;
      aspect-ratio:16/9!important;
      height:auto!important;
      margin:30px auto!important;
      padding:0!important;
      overflow:hidden!important;
      border:1px solid var(--line)!important;
      background:#E8E1D3!important;
      line-height:0!important
    }
    .article-body p.article-inline-image-frame>img.article-inline-image-managed{
      position:absolute!important;
      inset:0!important;
      width:100%!important;
      max-width:none!important;
      height:100%!important;
      max-height:none!important;
      margin:0!important;
      padding:0!important;
      border:0!important;
      object-fit:cover!important;
      will-change:transform
    }
    @media(max-width:760px){.article-body p.article-inline-image-frame{margin:22px auto!important}}
  `;
  document.head.appendChild(style);
}

function resetManaged() {
  document.querySelectorAll(".article-inline-image-managed").forEach(image => {
    image.classList.remove("article-inline-image-managed");
    image.style.removeProperty("object-position");
    image.style.removeProperty("transform");
    image.style.removeProperty("transform-origin");
  });
  document.querySelectorAll(".article-inline-image-frame").forEach(frame => frame.classList.remove("article-inline-image-frame"));
}

function apply() {
  installStyles();
  resetManaged();
  const article = document.querySelector(".article-view[data-article-id]");
  if (!article) return;
  const id = article.dataset.articleId || "";
  const saved = settingsByArticle.get(id);
  const images = Array.isArray(saved?.images) ? saved.images.slice(0, MAX_IMAGES).map(normalize) : [];
  if (!images.length) return;

  const bySrc = new Map(images.map(item => [absoluteUrl(item.src), item]));
  article.querySelectorAll(".article-body img").forEach(image => {
    const config = bySrc.get(absoluteUrl(image.getAttribute("src") || image.src || ""));
    if (!config) return;
    const parent = image.parentElement;
    if (!parent || parent.tagName !== "P") return;
    const meaningful = [...parent.childNodes].filter(node => node !== image && String(node.textContent || "").trim());
    if (meaningful.length) return;
    const position = `${config.positionX}% ${config.positionY}%`;
    parent.classList.add("article-inline-image-frame");
    image.classList.add("article-inline-image-managed");
    image.style.setProperty("object-position", position, "important");
    image.style.setProperty("transform", `scale(${config.scale / 100})`, "important");
    image.style.setProperty("transform-origin", position, "important");
  });
}

function init() {
  installStyles();
  const root = document.getElementById("article-root") || document.body;
  new MutationObserver(() => apply()).observe(root, { childList: true, subtree: true });
  onSnapshot(doc(db, "articles", SETTINGS_DOC_ID), snapshot => {
    settingsByArticle = new Map(Object.entries(snapshot.exists() ? snapshot.data().inlineImageSettings || {} : {}));
    apply();
  }, error => {
    console.warn("文章內文圖片設定讀取失敗：", error);
    settingsByArticle = new Map();
    apply();
  });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") apply(); });
  apply();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
