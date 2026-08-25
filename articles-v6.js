// Article render event deployment marker: 20260825-article-render-event-1
const articleRoot = document.getElementById("article-root");
const ARTICLE_RENDERED_EVENT = "lyyuan:article-rendered";
const activeArticleId = new URLSearchParams(location.search).get("id") || "";

const CONSTRUCTION_TITLE_OVERRIDES = new Map([
  ["2026-building-patron-record", "靈元院建院願心見證專頁－丙午建院功德主專屬"],
  ["2026-lineage-lamp-building-record", "靈元院建院願心見證專頁"]
]);

const DRAGON_CHANT_ARTICLE_ID = "dragon-chant-youtube-awakening";
const DRAGON_CHANT_TITLE = "元神所吟唱的靈音——它喚醒了一個人沉睡千年的元神";

function applyConstructionTitleOverrides() {
  const activeId = new URLSearchParams(location.search).get("id") || "";
  const activeTitle = CONSTRUCTION_TITLE_OVERRIDES.get(activeId);

  if (activeTitle) {
    const detail = document.querySelector(`.article-view[data-article-id="${CSS.escape(activeId)}"]`);
    const heading = detail?.querySelector(":scope > h2");
    if (heading && heading.textContent !== activeTitle) heading.textContent = activeTitle;
    document.title = `${activeTitle} | 靈元院`;
  }

  document.querySelectorAll("a.article-card, .article-card a, a[href*='articles.html?id=']").forEach((link) => {
    let id = "";
    try {
      id = new URL(link.href, location.href).searchParams.get("id") || "";
    } catch (_) {
      return;
    }
    const title = CONSTRUCTION_TITLE_OVERRIDES.get(id);
    if (!title) return;
    const card = link.classList.contains("article-card") ? link : link.closest(".article-card");
    const heading = card?.querySelector(".article-list-title, h2");
    if (heading && heading.textContent !== title) heading.textContent = title;
  });
}

function applyDragonChantOverrides() {
  const activeId = new URLSearchParams(location.search).get("id") || "";

  document.querySelectorAll("a.article-card, .article-card a, a[href*='articles.html?id=']").forEach((link) => {
    let id = "";
    try {
      id = new URL(link.href, location.href).searchParams.get("id") || "";
    } catch (_) {
      return;
    }
    if (id !== DRAGON_CHANT_ARTICLE_ID) return;
    const card = link.classList.contains("article-card") ? link : link.closest(".article-card");
    const heading = card?.querySelector(".article-list-title, h2");
    if (heading && heading.textContent !== DRAGON_CHANT_TITLE) heading.textContent = DRAGON_CHANT_TITLE;
  });

  if (activeId !== DRAGON_CHANT_ARTICLE_ID) return;

  const detail = document.querySelector(`.article-view[data-article-id="${CSS.escape(DRAGON_CHANT_ARTICLE_ID)}"]`) || document.querySelector(".article-view");
  const heading = detail?.querySelector(":scope > h2");
  if (heading && heading.textContent !== DRAGON_CHANT_TITLE) heading.textContent = DRAGON_CHANT_TITLE;
  document.title = `${DRAGON_CHANT_TITLE} | 靈元院`;

  const body = detail?.querySelector(".article-body");
  if (!body) return;
  const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    if (node.nodeValue?.includes("*")) node.nodeValue = node.nodeValue.replace(/\*/g, "");
  });
}

function applyArticleDisplayOverrides() {
  applyConstructionTitleOverrides();
  applyDragonChantOverrides();
}

let displayOverrideFrame = 0;
function scheduleArticleDisplayOverrides() {
  if (displayOverrideFrame) return;
  displayOverrideFrame = requestAnimationFrame(() => {
    displayOverrideFrame = 0;
    applyArticleDisplayOverrides();
  });
}

document.addEventListener(ARTICLE_RENDERED_EVENT, (event) => {
  if (event.detail?.hasArticleBody) window.clearTimeout(articleLoadFailureTimer);
  scheduleArticleDisplayOverrides();
});

const articleLoadFailureTimer = activeArticleId && articleRoot
  ? window.setTimeout(() => {
    if (articleRoot.querySelector(".article-body")) return;
    articleRoot.dataset.articleLoadState = "failed";
    articleRoot.innerHTML = '<div class="empty" role="alert">載入失敗，請重新整理。</div>';
  }, 3000)
  : 0;

async function loadArticleCore() {
  try {
    return await import("./articles-core-20260810-v6.js?v=20260825-article-render-event-1");
  } catch (error) {
    console.error("文選核心載入失敗。", error);
    if (articleRoot) {
      articleRoot.innerHTML = '<div class="empty">文章載入失敗，請重新整理頁面後再試。若問題持續，請聯繫網站管理員。</div>';
    }
    return null;
  }
}

