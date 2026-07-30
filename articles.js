import { auth, db, isAdminEmail } from "./firebase-config.js";
import { staticArticles } from "./static-articles.js?v=20260730-wealth-images-1";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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
const activeAccess = params.get("access") || "all";
const activeId = params.get("id") || "";
const memberMarker = "<!-- member-only -->";
const paidMarker = "<!-- paid-only -->";
const bookUrl = "https://lyyuan.tw/books.html?v=spiritual-books-20260703-refresh";
const limitedReadingDeadlines = new Map([
  ["japan-temple-faith-and-decline", Date.parse("2026-07-28T15:15:12.000Z")],
  ["shenming-yinlu-ganying-budengyu-xiuwei", Date.parse("2026-07-28T10:30:00.000Z")],
  ["good-fortune-believe-in-yourself-choices", Date.parse("2026-07-26T16:19:35.857Z")],
  ["jitong-shenming-fushen", Date.parse("2026-07-24T22:28:58.068Z")],
  ["market-crash-money-self-control", Date.parse("2026-07-24T01:00:00.000Z")]
]);
const articleGuides = {
  "japan-temple-faith-and-decline": {
    topics: ["信仰與人", "寺院興衰"],
    level: "深度",
    nextId: "spiritual-practice-cannot-be-outsourced-to-gods"
  },
  "shenming-yinlu-ganying-budengyu-xiuwei": {
    topics: ["感應與修為", "心性與界線"],
    level: "進階",
    nextId: "jitong-leader-discernment"
  },
  "jitong-leader-discernment": {
    topics: ["靈乩辨識", "權力與界線"],
    level: "深度",
    nextId: "tonglingren-wufa-huifu-putongren"
  },
  "jitong-discernment-before-exorcism": {
    topics: ["靈乩辨識", "靈擾與中邪"],
    level: "深度",
    nextId: "jitong-shenming-fushen"
  },
  "good-fortune-believe-in-yourself-choices": {
    topics: ["自我信任", "生命選擇"],
    level: "初識",
    nextId: "market-crash-money-self-control"
  },
  "yuanshen-awakening-eleven-principles": {
    topics: ["元神與人格", "靈能力"],
    level: "初識",
    nextId: "lingxiu-yuanshen-reality"
  },
  "seven-twenty-five-election-shift": {
    topics: ["社會觀察", "責任與選擇"],
    level: "初識",
    nextId: "market-crash-money-self-control"
  },
  "tonglingren-wufa-huifu-putongren": {
    topics: ["通靈辨識", "人格膨脹"],
    level: "進階",
    nextId: "jitong-shenming-fushen"
  },
  "lingxiu-zouhuo-rumo": {
    topics: ["修行偏差", "身心辨識"],
    level: "初識",
    nextId: "lingxiu-yuanshen-reality"
  },
  "lingxiu-yuanshen-reality": {
    topics: ["元神與人格", "修行責任"],
    level: "進階",
    nextId: "yuanshen-awakening-eleven-principles"
  },
  "jitong-shenming-fushen": {
    topics: ["通靈辨識", "乩身與神意"],
    level: "深度",
    nextId: "tonglingren-wufa-huifu-putongren"
  },
  "market-crash-money-self-control": {
    topics: ["財富與生命", "自我主導"],
    level: "初識",
    nextId: "good-fortune-believe-in-yourself-choices"
  }
};

const articleThumbnailImages = {
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
  "market-crash-money-self-control": "assets/articles/thumbnails/market-crash.jpg"
};

const articleHooks = {
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
let visibleArticleCount = window.matchMedia("(max-width: 760px)").matches ? 6 : 9;

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
      return `<p>${renderInline(trimmed).replace(/\n/g, "<br>")}</p>`;
    })
    .join("");
}

function getTimeValue(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value === "number") return value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function sortPublished(a, b) {
  const at = getTimeValue(a.publishedAt) || getTimeValue(a.updatedAt);
  const bt = getTimeValue(b.publishedAt) || getTimeValue(b.updatedAt);
  return bt - at;
}

