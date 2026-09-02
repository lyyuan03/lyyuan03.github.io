import { auth, db, isAdminEmail } from "./firebase-config.js?v=20260831-permissions-1";
import { staticArticles } from "./static-articles.js?v=20260831-permissions-1";
import { recommendedBookForArticle } from "./article-reading-resources.js?v=20260829-admin-authoritative-1";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, doc, getDoc, getDocs, onSnapshot, query, runTransaction, serverTimestamp, setDoc, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const categoryLabels = {
  spiritual: "靈．修行",
  worldly: "人．俗世",
  "spirit-world": "異．靈界",
  reading: "思．讀物"
};

/**
 * 文選 topics 固定詞表（唯一合法來源）。
 * 新增文章時，topics 必須從這份清單挑選，不得自行新增詞彙。
 * 如確有新增關鍵字的需求，必須先修改這份清單，並經使用者確認後才可使用。
 * 「宇色著作」是獨立來源標籤，不屬於 topics。
 */
const ALLOWED_ARTICLE_TOPICS_BY_CATEGORY = Object.freeze({
  spiritual: Object.freeze(["元神與人格", "靈修辨識", "感應與修為", "修行心性", "信仰與人"]),
  worldly: Object.freeze(["金錢意識", "自我信任", "生命選擇", "社會觀察"]),
  "spirit-world": Object.freeze(["神明與修行", "亡者接觸", "靈乩辨識", "靈界辨識", "權力與界線"]),
  reading: Object.freeze(["財富", "神祕學", "榮格", "塔羅牌"])
});
const ALLOWED_ARTICLE_TOPICS = Object.freeze(
  Object.values(ALLOWED_ARTICLE_TOPICS_BY_CATEGORY).flat()
);

const root = document.getElementById("article-root");
const tabs = document.getElementById("category-tabs");
const params = new URLSearchParams(location.search);
const activeCategory = params.get("category") || "";
const activeAccess = params.get("access") || "all";
const activeId = params.get("id") || "";
const standaloneArticlePaths = new Map();
const magicToken = params.get("token") || "";
const magicEventId = params.get("event") || "";
const memberMarker = "<!-- member-only -->";
const paidMarker = "<!-- paid-only -->";
const bookUrl = "https://lyyuan.tw/books.html?v=spiritual-books-20260703-refresh";
const limitedReadingDeadlines = new Map();
const ARTICLE_STATUS_INDEX_ID = "__article-publication-status";
const LEGACY_FIRESTORE_MANAGED_IDS = new Set(["yuanshen-destiny-archetype", "2058-future-person-prophecy"]);
const articleGuides = {
  "quantum-frequency-work-wish": { topics: ["神祕學"], level: "初識", nextId: "wealth-discipline-investing-and-self-mastery" },
  "yuanshen-destiny-archetype": { topics: ["元神與人格", "修行心性"], level: "深度", nextId: "this-book-took-thirty-years" },
  "love-beyond-filial-piety-and-ancestor-worship": { topics: ["修行心性", "生命選擇"], level: "深度", nextId: "good-fortune-believe-in-yourself-choices" },
  "how-to-judge-true-lingxiu-understanding": { topics: ["靈修辨識", "元神與人格"], level: "深度", nextId: "fantasy-intuition-or-yuanshen" },
  "reading-you-can-not-fear-death": { topics: ["修行心性", "生命選擇"], level: "深度", nextId: "tonglingren-wufa-huifu-putongren" },
  "2026-guanyin-vow-lamp-record": { topics: ["信仰與人", "修行心性"], level: "深度", nextId: "japan-temple-faith-and-decline" },
  "2026-guanyin-vow-lamp-record-v2": { topics: ["信仰與人", "修行心性"], level: "深度", nextId: "japan-temple-faith-and-decline" },
  "2058-future-person-prophecy": { topics: ["靈修辨識", "修行心性"], level: "深度", nextId: "lingxiu-yuanshen-reality" },
  "this-book-took-thirty-years": { topics: ["元神與人格", "修行心性"], level: "深度", nextId: "yuanshen-destiny-archetype" },
  "wealth-as-water": { topics: ["金錢意識", "自我信任"], level: "深度", nextId: "market-crash-money-self-control" },
  "fantasy-intuition-or-yuanshen": { topics: ["靈修辨識", "元神與人格"], level: "深度", nextId: "yuanshen-awakening-eleven-principles" },
  "spiritual-practice-cannot-be-outsourced-to-gods": { topics: ["神明與修行"], level: "初識", nextId: "jitong-leader-discernment" },
  "celebrity-death-dream-spirit-five-checks": { topics: ["亡者接觸", "靈界辨識"], level: "深度", nextId: "tonglingren-wufa-huifu-putongren" },
  "japan-temple-faith-and-decline": { topics: ["信仰與人"], level: "深度", nextId: "spiritual-practice-cannot-be-outsourced-to-gods" },
  "shenming-yinlu-ganying-budengyu-xiuwei": { topics: ["感應與修為", "修行心性"], level: "進階", nextId: "jitong-leader-discernment" },
  "jitong-leader-discernment": { topics: ["靈乩辨識", "權力與界線"], level: "深度", nextId: "tonglingren-wufa-huifu-putongren" },
  "jitong-discernment-before-exorcism": { topics: ["靈乩辨識", "靈界辨識"], level: "深度", nextId: "jitong-shenming-fushen" },
  "good-fortune-believe-in-yourself-choices": { topics: ["自我信任", "生命選擇"], level: "初識", nextId: "market-crash-money-self-control" },
  "yuanshen-awakening-eleven-principles": { topics: ["元神與人格", "感應與修為"], level: "初識", nextId: "lingxiu-yuanshen-reality" },
  "seven-twenty-five-election-shift": { topics: ["社會觀察"], level: "初識", nextId: "market-crash-money-self-control" },
  "tonglingren-wufa-huifu-putongren": { topics: ["靈修辨識", "修行心性"], level: "進階", nextId: "jitong-shenming-fushen" },
  "lingxiu-zouhuo-rumo": { topics: ["靈修辨識"], level: "初識", nextId: "lingxiu-yuanshen-reality" },
  "lingxiu-yuanshen-reality": { topics: ["元神與人格", "修行心性"], level: "進階", nextId: "yuanshen-awakening-eleven-principles" },
  "jitong-shenming-fushen": { topics: ["靈修辨識", "感應與修為"], level: "深度", nextId: "tonglingren-wufa-huifu-putongren" },
  "wealth-discipline-investing-and-self-mastery": { topics: ["財富"], sourceTag: "宇色著作", level: "初識", nextId: "market-crash-money-self-control" },
  "market-crash-money-self-control": { topics: ["金錢意識", "生命選擇"], level: "初識", nextId: "good-fortune-believe-in-yourself-choices" }
};

