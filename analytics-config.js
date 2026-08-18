/*
 * 靈元院網站分析設定
 *
 * 建立 Google Tag Manager 容器後，將下方空字串改成 GTM-XXXXXXX。
 * 若暫時只使用 GA4，也可填入 measurementId（G-XXXXXXXXXX）。
 */
window.LYY_ANALYTICS_CONFIG = Object.freeze({
  gtmId: "",
  measurementId: ""
});

if (location.pathname.endsWith("/books.html")) {
  const latestBookScript = document.createElement("script");
  latestBookScript.src = "/books-latest-feature-2026.js?v=20260807-1505";
  latestBookScript.defer = true;
  document.head.appendChild(latestBookScript);
}

if (location.pathname.endsWith("/articles.html")) {
  // 必須在 body/footer 解析前就固定頁尾 Logo 尺寸，避免重新載入時先以 SVG 原始尺寸放大閃現。
  if (!document.getElementById("articles-footer-logo-first-paint")) {
    const footerLogoFirstPaintStyle = document.createElement("style");
    footerLogoFirstPaintStyle.id = "articles-footer-logo-first-paint";
    footerLogoFirstPaintStyle.textContent = `
      .footer-brand-mark {
        display: block;
        width: 128px;
        max-width: 34vw;
        height: auto;
        opacity: .64;
        filter: saturate(.72) brightness(.78);
      }
    `;
    document.head.appendChild(footerLogoFirstPaintStyle);
  }

  const filterScript = document.createElement("script");
  filterScript.src = "/article-filter-fix.js?v=20260730-1";
  filterScript.defer = true;
  document.head.appendChild(filterScript);

  const tocPolicyScript = document.createElement("script");
  tocPolicyScript.src = "/article-toc-policy.js?v=20260730-1";
  tocPolicyScript.defer = true;
  document.head.appendChild(tocPolicyScript);

  const eventDiagnosticsScript = document.createElement("script");
  eventDiagnosticsScript.type = "module";
  eventDiagnosticsScript.src = "/event-access-diagnostics-v2.js?v=20260803-2";
  document.head.appendChild(eventDiagnosticsScript);

  const mobileNavFixScript = document.createElement("script");
  mobileNavFixScript.src = "/article-mobile-nav-fix.js?v=20260809-1";
  mobileNavFixScript.defer = true;
  document.head.appendChild(mobileNavFixScript);
}

if (location.pathname.endsWith("/admin.html")) {
  const accessAuditScript = document.createElement("script");
  accessAuditScript.type = "module";
  accessAuditScript.src = "/activity-access-audit-v2.js?v=20260803-2";
  document.head.appendChild(accessAuditScript);

  const emailAccessCheckScript = document.createElement("script");
  emailAccessCheckScript.type = "module";
  emailAccessCheckScript.src = "/activity-email-access-check.js?v=20260804-1";
  document.head.appendChild(emailAccessCheckScript);
}

if (location.pathname.endsWith("/fahui.html")) {
  const registrationClosedScript = document.createElement("script");
  registrationClosedScript.src = "/fahui-registration-closed.js?v=20260803-1";
  registrationClosedScript.defer = true;
  document.head.appendChild(registrationClosedScript);
}

if (location.pathname.endsWith("/membership.html")) {
  const eightBenefitsScript = document.createElement("script");
  eightBenefitsScript.src = "/membership-eight-benefits.js?v=20260803-2";
  eightBenefitsScript.defer = true;
  document.head.appendChild(eightBenefitsScript);
}

if (location.pathname.endsWith("/yaochi-event-v2.html")) {
  const pilgrimageMotionStyle = document.createElement("style");
  pilgrimageMotionStyle.id = "yaochi-pilgrimage-calm-motion";
  pilgrimageMotionStyle.textContent = `
    .pilgrimage-invite.motion-visible {
      position: relative;
      overflow: hidden;
      isolation: isolate;
      border: 1px solid rgba(224,173,85,.30) !important;
      background: linear-gradient(135deg,rgba(224,173,85,.13),rgba(96,99,48,.10)) !important;
      animation: none !important;
      box-shadow: none;
    }
    .pilgrimage-invite.motion-visible::after {
      content: '';
      position: absolute;
      z-index: 0;
      top: -45%;
      bottom: -45%;
      left: -32%;
      width: 28%;
      pointer-events: none;
      background: linear-gradient(90deg,transparent,rgba(255,236,196,.24),transparent);
      filter: blur(2px);
      transform: translateX(-220%) skewX(-16deg);
      opacity: 0;
      animation: pilgrimageSweepCalm 14s ease-in-out infinite;
    }
    .pilgrimage-invite.motion-visible > * {
      position: relative;
      z-index: 1;
    }
    @keyframes pilgrimageSweepCalm {
      0%, 82% {
        transform: translateX(-220%) skewX(-16deg);
        opacity: 0;
      }
      84% {
        opacity: .38;
      }
      96% {
        transform: translateX(520%) skewX(-16deg);
        opacity: .22;
      }
      100% {
        transform: translateX(520%) skewX(-16deg);
        opacity: 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .pilgrimage-invite.motion-visible::after {
        animation: none !important;
        opacity: 0 !important;
      }
    }
  `;
  document.head.appendChild(pilgrimageMotionStyle);
}