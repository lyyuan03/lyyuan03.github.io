from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, found {count}")
    p.write_text(text.replace(old, new, 1), encoding="utf-8")


def replace_span(path, start_marker, end_marker, replacement):
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    start = text.find(start_marker)
    if start < 0:
        raise SystemExit(f"{path}: start marker not found: {start_marker}")
    end = text.find(end_marker, start)
    if end < 0:
        raise SystemExit(f"{path}: end marker not found: {end_marker}")
    p.write_text(text[:start] + replacement + text[end:], encoding="utf-8")


# ---- membership-admin.js: admin-only, no Firebase Functions / service account ----
path = Path("membership-admin.js")
text = path.read_text(encoding="utf-8")
text = text.replace(
    'import { app, auth, db, isAdminEmail } from "./firebase-config.js";\n',
    'import { auth, db, isAdminEmail } from "./firebase-config.js";\n'
)
text = text.replace(
    'import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";\nimport { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";\n',
    'import { collection, deleteDoc, deleteField, doc, getDoc, getDocs, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";\n'
)
for line in [
    'const functions = getFunctions(app, "asia-east1");\n',
    'const createSponsorMembershipCheckout = httpsCallable(functions, "createSponsorMembershipCheckout");\n',
    'const activateSponsorMembershipManually = httpsCallable(functions, "activateSponsorMembershipManually");\n',
    'const backendStatusUrl = "https://asia-east1-lyyuan03-membership.cloudfunctions.net/membershipBackendStatus";\n',
    'const offerStatusUrl = "https://asia-east1-lyyuan03-membership.cloudfunctions.net/sponsorOfferStatus";\n'
]:
    text = text.replace(line, '')
path.write_text(text, encoding="utf-8")

replace_once(
    "membership-admin.js",
    '''function planAmount(months) {
  const isThreeMonths = Number(months) === 3;
  if (currentTier() === "regular") {
    return isThreeMonths ? settings.sponsorRegularPrice3 : settings.sponsorRegularPrice1;
  }
  return isThreeMonths ? settings.sponsorPromoPrice3 : settings.sponsorPromoPrice1;
}
''',
    '''function planAmountForTier(months, tier = currentTier()) {
  const isThreeMonths = Number(months) === 3;
  if (tier === "regular") {
    return isThreeMonths ? settings.sponsorRegularPrice3 : settings.sponsorRegularPrice1;
  }
  return isThreeMonths ? settings.sponsorPromoPrice3 : settings.sponsorPromoPrice1;
}

function planAmount(months) {
  return planAmountForTier(months, currentTier());
}

function isPaidMember(member = {}) {
  return member.memberType === "sponsor-member"
    && member.paymentStatus === "paid"
    && member.status === "active";
}

function calculateOfferStatus() {
  const paidCount = members.filter(isPaidMember).length;
  const promoLimit = Number(settings.sponsorPromoLimit || 200);
  const remaining = Math.max(0, promoLimit - paidCount);
  return {
    ready: true,
    paidCount,
    pendingCount: 0,
    occupiedCount: paidCount,
    promoLimit,
    remaining,
    promotionAvailable: remaining > 0,
    currentTier: remaining > 0 ? "promo" : "regular",
    promoPrice1: Number(settings.sponsorPromoPrice1 || 120),
    promoPrice3: Number(settings.sponsorPromoPrice3 || 300),
    regularPrice1: Number(settings.sponsorRegularPrice1 || 150),
    regularPrice3: Number(settings.sponsorRegularPrice3 || 400)
  };
}

async function publishOfferStatus() {
  offerStatus = calculateOfferStatus();
  const currentPaymentUrl = offerStatus.promotionAvailable
    ? settings.sponsorPromoPaymentUrl
    : settings.sponsorRegularPaymentUrl;
  await setDoc(doc(db, "articles", "sponsor-offer-status"), {
    status: "published",
    hidden: true,
    systemRecord: true,
    title: "贊助閱讀方案名額狀態",
    category: "system",
    content: "",
    excerpt: "",
    ...offerStatus,
    currentPaymentUrl: String(currentPaymentUrl || "").trim(),
    updatedAt: serverTimestamp()
  }, { merge: true });
}
'''
)

replace_once(
    "membership-admin.js",
    '    <p class="membership-help">優惠名額以「已完成付款」加上「尚未逾期的待付款訂單」合併計算；待付款連結逾期後，名額會自動釋出。第201人次起，系統將自動改用一般價格。</p>\n',
    '    <p class="membership-help">優惠名額直接依「已確認付款並開通」的正式會員名單計算。前200名使用優惠連結，第201名起自動改用一般價連結；不建立綠界訂單，也不需要 Firebase Functions 或機密金鑰。</p>\n'
)

