const SIMPLE_GATE_SELECTOR = ".article-paid-gate";
const RESTORED_GATE_SELECTOR = "[data-paid-gate-restored]";

const PLAN_PRICES = Object.freeze({
  1: { promo: 120, regular: 150 },
  3: { promo: 300, regular: 400 }
});

function installStyles() {
  if (document.getElementById("paid-gate-restore-styles")) return;
  const style = document.createElement("style");
  style.id = "paid-gate-restore-styles";
  style.textContent = `
    [data-paid-gate-restored]{position:relative;z-index:20;isolation:isolate;margin:28px 0 18px;padding:26px 0 30px;overflow:visible}
    [data-paid-gate-restored] .paid-lock-preview{position:absolute;inset:0;overflow:hidden;opacity:.16;filter:blur(3px);pointer-events:none}
    [data-paid-gate-restored] .paid-lock-preview span{display:block;width:88%;height:12px;margin:0 auto 18px;border-radius:999px;background:rgba(89,79,71,.22)}
    [data-paid-gate-restored] .paid-lock-preview span:nth-child(2n){width:74%}
    [data-paid-gate-restored] .paid-lock-preview span:nth-child(3n){width:82%}
    [data-paid-gate-restored] .paid-lock-card{position:relative!important;z-index:22!important;display:block!important;visibility:visible!important;opacity:1!important;filter:none!important;width:min(570px,94%);margin:0 auto;padding:28px 26px 24px;text-align:center;background:rgba(248,244,236,.985);border:1px solid rgba(165,130,84,.38);box-shadow:0 16px 38px rgba(42,34,26,.12);color:#3F3024}
    [data-paid-gate-restored] .member-lock-icon{margin-bottom:7px;color:#8B683F;font-size:18px;line-height:1}
    [data-paid-gate-restored] h3{margin:0 0 9px;color:#493724;font-family:'Noto Serif TC',serif;font-size:24px;font-weight:700;letter-spacing:.05em}
    [data-paid-gate-restored] .paid-lock-card>p{margin:0 auto 15px;max-width:470px;color:#665747;font-size:13px;line-height:1.9}
    [data-paid-gate-restored] .paid-promo-note{margin:4px auto 12px;padding:7px 10px;max-width:470px;border:1px solid rgba(139,104,63,.24);background:rgba(165,130,84,.08);color:#684C2E;font-size:11px;line-height:1.6}
    [data-paid-gate-restored] .paid-plan-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:0 auto 13px;max-width:470px}
    [data-paid-gate-restored] .paid-plan{position:relative;display:flex;min-height:128px;padding:15px 12px;flex-direction:column;align-items:center;justify-content:center;border:1px solid rgba(125,94,55,.34);background:rgba(255,255,255,.58);color:#493724;cursor:pointer;font-family:'Noto Sans TC',sans-serif;transition:transform .18s ease,border-color .18s ease,background .18s ease}
    [data-paid-gate-restored] .paid-plan:hover{transform:translateY(-2px);border-color:rgba(125,94,55,.62);background:#fff}
    [data-paid-gate-restored] .paid-plan.is-featured{border-color:rgba(139,104,63,.52);box-shadow:inset 0 0 0 1px rgba(165,130,84,.14)}
    [data-paid-gate-restored] .paid-plan-badge{position:absolute;right:8px;top:8px;padding:2px 6px;background:#80623D;color:#fff;font-size:9px;letter-spacing:.08em}
    [data-paid-gate-restored] .paid-plan-term{font-size:12px;letter-spacing:.08em;color:#725D48}
    [data-paid-gate-restored] .paid-plan-price{margin:5px 0 1px;font-family:'Noto Serif TC',serif;font-size:24px;font-weight:700;color:#4E3821}
    [data-paid-gate-restored] .paid-plan del{font-size:10px;color:#9A8A78}
    [data-paid-gate-restored] .paid-plan small{margin-top:6px;color:#725D48;font-size:10px;line-height:1.5}
    [data-paid-gate-restored] .paid-value-note{margin:11px auto 0;max-width:470px;color:#765C40;font-size:11px;line-height:1.75}
    [data-paid-gate-restored] .paid-member-return{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;margin-top:16px;padding-top:15px;border-top:1px solid rgba(89,79,71,.15);font-size:12px;color:#665747}
    [data-paid-gate-restored] .paid-inquiry-primary{min-height:38px;padding:8px 14px;border:1px solid rgba(125,94,55,.48);background:rgba(139,104,63,.12);color:#5A4127;font-family:'Noto Sans TC',sans-serif;font-size:12px;font-weight:600;cursor:pointer}
    [data-paid-gate-restored] .paid-inquiry-primary:hover{background:rgba(139,104,63,.2)}
    [data-paid-gate-restored] .paid-help-link{display:inline-block;margin-top:12px;color:#7A5A36;font-size:11px;text-decoration:underline;text-underline-offset:3px}
    [data-paid-gate-restored] .paid-login-note{display:block;margin-top:9px;color:#786B5E;font-size:10px;line-height:1.7}
    @media(max-width:560px){
      [data-paid-gate-restored] .paid-lock-card{width:94%;padding:22px 16px}
      [data-paid-gate-restored] h3{font-size:22px}
      [data-paid-gate-restored] .paid-plan-grid{grid-template-columns:1fr}
      [data-paid-gate-restored] .paid-plan{min-height:108px}
    }
  `;
  document.head.appendChild(style);
}

