import { auth, db, isAdminEmail } from "./firebase-config.js";
import { MEMBER_LEVELS, memberLevelLabel, normalizeMemberLevel, toDate } from "./member-access.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const settingsForm = document.getElementById("membership-settings-form");
const memberForm = document.getElementById("member-form");
const statusEl = document.getElementById("membership-status");
const listEl = document.getElementById("membership-list");
const summaryEl = document.getElementById("member-summary");
const monthsEl = document.getElementById("member-months");
const customMonthsEl = document.getElementById("member-custom-months");
const amountEl = document.getElementById("member-amount");
const paymentUrlEl = document.getElementById("member-payment-url");
const activateButton = document.getElementById("member-activate");
const emailButton = document.getElementById("member-email-payment");
const resetButton = document.getElementById("member-form-reset");
const expiryModeEl = document.getElementById("member-expiry-mode");
const customExpiryEl = document.getElementById("member-custom-expiry");
const levelEl = document.getElementById("member-level");
const firstJoinedAtEl = document.getElementById("member-first-joined-at");

let settings = { price1: 0, price3: 0, price12: 0, paymentDays: 3, ecpayUrl: "" };
let members = [];

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}
function normalizeEmail(value = "") { return value.trim().toLowerCase(); }
function formatDate(value) {
  const date = toDate(value);
  return date ? new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium" }).format(date) : "尚未設定";
}
function toDateInputValue(value) {
  const date = toDate(value);
  if (!date) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}
