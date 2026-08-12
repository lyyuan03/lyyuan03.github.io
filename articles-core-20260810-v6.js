import { auth, db, isAdminEmail } from "./firebase-config.js";
import { staticArticles } from "./static-articles.js?v=20260812-2058-fallback-1";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, setDoc, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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
const standaloneArticlePaths = new Map([["this-book-took-thirty-years", "/article/this-book-took-thirty-years-v5.html"]]);
if (standaloneArticlePaths.has(activeId)) location.replace(standaloneArticlePaths.get(activeId));
const magicToken = params.get("token") || "";
const magicEventId = params.get("event") || "";
const memberMarker = "<!-- member-only -->";
const paidMarker = "<!-- paid-only -->";
const bookUrl = "https://lyyuan.tw/books.html?v=spiritual-books-20260703-refresh";
// 限時免費 deadline 已全部過期（2026-07 月底），清空後這些文章固定以贊助專屬運作。
// 若未來需要再開放限時免費，直接在此 Map 新增 [文章ID, Date.parse("...Z")] 即可。
const limitedReadingDeadlines = new Map();
const ARTICLE_STATUS_INDEX_ID = "__article-publication-status";
// 這篇已由 Firestore 後台接管；索引首次建立前也不得退回顯示靜態 published 版本。
const LEGACY_FIRESTORE_MANAGED_IDS = new Set(["yuanshen-destiny-archetype"]);
const articleGuides = {
  "2058-future-person-prophecy": {
    topics: ["靈修辨識", "修行心性"],
    level: "深度",
    nextId: "lingxiu-yuanshen-reality"
  },
  "this-book-took-thirty-years": {
    topics: ["元神與人格", "修行心性"],
    level: "深度",
    nextId: "yuanshen-destiny-archetype"
  },
  "wealth-as-water": {
    topics: ["金錢意識", "自我信任"],
    level: "深度",
    nextId: "market-crash-money-self-control"
  },
  "fantasy-intuition-or-yuanshen": {
    topics: ["靈修辨識", "元神與人格"],
    level: "深度",
    nextId: "yuanshen-awakening-eleven-principles"
  },
  "spiritual-practice-cannot-be-outsourced-to-gods": {
    topics: ["神明與修行"],
    level: "初識",
    nextId: "jitong-leader-discernment"
  },
  "celebrity-death-dream-spirit-five-checks": {
    topics: ["亡者接觸", "靈界辨識"],
    level: "深度",
    nextId: "tonglingren-wufa-huifu-putongren"
  },
  "japan-temple-faith-and-decline": {
    topics: ["信仰與人"],
    level: "深度",
    nextId: "spiritual-practice-cannot-be-outsourced-to-gods"
  },
  "shenming-yinlu-ganying-budengyu-xiuwei": {
    topics: ["感應與修為", "修行心性"],
    level: "進階",
    nextId: "jitong-leader-discernment"
  },
  "jitong-leader-discernment": {
    topics: ["靈乩辨識", "權力與界線"],
    level: "深度",
    nextId: "tonglingren-wufa-huifu-putongren"
  },
  "jitong-discernment-before-exorcism": {
    topics: ["靈乩辨識", "靈界辨識"],
    level: "深度",
    nextId: "jitong-shenming-fushen"
  },
  "good-fortune-believe-in-yourself-choices": {
    topics: ["自我信任", "生命選擇"],
    level: "初識",
    nextId: "market-crash-money-self-control"
  },
  "yuanshen-awakening-eleven-principles": {
    topics: ["元神與人格", "感應與修為"],
    level: "初識",
    nextId: "lingxiu-yuanshen-reality"
  },
  "seven-twenty-five-election-shift": {
    topics: ["社會觀察"],
    level: "初識",
    nextId: "market-crash-money-self-control"
  },
  "tonglingren-wufa-huifu-putongren": {
    topics: ["靈修辨識", "修行心性"],
    level: "進階",
    nextId: "jitong-shenming-fushen"
  },
  "lingxiu-zouhuo-rumo": {
    topics: ["靈修辨識"],
    level: "初識",
    nextId: "lingxiu-yuanshen-reality"
  },
  "lingxiu-yuanshen-reality": {
    topics: ["元神與人格", "修行心性"],
    level: "進階",
    nextId: "yuanshen-awakening-eleven-principles"
  },
  "jitong-shenming-fushen": {
    topics: ["靈修辨識", "感應與修為"],
    level: "深度",
    nextId: "tonglingren-wufa-huifu-putongren"
  },
  "wealth-discipline-investing-and-self-mastery": {
    topics: ["財富"],
    sourceTag: "宇色著作",
    level: "初識",
    nextId: "market-crash-money-self-control"
  },
  "market-crash-money-self-control": {
    topics: ["金錢意識", "生命選擇"],
    level: "初識",
    nextId: "good-fortune-believe-in-yourself-choices"
  }
};

