const params = new URLSearchParams(location.search);
const activeId = params.get("id") || "";

const RECORD_PAGES = {
  "2026-building-patron-record": {
    kicker: "LING YUAN BUILDING RECORD",
    badge: "建院總功德主專屬",
    meta: "靈元院建院紀錄｜總功德主限定",
    gateTitle: "建院總功德主專屬紀錄",
    gateText: "此頁僅提供本次建院總功德主閱讀。請使用登記護持時所留的 Gmail 登入，或由靈元院提供的個人專屬連結進入。",
    notice: "本頁為建院總功德主限定內容，包含建院進度、實景、設計與影音紀錄，請勿任意轉載或轉傳。"
  },
  "2026-lineage-lamp-building-record": {
    kicker: "LING YUAN BUILDING RECORD",
    badge: "護法續脈燈首專屬",
    meta: "靈元院建院近況｜護法續脈燈首限定",
    gateTitle: "護法續脈燈首專屬紀錄",
    gateText: "此頁僅提供本次護法續脈燈首閱讀。請使用登記護持時所留的 Gmail 登入，或由靈元院提供的個人專屬連結進入。",
    notice: "本頁為護法續脈燈首限定內容，提供階段性建院近況與精選設計紀錄，請勿任意轉載或轉傳。"
  }
};

const config = RECORD_PAGES[activeId];
if (config) installConstructionRecordPage(config);

