const ARTICLE_ID = "2058-future-person-prophecy";
const STADIUM_SRC = "/assets/articles/2058-future-person-prophecy/japanese-stadium-championship.webp?v=20260816-2";
const NETWORK_SRC = "/assets/articles/2058-future-person-prophecy/collective-consciousness-network.webp?v=20260816-2";

const sections = [
  { id: "section-1", title: "七則預言，為什麼讓人開始相信？", startsWith: "一個人，同時說中了奧運金牌數" },
  { id: "section-2", title: "爆紅之前的六則預言，最大的破口", startsWith: "六則預言確實都標示著同一個日期" },
  { id: "section-3", title: "爆紅之後：一則全錯，一則幾乎全對", startsWith: "一則是2024年1月10日" },
  { id: "section-4", title: "盲眼預言者與情報系統的疑雲", startsWith: "二十世紀最有名的預言者之一" },
  { id: "section-5", title: "神諭者與騙徒：人為什麼需要預言", startsWith: "「未來人」與這位盲眼老婦" },
  { id: "section-6", title: "宇宙意識網：未來不是鐵軌", startsWith: "我在《喚醒天生好命》中談過一個概念" },
  { id: "section-7", title: "為什麼今天的預言愈來愈難準", startsWith: "我從無極瑤池金母的教導中" },
  { id: "section-8", title: "三個我長期觀察到的規律", startsWith: "這件事情，恰好也印證了三個" },
  { id: "section-9", title: "修行真正介入命運的地方", startsWith: "靈魂意識愈覺醒的人" },
  { id: "section-10", title: "預言真正的價值，是回到現在", startsWith: "如果一定要用一句話解釋預言" },
  { id: "section-11", title: "真正的穩定，是活在不確定裡", startsWith: "我們之所以這麼喜歡預言" }
];

function cleanText(element) {
  return String(element?.textContent || "").replace(/\s+/g, " ").trim();
}

function getView() {
  return document.querySelector(`.article-view[data-article-id="${ARTICLE_ID}"]`);
}

function getParagraphs(view) {
  return [...view.querySelectorAll(".article-body p")];
}

function findParagraph(view, startsWith) {
  return getParagraphs(view).find((paragraph) => cleanText(paragraph).startsWith(startsWith));
}

function installStyle() {
  if (document.getElementById("article-2058-toc-style-v2")) return;
  const style = document.createElement("style");
  style.id = "article-2058-toc-style-v2";
  style.textContent = `
.article-view[data-article-id="${ARTICLE_ID}"] .article-toc{margin:18px 0 28px;border:1px solid rgba(89,79,71,.22);background:rgba(255,255,255,.24);color:#493724}
.article-view[data-article-id="${ARTICLE_ID}"] .article-toc-toggle{display:flex;align-items:center;justify-content:space-between;width:100%;min-height:50px;padding:11px 15px;border:0;background:transparent;color:#493724;cursor:pointer;font-family:var(--sans);font-size:14px;font-weight:500;letter-spacing:.08em;text-align:left}
.article-view[data-article-id="${ARTICLE_ID}"] .article-toc-toggle small{margin-left:auto;color:#806a52;font-size:11px;font-weight:400}
.article-view[data-article-id="${ARTICLE_ID}"] .article-toc-toggle:after{content:"＋";margin-left:24px;color:#8b683f;font-size:18px}
.article-view[data-article-id="${ARTICLE_ID}"] .article-toc.is-open .article-toc-toggle:after{content:"－"}
.article-view[data-article-id="${ARTICLE_ID}"] .article-toc ol{display:none;margin:0;padding:0 20px 15px 42px;border-top:1px solid rgba(89,79,71,.14)}
.article-view[data-article-id="${ARTICLE_ID}"] .article-toc.is-open ol{display:block}
.article-view[data-article-id="${ARTICLE_ID}"] .article-toc li{padding:7px 0;color:#5a4631;font-family:var(--serif);font-size:14px;line-height:1.65}
.article-view[data-article-id="${ARTICLE_ID}"] .article-toc a{color:#5a4631;text-decoration:none;border:0}
.article-view[data-article-id="${ARTICLE_ID}"] .article-toc a:hover{color:#8b683f}
.article-view[data-article-id="${ARTICLE_ID}"] .article-body [id^="section-"]{scroll-margin-top:125px}
.article-view[data-article-id="${ARTICLE_ID}"] p[data-article2058-image]{position:relative;width:100%;max-width:100%;margin:30px auto!important;padding:0!important;overflow:hidden;line-height:0}
.article-view[data-article-id="${ARTICLE_ID}"] p[data-article2058-image] img{display:block;width:100%!important;max-width:100%!important;height:auto!important;margin:0!important;border:1px solid var(--line)}
@media(max-width:520px){.article-view[data-article-id="${ARTICLE_ID}"] .article-toc{margin:14px 0 24px}.article-view[data-article-id="${ARTICLE_ID}"] .article-toc-toggle{font-size:13px}.article-view[data-article-id="${ARTICLE_ID}"] .article-toc ol{padding-left:34px;padding-right:14px}.article-view[data-article-id="${ARTICLE_ID}"] .article-toc li{font-size:13px}}
`;
  document.head.appendChild(style);
}

