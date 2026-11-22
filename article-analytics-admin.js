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
let loadedSourceRows = [];
let monthLoaded = false;
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
  monthLoaded = false;
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
    loadedSourceRows = [...summary.sources.entries()].sort((a, b) => b[1] - a[1]);
    monthLoaded = true;
    showCards(summary, previous, [...metrics.values()].reduce((sum, item) =>
      sum + (item.articleId === "__article-publication-status" ? 0 : Number(item.views || 0)), 0));
    renderRanking();
    renderSources(summary, previous, month);
    status.textContent = `已更新 ${month} 月報`;
  } catch (error) {
    if (sequence !== loadSequence) return;
    console.warn("文章流量月報無法讀取。", error);
    status.textContent = "統計讀取失敗";
    monthLoaded = false;
    ranking.innerHTML = '<tr><td colspan="5">請確認 Firestore 規則已部署及管理員登入狀態。</td></tr>';
  }
}

function csvCell(value) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = "'" + text; // 防止試算表將文章標題當成公式。
  return `"${text.replace(/"/g, '""')}"`;
}

const exportStatus = $("article-analytics-export-status");
function downloadCsv(filename, fields) {
  const csv = "\uFEFF" + fields.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ensureExportReady() {
  if (!userIsAdmin || !monthLoaded) {
    exportStatus.textContent = "請先登入管理員並等待所選月份統計載入完成。";
    return false;
  }
  return true;
}

function exportCsv() {
  if (!ensureExportReady()) return;
  downloadCsv(`lyyuan-member-reading-${monthPicker.value}.csv`, [
    ["月份", "付費文章", "文章代稱", "不重複登入讀者", "解鎖全文人數", "到達90%人數", "解鎖率(%)"],
    ...loadedMonthRows.map((row) => [
      monthPicker.value, row.title, row.id, row.readers, row.unlocks, row.completes,
      row.readers ? (row.unlocks / row.readers * 100).toFixed(1) : ""
    ])
  ]);
  exportStatus.textContent = "已下載本月付費會員閱讀報表。";
}

function exportSourcesCsv() {
  if (!ensureExportReady()) return;
  downloadCsv(`lyyuan-reader-sources-${monthPicker.value}.csv`, [
    ["月份", "登入讀者來源", "付費文章閱讀篇次", "計算說明"],
    ...loadedSourceRows.map(([source, count]) => [
      monthPicker.value, sourceNames[source] || source, count,
      "每篇文章／每位登入讀者／每月一筆，並非不重複訪客數"
    ])
  ]);
  exportStatus.textContent = "已下載本月付費文章讀者來源報表。";
}

function exportAllTimeCsv() {
  if (!ensureExportReady()) return;
  downloadCsv(`lyyuan-paid-article-all-time.csv`, [
    ["付費文章", "文章代稱", "歷來累積開啟次數", "計算說明"],
    ...loadedAllTime.map((row) => [
      row.title, row.id, row.views, "既有 articleMetrics 計數，含訪客與不同月份重複開啟"
    ])
  ]);
  exportStatus.textContent = "已下載歷來付費文章開啟次數報表。";
}

const chatgptAnalysisPrompt = `請擔任靈元院網站的內容策略分析顧問，以臺灣繁體中文分析我上傳的 CSV 報表。\n\n1. 先列出每份檔案的資料期間、來源、指標定義與可能缺漏，不要把開啟次數當成不重複訪客人數，也不要把付費會員閱讀當成全站流量。\n2. 排出付費會員最常閱讀、最常解鎖、到達閱讀進度 90% 的文章主題，注意樣本量；比較當月與歷來排行的差異。\n3. 分析 Google、LINE、Facebook 等來源篇次；若另有 GA4 報表，分析全站熱門頁面、平均參與時間、來源與地區。\n4. 提出適合靈元院及宇色老師的下一階段文章／影片選題，逐項標示數據依據、預期讀者群與可驗證的假設。\n5. 年齡、性別、興趣僅在 GA4 報表確實提供時分析，說明未知比例或隱私門檻。讀者個人的職業、收入、收入來源及來訪動機，若沒有自願問卷資料，請明確寫「無資料」，不可推測。\n6. 最後提出下個月值得追蹤的五項指標，分清楚已觀察到的事實與尚待驗證的推論。`;

async function copyAnalysisPrompt() {
  try {
    await navigator.clipboard.writeText(chatgptAnalysisPrompt);
    exportStatus.textContent = "已複製 ChatGPT 分析指令；請貼到對話並附上 CSV 檔案。";
  } catch {
    const input = document.createElement("textarea");
    input.value = chatgptAnalysisPrompt;
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    const copied = document.execCommand("copy");
    input.remove();
    exportStatus.textContent = copied
      ? "已複製 ChatGPT 分析指令；請貼到對話並附上 CSV 檔案。"
      : "瀏覽器未允許複製；請檢查剪貼簿權限後重試。";
  }
}

const analyticsConfig = window.LYY_ANALYTICS_CONFIG || {};
$("article-analytics-setup").textContent = analyticsConfig.gtmId || analyticsConfig.measurementId
  ? "資料來源提醒：本區為 Firestore 的登入會員文章紀錄；GA4 已設定追蹤，但全站訪客、停留時間與客層須按上方藍色區塊進入 Google 報表查看。兩者口徑不同，請勿直接相加。"
  : "資料來源提醒：本區為 Firestore 的登入會員文章紀錄；尚未設定 GA4，全站訪客與停留時間目前無法由本區提供。";
monthPicker.value = taipeiMonth();
$("article-analytics-refresh").addEventListener("click", loadMonth);
monthPicker.addEventListener("change", loadMonth);
$("article-analytics-export").addEventListener("click", exportCsv);
$("article-analytics-export-sources").addEventListener("click", exportSourcesCsv);
$("article-analytics-export-alltime").addEventListener("click", exportAllTimeCsv);
$("article-analytics-copy-prompt").addEventListener("click", copyAnalysisPrompt);
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
  else {
    monthLoaded = false;
    status.textContent = "請先使用管理員帳號登入";
  }
});
