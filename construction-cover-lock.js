const TARGET_ARTICLE_ID = "2026-lineage-lamp-building-record";
const HERO_SRC = "images/dizhi-hero.jpg?v=20260822-cover-lock-1";
const HERO_ALT = "元神的呼喚｜一間靈修人專屬的靈修道院";

const activeId = new URLSearchParams(location.search).get("id") || "";

if (activeId === TARGET_ARTICLE_ID) {
  const enforceCover = () => {
    const article = document.querySelector(`.article-view[data-article-id="${CSS.escape(TARGET_ARTICLE_ID)}"]`);
    if (!article) return;

    const cover = article.querySelector(":scope > .article-cover");
    if (!cover) return;

    const currentSrc = cover.getAttribute("src") || "";
    if (!/dizhi-hero\.jpg/i.test(currentSrc)) {
      cover.setAttribute("src", HERO_SRC);
    }
    if (cover.getAttribute("alt") !== HERO_ALT) {
      cover.setAttribute("alt", HERO_ALT);
    }
    if (cover.hasAttribute("srcset")) {
      cover.removeAttribute("srcset");
    }
  };

  let scheduled = false;
  const scheduleEnforce = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      enforceCover();
    });
  };

  enforceCover();
  document.addEventListener("lyyuan:article-rendered", scheduleEnforce);

  window.addEventListener("pageshow", enforceCover);
  window.addEventListener("load", enforceCover);
}
