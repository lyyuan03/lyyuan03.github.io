import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const SMART_SLOT = "data-sponsor-smart-slot";
const LEGACY_SLOT = "data-sponsor-offer-slot";
const OFFER_CACHE_KEY = "lyyuan-sponsor-offer-public-v3";
const DAY = 24 * 60 * 60 * 1000;
const DEFAULT_OFFER = Object.freeze({
  status: "published",
  systemRecord: true,
  ready: false,
  promotionAvailable: true,
  promoLimit: 200,
  occupiedCount: 0,
  remaining: 200,
  promoPrice1: 150,
  promoPrice3: 400,
  regularPrice1: 180,
  regularPrice3: 500,
  promoPaymentUrl: "",
  regularPaymentUrl: ""
});

let offer = cachedOffer() || { ...DEFAULT_OFFER };
let currentUser = auth.currentUser || null;
let memberState = emptyMemberState();
let refreshSerial = 0;

function emptyMemberState() {
  return {
    loaded: false,
    email: "",
    sponsor: null,
    history: null,
    everPurchased: false,
    active: false,
    expired: false,
    expiresAt: null
  };
}

function cachedOffer() {
  try {
    const parsed = JSON.parse(localStorage.getItem(OFFER_CACHE_KEY) || "null");
    if (!parsed || parsed.status !== "published" || parsed.systemRecord !== true) return null;
    return { ...DEFAULT_OFFER, ...parsed };
  } catch {
    return null;
  }
}

function normalizeEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = toDate(value);
  return date
    ? new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium", timeZone: "Asia/Taipei" }).format(date)
    : "未設定";
}

function money(value) {
  return Number(value || 0).toLocaleString("zh-TW");
}

function normalizeOffer(data = {}) {
  const promoLimit = Math.max(1, Number(data.promoLimit || DEFAULT_OFFER.promoLimit));
  const occupiedCount = Math.max(0, Number(data.occupiedCount ?? data.paidCount ?? 0));
  const remaining = Math.max(0, Number(data.remaining ?? (promoLimit - occupiedCount)));
  return {
    ...DEFAULT_OFFER,
    ...data,
    ready: true,
    promoLimit,
    occupiedCount,
    remaining,
    promotionAvailable: data.promotionAvailable !== false && remaining > 0,
    promoPrice1: Number(data.promoPrice1 || DEFAULT_OFFER.promoPrice1),
    promoPrice3: Number(data.promoPrice3 || DEFAULT_OFFER.promoPrice3),
    regularPrice1: Number(data.regularPrice1 || DEFAULT_OFFER.regularPrice1),
    regularPrice3: Number(data.regularPrice3 || DEFAULT_OFFER.regularPrice3),
    promoPaymentUrl: String(data.promoPaymentUrl || "").trim(),
    regularPaymentUrl: String(data.regularPaymentUrl || "").trim()
  };
}

async function loadOffer() {
  try {
    const snapshot = await getDoc(doc(db, "articles", "sponsor-offer-status"));
    if (!snapshot.exists()) return offer;
    const data = snapshot.data() || {};
    if (data.status !== "published" || data.systemRecord !== true) return offer;
    offer = normalizeOffer(data);
    try { localStorage.setItem(OFFER_CACHE_KEY, JSON.stringify(offer)); } catch {}
  } catch (error) {
    console.warn("贊助閱讀方案暫時無法同步，先使用最近一次資料。", error);
  }
  return offer;
}

async function readOwnDocument(collectionName, email) {
  try {
    const snapshot = await getDoc(doc(db, collectionName, email));
    return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
  } catch (error) {
    if (error?.code !== "permission-denied") console.warn(`${collectionName} 資料暫時無法取得。`, error);
    return null;
  }
}

function validPaidSponsor(record = {}) {
  return record?.memberType === "sponsor-member"
    && record?.paymentStatus === "paid"
    && record?.articleAccess === true
    && record?.accessScope === "sponsor-paid-articles"
    && Number(record?.accessVersion || 0) >= 2;
}

function buildMemberState(email, sponsor, historyDoc) {
  const history = historyDoc?.sponsor || null;
  const sponsorPaid = validPaidSponsor(sponsor);
  const historyPaid = validPaidSponsor(history) && history?.verified === true;
  const purchaseCount = Math.max(
    Number(sponsor?.purchaseCount || 0),
    Number(history?.purchaseCount || 0),
    sponsorPaid || historyPaid ? 1 : 0
  );
  const everPurchased = purchaseCount > 0 || sponsorPaid || historyPaid;
  const expiresAt = toDate(sponsor?.expiresAt || history?.expiresAt);
  const active = Boolean(
    sponsorPaid
    && sponsor?.status === "active"
    && sponsor?.disabled !== true
    && sponsor?.suspended !== true
    && !sponsor?.revokedAt
    && expiresAt
    && expiresAt > new Date()
  );
  return {
    loaded: true,
    email,
    sponsor,
    history,
    everPurchased,
    active,
    expired: everPurchased && !active,
    expiresAt
  };
}

