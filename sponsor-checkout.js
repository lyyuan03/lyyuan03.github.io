import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const PENDING_PLAN_KEY = "lyyuan-sponsor-pending-plan";
let offer = null;
let currentUser = auth.currentUser;
let activePlan = 1;

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[character]));
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("zh-TW");
}

function currentPrice(planMonths) {
  if (!offer) return planMonths === 3 ? 300 : 120;
  return offer.promotionAvailable
    ? (planMonths === 3 ? offer.promoPrice3 : offer.promoPrice1)
    : (planMonths === 3 ? offer.regularPrice3 : offer.regularPrice1);
}

function installStyles() {
  if (document.getElementById("sponsor-checkout-styles")) return;
  const style = document.createElement("style");
  style.id = "sponsor-checkout-styles";
  style.textContent = `
    .sponsor-offer-panel{margin:14px 0;padding:14px;border:1px solid rgba(165,130,84,.36);background:rgba(255,255,255,.4);text-align:center}
    .sponsor-offer-panel strong{display:block;color:#604426;font-size:14px}.sponsor-offer-panel span{display:block;margin-top:5px;color:#78654f;font-size:11px;line-height:1.7}
    .sponsor-checkout-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:12px}.sponsor-plan-button{min-height:64px;padding:10px;border:1px solid rgba(125,94,55,.42);background:#A58254;color:#fff;cursor:pointer}.sponsor-plan-button span,.sponsor-plan-button strong{display:block}.sponsor-plan-button strong{font-size:16px}
    #sponsor-checkout-modal{position:fixed;inset:0;z-index:11000;display:none;align-items:center;justify-content:center;padding:22px;background:rgba(3,7,4,.78);backdrop-filter:blur(8px)}#sponsor-checkout-modal.is-open{display:flex}
    .sponsor-checkout-modal-card{position:relative;width:min(440px,100%);padding:32px 30px;background:#f4eee4;border:1px solid rgba(165,130,84,.48);box-shadow:0 24px 80px rgba(0,0,0,.58);color:#2e261e}.sponsor-checkout-close{position:absolute;top:9px;right:12px;border:0;background:transparent;font-size:25px;cursor:pointer}.sponsor-checkout-modal-card h2{text-align:center;font-family:'Noto Serif TC',serif;font-weight:500}.sponsor-checkout-summary{margin:14px 0;padding:14px;border:1px solid rgba(125,94,55,.24);background:rgba(255,255,255,.42)}.sponsor-checkout-summary div{display:flex;justify-content:space-between;gap:12px;padding:4px 0;font-size:12px}.sponsor-checkout-primary{display:flex;align-items:center;justify-content:center;width:100%;min-height:46px;border:0;background:#A58254;color:#fff;cursor:pointer;text-decoration:none}.sponsor-checkout-secondary{display:block;width:100%;margin-top:8px;border:0;background:transparent;padding:9px;cursor:pointer}
  `;
  document.head.appendChild(style);
}

function ensureModal() {
  let modal = document.getElementById("sponsor-checkout-modal");
  if (modal) return modal;
  modal = document.createElement("div");
  modal.id = "sponsor-checkout-modal";
  modal.innerHTML = '<div class="sponsor-checkout-modal-card"><button class="sponsor-checkout-close" type="button" data-sponsor-cancel>×</button><div id="sponsor-checkout-modal-content"></div></div>';
  document.body.appendChild(modal);
  return modal;
}

function offerMarkup() {
  if (!offer) return '';
  const status = offer.promotionAvailable
    ? `前${Number(offer.promoLimit || 200)}名優惠尚餘 ${Number(offer.remaining || 0)} 名`
    : '前200名優惠已額滿，目前適用一般價格';
  return `<div class="sponsor-offer-panel"><strong>${status}</strong><span>一個月 NT$${formatMoney(currentPrice(1))}｜三個月 NT$${formatMoney(currentPrice(3))}</span><div class="sponsor-checkout-actions"><button class="sponsor-plan-button" type="button" data-sponsor-plan="1"><span>一個月觀看權限</span><strong>NT$${formatMoney(currentPrice(1))}</strong></button><button class="sponsor-plan-button" type="button" data-sponsor-plan="3"><span>三個月觀看權限</span><strong>NT$${formatMoney(currentPrice(3))}</strong></button></div></div>`;
}