function articleIsPaid(article = {}) {
  return article.accessType === "paid" || (article.content || "").includes(paidMarker);
}

function articleIsLimitedOpen(article = {}) {
  const key = articleKey(article);
  return articleIsPaid(article)
    && limitedReadingDeadlines.has(key)
    && Date.now() < limitedReadingDeadlines.get(key);
}

function articleAccess(article = {}) {
  return articleIsPaid(article) && !articleIsLimitedOpen(article) ? "paid" : "free";
}

function filterHref(access, category) {
  const next = new URLSearchParams();
  if (access && access !== "all") next.set("access", access);
  if (category) next.set("category", category);
  const queryString = next.toString();
  return queryString ? `articles.html?${queryString}` : "articles.html";
}

function renderTabs() {
  const accessItems = [
    ["all", "全部文章"],
    ["free", "免費閱讀"],
    ["paid", "贊助專屬"]
  ];
  const categoryItems = [["", "全部主題"], ...Object.entries(categoryLabels)];
  const counts = loadedArticles.reduce((result, article) => {
    result.all += 1;
    result[articleAccess(article)] += 1;
    return result;
  }, { all: 0, free: 0, paid: 0 });

  tabs.innerHTML = `
    <div class="article-filter-panel" id="article-filters">
      <div class="filter-heading">
        <strong>選擇想閱讀的文章</strong>
        <span>依閱讀方式或主題快速尋找</span>
      </div>
      <div class="filter-row access-filter" aria-label="閱讀方式">
        ${accessItems.map(([key, label]) => `
          <a class="${key === activeAccess ? "is-active" : ""}" href="${filterHref(key, activeCategory)}">
            ${label}<small>${counts[key]}</small>
          </a>
        `).join("")}
      </div>
      <div class="filter-row topic-filter" aria-label="文章主題">
        ${categoryItems.map(([key, label]) => `
          <a class="${key === activeCategory ? "is-active" : ""}" href="${filterHref(activeAccess, key)}">${label}</a>
        `).join("")}
      </div>
    </div>
  `;
}

function metricValue(articleId, key) {
  return Number(articleMetrics.get(articleId)?.[key] || 0);
}

function renderMetricSummary(articleId, compact = false) {
  const views = metricValue(articleId, "views");
  const shares = metricValue(articleId, "shares");
  const copies = metricValue(articleId, "copies");
  return `
    <div class="article-engagement${compact ? " is-compact" : ""}" data-metric-article="${escapeHtml(articleId)}">
      <span>閱讀 <b data-metric-value="views">${views.toLocaleString("zh-TW")}</b></span>
      <span>分享 <b data-metric-value="shares">${shares.toLocaleString("zh-TW")}</b></span>
      <span>複製 <b data-metric-value="copies">${copies.toLocaleString("zh-TW")}</b></span>
    </div>
  `;
}

function articleKey(article = {}) {
  return article.id || article.slug || "";
}

function getArticleGuide(article = {}) {
  return articleGuides[articleKey(article)] || {
    topics: Array.isArray(article.topics) ? article.topics : [],
    level: article.readingLevel || ""
  };
}

function getArticleThumbnail(article = {}) {
  return articleThumbnailImages[articleKey(article)] || article.coverImage || "";
}

function getArticleHook(article = {}) {
  return articleHooks[articleKey(article)] || article.excerpt || "";
}

function renderArticleGuide(article, compact = false) {
  const guide = getArticleGuide(article);
  if (!guide.topics.length && !guide.level) return "";
  return `
    <div class="article-guide${compact ? " is-compact" : ""}" aria-label="文章主題與閱讀程度">
      ${guide.topics.map((topic) => `<span class="article-topic">${escapeHtml(topic)}</span>`).join("")}
      ${guide.level ? `<span class="article-level">${escapeHtml(guide.level)}閱讀</span>` : ""}
    </div>
  `;
}

