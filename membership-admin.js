import { app, auth, db, isAdminEmail } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";

const settingsForm = document.getElementById("membership-settings-form");
const memberForm = document.getElementById("member-form");
const statusEl = document.getElementById("membership-status");
const listEl = document.getElementById("membership-list");
const summaryEl = document.getElementById("member-summary");
const monthsEl = document.getElementById("member-months");
const amountEl = document.getElementById("member-amount");
const paymentUrlEl = document.getElementById("member-payment-url");
const activateButton = document.getElementById("member-activate");
const emailButton = document.getElementById("member-email-payment");
const sendPaymentButton = document.getElementById("member-send-payment");
const resetButton = document.getElementById("member-form-reset");
const functions = getFunctions(app, "asia-east1");
const createSponsorMembershipCheckout = httpsCallable(functions, "createSponsorMembershipCheckout");
const backendStatusUrl = "https://asia-east1-lyyuan03-membership.cloudfunctions.net/membershipBackendStatus";

let settings = { price1: 120, price3: 300, paymentDays: 3, ecpayUrl: "" };
let members = [];

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

function normalizeEmail(value = "") {
  return value.trim().toLowerCase();
}

function dateValue(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = dateValue(value);
  return date ? new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium" }).format(date) : "尚未開通";
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
  return Number(monthsEl.value) === 3 ? 3 : 1;
}

function planAmount(months) {
  return months === 3 ? 300 : 120;
}

function previewExpiry(existingExpiry = null) {
  const now = new Date();
  const currentExpiry = dateValue(existingExpiry);
  const base = currentExpiry && currentExpiry > now ? currentExpiry : now;
  return addMonths(base, selectedMonths());
}

function updatePlanPreview(forceAmount = false) {
  if (forceAmount || !amountEl.value) amountEl.value = String(planAmount(selectedMonths()) || "");
  if (!paymentUrlEl.value) paymentUrlEl.value = settings.ecpayUrl || "";
  const originalEmail = normalizeEmail(document.getElementById("member-original-email").value);
  const existing = members.find((item) => item.email === originalEmail);
  summaryEl.textContent = `本次 ${selectedMonths()} 個月｜應繳 NT$${Number(amountEl.value || 0).toLocaleString("zh-TW")}｜付款確認後預計到期日 ${formatDate(previewExpiry(existing?.expiresAt))}`;
}

function resetMemberForm() {
  memberForm.reset();
  document.getElementById("member-original-email").value = "";
  monthsEl.value = "1";
  paymentUrlEl.value = settings.ecpayUrl || "";
  updatePlanPreview(true);
}

async function loadSettings() {
  const snapshot = await getDoc(doc(db, "membershipSettings", "default"));
  if (snapshot.exists()) settings = { ...settings, ...snapshot.data() };
  settings.price1 = 120;
  settings.price3 = 300;
  document.getElementById("price-1").value = "120";
  document.getElementById("price-3").value = "300";
  document.getElementById("payment-days").value = settings.paymentDays || 3;
  document.getElementById("ecpay-url").value = settings.ecpayUrl || "";
  updatePlanPreview(true);
}

async function saveSettings(event) {
  event.preventDefault();
  settings = {
    price1: 120,
    price3: 300,
    paymentDays: Number(document.getElementById("payment-days").value || 3),
    ecpayUrl: document.getElementById("ecpay-url").value.trim(),
    updatedAt: serverTimestamp()
  };
  await setDoc(doc(db, "membershipSettings", "default"), settings, { merge: true });
  statusEl.textContent = "方案設定已儲存";
  updatePlanPreview(true);
}

