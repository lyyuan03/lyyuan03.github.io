import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const SETTINGS_DOC_ID = "__article-thumbnail-settings";
const DEFAULT_SETTINGS = {
  thumbnailFit: "cover",
  thumbnailPositionX: 50,
  thumbnailPositionY: 50,
  thumbnailScale: 100,
  thumbnailTitleAlign: "left",
  thumbnailImage: ""
};

const ARTICLE_DEFAULTS = {
  "reading-you-can-not-fear-death": {
    thumbnailFit: "cover",
    thumbnailPositionX: 48,
    thumbnailPositionY: 18,
    thumbnailScale: 111,
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
    thumbnailTitleAlign: source.thumbnailTitleAlign === "center" ? "center" : defaults.thumbnailTitleAlign,
    thumbnailImage: String(source.thumbnailImage || defaults.thumbnailImage || "").trim()
  };
}

let settingsByArticle = new Map();

async function loadSettings() {
  try {
    const snapshot = await getDoc(doc(db, "articles", SETTINGS_DOC_ID));
    const settings = snapshot.exists() && snapshot.data().settings ? snapshot.data().settings : {};
    settingsByArticle = new Map(Object.entries(settings));
  } catch (error) {
    console.warn("文章縮圖設定暫時無法載入。", error);
    settingsByArticle = new Map();
  }
}

function removeSystemCard() {
  document.querySelectorAll(`.article-card[data-article-id="${SETTINGS_DOC_ID}"]`).forEach((node) => node.remove());
}

function applyCard(card) {
  const articleId = card.dataset.articleId || "";
  if (!articleId || articleId === SETTINGS_DOC_ID) return;
  const saved = settingsByArticle.get(articleId) || {};
  const hasSavedSettings = settingsByArticle.has(articleId);
  if (!hasSavedSettings && !ARTICLE_DEFAULTS[articleId]) return;

  const image = card.querySelector(".article-card-media img");
  const media = card.querySelector(".article-card-media");
  const title = card.querySelector(".article-list-title");
  if (!image || !media) return;

  const settings = normalizeSettings(saved, articleId);
  const position = `${settings.thumbnailPositionX}% ${settings.thumbnailPositionY}%`;
  if (settings.thumbnailImage && image.getAttribute("src") !== settings.thumbnailImage) {
    image.setAttribute("src", settings.thumbnailImage);
  }
  image.style.setProperty("position", "absolute", "important");
  image.style.setProperty("inset", "0", "important");
  image.style.setProperty("width", "100%", "important");
  image.style.setProperty("max-width", "none", "important");
  image.style.setProperty("height", "100%", "important");
  image.style.setProperty("max-height", "none", "important");
  image.style.setProperty("padding", "0", "important");
  image.style.setProperty("margin", "0", "important");
  image.style.setProperty("object-fit", settings.thumbnailFit, "important");
  image.style.setProperty("object-position", position, "important");
  image.style.setProperty("transform", `scale(${settings.thumbnailScale / 100})`, "important");
  image.style.setProperty("transform-origin", position, "important");
  image.style.setProperty("filter", "none", "important");
  image.style.setProperty("will-change", "transform", "important");
  media.style.setProperty("overflow", "hidden", "important");
  media.style.setProperty("background", settings.thumbnailFit === "contain" ? "#EEE9DF" : "rgba(7,17,6,.7)", "important");
  if (title) title.style.setProperty("text-align", settings.thumbnailTitleAlign, "important");
  card.dataset.thumbnailConfigured = "true";
}

function applyAllCards() {
  removeSystemCard();
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
