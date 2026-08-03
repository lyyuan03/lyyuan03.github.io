import { app, auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";

const OFFER_STATUS_URL = "https://asia-east1-lyyuan03-membership.cloudfunctions.net/sponsorOfferStatus";
const PENDING_PLAN_KEY = "lyyuan-sponsor-pending-plan";
const functions = getFunctions(app, "asia-east1");
const createPublicSponsorCheckout = httpsCallable(functions, "createPublicSponsorCheckout");

let offer = null;
let currentUser = auth.currentUser;
let activePlan = 1;
let paymentUrl = "";

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[character]));
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("zh-TW");
}

function formatDeadline(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "請依付款信件所示期限完成付款";
  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "long",
    timeStyle: "short"
  }).format(date);
}

function currentPrice(planMonths) {
  if (!offer) return planMonths === 3 ? 300 : 120;
  if (offer.promotionAvailable) {
    return planMonths === 3 ? offer.promoPrice3 : offer.promoPrice1;
  }
  return planMonths === 3 ? offer.regularPrice3 : offer.regularPrice1;
}

function originalPrice(planMonths) {
  if (!offer || !offer.promotionAvailable) return null;
  return planMonths === 3 ? offer.regularPrice3 : offer.regularPrice1;
}

function installStyles() {
  if (document.getElementById("sponsor-checkout-styles")) return;
  const style = document.createElement("style");
  style.id = "sponsor-checkout-styles";
  style.textContent = `
    .sponsor-checkout-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:12px}
    .sponsor-checkout-heading{grid-column:1/-1;color:#4f3a24;font-family:'Noto Sans TC',sans-serif;font-size:12px;font-weight:700;letter-spacing:.08em;text-align:left}
    .sponsor-plan-button{min-height:66px;padding:10px 9px;border:1px solid rgba(125,94,55,.42);background:rgba(138,103,61,.68);color:#fff;cursor:pointer;font-family:'Noto Sans TC',sans-serif;line-height:1.45}
    .sponsor-plan-button:hover{background:rgba(125,92,53,.78)}
    .sponsor-plan-button span{display:block;font-size:10px;letter-spacing:.04em;opacity:.82}
    .sponsor-plan-button strong{display:block;margin:2px 0;font-size:16px;letter-spacing:.04em}
    .sponsor-plan-button del{font-size:9px;opacity:.66}
    .sponsor-checkout-login,.sponsor-checkout-help{min-height:36px;padding:7px 10px;border:1px solid rgba(76,55,34,.28);background:rgba(245,240,232,.16);color:rgba(40,32,23,.76);font-family:'Noto Sans TC',sans-serif;font-size:10px;cursor:pointer;text-decoration:none}
    .sponsor-checkout-login{grid-column:1/-1}
    .sponsor-checkout-note{grid-column:1/-1;margin:0;color:rgba(46,37,28,.62);font-family:'Noto Sans TC',sans-serif;font-size:9px;line-height:1.65;text-align:center}
    #sponsor-checkout-modal{position:fixed;inset:0;z-index:11000;display:none;align-items:center;justify-content:center;padding:22px;background:rgba(3,7,4,.78);backdrop-filter:blur(9px)}
    #sponsor-checkout-modal.is-open{display:flex}
    .sponsor-checkout-modal-card{position:relative;width:min(440px,100%);padding:32px 30px 28px;background:#f4eee4;border:1px solid rgba(165,130,84,.48);box-shadow:0 24px 80px rgba(0,0,0,.58);color:#2e261e;font-family:'Noto Sans TC',sans-serif}
    .sponsor-checkout-close{position:absolute;top:10px;right:13px;border:0;background:transparent;color:#796a5c;font-size:25px;cursor:pointer}
    .sponsor-checkout-kicker{margin-bottom:8px;color:#8b683f;font-size:10px;letter-spacing:.2em;text-align:center}
    .sponsor-checkout-modal-card h2{margin:0 0 12px;color:#3c2d1f;font-family:'Noto Serif TC',serif;font-size:23px;font-weight:500;letter-spacing:.08em;text-align:center}
    .sponsor-checkout-modal-card p{margin:0 0 14px;color:#65594d;font-size:12px;line-height:1.8}
    .sponsor-checkout-summary{margin:14px 0;padding:14px;border:1px solid rgba(125,94,55,.24);background:rgba(255,255,255,.42)}
    .sponsor-checkout-summary div{display:flex;justify-content:space-between;gap:14px;padding:4px 0;font-size:12px}
    .sponsor-checkout-summary strong{color:#573d22}
    .sponsor-checkout-status{min-height:24px;margin:10px 0;color:#735536;font-size:11px;line-height:1.7;text-align:center}
    .sponsor-checkout-primary{display:flex;align-items:center;justify-content:center;width:100%;min-height:46px;padding:10px 16px;border:1px solid rgba(125,94,55,.5);background:#A58254;color:#fff;cursor:pointer;font:500 13px 'Noto Sans TC',sans-serif;letter-spacing:.08em;text-decoration:none}
    .sponsor-checkout-primary:hover{background:#8f6c43}
    .sponsor-checkout-primary:disabled{opacity:.55;cursor:wait}
    .sponsor-checkout-secondary{display:block;width:100%;margin-top:9px;padding:9px;border:0;background:transparent;color:#786a5d;cursor:pointer;font-size:11px;text-align:center}
    .sponsor-checkout-success{padding:12px;border-left:3px solid #606330;background:#e4e7d6;color:#3f482b;font-size:12px;line-height:1.75}
    @media(max-width:520px){
      .sponsor-checkout-actions{grid-template-columns:1fr}
      .sponsor-checkout-heading,.sponsor-checkout-login,.sponsor-checkout-note{grid-column:auto}
      .sponsor-checkout-modal-card{padding:30px 20px 24px}
    }
  `;
  document.head.appendChild(style);
}

