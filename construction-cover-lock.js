const PRIVATE_CONSTRUCTION_ARTICLE_IDS = new Set([
  "2026-building-patron-record",
  "2026-lineage-lamp-building-record"
]);

const PUBLIC_RECORD_ID = "2026-lineage-lamp-building-record";
const HERO_SRC = "images/dizhi-hero.jpg?v=20260822-cover-lock-1";
const HERO_ALT = "元神的呼喚｜一間靈修人專屬的靈修道院";

const params = new URLSearchParams(location.search);
const activeId = params.get("id") || "";
const isPrivateConstructionArticle = PRIVATE_CONSTRUCTION_ARTICLE_IDS.has(activeId);

// 建院限定頁只接受已授權 Gmail 身分，不使用個人 token／magic link 繞過 Email 登入。
if (isPrivateConstructionArticle && params.get("token")) {
  params.delete("token");
  params.delete("event");
  const cleanQuery = params.toString();
  location.replace(`${location.pathname}${cleanQuery ? `?${cleanQuery}` : ""}${location.hash || ""}`);
}

function ensurePrivateRobotsMeta() {
  if (!isPrivateConstructionArticle) return;
  let meta = document.querySelector('meta[name="robots"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "robots";
    document.head.appendChild(meta);
  }
  meta.content = "noindex,nofollow,noarchive,nosnippet,noimageindex";
}

function removePrivateConstructionDiscovery() {
  PRIVATE_CONSTRUCTION_ARTICLE_IDS.forEach((id) => {
    document.querySelectorAll(`.article-card[data-article-id="${CSS.escape(id)}"]`).forEach((card) => card.remove());

    document.querySelectorAll(`a[href*="articles.html?id=${CSS.escape(id)}"], a[href*="id=${CSS.escape(id)}"]`).forEach((link) => {
      if (link.closest(`.article-view[data-article-id="${CSS.escape(id)}"]`)) return;
      const related = link.closest(".next-reading");
      if (related) {
        related.remove();
        return;
      }
      const card = link.closest(".article-card");
      if (card) card.remove();
    });
  });

  const grid = document.querySelector("#article-root .article-grid");
  const summary = document.querySelector("#article-root .article-result-summary span");
  if (grid && summary) {
    const count = grid.querySelectorAll(".article-card").length;
    if (!document.getElementById("article-load-more")) summary.textContent = `共 ${count} 篇文章`;
  }
}

function privateGateCopy(id) {
  if (id === "2026-building-patron-record") {
    return {
      title: "丙午建院功德主專屬",
      text: "本頁僅提供已登記並完成授權的建院功德主閱讀。請使用登記護持時所留的 Gmail 登入。"
    };
  }
  return {
    title: "法會點燈參與者限定",
    text: "本頁僅提供本次法會已登記並完成授權的點燈參與者閱讀。請使用登記點燈時所留的 Gmail 登入。"
  };
}

function renderEmailOnlyGate(article) {
  if (!isPrivateConstructionArticle || !article) return false;
  const existingGate = article.querySelector(":scope > .article-paid-gate, :scope > .article-support-gate, .article-paid-gate");

  // 沒有活動鎖定畫面，代表核心已完成 Email 權限驗證並解密全文。
  if (!existingGate) {
    article.classList.remove("construction-private-locked");
    return false;
  }

  const copy = privateGateCopy(activeId);
  const back = article.querySelector(":scope > .article-back")?.outerHTML || '<a class="article-back" href="articles.html">← 返回靈元院</a>';
  const heading = article.querySelector(":scope > h2")?.textContent?.trim() || copy.title;
  const metaText = activeId === "2026-building-patron-record" ? "靈元院建院紀錄｜限定閱讀" : "靈元院建院願心見證｜限定閱讀";

  article.classList.add("construction-private-locked");
  article.innerHTML = `${back}
    <div class="article-meta">${metaText}</div>
    <h2>${escapePrivateHtml(heading)}</h2>
    <section class="article-paid-gate construction-email-only-gate" aria-label="Email 授權限定閱讀">
      <strong>${copy.title}</strong>
      <p>${copy.text}</p>
      <button class="article-paid-login construction-private-login" type="button">使用授權 Gmail 登入</button>
    </section>`;

  article.querySelector(".construction-private-login")?.addEventListener("click", () => {
    document.getElementById("member-login-button")?.click();
  });
  return true;
}

function escapePrivateHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function enforcePrivateConstructionMode() {
  removePrivateConstructionDiscovery();
  if (!isPrivateConstructionArticle) return;

  const article = document.querySelector(`.article-view[data-article-id="${CSS.escape(activeId)}"]`);
  if (!article) return;
  renderEmailOnlyGate(article);
}

function installPrivateConstructionStyles() {
  if (document.getElementById("construction-private-article-style")) return;
  const style = document.createElement("style");
  style.id = "construction-private-article-style";
  style.textContent = `
    .construction-private-locked .construction-record-head,
    .construction-private-locked .article-cover,
    .construction-private-locked .article-body,
    .construction-private-locked .article-toc,
    .construction-private-locked .article-guide,
    .construction-private-locked .recommended-book,
    .construction-private-locked .next-reading,
    .construction-private-locked .article-share,
    .construction-private-locked .construction-record-confidential,
    .construction-private-locked .construction-latest-progress,
    .construction-private-locked .construction-extra-render {
      display:none!important;
    }
    .construction-private-locked .construction-email-only-gate {
      display:block!important;
      margin:34px 0 8px!important;
      padding:38px 30px!important;
      text-align:center!important;
      border:1px solid rgba(139,104,63,.34)!important;
      background:rgba(165,130,84,.07)!important;
    }
    .construction-private-locked .construction-email-only-gate strong {
      display:block;
      color:#604831;
      font-size:21px;
      margin-bottom:10px;
    }
    .construction-private-locked .construction-email-only-gate p {
      max-width:590px;
      margin:0 auto 20px;
      color:#725D48;
      font-size:14px;
      line-height:1.9;
    }
    .construction-private-locked .construction-private-login {
      border:0;
      background:#80623D;
      color:white;
      padding:11px 20px;
      cursor:pointer;
      font:inherit;
    }
  `;
  document.head.appendChild(style);
}

installPrivateConstructionStyles();
ensurePrivateRobotsMeta();
enforcePrivateConstructionMode();

let privacyScheduled = false;
const schedulePrivacyEnforce = () => {
  if (privacyScheduled) return;
  privacyScheduled = true;
  requestAnimationFrame(() => {
    privacyScheduled = false;
    enforcePrivateConstructionMode();
  });
};

const privacyObserver = new MutationObserver(schedulePrivacyEnforce);
privacyObserver.observe(document.documentElement, { childList: true, subtree: true });
[50, 180, 500, 1200, 2500, 5000].forEach((delay) => window.setTimeout(enforcePrivateConstructionMode, delay));
window.addEventListener("pageshow", enforcePrivateConstructionMode);

// 原有的「建院願心見證專頁」封面鎖定僅在通過 Email 權限後才執行。
if (activeId === PUBLIC_RECORD_ID) {
  const enforceCover = () => {
    const article = document.querySelector(`.article-view[data-article-id="${CSS.escape(PUBLIC_RECORD_ID)}"]`);
    if (!article || article.classList.contains("construction-private-locked")) return;

    const cover = article.querySelector(":scope > .article-cover");
    if (!cover) return;

    const currentSrc = cover.getAttribute("src") || "";
    if (!/dizhi-hero\.jpg/i.test(currentSrc)) cover.setAttribute("src", HERO_SRC);
    if (cover.getAttribute("alt") !== HERO_ALT) cover.setAttribute("alt", HERO_ALT);
    if (cover.hasAttribute("srcset")) cover.removeAttribute("srcset");
  };

  let coverScheduled = false;
  const scheduleCoverEnforce = () => {
    if (coverScheduled) return;
    coverScheduled = true;
    requestAnimationFrame(() => {
      coverScheduled = false;
      enforceCover();
    });
  };

  enforceCover();
  [0, 50, 180, 500, 1200, 2500, 5000].forEach((delay) => window.setTimeout(enforceCover, delay));

  const coverObserver = new MutationObserver(scheduleCoverEnforce);
  coverObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src", "srcset"]
  });

  window.addEventListener("pageshow", enforceCover);
  window.addEventListener("load", enforceCover);
}
