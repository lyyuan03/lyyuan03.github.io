import { app, auth, db, isAdminEmail } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { LINGJI_THRESHOLD, annualCycle } from "./member-dashboard-logic.js";

const form = document.getElementById("wellness-member-form");
const listEl = document.getElementById("wellness-member-list");
const statusEl = document.getElementById("wellness-member-status");
const resetButton = document.getElementById("wellness-member-reset");
const levelEl = document.getElementById("wellness-member-level");
const articleAccessEl = document.getElementById("wellness-member-article-access");
const sendPaymentButton = document.getElementById("wellness-member-send-payment");
const functions = getFunctions(app, "asia-east1");
const createMembershipCheckout = httpsCallable(functions, "createMembershipCheckout");
const backendStatusUrl = "https://asia-east1-lyyuan03-membership.cloudfunctions.net/membershipBackendStatus";

let members = [];

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

function normalizeEmail(value = "") {
  return value.trim().toLowerCase();
}

function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateInputToIso(value, endOfDay = false) {
  if (!value) return null;
  const time = endOfDay ? "23:59:59" : "00:00:00";
  const date = new Date(`${value}T${time}+08:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toDateInput(value) {
  const date = toDate(value);
  if (!date) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function formatDate(value) {
  const date = toDate(value);
  return date ? new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium" }).format(date) : "未設定";
}

function currentCycleDefaults() {
  const cycle = annualCycle();
  return { start: cycle.start, end: cycle.end };
}

function levelLabel(level) {
  return level === "lingji" ? "靈極會員" : "一般會員";
}

function parseCourses(value = "") {
  return value.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const [title = "", startsAt = "", expiresAt = "", url = ""] = line.split(/[｜|]/).map((item) => item.trim());
    return { title, startsAt, expiresAt, url };
  }).filter((course) => course.title);
}

function coursesToText(courses = []) {
  return (Array.isArray(courses) ? courses : []).map((course) => [course.title, course.startsAt, course.expiresAt, course.url].join("｜")).join("\n");
}

function syncArticleAccess() {
  if (levelEl.value === "lingji") {
    articleAccessEl.checked = true;
    articleAccessEl.disabled = true;
  } else {
    articleAccessEl.disabled = false;
  }
}

function resetForm() {
  form.reset();
  document.getElementById("wellness-member-original-email").value = "";
  levelEl.value = "wellness";
  articleAccessEl.checked = true;
  articleAccessEl.disabled = false;
  document.getElementById("wellness-member-annual-spend").value = "0";
  document.getElementById("wellness-member-cashback").value = "0";
  document.getElementById("wellness-member-courses").value = "";
  document.getElementById("wellness-member-annual-cycle").value = currentCycleDefaults().start;
  document.getElementById("wellness-member-lingji-from").value = "";
  document.getElementById("wellness-member-lingji-until").value = "";
}

function payload() {
  const level = levelEl.value === "lingji" ? "lingji" : "wellness";
  const status = document.getElementById("wellness-member-state").value;
  const annualSpend = Math.max(0, Number(document.getElementById("wellness-member-annual-spend").value) || 0);
  const cycleStart = document.getElementById("wellness-member-annual-cycle").value || currentCycleDefaults().start;
  const lingjiFromInput = document.getElementById("wellness-member-lingji-from").value;
  const lingjiUntilInput = document.getElementById("wellness-member-lingji-until").value;
  return {
    email: normalizeEmail(document.getElementById("wellness-member-email").value),
    name: document.getElementById("wellness-member-name").value.trim(),
    memberType: "wellness-channel",
    memberLevel: level,
    wellnessLevel: level,
    status,
    paymentStatus: status === "active" ? "paid" : "pending",
    firstJoinedAt: dateInputToIso(document.getElementById("wellness-member-first-joined-at").value),
    startsAt: dateInputToIso(document.getElementById("wellness-member-starts-at").value),
    expiresAt: dateInputToIso(document.getElementById("wellness-member-expires-at").value, true),
    annualSpend,
    cashbackBalance: Math.max(0, Number(document.getElementById("wellness-member-cashback").value) || 0),
    purchasedCourses: parseCourses(document.getElementById("wellness-member-courses").value),
    wellnessAccess: true,
    annualSpendCycleStart: dateInputToIso(cycleStart),
    nextLingjiQualified: annualSpend >= LINGJI_THRESHOLD,
    lingjiValidFrom: dateInputToIso(lingjiFromInput || (level === "lingji" ? currentCycleDefaults().start : "")),
    lingjiValidUntil: dateInputToIso(lingjiUntilInput || (level === "lingji" ? currentCycleDefaults().end : ""), true),
    articleAccess: level === "lingji" || articleAccessEl.checked,
    note: document.getElementById("wellness-member-note").value.trim(),
    updatedAt: serverTimestamp()
  };
}

async function saveMember(event) {
  event.preventDefault();
  const data = payload();
  if (!data.email) return;
  const originalEmail = normalizeEmail(document.getElementById("wellness-member-original-email").value);
  await setDoc(doc(db, "memberAccess", data.email), data, { merge: true });
  if (originalEmail && originalEmail !== data.email) {
    await deleteDoc(doc(db, "memberAccess", originalEmail));
  }
  statusEl.textContent = "養生療癒會員資料已儲存，文章權限已同步";
  await loadMembers();
  resetForm();
}

async function createPaymentOrder() {
  if (!form.reportValidity()) return;
  sendPaymentButton.disabled = true;
  const originalLabel = sendPaymentButton.textContent;
  sendPaymentButton.textContent = "正在建立訂單並寄信…";
  statusEl.textContent = "";
  try {
    const result = await createMembershipCheckout({
      email: normalizeEmail(document.getElementById("wellness-member-email").value),
      name: document.getElementById("wellness-member-name").value.trim(),
      memberLevel: levelEl.value === "lingji" ? "lingji" : "wellness",
      articleAccess: levelEl.value === "lingji" || articleAccessEl.checked
    });
    statusEl.textContent = `繳費信已寄出｜訂單 ${result.data.merchantTradeNo}｜NT$${Number(result.data.amount).toLocaleString("zh-TW")}／${result.data.planMonths}個月`;
    await loadMembers();
  } finally {
    sendPaymentButton.disabled = false;
    sendPaymentButton.textContent = originalLabel;
  }
}

async function loadPaymentBackendStatus() {
  try {
    const response = await fetch(backendStatusUrl, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok || result.ready !== true) throw new Error("backend-not-ready");
    sendPaymentButton.disabled = false;
    sendPaymentButton.textContent = "建立綠界訂單並寄出繳費信";
  } catch (error) {
    console.warn("會員金流後端尚未啟用。", error);
    sendPaymentButton.disabled = true;
    sendPaymentButton.textContent = "金流後端待完成安全設定";
  }
}

function normalizeStoredLevel(member = {}) {
  if (member.memberLevel === "lingji" || member.wellnessLevel === "lingji" || member.wellnessLevel === "wellness-premium") return "lingji";
  return "wellness";
}

function renderMembers() {
  if (!members.length) {
    listEl.innerHTML = '<div class="empty">目前尚無養生療癒會員資料</div>';
    return;
  }
  const now = new Date();
  listEl.innerHTML = members.map((member) => {
    const level = normalizeStoredLevel(member);
    const expiry = toDate(member.expiresAt);
    const active = member.status === "active" && (!expiry || expiry > now);
    const stateLabel = active ? "有效" : member.status === "active" ? "已到期" : "未啟用";
    const articleLabel = member.articleAccess === true || level === "lingji" ? "可閱讀付費文章" : "未開放付費文章";
    const annualSpend = Math.max(0, Number(member.annualSpend) || 0);
    const qualificationLabel = annualSpend >= LINGJI_THRESHOLD ? "符合次年度靈極資格" : `距次年度門檻 NT$${(LINGJI_THRESHOLD - annualSpend).toLocaleString("zh-TW")}`;
    const cashback = Math.max(0, Number(member.cashbackBalance) || 0);
    const courseCount = Array.isArray(member.purchasedCourses) ? member.purchasedCourses.length : 0;
    return `<div class="member-row"><div><strong>${escapeHtml(member.name || "未填姓名")}｜${escapeHtml(levelLabel(level))}｜${escapeHtml(stateLabel)}</strong><small>${escapeHtml(member.email)}｜${articleLabel}｜首次加入 ${escapeHtml(formatDate(member.firstJoinedAt))}｜到期 ${escapeHtml(formatDate(member.expiresAt))}<br>本年度累積 NT$${annualSpend.toLocaleString("zh-TW")}｜可用回饋金 NT$${cashback.toLocaleString("zh-TW")}｜線上課程 ${courseCount} 門<br>${escapeHtml(qualificationLabel)}</small></div><div class="member-row-actions"><button class="btn" type="button" data-wellness-edit="${escapeHtml(member.email)}">編輯</button><button class="btn danger" type="button" data-wellness-delete="${escapeHtml(member.email)}">刪除</button></div></div>`;
  }).join("");
  listEl.querySelectorAll("[data-wellness-edit]").forEach((button) => button.addEventListener("click", () => editMember(button.dataset.wellnessEdit)));
  listEl.querySelectorAll("[data-wellness-delete]").forEach((button) => button.addEventListener("click", () => removeMember(button.dataset.wellnessDelete)));
}

function editMember(email) {
  const member = members.find((item) => item.email === email);
  if (!member) return;
  document.getElementById("wellness-member-original-email").value = member.email;
  document.getElementById("wellness-member-name").value = member.name || "";
  document.getElementById("wellness-member-email").value = member.email || "";
  levelEl.value = normalizeStoredLevel(member);
  document.getElementById("wellness-member-state").value = member.status || "pending";
  document.getElementById("wellness-member-first-joined-at").value = toDateInput(member.firstJoinedAt || member.startsAt);
  document.getElementById("wellness-member-starts-at").value = toDateInput(member.startsAt);
  document.getElementById("wellness-member-expires-at").value = toDateInput(member.expiresAt);
  document.getElementById("wellness-member-annual-spend").value = Math.max(0, Number(member.annualSpend) || 0);
  document.getElementById("wellness-member-cashback").value = Math.max(0, Number(member.cashbackBalance) || 0);
  document.getElementById("wellness-member-courses").value = coursesToText(member.purchasedCourses);
  document.getElementById("wellness-member-annual-cycle").value = toDateInput(member.annualSpendCycleStart) || currentCycleDefaults().start;
  document.getElementById("wellness-member-lingji-from").value = toDateInput(member.lingjiValidFrom);
  document.getElementById("wellness-member-lingji-until").value = toDateInput(member.lingjiValidUntil);
  articleAccessEl.checked = member.articleAccess === true || levelEl.value === "lingji";
  document.getElementById("wellness-member-note").value = member.note || "";
  syncArticleAccess();
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function removeMember(email) {
  if (!confirm(`確定要刪除 ${email} 的養生療癒會員資料嗎？`)) return;
  await deleteDoc(doc(db, "memberAccess", email));
  statusEl.textContent = "養生療癒會員資料已刪除";
  await loadMembers();
}

async function loadMembers() {
  const snapshot = await getDocs(collection(db, "memberAccess"));
  members = snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => item.wellnessAccess === true || item.memberType === "wellness-channel" || ["wellness", "lingji"].includes(item.memberLevel))
    .sort((a, b) => String(a.email).localeCompare(String(b.email), "zh-TW"));
  renderMembers();
}

function showError(error) {
  console.error(error);
  statusEl.textContent = error?.code === "permission-denied" ? "Firebase 會員權限尚未發布" : "養生療癒會員資料處理失敗";
}

form?.addEventListener("submit", (event) => saveMember(event).catch(showError));
resetButton?.addEventListener("click", resetForm);
levelEl?.addEventListener("change", syncArticleAccess);
sendPaymentButton?.addEventListener("click", () => createPaymentOrder().catch(showError));

onAuthStateChanged(auth, async (user) => {
  if (!user || !isAdminEmail(user.email)) return;
  try {
    resetForm();
    await Promise.all([loadMembers(), loadPaymentBackendStatus()]);
  } catch (error) {
    showError(error);
    listEl.innerHTML = '<div class="empty">養生療癒會員資料暫時無法載入。</div>';
  }
});