async function loadMemberState(user = currentUser) {
  if (!user?.email) {
    memberState = emptyMemberState();
    return memberState;
  }
  const email = normalizeEmail(user.email);
  const [sponsor, history] = await Promise.all([
    readOwnDocument("sponsorMemberAccess", email),
    readOwnDocument("membershipHistory", email)
  ]);
  memberState = buildMemberState(email, sponsor, history);
  return memberState;
}

function applicableTier() {
  if (!currentUser?.email || !memberState.loaded) return "unknown";
  if (memberState.everPurchased) return "regular";
  return offer.promotionAvailable ? "promo" : "regular";
}

function tierPrice(months, tier = applicableTier()) {
  const three = Number(months) === 3;
  if (tier === "promo") return three ? offer.promoPrice3 : offer.promoPrice1;
  return three ? offer.regularPrice3 : offer.regularPrice1;
}

function paymentUrlForTier(tier) {
  if (tier === "promo") return String(offer.promoPaymentUrl || "").trim();
  if (tier === "regular") return String(offer.regularPaymentUrl || "").trim();
  return "";
}

function daysUntilExpiry() {
  if (!memberState.active || !memberState.expiresAt) return null;
  return Math.max(0, Math.ceil((memberState.expiresAt.getTime() - Date.now()) / DAY));
}

function stateCopy() {
  if (!currentUser?.email) {
    return {
      eyebrow: "EMAIL-BASED PRICE CHECK",
      title: "登入後自動確認適用方案",
      description: "系統會依登入的 Gmail 自動判定價格；同一個 Email 僅有第一次購買可使用首次優惠，後續續期或重新購買一律使用原價。",
      button: "登入後確認適用價格",
      mode: "login"
    };
  }
  if (!memberState.loaded) {
    return {
      eyebrow: "CHECKING MEMBERSHIP",
      title: "正在確認您的閱讀資格",
      description: "正在依登入 Email 核對購買紀錄與適用價格。",
      button: "確認中…",
      mode: "loading"
    };
  }
  if (memberState.active) {
    const days = daysUntilExpiry();
    const warning = days !== null && days <= 7
      ? `您的閱讀權限將於 ${days === 0 ? "今天" : `${days} 天後`}到期。`
      : "提前續期會從目前到期日接續計算，不會損失尚未使用的天數。";
    return {
      eyebrow: days !== null && days <= 7 ? "EXPIRING SOON" : "ACTIVE READING ACCESS",
      title: `閱讀權限有效｜至 ${formatDate(memberState.expiresAt)}`,
      description: `${warning} 本次續期固定適用原價。`,
      button: "續期閱讀權限",
      mode: "renew"
    };
  }
  if (memberState.expired) {
    return {
      eyebrow: "REOPEN READING ACCESS",
      title: "您的贊助文章閱讀權限已到期",
      description: `此 Email 曾購買過贊助閱讀方案，重新開通將直接適用原價。${memberState.expiresAt ? ` 前一期到期日：${formatDate(memberState.expiresAt)}。` : ""}`,
      button: "重新開通閱讀權限",
      mode: "reopen"
    };
  }
  const promoText = offer.promotionAvailable
    ? `目前首次優惠尚餘 ${Number(offer.remaining || 0)} 名。`
    : "目前首次優惠名額已額滿。";
  return {
    eyebrow: offer.promotionAvailable ? "FIRST PURCHASE OFFER" : "REGULAR PRICE",
    title: offer.promotionAvailable ? "此 Email 可使用首次購買優惠" : "目前適用一般價格",
    description: `${promoText} 優惠資格僅限第一次購買，後續購買與續期一律回到原價。`,
    button: "立即加入",
    mode: "join"
  };
}

