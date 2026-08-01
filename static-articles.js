import { staticArticles as baseArticles } from "./static-articles-base.js?v=20260730-safe-base-1";
import { wealthDisciplineArticle } from "./article-wealth-discipline.js?v=20260730-wealth-discipline-6";
import { celebrityDreamSpiritArticle } from "./article-celebrity-dream-spirit.js?v=20260731-celebrity-dream-4";
import { fantasyIntuitionYuanshenArticle } from "./article-fantasy-intuition-yuanshen-display.js?v=20260801-fantasy-full-1";
import { wealthAsWaterArticle } from "./article-wealth-as-water.js?v=20260801-wealth-consciousness-1";
import { guanyinVowLampRecordArticle } from "./article-2026-guanyin-vow-lamp-record.js?v=20260801-event-1";

const featuredWealthDisciplineArticle = {
  ...wealthDisciplineArticle,
  publishedAt: "2026-07-30T23:59:00.000Z",
  updatedAt: "2026-07-30T23:59:00.000Z",
  coverImage: "assets/articles/wealth-discipline/book-cover-photo.jpg?v=20260730-book-cover-2"
};

const categoryNames = {
  spiritual: "靈修",
  worldly: "人生",
  "spirit-world": "靈界",
  reading: "宇色書房"
};

const seriesById = {
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

function normalizeArticle(article) {
  const isEvent = article.accessType === "event" || article.id === "2026-guanyin-vow-lamp-record";
  return {
    ...article,
    displayCategory: isEvent ? "法會紀實" : (article.displayCategory || categoryNames[article.category] || "文選"),
    series: article.series || seriesById[article.id] || ""
  };
}

export const staticArticles = [
  guanyinVowLampRecordArticle,
  wealthAsWaterArticle,
  fantasyIntuitionYuanshenArticle,
  celebrityDreamSpiritArticle,
  featuredWealthDisciplineArticle,
  ...baseArticles
].map(normalizeArticle);

function installEditorialLabels() {
  if (!/(^|\/)articles\.html$/i.test(location.pathname)) return;
  if (!document.getElementById("article-editorial-labels-style")) {
    const style = document.createElement("style");
    style.id = "article-editorial-labels-style";
    style.textContent = `
      .article-editorial-labels{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin:0 0 7px}
      .article-editorial-category,.article-editorial-series{display:inline-flex;align-items:center;min-height:24px;padding:3px 8px;border-radius:999px;font-family:'Noto Sans TC',sans-serif;font-size:10px;font-weight:600;line-height:1.25;letter-spacing:.06em}
      .article-editorial-category{background:rgba(165,130,84,.16);border:1px solid rgba(125,94,55,.28);color:#6B4D2D}
      .article-editorial-series{background:rgba(96,99,48,.12);border:1px solid rgba(96,99,48,.24);color:#50542D}
      .article-view>.article-editorial-labels{margin:3px 0 13px}
      @media(max-width:760px){.article-editorial-labels{gap:5px;margin-bottom:5px}.article-editorial-category,.article-editorial-series{font-size:9px;min-height:22px;padding:3px 7px}}
    `;
    document.head.appendChild(style);
  }

  const byId = new Map(staticArticles.map((article) => [article.id, article]));
  const fallbackCategory = (meta = "") => {
    if (meta.includes("活動限定")) return "法會紀實";
    if (meta.includes("靈．修行")) return "靈修";
    if (meta.includes("人．俗世")) return "人生";
    if (meta.includes("異．靈界")) return "靈界";
    if (meta.includes("思．讀物")) return "宇色書房";
    return "文選";
  };

  const decorate = () => {
    document.querySelectorAll(".article-card[data-article-id]").forEach((card) => {
      if (card.querySelector(":scope .article-editorial-labels")) return;
      const article = byId.get(card.dataset.articleId);
      const meta = card.querySelector(".article-meta")?.textContent || "";
      const category = article?.displayCategory || fallbackCategory(meta);
      const series = article?.series || "";
      const labels = document.createElement("div");
      labels.className = "article-editorial-labels";
      labels.innerHTML = `<span class="article-editorial-category">${category}</span>${series ? `<span class="article-editorial-series">${series}系列</span>` : ""}`;
      card.querySelector(".article-list-title")?.before(labels);
      const metaNode = card.querySelector(".article-meta");
      if (metaNode) metaNode.textContent = category;
    });

    const detail = document.querySelector(".article-view[data-article-id]");
    if (detail && !detail.querySelector(":scope > .article-editorial-labels")) {
      const article = byId.get(detail.dataset.articleId);
      const metaNode = detail.querySelector(":scope > .article-meta");
      const category = article?.displayCategory || fallbackCategory(metaNode?.textContent || "");
      const series = article?.series || "";
      const labels = document.createElement("div");
      labels.className = "article-editorial-labels";
      labels.innerHTML = `<span class="article-editorial-category">${category}</span>${series ? `<span class="article-editorial-series">${series}系列</span>` : ""}`;
      detail.querySelector(":scope > h2")?.before(labels);
      if (metaNode) metaNode.remove();
    }
  };

  decorate();
  new MutationObserver(decorate).observe(document.body, { childList: true, subtree: true });
}

async function installAdminMigration() {
  if (!/(^|\/)admin\.html$/i.test(location.pathname)) return;
  const addButton = () => {
    const actions = document.querySelector(".top-actions");
    if (!actions || document.getElementById("bulk-import-static-articles")) return;
    const button = document.createElement("button");
    button.id = "bulk-import-static-articles";
    button.className = "btn";
    button.type = "button";
    button.textContent = "全部匯入後台";
    button.title = "將尚未存在於 Firestore 的網站文章一次匯入後台";
    const exportButton = document.getElementById("export-articles");
    exportButton?.after(button);

    button.addEventListener("click", async () => {
      if (!confirm("確定要將網站文章一次匯入後台嗎？已存在的文章不會重複建立。")) return;
      button.disabled = true;
      button.textContent = "匯入中…";
      try {
        const [{ db, auth, isAdminEmail }, firestore] = await Promise.all([
          import("./firebase-config.js"),
          import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js")
        ]);
        if (!auth.currentUser || !isAdminEmail(auth.currentUser.email)) throw new Error("尚未以管理員帳號登入");
        const existing = await firestore.getDocs(firestore.collection(db, "articles"));
        const existingIds = new Set(existing.docs.map((item) => item.id));
        let imported = 0;
        let skippedEvent = 0;
        for (const article of staticArticles) {
          if (existingIds.has(article.id)) continue;
          if (article.accessType === "event") {
            skippedEvent += 1;
            continue;
          }
          const payload = { ...article };
          delete payload.source;
          payload.createdAt = firestore.serverTimestamp();
          payload.updatedAt = firestore.serverTimestamp();
          if (payload.status === "published") payload.publishedAt = payload.publishedAt || firestore.serverTimestamp();
          await firestore.setDoc(firestore.doc(db, "articles", article.id), payload, { merge: true });
          imported += 1;
        }
        alert(`已匯入 ${imported} 篇網站文章。${skippedEvent ? `\n另有 ${skippedEvent} 篇加密活動文章保留原狀，請在後台開啟後重新儲存，以重新配發活動金鑰。` : ""}`);
        location.reload();
      } catch (error) {
        console.error(error);
        alert("匯入失敗，請確認管理員登入與 Firestore 權限。");
        button.disabled = false;
        button.textContent = "全部匯入後台";
      }
    });
  };

  const cleanList = () => {
    document.querySelectorAll(".article-import-button").forEach((button) => button.remove());
    document.querySelectorAll(".article-item-wrap").forEach((wrap) => {
      wrap.style.display = "block";
      const item = wrap.querySelector(".article-item");
      if (item) item.style.width = "100%";
    });
    document.querySelectorAll(".article-item-meta").forEach((meta) => {
      meta.textContent = meta.textContent
        .replace("網站文章", "待匯入")
        .replace("後台文章", "已同步");
    });
  };

  addButton();
  cleanList();
  new MutationObserver(() => { addButton(); cleanList(); }).observe(document.body, { childList: true, subtree: true });
}

installEditorialLabels();
installAdminMigration();
