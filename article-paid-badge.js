// Deprecated legacy title badge.
// Paid article status is rendered by articles-core as .article-access-badge.
// Keep this file as a cleanup shim for any older page or cached loader that still references it.

function removeLegacyPaidTitleBadges(root = document) {
  root.querySelectorAll?.(
    ".article-list-title .paid-article-badge, .article-card h2 .paid-article-badge"
  ).forEach((badge) => badge.remove());

  root.querySelectorAll?.(
    ".article-list-title.has-paid-badge, .article-card h2.has-paid-badge"
  ).forEach((title) => title.classList.remove("has-paid-badge"));

  document.getElementById("paid-article-badge-style")?.remove();
}

removeLegacyPaidTitleBadges();

const articleRoot = document.getElementById("article-root");
if (articleRoot) {
  new MutationObserver(() => removeLegacyPaidTitleBadges(articleRoot))
    .observe(articleRoot, { childList: true, subtree: true });
}
