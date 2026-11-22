// 靈元院後台文章統計；管理員專用唯讀報表，不接觸付費文章私有正文。
import { auth, db, isAdminEmail } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const $ = (id) => document.getElementById(id);
const monthPicker = $("article-analytics-month");
const status = $("article-analytics-status");
const ranking = $("article-analytics-ranking");
const allTime = $("article-analytics-all-time");
const sourceContainer = $("article-analytics-sources");
const cardContainer = $("article-analytics-cards");
const formatNumber = (value) => Number(value || 0).toLocaleString("zh-TW");
const sourceNames = {
  direct: "直接／無來源", google: "Google", facebook: "Facebook", line: "LINE",
  instagram: "Instagram", youtube: "YouTube", other: "其他"
};
let rankLimit = 3;
let loadedMonthRows = [];
let loadedAllTime = [];
let loadSequence = 0;
let userIsAdmin = false;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function taipeiMonth(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei", year: "numeric", month: "2-digit"
  }).format(date);
}

function precedingMonth(month) {
  const [year, number] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, number - 2, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function paidArticle(article) {
  return article?.accessType === "paid" || String(article?.content || "").includes("<!-- paid-only -->");
}

async function loadArticleMetadata() {
  const [staticModule, articlesSnapshot] = await Promise.all([
    import("./static-articles.js?v=20261006-collective-unconscious-1"),
    getDocs(collection(db, "articles"))
  ]);
  const articleById = new Map();
  for (const article of staticModule.staticArticles || []) {
    if (article.id && article.status !== "draft") {
      articleById.set(article.id, {
        id: article.id, slug: article.slug || article.id,
        title: article.title || article.id, paid: paidArticle(article)
      });
    }
  }
  for (const snapshot of articlesSnapshot.docs) {
    const article = snapshot.data() || {};
    const id = String(snapshot.id);
    const slug = String(article.slug || "");
    const existingId = [...articleById.keys()].find((key) =>
      key === id || key === slug || articleById.get(key)?.slug === id);
    const canonicalId = existingId || id;
    if (article.status !== "published" || article.hidden === true || article.systemRecord === true) {
      articleById.delete(canonicalId);
      continue;
    }
    articleById.set(canonicalId, {
      id: canonicalId,
      slug,
      title: article.title || articleById.get(canonicalId)?.title || id,
      paid: paidArticle(article)
    });
  }
  return articleById;
}

function summarizeMonthly(records, articleById) {
  const results = new Map();
  const uniquePaid = new Set();
  const sources = new Map();
  for (const record of records) {
    const articleId = String(record.articleId || "");
    const article = articleById.get(articleId);
    if (!article?.paid) continue;
    if (!results.has(articleId)) {
      results.set(articleId, {
        id: articleId, title: article.title, readers: 0, unlocks: 0, completes: 0
      });
    }
    const row = results.get(articleId);
    row.readers++;
    if (record.unlockedAt) {
      row.unlocks++;
      uniquePaid.add(record.uid);
    }
    if (record.completedAt) row.completes++;
    const source = sourceNames[record.source] ? record.source : "other";
    sources.set(source, (sources.get(source) || 0) + 1);
  }
  return {
    rows: [...results.values()].sort((a, b) => b.unlocks - a.unlocks || b.readers - a.readers),
    paidReaders: uniquePaid.size,
    paidUnlocks: [...results.values()].reduce((sum, row) => sum + row.unlocks, 0),
    completes: [...results.values()].reduce((sum, row) => sum + row.completes, 0),
    sources
  };
}

function showCards(summary, previous, metricTotals) {
  const cards = [
    ["本月付費解鎖會員", summary.paidReaders, "跨文章不重複登入人數"],
    ["本月付費全文解鎖", summary.paidUnlocks, "每篇文章／每位會員只算一次"],
    ["本月到達內文 90%", summary.completes, "會員閱讀進度"],
    ["歷來文章開啟", metricTotals, "既有計數；含訪客與重複月份"]
  ];
  cardContainer.innerHTML = cards.map(([label, value, description]) =>
    `<div class="article-analytics-card"><small>${escapeHtml(label)}</small><strong>${formatNumber(value)}</strong><span>${escapeHtml(description)}</span></div>`
  ).join("");
  const comparison = summary.paidUnlocks - previous.paidUnlocks;
  return `${comparison > 0 ? "+" : ""}${formatNumber(comparison)}`;
}

function renderRanking() {
  const rows = loadedMonthRows.slice(0, rankLimit);
  ranking.innerHTML = rows.length ? rows.map((row) => {
    const rate = row.readers ? `${Math.round(row.unlocks / row.readers * 100)}%` : "—";
    return `<tr>
      <td><a href="/articles.html?id=${encodeURIComponent(row.id)}" target="_blank" rel="noopener noreferrer">${escapeHtml(row.title)}</a></td>
      <td>${formatNumber(row.readers)}</td><td>${formatNumber(row.unlocks)}</td>
      <td>${formatNumber(row.completes)}</td><td>${rate}</td>
    </tr>`;
  }).join("") : '<tr><td colspan="5">所選月份尚無已記錄的付費會員閱讀資料。</td></tr>';
  allTime.innerHTML = loadedAllTime.slice(0, rankLimit).map((row) =>
    `<tr><td><a href="/articles.html?id=${encodeURIComponent(row.id)}" target="_blank" rel="noopener noreferrer">${escapeHtml(row.title)}</a></td><td>${formatNumber(row.views)}</td></tr>`
  ).join("") || '<tr><td colspan="2">目前沒有可確認的付費文章累積閱讀資料。</td></tr>';
}

function renderSources(summary, previous, month) {
  const difference = summary.paidUnlocks - previous.paidUnlocks;
  const entries = [...summary.sources.entries()].sort((a, b) => b[1] - a[1]);
  sourceContainer.innerHTML = `
    <p class="article-analytics-description">${escapeHtml(month)} 付費解鎖次數：
      <strong>${formatNumber(summary.paidUnlocks)}</strong>，
      較前一個月 <strong>${difference > 0 ? "+" : ""}${formatNumber(difference)}</strong> 次。
    </p>
    ${entries.length
      ? `<table class="article-analytics-table"><thead><tr><th>登入讀者來源</th><th>篇次</th></tr></thead><tbody>${entries.map(([key, value]) =>
        `<tr><td>${escapeHtml(sourceNames[key] || key)}</td><td>${formatNumber(value)}</td></tr>`
      ).join("")}</tbody></table>`
      : '<p class="article-analytics-description">本月尚無來源資料。</p>'}
  `;
}

async function loadMonth() {
  if (!userIsAdmin) return;
  const sequence = ++loadSequence;
  const month = monthPicker.value || taipeiMonth();
  status.textContent = "正在載入文章與月報…";
  try {
    const [articleById, metricsSnapshot, monthlySnapshot, previousSnapshot] = await Promise.all([
      loadArticleMetadata(),
      getDocs(collection(db, "articleMetrics")),
      getDocs(collection(db, "articleMonthlyReaders", month, "readers")),
      getDocs(collection(db, "articleMonthlyReaders", precedingMonth(month), "readers"))
    ]);
    if (sequence !== loadSequence) return;
    const metrics = new Map(metricsSnapshot.docs.map((item) => [item.id, item.data()]));
    loadedAllTime = [...articleById.values()].filter((article) => article.paid)
      .map((article) => ({
        id: article.id, title: article.title, views: Number(metrics.get(article.id)?.views || 0)
      }))
      .sort((a, b) => b.views - a.views);
    const summary = summarizeMonthly(monthlySnapshot.docs.map((item) => item.data()), articleById);
    const previous = summarizeMonthly(previousSnapshot.docs.map((item) => item.data()), articleById);
    loadedMonthRows = summary.rows;
    showCards(summary, previous, [...metrics.values()].reduce((sum, item) =>
      sum + (item.articleId === "__article-publication-status" ? 0 : Number(item.views || 0)), 0));
    renderRanking();
    renderSources(summary, previous, month);
    status.textContent = `已更新 ${month} 月報`;
  } catch (error) {
    if (sequence !== loadSequence) return;
    console.warn("文章流量月報無法讀取。", error);
    status.textContent = "統計讀取失敗";
    ranking.innerHTML = '<tr><td colspan="5">請確認 Firestore 規則已部署及管理員登入狀態。</td></tr>';
  }
}

function csvCell(value) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = "'" + text; // 防止試算表將文章標題當成公式。
  return `"${text.replace(/"/g, '""')}"`;
}

