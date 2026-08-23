import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let sponsorState = null;
let currentEmail = "";
let scheduled = 0;

function normalizeEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
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
    .dashboard-sponsor-renewal-label{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:8px;font-size:10px;line-height:1.6;color:rgba(89,79,71,.68)}
    .dashboard-sponsor-renewal-label strong{font-size:12px;color:#594F47;font-weight:600}
    #dashboard-access-panel .dashboard-sponsor-reopen{position:relative;z-index:2;max-width:560px;margin:20px auto 0}
    @media(max-width:560px){.dashboard-sponsor-renewal-label{display:grid;text-align:left}}
  `;
  document.head.appendChild(style);
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
  if (card.querySelector("[data-dashboard-sponsor-renewal]")) return true;
  const wrap = document.createElement("div");
  wrap.className = "dashboard-sponsor-renewal";
  wrap.setAttribute("data-dashboard-sponsor-renewal", "active");
  wrap.innerHTML = `
    <div class="dashboard-sponsor-renewal-label"><strong>贊助文章閱讀方案</strong><span>可在會員中心直接續期</span></div>
    <div data-sponsor-smart-slot data-sponsor-context="dashboard"></div>`;
  card.appendChild(wrap);
  window.LingYuanSponsorCheckout?.render?.();
  return true;
}

function ensureExpiredPanel() {
  if (!sponsorState?.everPurchased || sponsorState?.active) return false;
  const dashboard = document.getElementById("member-dashboard");
  const accessPanel = document.getElementById("dashboard-access-panel");
  if (!accessPanel || !dashboard?.hidden || accessPanel.hidden) return false;
  if (accessPanel.querySelector("[data-dashboard-sponsor-renewal]")) return true;
  const wrap = document.createElement("div");
  wrap.className = "dashboard-sponsor-reopen";
  wrap.setAttribute("data-dashboard-sponsor-renewal", "expired");
  wrap.innerHTML = `<div data-sponsor-smart-slot data-sponsor-context="dashboard"></div>`;
  accessPanel.appendChild(wrap);
  window.LingYuanSponsorCheckout?.render?.();
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
}

function scheduleSync() {
  window.clearTimeout(scheduled);
  scheduled = window.setTimeout(syncPanel, 60);
}

installStyles();

const observer = new MutationObserver(scheduleSync);
observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });

onAuthStateChanged(auth, async (user) => {
  currentEmail = normalizeEmail(user?.email || "");
  sponsorState = null;
  removeInjected();
  if (!currentEmail) return;
  sponsorState = await loadSponsorState(currentEmail);
  scheduleSync();
  window.LingYuanSponsorCheckout?.refresh?.().catch?.(() => {});
});
