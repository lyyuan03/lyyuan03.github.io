import { db } from "./firebase-config.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { staticArticles } from "./static-articles.js?v=20260828-yuanqin-six-images-1";

const SETTINGS_DOC_ID = "__article-thumbnail-settings";
const MEDIA_BACKGROUND = "#E8E1D3";
const BRAND_VERSION = "20260823-photo-title-2";

const BRAND_FALLBACKS = {
  spiritual: `assets/articles/thumbnails/brand-system-20260823/spiritual.svg?v=${BRAND_VERSION}`,
  "spirit-world": `assets/articles/thumbnails/brand-system-20260823/spirit-world.svg?v=${BRAND_VERSION}`,
  worldly: `assets/articles/thumbnails/brand-system-20260823/worldly.svg?v=${BRAND_VERSION}`,
  reading: `assets/articles/thumbnails/brand-system-20260823/reading.svg?v=${BRAND_VERSION}`
};

// 某些舊文章的正文圖片由顯示修正模組動態補入，原始 Markdown 內沒有圖片路徑。
// 這裡記錄「真正的第一張內文故事圖」，避免誤退回統一 CI 圖。
const FORCED_THUMBNAIL_IMAGES = {
  "yuanqin-debt-heart": "assets/articles/yuanqin-debt-heart/01-cover-yuanqin.webp?v=20260828-4"
};

const FIRST_IMAGE_OVERRIDES = {
  "love-beyond-filial-piety-and-ancestor-worship": "assets/articles/love-beyond-filial-piety/from-duty-to-love-v2.webp?v=20260810-original-photo-fix-1"
};

// 這兩篇使用原始照片時，裁掉照片本身已燒入的舊文字，並恢復全站統一的縮圖版型。
const CLEAN_CROP_OVERRIDES = {
  "yuanqin-debt-heart": { scale: 2.0, origin: "82% 50%" },
  "ghost-gate-always-open": { scale: 1.9, origin: "90% 50%" }
};

const CATEGORY_LABELS = {
  spiritual: "靈・修行",
  "spirit-world": "異・靈界",
  worldly: "人・俗世",
  reading: "思・讀物"
};

const articlesById = new Map();
staticArticles.forEach((article) => {
  const id = article?.id || article?.slug;
  if (id) articlesById.set(id, article);
  if (article?.slug) articlesById.set(article.slug, article);
});

let hasSettingsDocument = false;
let thumbnailSettings = new Map();
let applyScheduled = false;

