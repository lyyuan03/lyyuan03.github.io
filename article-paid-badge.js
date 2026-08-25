// Deprecated legacy title badge.
// Paid article status is rendered by articles-core as .article-access-badge.
// Keep this cleanup shim only for older cached loaders that still reference it.

function removeLegacyPaidTitleBadges(root = document) {
  root.querySelectorAll?.(
    ".article-list-title .paid-article-badge, .article-card h2 .paid-article-badge"
  ).forEach((badge) => badge.remove());

  root.querySelectorAll?.(
    ".article-list-title.has-paid-badge, .article-card h2.has-paid-badge"
  ).forEach((title) => title.classList.remove("has-paid-badge"));

  document.getElementById("paid-article-badge-style")?.remove();
}

const articleRoot = document.getElementById("article-root") || document;
removeLegacyPaidTitleBadges(articleRoot);
document.addEventListener("lyyuan:article-rendered", () => removeLegacyPaidTitleBadges(articleRoot));
window.addEventListener("pageshow", () => removeLegacyPaidTitleBadges(articleRoot));
