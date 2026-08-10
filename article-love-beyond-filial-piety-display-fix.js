// Front-end safety fix for the filial-piety article.
// Some browsers / Firestore-backed article records may still reference the old low-resolution
// photo replacements. Two of those assets render incorrectly, so normalize them back to the
// original resolution-independent SVG artwork whenever the article is rendered.

const ARTICLE_ID = "love-beyond-filial-piety-and-ancestor-worship";
const ASSET_BASE = "assets/articles/love-beyond-filial-piety/";

const replacements = [
  {
    match: /(?:from-duty-to-love(?:-v2)?\.(?:jpg|jpeg|webp))/i,
    src: `${ASSET_BASE}family-roots.svg?v=20260810-display-fix-1`
  },
  {
    match: /(?:lineage-transformation(?:-v2)?\.(?:jpg|jpeg|webp))/i,
    src: `${ASSET_BASE}transforming-lineage.svg?v=20260810-display-fix-1`
  },
  {
    match: /(?:cover-photo(?:-hq|-v2)?\.(?:jpg|jpeg|webp))/i,
    src: `${ASSET_BASE}cover.svg?v=20260810-display-fix-1`
  }
];

function fixImage(img) {
  const src = img.getAttribute("src") || "";
  const replacement = replacements.find((item) => item.match.test(src));
  if (!replacement || src === replacement.src) return;
  img.setAttribute("src", replacement.src);
  img.removeAttribute("srcset");
}

function fixArticleImages(root = document) {
  const article = root.querySelector?.(`.article-view[data-article-id="${ARTICLE_ID}"]`)
    || document.querySelector(`.article-view[data-article-id="${ARTICLE_ID}"]`);
  if (!article) return;
  article.querySelectorAll("img").forEach(fixImage);
}

function start() {
  const root = document.getElementById("article-root");
  if (!root) return;

  fixArticleImages(root);

  const observer = new MutationObserver(() => fixArticleImages(root));
  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src", "srcset"]
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}