function money(value) {
  return `NT$${Number(value).toLocaleString("zh-TW")}`;
}

function isSponsorGate(node) {
  if (!(node instanceof Element)) return false;
  if (!node.matches(SIMPLE_GATE_SELECTOR)) return false;
  return (node.textContent || "").includes("贊助專屬文章");
}

function restoredGateMarkup() {
  const month1 = PLAN_PRICES[1];
  const month3 = PLAN_PRICES[3];
  return `
    <section class="member-lock-zone paid-lock-zone" data-paid-gate-restored aria-label="解鎖贊助專屬全文">
      <div class="paid-lock-preview" aria-hidden="true">
        <span></span><span></span><span></span><span></span><span></span><span></span>
      </div>
      <div class="member-lock-card paid-lock-card sponsor-join-card">
        <div class="member-lock-icon" aria-hidden="true">◇</div>
        <h3>解鎖全文</h3>
        <p>本篇前段開放試閱。加入贊助專屬文章閱讀方案後，在有效期間內可閱讀所有贊助專屬文章。</p>
        <div class="paid-promo-note">前 200 名優惠方案</div>
        <div class="paid-plan-grid" role="group" aria-label="選擇閱讀方案">
          <button type="button" class="paid-plan" data-sponsor-plan="1">
            <span class="paid-plan-term">1 個月</span>
            <strong class="paid-plan-price">${money(month1.promo)}</strong>
            <del>原價 ${money(month1.regular)}</del>
            <small>閱讀所有贊助專屬文章</small>
          </button>
          <button type="button" class="paid-plan is-featured" data-sponsor-plan="3">
            <span class="paid-plan-badge">推薦</span>
            <span class="paid-plan-term">3 個月</span>
            <strong class="paid-plan-price">${money(month3.promo)}</strong>
            <del>原價 ${money(month3.regular)}</del>
            <small>閱讀所有贊助專屬文章</small>
          </button>
        </div>
        <div class="paid-value-note">點選方案後登入 Gmail，系統會帶你前往綠界安全付款；付款成功後自動開通閱讀資格。</div>
        <div class="paid-member-return">
          <span>已經有閱讀資格？</span>
          <button class="paid-inquiry-primary" type="button" data-paid-member-login>會員登入／重新確認資格</button>
        </div>
        <a class="paid-help-link" href="https://t.me/lyyuan" target="_blank" rel="noopener noreferrer">付款完成仍未解鎖｜聯繫行政團隊</a>
        <small class="paid-login-note">請使用付款時登入的 Gmail 閱讀全文。</small>
      </div>
    </section>`;
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
    if (replacement) gate.replaceWith(replacement);
  });
  return gates.length;
}

function repairRestoredGates(root = document) {
  const gates = [];
  if (root instanceof Element && root.matches?.(RESTORED_GATE_SELECTOR)) gates.push(root);
  root.querySelectorAll?.(RESTORED_GATE_SELECTOR).forEach((gate) => gates.push(gate));

  let repaired = 0;
  gates.forEach((gate) => {
    if (!gate.isConnected) return;
    const card = gate.querySelector(".paid-lock-card");
    if (card) {
      card.hidden = false;
      card.removeAttribute("aria-hidden");
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.innerHTML = restoredGateMarkup().trim();
    const replacement = wrapper.firstElementChild;
    if (replacement) {
      gate.replaceWith(replacement);
      repaired += 1;
    }
  });
  return repaired;
}

async function handleMemberLogin(button) {
  const checkout = window.LingYuanSponsorCheckout;
  const state = checkout?.getState?.();
  const signedInEmail = state?.user?.email || state?.member?.email || "";
  if (signedInEmail) {
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "正在重新確認閱讀資格…";
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
repairRestoredGates();

const articleRoot = document.getElementById("article-root") || document.documentElement;
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (!(node instanceof Element)) continue;
      if (upgradeSimpleGates(node)) {
        repairRestoredGates(articleRoot);
        return;
      }
      repairRestoredGates(node);
    }
  }
  upgradeSimpleGates();
  repairRestoredGates(articleRoot);
});
observer.observe(articleRoot, { childList: true, subtree: true });

document.addEventListener("click", (event) => {
  const button = event.target.closest(`${RESTORED_GATE_SELECTOR} [data-paid-member-login]`);
  if (!button) return;
  event.preventDefault();
  handleMemberLogin(button);
}, true);

window.addEventListener("pageshow", () => {
  upgradeSimpleGates();
  repairRestoredGates(articleRoot);
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    upgradeSimpleGates();
    repairRestoredGates(articleRoot);
  }
});