function ensureStyle() {
  if (document.getElementById("article-photo-thumbnail-style-20260823")) return;
  document.getElementById("article-brand-thumbnail-style-20260823")?.remove();
  const style = document.createElement("style");
  style.id = "article-photo-thumbnail-style-20260823";
  style.textContent = `
    .article-card-media[data-photo-thumbnail="true"]{position:relative!important;overflow:hidden!important;background:${MEDIA_BACKGROUND}!important}
    .article-card-media[data-photo-thumbnail="true"]>img{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;object-fit:var(--article-thumbnail-fit,cover)!important;object-position:var(--article-thumbnail-position,50% 50%)!important;transform:scale(var(--article-thumbnail-scale,1))!important;transform-origin:var(--article-thumbnail-origin,50% 50%)!important;filter:none!important;margin:0!important;padding:0!important;z-index:0}
    .article-card-media[data-photo-thumbnail="true"]:after{content:"";position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(180deg,rgba(5,12,6,.16) 0%,rgba(5,12,6,.04) 34%,rgba(5,12,6,.20) 62%,rgba(5,12,6,.72) 100%)}
    .article-card-media[data-photo-thumbnail="true"] .article-card-media-gradient{display:none!important}
    .article-photo-thumb-overlay{position:absolute;inset:0;z-index:2;display:flex;flex-direction:column;justify-content:space-between;padding:6.5% 7%;pointer-events:none;color:#F6F1E8;text-align:left}
    .article-photo-thumb-top{display:flex;align-items:center;justify-content:space-between;gap:12px}
    .article-photo-thumb-brand{font-family:"Source Han Serif TC","Noto Serif TC","Songti TC",serif;font-size:clamp(11px,1vw,15px);letter-spacing:.18em;text-shadow:0 1px 8px rgba(0,0,0,.55);white-space:nowrap}
    .article-photo-thumb-category{font-family:"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif;font-size:clamp(9px,.78vw,11px);letter-spacing:.1em;padding:3px 7px;border:1px solid rgba(246,241,232,.48);border-radius:999px;background:rgba(7,18,7,.22);backdrop-filter:blur(3px);white-space:nowrap}
    .article-photo-thumb-title{max-width:82%;font-family:"Source Han Serif TC","Noto Serif TC","Songti TC",serif;font-weight:600;line-height:1.32;letter-spacing:.02em;text-shadow:0 2px 12px rgba(0,0,0,.78);display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;text-wrap:balance}
    .article-photo-thumb-title.len-short{font-size:clamp(22px,2.55vw,34px)}
    .article-photo-thumb-title.len-medium{font-size:clamp(20px,2.25vw,31px)}
    .article-photo-thumb-title.len-long{font-size:clamp(18px,2vw,27px)}
    @media(max-width:760px){.article-photo-thumb-overlay{padding:6% 6.5%}.article-photo-thumb-title{max-width:88%}.article-photo-thumb-title.len-short{font-size:clamp(21px,7vw,30px)}.article-photo-thumb-title.len-medium{font-size:clamp(19px,6.3vw,27px)}.article-photo-thumb-title.len-long{font-size:clamp(17px,5.7vw,24px)}}
  `;
  document.head.appendChild(style);
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
  if (!summary || summary.dataset.thumbnailSystemAdjusted === "true" || category || !["all", "free", "open"].includes(access)) return;
  const match = summary.textContent.match(/共\s*(\d+)\s*篇文章/);
  if (!match) return;
  summary.textContent = `共 ${Math.max(0, Number(match[1]) - 1)} 篇文章`;
  summary.dataset.thumbnailSystemAdjusted = "true";
}

function categoryKeyForCard(card, article) {
  if (article?.category && BRAND_FALLBACKS[article.category]) return article.category;
  const meta = (card.querySelector(".article-meta")?.textContent || "").trim();
  if (meta.includes("異") || meta.includes("靈界")) return "spirit-world";
  if (meta.includes("人") || meta.includes("俗世")) return "worldly";
  if (meta.includes("思") || meta.includes("讀物")) return "reading";
  return "spiritual";
}

function normalizeImageUrl(value = "") {
  return String(value || "").trim().replace(/^<|>$/g, "");
}

function firstInlineImage(article) {
  const content = String(article?.content || "");
  const markdown = /!\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g;
  let match;
  while ((match = markdown.exec(content))) {
    const src = normalizeImageUrl(match[1]);
    if (src && !src.startsWith("data:") && !src.startsWith("blob:")) return src;
  }
  const html = content.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i);
  if (html?.[1]) return normalizeImageUrl(html[1]);
  return "";
}

function compactTitle(article, fallbackTitle = "") {
  const preferred = String(article?.thumbnailTitle || article?.shortTitle || article?.cardTitle || "").trim();
  if (preferred) return preferred;

  const title = String(article?.title || fallbackTitle || "靈元院文選").replace(/\s+/g, " ").trim();
  const book = title.match(/《([^》]{1,14})》/);
  const quoted = title.match(/「([^」]{2,12})」/);
  if (book && title.includes("？")) {
    if (quoted) return `《${book[1]}》真的有${quoted[1]}？`;
    return `《${book[1]}》真的如此神奇？`;
  }

  const year = title.match(/(?:19|20)\d{2}/)?.[0];
  if (year && /預言/.test(title) && title.includes("？")) return `${year}預言真的準嗎？`;

  const question = title.split("？")[0].trim();
  if (title.includes("？")) {
    const parts = question.split(/[，,：:｜|—–]/).map((item) => item.trim()).filter(Boolean);
    const candidate = [...parts].reverse().find((item) => [...item].length >= 6 && [...item].length <= 18);
    if (candidate) return `${candidate.replace(/竟能/g, "真的能")}？`;
    if ([...question].length <= 18) return `${question}？`;
  }

  const parts = title.split(/[，,。！？：:｜|—–]/).map((item) => item.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const combined = `${parts[0]}，${parts[1]}`;
    if ([...combined].length <= 18) return combined;
  }
  const useful = parts.find((item) => [...item].length >= 6 && [...item].length <= 18);
  if (useful) return useful;

  const chars = [...title];
  return chars.length > 18 ? `${chars.slice(0, 18).join("")}…` : title;
}