function memberPayload(paymentStatus = null, extendMembership = false) {
  const email = normalizeEmail(document.getElementById("member-email").value);
  const existing = members.find((item) => item.email === normalizeEmail(document.getElementById("member-original-email").value));
  const status = paymentStatus || document.getElementById("member-payment-status").value;
  return {
    email,
    name: document.getElementById("member-name").value.trim(),
    planMonths: selectedMonths(),
    amount: Number(amountEl.value || 0),
    paymentUrl: paymentUrlEl.value.trim(),
    paymentStatus: status,
    status: status === "paid" ? "active" : "pending",
    startsAt: status === "paid" ? (existing?.startsAt || new Date().toISOString()) : (existing?.startsAt || null),
    expiresAt: status === "paid" && (extendMembership || !existing?.expiresAt)
      ? previewExpiry(existing?.expiresAt).toISOString()
      : (existing?.expiresAt || null),
    paidAt: status === "paid" && (extendMembership || !existing?.paidAt)
      ? new Date().toISOString()
      : (existing?.paidAt || null),
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
  statusEl.textContent = payload.paymentStatus === "paid" ? "會員資格已開通" : "會員資料已儲存";
  await loadMembers();
  resetMemberForm();
}

async function activateMember() {
  if (!memberForm.reportValidity()) return;
  const payload = memberPayload("paid", true);
  const original = normalizeEmail(document.getElementById("member-original-email").value);
  await setDoc(doc(db, "memberAccess", payload.email), payload, { merge: true });
  if (original && original !== payload.email) await deleteDoc(doc(db, "memberAccess", original));
  statusEl.textContent = "付款已確認，會員資格已開通";
  await loadMembers();
  resetMemberForm();
}

async function createPaymentOrder() {
  if (!memberForm.reportValidity()) return;
  sendPaymentButton.disabled = true;
  const originalLabel = sendPaymentButton.textContent;
  sendPaymentButton.textContent = "正在建立訂單並寄信…";
  statusEl.textContent = "";
  try {
    const result = await createSponsorMembershipCheckout({
      email: normalizeEmail(document.getElementById("member-email").value),
      name: document.getElementById("member-name").value.trim(),
      planMonths: selectedMonths()
    });
    statusEl.textContent = `繳費信已寄出｜訂單 ${result.data.merchantTradeNo}｜NT$${Number(result.data.amount).toLocaleString("zh-TW")}／${result.data.planMonths}個月`;
    await loadMembers();
    resetMemberForm();
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
    console.warn("一般會員金流後端尚未啟用。", error);
    sendPaymentButton.disabled = true;
    sendPaymentButton.textContent = "金流後端待完成安全設定";
  }
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
  if (!paymentUrl) {
    alert("請先填寫綠界付款連結。");
    return;
  }
  const subject = `靈元院贊助會員｜${months}個月方案繳費通知`;
  const body = `${name}您好：\n\n感謝您申請靈元院贊助會員。\n\n會員期間：${months}個月\n應繳金額：新台幣 ${amount} 元\n付款期限：${paymentDeadline()}\n\n請由以下綠界連結完成付款：\n${paymentUrl}\n\n完成付款後，我們將於確認款項後開通會員閱讀資格。請使用本信收件 Gmail（${email}）登入官網。\n\n靈元院行政團隊`;
  location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function renderMembers() {
  if (!members.length) {
    listEl.innerHTML = '<div class="empty">目前尚無會員資料</div>';
    return;
  }
  const now = new Date();
  listEl.innerHTML = members.map((member) => {
    const expiry = dateValue(member.expiresAt);
    const active = member.status === "active" && expiry && expiry > now;
    const label = member.paymentStatus === "pending" ? "待付款" : active ? "有效" : "已到期";
    return `<div class="member-row">
      <div>
        <strong>${escapeHtml(member.name || "未填姓名")}｜${escapeHtml(label)}</strong>
        <small>${escapeHtml(member.email)}｜${Number(member.planMonths || 0)}個月｜NT$${Number(member.amount || 0).toLocaleString("zh-TW")}｜到期 ${escapeHtml(formatDate(member.expiresAt))}</small>
      </div>
      <div class="member-row-actions">
        <button class="btn" type="button" data-edit="${escapeHtml(member.email)}">編輯</button>
        <button class="btn danger" type="button" data-delete="${escapeHtml(member.email)}">刪除</button>
      </div>
    </div>`;
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
  monthsEl.value = Number(member.planMonths) === 3 ? "3" : "1";
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
  members = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => String(a.email).localeCompare(String(b.email), "zh-TW"));
  renderMembers();
}

settingsForm?.addEventListener("submit", (event) => saveSettings(event).catch(showError));
memberForm?.addEventListener("submit", (event) => saveMember(event).catch(showError));
monthsEl?.addEventListener("change", () => updatePlanPreview(true));
amountEl?.addEventListener("input", () => updatePlanPreview(false));
activateButton?.addEventListener("click", () => activateMember().catch(showError));
emailButton?.addEventListener("click", openPaymentEmail);
sendPaymentButton?.addEventListener("click", () => createPaymentOrder().catch(showError));
resetButton?.addEventListener("click", resetMemberForm);

function showError(error) {
  console.error(error);
  statusEl.textContent = error?.code === "permission-denied" ? "Firebase 會員權限尚未發布" : "會員資料處理失敗";
}

onAuthStateChanged(auth, async (user) => {
  if (!user || !isAdminEmail(user.email)) return;
  try {
    await Promise.all([loadSettings(), loadMembers(), loadPaymentBackendStatus()]);
  } catch (error) {
    showError(error);
    listEl.innerHTML = '<div class="empty">會員資料暫時無法載入，請確認 Firebase 規則已發布。</div>';
  }
});
