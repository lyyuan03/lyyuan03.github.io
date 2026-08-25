const CATEGORY_LABELS = {
  spiritual: "靈修",
  worldly: "人生",
  "spirit-world": "靈界",
  reading: "宇色書房"
};

const SERIES_BY_ID = {
  "fantasy-intuition-or-yuanshen": "靈修辨證",
  "yuanshen-awakening-eleven-principles": "靈修辨證",
  "lingxiu-yuanshen-reality": "靈修辨證",
  "lingxiu-zouhuo-rumo": "靈修辨證",
  "2026-guanyin-vow-lamp-record": "觀音修行",
  "celebrity-death-dream-spirit-five-checks": "靈界辨證",
  "wealth-discipline-investing-and-self-mastery": "宇色書房",
  "wealth-as-water": "財富與生命",
  "market-crash-money-self-control": "財富與生命",
  "good-fortune-believe-in-yourself-choices": "生命選擇"
};

// 安全保護：本模組只服務前台文章頁，後台載入時立即停止。
if (/(^|\/)admin\.html$/i.test(location.pathname)) {
  console.info("文章分類模組已於後台停用，以確保後台穩定。");
} else if (/(^|\/)articles\.html$/i.test(location.pathname)) {
  const style = document.createElement("style");
  style.id = "article-taxonomy-v2-style";
  style.textContent = `
    .article-editorial-labels{display:flex;align-items:center;flex-wrap:wrap;gap:7px;margin:0 0 8px}
    .article-editorial-category,.article-editorial-series{display:inline-flex;align-items:center;min-height:24px;padding:3px 9px;border-radius:999px;font-family:'Noto Sans TC',sans-serif;font-size:10px;font-weight:600;line-height:1.25;letter-spacing:.06em}
    .article-editorial-category{border:1px solid rgba(165,130,84,.32);background:rgba(165,130,84,.14);color:#674929}
    .article-editorial-series{border:1px solid rgba(96,99,48,.3);background:rgba(96,99,48,.11);color:#4E5229}
    .article-view>.article-editorial-labels{margin:4px 0 14px}
    @media(max-width:760px){.article-editorial-labels{gap:5px}.article-editorial-category,.article-editorial-series{min-height:22px;padding:3px 7px;font-size:9px}}
  `;
  if (!document.getElementById(style.id)) document.head.appendChild(style);

  const categoryFromMeta = (text = "") => {
    if (text.includes("活動限定")) return "法會紀實";
    if (text.includes("靈．修行")) return "靈修";
    if (text.includes("人．俗世")) return "人生";
    if (text.includes("異．靈界")) return "靈界";
    if (text.includes("思．讀物")) return "宇色書房";
    return "文選";
  };

  const decorate = () => {
    document.querySelectorAll(".article-card[data-article-id]").forEach((card) => {
      if (card.querySelector(":scope .article-editorial-labels")) return;
      const id = card.dataset.articleId || "";
      const meta = card.querySelector(".article-meta");
      const category = id === "2026-guanyin-vow-lamp-record" ? "法會紀實" : categoryFromMeta(meta?.textContent || "");
      const series = SERIES_BY_ID[id] || "";
      const labels = document.createElement("div");
      labels.className = "article-editorial-labels";
      labels.innerHTML = `<span class="article-editorial-category">${category}</span>${series ? `<span class="article-editorial-series">${series}系列</span>` : ""}`;
      card.querySelector(".article-list-title")?.before(labels);
      if (meta) meta.style.display = "none";
    });

    const detail = document.querySelector(".article-view[data-article-id]");
    if (detail && !detail.querySelector(":scope > .article-editorial-labels")) {
      const id = detail.dataset.articleId || "";
      const meta = detail.querySelector(":scope > .article-meta");
      const category = id === "2026-guanyin-vow-lamp-record" ? "法會紀實" : categoryFromMeta(meta?.textContent || "");
      const series = SERIES_BY_ID[id] || "";
      const labels = document.createElement("div");
      labels.className = "article-editorial-labels";
      labels.innerHTML = `<span class="article-editorial-category">${category}</span>${series ? `<span class="article-editorial-series">${series}系列</span>` : ""}`;
      detail.querySelector(":scope > h2")?.before(labels);
      if (meta) meta.style.display = "none";
    }
  };

  decorate();
  document.addEventListener("lyyuan:article-rendered", decorate);
}
