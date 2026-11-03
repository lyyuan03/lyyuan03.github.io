const STYLE_ID = "article-key-quote-display-style";
const QUOTE_CLASS = "article-key-quote";

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .article-body p.${QUOTE_CLASS} {
      margin: 32px 0 34px;
      padding: 20px 24px 20px 26px;
      background: rgba(255,255,255,.82);
      color: #2F281F;
      border-left: 3px solid rgba(165,130,84,.88);
      box-shadow: none;
      font-size: 1.04em;
      line-height: 1.92;
      letter-spacing: .02em;
    }
    .article-body p.${QUOTE_CLASS} .article-quote-share {
      display: inline-flex; align-items: center; margin-left: 10px; padding: 2px 10px;
      border: 1px solid rgba(165,130,84,.55); border-radius: 999px; background: transparent;
      color: #725532; font: 600 11px/1.6 'Noto Sans TC', sans-serif; letter-spacing: .04em; cursor: pointer; vertical-align: middle;
    }
    .article-body p.${QUOTE_CLASS} .article-quote-share:hover { background: rgba(165,130,84,.14); }
    @media (max-width: 760px) {
      .article-body p.${QUOTE_CLASS} {
        margin: 28px 0 30px;
        padding: 18px 18px 18px 20px;
        font-size: 1.02em;
      }
    }
  `;
  document.head.appendChild(style);
}

function applyKeyQuotes(root = document) {
  root.querySelectorAll?.(".article-body p").forEach((paragraph) => {
    if (paragraph.classList.contains(QUOTE_CLASS)) return;
    const text = (paragraph.textContent || "").trim();
    if (!text.startsWith(">")) return;
    paragraph.classList.add(QUOTE_CLASS);
    paragraph.textContent = text.replace(/^>\s*/, "");
    addQuoteShareButton(paragraph);
  });
}

// 「分享這句」：只出現在公開段落；付費文章不提供金句分享（只分享網址）。
function addQuoteShareButton(paragraph) {
  const view = paragraph.closest(".article-view");
  if (!view || view.dataset.articleAccess === "paid" || view.dataset.paidBodyState) return;
  if (paragraph.closest(".article-support-preview, #article-remaining-content")) return;
  if (paragraph.querySelector(".article-quote-share")) return;
  const quote = (paragraph.textContent || "").trim();
  const button = document.createElement("button");
  button.type = "button";
  button.className = "article-quote-share";
  button.textContent = "分享這句";
  button.setAttribute("aria-label", "分享這句金句");
  button.addEventListener("click", () => {
    window.dispatchEvent(new CustomEvent("lyyuan:share-quote", { detail: { quote } }));
  });
  paragraph.appendChild(button);
}

installStyles();
applyKeyQuotes();

const articleRoot = document.getElementById("article-root") || document.documentElement;
const observer = new MutationObserver(() => applyKeyQuotes(articleRoot));
observer.observe(articleRoot, { childList: true, subtree: true });

window.addEventListener("pageshow", () => applyKeyQuotes(articleRoot));
