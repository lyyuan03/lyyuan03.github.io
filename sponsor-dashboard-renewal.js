import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const OFFER_CACHE_KEY = "lyyuan:sponsor:dashboard-renewal-offer-v2";
const DEFAULT_RENEWAL_OFFER = Object.freeze({
  regularPrice1: 180,
  regularPrice3: 500,
  regularPaymentUrl: "",
  publicUpdatedAt: ""
});

let sponsorState = null;
let currentEmail = "";
let scheduled = 0;
let renewalOffer = cachedRenewalOffer() || { ...DEFAULT_RENEWAL_OFFER };
let renewalOfferLive = false;
let renewalOfferLoading = false;

function normalizeEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function positivePrice(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : fallback;
}

function money(value) {
  return `NT$${Number(value || 0).toLocaleString("zh-TW")}`;
}

function cachedRenewalOffer() {
  try {
    const parsed = JSON.parse(localStorage.getItem(OFFER_CACHE_KEY) || "null");
    if (!parsed || typeof parsed !== "object") return null;
    return {
      regularPrice1: positivePrice(parsed.regularPrice1, DEFAULT_RENEWAL_OFFER.regularPrice1),
      regularPrice3: positivePrice(parsed.regularPrice3, DEFAULT_RENEWAL_OFFER.regularPrice3),
      regularPaymentUrl: String(parsed.regularPaymentUrl || "").trim(),
      publicUpdatedAt: String(parsed.publicUpdatedAt || "")
    };
  } catch {
    return null;
  }
}

function normalizeRenewalOffer(data = {}) {
  return {
    regularPrice1: positivePrice(data.regularPrice1, DEFAULT_RENEWAL_OFFER.regularPrice1),
    regularPrice3: positivePrice(data.regularPrice3, DEFAULT_RENEWAL_OFFER.regularPrice3),
    regularPaymentUrl: String(data.regularPaymentUrl || "").trim(),
    publicUpdatedAt: String(data.publicUpdatedAt || "")
  };
}

async function loadRenewalOffer({ force = false } = {}) {
  if (renewalOfferLoading && !force) return renewalOffer;
  renewalOfferLoading = true;
  try {
    const snapshot = await getDoc(doc(db, "articles", "sponsor-offer-status"));
    const data = snapshot.exists() ? snapshot.data() || {} : {};
    if (data.status !== "published" || data.systemRecord !== true) {
      throw new Error("贊助閱讀方案公開設定尚未同步");
    }
    renewalOffer = normalizeRenewalOffer(data);
    renewalOfferLive = true;
    try { localStorage.setItem(OFFER_CACHE_KEY, JSON.stringify(renewalOffer)); } catch {}
  } catch (error) {
    renewalOfferLive = false;
    console.warn("會員中心續期方案暫時無法同步，先使用最近一次設定。", error);
  } finally {
    renewalOfferLoading = false;
    scheduleSync();
  }
  return renewalOffer;
}

function validPaidSponsor(record = {}) {
  return record?.memberType === "sponsor-member"
    && record?.paymentStatus === "paid"
    && record?.articleAccess === true
    && record?.accessScope === "sponsor-paid-articles"
    && Number(record?.accessVersion || 0) >= 2;
}

async function safeGet(collectionName, email) {
  try {
    const snapshot = await getDoc(doc(db, collectionName, email));
    return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
  } catch (error) {
    if (error?.code !== "permission-denied") console.warn(`${collectionName} 無法取得。`, error);
    return null;
  }
}

async function loadSponsorState(email) {
  const [sponsor, historyDoc] = await Promise.all([
    safeGet("sponsorMemberAccess", email),
    safeGet("membershipHistory", email)
  ]);
  const history = historyDoc?.sponsor || null;
  const currentPaid = validPaidSponsor(sponsor);
  const historyPaid = validPaidSponsor(history) && history?.verified === true;
  const expiresAt = toDate(sponsor?.expiresAt || history?.expiresAt);
  const active = Boolean(
    currentPaid
    && sponsor?.status === "active"
    && sponsor?.disabled !== true
    && sponsor?.suspended !== true
    && !sponsor?.revokedAt
    && expiresAt
    && expiresAt > new Date()
  );
  return {
    sponsor,
    history,
    everPurchased: currentPaid || historyPaid || Number(sponsor?.purchaseCount || history?.purchaseCount || 0) > 0,
    active,
    expiresAt
  };
}