function assignAnchors(view) {
  sections.forEach((section) => {
    const match = findParagraph(view, section.startsWith);
    if (match) match.id = section.id;
  });
}

function removeBadFemaleImage(view) {
  view.querySelectorAll('img[src*="fictional-female-politician"], img[src*="female-politician"]').forEach((image) => {
    const parent = image.parentElement;
    if (parent?.tagName === "P" && parent.querySelectorAll("img").length === 1 && !cleanText(parent)) parent.remove();
    else image.remove();
  });
}

function ensureImageAfter(view, startsWith, key, src, alt, acceptedFragments) {
  const target = findParagraph(view, startsWith);
  if (!target) return;

  let holder = view.querySelector(`p[data-article2058-image="${key}"]`);
  if (!holder) {
    holder = getParagraphs(view).find((paragraph) => {
      const images = paragraph.querySelectorAll(":scope > img");
      if (images.length !== 1 || cleanText(paragraph)) return false;
      const imageSrc = images[0].getAttribute("src") || images[0].src || "";
      return acceptedFragments.some((fragment) => imageSrc.includes(fragment));
    });
  }

  if (!holder) {
    holder = document.createElement("p");
    holder.appendChild(document.createElement("img"));
  }

  holder.dataset.article2058Image = key;
  let image = holder.querySelector(":scope > img");
  if (!image) {
    image = document.createElement("img");
    holder.replaceChildren(image);
  }
  if (image.getAttribute("src") !== src) image.setAttribute("src", src);
  image.setAttribute("alt", alt);
  image.removeAttribute("style");
  image.classList.remove("article-inline-image-managed");
  holder.classList.remove("article-inline-image-frame");

  if (target.nextElementSibling !== holder) target.insertAdjacentElement("afterend", holder);
}

function ensureImages(view) {
  removeBadFemaleImage(view);
  ensureImageAfter(
    view,
    "如果他的預言全部集中在政治與金融",
    "stadium",
    STADIUM_SRC,
    "日本職棒與足球冠軍賽現場",
    ["japanese-stadium-championship"]
  );
  ensureImageAfter(
    view,
    "我在《喚醒天生好命》中談過一個概念",
    "network",
    NETWORK_SRC,
    "宇宙意識網與集體意識的連結",
    ["collective-consciousness-network", "consciousness-network"]
  );
}

function ensureToc(view) {
  assignAnchors(view);
  const availableSections = sections.filter((section) => view.querySelector(`#${section.id}`));
  if (!availableSections.length) return;

  let toc = view.querySelector("#article-2058-toc");
  if (!toc) {
    view.querySelectorAll(".article-toc").forEach((old) => old.remove());
    toc = document.createElement("aside");
    toc.id = "article-2058-toc";
    toc.className = "article-toc";
    toc.setAttribute("aria-label", "文章章節");
    toc.setAttribute("role", "navigation");
    const cover = view.querySelector(":scope > .article-cover");
    const firstBody = view.querySelector(":scope > .article-body");
    const anchor = cover || firstBody;
    if (anchor) anchor.insertAdjacentElement("beforebegin", toc);
    else view.prepend(toc);
  }

  toc.innerHTML = `
    <button class="article-toc-toggle" type="button" aria-expanded="false">
      <span>文章章節</span><small>共 ${availableSections.length} 節</small>
    </button>
    <ol>${availableSections.map((section) => `<li><a href="#${section.id}">${section.title}</a></li>`).join("")}</ol>
  `;

  const toggle = toc.querySelector(".article-toc-toggle");
  toggle.addEventListener("click", () => {
    const open = toc.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
  });

  toc.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", (event) => {
      const target = view.querySelector(link.getAttribute("href"));
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      toc.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });
}

let scheduled = false;
function applyPatch() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    installStyle();
    const view = getView();
    if (!view) return;
    ensureImages(view);
    ensureToc(view);
  });
}

const root = document.getElementById("article-root") || document.body;
new MutationObserver(applyPatch).observe(root, { childList: true, subtree: true });
document.addEventListener("DOMContentLoaded", applyPatch, { once: true });
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") applyPatch(); });
window.addEventListener("pageshow", applyPatch);

let attempts = 0;
const retry = window.setInterval(() => {
  applyPatch();
  attempts += 1;
  if (attempts >= 30 && getView()?.querySelector("#article-2058-toc")) window.clearInterval(retry);
  else if (attempts >= 60) window.clearInterval(retry);
}, 500);

applyPatch();