function priceMarkup() {
  if (!currentUser?.email || !memberState.loaded) {
    return `
      <div class="sponsor-smart-rules">
        <div><span>第一次購買且優惠尚有名額</span><strong>1 個月 NT$${money(offer.promoPrice1)}｜3 個月 NT$${money(offer.promoPrice3)}</strong></div>
        <div><span>曾購買過／續期／重新開通</span><strong>1 個月 NT$${money(offer.regularPrice1)}｜3 個月 NT$${money(offer.regularPrice3)}</strong></div>
      </div>`;
  }
  const tier = applicableTier();
  const tierLabel = tier === "promo" ? "首次購買優惠" : "原價／續期價";
  return `
    <div class="sponsor-smart-prices" aria-label="本次適用價格">
      <div><span>1 個月｜${tierLabel}</span><strong>NT$${money(tierPrice(1, tier))}</strong></div>
      <div><span>3 個月｜${tierLabel}</span><strong>NT$${money(tierPrice(3, tier))}</strong></div>
    </div>`;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

function slotMarkup(slot) {
  const copy = stateCopy();
  const context = slot.dataset.sponsorContext || "article";
  const emailNote = currentUser?.email && memberState.loaded
    ? `<small class="sponsor-smart-email">判定帳號｜${escapeHtml(memberState.email)}</small>`
    : "";
  return `
    <div class="sponsor-smart-panel is-${escapeHtml(copy.mode)} is-${escapeHtml(context)}">
      <div class="sponsor-smart-heading">
        <span>${escapeHtml(copy.eyebrow)}</span>
        <strong>${escapeHtml(copy.title)}</strong>
        <p>${escapeHtml(copy.description)}</p>
        ${emailNote}
      </div>
      ${priceMarkup()}
      <button class="sponsor-smart-button" type="button" data-sponsor-smart-pay ${copy.mode === "loading" ? "disabled" : ""}>${escapeHtml(copy.button)}</button>
      <p class="sponsor-smart-note">付款頁面可選擇 1 個月或 3 個月方案。付款完成後，由行政團隊核對款項並更新閱讀期限。</p>
    </div>`;
}

function claimLegacySlots(root = document) {
  root.querySelectorAll?.(`[${LEGACY_SLOT}]`).forEach((slot) => {
    slot.removeAttribute(LEGACY_SLOT);
    slot.setAttribute(SMART_SLOT, "");
  });
}

function renderSlots(root = document) {
  claimLegacySlots(root);
  root.querySelectorAll?.(`[${SMART_SLOT}]`).forEach((slot) => {
    const signature = [
      currentUser?.email || "guest",
      memberState.loaded ? "loaded" : "pending",
      memberState.everPurchased ? "returning" : "first",
      memberState.active ? "active" : memberState.expired ? "expired" : "none",
      memberState.expiresAt?.toISOString?.() || "",
      offer.promotionAvailable ? "promo-open" : "promo-closed",
      offer.remaining,
      offer.promoPrice1,
      offer.promoPrice3,
      offer.regularPrice1,
      offer.regularPrice3,
      slot.dataset.sponsorContext || "article"
    ].join("|");
    if (slot.dataset.sponsorSmartSignature === signature) return;
    slot.dataset.sponsorSmartSignature = signature;
    slot.innerHTML = slotMarkup(slot);
  });
}

function installStyles() {
  if (document.getElementById("sponsor-smart-checkout-styles")) return;
  const style = document.createElement("style");
  style.id = "sponsor-smart-checkout-styles";
  style.textContent = `
    [${SMART_SLOT}]{display:block;width:100%}
    .sponsor-smart-panel{display:grid;gap:14px;width:100%;padding:18px 16px;border:1px solid rgba(165,130,84,.38);background:linear-gradient(145deg,rgba(255,255,255,.68),rgba(245,239,228,.72));box-sizing:border-box;text-align:center;color:#594F47}
    .sponsor-smart-heading{display:grid;gap:7px}.sponsor-smart-heading>span{font-size:9px;letter-spacing:.18em;color:#8a6d49}.sponsor-smart-heading>strong{font-family:'Noto Serif TC',serif;font-size:18px;font-weight:600;line-height:1.6;color:#594F47}.sponsor-smart-heading p{margin:0!important;font-size:11px!important;line-height:1.8!important;color:rgba(70,55,43,.72)!important}.sponsor-smart-email{font-size:9px;color:#8a765e;word-break:break-all}
    .sponsor-smart-prices{display:grid;grid-template-columns:1fr 1fr;gap:10px}.sponsor-smart-prices>div,.sponsor-smart-rules>div{padding:11px 9px;border:1px solid rgba(125,94,55,.22);background:rgba(248,243,234,.82)}.sponsor-smart-prices span,.sponsor-smart-rules span{display:block;margin-bottom:4px;font-size:9px;color:#776550}.sponsor-smart-prices strong{display:block;font-size:17px;color:#5a4127}.sponsor-smart-rules{display:grid;gap:8px}.sponsor-smart-rules strong{display:block;font-size:11px;line-height:1.6;color:#5a4127}
    .sponsor-smart-button{display:flex;align-items:center;justify-content:center;width:100%;min-height:48px;padding:10px 16px;border:1px solid #8e6c45;background:#A58254;color:#fff;font-family:'Noto Sans TC',sans-serif;font-size:14px;font-weight:600;letter-spacing:.08em;cursor:pointer;box-shadow:0 9px 24px rgba(89,79,71,.12);transition:transform .18s ease,background .18s ease,box-shadow .18s ease}.sponsor-smart-button:hover{background:#8f6c43;transform:translateY(-1px);box-shadow:0 12px 28px rgba(89,79,71,.18)}.sponsor-smart-button:disabled{opacity:.58;cursor:wait;transform:none}
    .sponsor-smart-note{margin:0!important;font-size:9px!important;line-height:1.7!important;color:rgba(46,37,28,.58)!important}
    .sponsor-smart-panel.is-renew,.sponsor-smart-panel.is-reopen{border-color:rgba(96,99,48,.38);background:linear-gradient(145deg,rgba(248,246,238,.82),rgba(239,239,224,.82))}.sponsor-smart-panel.is-renew .sponsor-smart-button,.sponsor-smart-panel.is-reopen .sponsor-smart-button{background:#606330;border-color:#55592b}.sponsor-smart-panel.is-renew .sponsor-smart-button:hover,.sponsor-smart-panel.is-reopen .sponsor-smart-button:hover{background:#505329}
    .sponsor-smart-panel.is-dashboard{margin-top:12px;padding:14px}.sponsor-smart-panel.is-dashboard .sponsor-smart-heading>strong{font-size:16px}.sponsor-smart-panel.is-dashboard .sponsor-smart-note{display:none}
    @media(max-width:560px){.sponsor-smart-prices{grid-template-columns:1fr}.sponsor-smart-panel{padding:15px 12px}.sponsor-smart-rules strong{font-size:10px}}
  `;
  document.head.appendChild(style);
}

async function refreshAll() {
  const serial = ++refreshSerial;
  await loadOffer();
  if (currentUser?.email) await loadMemberState(currentUser);
  else memberState = emptyMemberState();
  if (serial !== refreshSerial) return;
  renderSlots();
}

function openLogin() {
  const loginButton = document.getElementById("member-login-button");
  if (loginButton) {
    loginButton.click();
    return;
  }
  window.location.href = "/member-dashboard.html";
}

async function handlePayment(button) {
  if (!currentUser?.email) {
    openLogin();
    return;
  }
  const original = button.textContent;
  button.disabled = true;
  button.textContent = "正在確認您的適用價格…";
  try {
    await refreshAll();
    const tier = applicableTier();
    if (tier === "unknown") {
      alert("會員資料尚未確認完成，請稍後再試。");
      return;
    }
    const paymentUrl = paymentUrlForTier(tier);
    if (!paymentUrl.startsWith("https://")) {
      alert(tier === "promo"
        ? "首次優惠付款連結尚未完成設定，請稍後再試或聯繫行政團隊。"
        : "續期／原價付款連結尚未完成設定，請稍後再試或聯繫行政團隊。");
      return;
    }
    window.location.assign(paymentUrl);
  } catch (error) {
    console.warn("付款前資格確認失敗。", error);
    alert("目前無法確認付款資格，請稍後重新整理頁面再試。");
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

installStyles();
claimLegacySlots();
renderSlots();
refreshAll().catch(console.warn);

onAuthStateChanged(auth, (user) => {
  currentUser = user || null;
  memberState = emptyMemberState();
  renderSlots();
  refreshAll().catch(console.warn);
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-sponsor-smart-pay]");
  if (!button) return;
  event.preventDefault();
  handlePayment(button);
}, true);

const observer = new MutationObserver((mutations) => {
  if (!mutations.some((mutation) => mutation.addedNodes.length > 0)) return;
  claimLegacySlots();
  renderSlots();
});
observer.observe(document.documentElement, { childList: true, subtree: true });

window.setInterval(() => refreshAll().catch(() => {}), 60000);
window.LingYuanSponsorCheckout = {
  refresh: () => refreshAll(),
  render: () => renderSlots(),
  getState: () => ({ offer: { ...offer }, member: { ...memberState }, tier: applicableTier() })
};
