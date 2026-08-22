// Sponsor article access deployment marker: 20260822-runtime-restore-2
const articleRoot = document.getElementById("article-root");

async function loadArticleCore() {
  try {
    await import("./articles-core-20260810-v6.js?v=20260822-runtime-restore-2");
  } catch (error) {
    console.error("文選核心載入失敗。", error);
    if (articleRoot) {
      articleRoot.innerHTML = '<div class="empty">文章載入失敗，請重新整理頁面後再試。若問題持續，請聯繫網站管理員。</div>';
    }
    return false;
  }
  return true;
}

async function loadArticleAddons() {
  const addons = [
    ["文章圖片修正", "./article-love-beyond-filial-piety-display-fix.js?v=20260812-static-first-fix-6"],
    ["文章重點引言", "./article-key-quote-display.js?v=20260822-1"],
    ["非會員贊助方案", "./article-paid-gate-restore.js?v=20260813-guest-offer-restore-1"]
  ];
  const results = await Promise.allSettled(addons.map(([, path]) => import(path)));
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.warn(`${addons[index][0]}附加模組載入失敗，文章本體維持正常顯示。`, result.reason);
    }
  });
}

void loadArticleCore().then((loaded) => {
  if (loaded) void loadArticleAddons();
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
