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
  });
}

installStyles();
applyKeyQuotes();

const articleRoot = document.getElementById("article-root") || document.documentElement;
document.addEventListener("lyyuan:article-rendered", () => applyKeyQuotes(articleRoot));

window.addEventListener("pageshow", () => applyKeyQuotes(articleRoot));
