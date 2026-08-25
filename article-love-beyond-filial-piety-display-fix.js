const ARTICLE_ID = "love-beyond-filial-piety-and-ancestor-worship";
const params = new URLSearchParams(location.search);

if (params.get("id") === ARTICLE_ID) {
  const version = "20260810-original-photo-fix-1";
  const base = "assets/articles/love-beyond-filial-piety/";
  const assets = {
    cover: `${base}cover-photo-v2.webp?v=${version}`,
    first: `${base}from-duty-to-love-v2.webp?v=${version}`,
    second: `${base}lineage-transformation-v2.webp?v=${version}`
  };

  const style = document.createElement("style");
  style.id = "love-beyond-filial-piety-photo-fix";
  style.textContent = `
    .article-view[data-article-id="${ARTICLE_ID}"] .article-cover,
    .article-view[data-article-id="${ARTICLE_ID}"] .article-body img {
      height: auto !important;
      max-height: none !important;
      object-fit: contain !important;
      object-position: center !important;
      background: transparent !important;
    }
  `;
  document.head.appendChild(style);

  function targetFor(img) {
    const src = img.getAttribute("src") || "";
    const alt = img.getAttribute("alt") || "";

    if (img.classList.contains("article-cover")) return assets.cover;

    if (
      alt.includes("家族的根進入生命") ||
      src.includes("family-roots.svg") ||
      src.includes("from-duty-to-love.jpg") ||
      src.includes("from-duty-to-love-v2.webp")
    ) return assets.first;

    if (
      alt.includes("真正的祭祖") ||
      src.includes("transforming-lineage.svg") ||
      src.includes("lineage-transformation.jpg") ||
      src.includes("lineage-transformation-v2.webp")
    ) return assets.second;

    return "";
  }

  function repairImages(scope = document) {
    const article = scope.matches?.(`.article-view[data-article-id="${ARTICLE_ID}"]`)
      ? scope
      : scope.querySelector?.(`.article-view[data-article-id="${ARTICLE_ID}"]`);
    if (!article) return;

    article.querySelectorAll("img").forEach((img) => {
      const target = targetFor(img);
      if (!target) return;
      if (img.getAttribute("src") !== target) img.setAttribute("src", target);
      img.removeAttribute("width");
      img.removeAttribute("height");
      img.style.height = "auto";
      img.style.maxHeight = "none";
    });
  }

  repairImages();

  document.addEventListener("lyyuan:article-rendered", () => repairImages());
}
