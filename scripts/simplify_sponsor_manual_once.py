from pathlib import Path
import re


def sub_once(path: str, pattern: str, replacement: str) -> None:
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'{path}: expected one match, got {count}')
    p.write_text(updated, encoding='utf-8')


# Admin HTML: keep only the fields and actions needed for the semi-manual workflow.
sub_once(
    'admin.html',
    r'''<div class="grid">\s*<div class="field"><label for="member-name">會員姓名</label><input id="member-name"></div>\s*<div class="field"><label for="member-email">登入 Gmail</label><input id="member-email" type="email" required></div>\s*<div class="field"><label for="member-months">會員方案</label><select id="member-months"><option value="1">一個月｜NT\$120</option><option value="3">三個月｜NT\$300</option></select></div>\s*<div class="field"><label for="member-amount">應繳金額</label><input id="member-amount" type="number" min="0" step="1" required></div>\s*<div class="field"><label for="member-payment-status">付款狀態</label><select id="member-payment-status"><option value="pending">待付款</option><option value="paid">已付款</option></select></div>\s*</div>\s*<div class="field"><label for="member-payment-url">本次付款連結</label><input id="member-payment-url" type="url" placeholder="預設帶入綠界付款連結"></div>''',
    '''<div class="grid">
                <div class="field"><label for="member-name">會員姓名</label><input id="member-name"></div>
                <div class="field"><label for="member-email">登入 Gmail</label><input id="member-email" type="email" required></div>
                <div class="field"><label for="member-months">會員方案</label><select id="member-months"><option value="1">一個月｜NT$120</option><option value="3">三個月｜NT$300</option></select></div>
                <div class="field"><label for="member-amount">本次實收金額</label><input id="member-amount" type="number" min="0" step="1" required readonly></div>
              </div>'''
)
sub_once(
    'admin.html',
    r'''<div class="top-actions">\s*<button class="btn primary" type="submit">儲存會員資料</button>\s*<button id="member-send-payment" class="btn primary" type="button">依名單判讀並開啟付款通知</button>\s*<button id="member-activate" class="btn" type="button">確認付款並開通</button>\s*<button id="member-form-reset" class="btn" type="button">清除</button>\s*</div>''',
    '''<div class="top-actions">
                <button id="member-send-payment" class="btn primary" type="button">開啟付款通知 Email</button>
                <button id="member-activate" class="btn" type="button">付款成功，加入／續期會員</button>
                <button id="member-form-reset" class="btn" type="button">清除</button>
              </div>
              <p class="membership-help">流程只有兩步：先依目前人數寄出正確付款連結；確認收到款項後，再按「付款成功，加入／續期會員」。只有這一步完成後，前台倒數人數才會更新。</p>'''
)
# Prevent enter-key submits because the form is now button-driven.
sub_once('admin.html', r'<form id="member-form" class="membership-form">', '<form id="member-form" class="membership-form" onsubmit="return false;">')
# Update cache busting.
sub_once('admin.html', r'membership-admin\.js\?v=[^"\']+', 'membership-admin.js?v=20260805-simple-manual-2')
sub_once('articles.html', r'sponsor-checkout\.js\?v=[^"\']+', 'sponsor-checkout.js?v=20260805-simple-manual-2')


# membership-admin.js: remove dead fields/functions and count only formally paid unique Gmail records.
p = Path('membership-admin.js')
text = p.read_text(encoding='utf-8')
text = text.replace('const paymentUrlEl = document.getElementById("member-payment-url");\n', '')
text = text.replace('const emailButton = document.getElementById("member-email-payment");\n', '')

text = re.sub(
    r'''function isPaidMember\(member = \{\}\) \{.*?\n\}\n\nfunction calculateOfferStatus\(\) \{''',
    '''function isCountedSponsorMember(member = {}) {
  return member.memberType === "sponsor-member"
    && member.paymentStatus === "paid"
    && member.articleAccess === true
    && member.accessScope === "sponsor-paid-articles"
    && Number(member.accessVersion || 0) >= 2
    && Boolean(String(member.lastOrderNo || "").trim());
}

function calculateOfferStatus() {''',
    text,
    count=1,
    flags=re.S,
)
text = text.replace('const paidCount = members.filter(isPaidMember).length;', 'const paidCount = members.filter(isCountedSponsorMember).length;')
text = text.replace('正式會員 ${Number(offerStatus.paidCount || 0)}｜目前套用', '已加入會員 ${Number(offerStatus.paidCount || 0)} 人｜目前套用')
text = text.replace('優惠名額直接依「已確認付款並開通」的正式會員名單計算。前200名使用優惠連結，第201名起自動改用一般價連結；不建立綠界訂單，也不需要 Firebase Functions 或機密金鑰。', '優惠名額直接依「付款成功後，已加入正式名單的 Gmail 人數」計算。前200名使用優惠連結，第201名起使用一般價連結；同一個 Gmail 續期不會重複增加人數。')

# Remove references to an individual payment-link field.
text = re.sub(r'\n  if \(!paymentUrlEl\.value\) paymentUrlEl\.value = .*?;\n', '\n', text)
text = re.sub(r'\n  paymentUrlEl\.value = .*?;\n', '\n', text)
text = text.replace('    paymentUrl: paymentUrlEl.value.trim(),\n', '')

