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

if (location.pathname.endsWith("/articles.html")) {
  const script = document.createElement("script");
  script.src = "/article-filter-fix.js?v=20260730-1";
  script.defer = true;
  document.head.appendChild(script);
}