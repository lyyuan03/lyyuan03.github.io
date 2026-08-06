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
  latestBookScript.src = "/books-latest-feature-2026.js?v=20260806-1731";
  latestBookScript.defer = true;
  document.head.appendChild(latestBookScript);
}

if (location.pathname.endsWith("/articles.html")) {
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