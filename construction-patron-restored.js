const TARGET_ID = "2026-building-patron-record";
const activeId = new URLSearchParams(location.search).get("id") || "";

if (activeId === TARGET_ID) {
  installPatronLegacyView();
}

function installPatronLegacyView() {
  document.documentElement.classList.add("construction-record-mode");

  if (!document.getElementById("construction-patron-restore-style")) {
    const style = document.createElement("style");
    style.id = "construction-patron-restore-style";
    style.textContent = `
      .construction-record-mode body{background:#071207}
      .construction-record-mode body.is-article-detail>.hero{display:none!important}
      .construction-record-mode body.is-article-detail main{max-width:1180px;padding-top:38px}
      .construction-record-mode .article-view.construction-record-view{
        max-width:980px;padding:44px 64px 66px;
        border:1px solid rgba(203,189,166,.46);
        box-shadow:0 24px 70px rgba(0,0,0,.2)
      }
      .construction-record-mode .construction-record-head{
        margin:0 0 18px;padding:0 0 18px;
        border-bottom:1px solid rgba(139,104,63,.2)
      }
      .construction-record-mode .construction-record-kicker{
        font-size:10px;letter-spacing:.28em;color:#8B683F;margin-bottom:9px
      }
      .construction-record-mode .construction-record-badge{
        display:inline-flex;align-items:center;
        border:1px solid rgba(139,104,63,.36);
        background:rgba(165,130,84,.08);color:#6A4D2E;
        font-size:11px;letter-spacing:.13em;padding:6px 11px
      }
      .construction-record-mode .construction-record-view>.article-meta{
        font-size:11px;color:#806A52;letter-spacing:.14em;margin:18px 0 0
      }
      .construction-record-mode .construction-record-view>h2{
        font-size:clamp(30px,5vw,46px);line-height:1.48;
        margin-top:10px;color:#59452F
      }
      .construction-record-mode .construction-record-view .article-cover{
        margin-top:30px;border-color:rgba(139,104,63,.3)
      }
      .construction-record-mode .construction-record-view .article-body{
        font-size:18px;line-height:2.05
      }
      .construction-record-mode .construction-record-view .article-body h2{
        margin-top:54px;padding-top:24px;
        border-top:1px solid rgba(139,104,63,.22);
        font-size:27px;color:#604831
      }
      .construction-record-mode .construction-record-view .article-body h3{color:#725532}
      .construction-record-mode .construction-record-view .article-body figure{
        position:relative;margin:34px 0;overflow:hidden;background:#d8d0c2
      }
      .construction-record-mode .construction-record-view .article-body figure img,
      .construction-record-mode .construction-record-view .article-body p>img{
        display:block;width:100%;height:auto;
        border:1px solid rgba(139,104,63,.25);
        box-shadow:0 12px 30px rgba(63,48,36,.08)
      }
      .construction-record-mode .construction-record-view .article-body figure::after{
        content:"";position:absolute;right:16px;bottom:14px;
        width:112px;height:42px;
        background:url("assets/footer-logo-gold.svg") right bottom/contain no-repeat;
        opacity:.9;filter:drop-shadow(0 1px 3px rgba(0,0,0,.28));
        pointer-events:none
      }
      .construction-record-mode .construction-record-view .article-body p:has(>img){
        position:relative;display:block;margin:34px 0
      }
      .construction-record-mode .construction-record-view .article-body p:has(>img)::after{
        content:"";position:absolute;right:16px;bottom:14px;
        width:112px;height:42px;
        background:url("assets/footer-logo-gold.svg") right bottom/contain no-repeat;
        opacity:.9;filter:drop-shadow(0 1px 3px rgba(0,0,0,.28));
        pointer-events:none
      }
      .construction-record-mode .construction-record-view .construction-latest-progress{
        margin:30px 0 40px;border:1px solid rgba(139,104,63,.24);
        background:rgba(165,130,84,.045);overflow:hidden
      }
      .construction-record-mode .construction-record-view .construction-latest-progress::after{display:none!important}
      .construction-record-mode .construction-record-view .construction-latest-progress img{
        display:block;width:100%;height:auto;border:0;box-shadow:none;background:#d8d0c2
      }
      .construction-record-mode .construction-record-view .construction-latest-progress figcaption{
        padding:15px 18px 17px;color:#725b43;font-size:13px;
        line-height:1.8;letter-spacing:.04em;
        border-top:1px solid rgba(139,104,63,.18)
      }
      .construction-record-mode .construction-record-view .construction-latest-progress figcaption strong{
        display:block;color:#65492f;font-size:14px;
        letter-spacing:.08em;margin-bottom:3px;font-weight:600
      }
      .construction-record-mode .construction-record-view .article-guide,
      .construction-record-mode .construction-record-view .recommended-book,
      .construction-record-mode .construction-record-view .next-reading,
      .construction-record-mode .construction-record-view .article-share,
      .construction-record-mode .construction-record-view .limited-reading-countdown{
        display:none!important
      }
      .construction-record-mode .construction-record-view .article-toc{
        margin:26px 0 34px;background:rgba(165,130,84,.055);
        border-color:rgba(139,104,63,.25)
      }
      .construction-record-mode .construction-record-confidential{
        margin:48px 0 0;padding:18px 20px;
        border-top:1px solid rgba(139,104,63,.2);
        border-bottom:1px solid rgba(139,104,63,.2);
        font-size:12px;line-height:1.85;color:#806A52;text-align:center
      }
      .construction-record-mode .construction-video-pending{
        margin:24px 0 34px;padding:28px 24px;
        border:1px solid rgba(139,104,63,.28);
        background:linear-gradient(135deg,rgba(96,99,48,.08),rgba(165,130,84,.08));
        text-align:center;color:#725532;font-size:13px;letter-spacing:.08em
      }
      @media(max-width:760px){
        .construction-record-mode body.is-article-detail main{padding:22px 14px 54px}
        .construction-record-mode .article-view.construction-record-view{padding:30px 22px 44px}
        .construction-record-mode .construction-record-view .article-body{font-size:17px;line-height:1.95}
        .construction-record-mode .construction-record-view .article-body h2{font-size:23px;margin-top:42px}
        .construction-record-mode .construction-record-view .article-body figure::after,
        .construction-record-mode .construction-record-view .article-body p:has(>img)::after{
          right:10px;bottom:9px;width:82px;height:32px
        }
        .construction-record-mode .construction-record-view .construction-latest-progress figcaption{
          font-size:12px;padding:13px 14px 15px
        }
      }
    `;
    document.head.appendChild(style);
  }

  function removePausedImage(article) {
    const body = article.querySelector(".article-body");
    if (!body) return;
    [...body.querySelectorAll("img")].forEach((img) => {
      const src = img.getAttribute("src") || "";
      if (!/dizhi-build-pause\.jpg/i.test(src)) return;
      const block = img.closest("figure") || img.closest("p") || img;
      block.remove();
    });
  }

  function moveVisionImageToFirst(article) {
    const body = article.querySelector(".article-body");
    if (!body) return;
    const target = [...body.querySelectorAll("img")].find((img) => /dizhi-hero\.jpg/i.test(img.getAttribute("src") || ""));
    if (!target) return;
    const first = body.querySelector("img");
    if (!first || first === target) return;
    const targetBlock = target.closest("figure") || target.closest("p") || target;
    const firstBlock = first.closest("figure") || first.closest("p") || first;
    firstBlock.before(targetBlock);
  }

  async function ensureLatestProgressPhoto(article) {
    if (article.querySelector(".construction-latest-progress")) return;
    const body = article.querySelector(".article-body");
    if (!body) return;

    const headings = [...body.querySelectorAll("h2")];
    const progressHeading = headings.find((h) => (h.textContent || "").includes("建院目前走到哪裡"));
    if (!progressHeading) return;

    const nextHeading = headings[headings.indexOf(progressHeading) + 1] || null;
    const figure = document.createElement("figure");
    figure.className = "construction-latest-progress";
    figure.innerHTML = `
      <img alt="靈元院 2026 年 8 月最新建院進度" loading="eager" decoding="async">
      <figcaption><strong>2026 年 8 月｜最新建院進度</strong>主體建築外觀已逐步成形，現場持續依工程節點推進。這張照片記錄的是靈元院 2026 年 8 月目前最新的建院現況。</figcaption>
    `;

    if (nextHeading) nextHeading.before(figure);
    else body.appendChild(figure);

    try {
      const response = await fetch("assets/lingyuan-progress-202608.webp.b64?v=20260901-patron-restore-1", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const base64 = (await response.text()).replace(/\s+/g, "");
      if (!base64.startsWith("UklGR")) throw new Error("invalid WebP payload");
      figure.querySelector("img").src = `data:image/webp;base64,${base64}`;
    } catch (error) {
      console.warn("總功德主建院最新進度照片載入失敗：", error);
      figure.remove();
    }
  }

  function decorate(article) {
    article.classList.add("construction-record-view");

    if (!article.querySelector(".construction-record-head")) {
      const head = document.createElement("div");
      head.className = "construction-record-head";
      head.innerHTML = '<div class="construction-record-kicker">LING YUAN BUILDING RECORD</div><span class="construction-record-badge">建院總功德主專屬</span>';
      const meta = article.querySelector(":scope > .article-meta");
      (meta || article.firstElementChild)?.before(head);
    }

    const meta = article.querySelector(":scope > .article-meta");
    if (meta) meta.textContent = "靈元院建院紀錄｜總功德主限定";

    const tocLabel = article.querySelector(".article-toc-toggle span");
    if (tocLabel) tocLabel.textContent = "建院紀錄導覽";

    [...article.querySelectorAll(".article-body p")].forEach((p) => {
      if (!(p.textContent || "").includes("宇色老師建院影音")) return;
      p.classList.add("construction-video-pending");
    });

    removePausedImage(article);
    moveVisionImageToFirst(article);
    void ensureLatestProgressPhoto(article);

    if (!article.querySelector(".construction-record-confidential") && article.querySelector(".article-body")) {
      const note = document.createElement("div");
      note.className = "construction-record-confidential";
      note.textContent = "本頁為建院總功德主限定內容，包含建院進度、實景、設計與影音紀錄，請勿任意轉載或轉傳。";
      article.appendChild(note);
    }
  }

  let scheduled = false;
  function apply() {
    const article = document.querySelector(`.article-view[data-article-id="${CSS.escape(TARGET_ID)}"]`);
    if (!article) return false;
    decorate(article);
    return true;
  }

  function scheduleApply() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      apply();
    });
  }

  apply();
  [50, 180, 500, 1200, 2500, 5000].forEach((delay) => window.setTimeout(apply, delay));

  const root = document.getElementById("article-root") || document.documentElement;
  const observer = new MutationObserver(scheduleApply);
  observer.observe(root, { childList: true, subtree: true });
}
