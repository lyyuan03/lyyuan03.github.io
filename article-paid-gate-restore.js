import { auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const SIMPLE_GATE_SELECTOR = ".article-paid-gate";
const RESTORED_GATE_SELECTOR = "[data-paid-gate-restored]";

function isSponsorGate(node) {
  if (!(node instanceof Element)) return false;
  const heading = node.querySelector("strong")?.textContent?.trim() || "";
  return heading === "贊助專屬文章";
}

function restoredGateMarkup() {
  const signedIn = Boolean(auth.currentUser?.email);
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
          <button class="paid-inquiry-primary" type="button" data-paid-member-login>${signedIn ? "重新確認會員資格" : "會員登入"}</button>
        </div>
        <a class="paid-help-link" href="https://t.me/lyyuan" target="_blank" rel="noopener noreferrer">付款後尚未開通｜聯繫行政團隊</a>
        <small>完成開通後，使用登記的 Gmail 登入即可閱讀全文。</small>
      </div>
    </section>`;
}

function refreshCheckout() {
  try {
    window.LingYuanSponsorCheckout?.render?.();
    window.LingYuanSponsorCheckout?.refresh?.();
  } catch (error) {
    console.warn("贊助方案畫面重新整理失敗。", error);
  }
}

function upgradeSimpleGates(root = document) {
  root.querySelectorAll?.(SIMPLE_GATE_SELECTOR).forEach((gate) => {
    if (!isSponsorGate(gate)) return;
    const wrapper = document.createElement("div");
    wrapper.innerHTML = restoredGateMarkup().trim();
    const replacement = wrapper.firstElementChild;
    if (!replacement) return;
    gate.replaceWith(replacement);
    refreshCheckout();
  });
}

function syncLoginLabels(root = document) {
  const signedIn = Boolean(auth.currentUser?.email);
  root.querySelectorAll?.(`${RESTORED_GATE_SELECTOR} [data-paid-member-login]`).forEach((button) => {
    if (button.disabled) return;
    button.textContent = signedIn ? "重新確認會員資格" : "會員登入";
  });
}

async function handleMemberLogin(button) {
  if (!auth.currentUser?.email) {
    const loginButton = document.getElementById("member-login-button");
    if (loginButton) {
      loginButton.click();
      return;
    }
    location.href = "/member-dashboard.html";
    return;
  }

  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "正在重新確認會員資格…";
  try {
    await window.LingYuanSponsorCheckout?.refresh?.();
  } catch (error) {
    console.warn("重新確認贊助會員資格失敗。", error);
  } finally {
    location.reload();
    button.disabled = false;
    button.textContent = originalText;
  }
}

document.addEventListener("click", (event) => {
  const button = event.target.closest(`${RESTORED_GATE_SELECTOR} [data-paid-member-login]`);
  if (!button) return;
  event.preventDefault();
  handleMemberLogin(button);
}, true);

const observer = new MutationObserver((mutations) => {
  if (!mutations.some((mutation) => mutation.addedNodes.length > 0)) return;
  upgradeSimpleGates();
  syncLoginLabels();
});
observer.observe(document.documentElement, { childList: true, subtree: true });

onAuthStateChanged(auth, () => {
  upgradeSimpleGates();
  syncLoginLabels();
  refreshCheckout();
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    upgradeSimpleGates();
    syncLoginLabels();
    refreshCheckout();
  }, { once: true });
} else {
  upgradeSimpleGates();
  syncLoginLabels();
  refreshCheckout();
}
