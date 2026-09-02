import { app, auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";

const FUNCTIONS_BASE_URL = "https://asia-east1-lyyuan03-membership.cloudfunctions.net";
const RETURN_KEY = "lyyuan:sponsor:return-url";
const PENDING_PLAN_KEY = "lyyuan:sponsor:pending-plan";
const functions = getFunctions(app, "asia-east1");
const createCheckout = httpsCallable(functions, "createPublicSponsorCheckout");

const state = {
  user: auth.currentUser || null,
  member: null,
  offer: null,
  loading: false,
  error: ""
};

function memberDate(value) {
  if (!value) return null;
  const date = value?.toDate?.() || new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function hasActiveArticleAccess(member) {
  if (!member) return false;
  const now = new Date();
  const directExpiry = memberDate(member.expiresAt);
  const direct = member.memberType === "sponsor-member"
    && member.articleAccess === true
    && member.paymentStatus === "paid"
    && member.status === "active"
    && (!directExpiry || directExpiry > now)
    && member.disabled !== true
    && member.suspended !== true
    && !member.revokedAt;
  if (direct) return true;

  const benefit = member.wellnessBenefit;
  const benefitExpiry = memberDate(benefit?.expiresAt);
  return Boolean(
    benefit?.active === true
    && benefit?.articleAccess === true
    && benefit?.status === "active"
    && benefit?.accessScope === "sponsor-paid-articles"
    && (!benefitExpiry || benefitExpiry > now)
  );
}

function money(value) {
  return `NT$${Number(value || 0).toLocaleString("zh-TW")}`;
}

function currentReturnUrl() {
  const url = new URL(location.href);
  url.searchParams.delete("payment");
  url.searchParams.delete("checkout");
  return `${url.pathname}${url.search}${url.hash}`;
}

function storeReturnUrl() {
  try {
    localStorage.setItem(RETURN_KEY, currentReturnUrl());
  } catch {}
}

function consumeStoredReturnUrl() {
  try {
    const value = localStorage.getItem(RETURN_KEY) || "";
    localStorage.removeItem(RETURN_KEY);
    return value;
  } catch {
    return "";
  }
}

function paymentReturnRedirect() {
  const params = new URLSearchParams(location.search);
  if (params.get("payment") !== "complete") return false;
  const stored = consumeStoredReturnUrl();
  if (!stored) return false;
  try {
    const target = new URL(stored, location.origin);
    if (target.origin !== location.origin) return false;
    target.searchParams.set("payment", "complete");
    if (target.pathname === location.pathname && target.search === location.search) return false;
    location.replace(target.href);
    return true;
  } catch {
    return false;
  }
}

async function fetchOffer() {
  const response = await fetch(`${FUNCTIONS_BASE_URL}/sponsorOfferStatus?t=${Date.now()}`, { cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ready !== true) throw new Error("目前無法取得閱讀方案，請稍後再試。");
  state.offer = payload;
  return payload;
}

async function fetchMember() {
  state.member = null;
  const email = state.user?.email?.trim().toLowerCase();
  if (!email) return null;
  try {
    const snapshot = await getDoc(doc(db, "sponsorMemberAccess", email));
    state.member = snapshot.exists() ? { ...snapshot.data(), email } : null;
  } catch (error) {
    if (error?.code !== "permission-denied") console.warn("贊助閱讀資格載入失敗。", error);
  }
  return state.member;
}

function offerMarkup() {
  if (state.error) {
    return `<div class="sponsor-checkout-error" role="alert">${state.error}</div><button type="button" class="sponsor-checkout-retry" data-sponsor-retry>重新讀取方案</button>`;
  }
  if (!state.offer) return '<div class="sponsor-offer-loading">閱讀方案載入中…</div>';
  if (hasActiveArticleAccess(state.member)) {
    const expiry = memberDate(state.member?.expiresAt || state.member?.wellnessBenefit?.expiresAt);
    const expiryText = expiry ? new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium" }).format(expiry) : "有效期間內";
    return `<div class="sponsor-access-active"><strong>你的閱讀資格已啟用</strong><span>${expiryText}可閱讀所有贊助專屬文章。</span></div>`;
  }

  const offer = state.offer;
  const promo = offer.promotionAvailable === true;
  const price1 = Number(offer.currentPrice1 || (promo ? offer.promoPrice1 : offer.regularPrice1) || 0);
  const price3 = Number(offer.currentPrice3 || (promo ? offer.promoPrice3 : offer.regularPrice3) || 0);
  const badge = promo
    ? `<div class="sponsor-promo-note">前 ${Number(offer.promoLimit || 200)} 名優惠進行中${Number.isFinite(Number(offer.remaining)) ? `・尚餘 ${Number(offer.remaining)} 名` : ""}</div>`
    : '<div class="sponsor-promo-note is-regular">目前適用一般方案價格</div>';
  const loginPrefix = state.user ? "" : "登入後・";

  return `${badge}
    <div class="sponsor-plan-grid" role="group" aria-label="選擇閱讀方案">
      <button type="button" class="sponsor-plan" data-sponsor-plan="1">
        <span class="sponsor-plan-term">1 個月</span>
        <strong>${money(price1)}</strong>
        ${promo && Number(offer.regularPrice1) > price1 ? `<del>${money(offer.regularPrice1)}</del>` : ""}
        <small>${loginPrefix}解鎖所有贊助文章</small>
      </button>
      <button type="button" class="sponsor-plan is-featured" data-sponsor-plan="3">
        <span class="sponsor-plan-term">3 個月</span>
        <strong>${money(price3)}</strong>
        ${promo && Number(offer.regularPrice3) > price3 ? `<del>${money(offer.regularPrice3)}</del>` : ""}
        <small>${loginPrefix}解鎖所有贊助文章</small>
      </button>
    </div>
    <div class="sponsor-auto-note">綠界安全付款・付款成功後系統自動開通・並帶你回到本篇文章</div>`;
}

function installStyles() {
  if (document.getElementById("sponsor-checkout-v3-styles")) return;
  const style = document.createElement("style");
  style.id = "sponsor-checkout-v3-styles";
  style.textContent = `
    [data-sponsor-smart-slot]{margin:16px 0}
    .sponsor-promo-note{margin:0 0 10px;padding:8px 10px;border:1px solid rgba(139,104,63,.26);background:rgba(165,130,84,.09);color:#684C2E;font-size:11px;line-height:1.6}
    .sponsor-promo-note.is-regular{color:#665747;background:rgba(89,79,71,.06)}
    .sponsor-plan-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .sponsor-plan{position:relative;display:flex;min-height:118px;padding:14px 10px;flex-direction:column;align-items:center;justify-content:center;border:1px solid rgba(125,94,55,.34);background:rgba(255,255,255,.52);color:#493724;cursor:pointer;font-family:'Noto Sans TC',sans-serif;transition:transform .18s ease,border-color .18s ease,background .18s ease}
    .sponsor-plan:hover{transform:translateY(-2px);border-color:rgba(125,94,55,.65);background:#fff}
    .sponsor-plan.is-featured{box-shadow:inset 0 0 0 1px rgba(165,130,84,.18)}
    .sponsor-plan:disabled{opacity:.55;cursor:wait;transform:none}
    .sponsor-plan-term{font-size:11px;letter-spacing:.08em;color:#725D48}
    .sponsor-plan strong{margin:4px 0 1px;font-family:'Noto Serif TC',serif;font-size:22px;color:#4E3821}
    .sponsor-plan del{font-size:10px;color:#9A8A78}
    .sponsor-plan small{margin-top:5px;color:#725D48;font-size:10px;line-height:1.5}
    .sponsor-auto-note{margin-top:11px;color:#766757;font-size:10px;line-height:1.65}
    .sponsor-offer-loading,.sponsor-checkout-error{padding:14px;border:1px solid rgba(89,79,71,.16);background:rgba(255,255,255,.32);color:#665747;font-size:11px;line-height:1.7}
    .sponsor-checkout-retry{margin-top:9px;padding:8px 12px;border:1px solid rgba(125,94,55,.34);background:transparent;color:#5A4127;cursor:pointer}
    .sponsor-access-active{padding:14px;border:1px solid rgba(96,99,48,.32);background:rgba(96,99,48,.08);text-align:center}
    .sponsor-access-active strong,.sponsor-access-active span{display:block}.sponsor-access-active strong{color:#4F5228}.sponsor-access-active span{margin-top:4px;color:#665747;font-size:11px}
    .sponsor-payment-status{margin:12px 0;padding:11px 13px;border:1px solid rgba(165,130,84,.3);background:rgba(165,130,84,.08);color:#5A4127;font-size:11px;line-height:1.7;text-align:center}
    .sponsor-payment-status.is-error{border-color:rgba(122,52,45,.35);background:rgba(122,52,45,.08);color:#6E312B}
    @media(max-width:480px){.sponsor-plan-grid{grid-template-columns:1fr}.sponsor-plan{min-height:104px}}
  `;
  document.head.appendChild(style);
}

function restoredGates() {
  return document.querySelectorAll("[data-paid-gate-restored]");
}

function statusElement(host) {
  let status = host.querySelector(":scope > .sponsor-payment-status");
  if (!status) {
    status = document.createElement("div");
    status.className = "sponsor-payment-status";
    host.appendChild(status);
  }
  return status;
}

function renderRestoredGateState() {
  restoredGates().forEach((gate) => {
    const host = gate.querySelector(".paid-lock-card") || gate;
    const existing = host.querySelector(":scope > .sponsor-payment-status");
    if (state.error) {
      const status = statusElement(host);
      status.dataset.checkoutError = "true";
      status.classList.add("is-error");
      status.setAttribute("role", "alert");
      if (status.textContent !== state.error) status.textContent = state.error;
    } else if (existing?.dataset.checkoutError === "true") {
      existing.remove();
    }
  });
  document.querySelectorAll("[data-sponsor-plan]").forEach((button) => {
    button.disabled = state.loading || Boolean(state.error);
    button.setAttribute("aria-busy", state.loading ? "true" : "false");
  });
}

function render() {
  document.querySelectorAll("[data-sponsor-smart-slot]").forEach((slot) => {
    slot.innerHTML = offerMarkup();
  });
  renderRestoredGateState();
}

function setBusy(busy) {
  state.loading = busy;
  renderRestoredGateState();
}

function displayGateStatus(message, isError = false) {
  document.querySelectorAll("[data-sponsor-smart-slot]").forEach((slot) => {
    const status = statusElement(slot);
    status.dataset.checkoutError = isError ? "true" : "false";
    status.classList.toggle("is-error", isError);
    status.setAttribute("role", isError ? "alert" : "status");
    if (status.textContent !== message) status.textContent = message;
  });
  restoredGates().forEach((gate) => {
    const host = gate.querySelector(".paid-lock-card") || gate;
    const status = statusElement(host);
    status.dataset.checkoutError = isError ? "true" : "false";
    status.classList.toggle("is-error", isError);
    status.setAttribute("role", isError ? "alert" : "status");
    if (status.textContent !== message) status.textContent = message;
  });
}

function triggerSiteLogin() {
  const loginButton = document.getElementById("member-login-button");
  if (loginButton) {
    loginButton.click();
    return true;
  }
  state.error = "登入功能仍在載入，請稍後再按一次方案。";
  render();
  return false;
}

async function startCheckout(planMonths) {
  if (![1, 3].includes(Number(planMonths))) return;
  state.error = "";
  renderRestoredGateState();
  storeReturnUrl();

  if (!auth.currentUser?.email) {
    try { localStorage.setItem(PENDING_PLAN_KEY, String(planMonths)); } catch {}
    triggerSiteLogin();
    return;
  }

  setBusy(true);
  displayGateStatus("正在建立綠界安全付款連結…");
  try {
    const result = await createCheckout({
      planMonths: Number(planMonths),
      name: auth.currentUser.displayName || ""
    });
    const data = result?.data || {};
    if (!data.paymentUrl) throw new Error("付款連結建立失敗。");
    location.assign(data.paymentUrl);
  } catch (error) {
    console.error("建立贊助閱讀付款失敗。", error);
    const detail = error?.message?.replace(/^FirebaseError:\s*/i, "").trim();
    state.error = detail && !/failed to fetch|internal|not found/i.test(detail)
      ? detail
      : "目前無法建立綠界付款連結，請稍後再試或聯繫行政團隊。";
    render();
    displayGateStatus(state.error, true);
  } finally {
    setBusy(false);
  }
}

async function refresh() {
  state.loading = true;
  state.error = "";
  try {
    await Promise.all([fetchOffer(), fetchMember()]);
  } catch (error) {
    console.warn("贊助閱讀方案載入失敗。", error);
    state.error = "付款服務目前無法連線，請稍後再試或聯繫行政團隊。";
  } finally {
    state.loading = false;
    render();
  }
  return state;
}

async function confirmPaymentReturn() {
  const params = new URLSearchParams(location.search);
  if (params.get("payment") !== "complete") return;
  displayGateStatus("付款頁已返回，正在確認閱讀資格…");
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await fetchMember();
    if (hasActiveArticleAccess(state.member)) {
      const cleanUrl = new URL(location.href);
      cleanUrl.searchParams.delete("payment");
      cleanUrl.searchParams.delete("checkout");
      history.replaceState(null, "", cleanUrl.href);
      location.reload();
      return;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 1000));
  }
  displayGateStatus("付款資料仍在同步中。若稍後仍未解鎖，請按「會員登入／重新確認資格」重新確認。");
}

installStyles();
window.LingYuanSponsorCheckout = {
  render,
  refresh,
  getState: () => ({ ...state })
};

if (!paymentReturnRedirect()) {
  document.addEventListener("click", (event) => {
    const planButton = event.target.closest("[data-sponsor-plan]");
    if (planButton) {
      event.preventDefault();
      startCheckout(Number(planButton.dataset.sponsorPlan));
      return;
    }
    const retry = event.target.closest("[data-sponsor-retry]");
    if (retry) {
      event.preventDefault();
      refresh();
    }
  }, true);

  onAuthStateChanged(auth, async (user) => {
    state.user = user;
    await refresh();
    if (user?.email) {
      let pendingPlan = 0;
      try {
        pendingPlan = Number(localStorage.getItem(PENDING_PLAN_KEY) || 0);
        localStorage.removeItem(PENDING_PLAN_KEY);
      } catch {}
      if ([1, 3].includes(pendingPlan) && !hasActiveArticleAccess(state.member)) {
        startCheckout(pendingPlan);
        return;
      }
    }
    confirmPaymentReturn();
  });

  const sponsorGateRoot = document.getElementById("article-root") || document.body;
  // 只在新的 restored paid gate 被插入時同步 checkout 狀態。
  // 不監聽自己建立的 status 文字／節點，避免：
  // observer -> statusElement/textContent -> childList mutation -> observer 的自我觸發循環。
  const sponsorGateObserver = new MutationObserver((mutations) => {
    const hasNewGate = mutations.some((mutation) =>
      [...mutation.addedNodes].some((node) =>
        node instanceof Element
        && (node.matches("[data-paid-gate-restored]") || Boolean(node.querySelector("[data-paid-gate-restored]")))
      )
    );
    if (hasNewGate) renderRestoredGateState();
  });
  sponsorGateObserver.observe(sponsorGateRoot, { childList: true, subtree: true });

  refresh();
}