const articleThumbnailImages = {
  "2058-future-person-prophecy": "assets/articles/2058-future-person-prophecy/thumbnail.webp?v=20260812-2",
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

let loadedArticles = [];
let articleMetrics = new Map();
let currentUser = null;
let currentMemberAccess = null;
let currentSponsorAccess = null;
let visibleArticleCount = window.matchMedia("(max-width: 760px)").matches ? 6 : 9;

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

function renderInline(value = "") {
  return escapeHtml(value).replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1">');
}

function renderContent(value = "") {
  return value
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
  return article?.accessType === "event" || Boolean(article?.eventId);
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
  return articleThumbnailImages[articleKey(article)] || article?.thumbnailImage || article?.coverImage || "";
}

function getArticleHook(article) {
  return articleHooks[articleKey(article)] || article?.excerpt || "";
}

function getArticleGuide(article) {
  const key = articleKey(article);
  return articleGuides[key] || {
    topics: Array.isArray(article?.topics) ? article.topics.slice(0, 2) : [],
    level: article?.readingLevel || ""
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

function sortPublished(a, b) {
  return Date.parse(b.publishedAt || b.updatedAt || 0) - Date.parse(a.publishedAt || a.updatedAt || 0);
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
      node.textContent = `限時閱讀｜${hours}：${minutes}：${seconds}`;
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
  root.innerHTML = `
    <div class="article-result-summary">
      <span>共 ${filtered.length} 篇文章</span>
      <a href="#article-filters">重新選擇分類</a>
    </div>
    <div class="article-grid">
      ${visibleArticles.map((article) => {
        const key = articleKey(article);
        const access = articleAccess(article);
        const accessLabel = access === "event" ? "活動限定" : access === "paid" ? "贊助專屬" : articleIsLimitedOpen(article) ? "限時免費" : "免費閱讀";
        return `
          <a class="article-card" data-article-id="${escapeHtml(key)}" href="${standaloneArticlePaths.get(key) || `articles.html?id=${encodeURIComponent(key)}`}${magicToken ? `&event=${encodeURIComponent(article.eventId || magicEventId)}&token=${encodeURIComponent(magicToken)}` : ""}">
            <div class="article-card-media">
              ${getArticleThumbnail(article) ? `<img src="${escapeHtml(getArticleThumbnail(article))}" alt="${escapeHtml(article.title || "靈元院文選")}" loading="lazy" decoding="async">` : '<div class="article-card-placeholder" aria-hidden="true">靈元院文選</div>'}
              <div class="article-card-media-gradient" aria-hidden="true"></div>
            </div>
            <div class="article-card-content">
              <div class="article-card-heading">
                <div class="article-meta">${categoryLabels[article.category] || "文選"}</div>
                <span class="article-access-badge is-${access}">${accessLabel}</span>
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
  if (accessType === "paid" && hasPaidAccess(articleId)) {
    return { publicContent: content.replace(paidMarker, ""), lockedContent: "", accessType: "open" };
  }
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
  if (Number(record.accessVersion || 0) < 2 || !String(record.lastOrderNo || "").trim()) return false;
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
  if (isAdminEmail(currentUser?.email)) return true;
  if (!currentUser?.email || !currentSponsorAccess) return false;

  const userEmail = currentUser.email.trim().toLowerCase();
  const directAccess = hasDirectSponsorAccess(currentSponsorAccess, userEmail);
  const wellnessAccess = hasWellnessArticleBenefit(currentSponsorAccess, currentMemberAccess, userEmail);
  if (!directAccess && !wellnessAccess) return false;

  const entitlement = directAccess ? currentSponsorAccess : currentSponsorAccess.wellnessBenefit;
  const deniedArticleIds = Array.isArray(entitlement.deniedArticleIds)
    ? entitlement.deniedArticleIds.map(String)
    : [];
  if (articleId && deniedArticleIds.includes(String(articleId))) return false;

  const allowedArticleIds = Array.isArray(entitlement.allowedArticleIds)
    ? entitlement.allowedArticleIds.map(String)
    : [];
  if (allowedArticleIds.length > 0 && (!articleId || !allowedArticleIds.includes(String(articleId)))) return false;

  return true;
}

async function loadMemberAccess(user) {
  currentMemberAccess = null;
  currentSponsorAccess = null;
  if (!user?.email || isAdminEmail(user.email)) return;
  try {
    const email = user.email.trim().toLowerCase();
    const [memberSnapshot, sponsorSnapshot] = await Promise.all([
      withTimeout(getDoc(doc(db, "memberAccess", email)), 8000, "一般會員資格載入"),
      withTimeout(getDoc(doc(db, "sponsorMemberAccess", email)), 8000, "贊助會員資格載入")
    ]);

    if (memberSnapshot.exists()) {
      const record = memberSnapshot.data() || {};
      const recordEmail = String(record.email || memberSnapshot.id || "").trim().toLowerCase();
      if (recordEmail === email) currentMemberAccess = { ...record, email: recordEmail };
      else console.warn("一般會員資料 Email 與登入帳號不一致，已拒絕載入。");
    }

    if (sponsorSnapshot.exists()) {
      const record = sponsorSnapshot.data() || {};
      const recordEmail = String(record.email || sponsorSnapshot.id || "").trim().toLowerCase();
      if (recordEmail === email) currentSponsorAccess = { ...record, email: recordEmail };
      else console.warn("贊助會員資料 Email 與登入帳號不一致，已拒絕授權。");
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
  if (isAdminEmail(currentUser?.email)) {
    const snapshot = await getDoc(doc(db, "membershipSettings", "eventArticleKeys"));
    return snapshot.exists() ? snapshot.data().keys?.[key] || "" : "";
  }
  if (currentMemberAccess?.eventAccess?.[article.eventId]?.status !== "active") return "";
  return currentMemberAccess?.eventArticleKeys?.[key] || "";
}

async function hydrateEventArticle(article) {
  if (!articleIsEvent(article)) return article;
  if (!currentUser && !magicToken) return article;
  const key = await eventArticleKey(article);
  if (!key) return article;
  try {
    const content = await decryptEventContent(article.encryptedContent, article.contentIv, key);
    return { ...article, content, eventAccessGranted: true };
  } catch (error) {
    console.warn("活動限定文章解密失敗。", error);
    return article;
  }
}

function renderSupportGate(lockedContent) {
  if (!lockedContent) return "";
  return `
    <section class="article-support-gate" aria-label="繼續閱讀全文">
      <div class="article-support-preview" aria-hidden="true">${renderContent(lockedContent)}</div>
      <div class="article-support-card">
        <strong>文章未完，繼續閱讀</strong>
        <p>若這篇文章對你有所啟發，歡迎訂閱 YouTube、追蹤 Facebook，持續收到新的靈修解析。</p>
        <div class="article-support-actions">
          <a href="https://www.youtube.com/@lyyuan03" target="_blank" rel="noopener noreferrer">訂閱 靈元院YouTube</a>
          <a href="https://www.facebook.com/share/18zfvhPkBF/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer">追蹤 靈元院 Facebook</a>
        </div>
        <button class="article-continue" type="button">繼續閱讀全文</button>
      </div>
    </section>
  `;
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

function bindPaidLogin() {
  document.querySelector(".article-paid-login")?.addEventListener("click", () => {
    document.getElementById("member-login-button")?.click();
  });
}

function renderEventGate(article) {
  return `<section class="article-paid-gate"><strong>活動限定文章</strong><p>此篇僅提供指定活動參與者閱讀。</p></section>`;
}

function bindEventLogin() {}

function renderRecommendedBook(article) {
  if (!article.bookTitle) return "";
  const url = article.bookPurchaseUrl || bookUrl;
  return `<aside class="recommended-book"><div><small>延伸閱讀</small><strong>${escapeHtml(article.bookTitle)}</strong><span>${escapeHtml(article.bookAuthor || "")}${article.bookPublisher ? `｜${escapeHtml(article.bookPublisher)}` : ""}</span></div><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">查看著作</a></aside>`;
}

function renderBookCta() {
  return `<div class="article-book-link-wrap"><a class="article-book-link" href="${bookUrl}" target="_blank" rel="noopener noreferrer">延伸閱讀｜宇色靈修著作</a></div>`;
}

function renderNextReading(article) {
  const guide = getArticleGuide(article);
  const nextId = guide.nextId;
  if (!nextId) return "";
  const target = loadedArticles.find((item) => articleKey(item) === nextId);
  if (!target) return "";
  return `<aside class="next-reading"><div class="next-reading-eyebrow">沿著這個主題繼續閱讀</div><a href="articles.html?id=${encodeURIComponent(nextId)}"><strong>${escapeHtml(target.title || "延伸閱讀")}</strong><span>${escapeHtml((getArticleGuide(target).topics || []).join("・"))}</span></a></aside>`;
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
  return `
    <div class="article-share" aria-label="文章分享">
      ${renderMetricSummary(articleId)}
      <div class="article-share-actions">
        <a class="article-share-icon facebook" href="https://www.facebook.com/share/18zfvhPkBF/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer" aria-label="前往靈元院 Facebook" title="Facebook">f</a>
        <a class="article-share-icon instagram" href="https://www.instagram.com/lyyuan03/" target="_blank" rel="noopener noreferrer" aria-label="前往靈元院 Instagram" title="Instagram">◎</a>
        <a class="article-share-icon line" data-share-metric href="https://social-plugins.line.me/lineit/share?url=${encodedUrl}" target="_blank" rel="noopener noreferrer" aria-label="分享到 LINE" title="LINE">L</a>
        <a class="article-share-icon telegram" data-share-metric href="https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}" target="_blank" rel="noopener noreferrer" aria-label="分享到 Telegram" title="Telegram">T</a>
        <a class="article-share-icon email" data-share-metric href="mailto:?subject=${encodedTitle}&body=${encodedText}" aria-label="用 Email 分享" title="Email">@</a>
        <button class="article-share-icon copy article-share-copy" type="button" data-share-url="${escapeHtml(shareUrl)}" aria-label="複製文章連結" title="複製連結">⧉</button>
      </div>
      <span class="article-share-status" role="status" aria-live="polite"></span>
    </div>
  `;
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
  document.querySelectorAll("[data-share-metric]").forEach((link) => {
    link.addEventListener("click", () => incrementArticleMetric(articleId, "shares"));
  });
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
    headings.forEach((heading, index) => {
      heading.id = `article-section-${index + 1}`;
    });
    const toc = document.createElement("aside");
    toc.className = "article-toc";
    toc.setAttribute("aria-label", "文章章節");
    toc.setAttribute("role", "navigation");
    toc.innerHTML = `
      <button class="article-toc-toggle" type="button" aria-expanded="false">
        <span>文章章節</span><small>共 ${headings.length} 節</small>
      </button>
      <ol>
        ${headings.map((heading) => `<li class="${heading.tagName === "H3" ? "is-sub" : ""}"><a href="#${heading.id}">${escapeHtml(heading.textContent.trim())}</a></li>`).join("")}
      </ol>
    `;
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

  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    requestAnimationFrame(() => article.classList.add("is-ready"));
  } else {
    article.classList.add("is-ready");
  }
}

function renderArticle(article) {
  if (!article) {
    root.innerHTML = '<div class="empty">找不到這篇文章，或文章尚未發布。</div>';
    return;
  }
  document.title = `${article.title}｜靈元院文選`;
  const articleKey = article.id || article.slug || activeId;
  if (articleIsEvent(article) && !article.eventAccessGranted) {
    root.innerHTML = `
      <article class="article-view" data-article-id="${escapeHtml(articleKey)}">
        <a class="article-back" href="articles.html">← 返回全部文選</a>
        <div class="article-meta">${categoryLabels[article.category] || "文選"}｜活動限定</div>
        <h2>${escapeHtml(article.title || "未命名文章")}</h2>
        ${article.coverImage ? `<img class="article-cover" src="${escapeHtml(article.coverImage)}" alt="">` : ""}
        ${article.excerpt ? `<div class="article-body"><p>${escapeHtml(article.excerpt)}</p></div>` : ""}
        ${renderEventGate(article)}
      </article>
    `;
    bindEventLogin();
    return;
  }
  const articleContent = addGuanyinVowLampImages(article.content || "", articleKey);
  const { publicContent, lockedContent, accessType } = splitMemberContent(articleContent, articleKey);
  root.innerHTML = `
    <article class="article-view" data-article-id="${escapeHtml(articleKey)}">
      <a class="article-back" href="articles.html">← 返回全部文選</a>
      <div class="article-meta">${categoryLabels[article.category] || "文選"}</div>
      <h2>${escapeHtml(article.title || "未命名文章")}</h2>
      ${renderArticleGuide(article)}
      ${renderLimitedReadingCountdown(article.id || article.slug || activeId, articleContent.includes(paidMarker))}
      ${article.coverImage ? `<img class="article-cover" src="${escapeHtml(article.coverImage)}" alt=""${["wealth-discipline-investing-and-self-mastery", "reading-you-can-not-fear-death"].includes(articleKey) ? ' style="max-height:none;height:auto;object-fit:contain;object-position:center"' : ""}>` : ""}
      <div class="article-body">${renderContent(publicContent)}</div>
      ${accessType === "member" ? renderSupportGate(lockedContent) : ""}
      ${accessType === "paid" ? renderPaidGate(article) : ""}
      ${accessType === "member" ? `<div class="article-body" id="article-remaining-content" hidden>${renderContent(lockedContent)}</div>` : ""}
      ${renderNextReading(article)}
      ${renderRecommendedBook(article)}
      ${renderBookCta()}
      ${renderArticleShare(article)}
    </article>
  `;
  bindLimitedReadingCountdowns();
  if (accessType === "member") bindArticleContinue();
  if (accessType === "paid") bindPaidLogin();
  bindArticleShare(articleKey);
  bindArticleExperience();
  trackArticleView(articleKey);
}

function renderCurrentView() {
  const isDetail = Boolean(activeId);
  document.body.classList.toggle("is-article-detail", isDetail);
  tabs.hidden = isDetail;
  if (isDetail) {
    renderArticle(loadedArticles.find((article) => article.id === activeId || article.slug === activeId));
  } else {
    renderList(loadedArticles);
  }
}

function publicationStatusMap(snapshot) {
  const statuses = {};
  snapshot.docs.forEach((item) => {
    const article = item.data() || {};
    if (article.systemType === "article-thumbnail-settings") return;
    statuses[item.id] = {
      status: article.status === "published" ? "published" : "draft",
      hidden: article.hidden === true,
      systemRecord: article.systemRecord === true
    };
  });
  return statuses;
}

async function writePublicationStatusIndex(statuses) {
  const indexRef = doc(db, "articleMetrics", ARTICLE_STATUS_INDEX_ID);
  const current = await getDoc(indexRef);
  if (!current.exists()) {
    await setDoc(indexRef, {
      articleId: ARTICLE_STATUS_INDEX_ID,
      views: 1,
      shares: 0,
      copies: 0,
      updatedAt: serverTimestamp()
    });
  }
  await setDoc(indexRef, {
    articleId: ARTICLE_STATUS_INDEX_ID,
    views: 0,
    shares: 0,
    copies: 0,
    statuses,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

async function syncPublicationStatusIndexForAdmin() {
  if (!isAdminEmail(auth.currentUser?.email)) return false;
  const snapshot = await getDocs(collection(db, "articles"));
  await writePublicationStatusIndex(publicationStatusMap(snapshot));
  return true;
}

function withTimeout(promise, timeoutMs, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error(`${label}逾時`)), timeoutMs);
    })
  ]);
}

async function loadArticles() {
  renderTabs();

  // 詳細文章若已有正式發布的靜態版本，先立即顯示，不等待任何遠端查詢。
  // Firestore 完成後仍會重新核對發布狀態與會員權限並更新畫面。
  if (activeId) {
    const immediateArticle = staticArticles.find((article) =>
      (article.id === activeId || article.slug === activeId)
      && article.status === "published"
      && article.hidden !== true
      && article.systemRecord !== true
      && !LEGACY_FIRESTORE_MANAGED_IDS.has(article.id)
    );
    if (immediateArticle) renderArticle(immediateArticle);
  }

  const publishedRequest = getDocs(
    query(collection(db, "articles"), where("status", "==", "published"))
  );
  const statusRequest = getDoc(doc(db, "articleMetrics", ARTICLE_STATUS_INDEX_ID));
  const [publishedResult, statusResult] = await Promise.allSettled([
    withTimeout(publishedRequest, 8000, "已發布文章載入"),
    withTimeout(statusRequest, 8000, "文章狀態索引載入")
  ]);

  const firestoreArticles = publishedResult.status === "fulfilled"
    ? publishedResult.value.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .filter((article) => article.hidden !== true && article.systemRecord !== true)
    : [];
  if (publishedResult.status === "rejected") {
    console.warn("Firebase 已發布文章暫時無法載入，改顯示靜態文章。", publishedResult.reason);
  }

  const indexedStatuses = statusResult.status === "fulfilled" && statusResult.value.exists()
    ? statusResult.value.data().statuses || {}
    : {};
  const statusById = new Map(Object.entries(indexedStatuses));
  if (statusResult.status === "rejected") {
    console.warn("文章狀態索引暫時無法載入。", statusResult.reason);
  }

  const mergedById = new Map();
  const firestorePublishedIds = new Set(firestoreArticles.map((article) => article.id));
  staticArticles.forEach((article) => {
    const managedByFirestore = statusById.has(article.id) || LEGACY_FIRESTORE_MANAGED_IDS.has(article.id);
    const indexedStatus = statusById.get(article.id);
    const allow2058PublishedFallback = article.id === "2058-future-person-prophecy"
      && !firestorePublishedIds.has(article.id)
      && indexedStatus?.status !== "draft"
      && indexedStatus?.hidden !== true
      && indexedStatus?.systemRecord !== true;
    if (!managedByFirestore || allow2058PublishedFallback) mergedById.set(article.id, article);
  });
  firestoreArticles.forEach((article) => mergedById.set(article.id, article));
  statusById.forEach((status, articleId) => {
    if (status.status !== "published" || status.hidden === true || status.systemRecord === true) {
      mergedById.delete(articleId);
    }
  });
  const merged = [...mergedById.values()].filter((article) =>
    article.status === "published"
    && article.hidden !== true
    && article.systemRecord !== true
  );
  const normalizedArticles = merged.map((article) => {
    if (article.id === "yuanshen-destiny-archetype") {
      let fixedContent = String(article.content || "")
        .replace(/stone-origin\.(?:svg|jpg)(?:\?[^)\s"']*)?/g, "stone-origin.jpg?v=20260808-final-images-2")
        .replace(/roc-awakening\.(?:svg|jpg)(?:\?[^)\s"']*)?/g, "roc-awakening.jpg?v=20260808-final-images-2")
        .replace(/nine-tailed-bird\.(?:svg|jpg)(?:\?[^)\s"']*)?/g, "nine-tailed-bird.jpg?v=20260808-final-images-2");
      const imageSections = [
        ["## 天庭巨石所化的元神", "stone-origin.jpg", "![天庭巨石所化的元神](assets/articles/yuanshen-destiny-archetype/stone-origin.jpg?v=20260808-final-images-2)"],
        ["## 大鵬鳥元神──與岳飛的奇妙連結", "roc-awakening.jpg", "![大鵬鳥元神](assets/articles/yuanshen-destiny-archetype/roc-awakening.jpg?v=20260808-final-images-2)"],
        ["## 九尾七彩神鳥──活在天命裡而不自知", "nine-tailed-bird.jpg", "![九尾七彩神鳥元神](assets/articles/yuanshen-destiny-archetype/nine-tailed-bird.jpg?v=20260808-final-images-2)"],
      ];
      imageSections.forEach(([heading, filename, markdown]) => {
        if (fixedContent.includes(heading) && !fixedContent.includes(filename)) {
          fixedContent = fixedContent.replace(`${heading}\n\n`, `${heading}\n\n${markdown}\n\n`);
        }
      });
      return {
        ...article,
        coverImage: "assets/articles/yuanshen-destiny-archetype/book-cover.jpg?v=20260808-final-images-2",
        content: fixedContent,
      };
    }
    if (article.id === "2058-future-person-prophecy") {
      const fixedContent = String(article.content || "")
        .replace(/verification\.svg(?:\?[^)\s"']*)?/g, "verification.webp?v=20260812-2")
        .replace(/consciousness-network\.svg(?:\?[^)\s"']*)?/g, "consciousness-network.webp?v=20260812-2");
      return {
        ...article,
        content: fixedContent,
        coverImage: "assets/articles/2058-future-person-prophecy/cover.webp?v=20260812-2",
        thumbnailImage: "assets/articles/2058-future-person-prophecy/thumbnail.webp?v=20260812-2",
        bookTitle: "喚醒天生好命",
        bookAuthor: "宇色Osel",
        bookPublisher: "高寶",
        bookPurchaseUrl: "https://www.books.com.tw/products/0011003625?loc=P_br_r0vq68ygz_D_2aabd0_B_1"
      };
    }
    if (article.id === "celebrity-death-dream-spirit-five-checks") {
      return { ...article, bookPurchaseUrl: "https://www.books.com.tw/products/0011029318?loc=P_0005_053" };
    }
    return article;
  });
  const hydratedArticles = await Promise.all(normalizedArticles.map((article) =>
    activeId && (article.id === activeId || article.slug === activeId)
      ? withTimeout(hydrateEventArticle(article), 8000, "活動文章權限確認").catch((error) => {
          console.warn("活動文章權限確認逾時，先顯示原始文章狀態。", error);
          return article;
        })
      : article
  ));
  loadedArticles = hydratedArticles.sort(sortPublished);
  renderTabs();

  renderCurrentView();
  void loadArticleMetrics().then(() => {
    loadedArticles.forEach((article) => updateMetricSummary(articleKey(article)));
  });
}

loadArticles().catch((error) => {
  console.error(error);
  root.innerHTML = '<div class="empty">文章暫時無法載入，請稍後再試。</div>';
});

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

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  await loadMemberAccess(user);
  if (isAdminEmail(user?.email)) {
    try {
      if (await syncPublicationStatusIndexForAdmin()) await loadArticles();
    } catch (error) {
      console.warn("文章狀態索引同步失敗。", error);
    }
  }
});
