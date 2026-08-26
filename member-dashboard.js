import "./member-dashboard-core-20260808.js?v=20260808-email-renewal-1";
import "./sponsor-dashboard-payment-new-tab.js?v=20260808-dashboard-new-tab-1";
import "./sponsor-checkout-v3.js?v=20260808-email-renewal-1";
import "./sponsor-dashboard-renewal-checkout-fix.js?v=20260826-renewal-ecpay-2";
import "./sponsor-dashboard-renewal.js?v=20260825-dashboard-renewal-repair-1";
import "./member-dashboard-expiry-reminder.js?v=20260812-expiry-reminder-4";
import "./member-offers-integration.js?v=20260813-offer-highlight-1";
import "./member-offer-video-addon.js?v=20260813-offer-highlight-1";

// 會員中心以可讀、可操作為最高優先：停用可能卡在 blur/transform 的進場狀態，
// 並確保頁面垂直捲動不會被殘留的 overflow / touch-action 狀態鎖住。
function stabilizeDashboardUi() {
  if (!document.getElementById("member-dashboard-readable-lock")) {
    const style = document.createElement("style");
    style.id = "member-dashboard-readable-lock";
    style.textContent = `
      html,
      body {
        overflow-y: auto !important;
        max-height: none !important;
      }
      body {
        touch-action: auto !important;
      }
      html.lyy-motion-on #member-dashboard .lyy-reveal,
      html.lyy-motion-on #member-dashboard .lyy-reveal.lyy-visible,
      #member-dashboard .lyy-reveal {
        opacity: 1 !important;
        filter: none !important;
        -webkit-filter: none !important;
        transform: none !important;
        transition: none !important;
        will-change: auto !important;
      }
      #member-dashboard,
      #member-dashboard .card,
      #member-dashboard .section,
      #member-dashboard .identity,
      #member-dashboard .stat,
      #member-dashboard .rights-card,
      #member-dashboard .course-item {
        filter: none !important;
        -webkit-filter: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  // 這個 class 只負責會員中心的進場模糊動畫；移除後不影響會員資料與權限邏輯。
  document.documentElement.classList.remove("lyy-motion-on");

  document.documentElement.style.overflowY = "auto";
  document.body.style.overflowY = "auto";
  document.body.style.touchAction = "auto";

  document.querySelectorAll("#member-dashboard .lyy-reveal").forEach((element) => {
    element.classList.add("lyy-visible", "lyy-tilt-ready");
    element.style.filter = "none";
    element.style.opacity = "1";
    element.style.transform = "none";
    element.style.transitionDelay = "";
  });
}

stabilizeDashboardUi();

const dashboardRoot = document.getElementById("member-dashboard");
if (dashboardRoot) {
  const readableObserver = new MutationObserver(() => stabilizeDashboardUi());
  readableObserver.observe(dashboardRoot, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["hidden"]
  });
}

window.addEventListener("pageshow", stabilizeDashboardUi);
window.addEventListener("load", stabilizeDashboardUi, { once: true });

const WELLNESS_OLD_LABEL = "養生療癒";
const WELLNESS_NEW_LABEL = "養生療遇";

function replaceWellnessWording(root = document) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  textNodes.forEach((node) => {
    if (node.nodeValue?.includes(WELLNESS_OLD_LABEL)) {
      node.nodeValue = node.nodeValue.replaceAll(WELLNESS_OLD_LABEL, WELLNESS_NEW_LABEL);
    }
  });

  document.querySelectorAll('meta[content*="養生療癒"]').forEach((meta) => {
    meta.content = meta.content.replaceAll(WELLNESS_OLD_LABEL, WELLNESS_NEW_LABEL);
  });
}

replaceWellnessWording();

const wordingObserver = new MutationObserver(() => replaceWellnessWording());
wordingObserver.observe(document.body, {
  childList: true,
  subtree: true,
  characterData: true
});