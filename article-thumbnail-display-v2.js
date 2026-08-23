import { db } from "./firebase-config.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const SETTINGS_DOC_ID = "__article-thumbnail-settings";
const MEDIA_BACKGROUND = "#E8E1D3";
const BRAND_VERSION = "20260823-3";

const SPECIAL_ARTICLE_IMAGES = {
  "this-book-took-thirty-years": `assets/articles/thumbnails/brand-20260823/this-book-took-thirty-years.svg?v=${BRAND_VERSION}`,
  "quantum-frequency-work-wish": `assets/articles/thumbnails/brand-20260823/quantum-frequency-work-wish.svg?v=${BRAND_VERSION}`,
  "2058-future-person-prophecy": `assets/articles/thumbnails/brand-20260823/2058-future-person-prophecy.svg?v=${BRAND_VERSION}`
};

const BRAND_THEMES = {
  spiritual: {
    image: `assets/articles/thumbnails/brand-system-20260823/spiritual.svg?v=${BRAND_VERSION}`,
    tone: "dark",
    label: "靈・修行"
  },
  "spirit-world": {
    image: `assets/articles/thumbnails/brand-system-20260823/spirit-world.svg?v=${BRAND_VERSION}`,
    tone: "dark",
    label: "異・靈界"
  },
  worldly: {
    image: `assets/articles/thumbnails/brand-system-20260823/worldly.svg?v=${BRAND_VERSION}`,
    tone: "light",
    label: "人・俗世"
  },
  reading: {
    image: `assets/articles/thumbnails/brand-system-20260823/reading.svg?v=${BRAND_VERSION}`,
    tone: "light",
    label: "思・讀物"
  }
};

let hasSettingsDocument = false;
let applyScheduled = false;