replace_once(
    "membership-admin.js",
    '    <small style="color:rgba(245,240,232,.58)">已付款 ${Number(offerStatus.paidCount || 0)}｜待付款保留 ${Number(offerStatus.pendingCount || 0)}｜目前套用${offerStatus.promotionAvailable ? "優惠價" : "一般價"}</small>\n',
    '    <small style="color:rgba(245,240,232,.58)">正式會員 ${Number(offerStatus.paidCount || 0)}｜目前套用${offerStatus.promotionAvailable ? "優惠價連結" : "一般價連結"}</small>\n'
)

replace_span(
    "membership-admin.js",
    "async function loadOfferStatus() {",
    "function memberPayload",
    '''async function loadOfferStatus() {
  offerStatus = calculateOfferStatus();
  renderOfferStatus();
  updatePlanOptions();
  updatePlanPreview(true);
  try {
    await publishOfferStatus();
  } catch (error) {
    console.warn("公開優惠名額狀態暫時無法更新。", error);
  }
}

'''
)

replace_span(
    "membership-admin.js",
    "async function activateMember() {",
    "async function createPaymentOrder() {",
    '''async function activateMember() {
  if (!memberForm.reportValidity()) return;
  activateButton.disabled = true;
  const originalLabel = activateButton.textContent;
  activateButton.textContent = "正在開通…";
  try {
    const email = normalizeEmail(document.getElementById("member-email").value);
    const name = document.getElementById("member-name").value.trim();
    const months = selectedMonths();
    const existing = members.find((item) => item.email === email) || {};
    offerStatus = calculateOfferStatus();
    const tier = existing.priceTier === "regular" || existing.pendingPriceTier === "regular"
      ? "regular"
      : existing.priceTier === "promo" || existing.pendingPriceTier === "promo"
        ? "promo"
        : currentTier();
    const amount = planAmountForTier(months, tier);
    const now = new Date();
    const currentExpiry = dateValue(existing.expiresAt);
    const base = currentExpiry && currentExpiry > now ? currentExpiry : now;
    const expiresAt = addMonths(base, months);
    const orderNo = String(existing.lastOrderNo || existing.pendingOrderNo || `MAN${Date.now().toString(36).toUpperCase()}`);
    const sequence = tier === "promo"
      ? Number(existing.promotionSequence || existing.pendingPromotionSequence || offerStatus.paidCount + 1)
      : null;
    const payload = {
      email,
      name,
      memberType: "sponsor-member",
      articleAccess: true,
      wellnessAccess: false,
      accessScope: "sponsor-paid-articles",
      accessVersion: 2,
      planMonths: months,
      amount,
      priceTier: tier,
      promotionSequence: sequence,
      paymentStatus: "paid",
      status: "active",
      disabled: false,
      suspended: false,
      revokedAt: deleteField(),
      firstJoinedAt: existing.firstJoinedAt || now.toISOString(),
      startsAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      paidAt: now.toISOString(),
      lastOrderNo: orderNo,
      pendingOrderNo: deleteField(),
      pendingPlanMonths: deleteField(),
      pendingAmount: deleteField(),
      pendingPriceTier: deleteField(),
      pendingPromotionSequence: deleteField(),
      pendingPaymentUrl: deleteField(),
      pendingPaymentDeadline: deleteField(),
      confirmedBy: auth.currentUser?.email || "",
      confirmedAt: serverTimestamp(),
      note: document.getElementById("member-note").value.trim(),
      updatedAt: serverTimestamp()
    };
    await setDoc(doc(db, "sponsorMemberAccess", email), payload, { merge: true });
    await writeSponsorHistory(email, payload, "verified");
    statusEl.textContent = `付款已確認並開通｜${tier === "promo" ? `前200名優惠第 ${sequence} 名` : "一般價格"}｜NT$${Number(amount).toLocaleString("zh-TW")}／${months}個月`;
    await loadMembers();
    resetMemberForm();
  } finally {
    activateButton.disabled = false;
    activateButton.textContent = originalLabel;
  }
}

'''
)

replace_span(
    "membership-admin.js",
    "async function createPaymentOrder() {",
    "function paymentDeadline() {",
    '''async function createPaymentOrder() {
  if (!memberForm.reportValidity()) return;
  offerStatus = calculateOfferStatus();
  updatePlanOptions();
  updatePlanPreview(true);
  openPaymentEmail();
}

'''
)

