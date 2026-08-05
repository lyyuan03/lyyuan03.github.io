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
const activateSponsorMembershipManually = httpsCallable(functions, "activateSponsorMembershipManually");
const backendStatusUrl = "https://asia-east1-lyyuan03-membership.cloudfunctions.net/membershipBackendStatus";
const offerStatusUrl = "https://asia-east1-lyyuan03-membership.cloudfunctions.net/sponsorOfferStatus";

let settings = {
  sponsorPromoLimit: 200,
  sponsorPromoPrice1: 120,
  sponsorPromoPrice3: 300,
  sponsorRegularPrice1: 150,
  sponsorRegularPrice3: 400,
  paymentDays: 3,
  reservationHours: 24,
  sponsorPromoPaymentUrl: "",
  sponsorRegularPaymentUrl: "",
  ecpayUrl: ""
};
let offerStatus = null;
let members = [];

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

function normalizeEmail(value = "") {
  return value.trim().toLowerCase();
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
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

function sponsorHistoryRecord(member = {}, historicalStatus = "verified") {
  const startsAt = member.startsAt || member.firstJoinedAt || null;
  if (member.memberType !== "sponsor-member"
      || member.paymentStatus !== "paid"
      || member.articleAccess !== true
      || member.accessScope !== "sponsor-paid-articles"
      || Number(member.accessVersion || 0) < 2
      || !String(member.lastOrderNo || "").trim()
      || !startsAt
      || !member.expiresAt) return null;
  const record = {
    memberType: "sponsor-member",
    articleAccess: true,
    accessScope: "sponsor-paid-articles",
    accessVersion: 2,
    paymentStatus: "paid",
    startsAt,
    expiresAt: member.expiresAt,
    lastOrderNo: member.lastOrderNo,
    verified: true,
    historicalStatus,
    verificationSource: "payment",
    recordedAt: serverTimestamp()
  };
  if (historicalStatus === "ended") record.endedAt = serverTimestamp();
  return record;
}

async function writeSponsorHistory(email, member, historicalStatus = "verified") {
  const record = sponsorHistoryRecord(member, historicalStatus);
  if (!record) return;
  await setDoc(doc(db, "membershipHistory", email), {
    email,
    sponsor: record,
    updatedAt: serverTimestamp()
  }, { merge: true });
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

function promotionAvailable() {
  return offerStatus ? offerStatus.promotionAvailable === true : true;
}

function currentTier() {
  return promotionAvailable() ? "promo" : "regular";
}

function planAmount(months) {
  const isThreeMonths = Number(months) === 3;
  if (currentTier() === "regular") {
    return isThreeMonths ? settings.sponsorRegularPrice3 : settings.sponsorRegularPrice1;
  }
  return isThreeMonths ? settings.sponsorPromoPrice3 : settings.sponsorPromoPrice1;
}

function installOfferAdminUi() {
  if (!settingsForm || document.getElementById("sponsor-offer-admin-status")) return;
  const promoPrice1 = document.getElementById("price-1");
  const promoPrice3 = document.getElementById("price-3");
  promoPrice1.readOnly = false;
  promoPrice3.readOnly = false;
  promoPrice1.closest(".field")?.querySelector("label")?.replaceChildren(document.createTextNode("優惠價｜一個月"));
  promoPrice3.closest(".field")?.querySelector("label")?.replaceChildren(document.createTextNode("優惠價｜三個月"));

  const grid = promoPrice1.closest(".grid");
  grid.insertAdjacentHTML("beforeend", `
    <div class="field"><label for="regular-price-1">第201名起｜一個月</label><input id="regular-price-1" type="number" min="1" step="1" value="150"></div>
    <div class="field"><label for="regular-price-3">第201名起｜三個月</label><input id="regular-price-3" type="number" min="1" step="1" value="400"></div>
    <div class="field"><label for="sponsor-promo-limit">優惠名額上限（人次）</label><input id="sponsor-promo-limit" type="number" min="1" step="1" value="200"></div>
  `);
  grid.insertAdjacentHTML("afterend", `
    <div id="sponsor-offer-admin-status" class="membership-summary" style="display:grid;gap:8px">
      <strong style="color:#CBAA77">前200名優惠進度載入中…</strong>
    </div>
    <p class="membership-help">優惠名額以「已完成付款」加上「尚未逾期的待付款訂單」合併計算；待付款連結逾期後，名額會自動釋出。第201人次起，系統將自動改用一般價格。</p>
  `);
}

function updatePlanOptions() {
  if (!monthsEl) return;
  const tierLabel = currentTier() === "promo" ? "前200名優惠" : "一般價格";
  const one = monthsEl.querySelector('option[value="1"]');
  const three = monthsEl.querySelector('option[value="3"]');
  if (one) one.textContent = `一個月｜${tierLabel} NT$${Number(planAmount(1)).toLocaleString("zh-TW")}`;
  if (three) three.textContent = `三個月｜${tierLabel} NT$${Number(planAmount(3)).toLocaleString("zh-TW")}`;
}

function renderOfferStatus() {
  const target = document.getElementById("sponsor-offer-admin-status");
  if (!target) return;
  if (!offerStatus) {
    target.innerHTML = '<strong style="color:#D8BD91">優惠名額狀態暫時無法取得</strong>';
    return;
  }
  const used = Number(offerStatus.occupiedCount || 0);
  const limit = Number(offerStatus.promoLimit || settings.sponsorPromoLimit || 200);
  const remaining = Number(offerStatus.remaining || 0);
  const percentage = Math.min(100, Math.max(0, (used / Math.max(1, limit)) * 100));
  target.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <strong style="color:#CBAA77">前${limit}名優惠｜已占用 ${used} 人次</strong>
      <span>${offerStatus.promotionAvailable ? `尚餘 ${remaining} 名` : "優惠名額已額滿"}</span>
    </div>
    <div style="height:8px;border:1px solid rgba(165,130,84,.26);background:rgba(4,8,3,.5)"><span style="display:block;width:${percentage}%;height:100%;background:#A58254"></span></div>
    <small style="color:rgba(245,240,232,.58)">已付款 ${Number(offerStatus.paidCount || 0)}｜待付款保留 ${Number(offerStatus.pendingCount || 0)}｜目前套用${offerStatus.promotionAvailable ? "優惠價" : "一般價"}</small>
  `;
}

function previewExpiry(existingExpiry = null) {
  const now = new Date();
  const currentExpiry = dateValue(existingExpiry);
  const base = currentExpiry && currentExpiry > now ? currentExpiry : now;
  return addMonths(base, selectedMonths());
}

function updatePlanPreview(forceAmount = false) {
  if (forceAmount || !amountEl.value) amountEl.value = String(planAmount(selectedMonths()) || "");
  if (!paymentUrlEl.value) paymentUrlEl.value = currentTier() === "promo" ? settings.sponsorPromoPaymentUrl : settings.sponsorRegularPaymentUrl;
  const originalEmail = normalizeEmail(document.getElementById("member-original-email").value);
  const existing = members.find((item) => item.email === originalEmail);
  const tierText = currentTier() === "promo"
    ? `前${offerStatus?.promoLimit || settings.sponsorPromoLimit}名優惠${offerStatus ? `｜尚餘 ${offerStatus.remaining} 名` : ""}`
    : "一般價格";
  summaryEl.textContent = `${tierText}｜本次 ${selectedMonths()} 個月｜應繳 NT$${Number(amountEl.value || 0).toLocaleString("zh-TW")}｜付款確認後預計到期日 ${formatDate(previewExpiry(existing?.expiresAt))}`;
}

function resetMemberForm() {
  memberForm.reset();
  document.getElementById("member-original-email").value = "";
  monthsEl.value = "1";
  paymentUrlEl.value = currentTier() === "promo" ? settings.sponsorPromoPaymentUrl : settings.sponsorRegularPaymentUrl;
  updatePlanOptions();
  updatePlanPreview(true);
}

async function loadSettings() {
  const snapshot = await getDoc(doc(db, "membershipSettings", "default"));
  const stored = snapshot.exists() ? snapshot.data() : {};
  settings = {
    ...settings,
    ...stored,
    sponsorPromoPrice1: positiveInteger(stored.sponsorPromoPrice1 ?? stored.price1, 120),
    sponsorPromoPrice3: positiveInteger(stored.sponsorPromoPrice3 ?? stored.price3, 300),
    sponsorRegularPrice1: positiveInteger(stored.sponsorRegularPrice1, 150),
    sponsorRegularPrice3: positiveInteger(stored.sponsorRegularPrice3, 400),
    sponsorPromoLimit: positiveInteger(stored.sponsorPromoLimit, 200),
    reservationHours: positiveInteger(stored.sponsorReservationHours, 24),
    sponsorPromoPaymentUrl: String(stored.sponsorPromoPaymentUrl || stored.ecpayUrl || "").trim(),
    sponsorRegularPaymentUrl: String(stored.sponsorRegularPaymentUrl || "").trim()
  };
  document.getElementById("price-1").value = String(settings.sponsorPromoPrice1);
  document.getElementById("price-3").value = String(settings.sponsorPromoPrice3);
  document.getElementById("regular-price-1").value = String(settings.sponsorRegularPrice1);
  document.getElementById("regular-price-3").value = String(settings.sponsorRegularPrice3);
  document.getElementById("sponsor-promo-limit").value = String(settings.sponsorPromoLimit);
  document.getElementById("sponsor-reservation-hours").value = String(settings.reservationHours || 24);
  document.getElementById("ecpay-url").value = settings.sponsorPromoPaymentUrl || "";
  document.getElementById("regular-ecpay-url").value = settings.sponsorRegularPaymentUrl || "";
  updatePlanOptions();
  updatePlanPreview(true);
}

async function saveSettings(event) {
  event.preventDefault();
  settings = {
    ...settings,
    price1: positiveInteger(document.getElementById("price-1").value, 120),
    price3: positiveInteger(document.getElementById("price-3").value, 300),
    sponsorPromoPrice1: positiveInteger(document.getElementById("price-1").value, 120),
    sponsorPromoPrice3: positiveInteger(document.getElementById("price-3").value, 300),
    sponsorRegularPrice1: positiveInteger(document.getElementById("regular-price-1").value, 150),
    sponsorRegularPrice3: positiveInteger(document.getElementById("regular-price-3").value, 400),
    sponsorPromoLimit: positiveInteger(document.getElementById("sponsor-promo-limit").value, 200),
    sponsorReservationHours: positiveInteger(document.getElementById("sponsor-reservation-hours").value, 24),
    sponsorPromoPaymentUrl: document.getElementById("ecpay-url").value.trim(),
    sponsorRegularPaymentUrl: document.getElementById("regular-ecpay-url").value.trim(),
    ecpayUrl: document.getElementById("ecpay-url").value.trim(),
    updatedAt: serverTimestamp()
  };
  await setDoc(doc(db, "membershipSettings", "default"), settings, { merge: true });
  statusEl.textContent = "方案、優惠名額與兩組綠界付款連結已儲存";
  await loadOfferStatus();
  updatePlanPreview(true);
}

async function loadOfferStatus() {
  try {
    const response = await fetch(`${offerStatusUrl}?t=${Date.now()}`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok || result.ready !== true) throw new Error("offer-status-not-ready");
    offerStatus = result;
    settings = {
      ...settings,
      sponsorPromoLimit: result.promoLimit,
      sponsorPromoPrice1: result.promoPrice1,
      sponsorPromoPrice3: result.promoPrice3,
      sponsorRegularPrice1: result.regularPrice1,
      sponsorRegularPrice3: result.regularPrice3
    };
  } catch (error) {
    console.warn("贊助會員優惠名額暫時無法取得。", error);
    offerStatus = null;
  }
  renderOfferStatus();
  updatePlanOptions();
  updatePlanPreview(true);
}

function memberPayload(paymentStatus = null, extendMembership = false) {
  const email = normalizeEmail(document.getElementById("member-email").value);
  const existing = members.find((item) => item.email === normalizeEmail(document.getElementById("member-original-email").value));
  const status = paymentStatus || document.getElementById("member-payment-status").value;
  const isPaid = status === "paid";
  return {
    email,
    name: document.getElementById("member-name").value.trim(),
    memberType: "sponsor-member",
    articleAccess: isPaid,
    wellnessAccess: false,
    planMonths: selectedMonths(),
    amount: Number(amountEl.value || 0),
    priceTier: existing?.priceTier || currentTier(),
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
  const original = normalizeEmail(document.getElementById("member-original-email").value);
  const existing = members.find((item) => item.email === original);
  const selectedPaymentStatus = document.getElementById("member-payment-status").value;
  const alreadyActivePaid = existing?.paymentStatus === "paid" && existing?.status === "active";
  if (selectedPaymentStatus === "paid" && !alreadyActivePaid) {
    statusEl.textContent = "為避免誤開權限，新增或待付款會員不能用「儲存會員資料」直接改成已付款；請使用「確認付款並開通」。";
    return;
  }

  const payload = memberPayload(alreadyActivePaid ? "paid" : "pending");
  if (!payload.email) return;
  await setDoc(doc(db, "sponsorMemberAccess", payload.email), payload, { merge: true });
  if (original && original !== payload.email) await deleteDoc(doc(db, "sponsorMemberAccess", original));
  statusEl.textContent = alreadyActivePaid ? "會員基本資料已更新，既有閱讀資格與效期維持不變" : "待付款會員資料已儲存，尚未開放閱讀權限";
  await loadMembers();
  resetMemberForm();
}

async function activateMember() {
  if (!memberForm.reportValidity()) return;
  activateButton.disabled = true;
  const originalLabel = activateButton.textContent;
  activateButton.textContent = "正在開通…";
  try {
    const result = await activateSponsorMembershipManually({
      email: normalizeEmail(document.getElementById("member-email").value),
      name: document.getElementById("member-name").value.trim(),
      planMonths: selectedMonths(),
      pendingOrderNo: members.find((item) => item.email === normalizeEmail(document.getElementById("member-email").value))?.pendingOrderNo || "",
      note: document.getElementById("member-note").value.trim()
    });
    const data = result.data;
    const tierText = data.priceTier === "promo" ? `前200名優惠第 ${data.promotionSequence} 名` : "一般價格";
    statusEl.textContent = `付款已確認並開通｜${tierText}｜NT$${Number(data.amount).toLocaleString("zh-TW")}／${data.planMonths}個月`;
    await Promise.all([loadMembers(), loadOfferStatus()]);
    resetMemberForm();
  } finally {
    activateButton.disabled = false;
    activateButton.textContent = originalLabel;
  }
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
    const data = result.data;
    const tierText = data.priceTier === "promo" ? `前200名優惠第 ${data.promotionSequence} 名` : "一般價格";
    statusEl.textContent = `繳費信已寄出｜${tierText}｜訂單 ${data.merchantTradeNo}｜NT$${Number(data.amount).toLocaleString("zh-TW")}／${data.planMonths}個月`;
    await Promise.all([loadMembers(), loadOfferStatus()]);
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
    console.warn("贊助會員金流後端尚未啟用。", error);
    sendPaymentButton.disabled = true;
    sendPaymentButton.textContent = "金流後端待完成安全設定";
  }
}

function paymentDeadline() {
  const date = new Date(Date.now() + Number(settings.reservationHours || 24) * 60 * 60 * 1000);
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
  const tierText = currentTier() === "promo" ? "前200名優惠" : "一般價格";
  const subject = `靈元院贊助會員｜${months}個月方案繳費通知`;
  const body = `${name}您好：\n\n感謝您申請靈元院贊助會員。\n\n方案：${tierText}\n會員期間：${months}個月\n應繳金額：新台幣 ${amount} 元\n付款期限：${paymentDeadline()}\n\n請由以下綠界連結完成付款：\n${paymentUrl}\n\n完成付款後，我們將於確認款項後開通會員閱讀資格。請使用本信收件 Email（${email}）登入官網。\n\n靈元院行政團隊`;
  location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function hasAuthoritativeSponsorAccess(member = {}) {
  const expiry = dateValue(member.expiresAt);
  return member.memberType === "sponsor-member"
    && member.status === "active"
    && member.paymentStatus === "paid"
    && member.articleAccess === true
    && member.accessScope === "sponsor-paid-articles"
    && Number(member.accessVersion || 0) >= 2
    && Boolean(String(member.lastOrderNo || "").trim())
    && member.disabled !== true
    && member.suspended !== true
    && !member.revokedAt
    && Boolean(expiry && expiry > new Date());
}

function renderMembers() {
  if (!members.length) {
    listEl.innerHTML = '<div class="empty">目前尚無贊助會員資料；此時任何一般登入帳號都不會取得贊助文章閱讀權限。</div>';
    return;
  }
  const pendingMembers = members.filter((member) => member.paymentStatus === "pending" || member.status === "pending");
  const formalMembers = members.filter((member) => !pendingMembers.includes(member));
  const renderRow = (member, pending = false) => {
    const active = hasAuthoritativeSponsorAccess(member);
    const label = pending ? "待核對付款" : active ? "有效" : member.status === "active" ? "權限資料不完整" : "已到期";
    const months = Number(pending ? member.pendingPlanMonths || member.planMonths : member.planMonths || 0);
    const amount = Number(pending ? member.pendingAmount || member.amount : member.amount || 0);
    const priceTier = pending ? member.pendingPriceTier || member.priceTier : member.priceTier;
    const sequence = pending ? member.pendingPromotionSequence || member.promotionSequence : member.promotionSequence;
    const tier = priceTier === "regular" ? "一般價" : sequence ? `優惠第${Number(sequence)}名` : "優惠價／舊資料";
    const deadline = pending && member.pendingPaymentDeadline ? `｜名額保留至 ${escapeHtml(formatDate(member.pendingPaymentDeadline))}` : "";
    return `<div class="member-row">
      <div>
        <strong>${escapeHtml(member.name || "未填姓名")}｜${escapeHtml(label)}</strong>
        <small>${escapeHtml(member.email)}｜${months}個月｜NT$${amount.toLocaleString("zh-TW")}｜${escapeHtml(tier)}${deadline}${pending ? "" : `｜到期 ${escapeHtml(formatDate(member.expiresAt))}`}</small>
      </div>
      <div class="member-row-actions">
        <button class="btn" type="button" data-edit="${escapeHtml(member.email)}">${pending ? "核對／開通" : "編輯"}</button>
        <button class="btn danger" type="button" data-delete="${escapeHtml(member.email)}">刪除</button>
      </div>
    </div>`;
  };
  const section = (title, note, items, pending) => `
    <section style="margin-bottom:24px">
      <h4 style="margin:0 0 6px;color:#CBAA77;font-size:17px">${title}（${items.length}）</h4>
      <p class="membership-help" style="margin-top:0">${note}</p>
      ${items.length ? items.map((member) => renderRow(member, pending)).join("") : '<div class="empty">目前沒有資料</div>'}
    </section>`;
  listEl.innerHTML = section("待核對付款", "收到綠界付款通知後，按「核對／開通」，確認 Email、方案及金額，再按「確認付款並開通」。", pendingMembers, true)
    + section("正式會員名單", "只有完成付款確認的會員，才會取得贊助文章閱讀權限與會員卡。", formalMembers, false);
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
  paymentUrlEl.value = member.pendingPaymentUrl || member.paymentUrl || (member.pendingPriceTier === "regular" ? settings.sponsorRegularPaymentUrl : settings.sponsorPromoPaymentUrl) || "";
  document.getElementById("member-note").value = member.note || "";
  updatePlanOptions();
  updatePlanPreview(false);
  memberForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function removeMember(email) {
  if (!confirm(`確定要刪除 ${email} 的會員資料嗎？`)) return;
  const member = members.find((item) => item.email === email);
  if (member) await writeSponsorHistory(email, member, "ended");
  await deleteDoc(doc(db, "sponsorMemberAccess", email));
  statusEl.textContent = "會員資料已刪除；符合條件的前期資格已保留於歷史紀錄";
  await Promise.all([loadMembers(), loadOfferStatus()]);
}

async function loadMembers() {
  const snapshot = await getDocs(collection(db, "sponsorMemberAccess"));
  members = snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => item.memberType === "sponsor-member")
    .sort((a, b) => String(a.email).localeCompare(String(b.email), "zh-TW"));
  renderMembers();
}

installOfferAdminUi();
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
  statusEl.textContent = error?.code === "permission-denied" ? "Firebase 會員權限尚未發布" : (error?.message || "會員資料處理失敗");
}

onAuthStateChanged(auth, async (user) => {
  if (!user || !isAdminEmail(user.email)) return;
  try {
    await loadSettings();
    await Promise.all([loadMembers(), loadPaymentBackendStatus(), loadOfferStatus()]);
  } catch (error) {
    showError(error);
    listEl.innerHTML = '<div class="empty">會員資料暫時無法載入，請確認 Firebase 規則與 Functions 已發布。</div>';
  }
});