function enhancePaidGates(root = document) {
  if (!offer) return;
  root.querySelectorAll?.('.paid-lock-card').forEach((card) => {
    let panel = card.querySelector('.sponsor-offer-panel');
    if (!panel) {
      card.querySelector('.paid-inquiry-actions')?.insertAdjacentHTML('beforebegin', offerMarkup());
    } else {
      panel.outerHTML = offerMarkup();
    }
  });
}

function requestLogin(planMonths) {
  sessionStorage.setItem(PENDING_PLAN_KEY, String(planMonths));
  document.getElementById("member-login-button")?.click();
}

function showConfirmation(planMonths) {
  activePlan = planMonths;
  if (!currentUser?.email) {
    requestLogin(planMonths);
    return;
  }
  const modal = ensureModal();
  const content = modal.querySelector('#sponsor-checkout-modal-content');
  const tier = offer?.promotionAvailable ? `前${Number(offer.promoLimit || 200)}名優惠` : '一般價格';
  content.innerHTML = `<h2>確認贊助閱讀方案</h2><p>系統已依目前正式會員名單判讀本次適用價格。按下後會直接前往綠界付款頁面。</p><div class="sponsor-checkout-summary"><div><span>登入帳號</span><strong>${escapeHtml(currentUser.email)}</strong></div><div><span>觀看期間</span><strong>${planMonths} 個月</strong></div><div><span>適用方案</span><strong>${tier}</strong></div><div><span>應繳金額</span><strong>NT$${formatMoney(currentPrice(planMonths))}</strong></div></div><p id="sponsor-checkout-status">付款後請依綠界通知完成付款；行政團隊核對款項後，會將此 Email 加入贊助專屬文章會員名單。</p><button class="sponsor-checkout-primary" type="button" data-sponsor-confirm>立即前往綠界付款</button><button class="sponsor-checkout-secondary" type="button" data-sponsor-cancel>返回文章</button>`;
  modal.classList.add('is-open');
}

async function goToPayment() {
  const status = document.getElementById('sponsor-checkout-status');
  try {
    await loadOffer();
    const paymentUrl = String(offer?.currentPaymentUrl || '').trim();
    if (!paymentUrl.startsWith('https://')) throw new Error(offer?.promotionAvailable ? '優惠付款連結尚未設定。' : '一般價付款連結尚未設定。');
    if (status) status.textContent = `已確認目前適用${offer.promotionAvailable ? '優惠價' : '一般價'}，正在前往綠界付款…`;
    window.location.assign(paymentUrl);
  } catch (error) {
    if (status) status.textContent = error?.message || '付款連結暫時無法取得，請聯繫靈元院行政團隊。';
  }
}

async function loadOffer() {
  const snapshot = await getDoc(doc(db, 'articles', 'sponsor-offer-status'));
  if (!snapshot.exists()) {
    offer = null;
    return;
  }
  const data = snapshot.data() || {};
  offer = data.status === 'published' && data.systemRecord === true ? data : null;
  enhancePaidGates();
}

installStyles();
ensureModal();
loadOffer().catch((error) => console.warn('贊助方案名額暫時無法取得。', error));
setInterval(() => loadOffer().catch(() => {}), 60000);

document.addEventListener('click', (event) => {
  const planButton = event.target.closest('[data-sponsor-plan]');
  if (planButton) {
    event.preventDefault();
    showConfirmation(Number(planButton.dataset.sponsorPlan) === 3 ? 3 : 1);
    return;
  }
  if (event.target.closest('[data-sponsor-confirm]')) {
    event.preventDefault();
    goToPayment();
    return;
  }
  if (event.target.closest('[data-sponsor-cancel]')) {
    event.preventDefault();
    document.getElementById('sponsor-checkout-modal')?.classList.remove('is-open');
  }
});

const observer = new MutationObserver(() => enhancePaidGates());
observer.observe(document.body, { childList: true, subtree: true });

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  const pendingPlan = Number(sessionStorage.getItem(PENDING_PLAN_KEY));
  if (!user || ![1, 3].includes(pendingPlan)) return;
  sessionStorage.removeItem(PENDING_PLAN_KEY);
  setTimeout(() => showConfirmation(pendingPlan), 250);
});
