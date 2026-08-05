import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let offer = null;

function formatMoney(value) {
  return Number(value || 0).toLocaleString("zh-TW");
}

function currentPrice(planMonths) {
  if (!offer) return Number(planMonths) === 3 ? 300 : 120;
  return offer.promotionAvailable
    ? (Number(planMonths) === 3 ? offer.promoPrice3 : offer.promoPrice1)
    : (Number(planMonths) === 3 ? offer.regularPrice3 : offer.regularPrice1);
}

function installStyles() {
  if (document.getElementById("sponsor-checkout-styles")) return;
  const style = document.createElement("style");
  style.id = "sponsor-checkout-styles";
  style.textContent = `
    .sponsor-offer-panel{margin:14px 0;padding:16px;border:1px solid rgba(165,130,84,.36);background:rgba(255,255,255,.42);text-align:center}
    .sponsor-offer-panel strong{display:block;color:#604426;font-size:15px}
    .sponsor-offer-panel span{display:block;margin-top:5px;color:#78654f;font-size:11px;line-height:1.7}
    .sponsor-checkout-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:12px}
    .sponsor-plan-button{min-height:68px;padding:10px;border:1px solid rgba(125,94,55,.42);background:#A58254;color:#fff;cursor:pointer;font-family:'Noto Sans TC',sans-serif}
    .sponsor-plan-button:hover{background:#8f6c43}
    .sponsor-plan-button span,.sponsor-plan-button strong{display:block;color:#fff}
    .sponsor-plan-button strong{font-size:16px}
    .sponsor-offer-note{margin:10px 0 0;color:rgba(46,37,28,.62);font-size:9px;line-height:1.65}
    @media(max-width:520px){.sponsor-checkout-actions{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}

function offerMarkup() {
  if (!offer) return '';
  const status = offer.promotionAvailable
    ? `前${Number(offer.promoLimit || 200)}名優惠尚餘 ${Number(offer.remaining || 0)} 名`
    : `前${Number(offer.promoLimit || 200)}名優惠已額滿，目前適用一般價格`;
  return `<div class="sponsor-offer-panel">
    <strong>${status}</strong>
    <span>一個月 NT$${formatMoney(currentPrice(1))}｜三個月 NT$${formatMoney(currentPrice(3))}</span>
    <div class="sponsor-checkout-actions">
      <button class="sponsor-plan-button" type="button" data-sponsor-pay="1"><span>一個月觀看權限</span><strong>NT$${formatMoney(currentPrice(1))}</strong></button>
      <button class="sponsor-plan-button" type="button" data-sponsor-pay="3"><span>三個月觀看權限</span><strong>NT$${formatMoney(currentPrice(3))}</strong></button>
    </div>
    <p class="sponsor-offer-note">點選後直接前往目前適用的綠界付款頁面。付款完成後，行政團隊核對款項並將您的 Gmail 加入會員名單。</p>
  </div>`;
}

function enhancePaidGates(root = document) {
  if (!offer) return;
  root.querySelectorAll?.('.paid-lock-zone[aria-label="贊助會員專屬"] .paid-lock-card').forEach((card) => {
    const current = card.querySelector('.sponsor-offer-panel');
    if (current) current.outerHTML = offerMarkup();
    else card.querySelector('.paid-inquiry-actions')?.insertAdjacentHTML('beforebegin', offerMarkup());
  });
}

async function loadOffer() {
  const snapshot = await getDoc(doc(db, 'articles', 'sponsor-offer-status'));
  const data = snapshot.exists() ? snapshot.data() || {} : {};
  offer = data.status === 'published' && data.systemRecord === true ? data : null;
  enhancePaidGates();
}

function goToPayment() {
  const paymentUrl = String(offer?.currentPaymentUrl || '').trim();
  if (!paymentUrl.startsWith('https://')) {
    alert(offer?.promotionAvailable ? '優惠付款連結尚未設定。' : '一般價付款連結尚未設定。');
    return;
  }
  window.location.assign(paymentUrl);
}

installStyles();
loadOffer().catch((error) => console.warn('贊助方案名額暫時無法取得。', error));
setInterval(() => loadOffer().catch(() => {}), 60000);

document.addEventListener('click', (event) => {
  if (!event.target.closest('[data-sponsor-pay]')) return;
  event.preventDefault();
  goToPayment();
});

const observer = new MutationObserver(() => enhancePaidGates());
observer.observe(document.body, { childList: true, subtree: true });