function renderNextReading(article) {
  const guide = getArticleGuide(article);
  if (!guide.nextId) return "";
  const nextArticle = loadedArticles.find((item) => articleKey(item) === guide.nextId);
  if (!nextArticle) return "";
  const nextGuide = getArticleGuide(nextArticle);
  return `
    <aside class="next-reading" aria-label="下一篇延伸閱讀">
      <div class="next-reading-eyebrow">沿著這個主題繼續閱讀</div>
      <a href="articles.html?id=${encodeURIComponent(articleKey(nextArticle))}">
        <strong>${escapeHtml(nextArticle.title || "下一篇文章")}</strong>
        ${nextGuide.topics.length ? `<span>${nextGuide.topics.map(escapeHtml).join("・")}</span>` : ""}
      </a>
    </aside>
  `;
}

function updateMetricSummary(articleId) {
  document.querySelectorAll(`[data-metric-article="${CSS.escape(articleId)}"]`).forEach((node) => {
    ["views", "shares", "copies"].forEach((key) => {
      const target = node.querySelector(`[data-metric-value="${key}"]`);
      if (target) target.textContent = metricValue(articleId, key).toLocaleString("zh-TW");
    });
  });
}

async function loadArticleMetrics() {
  try {
    const snapshot = await getDocs(collection(db, "articleMetrics"));
    articleMetrics = new Map(snapshot.docs.map((item) => [item.id, item.data()]));
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
    return matchesCategory && matchesAccess;
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
        const accessLabel = access === "paid" ? "贊助專屬" : articleIsLimitedOpen(article) ? "限時免費" : "免費閱讀";
        return `
          <a class="article-card" data-article-id="${escapeHtml(key)}" href="articles.html?id=${encodeURIComponent(key)}">
            <div class="article-card-media">
              ${getArticleThumbnail(article) ? `<img src="${escapeHtml(getArticleThumbnail(article))}" alt="" loading="lazy" decoding="async">` : '<div class="article-card-placeholder" aria-hidden="true">靈元院文選</div>'}
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
  if (accessType === "paid" && hasPaidAccess()) {
    return { publicContent: content.replace(paidMarker, ""), lockedContent: "", accessType: "open" };
  }
  if (accessType === "open") {
    return { publicContent: content, lockedContent: "", accessType };
  }
  const marker = accessType === "paid" ? paidMarker : memberMarker;
  const [publicContent, ...rest] = content.split(marker);
  return {
    publicContent: publicContent.trim(),
    lockedContent: rest.join(marker).trim(),
    accessType
  };
}

function hasPaidAccess() {
  if (isAdminEmail(currentUser?.email)) return true;
  if (!currentMemberAccess || currentMemberAccess.status !== "active") return false;
  const expiry = currentMemberAccess.expiresAt?.toDate?.()
    || (currentMemberAccess.expiresAt ? new Date(currentMemberAccess.expiresAt) : null);
  return Boolean(expiry && !Number.isNaN(expiry.getTime()) && expiry > new Date());
}

async function loadMemberAccess(user) {
  currentMemberAccess = null;
  if (!user?.email || isAdminEmail(user.email)) return;
  try {
    const email = user.email.trim().toLowerCase();
    const snapshot = await getDoc(doc(db, "memberAccess", email));
    if (snapshot.exists()) currentMemberAccess = snapshot.data();
  } catch (error) {
    console.warn("會員閱讀資格暫時無法確認。", error);
  }
}

function renderBookCta() {
  return `
    <div class="article-book-link-wrap">
      <a class="article-book-link" href="${bookUrl}">延伸閱讀｜宇色靈修著作</a>
    </div>
  `;
}

function renderSupportGate(lockedContent = "") {
  const preview = lockedContent.trim() || "更多宇色老師的靈修解析與生命觀察。";
  return `
    <section class="member-lock-zone" id="article-support-gate" aria-label="支持宇色老師">
      <div class="article-body member-lock-preview" aria-hidden="true">${renderContent(preview)}</div>
      <div class="member-lock-card article-support-card">
        <div class="member-lock-icon" aria-hidden="true">◇</div>
        <h3>文章未完，繼續閱讀</h3>
        <p>若這篇文章對你有所啟發，歡迎訂閱<br><span>YouTube、追蹤 Facebook，持續收到新的靈修解析。</span></p>
        <div class="article-support-actions">
          <a class="article-support-link youtube" href="https://www.youtube.com/@lyyuan03" target="_blank" rel="noopener noreferrer">訂閱 靈元院YouTube</a>
          <a class="article-support-link facebook" href="https://www.facebook.com/share/18zfvhPkBF/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer">追蹤 靈元院 Facebook</a>
        </div>
        <button id="article-continue-button" type="button">繼續閱讀全文</button>
        <div class="article-author-links" aria-label="宇色老師社群">
          <span>更多宇色老師</span>
          <a href="https://www.youtube.com/KINKIOSEL" target="_blank" rel="noopener noreferrer">影音</a>
          <i aria-hidden="true">·</i>
          <a href="https://www.facebook.com/authorosel/" target="_blank" rel="noopener noreferrer">文章</a>
        </div>
      </div>
    </section>
  `;
}

function renderPaidGate(article) {
  const subject = encodeURIComponent(`詢問付費閱讀｜${article.title || "靈元院文選"}`);
  const body = encodeURIComponent(`您好，我想詢問〈${article.title || "這篇文章"}〉的付費閱讀方式。`);
  return `
    <section class="member-lock-zone paid-lock-zone" aria-label="贊助會員專屬">
      <div class="paid-lock-preview" aria-hidden="true">
        <span></span><span></span><span></span><span></span><span></span><span></span>
      </div>
      <div class="member-lock-card paid-lock-card">
        <div class="member-lock-icon" aria-hidden="true">◇</div>
        <h3>本文為贊助會員專屬</h3>
        <p>本篇目前僅開放前段試閱。若希望閱讀全文，歡迎聯繫靈元院，了解贊助會員開放方式。</p>
        <div class="paid-inquiry-actions">
          <button class="paid-inquiry-primary" id="article-member-login-button" type="button">${currentUser ? "重新確認會員資格" : "會員登入"}</button>
          <a class="paid-inquiry-primary" href="https://t.me/lyyuan" target="_blank" rel="noopener noreferrer">詢問贊助閱讀方式</a>
          <a class="paid-inquiry-secondary" href="mailto:lyyuan03@gmail.com?subject=${subject}&body=${body}">使用 Email 詢問</a>
        </div>
        <small>完整內容不會在本頁直接展開</small>
      </div>
    </section>
  `;
}

function bindPaidLogin() {
  document.getElementById("article-member-login-button")?.addEventListener("click", () => {
    document.getElementById("member-login-button")?.click();
  });
}

function bindArticleContinue() {
  const button = document.getElementById("article-continue-button");
  const gate = document.getElementById("article-support-gate");
  const remaining = document.getElementById("article-remaining-content");
  if (!button || !gate || !remaining) return;
  button.addEventListener("click", () => {
    gate.remove();
    remaining.hidden = false;
    remaining.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function renderArticleShare(article) {
  const articleKey = article.id || article.slug || activeId;
  const shareUrl = article.sharePath
    ? new URL(article.sharePath, `${location.origin}/`).href
    : `${location.origin}${location.pathname}?id=${encodeURIComponent(articleKey)}`;
  const shareTitle = article.title || "靈元院文選";
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(shareTitle);
  return `
    <div class="article-share" aria-label="靈元院社群平台">
      <a class="article-social-facebook" data-share-metric="true" href="https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}" target="_blank" rel="noopener noreferrer" aria-label="分享到 Facebook" title="分享到 Facebook">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 8h3V4.4c-.5-.1-2.1-.2-4-.2-3.9 0-6.6 2.4-6.6 6.8v3.8H2v4h4.4V24h5.4v-5.2h4.5l.7-4h-5.2v-3.4C11.8 9.8 12.2 8 14 8Z" fill="currentColor"/></svg>
      </a>
      <a class="article-social-instagram" href="https://www.instagram.com/lyyuan03/" target="_blank" rel="noopener noreferrer" aria-label="前往靈元院 Instagram" title="靈元院 Instagram">
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="17.4" cy="6.7" r="1.1" fill="currentColor"/></svg>
      </a>
      <a class="article-share-line" data-share-metric="true" href="https://social-plugins.line.me/lineit/share?url=${encodedUrl}&text=${encodedTitle}" target="_blank" rel="noopener noreferrer" aria-label="分享到 LINE" title="分享到 LINE">
        <span class="article-line-mark" aria-hidden="true">LINE</span>
      </a>
      <a class="article-share-telegram" data-share-metric="true" href="https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}" target="_blank" rel="noopener noreferrer" aria-label="分享到 Telegram" title="分享到 Telegram">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.5 3.3 18.4 20c-.2 1.2-.9 1.5-1.9.9l-4.7-3.5-2.3 2.2c-.2.3-.5.5-1 .5l.4-4.8 8.7-7.9c.4-.3-.1-.5-.6-.2L6.2 14 1.6 12.5c-1-.3-1-1 .2-1.5L20 4c.8-.3 1.6.2 1.5 1.3Z" fill="currentColor"/></svg>
      </a>
      <a class="article-share-email" data-share-metric="true" href="mailto:?subject=${encodedTitle}&body=${encodeURIComponent(`${shareTitle}\n\n${shareUrl}`)}" aria-label="使用 Email 分享" title="使用 Email 分享">
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.8" y="5.2" width="18.4" height="13.6" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m4 7 8 6 8-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </a>
      <button class="article-share-copy" type="button" data-share-url="${escapeHtml(shareUrl)}" aria-label="複製文章連結" title="複製文章連結">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 8V6a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-2M6 9h6a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3Z" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>
      </button>
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
  const { publicContent, lockedContent, accessType } = splitMemberContent(article.content || "", articleKey);
  root.innerHTML = `
    <article class="article-view">
      <a class="article-back" href="articles.html">← 返回全部文選</a>
      <div class="article-meta">${categoryLabels[article.category] || "文選"}</div>
      <h2>${escapeHtml(article.title || "未命名文章")}</h2>
      ${renderArticleGuide(article)}
      ${renderLimitedReadingCountdown(article.id || article.slug || activeId, (article.content || "").includes(paidMarker))}
      ${article.coverImage ? `<img class="article-cover" src="${escapeHtml(article.coverImage)}" alt="">` : ""}
      <div class="article-body">${renderContent(publicContent)}</div>
      ${accessType === "member" ? renderSupportGate(lockedContent) : ""}
      ${accessType === "paid" ? renderPaidGate(article) : ""}
      ${accessType === "member" ? `<div class="article-body" id="article-remaining-content" hidden>${renderContent(lockedContent)}</div>` : ""}
      ${renderNextReading(article)}
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

async function loadArticles() {
  renderTabs();
  let articles = [];
  try {
    const publishedQuery = query(collection(db, "articles"), where("status", "==", "published"));
    const snapshot = await getDocs(publishedQuery);
    articles = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .sort(sortPublished);
  } catch (error) {
    console.warn("Firebase 文章暫時無法載入，改顯示靜態文章。", error);
  }
  const merged = [...staticArticles, ...articles].reduce((items, article) => {
    if (!items.some((item) => item.id === article.id)) items.push(article);
    return items;
  }, []);
  loadedArticles = merged.sort(sortPublished);
  renderTabs();
  await loadArticleMetrics();

  renderCurrentView();
}

loadArticles().catch((error) => {
  console.error(error);
  root.innerHTML = '<div class="empty">文章暫時無法載入，請稍後再試。</div>';
});

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  await loadMemberAccess(user);
  if (loadedArticles.length) renderCurrentView();
});
