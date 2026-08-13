import "./article-admin-core.js?v=20260813-manual-image-markdown-3";
const ADMIN_WELLNESS_OLD_LABEL = "養生療癒";
const ADMIN_WELLNESS_NEW_LABEL = "養生療遇";

function replaceAdminWellnessWording(root = document) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  textNodes.forEach((node) => {
    if (node.nodeValue?.includes(ADMIN_WELLNESS_OLD_LABEL)) {
      node.nodeValue = node.nodeValue.replaceAll(ADMIN_WELLNESS_OLD_LABEL, ADMIN_WELLNESS_NEW_LABEL);
    }
  });

  document.querySelectorAll('[placeholder*="養生療癒"],[title*="養生療癒"],[aria-label*="養生療癒"]').forEach((element) => {
    ["placeholder", "title", "aria-label"].forEach((attribute) => {
      const value = element.getAttribute(attribute);
      if (value?.includes(ADMIN_WELLNESS_OLD_LABEL)) {
        element.setAttribute(attribute, value.replaceAll(ADMIN_WELLNESS_OLD_LABEL, ADMIN_WELLNESS_NEW_LABEL));
      }
    });
  });
}

replaceAdminWellnessWording();
const adminWellnessWordingObserver = new MutationObserver(() => replaceAdminWellnessWording());
adminWellnessWordingObserver.observe(document.body, {
  childList: true,
  subtree: true,
  characterData: true,
  attributes: true,
  attributeFilter: ["placeholder", "title", "aria-label"]
});
