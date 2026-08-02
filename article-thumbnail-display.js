import { db } from "./firebase-config.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const DEFAULT_SETTINGS = {
  thumbnailFit: "cover",
  thumbnailPositionX: 50,
  thumbnailPositionY: 50,
  thumbnailScale: 100,
  thumbnailTitleAlign: "left"
};

const ARTICLE_DEFAULTS = {
  "reading-you-can-not-fear-death": {
    thumbnailFit: "cover",
    thumbnailPositionX: 50,
    thumbnailPositionY: 28,
    thumbnailScale: 218,
    thumbnailTitleAlign: "center"
  }
};

function numberValue(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeSettings(source = {}, articleId = "") {
  const defaults = { ...DEFAULT_SETTINGS, ...(ARTICLE_DEFAULTS[articleId] || {}) };
  return {
    thumbnailFit: source.thumbnailFit === "contain" ? "contain" : defaults.thumbnailFit,
    thumbnailPositionX: numberValue(source.thumbnailPositionX, defaults.thumbnailPositionX, 0, 100),
    thumbnailPositionY: numberValue(source.thumbnailPositionY, defaults.thumbnailPositionY, 0, 100),
    thumbnailScale: numberValue(source.thumbnailScale, defaults.thumbnailScale, 50, 300),
    thumbnailTitleAlign: source.thumbnailTitleAlign === "center" ? "center" : defaults.thumbnailTitleAlign
  };
}

let settingsByArticle = new Map();
let loadPromise = null;

async function loadSettings() {
  if (loadPromise) return loadPromise;
  loadPromise = getDocs(collection(db, "articles"))
    .then((snapshot) => {
      settingsByArticle = new Map(snapshot.docs.map((item) => [item.id, item.data()]));
      return settingsByArticle;
    })
    .catch((error) => {
      console.warn("文章縮圖設定暫時無法載入。", error);
      return settingsByArticle;
    });
  return loadPromise;
}

function applyCard(card) {
  const articleId = card.dataset.articleId || "";
  if (!articleId) return;
  const image = card.querySelector(".article-card-media img");
  const media = card.querySelector(".article-card-media");
  const title = card.querySelector(".article-list-title");
  if (!image || !media) return;

  const source = settingsByArticle.get(articleId) || {};
  const settings = normalizeSettings(source, articleId);
  image.style.setProperty("position", "absolute", "important");
  image.style.setProperty("inset", "0", "important");
  image.style.setProperty("width", "100%", "important");
  image.style.setProperty("max-width", "none", "important");
  image.style.setProperty("height", "100%", "important");
  image.style.setProperty("max-height", "none", "important");
  image.style.setProperty("padding", "0", "important");
  image.style.setProperty("margin", "0", "important");
  image.style.setProperty("object-fit", settings.thumbnailFit, "important");
  image.style.setProperty("object-position", `${settings.thumbnailPositionX}% ${settings.thumbnailPositionY}%`, "important");
  image.style.setProperty("transform", `scale(${settings.thumbnailScale / 100})`, "important");
  image.style.setProperty("transform-origin", "center", "important");
  image.style.setProperty("filter", "none", "important");
  media.style.setProperty("overflow", "hidden", "important");
  media.style.setProperty("background", settings.thumbnailFit === "contain" ? "#EEE9DF" : "rgba(7,17,6,.7)", "important");
  if (title) title.style.setProperty("text-align", settings.thumbnailTitleAlign, "important");
  card.dataset.thumbnailConfigured = "true";
}

function applyAllCards() {
  document.querySelectorAll(".article-card[data-article-id]").forEach(applyCard);
}

async function initialize() {
  await loadSettings();
  applyAllCards();
  const root = document.getElementById("article-root") || document.body;
  new MutationObserver(() => applyAllCards()).observe(root, { childList: true, subtree: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize, { once: true });
} else {
  initialize();
}