const articleThumbnailImages = {
  "yuanqin-debt-heart": "assets/articles/yuanqin-debt-heart/01-cover-yuanqin.webp?v=20260828-clean-text-2",
  "2058-future-person-prophecy": "assets/articles/2058-future-person-prophecy/thumbnail.webp?v=20260813-3",
  "this-book-took-thirty-years": "assets/articles/this-book-took-thirty-years/cover.jpg?v=20260810-photoreal-2",
  "celebrity-death-dream-spirit-five-checks": "assets/articles/thumbnails/celebrity-dream-spirit.svg?v=20260731-clean-1",
  "japan-temple-faith-and-decline": "assets/articles/thumbnails/japan-temple.jpg",
  "spiritual-practice-cannot-be-outsourced-to-gods": "assets/articles/thumbnails/spiritual-practice.jpg",
  "jitong-leader-discernment": "assets/articles/thumbnails/jitong-leader.jpg",
  "jitong-discernment-before-exorcism": "assets/articles/thumbnails/jitong-discernment.jpg",
  "good-fortune-believe-in-yourself-choices": "assets/articles/thumbnails/good-fortune.jpg",
  "yuanshen-awakening-eleven-principles": "assets/articles/thumbnails/yuanshen-awakening.jpg",
  "seven-twenty-five-election-shift": "assets/articles/thumbnails/election.jpg",
  "tonglingren-wufa-huifu-putongren": "assets/articles/thumbnails/tongling-return.jpg",
  "lingxiu-zouhuo-rumo": "assets/articles/thumbnails/lingxiu-zouhuo.jpg",
  "lingxiu-yuanshen-reality": "assets/articles/thumbnails/yuanshen-reality.jpg",
  "jitong-shenming-fushen": "assets/articles/thumbnails/jitong-shenming.jpg",
  "market-crash-money-self-control": "assets/articles/thumbnails/market-crash.jpg",
  "wealth-as-water": "assets/articles/thumbnails/market-crash.jpg?v=20260801-wealth-as-water-restore-1",
  "fantasy-intuition-or-yuanshen": "assets/articles/fantasy-intuition-yuanshen/cover.webp?v=20260801-fantasy-visual-1",
  "wealth-discipline-investing-and-self-mastery": "assets/articles/wealth-discipline/book-cover-photo.jpg?v=20260730-book-cover-2"
};

const articleHooks = {
  "this-book-took-thirty-years": "看見元神不難；真正困難的，是看見之後，如何把修行活進金錢、感情、情緒與每天的選擇裡。",
  "celebrity-death-dream-spirit-five-checks": "有人說亡者托夢、名人指定自己傳話。比起急著判斷真假，我更在意的是：這段接觸，究竟讓活著的人更清明，還是更依賴另一個故事？",
  "japan-temple-faith-and-decline": "如果有一天，信仰的人都不在了，這些神佛又會去哪裡？寺院還在，信仰卻可能早已離開。",
  "spiritual-practice-cannot-be-outsourced-to-gods": "神明可以引路，也可能給你感應；但神明離開之後，你是否仍能清醒做人，才是修為真正開始被檢驗的時刻。",
  "jitong-leader-discernment": "最容易讓人誤判的，不是神明降駕的那一刻，而是神明離開之後，那個人還坐在原位。",
  "jitong-discernment-before-exorcism": "第一個問題不該是「附在他身上的到底是誰」，而是：這裡真的有外靈嗎？判斷錯誤，驅邪反而可能使情況更嚴重。",
  "good-fortune-believe-in-yourself-choices": "真正阻擋人生改變的，往往不是命不好；而是每一次站在機會面前，你都習慣退回那個不相信自己的舊身分。",
  "yuanshen-awakening-eleven-principles": "你能看見別人看不見的東西，那是責任，不是特權。元神覺醒之後，最需要提防的，反而是人的貪念與膨脹。",
  "seven-twenty-five-election-shift": "七二五之後，短期有場面，中期有攻防；真正可能改變年底選情的，是中央與地方如何面對各自不願承擔的責任。",
  "tonglingren-wufa-huifu-putongren": "最可怕的不是神明的力量有多大，而是一個人嚐過被仰望的滋味後，再也不願意做回普通人。",
  "lingxiu-zouhuo-rumo": "身體出現異象、靈動或能量反應，不等於修為提升。當氣脈與內在問題一起浮現，你能否誠實回到自己？",
  "lingxiu-yuanshen-reality": "許多人以為靈修是努力就能學會的技能；真正要先面對的，卻是先天條件、生命軌跡，以及你是否承擔得起。",
  "jitong-shenming-fushen": "很多看似「神明附身」的展演，可能只是想像與暗示交織出的產物，連當事人自己都未必察覺。",
  "market-crash-money-self-control": "當你把「這次一定要翻身」放進市場，押上的就不只是一檔股票，也包括焦慮、不甘心，以及對未來的恐懼。"
};

// 靜態文章先行：Firebase Auth 或 Firestore 尚未回應時，公開文章仍可立即閱讀。
let loadedArticles = staticArticles
  .filter((article) => article?.status === "published" && article?.hidden !== true && article?.systemRecord !== true)
  .map((article) => ({ ...article, __articleSource: "static" }));
let articlesLoadCompleted = false;
let articlesLoadSerial = 0;
let articleMetrics = new Map();
let currentUser = null;
let currentMemberAccess = null;
let currentSponsorAccess = null;
let lastAdminPreviewState = false;
let activeArticleUnsubscribe = null;
let activeArticleWatchDocId = "";
let activeArticleWatchUpdatedAt = 0;
let visibleArticleCount = window.matchMedia("(max-width: 760px)").matches ? 6 : 9;

function adminPreviewEnabled() {
  return isAdminEmail(auth.currentUser?.email || currentUser?.email || "");
}

function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function bytesToBase64(bytes) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function bytesToBase64Url(bytes) {
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function magicTokenHash(token) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return bytesToBase64Url(new Uint8Array(digest));
}

async function unwrapEventKey(record, token) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const wrappingKey = await crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["decrypt"]);
  const unwrapped = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(record.iv) },
    wrappingKey,
    base64ToBytes(record.wrappedKey)
  );
  return new TextDecoder().decode(unwrapped);
}

async function decryptEventContent(encryptedContent, iv, rawKey) {
  const key = await crypto.subtle.importKey("raw", base64ToBytes(rawKey), { name: "AES-GCM" }, false, ["decrypt"]);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(iv) },
    key,
    base64ToBytes(encryptedContent)
  );
  return new TextDecoder().decode(decrypted);
}

function escapeHtml(value = "") {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function sanitizeUnsafeArticleContent(value = "") {
  let content = String(value || "");
  const markdownDataImage = /!\[[^\]]*\]\(\s*data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\r\n\t ]+\s*\)/gi;
  const orphanDataImage = /\(\s*data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\r\n\t ]+\s*\)/gi;
  const bareDataImage = /data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\r\n\t ]+/gi;
  content = content
    .replace(markdownDataImage, "")
    .replace(orphanDataImage, "")
    .replace(bareDataImage, "")
    .replace(/\\n\\n(?=\s*(?:\[圖片待重新上傳\]|$))/g, "\n\n")
    .replace(/(^|\n)\s*\[圖片待重新上傳\]\s*(?=\n|$)/g, "$1")
    .replace(/(^|\n)\s*!\[\]\s*(?=\n|$)/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
  return content;
}

function renderInline(value = "") {
  return escapeHtml(value).replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, function (_, alt, src) {
    return /^data:image/i.test(src) ? "" : '<img src="' + src + '" alt="' + alt + '">';
  });
}

function renderContent(value = "") {
  return sanitizeUnsafeArticleContent(value)
    .replace(memberMarker, "")
    .replace(paidMarker, "")
    .split(/\n{2,}/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (trimmed.startsWith("### ")) return `<h3>${renderInline(trimmed.slice(4))}</h3>`;
      if (trimmed.startsWith("## ")) return `<h2>${renderInline(trimmed.slice(3))}</h2>`;
      if (trimmed.startsWith("# ")) return `<h1>${renderInline(trimmed.slice(2))}</h1>`;
      if (/^!\[[^\]]*\]\([^)]+\)$/.test(trimmed)) return `<figure>${renderInline(trimmed)}</figure>`;
      return `<p>${renderInline(trimmed).replace(/\n/g, "<br>")}</p>`;
    })
    .join("");
}

function addGuanyinVowLampImages(content = "", articleId = "") {
  if (articleId !== "guanyin-chengdao-vow-reading") return content;
  const imageOne = "![觀世音菩薩成道法會・觀音應化啟願燈](assets/articles/guanyin-vow-lamp-01.jpg?v=20260731-1)";
  const imageTwo = "![法會後的供桌與供果](assets/articles/guanyin-vow-lamp-02.jpg?v=20260731-1)";
  let next = content;
  if (!next.includes("guanyin-vow-lamp-01.jpg")) {
    next = next.replace("## 法會結束後，我一直在想一件事", `${imageOne}\n\n## 法會結束後，我一直在想一件事`);
  }
  if (!next.includes("guanyin-vow-lamp-02.jpg")) {
    next = next.replace("## 願要被聽見，也需要準備承擔", `${imageTwo}\n\n## 願要被聽見，也需要準備承擔`);
  }
  return next;
}