function ensureBrandStyle() {
  if (document.getElementById("article-brand-thumbnail-style-20260823")) return;
  const style = document.createElement("style");
  style.id = "article-brand-thumbnail-style-20260823";
  style.textContent = `
    .article-card-media[data-brand-thumbnail="true"]{position:relative!important;overflow:hidden!important;background:${MEDIA_BACKGROUND}!important}
    .article-card-media[data-brand-thumbnail="true"]>img{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;object-fit:cover!important;object-position:center!important;transform:none!important;filter:none!important;margin:0!important;padding:0!important}
    .article-brand-thumb-overlay{position:absolute;inset:0;z-index:3;display:flex;flex-direction:column;padding:8.5% 8.5% 7.5%;pointer-events:none;text-align:left}
    .article-brand-thumb-overlay.is-dark{color:#F2EBDD}.article-brand-thumb-overlay.is-light{color:#3F3024}
    .article-brand-thumb-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
    .article-brand-thumb-brand{font-family:"Source Han Serif TC","Noto Serif TC","Songti TC",serif;font-size:clamp(12px,1.25vw,17px);letter-spacing:.18em;white-space:nowrap}
    .article-brand-thumb-category{font-family:"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif;font-size:clamp(9px,.88vw,12px);letter-spacing:.12em;opacity:.74;white-space:nowrap}
    .article-brand-thumb-rule{width:31%;height:1px;margin-top:7px;background:#A58254;opacity:.8}
    .article-brand-thumb-en{margin-top:5px;color:#A58254;font-family:Arial,sans-serif;font-size:clamp(7px,.7vw,10px);letter-spacing:.16em}
    .article-brand-thumb-title{margin-top:auto;margin-bottom:auto;max-width:68%;font-family:"Source Han Serif TC","Noto Serif TC","Songti TC",serif;font-weight:600;line-height:1.32;letter-spacing:.03em;text-wrap:balance;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden;text-shadow:none}
    .article-brand-thumb-title.len-short{font-size:clamp(20px,2.25vw,31px)}
    .article-brand-thumb-title.len-medium{font-size:clamp(18px,2.05vw,28px)}
    .article-brand-thumb-title.len-long{font-size:clamp(16px,1.8vw,25px);max-width:70%}
    .article-brand-thumb-foot{display:flex;align-items:center;gap:9px;color:#A58254;font-family:Arial,sans-serif;font-size:clamp(7px,.7vw,10px);letter-spacing:.13em}
    .article-brand-thumb-foot:before{content:"";width:22%;height:1px;background:#A58254;opacity:.62}
    .article-card-media[data-brand-special="true"] .article-brand-thumb-overlay{display:none!important}
    @media(max-width:760px){.article-brand-thumb-overlay{padding:7% 7.5% 6.5%}.article-brand-thumb-title{max-width:70%}.article-brand-thumb-title.len-long{max-width:72%}}
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

function categoryKeyForCard(card) {
  const meta = (card.querySelector(".article-meta")?.textContent || "").trim();
  if (meta.includes("異") || meta.includes("靈界")) return "spirit-world";
  if (meta.includes("人") || meta.includes("俗世")) return "worldly";
  if (meta.includes("思") || meta.includes("讀物")) return "reading";
  return "spiritual";
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
  if (length <= 14) return "len-short";
  if (length <= 24) return "len-medium";
  return "len-long";
}

function setTextIfChanged(node, value) {
  if (node && node.textContent !== value) node.textContent = value;
}

function ensureOverlay(media, titleText, categoryLabel, tone) {
  let overlay = media.querySelector(".article-brand-thumb-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "article-brand-thumb-overlay";
    overlay.innerHTML = `<div class="article-brand-thumb-head"><div><div class="article-brand-thumb-brand">靈元院</div><div class="article-brand-thumb-rule"></div><div class="article-brand-thumb-en">LYYUAN JOURNAL</div></div><div class="article-brand-thumb-category"></div></div><div class="article-brand-thumb-title"></div><div class="article-brand-thumb-foot">SELECTED READING</div>`;
    media.appendChild(overlay);
  }
  const dark = tone === "dark";
  if (overlay.classList.contains("is-dark") !== dark) overlay.classList.toggle("is-dark", dark);
  if (overlay.classList.contains("is-light") === dark) overlay.classList.toggle("is-light", !dark);
  const titleNode = overlay.querySelector(".article-brand-thumb-title");
  setTextIfChanged(titleNode, titleText);
  const lengthClass = titleLengthClass(titleText);
  if (!titleNode.classList.contains(lengthClass)) {
    titleNode.classList.remove("len-short", "len-medium", "len-long");
    titleNode.classList.add(lengthClass);
  }
  setTextIfChanged(overlay.querySelector(".article-brand-thumb-category"), categoryLabel);
}

function applyCard(card) {
  const articleId = card.dataset.articleId || "";
  if (!articleId || articleId === SETTINGS_DOC_ID) return;
  const media = card.querySelector(".article-card-media");
  if (!media) return;
  const titleText = (card.querySelector(".article-list-title")?.textContent || "靈元院文選").trim();
  const image = ensureImage(media, titleText);
  if (media.dataset.brandThumbnail !== "true") media.dataset.brandThumbnail = "true";

  const specialImage = SPECIAL_ARTICLE_IMAGES[articleId];
  if (specialImage) {
    if (image.getAttribute("src") !== specialImage) image.setAttribute("src", specialImage);
    if (media.dataset.brandSpecial !== "true") media.dataset.brandSpecial = "true";
    media.querySelector(".article-brand-thumb-overlay")?.remove();
    if (card.dataset.thumbnailConfigured !== "brand-special") card.dataset.thumbnailConfigured = "brand-special";
    return;
  }

  if (media.dataset.brandSpecial) delete media.dataset.brandSpecial;
  const theme = BRAND_THEMES[categoryKeyForCard(card)] || BRAND_THEMES.spiritual;
  if (image.getAttribute("src") !== theme.image) image.setAttribute("src", theme.image);
  ensureOverlay(media, titleText, theme.label, theme.tone);
  if (card.dataset.thumbnailConfigured !== "brand-system") card.dataset.thumbnailConfigured = "brand-system";
}

function applyAllCards() {
  applyScheduled = false;
  ensureBrandStyle();
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
  ensureBrandStyle();
  scheduleApply();
  const settingsRef = doc(db, "articles", SETTINGS_DOC_ID);
  onSnapshot(settingsRef, (snapshot) => {
    hasSettingsDocument = snapshot.exists();
    scheduleApply();
  }, (error) => {
    console.warn("文章縮圖設定文件同步失敗。", error);
    hasSettingsDocument = false;
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