function ensureImage(media, titleText) {
  let image = media.querySelector("img");
  if (!image) {
    media.querySelector(".article-card-placeholder")?.remove();
    image = document.createElement("img");
    image.alt = titleText || "靈元院文選";
    image.loading = "lazy";
    image.decoding = "async";
    media.prepend(image);
  }
  return image;
}

function titleLengthClass(text) {
  const length = [...String(text || "")].length;
  if (length <= 10) return "len-short";
  if (length <= 16) return "len-medium";
  return "len-long";
}

function ensureOverlay(media, titleText, categoryLabel) {
  media.querySelector(".article-brand-thumb-overlay")?.remove();
  let overlay = media.querySelector(".article-photo-thumb-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "article-photo-thumb-overlay";
    overlay.innerHTML = `<div class="article-photo-thumb-top"><div class="article-photo-thumb-brand">靈元院</div><div class="article-photo-thumb-category"></div></div><div class="article-photo-thumb-title"></div>`;
    media.appendChild(overlay);
  }
  const titleNode = overlay.querySelector(".article-photo-thumb-title");
  if (titleNode.textContent !== titleText) titleNode.textContent = titleText;
  titleNode.classList.remove("len-short", "len-medium", "len-long");
  titleNode.classList.add(titleLengthClass(titleText));
  const categoryNode = overlay.querySelector(".article-photo-thumb-category");
  if (categoryNode.textContent !== categoryLabel) categoryNode.textContent = categoryLabel;
}