function dateInputToDate(value, endOfDay = false) {
  if (!value) return null;
  const time = endOfDay ? "23:59:59" : "00:00:00";
  const date = new Date(`${value}T${time}+08:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}
function addMonths(date, months) {
  const result = new Date(date);
  const originalDay = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(originalDay, lastDay));
  return result;
}
function selectedMonths() {
  return monthsEl.value === "custom" ? Math.max(1, Number(customMonthsEl.value || 1)) : Number(monthsEl.value || 1);
}
function planAmount(months) {
  if (months === 1) return Number(settings.price1 || 0);
  if (months === 3) return Number(settings.price3 || 0);
  if (months === 12) return Number(settings.price12 || 0);
  return Number(settings.price1 || 0) * months;
}
function calculatedExpiry(existingExpiry = null) {
  const now = new Date();
  const currentExpiry = toDate(existingExpiry);
  const base = currentExpiry && currentExpiry > now ? currentExpiry : now;
  return addMonths(base, selectedMonths());
}
function previewExpiry(existingExpiry = null) {
  if (expiryModeEl?.value === "custom") return dateInputToDate(customExpiryEl?.value, true) || calculatedExpiry(existingExpiry);
  return calculatedExpiry(existingExpiry);
}
function updateExpiryControls() {
  const custom = expiryModeEl?.value === "custom";
  if (customExpiryEl) customExpiryEl.disabled = !custom;
}
function updatePlanPreview(forceAmount = false) {
  customMonthsEl.disabled = monthsEl.value !== "custom";
  updateExpiryControls();
  if (forceAmount || !amountEl.value) amountEl.value = String(planAmount(selectedMonths()) || "");
  if (!paymentUrlEl.value) paymentUrlEl.value = settings.ecpayUrl || "";
  const originalEmail = normalizeEmail(document.getElementById("member-original-email").value);
  const existing = members.find((item) => item.email === originalEmail);
  const expiry = previewExpiry(existing?.expiresAt);
  const firstJoined = dateInputToDate(firstJoinedAtEl?.value) || toDate(existing?.firstJoinedAt) || toDate(existing?.startsAt) || new Date();
  summaryEl.textContent = `${memberLevelLabel(levelEl?.value)}｜首次加入 ${formatDate(firstJoined)}｜${selectedMonths()} 個月｜應繳 NT$${Number(amountEl.value || 0).toLocaleString("zh-TW")}｜到期日 ${formatDate(expiry)}`;
}
function resetMemberForm() {
  memberForm.reset();
  document.getElementById("member-original-email").value = "";
  monthsEl.value = "1";
  customMonthsEl.value = "1";
  if (levelEl) levelEl.value = "wellness";
  if (expiryModeEl) expiryModeEl.value = "months";
  if (customExpiryEl) customExpiryEl.value = "";
  if (firstJoinedAtEl) firstJoinedAtEl.value = new Date().toISOString().slice(0, 10);
  paymentUrlEl.value = settings.ecpayUrl || "";
  updatePlanPreview(true);
}
async function loadSettings() {
  const snapshot = await getDoc(doc(db, "membershipSettings", "default"));
  if (snapshot.exists()) settings = { ...settings, ...snapshot.data() };
  document.getElementById("price-1").value = settings.price1 || "";
  document.getElementById("price-3").value = settings.price3 || "";
  document.getElementById("price-12").value = settings.price12 || "";
  document.getElementById("payment-days").value = settings.paymentDays || 3;
  document.getElementById("ecpay-url").value = settings.ecpayUrl || "";
  updatePlanPreview(true);
}
async function saveSettings(event) {
  event.preventDefault();
  settings = {
    price1: Number(document.getElementById("price-1").value || 0),
    price3: Number(document.getElementById("price-3").value || 0),
    price12: Number(document.getElementById("price-12").value || 0),
    paymentDays: Number(document.getElementById("payment-days").value || 3),
    ecpayUrl: document.getElementById("ecpay-url").value.trim(),
    updatedAt: serverTimestamp()
  };
  await setDoc(doc(db, "membershipSettings", "default"), settings, { merge: true });
  statusEl.textContent = "方案設定已儲存";
  updatePlanPreview(true);
}
function memberPayload(paymentStatus = null, activateMembership = false) {
  const email = normalizeEmail(document.getElementById("member-email").value);
  const existing = members.find((item) => item.email === normalizeEmail(document.getElementById("member-original-email").value));
  const status = paymentStatus || document.getElementById("member-payment-status").value;
  const expiry = previewExpiry(existing?.expiresAt);
  const firstJoinedAt = dateInputToDate(firstJoinedAtEl?.value) || toDate(existing?.firstJoinedAt) || toDate(existing?.startsAt) || new Date();
  return {
    email,
    name: document.getElementById("member-name").value.trim(),
    memberLevel: normalizeMemberLevel(levelEl?.value),
    planMonths: selectedMonths(),
    amount: Number(amountEl.value || 0),
    paymentUrl: paymentUrlEl.value.trim(),
    paymentStatus: status,
    status: status === "paid" ? "active" : "pending",
    firstJoinedAt: firstJoinedAt.toISOString(),
    startsAt: status === "paid" ? (existing?.startsAt || firstJoinedAt.toISOString()) : (existing?.startsAt || null),
    expiresAt: status === "paid" && (activateMembership || !existing?.expiresAt) ? expiry.toISOString() : (existing?.expiresAt || null),
    paidAt: status === "paid" && (activateMembership || !existing?.paidAt) ? new Date().toISOString() : (existing?.paidAt || null),
    note: document.getElementById("member-note").value.trim(),
    updatedAt: serverTimestamp()
  };
}
async function saveMember(event) {
  event.preventDefault();
  const payload = memberPayload();
  if (!payload.email) return;
  const original = normalizeEmail(document.getElementById("member-original-email").value);
  await setDoc(doc(db, "memberAccess", payload.email), payload, { merge: true });
  if (original && original !== payload.email) await deleteDoc(doc(db, "memberAccess", original));
  statusEl.textContent = payload.paymentStatus === "paid" ? "會員資格已儲存" : "會員資料已儲存";
  await loadMembers();
  resetMemberForm();
}
async function activateMember() {
  if (!memberForm.reportValidity()) return;
  const payload = memberPayload("paid", true);
  const original = normalizeEmail(document.getElementById("member-original-email").value);
  await setDoc(doc(db, "memberAccess", payload.email), payload, { merge: true });
  if (original && original !== payload.email) await deleteDoc(doc(db, "memberAccess", original));
  statusEl.textContent = `${memberLevelLabel(payload.memberLevel)}已開通，到期日 ${formatDate(payload.expiresAt)}`;
  await loadMembers();
  resetMemberForm();
}
function paymentDeadline() {
  const date = new Date();
  date.setDate(date.getDate() + Number(settings.paymentDays || 3));
  return formatDate(date);
}
function openPaymentEmail() {
  if (!memberForm.reportValidity()) return;
  const email = normalizeEmail(document.getElementById("member-email").value);
  const name = document.getElementById("member-name").value.trim() || "會員";
  const months = selectedMonths();
  const amount = Number(amountEl.value || 0).toLocaleString("zh-TW");
  const paymentUrl = paymentUrlEl.value.trim();
  const level = memberLevelLabel(levelEl?.value);
  if (!paymentUrl) { alert("請先填寫綠界付款連結。"); return; }
  const subject = `靈元院${level}｜${months}個月方案繳費通知`;
  const body = `${name}您好：\n\n感謝您申請靈元院${level}。\n\n會員期間：${months}個月\n預計到期日：${formatDate(previewExpiry())}\n應繳金額：新台幣 ${amount} 元\n付款期限：${paymentDeadline()}\n\n請由以下綠界連結完成付款：\n${paymentUrl}\n\n完成付款後，我們將於確認款項後開通會員資格。請使用本信收件 Gmail（${email}）登入官網。\n\n靈元院行政團隊`;
  location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
function renderMembers() {
  if (!members.length) { listEl.innerHTML = '<div class="empty">目前尚無會員資料</div>'; return; }
  const now = new Date();
  listEl.innerHTML = members.map((member) => {
    const expiry = toDate(member.expiresAt);
    const active = member.status === "active" && expiry && expiry > now;
    const label = member.paymentStatus === "pending" ? "待付款" : active ? "有效" : "已到期";
    const level = memberLevelLabel(member.memberLevel);
    return `<div class="member-row"><div><strong>${escapeHtml(member.name || "未填姓名")}｜${escapeHtml(level)}｜${escapeHtml(label)}</strong><small>${escapeHtml(member.email)}｜首次加入 ${escapeHtml(formatDate(member.firstJoinedAt || member.startsAt))}｜到期 ${escapeHtml(formatDate(member.expiresAt))}</small></div><div class="member-row-actions"><button class="btn" type="button" data-edit="${escapeHtml(member.email)}">編輯</button><a class="btn" href="member-videos.html?preview=${encodeURIComponent(member.email)}" target="_blank">預覽影片</a><button class="btn danger" type="button" data-delete="${escapeHtml(member.email)}">刪除</button></div></div>`;
  }).join("");
  listEl.querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => editMember(button.dataset.edit)));
  listEl.querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", () => removeMember(button.dataset.delete)));
}
function editMember(email) {
  const member = members.find((item) => item.email === email);
  if (!member) return;
  document.getElementById("member-original-email").value = member.email;
  document.getElementById("member-name").value = member.name || "";
  document.getElementById("member-email").value = member.email || "";
  if (levelEl) levelEl.value = normalizeMemberLevel(member.memberLevel);
  const standard = [1, 3, 4, 6, 12].includes(Number(member.planMonths));
  monthsEl.value = standard ? String(member.planMonths) : "custom";
  customMonthsEl.value = String(member.planMonths || 1);
  if (expiryModeEl) expiryModeEl.value = "custom";
  if (customExpiryEl) customExpiryEl.value = toDateInputValue(member.expiresAt);
  if (firstJoinedAtEl) firstJoinedAtEl.value = toDateInputValue(member.firstJoinedAt || member.startsAt);
  amountEl.value = String(member.amount || "");
  document.getElementById("member-payment-status").value = member.paymentStatus || "pending";
  paymentUrlEl.value = member.paymentUrl || settings.ecpayUrl || "";
  document.getElementById("member-note").value = member.note || "";
  updatePlanPreview(false);
  memberForm.scrollIntoView({ behavior: "smooth", block: "start" });
}
async function removeMember(email) {
  if (!confirm(`確定要刪除 ${email} 的會員資料嗎？`)) return;
  await deleteDoc(doc(db, "memberAccess", email));
  statusEl.textContent = "會員資料已刪除";
  await loadMembers();
}
async function loadMembers() {
  const snapshot = await getDocs(collection(db, "memberAccess"));
  members = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => String(a.email).localeCompare(String(b.email), "zh-TW"));
  renderMembers();
}
function showError(error) {
  console.error(error);
  statusEl.textContent = error?.code === "permission-denied" ? "Firebase 會員管理權限尚未發布" : "會員資料處理失敗";
}
settingsForm?.addEventListener("submit", (event) => saveSettings(event).catch(showError));
memberForm?.addEventListener("submit", (event) => saveMember(event).catch(showError));
activateButton?.addEventListener("click", () => activateMember().catch(showError));
emailButton?.addEventListener("click", openPaymentEmail);
resetButton?.addEventListener("click", resetMemberForm);
monthsEl?.addEventListener("change", () => updatePlanPreview(true));
customMonthsEl?.addEventListener("input", () => updatePlanPreview(true));
expiryModeEl?.addEventListener("change", () => updatePlanPreview(false));
customExpiryEl?.addEventListener("change", () => updatePlanPreview(false));
levelEl?.addEventListener("change", () => updatePlanPreview(false));
firstJoinedAtEl?.addEventListener("change", () => updatePlanPreview(false));

onAuthStateChanged(auth, async (user) => {
  if (!user || !isAdminEmail(user.email)) return;
  try { await Promise.all([loadSettings(), loadMembers()]); } catch (error) { showError(error); }
});
