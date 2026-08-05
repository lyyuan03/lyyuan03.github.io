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

function offerSignature() {
  if (!offer) return "loading";
  return [
    offer.promotionAvailable ? "promo" : "regular",
    Number(offer.promoLimit || 200),
    Number(offer.remaining || 0),
    currentPrice(1),
    currentPrice(3),
    String(offer.currentPaymentUrl || "")
  ].join("|");
}

function installStyles() {
  if (document.getElementById("sponsor-checkout-styles")) return;
  const style = document.createElement("style");
  style.id = "sponsor-checkout-styles";
  style.textContent = `
    .sponsor-join-card>p{max-width:520px;margin-left:auto;margin-right:auto}
    .sponsor-offer-panel{margin:18px 0 12px;padding:18px 16px;border:1px solid rgba(165,130,84,.35);background:rgba(255,255,255,.46);text-align:center}
    .sponsor-offer-count{display:grid;gap:4px;margin-bottom:14px}
    .sponsor-offer-count span{font-size:10px;letter-spacing:.16em;color:#8a6d49}
    .sponsor-offer-count strong{font-family:'Noto Serif TC',serif;font-size:20px;font-weight:600;color:#5f4529}
    .sponsor-offer-prices{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 0 14px}
    .sponsor-offer-price{padding:12px 8px;border:1px solid rgba(125,94,55,.25);background:rgba(248,243,234,.78)}
    .sponsor-offer-price span{display:block;margin:0 0 4px;font-size:10px;color:#776550}
    .sponsor-offer-price strong{display:block;font-size:18px;color:#5a4127}
    .sponsor-payment-button{display:flex;align-items:center;justify-content:center;width:100%;min-height:48px;padding:10px 16px;border:1px solid #9a774d;background:#A58254;color:#fff;font-family:'Noto Sans TC',sans-serif;font-size:14px;font-weight:600;letter-spacing:.08em;cursor:pointer}
    .sponsor-payment-button:hover{background:#8f6c43}
    .sponsor-offer-note{margin:10px 0 0;color:rgba(46,37,28,.64);font-size:9px;line-height:1.7}
    .sponsor-offer-loading{padding:16px 12px;border:1px solid rgba(165,130,84,.25);color:#7b684f;font-size:11px;text-align:center}
    .paid-member-return{display:grid;grid-template-columns:auto minmax(150px,220px);align-items:center;justify-content:center;gap:12px;margin-top:14px;padding-top:14px;border-top:1px solid rgba(125,94,55,.18)}
    .paid-member-return span{font-size:11px;color:#75634f}
    .paid-member-return .paid-inquiry-primary{width:100%;min-height:40px}
    .paid-help-link{display:inline-block;margin-top:12px;color:#7d6040;font-size:10px;text-decoration:underline;text-underline-offset:4px}
    .sponsor-join-card>small{display:block;margin-top:10px}
    @media(max-width:520px){.sponsor-offer-prices{grid-template-columns:1fr}.sponsor-offer-count strong{font-size:18px}.paid-member-return{grid-template-columns:1fr}.paid-member-return span{text-align:center}}
  `;
  document.head.appendChild(style);
}

function offerMarkup() {
  if (!offer) {
    return '<div class="sponsor-offer-loading">方案與優惠名額載入中，請稍候。</div>';
  }
  const limit = Number(offer.promoLimit || 200);
  const remaining = Number(offer.remaining || 0);
  const status = offer.promotionAvailable
    ? `前 ${limit} 名優惠｜目前尚餘 ${remaining} 名`
    : `前 ${limit} 名優惠已額滿｜目前適用一般價格`;
  const eyebrow = offer.promotionAvailable ? "LIMITED OFFER" : "REGULAR PRICE";
  return `<div class="sponsor-offer-panel">
    <div class="sponsor-offer-count">
      <span>${eyebrow}</span>
      <strong>${status}</strong>
    </div>
    <div class="sponsor-offer-prices" aria-label="贊助閱讀方案價格">
      <div class="sponsor-offer-price"><span>一個月觀看權限</span><strong>NT$${formatMoney(currentPrice(1))}</strong></div>
      <div class="sponsor-offer-price"><span>三個月觀看權限</span><strong>NT$${formatMoney(currentPrice(3))}</strong></div>
    </div>
    <button class="sponsor-payment-button" type="button" data-sponsor-pay>立即前往綠界付款</button>
    <p class="sponsor-offer-note">付款頁面可選擇一個月或三個月方案。完成付款後，行政團隊核對款項並以付款資料中的 Gmail 開通閱讀資格。</p>
  </div>`;
}

function enhancePaidGates(root = document) {
  const signature = offerSignature();
  root.querySelectorAll?.("[data-sponsor-offer-slot]").forEach((slot) => {
    if (slot.dataset.offerSignature === signature) return;
    slot.dataset.offerSignature = signature;
    slot.innerHTML = offerMarkup();
  });
}

async function loadOffer() {
  const snapshot = await getDoc(doc(db, "articles", "sponsor-offer-status"));
  const data = snapshot.exists() ? snapshot.data() || {} : {};
  offer = data.status === "published" && data.systemRecord === true ? data : null;
  enhancePaidGates();
}

async function goToPayment() {
  try {
    await loadOffer();
    const paymentUrl = String(offer?.currentPaymentUrl || "").trim();
    if (!paymentUrl.startsWith("https://")) {
      alert(offer?.promotionAvailable ? "優惠付款連結尚未設定。" : "一般價付款連結尚未設定。");
      return;
    }
    window.location.assign(paymentUrl);
  } catch (error) {
    console.warn("付款連結暫時無法取得。", error);
    alert("付款連結暫時無法取得，請稍後重新整理頁面。");
  }
}

installStyles();
enhancePaidGates();
loadOffer().catch((error) => console.warn("贊助方案名額暫時無法取得。", error));
setInterval(() => loadOffer().catch(() => {}), 60000);

document.addEventListener("click", (event) => {
  if (!event.target.closest("[data-sponsor-pay]")) return;
  event.preventDefault();
  goToPayment();
});

const observer = new MutationObserver((mutations) => {
  if (!mutations.some((mutation) => mutation.addedNodes.length > 0)) return;
  enhancePaidGates();
});
observer.observe(document.body, { childList: true, subtree: true });
