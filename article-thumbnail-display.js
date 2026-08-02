import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const SETTINGS_DOC_ID = "__article-thumbnail-settings";
const SCALE_MIN = 100;
const SCALE_MAX = 300;
const MEDIA_BACKGROUND = "#E8E1D3";

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
  const thumbnailFit = source.thumbnailFit === "contain" ? "contain" : defaults.thumbnailFit;
  return {
    thumbnailFit,
    thumbnailPositionX: numberValue(source.thumbnailPositionX, defaults.thumbnailPositionX, 0, 100),
    thumbnailPositionY: numberValue(source.thumbnailPositionY, defaults.thumbnailPositionY, 0, 100),
    thumbnailScale: numberValue(source.thumbnailScale, defaults.thumbnailScale, SCALE_MIN, SCALE_MAX),
    thumbnailTitleAlign: source.thumbnailTitleAlign === "center" ? "center" : defaults.thumbnailTitleAlign,
    thumbnailImage: String(source.thumbnailImage || defaults.thumbnailImage || "").trim()
  };
}

let settingsByArticle = new Map();
let hasSettingsDocument = false;

async function loadSettings() {
  try {
    const snapshot = await getDoc(doc(db, "articles", SETTINGS_DOC_ID));
    hasSettingsDocument = snapshot.exists();
    const settings = hasSettingsDocument && snapshot.data().settings ? snapshot.data().settings : {};
    settingsByArticle = new Map(Object.entries(settings));
  } catch (error) {
    console.warn("文章縮圖設定暫時無法載入。", error);
    settingsByArticle = new Map();
    hasSettingsDocument = false;
  }
}

function removeSystemCard() {
  document.querySelectorAll(`.article-card[data-article-id="${SETTINGS_DOC_ID}"]`).forEach((node) => node.remove());
}

function subtractOne(node) {
  if (!node || node.dataset.thumbnailSystemAdjusted === "true") return;
  const value = Number((node.textContent || "").trim());
  if (!Number.isFinite(value) || value < 1) return;
  node.textContent = String(value - 1);
  node.dataset.thumbnailSystemAdjusted = "true";
}

function adjustSystemCounts() {
  if (!hasSettingsDocument) return;
  document.querySelectorAll(".access-filter a").forEach((link) => {
    const label = (link.textContent || "").trim();
    if (label.startsWith("全部文章") || label.startsWith("免費閱讀")) subtractOne(link.querySelector("small"));
  });

  const params = new URLSearchParams(location.search);
  const category = params.get("category") || "";
  const access = params.get("access") || "all";
  const summary = document.querySelector(".article-result-summary span");
  if (!summary || summary.dataset.thumbnailSystemAdjusted === "true" || category || !["all", "free"].includes(access)) return;
  const match = summary.textContent.match(/共\s*(\d+)\s*篇文章/);
  if (!match) return;
  summary.textContent = `共 ${Math.max(0, Number(match[1]) - 1)} 篇文章`;
  summary.dataset.thumbnailSystemAdjusted = "true";
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
  media.style.setProperty("background", MEDIA_BACKGROUND, "important");
  if (title) title.style.setProperty("text-align", settings.thumbnailTitleAlign, "important");
  card.dataset.thumbnailConfigured = "true";
}

function applyAllCards() {
  removeSystemCard();
  adjustSystemCounts();
  document.querySelectorAll(".article-card[data-article-id]").forEach(applyCard);
}

async function initialize() {
  await loadSettings();
  applyAllCards();
  const root = document.getElementById("article-root") || document.body;
  new MutationObserver(() => applyAllCards()).observe(root, { childList: true, subtree: true });
  const tabs = document.getElementById("category-tabs");
  if (tabs) new MutationObserver(() => adjustSystemCounts()).observe(tabs, { childList: true, subtree: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize, { once: true });
} else {
  initialize();
}