function applyCard(card) {
  const articleId = card.dataset.articleId || "";
  if (!articleId || articleId === SETTINGS_DOC_ID) return;
  const media = card.querySelector(".article-card-media");
  if (!media) return;

  const fullTitle = (card.querySelector(".article-list-title")?.textContent || "靈元院文選").trim();
  const article = articlesById.get(articleId) || null;
  const categoryKey = categoryKeyForCard(card, article);
  const image = ensureImage(media, fullTitle);

  // 保留核心列表原本渲染出的照片，作為第三順位備用；避免一抓不到正文圖就變成統一 CI。
  const originalSource = media.dataset.originalArticleImage || normalizeImageUrl(image.getAttribute("src") || "");
  if (!media.dataset.originalArticleImage && originalSource && !originalSource.includes("brand-system-20260823")) {
    media.dataset.originalArticleImage = originalSource;
  }

  const configured = thumbnailSettings.get(articleId) || null;
  const configuredImage = normalizeImageUrl(configured?.thumbnailImage || "");
  const forcedImage = FORCED_THUMBNAIL_IMAGES[articleId] || "";
  const overrideImage = FIRST_IMAGE_OVERRIDES[articleId] || "";
  const preservedOriginal = media.dataset.originalArticleImage || "";
  const failedSources = new Set((media.dataset.failedThumbnailSources || "").split("\\n").filter(Boolean));
  const sourceCandidates = [forcedImage, configuredImage, preservedOriginal, overrideImage, article?.coverImage || "", firstInlineImage(article), BRAND_FALLBACKS[categoryKey], BRAND_FALLBACKS.spiritual]
    .map(normalizeImageUrl).filter((value, index, values) => value && values.indexOf(value) === index);
  const source = sourceCandidates.find((value) => !failedSources.has(value)) || BRAND_FALLBACKS[categoryKey] || BRAND_FALLBACKS.spiritual;
  const shortTitle = compactTitle(article, fullTitle);
  const cleanCrop = CLEAN_CROP_OVERRIDES[articleId] || null;
  const fit = cleanCrop ? "cover" : configured?.thumbnailFit === "contain" ? "contain" : "cover";
  const x = Number.isFinite(Number(configured?.thumbnailPositionX)) ? Math.min(100, Math.max(0, Number(configured.thumbnailPositionX))) : 50;
  const y = Number.isFinite(Number(configured?.thumbnailPositionY)) ? Math.min(100, Math.max(0, Number(configured.thumbnailPositionY))) : 50;
  const scale = cleanCrop?.scale || (Number.isFinite(Number(configured?.thumbnailScale)) ? Math.min(300, Math.max(100, Number(configured.thumbnailScale))) / 100 : 1);
  media.style.setProperty("--article-thumbnail-fit", fit);
  media.style.setProperty("--article-thumbnail-position", `${x}% ${y}%`);
  media.style.setProperty("--article-thumbnail-scale", String(scale));
  media.style.setProperty("--article-thumbnail-origin", cleanCrop?.origin || "50% 50%");

  image.onerror = () => {
    const failed = normalizeImageUrl(image.getAttribute("src") || "");
    const failedSet = new Set((media.dataset.failedThumbnailSources || "").split("\\n").filter(Boolean));
    if (failed) failedSet.add(failed);
    media.dataset.failedThumbnailSources = [...failedSet].join("\\n");
    const fallback = sourceCandidates.find((value) => !failedSet.has(value)) || BRAND_FALLBACKS[categoryKey] || BRAND_FALLBACKS.spiritual;
    if (normalizeImageUrl(image.getAttribute("src") || "") !== fallback) image.setAttribute("src", fallback);
  };
  if (image.getAttribute("src") !== source) image.setAttribute("src", source);
  image.alt = fullTitle;
  media.dataset.photoThumbnail = "true";
  delete media.dataset.brandThumbnail;
  delete media.dataset.brandSpecial;

  delete media.dataset.textFreeThumbnail;
  ensureOverlay(media, shortTitle, CATEGORY_LABELS[categoryKey] || "文選");
  const titleNode = media.querySelector(".article-photo-thumb-title");
  if (titleNode) titleNode.style.textAlign = configured?.thumbnailTitleAlign === "center" ? "center" : "left";

  card.dataset.thumbnailConfigured = cleanCrop ? "clean-crop-standard-template" : configuredImage ? "saved-setting" : preservedOriginal ? "original-photo" : overrideImage ? "inline-image-override" : "brand-fallback";
}

function applyAllCards() {
  applyScheduled = false;
  ensureStyle();
  removeSystemCard();
  adjustSystemCounts();
  document.querySelectorAll(".article-card[data-article-id]").forEach(applyCard);
}

function scheduleApply() {
  if (applyScheduled) return;
  applyScheduled = true;
  requestAnimationFrame(applyAllCards);
}

function initialize() {
  ensureStyle();
  scheduleApply();
  const settingsRef = doc(db, "articles", SETTINGS_DOC_ID);
  onSnapshot(settingsRef, (snapshot) => {
    hasSettingsDocument = snapshot.exists();
    const settings = snapshot.exists() ? snapshot.data()?.settings || {} : {};
    thumbnailSettings = new Map(Object.entries(settings));
    scheduleApply();
  }, (error) => {
    console.warn("文章縮圖設定文件同步失敗。", error);
    hasSettingsDocument = false;
    thumbnailSettings = new Map();
    scheduleApply();
  });
  const root = document.getElementById("article-root") || document.body;
  new MutationObserver(scheduleApply).observe(root, { childList: true, subtree: true });
  const tabs = document.getElementById("category-tabs");
  if (tabs) new MutationObserver(() => requestAnimationFrame(adjustSystemCounts)).observe(tabs, { childList: true, subtree: true });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") scheduleApply();
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
else initialize();
