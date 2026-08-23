(() => {
  "use strict";
  if (!location.pathname.endsWith("/articles.html")) return;

  document.addEventListener("click", (event) => {
    const anchor = event.target.closest("#category-tabs a[href]");
    if (!anchor) return;
    const label = String(anchor.textContent || "").replace(/\s+/g, "").trim();
    if (!label.startsWith("全部文章")) return;
    event.preventDefault();
    location.href = "articles.html";
  }, true);
})();