function articleKey(article) {
  return article?.id || article?.slug || "";
}

function articleIsPaid(article) {
  return article?.accessType === "paid" || String(article?.content || "").includes(paidMarker);
}

function articleIsEvent(article) {
  return Boolean(article?.requiredPermission) || article?.accessType === "event" || Boolean(article?.eventId);
}

function articleIsLimitedOpen(article) {
  const deadline = limitedReadingDeadlines.get(articleKey(article));
  return Boolean(articleIsPaid(article) && deadline && Date.now() < deadline);
}

function articleAccess(article) {
  if (articleIsEvent(article)) return "event";
  if (articleIsPaid(article) && !articleIsLimitedOpen(article)) return "paid";
  return "open";
}

function getArticleThumbnail(article) {
  return article?.thumbnailImage || article?.coverImage || articleThumbnailImages[articleKey(article)] || "";
}

function getArticleHook(article) {
  return article?.excerpt || articleHooks[articleKey(article)] || "";
}

function getArticleGuide(article) {
  const key = articleKey(article);
  const fallback = articleGuides[key] || {};
  const articleTopics = Array.isArray(article?.topics) ? article.topics.filter(Boolean) : [];
  return {
    ...fallback,
    topics: articleTopics.length ? articleTopics : (fallback.topics || []),
    level: article?.readingLevel || fallback.level || ""
  };
}

const articleLevelClassNames = {
  "初識": "is-beginner",
  "深度": "is-deep",
  "進階": "is-advanced"
};

function renderArticleGuide(article, compact = false) {
  const guide = getArticleGuide(article);
  const topics = (guide.topics || []).filter(Boolean).slice(0, compact ? 2 : 3);
  const sourceTag = guide.sourceTag || "";
  const level = guide.level || "";
  const levelClass = articleLevelClassNames[level] || "";
  if (!topics.length && !sourceTag && !level) return "";
  return `<div class="article-guide${compact ? " is-compact" : ""}">
    ${level ? `<span class="article-level${levelClass ? ` ${levelClass}` : ""}">${escapeHtml(level)}</span>` : ""}
    ${topics.map((topic) => `<span class="article-topic">${escapeHtml(topic)}</span>`).join("")}
    ${sourceTag ? `<span class="article-source-tag">${escapeHtml(sourceTag)}</span>` : ""}
  </div>`;
}

function articleTime(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (typeof value?.seconds === "number") {
    return (value.seconds * 1000) + Math.floor(Number(value.nanoseconds || 0) / 1e6);
  }
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function articlePublishedTime(article = {}) {
  return articleTime(article.publishedAt)
    || articleTime(article.createdAt)
    || articleTime(article.updatedAt);
}

function refreshLimitedReadingDeadlines(articles = []) {
  limitedReadingDeadlines.clear();
  articles.forEach((article) => {
    const deadline = articleTime(article?.limitedReadingUntil);
    if (!deadline || article?.limitedReadingMode !== "full-open-then-paid") return;
    const keys = [articleKey(article), article?.slug].filter(Boolean);
    keys.forEach((key) => limitedReadingDeadlines.set(String(key), deadline));
  });
}

const JINMU_FEATURED_ORDER = new Map([
  ["2026-yaochi-birthday-morning", 1],
  ["reconciliation-absolution-heart", 2],
  ["2026-building-patron-record", 3],
  ["2026-lineage-lamp-building-record", 4]
]);

function sortPublished(a, b) {
  if (adminPreviewEnabled()) {
    const aDraft = a?.status === "draft";
    const bDraft = b?.status === "draft";
    if (aDraft !== bDraft) return aDraft ? -1 : 1;
  }

  const aFeaturedOrder = JINMU_FEATURED_ORDER.get(articleKey(a));
  const bFeaturedOrder = JINMU_FEATURED_ORDER.get(articleKey(b));
  const aIsFeatured = Number.isFinite(aFeaturedOrder);
  const bIsFeatured = Number.isFinite(bFeaturedOrder);
  if (aIsFeatured || bIsFeatured) {
    if (aIsFeatured && bIsFeatured) return aFeaturedOrder - bFeaturedOrder;
    return aIsFeatured ? -1 : 1;
  }

  const timeDiff = articlePublishedTime(b) - articlePublishedTime(a);
  if (timeDiff !== 0) return timeDiff;
  return String(articleKey(a)).localeCompare(String(articleKey(b)), "zh-Hant");
}

function renderTabs() {
  if (!tabs) return;
  const categories = [
    ["", "全部"],
    ["spiritual", categoryLabels.spiritual],
    ["worldly", categoryLabels.worldly],
    ["spirit-world", categoryLabels["spirit-world"]],
    ["reading", categoryLabels.reading]
  ];
  tabs.innerHTML = categories.map(([key, label]) => `<a class="${activeCategory === key ? "active" : ""}" href="articles.html${key ? `?category=${encodeURIComponent(key)}` : ""}">${label}</a>`).join("");
}

function metricFor(articleId) {
  return articleMetrics.get(articleId) || {};
}

function renderMetricItems(metric, compact = false) {
  const views = Number(metric.views || 0);
  const shares = Number(metric.shares || 0);
  const copies = Number(metric.copies || 0);
  if (!compact) return `<span>閱讀 ${views}</span><span>分享 ${shares}</span><span>複製 ${copies}</span>`;
  return `<span class="article-metric"><span class="article-metric-label">閱讀</span><span class="article-metric-value">${views}</span></span><span class="article-metric"><span class="article-metric-label">分享</span><span class="article-metric-value">${shares}</span></span><span class="article-metric"><span class="article-metric-label">複製</span><span class="article-metric-value">${copies}</span></span>`;
}

function renderMetricSummary(articleId, compact = false) {
  return `<div class="article-metrics${compact ? " is-compact" : ""}" data-article-metrics="${escapeHtml(articleId)}">${renderMetricItems(metricFor(articleId), compact)}</div>`;
}

function updateMetricSummary(articleId) {
  document.querySelectorAll(`[data-article-metrics="${CSS.escape(articleId)}"]`).forEach((node) => {
    node.innerHTML = renderMetricItems(metricFor(articleId), node.classList.contains("is-compact"));
  });
}

async function loadArticleMetrics() {
  try {
    const snapshot = await getDocs(collection(db, "articleMetrics"));
    articleMetrics = new Map(snapshot.docs
      .filter((item) => item.id !== ARTICLE_STATUS_INDEX_ID)
      .map((item) => [item.id, item.data()]));
  } catch (error) {
    console.warn("文章統計暫時無法載入。", error);
    articleMetrics = new Map();
  }
}

async function incrementArticleMetric(articleId, metric) {
  if (!articleId || !["views", "shares", "copies"].includes(metric)) return;
  const metricRef = doc(db, "articleMetrics", articleId);
  try {
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(metricRef);
      const current = snapshot.exists() ? snapshot.data() : {};
      transaction.set(metricRef, {
        articleId,
        views: Number(current.views || 0) + (metric === "views" ? 1 : 0),
        shares: Number(current.shares || 0) + (metric === "shares" ? 1 : 0),
        copies: Number(current.copies || 0) + (metric === "copies" ? 1 : 0),
        updatedAt: serverTimestamp()
      });
    });
    const current = articleMetrics.get(articleId) || {};
    articleMetrics.set(articleId, {
      ...current,
      articleId,
      [metric]: Number(current[metric] || 0) + 1
    });
    updateMetricSummary(articleId);
  } catch (error) {
    console.warn(`文章${metric}統計寫入失敗。`, error);
  }
}