function installStyles() {
  if (document.getElementById("dashboard-sponsor-renewal-styles")) return;
  const style = document.createElement("style");
  style.id = "dashboard-sponsor-renewal-styles";
  style.textContent = `
    .dashboard-sponsor-renewal{margin-top:14px;padding-top:14px;border-top:1px solid rgba(165,130,84,.2)}
    .dashboard-sponsor-renewal-label{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:10px;font-size:10px;line-height:1.6;color:rgba(89,79,71,.68)}
    .dashboard-sponsor-renewal-label strong{font-size:12px;color:#594F47;font-weight:600}
    #dashboard-access-panel .dashboard-sponsor-reopen{position:relative;z-index:2;max-width:560px;margin:20px auto 0}
    .dashboard-renewal-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .dashboard-renewal-plan{display:flex;min-height:104px;padding:13px 10px;flex-direction:column;align-items:center;justify-content:center;border:1px solid rgba(125,94,55,.34);background:rgba(255,255,255,.54);color:#493724;cursor:pointer;font-family:'Noto Sans TC',sans-serif;transition:transform .18s ease,border-color .18s ease,background .18s ease}
    .dashboard-renewal-plan:hover{transform:translateY(-2px);border-color:rgba(125,94,55,.62);background:#fff}
    .dashboard-renewal-plan:disabled{opacity:.56;cursor:wait;transform:none}
    .dashboard-renewal-plan span{font-size:11px;letter-spacing:.08em;color:#725D48}
    .dashboard-renewal-plan strong{margin:5px 0 1px;font-family:'Noto Serif TC',serif;font-size:22px;color:#4E3821;font-weight:500}
    .dashboard-renewal-plan small{margin-top:4px;color:#806C56;font-size:10px}
    .dashboard-renewal-note{margin:10px 0 0;color:#766757;font-size:10px;line-height:1.7;text-align:center}
    .dashboard-renewal-retry{margin:10px auto 0;padding:8px 13px;border:1px solid rgba(125,94,55,.34);background:transparent;color:#5A4127;cursor:pointer;font:inherit;font-size:11px;display:block}
    @media(max-width:560px){.dashboard-sponsor-renewal-label{display:grid;text-align:left}.dashboard-renewal-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}

function renewalMarkup() {
  const paymentReady = renewalOffer.regularPaymentUrl.startsWith("https://");
  const syncText = renewalOfferLive
    ? "續期固定適用原價／續期價，付款頁將另開新分頁。"
    : paymentReady
      ? "目前使用最近一次已同步的續期設定。"
      : "續期價格已恢復，付款連結正在重新同步。";
  return `
    <div class="dashboard-renewal-grid" aria-label="贊助文章續期方案">
      <button type="button" class="dashboard-renewal-plan" data-dashboard-renewal-months="1"${paymentReady ? "" : " disabled"}>
        <span>1 個月續期</span>
        <strong>${money(renewalOffer.regularPrice1)}</strong>
        <small>原價／續期價</small>
      </button>
      <button type="button" class="dashboard-renewal-plan" data-dashboard-renewal-months="3"${paymentReady ? "" : " disabled"}>
        <span>3 個月續期</span>
        <strong>${money(renewalOffer.regularPrice3)}</strong>
        <small>原價／續期價</small>
      </button>
    </div>
    <p class="dashboard-renewal-note">${syncText}</p>
    ${paymentReady ? "" : '<button type="button" class="dashboard-renewal-retry" data-dashboard-renewal-retry>重新讀取方案</button>'}
  `;
}

function renewalOfferSignature() {
  return [
    renewalOffer.regularPrice1,
    renewalOffer.regularPrice3,
    renewalOffer.regularPaymentUrl,
    renewalOfferLive
  ].join("|");
}

function renderRenewalOffers() {
  const signature = renewalOfferSignature();
  const markup = renewalMarkup();
  document.querySelectorAll("[data-dashboard-renewal-offer]").forEach((node) => {
    // 只有續期資料真正改變時才重建內容。無條件改寫 innerHTML 會再次觸發
    // body 的 MutationObserver，形成每 60ms 一次的無限更新循環並鎖住捲動。
    if (node.dataset.renewalOfferSignature === signature) return;
    node.innerHTML = markup;
    node.dataset.renewalOfferSignature = signature;
  });
}

function removeInjected() {
  document.querySelectorAll("[data-dashboard-sponsor-renewal]").forEach((node) => node.remove());
}

function ensureActivePanel() {
  if (!sponsorState?.active) return false;
  const access = document.getElementById("dashboard-article-access");
  const card = access?.closest(".rights-card");
  const dashboard = document.getElementById("member-dashboard");
  if (!access || !card || dashboard?.hidden) return false;
  if (card.querySelector("[data-dashboard-sponsor-renewal]")) {
    renderRenewalOffers();
    return true;
  }
  const wrap = document.createElement("div");
  wrap.className = "dashboard-sponsor-renewal";
  wrap.setAttribute("data-dashboard-sponsor-renewal", "active");
  wrap.innerHTML = `
    <div class="dashboard-sponsor-renewal-label"><strong>贊助文章閱讀方案</strong><span>可在會員中心直接續期</span></div>
    <div data-dashboard-renewal-offer></div>`;
  card.appendChild(wrap);
  renderRenewalOffers();
  return true;
}

function ensureExpiredPanel() {
  if (!sponsorState?.everPurchased || sponsorState?.active) return false;
  const dashboard = document.getElementById("member-dashboard");
  const accessPanel = document.getElementById("dashboard-access-panel");
  if (!accessPanel || !dashboard?.hidden || accessPanel.hidden) return false;
  if (accessPanel.querySelector("[data-dashboard-sponsor-renewal]")) {
    renderRenewalOffers();
    return true;
  }
  const wrap = document.createElement("div");
  wrap.className = "dashboard-sponsor-reopen";
  wrap.setAttribute("data-dashboard-sponsor-renewal", "expired");
  wrap.innerHTML = `
    <div class="dashboard-sponsor-renewal-label"><strong>贊助文章閱讀方案</strong><span>可直接重新續期</span></div>
    <div data-dashboard-renewal-offer></div>`;
  accessPanel.appendChild(wrap);
  renderRenewalOffers();
  return true;
}

function syncPanel() {
  if (!currentEmail || !sponsorState?.everPurchased) {
    removeInjected();
    return;
  }
  const wanted = sponsorState.active ? "active" : "expired";
  document.querySelectorAll("[data-dashboard-sponsor-renewal]").forEach((node) => {
    if (node.getAttribute("data-dashboard-sponsor-renewal") !== wanted) node.remove();
  });
  if (sponsorState.active) ensureActivePanel();
  else ensureExpiredPanel();
  renderRenewalOffers();
}

function scheduleSync() {
  window.clearTimeout(scheduled);
  scheduled = window.setTimeout(syncPanel, 60);
}

async function openRenewalPayment(months) {
  if (![1, 3].includes(Number(months))) return;
  if (!renewalOffer.regularPaymentUrl.startsWith("https://")) {
    await loadRenewalOffer({ force: true });
  }
  const paymentUrl = String(renewalOffer.regularPaymentUrl || "").trim();
  if (!paymentUrl.startsWith("https://")) {
    alert("續期付款連結目前尚未完成同步，請稍後再按一次「重新讀取方案」。");
    return;
  }
  try {
    localStorage.setItem("lyyuan:sponsor:pending-plan", String(months));
    localStorage.setItem("lyyuan:sponsor:pending-tier", "regular");
  } catch {}
  const popup = window.open("about:blank", "_blank");
  if (!popup) {
    alert("瀏覽器阻擋了新的付款分頁，請允許本網站開啟新分頁後再試一次。");
    return;
  }
  try { popup.opener = null; } catch {}
  popup.location.replace(paymentUrl);
}

installStyles();

const observer = new MutationObserver(scheduleSync);
observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });

document.addEventListener("click", (event) => {
  const retry = event.target.closest?.("[data-dashboard-renewal-retry]");
  if (retry) {
    event.preventDefault();
    void loadRenewalOffer({ force: true });
    return;
  }
  const plan = event.target.closest?.("[data-dashboard-renewal-months]");
  if (!plan) return;
  event.preventDefault();
  void openRenewalPayment(Number(plan.dataset.dashboardRenewalMonths));
}, true);

onAuthStateChanged(auth, async (user) => {
  currentEmail = normalizeEmail(user?.email || "");
  sponsorState = null;
  removeInjected();
  if (!currentEmail) return;
  const [state] = await Promise.all([
    loadSponsorState(currentEmail),
    loadRenewalOffer()
  ]);
  sponsorState = state;
  scheduleSync();
});