function exportCsv() {
  if (!userIsAdmin) return;
  const fields = [
    ["月份", "文章", "文章代稱", "不重複登入讀者", "解鎖全文", "到達90%"],
    ...loadedMonthRows.map((row) => [
      monthPicker.value, row.title, row.id, row.readers, row.unlocks, row.completes
    ])
  ];
  const csv = "\uFEFF" + fields.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `lyyuan-paid-article-report-${monthPicker.value}.csv`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const analyticsConfig = window.LYY_ANALYTICS_CONFIG || {};
$("article-analytics-setup").textContent = analyticsConfig.gtmId || analyticsConfig.measurementId
  ? "Google Analytics 追蹤設定已填入。請於 Google Analytics 即時報表確認事件實際抵達。"
  : "GA4／GTM 尚未正式串接：目前仍可查看既有文章累積排行與新建立的會員月報。待提供 Google 的 G- 或 GTM- ID 後，即可啟用全站訪客流量與搜尋來源報表。";
monthPicker.value = taipeiMonth();
$("article-analytics-refresh").addEventListener("click", loadMonth);
monthPicker.addEventListener("change", loadMonth);
$("article-analytics-export").addEventListener("click", exportCsv);
document.querySelectorAll("[data-analytics-rank]").forEach((button) => {
  button.addEventListener("click", () => {
    rankLimit = Number(button.dataset.analyticsRank) === 10 ? 10 : 3;
    document.querySelectorAll("[data-analytics-rank]").forEach((candidate) => {
      candidate.setAttribute("aria-pressed", String(candidate === button));
    });
    renderRanking();
  });
});
onAuthStateChanged(auth, (user) => {
  userIsAdmin = Boolean(user && isAdminEmail(user.email));
  if (userIsAdmin) void loadMonth();
  else status.textContent = "請先使用管理員帳號登入";
});