async function loadArticleAddons() {
  const addons = [
    ["文選頁首頁尾", "./articles-chrome-fix.js?v=20260825-article-render-event-1"],
    ["文章登入導覽", "./site-auth-nav.js?v=20260825-article-render-event-1"]
  ];

  if (activeArticleId) {
    addons.push(
      ["文章分類", "./article-taxonomy-v2.js?v=20260825-article-render-event-1"],
      ["文章重點引言", "./article-key-quote-display.js?v=20260825-article-render-event-1"],
      ["非會員贊助方案", "./article-paid-gate-restore.js?v=20260825-article-render-event-1"],
      ["付費正文安全載入", "./paid-article-secure-loader.js?v=20260825-article-render-event-1"],
      ["贊助方案結帳", "./sponsor-checkout.js?v=20260823-auto-activation-1"],
      ["文章內文圖片", "./article-inline-image-display.js?v=20260825-article-render-event-1"],
      ["文章延伸連結", "./article-destination-links.js?v=20260825-article-render-event-1"]
    );
    if (activeArticleId === "love-beyond-filial-piety-and-ancestor-worship") {
      addons.push(["文章圖片修正", "./article-love-beyond-filial-piety-display-fix.js?v=20260825-article-render-event-1"]);
    }
    if (["2026-building-patron-record", "2026-lineage-lamp-building-record"].includes(activeArticleId)) {
      addons.push(["建院見證專頁", "./construction-record-page.js?v=20260825-article-render-event-1"]);
    }
    if (activeArticleId === "2026-lineage-lamp-building-record") {
      addons.push(
        ["建院見證圖片", "./construction-record-extra-images.js?v=20260825-article-render-event-1"],
        ["建院見證封面", "./construction-cover-lock.js?v=20260825-article-render-event-1"]
      );
    }
    if (activeArticleId === "2058-future-person-prophecy") {
      addons.push(["2058 文章目錄", "./article-2058-toc.js?v=20260825-article-render-event-1"]);
    }
    addons.push(["文章內容保護", "./article-protection.js?v=20260825-article-render-event-1"]);
  } else {
    addons.push(
      ["文章列表後備", "./article-list-rescue.js?v=20260825-article-render-event-1"],
      ["文章分類", "./article-taxonomy-v2.js?v=20260825-article-render-event-1"],
      ["文章縮圖", "./article-thumbnail-display-v2.js?v=20260825-article-render-event-1"],
      ["文章內容保護", "./article-protection.js?v=20260825-article-render-event-1"]
    );
  }

  for (const [label, path] of addons) {
    try {
      await import(path);
    } catch (error) {
      console.warn(`${label}附加模組載入失敗，文章本體維持正常顯示。`, error);
    }
  }
}

void loadArticleCore().then(async (articleCore) => {
  if (!articleCore) return;
  scheduleArticleDisplayOverrides();
  await loadArticleAddons();
  articleCore.notifyArticleRendered("addons-ready");
});

const articleVisualFixStyleId = "article-visual-fixes-20260811";
if (!document.getElementById(articleVisualFixStyleId)) {
  const style = document.createElement("style");
  style.id = articleVisualFixStyleId;
  style.textContent = `
    .article-card-content,
    .article-card-content .article-list-title,
    .article-card-content h2,
    .article-card-content p,
    .article-card-content .article-hook,
    .article-card-content .article-meta,
    .article-card-content .article-guide,
    .article-card-content .article-engagement,
    .article-card-content .article-engagement span,
    .article-card-content .article-engagement b {
      color: #3F3024 !important;
      text-shadow: none !important;
    }
    .article-card-content .article-list-title,
    .article-card-content h2 {
      font-weight: 700 !important;
    }
    .article-card-content .article-hook {
      color: #493F36 !important;
    }
    .article-card-content .article-meta {
      color: #725532 !important;
    }
    .article-card-content .article-access-badge.is-free {
      color: #4F5228 !important;
      background: rgba(96,99,48,.13) !important;
      border-color: rgba(96,99,48,.32) !important;
    }
    .article-card-content .article-access-badge.is-paid {
      color: #6A4D2E !important;
      background: rgba(165,130,84,.14) !important;
      border-color: rgba(139,104,63,.34) !important;
    }
    .article-card-content .article-access-badge.is-event {
      color: #594F47 !important;
      background: rgba(89,79,71,.10) !important;
      border-color: rgba(89,79,71,.30) !important;
    }
    .footer-brand-mark {
      display: block;
      width: 128px;
      max-width: 34vw;
      height: auto;
      opacity: .64;
      filter: saturate(.72) brightness(.78);
    }
  `;
  document.head.appendChild(style);
}