function installModal() {
  let modal = document.getElementById("sponsor-checkout-modal");
  if (modal) return modal;
  modal = document.createElement("div");
  modal.id = "sponsor-checkout-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.innerHTML = `
    <div class="sponsor-checkout-modal-card">
      <button class="sponsor-checkout-close" type="button" aria-label="關閉">×</button>
      <div class="sponsor-checkout-kicker">LING · YUAN · YUAN</div>
      <div id="sponsor-checkout-modal-content"></div>
    </div>`;
  document.body.appendChild(modal);
  const close = () => modal.classList.remove("is-open");
  modal.querySelector(".sponsor-checkout-close")?.addEventListener("click", close);
  modal.addEventListener("click", (event) => { if (event.target === modal) close(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") close(); });
  return modal;
}

const modal = (() => {
  installStyles();
  return installModal();
})();
const modalContent = modal.querySelector("#sponsor-checkout-modal-content");

function openModal() {
  modal.classList.add("is-open");
}

function closeModal() {
  modal.classList.remove("is-open");
}

function renderPlanActions(card) {
  const actions = card.querySelector(".paid-inquiry-actions");
  if (!actions) return;
  actions.className = "paid-inquiry-actions sponsor-checkout-actions";
  actions.dataset.sponsorCheckoutReady = "1";
  const promo = offer?.promotionAvailable === true;
  const remaining = Number(offer?.remaining || 0);
  const limit = Number(offer?.promoLimit || 200);
  actions.innerHTML = `
    <div class="sponsor-checkout-heading">${promo ? `目前仍在前 ${limit} 名優惠內｜尚餘 ${remaining} 名` : "前 200 名優惠已額滿｜目前為一般方案"}</div>
    ${[1, 3].map((plan) => `
      <button class="sponsor-plan-button" type="button" data-sponsor-plan="${plan}">
        <span>${plan === 1 ? "一個月觀看權限" : "三個月觀看權限"}</span>
        <strong>NT$${formatMoney(currentPrice(plan))}</strong>
        ${originalPrice(plan) ? `<del>原價 NT$${formatMoney(originalPrice(plan))}</del>` : ""}
      </button>
    `).join("")}
    <button class="sponsor-checkout-login" type="button" data-sponsor-login>${currentUser ? `目前登入：${escapeHtml(currentUser.email || "會員帳號")}` : "請先登入將來閱讀文章的會員帳號"}</button>
    <a class="sponsor-checkout-help" href="https://t.me/lyyuan" target="_blank" rel="noopener noreferrer">付款問題｜Telegram</a>
    <a class="sponsor-checkout-help" href="mailto:lyyuan03@gmail.com?subject=${encodeURIComponent("詢問贊助閱讀付款")}">付款問題｜Email</a>
    <p class="sponsor-checkout-note">實際優惠資格與金額，以按下方案後由系統建立訂單時的結果為準。</p>
  `;
}

function enhancePaidGates(root = document) {
  root.querySelectorAll?.('.paid-lock-zone[aria-label="贊助會員專屬"] .paid-lock-card').forEach((card) => {
    renderPlanActions(card);
  });
}

function requestLogin(plan = null) {
  if (plan) sessionStorage.setItem(PENDING_PLAN_KEY, String(plan));
  const loginButton = document.getElementById("member-login-button");
  if (loginButton) {
    loginButton.click();
    return;
  }
  alert("請先使用會員帳號登入後，再選擇贊助閱讀方案。");
}

function showConfirmation(planMonths) {
  activePlan = planMonths;
  paymentUrl = "";
  if (!currentUser?.email) {
    requestLogin(planMonths);
    return;
  }
  const promo = offer?.promotionAvailable === true;
  modalContent.innerHTML = `
    <h2>確認贊助閱讀方案</h2>
    <p>系統將以您目前登入的 Email 建立專屬訂單，並在建立當下自動判斷是否仍在前 200 名優惠內。</p>
    <div class="sponsor-checkout-summary">
      <div><span>登入帳號</span><strong>${escapeHtml(currentUser.email)}</strong></div>
      <div><span>觀看期間</span><strong>${planMonths} 個月</strong></div>
      <div><span>目前顯示金額</span><strong>NT$${formatMoney(currentPrice(planMonths))}</strong></div>
      <div><span>目前名額狀態</span><strong>${promo ? `尚餘 ${Number(offer?.remaining || 0)} 名` : "優惠已額滿"}</strong></div>
    </div>
    <div id="sponsor-checkout-status" class="sponsor-checkout-status">建立訂單後，系統會顯示您實際取得的價格與優惠序號。</div>
    <button class="sponsor-checkout-primary" type="button" data-sponsor-confirm>建立專屬訂單並保留名額</button>
    <button class="sponsor-checkout-secondary" type="button" data-sponsor-cancel>返回文章</button>
  `;
  openModal();
}

function showCheckoutResult(result) {
  paymentUrl = result.paymentUrl || "";
  const promo = result.priceTier === "promo";
  modalContent.innerHTML = `
    <h2>${promo ? "優惠名額已為您保留" : "付款訂單已建立"}</h2>
    <div class="sponsor-checkout-success">
      ${promo && result.promotionSequence ? `您取得的是前 200 名第 <strong>${Number(result.promotionSequence)}</strong> 人次優惠。<br>` : "本次適用一般方案價格。<br>"}
      方案：${Number(result.planMonths)} 個月<br>
      應繳金額：<strong>NT$${formatMoney(result.amount)}</strong><br>
      付款期限：${escapeHtml(formatDeadline(result.paymentDeadline))}
    </div>
    <p style="margin-top:14px">請在期限內完成綠界付款。付款成功後，系統會自動開通文章閱讀資格；逾期未付款，優惠名額將自動釋出。</p>
    <a class="sponsor-checkout-primary" href="${escapeHtml(paymentUrl)}">前往綠界安全付款</a>
    <button class="sponsor-checkout-secondary" type="button" data-sponsor-cancel>稍後再付款</button>
  `;
  loadOffer();
}

async function createOrder() {
  const confirmButton = modalContent.querySelector("[data-sponsor-confirm]");
  const status = modalContent.querySelector("#sponsor-checkout-status");
  if (!currentUser?.email) {
    closeModal();
    requestLogin(activePlan);
    return;
  }
  if (confirmButton) confirmButton.disabled = true;
  if (status) status.textContent = "正在由後端確認優惠名額並建立訂單…";
  try {
    const response = await createPublicSponsorCheckout({
      planMonths: activePlan,
      name: currentUser.displayName || ""
    });
    showCheckoutResult(response.data || {});
  } catch (error) {
    console.error("建立贊助閱讀訂單失敗：", error);
    const message = error?.code === "functions/unauthenticated"
      ? "登入狀態已失效，請重新登入後再試。"
      : error?.message || "目前無法建立付款訂單，請稍後再試。";
    if (status) status.textContent = message;
    if (confirmButton) confirmButton.disabled = false;
  }
}

async function loadOffer() {
  try {
    const response = await fetch(`${OFFER_STATUS_URL}?t=${Date.now()}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok || data.ready !== true) throw new Error("offer-not-ready");
    offer = data;
    enhancePaidGates();
  } catch (error) {
    console.warn("贊助優惠狀態暫時無法取得。", error);
  }
}

document.addEventListener("click", (event) => {
  const planButton = event.target.closest("[data-sponsor-plan]");
  if (planButton) {
    event.preventDefault();
    const plan = Number(planButton.dataset.sponsorPlan) === 3 ? 3 : 1;
    showConfirmation(plan);
    return;
  }
  if (event.target.closest("[data-sponsor-login]")) {
    event.preventDefault();
    requestLogin();
    return;
  }
  if (event.target.closest("[data-sponsor-confirm]")) {
    event.preventDefault();
    createOrder();
    return;
  }
  if (event.target.closest("[data-sponsor-cancel]")) {
    event.preventDefault();
    closeModal();
  }
});

const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
    if (node.nodeType === 1) enhancePaidGates(node);
  }));
});
observer.observe(document.body, { childList: true, subtree: true });

enhancePaidGates();
loadOffer();
setInterval(loadOffer, 60000);

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  enhancePaidGates();
  const pendingPlan = Number(sessionStorage.getItem(PENDING_PLAN_KEY));
  if (!user || ![1, 3].includes(pendingPlan)) return;
  sessionStorage.removeItem(PENDING_PLAN_KEY);
  window.setTimeout(() => showConfirmation(pendingPlan), 350);
});