function trackArticleView(articleId) {
  const key = `lyyuan-article-viewed:${articleId}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch {}
  incrementArticleMetric(articleId, "views");
}

function renderLimitedReadingCountdown(articleId, isPaid = false) {
  if (!limitedReadingDeadlines.has(articleId)) return "";
  const isLimitedOpen = isPaid && Date.now() < limitedReadingDeadlines.get(articleId);
  return `<small class="limited-reading-countdown" data-limited-reading-countdown data-article-id="${escapeHtml(articleId)}" data-limited-open="${isLimitedOpen ? "true" : "false"}" aria-live="polite">限時閱讀｜計算中…</small>`;
}

function bindLimitedReadingCountdowns() {
  const nodes = [...document.querySelectorAll("[data-limited-reading-countdown]")];
  if (!nodes.length) return;

  const update = () => {
    const now = Date.now();
    let hasActiveCountdown = false;
    nodes.forEach((node) => {
      const deadline = limitedReadingDeadlines.get(node.dataset.articleId);
      const remaining = deadline - now;
      if (remaining <= 0) {
        if (node.dataset.limitedOpen === "true" && activeId) {
          renderCurrentView();
          return;
        }
        node.remove();
        return;
      }

      hasActiveCountdown = true;
      const totalSeconds = Math.floor(remaining / 1000);
      const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
      const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
      const seconds = String(totalSeconds % 60).padStart(2, "0");
      const deadlineLabel = new Intl.DateTimeFormat("zh-TW", {
        timeZone: "Asia/Taipei",
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }).format(new Date(deadline));
      node.textContent = node.closest(".article-card")
        ? `限時免費｜剩餘 ${hours}：${minutes}：${seconds}`
        : `限時免費閱讀｜${deadlineLabel} 轉為贊助會員專屬｜剩餘 ${hours}：${minutes}：${seconds}`;
    });
    return hasActiveCountdown;
  };

  if (!update()) return;
  const timer = window.setInterval(() => {
    if (!update()) window.clearInterval(timer);
  }, 1000);
}

function renderList(articles) {
  const filtered = articles.filter((article) => {
    const matchesCategory = !activeCategory || article.category === activeCategory;
    const matchesAccess = activeAccess === "all" || articleAccess(article) === activeAccess;
    const matchesEvent = !magicEventId || article.eventId === magicEventId;
    return matchesCategory && matchesAccess && matchesEvent;
  });

  if (!filtered.length) {
    root.innerHTML = '<div class="empty">目前沒有符合條件的文章，請選擇其他分類。</div>';
    return;
  }

  const visibleArticles = filtered.slice(0, visibleArticleCount);
  const remainingCount = filtered.length - visibleArticles.length;
  const adminDraftCount = adminPreviewEnabled()
    ? filtered.filter((article) => article.status === "draft").length
    : 0;
  root.innerHTML = `
    ${adminPreviewEnabled() ? `<div class="article-admin-preview-summary"><strong>管理者預覽模式</strong>｜目前可見草稿 ${adminDraftCount} 篇</div>` : ""}
    <div class="article-result-summary">
      <span>共 ${filtered.length} 篇文章</span>
      <a href="#article-filters">重新選擇分類</a>
    </div>
    <div class="article-grid">
      ${visibleArticles.map((article) => {
        const key = articleKey(article);
        const access = articleAccess(article);
        const accessLabel = article.accessBadge || (access === "event" ? "活動限定" : access === "paid" ? "贊助專屬" : articleIsLimitedOpen(article) ? "限時免費" : "免費閱讀");
        const isDraftPreview = article.status === "draft" && adminPreviewEnabled();
        return `
          <a class="article-card" data-article-id="${escapeHtml(key)}" href="${standaloneArticlePaths.get(key) || `articles.html?id=${encodeURIComponent(key)}`}${magicToken ? `&event=${encodeURIComponent(article.eventId || magicEventId)}&token=${encodeURIComponent(magicToken)}` : ""}">
            <div class="article-card-media">
              ${getArticleThumbnail(article) ? `<img src="${escapeHtml(getArticleThumbnail(article))}" alt="${escapeHtml(article.title || "靈元院文選")}" loading="lazy" decoding="async">` : '<div class="article-card-placeholder" aria-hidden="true">靈元院文選</div>'}
              <div class="article-card-media-gradient" aria-hidden="true"></div>
            </div>
            <div class="article-card-content">
              <div class="article-card-heading">
                <div class="article-meta">${categoryLabels[article.category] || "文選"}</div>
                <span class="article-card-badges">${isDraftPreview ? '<span class="article-access-badge is-draft">草稿預覽</span>' : ""}<span class="article-access-badge is-${access}">${accessLabel}</span></span>
              </div>
              <h2 class="article-list-title">${escapeHtml(article.title || "未命名文章")}</h2>
              ${renderArticleGuide(article, true)}
              ${renderLimitedReadingCountdown(key, articleIsPaid(article))}
              <p class="article-hook">${escapeHtml(getArticleHook(article))}</p>
              ${renderMetricSummary(key, true)}
            </div>
          </a>
        `;
      }).join("")}
    </div>
    ${remainingCount > 0 ? `
      <div class="article-load-more-wrap">
        <button class="article-load-more" id="article-load-more" type="button">
          顯示更多文章 <small>尚有 ${remainingCount} 篇</small>
        </button>
      </div>
    ` : ""}
  `;

  document.getElementById("article-load-more")?.addEventListener("click", () => {
    visibleArticleCount += window.matchMedia("(max-width: 760px)").matches ? 6 : 9;
    renderList(articles);
  });
  bindLimitedReadingCountdowns();
  bindListMotion();
}

function bindListMotion() {
  const cards = [...document.querySelectorAll(".article-card")];
  if (!cards.length) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
    cards.forEach((card) => card.classList.add("is-visible"));
    return;
  }
  document.documentElement.classList.add("article-motion-ready");
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: .08, rootMargin: "0px 0px -24px" });
  cards.forEach((card, index) => {
    card.style.setProperty("--card-order", String(index % 3));
    observer.observe(card);
  });
}

function splitMemberContent(content = "", articleId = "") {
  const deadline = limitedReadingDeadlines.get(articleId);
  if (content.includes(paidMarker) && deadline && Date.now() < deadline) {
    return { publicContent: content.replace(paidMarker, ""), lockedContent: "", accessType: "open" };
  }
  const accessType = content.includes(paidMarker)
    ? "paid"
    : content.includes(memberMarker)
      ? "member"
      : "open";
  if (accessType === "open") {
    return { publicContent: content, lockedContent: "", accessType: "open" };
  }
  const marker = accessType === "paid" ? paidMarker : memberMarker;
  const [publicContent, ...rest] = content.split(marker);
  return {
    publicContent: publicContent.trim(),
    lockedContent: rest.join(marker).trim(),
    accessType
  };
}

function memberAccessDate(value) {
  if (!value) return null;
  const date = value?.toDate?.() || new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function hasDirectSponsorAccess(record, userEmail) {
  if (!record || record.memberType !== "sponsor-member") return false;
  if (record.status !== "active" || record.paymentStatus !== "paid") return false;
  if (record.articleAccess !== true || record.accessScope !== "sponsor-paid-articles") return false;
  if (Number(record.accessVersion || 0) < 2) return false;
  if (record.revokedAt || record.suspended === true || record.disabled === true) return false;
  const recordEmail = String(record.email || "").trim().toLowerCase();
  if (!recordEmail || recordEmail !== userEmail) return false;
  const now = new Date();
  const startsAt = memberAccessDate(record.startsAt);
  const expiresAt = memberAccessDate(record.expiresAt);
  return (!startsAt || startsAt <= now) && Boolean(expiresAt && expiresAt > now);
}

function hasWellnessArticleBenefit(record, member, userEmail) {
  const benefit = record?.wellnessBenefit;
  if (!benefit || benefit.active !== true || benefit.articleAccess !== true) return false;
  if (benefit.status !== "active" || benefit.accessScope !== "sponsor-paid-articles") return false;
  if (Number(benefit.accessVersion || 0) < 1) return false;
  if (String(record.email || "").trim().toLowerCase() !== userEmail) return false;
  if (!member || String(member.email || "").trim().toLowerCase() !== userEmail) return false;
  if (member.memberType !== "wellness-channel" || member.wellnessAccess !== true) return false;
  if (!["wellness", "lingji"].includes(member.memberLevel)) return false;
  if (member.status !== "active" || member.paymentStatus !== "paid") return false;
  if (member.revokedAt || member.suspended === true || member.disabled === true) return false;

  const now = new Date();
  const memberStart = memberAccessDate(member.startsAt || member.firstJoinedAt);
  const memberExpiry = memberAccessDate(member.expiresAt);
  const benefitStart = memberAccessDate(benefit.startsAt);
  const benefitExpiry = memberAccessDate(benefit.expiresAt);
  if (memberStart && memberStart > now) return false;
  if (!memberExpiry || memberExpiry <= now || !benefitExpiry || benefitExpiry <= now) return false;
  if (benefitStart && benefitStart > now) return false;
  if (benefitExpiry.getTime() > memberExpiry.getTime() + 60000) return false;
  if (benefit.linkedMemberLevel !== member.memberLevel) return false;

  if (benefit.source === "lingji-member") return member.memberLevel === "lingji";
  if (benefit.source === "single-purchase-15000") {
    return Number(benefit.qualifyingPurchaseAmount || 0) >= 15000
      && Boolean(String(benefit.confirmedBy || "").trim())
      && Boolean(memberAccessDate(benefit.confirmedAt));
  }
  return false;
}

function hasPaidAccess(articleId = "") {
  if (adminPreviewEnabled()) return true;
  if (!currentUser?.email || !currentSponsorAccess) return false;
  const userEmail = currentUser.email.trim().toLowerCase();
  const directAccess = hasDirectSponsorAccess(currentSponsorAccess, userEmail);
  const wellnessAccess = hasWellnessArticleBenefit(currentSponsorAccess, currentMemberAccess, userEmail);
  if (!directAccess && !wellnessAccess) return false;
  return true;
}

async function loadMemberAccess(user) {
  currentMemberAccess = null;
  currentSponsorAccess = null;
  if (!user?.email || isAdminEmail(user.email)) return;
  try {
    const email = user.email.trim().toLowerCase();
    const [memberSnapshot, sponsorSnapshot] = await Promise.all([
      withTimeout(getDoc(doc(db, "memberAccess", email)), 8000, "一般會員資格載入").catch((error) => {
        if (error?.code !== "permission-denied") console.warn("一般會員資格載入失敗。", error);
        return null;
      }),
      withTimeout(getDoc(doc(db, "sponsorMemberAccess", email)), 8000, "贊助會員資格載入").catch((error) => {
        console.warn("贊助會員資格載入失敗。", error);
        return null;
      })
    ]);

    if (memberSnapshot?.exists()) {
      const record = memberSnapshot.data() || {};
      const recordEmail = String(record.email || memberSnapshot.id || "").trim().toLowerCase();
      if (recordEmail === email) currentMemberAccess = { ...record, email: recordEmail };
    }

    if (sponsorSnapshot?.exists()) {
      const record = sponsorSnapshot.data() || {};
      const recordEmail = String(record.email || sponsorSnapshot.id || "").trim().toLowerCase();
      if (recordEmail === email) currentSponsorAccess = { ...record, email: recordEmail };
    }
  } catch (error) {
    console.warn("會員閱讀資格暫時無法確認。", error);
    currentMemberAccess = null;
    currentSponsorAccess = null;
  }
}

async function eventArticleKey(article) {
  const key = article.id || article.slug;
  if (magicToken && (!magicEventId || magicEventId === article.eventId)) {
    const hash = await magicTokenHash(magicToken);
    const record = article.magicLinkAccess?.[hash];
    const expiresAt = Date.parse(record?.expiresAt || "");
    if (record?.status === "active" && Number.isFinite(expiresAt) && expiresAt > Date.now()) {
      return unwrapEventKey(record, magicToken);
    }
  }
  if (adminPreviewEnabled()) {
    const snapshot = await getDoc(doc(db, "membershipSettings", "eventArticleKeys"));
    return snapshot.exists() ? snapshot.data().keys?.[key] || "" : "";
  }
  if (currentMemberAccess?.eventAccess?.[article.eventId]?.status !== "active") return "";
  return currentMemberAccess?.eventArticleKeys?.[key] || "";
}

async function hydrateEventArticle(article) {
  if (!articleIsEvent(article)) return article;
  if (article.requiredPermission) {
    // 身分判斷交給 Firestore Rules；不下載全文再以 CSS／前端陣列隱藏。
    if (!currentUser?.email) return { ...article, content: "", eventAccessGranted: false };
    try {
      const bodyId = article.__firestoreId || article.id || article.slug;
      const snapshot = await getDoc(doc(db, "eventArticleBodies", bodyId));
      if (!snapshot.exists()) return { ...article, content: "", eventAccessGranted: false };
      const body = snapshot.data();
      if (body.requiredPermission !== article.requiredPermission || body.active === false) return article;
      return { ...article, content: body.content || "", eventAccessGranted: true };
    } catch (error) {
      if (error?.code !== "permission-denied") console.warn("活動文章暫時無法載入。", error);
      return { ...article, content: "", eventAccessGranted: false };
    }
  }
  if (!currentUser && !magicToken) return article;
  const key = await eventArticleKey(article);
  if (!key) return article;
  try {
    const iv = article.eventIv || article.contentIv || "";
    if (!iv) return article;
    const content = await decryptEventContent(article.encryptedContent, iv, key);
    return { ...article, content, eventAccessGranted: true };
  } catch (error) {
    console.warn("活動限定文章解密失敗。", error);
    return article;
  }
}

function renderSupportGate(lockedContent) {
  if (!lockedContent) return "";
  return `<section class="article-support-gate" aria-label="繼續閱讀全文"><div class="article-support-preview" aria-hidden="true">${renderContent(lockedContent)}</div><div class="article-support-card"><strong>文章未完，繼續閱讀</strong><p>若這篇文章對你有所啟發，歡迎訂閱 YouTube、追蹤 Facebook，持續收到新的靈修解析。</p><div class="article-support-actions"><a href="https://www.youtube.com/@lyyuan03" target="_blank" rel="noopener noreferrer">訂閱 靈元院YouTube</a><a href="https://www.facebook.com/share/18zfvhPkBF/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer">追蹤 靈元院 Facebook</a></div><button class="article-continue" type="button">繼續閱讀全文</button></div></section>`;
}

function bindArticleContinue() {
  const button = document.querySelector(".article-continue");
  const remaining = document.getElementById("article-remaining-content");
  const gate = document.querySelector(".article-support-gate");
  if (!button || !remaining) return;
  button.addEventListener("click", () => {
    remaining.hidden = false;
    gate?.remove();
    remaining.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function renderPaidGate(article) {
  return `<section class="article-paid-gate"><strong>贊助專屬文章</strong><p>此篇為贊助專屬內容，請使用具有閱讀資格的 Gmail 登入。</p><button class="article-paid-login" type="button">會員登入</button></section>`;
}
function bindPaidLogin() { document.querySelector(".article-paid-login")?.addEventListener("click", () => document.getElementById("member-login-button")?.click()); }
function renderEventGate(article) {
  return `<section class="article-paid-gate" data-event-gate><strong>${escapeHtml(article.accessBadge || "活動限定文章")}</strong><p>${escapeHtml(article.accessDeniedMessage || "此篇僅提供指定活動參與者閱讀。")}</p><p>${currentUser ? "目前登入的 Gmail 尚未取得本篇閱讀資格。如已登記，請聯繫靈元院核對報名 Gmail。" : "請使用報名時填寫、已取得閱讀資格的 Gmail 登入。"}</p>${!currentUser ? '<button class="article-event-login article-paid-login" type="button">使用 Gmail 登入</button>' : ""}</section>`;
}
function bindEventLogin() { document.querySelector(".article-event-login")?.addEventListener("click", () => document.getElementById("member-login-button")?.click()); }

function renderRecommendedBook(article) {
  const book = recommendedBookForArticle(article);
  const meta = [book.author, book.publisher].filter(Boolean).join("｜");
  const coverClass = book.coverStyle === "landscape" ? " is-landscape" : "";
  return `<aside class="recommended-book" aria-label="延伸書籍：${escapeHtml(book.title)}"><a class="recommended-book-link" href="${escapeHtml(book.purchaseUrl || bookUrl)}" target="_blank" rel="noopener noreferrer"><div class="recommended-book-copy"><small class="recommended-book-eyebrow">延伸書籍</small><strong>${escapeHtml(book.title)}</strong>${meta ? `<span class="recommended-book-meta">${escapeHtml(meta)}</span>` : ""}<span class="recommended-book-action">查看書籍 <span aria-hidden="true">→</span></span></div><span class="recommended-book-cover${coverClass}"><img src="${escapeHtml(book.coverImage)}" alt="《${escapeHtml(book.title)}》書封" loading="lazy" decoding="async"></span></a></aside>`;
}

function firstArticleImage(article) {
  if (article?.coverImage) return article.coverImage;
  const markdownImage = String(article?.content || "").match(/!\[[^\]]*\]\(([^)\s]+)\)/)?.[1];
  return markdownImage || getArticleThumbnail(article) || "";
}

function relatedArticleFor(article) {
  const currentId = articleKey(article);
  const pool = loadedArticles.length ? loadedArticles : staticArticles;
  const preferredId = getArticleGuide(article).nextId;
  const preferred = preferredId ? pool.find((item) => articleKey(item) === preferredId && articleKey(item) !== currentId) : null;
  if (preferred) return preferred;
  return pool.find((item) => articleKey(item) !== currentId && item.category === article.category) || pool.find((item) => articleKey(item) !== currentId) || null;
}

function renderNextReading(article) {
  const target = relatedArticleFor(article);
  if (!target) return "";
  const sourceId = articleKey(article);
  const nextId = articleKey(target);
  const thumbnail = firstArticleImage(target);
  return `<aside class="next-reading" data-related-reading="${escapeHtml(sourceId)}" aria-label="延伸閱讀：${escapeHtml(target.title || "靈元院文選")}"><div class="next-reading-eyebrow">延伸閱讀</div><a class="next-reading-link" href="${standaloneArticlePaths.get(nextId) || `articles.html?id=${encodeURIComponent(nextId)}`}"><span class="next-reading-thumbnail">${thumbnail ? `<img src="${escapeHtml(thumbnail)}" alt="${escapeHtml(target.title || "延伸閱讀")}首圖縮圖" loading="lazy" decoding="async">` : '<span class="next-reading-placeholder">靈元院文選</span>'}</span><span class="next-reading-copy"><strong>${escapeHtml(target.title || "延伸閱讀")}</strong><span>${escapeHtml((getArticleGuide(target).topics || []).join("・") || categoryLabels[target.category] || "文選")}</span></span></a></aside>`;
}

function getShareUrl(article) {
  if (article?.sharePath) return new URL(article.sharePath, location.origin).href;
  return new URL(`articles.html?id=${encodeURIComponent(articleKey(article))}`, location.origin).href;
}

function renderArticleShare(article) {
  const articleId = articleKey(article);
  const shareUrl = getShareUrl(article);
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(`${article.title || "靈元院文選"} ${shareUrl}`);
  const encodedTitle = encodeURIComponent(article.title || "靈元院文選");
  return `<div class="article-share" aria-label="文章分享">${renderMetricSummary(articleId)}<div class="article-share-actions"><a class="article-share-icon facebook" href="https://www.facebook.com/share/18zfvhPkBF/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer" aria-label="前往靈元院 Facebook" title="Facebook">f</a><a class="article-share-icon instagram" href="https://www.instagram.com/lyyuan03/" target="_blank" rel="noopener noreferrer" aria-label="前往靈元院 Instagram" title="Instagram">◎</a><a class="article-share-icon line" data-share-metric href="https://social-plugins.line.me/lineit/share?url=${encodedUrl}" target="_blank" rel="noopener noreferrer" aria-label="分享到 LINE" title="LINE">L</a><a class="article-share-icon telegram" data-share-metric href="https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}" target="_blank" rel="noopener noreferrer" aria-label="分享到 Telegram" title="Telegram">T</a><a class="article-share-icon email" data-share-metric href="mailto:?subject=${encodedTitle}&body=${encodedText}" aria-label="用 Email 分享" title="Email">@</a><button class="article-share-icon copy article-share-copy" type="button" data-share-url="${escapeHtml(shareUrl)}" aria-label="複製文章連結" title="複製連結">⧉</button></div><span class="article-share-status" role="status" aria-live="polite"></span></div>`;
}

async function copyArticleUrl(button, articleId) {
  const status = document.querySelector(".article-share-status");
  try {
    await navigator.clipboard.writeText(button.dataset.shareUrl);
    if (status) status.textContent = "已複製連結";
    incrementArticleMetric(articleId, "copies");
  } catch {
    window.prompt("請複製文章連結", button.dataset.shareUrl);
  }
}

function bindArticleShare(articleId) {
  const copyButton = document.querySelector(".article-share-copy");
  copyButton?.addEventListener("click", () => copyArticleUrl(copyButton, articleId));
  document.querySelectorAll("[data-share-metric]").forEach((link) => link.addEventListener("click", () => incrementArticleMetric(articleId, "shares")));
}

function bindArticleExperience() {
  const article = document.querySelector(".article-view");
  const body = article?.querySelector(".article-body");
  if (!article || !body) return;
  document.querySelector(".reading-progress")?.remove();
  const progress = document.createElement("div");
  progress.className = "reading-progress";
  progress.setAttribute("aria-hidden", "true");
  progress.innerHTML = "<span></span>";
  document.body.appendChild(progress);
  const progressBar = progress.querySelector("span");
  const updateProgress = () => {
    const start = article.offsetTop;
    const end = start + article.offsetHeight - window.innerHeight;
    const ratio = end <= start ? 1 : Math.min(1, Math.max(0, (window.scrollY - start) / (end - start)));
    progressBar.style.transform = `scaleX(${ratio})`;
  };
  updateProgress();
  window.addEventListener("scroll", updateProgress, { passive: true });
  const headings = [...body.querySelectorAll("h2, h3")].filter((heading) => heading.textContent.trim());
  if (headings.length >= 3) {
    headings.forEach((heading, index) => { heading.id = `article-section-${index + 1}`; });
    const toc = document.createElement("aside");
    toc.className = "article-toc";
    toc.setAttribute("aria-label", "文章章節");
    toc.setAttribute("role", "navigation");
    toc.innerHTML = `<button class="article-toc-toggle" type="button" aria-expanded="false"><span>文章章節</span><small>共 ${headings.length} 節</small></button><ol>${headings.map((heading) => `<li class="${heading.tagName === "H3" ? "is-sub" : ""}"><a href="#${heading.id}">${escapeHtml(heading.textContent.trim())}</a></li>`).join("")}</ol>`;
    const cover = article.querySelector(".article-cover");
    (cover || body).before(toc);
    const toggle = toc.querySelector(".article-toc-toggle");
    toggle.addEventListener("click", () => {
      const open = toc.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    toc.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
      toc.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    }));
  }
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) requestAnimationFrame(() => article.classList.add("is-ready"));
  else article.classList.add("is-ready");
}

function renderArticle(article) {
  if (!article) {
    root.innerHTML = '<div class="empty">找不到這篇文章，或文章尚未發布。</div>';
    return;
  }
  document.title = `${article.title}｜靈元院文選`;
  const articleKeyValue = article.id || article.slug || activeId;
  const isDraftPreview = article.status === "draft" && adminPreviewEnabled();
  const draftNotice = isDraftPreview ? '<div class="article-draft-notice"><strong>草稿預覽</strong>｜僅靈元院管理者帳號可見，尚未公開。</div>' : "";
  if (articleIsEvent(article) && !article.eventAccessGranted) {
    root.innerHTML = `<article class="article-view" data-article-id="${escapeHtml(articleKeyValue)}"><a class="article-back" href="articles.html">← 返回全部文選</a>${draftNotice}${article.requiredPermission ? `<div class="article-series">${escapeHtml(article.series || "")}</div><span class="article-access-badge is-event">${escapeHtml(article.accessBadge || "活動限定")}</span>` : ""}<div class="article-meta">${categoryLabels[article.category] || "文選"}｜活動限定</div><h2>${escapeHtml(article.title || "未命名文章")}</h2>${article.coverImage ? `<img class="article-cover" src="${escapeHtml(article.coverImage)}" alt="">` : ""}${article.excerpt ? `<div class="article-body"><p>${escapeHtml(article.excerpt)}</p></div>` : ""}${renderEventGate(article)}${renderNextReading(article)}${renderRecommendedBook(article)}${renderArticleShare(article)}</article>`;
    bindEventLogin();
    bindArticleShare(articleKeyValue);
    if (!isDraftPreview) trackArticleView(articleKeyValue);
    return;
  }
  const articleContent = addGuanyinVowLampImages(article.content || "", articleKeyValue);
  const { publicContent, lockedContent, accessType } = splitMemberContent(articleContent, articleKeyValue);
  root.innerHTML = `<article class="article-view" data-article-id="${escapeHtml(articleKeyValue)}" data-article-access="${escapeHtml(accessType)}"${accessType === "paid" ? ' data-paid-body-state="locked"' : ""}><a class="article-back" href="articles.html">← 返回全部文選</a>${draftNotice}${article.requiredPermission ? `<div class="article-series">${escapeHtml(article.series || "")}</div><span class="article-access-badge is-event">${escapeHtml(article.accessBadge || "活動限定")}</span>` : ""}<div class="article-meta">${categoryLabels[article.category] || "文選"}</div><h2>${escapeHtml(article.title || "未命名文章")}</h2>${renderArticleGuide(article)}${renderLimitedReadingCountdown(article.id || article.slug || activeId, articleContent.includes(paidMarker))}${article.coverImage ? `<img class="article-cover" src="${escapeHtml(article.coverImage)}" alt=""${["wealth-discipline-investing-and-self-mastery", "reading-you-can-not-fear-death"].includes(articleKeyValue) ? ' style="max-height:none;height:auto;object-fit:contain;object-position:center"' : ""}>` : ""}<div class="article-body">${renderContent(publicContent)}</div>${accessType === "member" ? renderSupportGate(lockedContent) : ""}${accessType === "paid" ? renderPaidGate(article) : ""}${accessType === "member" ? `<div class="article-body" id="article-remaining-content" hidden>${renderContent(lockedContent)}</div>` : ""}${renderNextReading(article)}${renderRecommendedBook(article)}${renderArticleShare(article)}</article>`;
  bindLimitedReadingCountdowns();
  if (accessType === "member") bindArticleContinue();
  if (accessType === "paid") bindPaidLogin();
  bindArticleShare(articleKeyValue);
  bindArticleExperience();
  if (!isDraftPreview) trackArticleView(articleKeyValue);
  document.dispatchEvent(new CustomEvent("lyyuan:article-rendered", {
    detail: { articleId: articleKeyValue, accessType }
  }));
}

function watchActiveFirestoreArticle(article) {
  const docId = article?.__articleSource === "firestore"
    ? String(article.__firestoreId || article.id || "")
    : "";

  if (!activeId || !docId) {
    if (activeArticleUnsubscribe) activeArticleUnsubscribe();
    activeArticleUnsubscribe = null;
    activeArticleWatchDocId = "";
    activeArticleWatchUpdatedAt = 0;
    return;
  }

  if (activeArticleWatchDocId === docId && activeArticleUnsubscribe) return;

  if (activeArticleUnsubscribe) activeArticleUnsubscribe();
  activeArticleWatchDocId = docId;
  activeArticleWatchUpdatedAt = articleTime(article.updatedAt);

  activeArticleUnsubscribe = onSnapshot(doc(db, "articles", docId), (snapshot) => {
    if (!snapshot.exists()) return;
    const next = snapshot.data() || {};
    const nextUpdatedAt = articleTime(next.updatedAt);

    // 初次監聽不重複載入；後台每次儲存都會更新 updatedAt，
    // 一旦版本改變，已開啟的前台文章立即重新讀取 Firestore。
    if (!nextUpdatedAt || nextUpdatedAt === activeArticleWatchUpdatedAt) return;
    activeArticleWatchUpdatedAt = nextUpdatedAt;
    void loadArticles().catch((error) => {
      console.warn("前台文章即時同步失敗，保留目前顯示內容。", error);
    });
  }, (error) => {
    console.warn("前台文章即時監聽暫時無法使用。", error);
  });
}

function renderCurrentView() {
  const isDetail = Boolean(activeId);
  document.body.classList.toggle("is-article-detail", isDetail);
  tabs.hidden = isDetail;
  if (isDetail) {
    const article = loadedArticles.find((item) => item.id === activeId || item.slug === activeId);
    if (!article && !articlesLoadCompleted) {
      root.innerHTML = '<div class="empty">文章載入中…</div>';
      return;
    }
    renderArticle(article);
  } else renderList(loadedArticles);
}

function publicationStatusMap(snapshot) {
  const statuses = {};
  snapshot.docs.forEach((item) => {
    const article = item.data() || {};
    if (article.systemType === "article-thumbnail-settings") return;
    statuses[item.id] = { status: article.status === "published" ? "published" : "draft", hidden: article.hidden === true, systemRecord: article.systemRecord === true };
  });
  return statuses;
}

async function writePublicationStatusIndex(statuses) {
  const indexRef = doc(db, "articleMetrics", ARTICLE_STATUS_INDEX_ID);
  const current = await getDoc(indexRef);
  if (!current.exists()) {
    await setDoc(indexRef, { articleId: ARTICLE_STATUS_INDEX_ID, views: 1, shares: 0, copies: 0, updatedAt: serverTimestamp() });
  }
  await setDoc(indexRef, { articleId: ARTICLE_STATUS_INDEX_ID, views: 0, shares: 0, copies: 0, statuses, updatedAt: serverTimestamp() }, { merge: true });
}

async function syncPublicationStatusIndexForAdmin() {
  if (!isAdminEmail(auth.currentUser?.email)) return false;
  const snapshot = await getDocs(collection(db, "articles"));
  await writePublicationStatusIndex(publicationStatusMap(snapshot));
  return true;
}

function withTimeout(promise, timeoutMs, label) {
  return Promise.race([promise, new Promise((_, reject) => window.setTimeout(() => reject(new Error(`${label}逾時`)), timeoutMs))]);
}

async function loadArticles() {
  const loadSerial = ++articlesLoadSerial;
  articlesLoadCompleted = false;
  renderTabs();
  const adminDraftPreview = adminPreviewEnabled();
  lastAdminPreviewState = adminDraftPreview;
  document.body.dataset.adminDraftPreview = adminDraftPreview ? "true" : "false";
  // 一般訪客只能查詢已發布文章；管理者登入時才讀取全部後台文章，以便在前台核對草稿版型。
  const articlesRequest = adminDraftPreview
    ? getDocs(collection(db, "articles"))
    : getDocs(query(collection(db, "articles"), where("status", "==", "published")));
  const statusRequest = getDoc(doc(db, "articleMetrics", ARTICLE_STATUS_INDEX_ID));
  const [articlesResult, statusResult] = await Promise.allSettled([withTimeout(articlesRequest, 8000, adminDraftPreview ? "管理者文章載入" : "已發布文章載入"), withTimeout(statusRequest, 8000, "文章狀態索引載入")]);
  if (articlesResult.status === "rejected") {
    if (loadSerial !== articlesLoadSerial) return;
    articlesLoadCompleted = true;
    loadedArticles = staticArticles
      .filter((article) => article?.status === "published" && article?.hidden !== true && article?.systemRecord !== true)
      .map((article) => ({ ...article, __articleSource: "static" }))
      .sort(sortPublished);
    console.warn(adminDraftPreview ? "Firebase 管理者文章暫時無法載入。" : "Firebase 已發布文章暫時無法載入。", articlesResult.reason);
    renderTabs();
    renderCurrentView();
    return;
  }
  if (loadSerial !== articlesLoadSerial) return;
  const firestoreArticles = articlesResult.value.docs
    .map((item) => ({ id: item.id, ...item.data(), __articleSource: "firestore", __firestoreId: item.id }))
    .filter((article) => article.hidden !== true && article.systemRecord !== true);
  const indexedStatuses = statusResult.status === "fulfilled" && statusResult.value.exists() ? statusResult.value.data().statuses || {} : {};
  const statusById = new Map(Object.entries(indexedStatuses));
  if (statusResult.status === "rejected") console.warn("文章狀態索引暫時無法載入。", statusResult.reason);
  const mergedById = new Map();
  staticArticles.forEach((article) => mergedById.set(article.id, { ...article, __articleSource: "static" }));
  firestoreArticles.forEach((article) => {
    const articleSlug = String(article.slug || "");
    const staticArticle = staticArticles.find((item) =>
      item.id === article.id
      || item.slug === article.id
      || (articleSlug && item.id === articleSlug)
      || (articleSlug && item.slug === articleSlug)
    );
    if (!staticArticle) {
      mergedById.set(article.id, article);
      return;
    }

    // Firestore 文件 ID 可能與網址代稱 slug 不同；只要 ID 或 slug 任一相同，都視為同一篇文章。
    // 以 GitHub 靜態文章的公開 ID 作為合併鍵，但正文、標題、狀態與圖片皆由後台 Firestore 覆蓋。
    const canonicalId = staticArticle.id || article.id;
    mergedById.delete(article.id);
    mergedById.set(canonicalId, {
      ...staticArticle,
      ...article,
      id: canonicalId,
      slug: article.slug || staticArticle.slug || canonicalId,
      __articleSource: "firestore"
    });
  });
  // Firestore 是文章後台的唯一權威來源：
  // 只要同一篇文章已有 Firestore 紀錄，前台一律使用後台儲存內容。
  // GitHub 靜態文章只作為「尚未匯入後台」文章的備援來源。
  const liveFirestoreIds = new Set(firestoreArticles.map((article) => article.id));
  statusById.forEach((status, articleId) => {
    if (!liveFirestoreIds.has(articleId) && (status.status !== "published" || status.hidden === true || status.systemRecord === true)) mergedById.delete(articleId);
  });
  refreshLimitedReadingDeadlines([...mergedById.values()]);
  const merged = [...mergedById.values()].filter((article) => {
    const published = article.status === "published";
    const adminDraft = adminDraftPreview && article.__articleSource === "firestore" && article.status === "draft";
    return (published || adminDraft)
      && article.hidden !== true
      && article.systemRecord !== true
      && article.systemType !== "article-thumbnail-settings"
      && article.id !== "__article-thumbnail-settings";
  });
  // 前台不再自行修補或覆寫任何已進 Firestore 的文章欄位。
  // 後台儲存什麼，前台就顯示什麼；GitHub 靜態稿僅供尚未匯入後台的文章使用。
  const normalizedArticles = merged.map((article) => article);
  const hydratedArticles = await Promise.all(normalizedArticles.map((article) => activeId && (article.id === activeId || article.slug === activeId) ? withTimeout(hydrateEventArticle(article), 8000, "活動文章權限確認").catch(() => article) : article));
  if (loadSerial !== articlesLoadSerial) return;
  loadedArticles = hydratedArticles.sort(sortPublished);
  articlesLoadCompleted = true;
  const activeArticleForWatch = activeId
    ? loadedArticles.find((item) => item.id === activeId || item.slug === activeId)
    : null;
  watchActiveFirestoreArticle(activeArticleForWatch);
  renderTabs();
  renderCurrentView();
  void loadArticleMetrics().then(() => loadedArticles.forEach((article) => updateMetricSummary(articleKey(article))));
}

// 首次載入統一交給 onAuthStateChanged。
 // 先確認登入身分再決定是否可讀取草稿，避免「公開文章查詢」與「管理者草稿查詢」互相覆蓋。
let lastVisibleRefreshAt = Date.now();
document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState !== "visible") return;
  const now = Date.now();
  if (now - lastVisibleRefreshAt < 1500) return;
  lastVisibleRefreshAt = now;
  try {
    await loadMemberAccess(auth.currentUser);
    await loadArticles();
  } catch (error) {
    console.error("重新確認會員資格失敗：", error);
    currentMemberAccess = null;
    renderCurrentView();
  }
});

let initialArticleBootstrapCompleted = false;

// 不等待 Auth 回呼，先用版本庫內的已發布文章完成首屏與文章內頁。
// Auth/Firestore 回應後，bootstrapArticles 會再以最新後台資料覆蓋。
loadedArticles.sort(sortPublished);
renderTabs();
renderCurrentView();

async function bootstrapArticles(user, source = "auth-state") {
  currentUser = user || null;
  try {
    await loadMemberAccess(currentUser);
    if (isAdminEmail(currentUser?.email)) {
      try {
        await syncPublicationStatusIndexForAdmin();
      } catch (error) {
        console.warn("文章狀態索引同步失敗。", error);
      }
    }
    // 登入、登出或切換帳號時都重新載入文章。
    // 這可確保管理者登出後，先前載入的草稿立即從前台記憶體移除。
    await loadArticles();
    initialArticleBootstrapCompleted = true;
    renderCurrentView();
  } catch (error) {
    console.error(`文選載入失敗（${source}）。`, error);
    if (!articlesLoadCompleted && root) {
      articlesLoadCompleted = true;
      root.innerHTML = '<div class="empty">文章載入失敗，請重新整理頁面後再試。</div>';
    }
  }
}

onAuthStateChanged(auth, (user) => {
  void bootstrapArticles(user, "auth-state");
});

// Edge／Safari 等瀏覽器直接進入文章網址時，Firebase Auth 的首次狀態回呼偶爾會延後。
// 若短時間內仍未完成首次載入，就以 auth.currentUser 當下狀態先啟動文章讀取；
// Auth 稍後恢復時，onAuthStateChanged 仍會再次刷新正確的會員／管理者內容。
window.setTimeout(() => {
  if (initialArticleBootstrapCompleted || articlesLoadCompleted) return;
  void bootstrapArticles(auth.currentUser, "auth-fallback");
}, 1200);

// 某些瀏覽器會先完成 Firebase 登入還原，再晚一拍通知此模組。
// 額外以 auth.currentUser 監看管理者狀態，避免導覽列已辨識管理者但文章核心仍停在公開模式。
let adminPreviewWatchTicks = 0;
const adminPreviewWatch = window.setInterval(() => {
  adminPreviewWatchTicks += 1;
  const nextState = adminPreviewEnabled();
  if (nextState !== lastAdminPreviewState) {
    lastAdminPreviewState = nextState;
    void loadArticles().catch((error) => console.warn("管理者草稿預覽重新載入失敗。", error));
  }
  if (adminPreviewWatchTicks >= 40) window.clearInterval(adminPreviewWatch);
}, 250);