replace_span(
    "membership-admin.js",
    "function openPaymentEmail() {",
    "function hasAuthoritativeSponsorAccess",
    '''function openPaymentEmail() {
  if (!memberForm.reportValidity()) return;
  offerStatus = calculateOfferStatus();
  const email = normalizeEmail(document.getElementById("member-email").value);
  const name = document.getElementById("member-name").value.trim() || "會員";
  const months = selectedMonths();
  const tier = currentTier();
  const amount = Number(planAmountForTier(months, tier)).toLocaleString("zh-TW");
  const paymentUrl = tier === "promo"
    ? String(settings.sponsorPromoPaymentUrl || "").trim()
    : String(settings.sponsorRegularPaymentUrl || "").trim();
  if (!paymentUrl) {
    alert(tier === "promo" ? "請先設定前200名優惠付款連結。" : "請先設定第201名起一般價格付款連結。");
    return;
  }
  paymentUrlEl.value = paymentUrl;
  amountEl.value = String(planAmountForTier(months, tier));
  const tierText = tier === "promo"
    ? `前${offerStatus.promoLimit}名優惠（目前尚餘 ${offerStatus.remaining} 名）`
    : "第201名起一般價格";
  const subject = `靈元院贊助專屬文章｜${months}個月方案付款連結`;
  const body = `${name}您好：\n\n您本次適用：${tierText}\n觀看期間：${months}個月\n應繳金額：新台幣 ${amount} 元\n\n請由以下綠界連結完成付款：\n${paymentUrl}\n\n付款完成後，靈元院行政團隊核對款項，再以本信收件 Email（${email}）開通贊助專屬文章會員資格。\n\n靈元院行政團隊`;
  statusEl.textContent = `已依正式會員名單判讀為「${tierText}」，正在開啟付款通知 Email。`;
  location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

'''
)

replace_span(
    "membership-admin.js",
    "async function loadMembers() {",
    "installOfferAdminUi();",
    '''async function loadMembers() {
  const snapshot = await getDocs(collection(db, "sponsorMemberAccess"));
  members = snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => item.memberType === "sponsor-member")
    .sort((a, b) => String(a.email).localeCompare(String(b.email), "zh-TW"));
  offerStatus = calculateOfferStatus();
  renderMembers();
  renderOfferStatus();
  updatePlanOptions();
  updatePlanPreview(true);
  try {
    await publishOfferStatus();
  } catch (error) {
    console.warn("公開優惠名額狀態暫時無法更新。", error);
  }
}

'''
)

replace_once(
    "membership-admin.js",
    'emailButton?.addEventListener("click", openPaymentEmail);\n',
    ''
)
replace_once(
    "membership-admin.js",
    '    await Promise.all([loadMembers(), loadPaymentBackendStatus(), loadOfferStatus()]);\n',
    '    await loadMembers();\n'
)

# ---- Admin wording / cache ----
replace_once(
    "admin.html",
    '<div class="field"><label for="sponsor-reservation-hours">優惠名額保留期限（小時）</label><input id="sponsor-reservation-hours" type="number" min="1" max="168" value="24"></div>\n',
    ''
)
replace_once(
    "admin.html",
    '              <p class="membership-help">兩個綠界連結內都需可選擇一個月與三個月方案。系統會在會員按下付款時重新確認名額，前200人次導向優惠連結，第201人次起自動導向一般價格連結。</p>\n',
    '              <p class="membership-help">兩個綠界連結內都需可選擇一個月與三個月方案。系統直接依已確認付款的正式會員名單計算：前200名使用優惠連結，第201名起使用一般價連結；不需金流後端或機密金鑰。</p>\n'
)
replace_once(
    "admin.html",
    '                <button id="member-send-payment" class="btn primary" type="button" disabled>正在確認金流後端…</button>\n                <button id="member-activate" class="btn" type="button">確認付款並開通</button>\n                <button id="member-email-payment" class="btn" type="button">開啟繳費通知 Email</button>\n',
    '                <button id="member-send-payment" class="btn primary" type="button">依名單判讀並開啟付款通知</button>\n                <button id="member-activate" class="btn" type="button">確認付款並開通</button>\n'
)
replace_once(
    "admin.html",
    'membership-admin.js?v=20260805-manual-ecpay-1',
    'membership-admin.js?v=20260805-simple-links-1'
)

# Remove obsolete setting access from membership-admin.js.
p = Path("membership-admin.js")
text = p.read_text(encoding="utf-8")
text = text.replace('  document.getElementById("sponsor-reservation-hours").value = String(settings.reservationHours || 24);\n', '')
text = text.replace('    sponsorReservationHours: positiveInteger(document.getElementById("sponsor-reservation-hours").value, 24),\n', '')
p.write_text(text, encoding="utf-8")

# ---- Public checkout: direct link selected from public status doc, no Functions ----
Path("sponsor-checkout.js").write_text(r'''import { auth, db } from "./firebase-config.js";
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
''', encoding="utf-8")

# Hide the public status record from article listings.
replace_once(
    "articles.js",
    '    articles = snapshot.docs\n      .map((item) => ({ id: item.id, ...item.data() }))\n      .sort(sortPublished);\n',
    '    articles = snapshot.docs\n      .map((item) => ({ id: item.id, ...item.data() }))\n      .filter((article) => article.hidden !== true && article.systemRecord !== true)\n      .sort(sortPublished);\n'
)

replace_once("articles.html", 'sponsor-checkout.js?v=20260805-manual-ecpay-1', 'sponsor-checkout.js?v=20260805-simple-links-1')
replace_once("articles.html", 'articles.js?v=20260805-manual-ecpay-1', 'articles.js?v=20260805-simple-links-1')

print("Applied simple sponsor links without Firebase Functions.")
