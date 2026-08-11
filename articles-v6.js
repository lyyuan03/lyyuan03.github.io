import "./articles-core-20260810-v6.js?v=20260810-remove-unrequested-1";
import "./article-love-beyond-filial-piety-display-fix.js?v=20260810-original-photo-fix-1";
import "./sponsor-checkout-v3.js?v=20260808-email-renewal-1";

const articleVisualFixStyleId = "article-visual-fixes-20260811";
if (!document.getElementById(articleVisualFixStyleId)) {
  const style = document.createElement("style");
  style.id = articleVisualFixStyleId;
  style.textContent = `
    .article-card-content .article-list-title,
    .article-card-content h2 {
      color: #3F3024 !important;
      font-weight: 700 !important;
      text-shadow: none !important;
    }
    .footer-brand-mark {
      display: block;
      width: 128px;
      max-width: 34vw;
      height: auto;
      opacity: .64;
      filter: saturate(.72) brightness(.78);
    }
  `;
  document.head.appendChild(style);
}