# Remove obsolete memberPayload/saveMember block entirely.
text = re.sub(
    r'''\nfunction memberPayload\(paymentStatus = null, extendMembership = false\) \{.*?\n\}\n\nasync function saveMember\(event\) \{.*?\n\}\n\nasync function activateMember\(\) \{''',
    '\nasync function activateMember() {',
    text,
    count=1,
    flags=re.S,
)

# Always use the current list-derived tier when confirming payment; existing members do not consume a second slot.
text = re.sub(
    r'''    const tier = existing\.priceTier === "regular" \|\| existing\.pendingPriceTier === "regular"\n      \? "regular"\n      : existing\.priceTier === "promo" \|\| existing\.pendingPriceTier === "promo"\n        \? "promo"\n        : currentTier\(\);''',
    '    const tier = currentTier();',
    text,
    count=1,
)
text = text.replace(
    '    const sequence = tier === "promo"\n      ? Number(existing.promotionSequence || existing.pendingPromotionSequence || offerStatus.paidCount + 1)\n      : null;',
    '    const alreadyCounted = isCountedSponsorMember(existing);\n    const sequence = tier === "promo"\n      ? Number(existing.promotionSequence || (alreadyCounted ? offerStatus.paidCount : offerStatus.paidCount + 1))\n      : null;'
)

# Email action should not store or require per-user payment fields.
text = text.replace('  paymentUrlEl.value = paymentUrl;\n', '')
text = text.replace('  amountEl.value = String(planAmountForTier(months, tier));\n', '  amountEl.value = String(planAmountForTier(months, tier));\n')

# Replace the complicated pending/formal list with one formal member list.
text = re.sub(
    r'''function renderMembers\(\) \{.*?\n\}\n\nfunction editMember\(email\) \{''',
    '''function renderMembers() {
  if (!members.length) {
    listEl.innerHTML = '<div class="empty">目前尚無已付款的贊助會員。前台會顯示優惠名額尚餘 200 名。</div>';
    return;
  }
  listEl.innerHTML = `
    <section>
      <h4 style="margin:0 0 6px;color:#CBAA77;font-size:17px">已付款贊助會員（${members.length} 人）</h4>
      <p class="membership-help" style="margin-top:0">此名單就是前台優惠倒數的統計依據。同一個 Gmail 只計算一人，續期不會重複增加名額。</p>
      ${members.map((member) => {
        const active = hasAuthoritativeSponsorAccess(member);
        const label = active ? "有效" : "已到期";
        const tier = member.priceTier === "regular"
          ? "一般價"
          : member.promotionSequence
            ? `優惠第${Number(member.promotionSequence)}名`
            : "優惠價";
        return `<div class="member-row">
          <div>
            <strong>${escapeHtml(member.name || "未填姓名")}｜${label}</strong>
            <small>${escapeHtml(member.email)}｜${Number(member.planMonths || 0)}個月｜NT$${Number(member.amount || 0).toLocaleString("zh-TW")}｜${tier}｜到期 ${escapeHtml(formatDate(member.expiresAt))}</small>
          </div>
          <div class="member-row-actions">
            <button class="btn" type="button" data-edit="${escapeHtml(member.email)}">編輯／續期</button>
            <button class="btn danger" type="button" data-delete="${escapeHtml(member.email)}">刪除</button>
          </div>
        </div>`;
      }).join("")}
    </section>`;
  listEl.querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => editMember(button.dataset.edit)));
  listEl.querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", () => removeMember(button.dataset.delete)));
}

function editMember(email) {''',
    text,
    count=1,
    flags=re.S,
)

# Simplify edit form.
text = re.sub(r'\n  document\.getElementById\("member-payment-status"\)\.value = .*?;', '', text)
text = re.sub(r'\n  paymentUrlEl\.value = .*?;', '', text)

# Only load formal paid records into the count/list.
text = text.replace(
    '.filter((item) => item.memberType === "sponsor-member")',
    '.filter((item) => isCountedSponsorMember(item))'
)

# Remove obsolete submit listener and Functions wording.
text = text.replace('memberForm?.addEventListener("submit", (event) => saveMember(event).catch(showError));\n', '')
text = text.replace('amountEl?.addEventListener("input", () => updatePlanPreview(false));\n', '')
text = text.replace('會員資料暫時無法載入，請確認 Firebase 規則與 Functions 已發布。', '會員資料暫時無法載入，請確認管理員登入狀態與 Firebase 規則。')

p.write_text(text, encoding='utf-8')


# sponsor-checkout.js: no login, no modal, one click goes straight to the current fixed ECPay link.
Path('sponsor-checkout.js').write_text('''import { db } from "./firebase-config.js";
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
''', encoding='utf-8')

# Ensure the hidden status document never appears in the public list.
p = Path('articles.js')
text = p.read_text(encoding='utf-8')
if 'filter((article) => article.hidden !== true && article.systemRecord !== true)' not in text:
    text = text.replace('  const merged = [...mergedById.values()];', '  const merged = [...mergedById.values()].filter((article) => article.hidden !== true && article.systemRecord !== true);')
p.write_text(text, encoding='utf-8')

print('Simpler semi-manual sponsor workflow applied.')