function installConstructionRecordPage(pageConfig) {
  document.documentElement.classList.add("construction-record-mode");

  const style = document.createElement("style");
  style.id = "construction-record-style";
  style.textContent = `
    .construction-record-mode body{background:#071207}
    .construction-record-mode body.is-article-detail>.hero{display:none}
    .construction-record-mode body.is-article-detail main{max-width:1180px;padding-top:38px}
    .construction-record-mode .article-view.construction-record-view{max-width:980px;padding:44px 64px 66px;border:1px solid rgba(203,189,166,.46);box-shadow:0 24px 70px rgba(0,0,0,.2)}
    .construction-record-mode .construction-record-head{margin:0 0 18px;padding:0 0 18px;border-bottom:1px solid rgba(139,104,63,.2)}
    .construction-record-mode .construction-record-kicker{font-size:10px;letter-spacing:.28em;color:#8B683F;margin-bottom:9px}
    .construction-record-mode .construction-record-badge{display:inline-flex;align-items:center;border:1px solid rgba(139,104,63,.36);background:rgba(165,130,84,.08);color:#6A4D2E;font-size:11px;letter-spacing:.13em;padding:6px 11px}
    .construction-record-mode .construction-record-view>.article-meta{font-size:11px;color:#806A52;letter-spacing:.14em;margin:18px 0 0}
    .construction-record-mode .construction-record-view>h2{font-size:clamp(30px,5vw,46px);line-height:1.48;margin-top:10px;color:#59452F}
    .construction-record-mode .construction-record-view .article-cover{margin-top:30px;border-color:rgba(139,104,63,.3)}
    .construction-record-mode .construction-record-view .article-body{font-size:18px;line-height:2.05}
    .construction-record-mode .construction-record-view .article-body h2{margin-top:54px;padding-top:24px;border-top:1px solid rgba(139,104,63,.22);font-size:27px;color:#604831}
    .construction-record-mode .construction-record-view .article-body h3{color:#725532}
    .construction-record-mode .construction-record-view .article-body figure{position:relative;margin:34px 0;overflow:hidden;background:#d8d0c2}
    .construction-record-mode .construction-record-view .article-body figure img,.construction-record-mode .construction-record-view .article-body p>img{display:block;width:100%;height:auto;border:1px solid rgba(139,104,63,.25);box-shadow:0 12px 30px rgba(63,48,36,.08)}
    .construction-record-mode .construction-record-view .article-body figure::after{content:"";position:absolute;right:16px;bottom:14px;width:112px;height:42px;background:url("assets/footer-logo-gold.svg") right bottom/contain no-repeat;opacity:.9;filter:drop-shadow(0 1px 3px rgba(0,0,0,.28));pointer-events:none}
    .construction-record-mode .construction-record-view .article-body p:has(>img){position:relative;display:block;margin:34px 0}
    .construction-record-mode .construction-record-view .article-body p:has(>img)::after{content:"";position:absolute;right:16px;bottom:14px;width:112px;height:42px;background:url("assets/footer-logo-gold.svg") right bottom/contain no-repeat;opacity:.9;filter:drop-shadow(0 1px 3px rgba(0,0,0,.28));pointer-events:none}
    .construction-record-mode .construction-record-view .article-guide,
    .construction-record-mode .construction-record-view .recommended-book,
    .construction-record-mode .construction-record-view .next-reading,
    .construction-record-mode .construction-record-view .article-share,
    .construction-record-mode .construction-record-view .limited-reading-countdown{display:none!important}
    .construction-record-mode .construction-record-view .article-toc{margin:26px 0 34px;background:rgba(165,130,84,.055);border-color:rgba(139,104,63,.25)}
    .construction-record-mode .construction-record-view .article-paid-gate{margin-top:32px;padding:34px 26px;border-color:rgba(139,104,63,.34);background:rgba(165,130,84,.07)}
    .construction-record-mode .construction-record-view .article-paid-gate strong{font-size:21px}
    .construction-record-mode .construction-record-confidential{margin:48px 0 0;padding:18px 20px;border-top:1px solid rgba(139,104,63,.2);border-bottom:1px solid rgba(139,104,63,.2);font-size:12px;line-height:1.85;color:#806A52;text-align:center}
    .construction-record-mode .construction-video-pending{margin:24px 0 34px;padding:28px 24px;border:1px solid rgba(139,104,63,.28);background:linear-gradient(135deg,rgba(96,99,48,.08),rgba(165,130,84,.08));text-align:center;color:#725532;font-size:13px;letter-spacing:.08em}
    @media(max-width:760px){
      .construction-record-mode body.is-article-detail main{padding:22px 14px 54px}
      .construction-record-mode .article-view.construction-record-view{padding:30px 22px 44px}
      .construction-record-mode .construction-record-view .article-body{font-size:17px;line-height:1.95}
      .construction-record-mode .construction-record-view .article-body h2{font-size:23px;margin-top:42px}
      .construction-record-mode .construction-record-head{margin-bottom:14px}
      .construction-record-mode .construction-record-view .article-body figure::after,
      .construction-record-mode .construction-record-view .article-body p:has(>img)::after{right:10px;bottom:9px;width:82px;height:32px}
    }
  `;
  document.head.appendChild(style);

  const apply = () => {
    const article = document.querySelector(`.article-view[data-article-id="${CSS.escape(activeId)}"]`);
    if (!article) return false;
    article.classList.add("construction-record-view");

    if (!article.querySelector(".construction-record-head")) {
      const head = document.createElement("div");
      head.className = "construction-record-head";
      head.innerHTML = `<div class="construction-record-kicker">${pageConfig.kicker}</div><span class="construction-record-badge">${pageConfig.badge}</span>`;
      const meta = article.querySelector(":scope > .article-meta");
      (meta || article.firstElementChild)?.before(head);
    }

    const meta = article.querySelector(":scope > .article-meta");
    if (meta) meta.textContent = pageConfig.meta;

    const gate = article.querySelector(".article-paid-gate");
    if (gate) {
      const strong = gate.querySelector("strong");
      const paragraph = gate.querySelector("p");
      if (strong) strong.textContent = pageConfig.gateTitle;
      if (paragraph) paragraph.textContent = pageConfig.gateText;
    }

    const tocLabel = article.querySelector(".article-toc-toggle span");
    if (tocLabel) tocLabel.textContent = "建院紀錄導覽";

    if (activeId === "2026-building-patron-record") {
      [...article.querySelectorAll(".article-body p")].forEach((paragraph) => {
        if (!paragraph.textContent.includes("【宇色老師建院影音｜即將於本頁更新】")) return;
        paragraph.classList.add("construction-video-pending");
        paragraph.textContent = "宇色老師建院影音｜即將於本頁更新";
      });
    }

    if (activeId === "2026-lineage-lamp-building-record") {
      article.querySelectorAll(".article-body img").forEach((image) => {
        const src = image.getAttribute("src") || "";
        if (/dizhi-render-(?:exterior|garden)\.jpg/i.test(src)) return;
        const container = image.closest("figure") || image.closest("p");
        container?.remove();
      });
    }

    if (!article.querySelector(".construction-record-confidential")) {
      const note = document.createElement("div");
      note.className = "construction-record-confidential";
      note.textContent = pageConfig.notice;
      article.appendChild(note);
    }
    return true;
  };

  if (apply()) return;
  const observer = new MutationObserver(() => {
    if (apply()) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}
