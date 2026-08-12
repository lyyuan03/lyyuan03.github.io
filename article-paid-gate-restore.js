const SIMPLE_GATE_SELECTOR = ".article-paid-gate";
const RESTORED_GATE_SELECTOR = "[data-paid-gate-restored]";
const RETRY_KEY = "paid-gate-restore-retry";

function installStyles() {
  if (document.getElementById("paid-gate-restore-styles")) return;
  const style = document.createElement("style");
  style.id = "paid-gate-restore-styles";
  style.textContent = `
    [data-paid-gate-restored]{position:relative;margin:28px 0 18px;padding:26px 0 30px;overflow:visible}
    [data-paid-gate-restored] .paid-lock-preview{position:absolute;inset:0;overflow:hidden;opacity:.18;filter:blur(3px);pointer-events:none}
    [data-paid-gate-restored] .paid-lock-preview span{display:block;width:88%;height:12px;margin:0 auto 18px;border-radius:999px;background:rgba(89,79,71,.22)}
    [data-paid-gate-restored] .paid-lock-preview span:nth-child(2n){width:74%}
    [data-paid-gate-restored] .paid-lock-preview span:nth-child(3n){width:82%}
    [data-paid-gate-restored] .paid-lock-card{position:relative;z-index:2;width:min(520px,92%);margin:0 auto;padding:24px 24px 22px;text-align:center;background:rgba(248,244,236,.97);border:1px solid rgba(165,130,84,.36);box-shadow:0 16px 38px rgba(42,34,26,.12);color:#3F3024}
    [data-paid-gate-restored] .member-lock-icon{margin-bottom:7px;color:#8B683F;font-size:18px;line-height:1}
    [data-paid-gate-restored] h3{margin:0 0 10px;color:#493724;font-family:'Noto Serif TC',serif;font-size:22px;font-weight:700;letter-spacing:.05em}
    [data-paid-gate-restored] .paid-lock-card>p{margin:0 auto 15px;max-width:430px;color:#665747;font-size:13px;line-height:1.85}
    [data-paid-gate-restored] .paid-member-return{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;margin-top:14px;padding-top:14px;border-top:1px solid rgba(89,79,71,.15);font-size:12px;color:#665747}
    [data-paid-gate-restored] .paid-inquiry-primary{min-height:38px;padding:8px 14px;border:1px solid rgba(125,94,55,.48);background:rgba(139,104,63,.12);color:#5A4127;font-family:'Noto Sans TC',sans-serif;font-size:12px;font-weight:600;cursor:pointer}
    [data-paid-gate-restored] .paid-inquiry-primary:hover{background:rgba(139,104,63,.2)}
    [data-paid-gate-restored] .paid-help-link{display:inline-block;margin-top:12px;color:#7A5A36;font-size:11px;text-decoration:underline;text-underline-offset:3px}
    [data-paid-gate-restored] small{display:block;margin-top:9px;color:#786B5E;font-size:10px;line-height:1.7}
    @media(max-width:560px){[data-paid-gate-restored] .paid-lock-card{width:94%;padding:20px 16px}[data-paid-gate-restored] h3{font-size:20px}}
  `;
  document.head.appendChild(style);
}

function isSponsorGate(node) {
  if (!(node instanceof Element)) return false;
  if (!node.matches(SIMPLE_GATE_SELECTOR)) return false;
  return (node.textContent || "").includes("贊助專屬文章");
}

function restoredGateMarkup() {
  return `
    <section class="member-lock-zone paid-lock-zone" data-paid-gate-restored aria-label="贊助會員專屬">
      <div class="paid-lock-preview" aria-hidden="true">
        <span></span><span></span><span></span><span></span><span></span><span></span>
      </div>
      <div class="member-lock-card paid-lock-card sponsor-join-card">
        <div class="member-lock-icon" aria-hidden="true">◇</div>
        <h3>閱讀全文｜加入贊助會員</h3>
        <p>本篇目前開放前段試閱。完成贊助方案付款並由行政團隊開通後，即可使用登記的 Gmail 閱讀全文。</p>
        <div data-sponsor-smart-slot data-sponsor-context="article">
          <div class="sponsor-offer-loading">方案、適用價格與會員資格載入中，請稍候。</div>
        </div>
        <div class="paid-member-return">
          <span>已是贊助會員？</span>
          <button class="paid-inquiry-primary" type="button" data-paid-member-login>會員登入／重新確認資格</button>
        </div>
        <a class="paid-help-link" href="https://t.me/lyyuan" target="_blank" rel="noopener noreferrer">付款後尚未開通｜聯繫行政團隊</a>
        <small>完成開通後，使用登記的 Gmail 登入即可閱讀全文。</small>
      </div>
    </section>`;
}

function refreshCheckout() {
  try {
    window.LingYuanSponsorCheckout?.render?.();
    const result = window.LingYuanSponsorCheckout?.refresh?.();
    if (result?.catch) result.catch(() => {});
  } catch (error) {
    console.warn("贊助方案畫面重新整理失敗。", error);
  }
}

function upgradeSimpleGates(root = document) {
  const gates = [];
  if (root instanceof Element && isSponsorGate(root)) gates.push(root);
  root.querySelectorAll?.(SIMPLE_GATE_SELECTOR).forEach((gate) => {
    if (isSponsorGate(gate)) gates.push(gate);
  });
  gates.forEach((gate) => {
    if (!gate.isConnected) return;
    const wrapper = document.createElement("div");
    wrapper.innerHTML = restoredGateMarkup().trim();
    const replacement = wrapper.firstElementChild;
    if (!replacement) return;
    gate.replaceWith(replacement);
  });
  if (gates.length) refreshCheckout();
  return gates.length;
}

async function handleMemberLogin(button) {
  const checkout = window.LingYuanSponsorCheckout;
  const state = checkout?.getState?.();
  const signedInEmail = state?.member?.email || "";
  if (signedInEmail) {
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "正在重新確認會員資格…";
    try {
      await checkout?.refresh?.();
    } catch (error) {
      console.warn("重新確認贊助會員資格失敗。", error);
    } finally {
      location.reload();
      button.disabled = false;
      button.textContent = originalText;
    }
    return;
  }
  const loginButton = document.getElementById("member-login-button");
  if (loginButton) {
    loginButton.click();
    return;
  }
  location.href = "/member-dashboard.html";
}

installStyles();
upgradeSimpleGates();

const articleRoot = document.getElementById("article-root") || document.documentElement;
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (!(node instanceof Element)) continue;
      if (upgradeSimpleGates(node)) return;
    }
  }
  upgradeSimpleGates();
});
observer.observe(articleRoot, { childList: true, subtree: true });

document.addEventListener("click", (event) => {
  const button = event.target.closest(`${RESTORED_GATE_SELECTOR} [data-paid-member-login]`);
  if (!button) return;
  event.preventDefault();
  handleMemberLogin(button);
}, true);

let attempts = 0;
const retryTimer = window.setInterval(() => {
  attempts += 1;
  upgradeSimpleGates();
  refreshCheckout();
  if (attempts >= 30 || document.querySelector(RESTORED_GATE_SELECTOR)) {
    window.clearInterval(retryTimer);
  }
}, 400);
window[RETRY_KEY] = retryTimer;

window.addEventListener("pageshow", () => {
  upgradeSimpleGates();
  refreshCheckout();
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  upgradeSimpleGates();
  refreshCheckout();
});
