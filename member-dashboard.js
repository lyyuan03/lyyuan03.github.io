import "./member-dashboard-core-20260808.js?v=20260808-email-renewal-1";
import "./sponsor-dashboard-payment-new-tab.js?v=20260808-dashboard-new-tab-1";
import "./sponsor-checkout-v3.js?v=20260808-email-renewal-1";
import "./sponsor-dashboard-renewal-checkout-fix.js?v=20260826-renewal-ecpay-2";
import "./sponsor-dashboard-renewal.js?v=20260825-dashboard-renewal-repair-1";
import "./member-dashboard-expiry-reminder.js?v=20260812-expiry-reminder-4";
import "./member-offers-integration.js?v=20260813-offer-highlight-1";
import "./member-offer-video-addon.js?v=20260813-offer-highlight-1";

// 會員中心內容必須永遠清楚可讀；即使進場動畫或 IntersectionObserver 發生異常，
// 也不允許 .lyy-reveal 停留在 opacity:0 / blur 狀態。
function lockDashboardReadable() {
  if (!document.getElementById("member-dashboard-readable-lock")) {
    const style = document.createElement("style");
    style.id = "member-dashboard-readable-lock";
    style.textContent = `
      html.lyy-motion-on #member-dashboard .lyy-reveal,
      html.lyy-motion-on #member-dashboard .lyy-reveal.lyy-visible,
      #member-dashboard .lyy-reveal {
        opacity: 1 !important;
        filter: none !important;
        -webkit-filter: none !important;
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

  document.querySelectorAll("#member-dashboard .lyy-reveal").forEach((element) => {
    element.classList.add("lyy-visible");
    element.style.filter = "none";
    element.style.opacity = "1";
  });
}

lockDashboardReadable();

const readableObserver = new MutationObserver(lockDashboardReadable);
readableObserver.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["class", "hidden"]
});

window.addEventListener("pageshow", lockDashboardReadable);
window.addEventListener("load", lockDashboardReadable, { once: true });

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