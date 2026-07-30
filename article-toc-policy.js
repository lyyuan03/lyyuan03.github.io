(() => {
  "use strict";

  if (!location.pathname.endsWith("/articles.html") || !new URLSearchParams(location.search).has("id")) return;

  const compactLength = (value = "") => String(value).replace(/\s+/g, "").length;

  const applyPolicy = () => {
    const article = document.querySelector(".article-view");
    const body = article?.querySelector(".article-body");
    const toc = article?.querySelector(".article-toc");
    if (!article || !body || !toc) return false;

    const h2Count = [...body.querySelectorAll("h2")]
      .filter((heading) => heading.textContent.trim()).length;
    const articleLength = compactLength(body.textContent || "");
    const shouldShow = articleLength >= 3000 || h2Count >= 5;

    if (!shouldShow) {
      toc.remove();
      return true;
    }

    const cover = article.querySelector(".article-cover");
    if (cover && cover.nextElementSibling !== toc) cover.after(toc);

    toc.classList.remove("is-open");
    toc.querySelector(".article-toc-toggle")?.setAttribute("aria-expanded", "false");
    return true;
  };

  const observer = new MutationObserver(() => {
    if (applyPolicy()) observer.disconnect();
  });

  const start = () => {
    if (applyPolicy()) return;
    observer.observe(document.documentElement, { childList: true, subtree: true });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();