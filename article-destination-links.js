(() => {
  const STYLE_ID = "article-destination-links-style-v2";
  const ROOT_SELECTOR = "#article-root";
  const YUANSHEN_ARTICLE_ID = "yuanshen-destiny-archetype";
  const YUANSHEN_IMAGE_VERSION = "20260807-yuanshen-live-3";
  const YUANSHEN_IMAGE_BASE = "assets/articles/yuanshen-destiny-archetype/";

  const bookIcon = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.5 5.5A2.5 2.5 0 0 1 7 3h4.2c.7 0 1.3.3 1.8.8.5-.5 1.1-.8 1.8-.8H19a.5.5 0 0 1 .5.5v15.7a.5.5 0 0 1-.6.5l-4.1-.7a2.5 2.5 0 0 0-1.8.4 2.5 2.5 0 0 0-1.8-.4l-4.1.7a.5.5 0 0 1-.6-.5V5.5Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M13 4v15.3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    </svg>`;

  const aestheticsIcon = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 20c-4.5 0-7.7-2.4-8.8-6.4 3.8-.4 6.8 1 8.8 4 2-3 5-4.4 8.8-4C19.7 17.6 16.5 20 12 20Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M12 17.6C8.9 15.4 8 12.2 9.4 8.3c1.2.6 2 1.4 2.6 2.4.6-1 1.4-1.8 2.6-2.4 1.4 3.9.5 7.1-2.6 9.3Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M12 10.5c-.4-2.7.5-4.9 2.7-6.5 1.3 2.7.4 5-2.7 6.5Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
    </svg>`;

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .article-destination-links{
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:22px;
        margin:40px 0 20px;
        padding:4px 0 10px;
      }
      .article-destination-link{
        --dest-dark:#594F47;
        --dest-mid:#A58254;
        --dest-soft:#EEE7DA;
        --dest-ridge:rgba(89,79,71,.24);
        position:relative;
        isolation:isolate;
        display:grid;
        grid-template-columns:62px minmax(0,1fr) 44px;
        align-items:center;
        gap:17px;
        min-height:116px;
        padding:22px 23px 22px 25px;
        overflow:hidden;
        border:1px solid rgba(89,79,71,.24);
        border-radius:999px;
        color:var(--dest-dark);
        cursor:pointer;
        text-decoration:none;
        -webkit-tap-highlight-color:transparent;
        box-shadow:
          0 7px 0 var(--dest-ridge),
          0 18px 32px rgba(49,40,31,.18),
          inset 0 2px 2px rgba(255,255,255,.88),
          inset 0 -8px 15px rgba(89,79,71,.09);
        transform:translateY(0);
        transition:
          transform .3s cubic-bezier(.22,.61,.36,1),
          box-shadow .3s cubic-bezier(.22,.61,.36,1),
          border-color .3s,
          filter .3s;
      }
      .article-destination-link:before{
        content:"";
        position:absolute;
        z-index:-1;
        left:5%;
        right:5%;
        top:3px;
        height:47%;
        border-radius:999px 999px 58% 58%;
        background:linear-gradient(180deg,rgba(255,255,255,.56),rgba(255,255,255,.1) 68%,transparent);
        pointer-events:none;
      }
      .article-destination-link:after{
        content:"";
        position:absolute;
        z-index:-2;
        inset:0;
        border-radius:inherit;
        opacity:.7;
        pointer-events:none;
      }
      .article-destination-link.is-books{
        --dest-dark:#594F47;
        --dest-mid:#A58254;
        --dest-soft:#EEE7DA;
        --dest-ridge:rgba(89,79,71,.25);
        border-color:rgba(89,79,71,.3);
        background:linear-gradient(145deg,#F8F3EA 0%,#EEE7DA 46%,#DCC8A8 100%);
      }
      .article-destination-link.is-books:after{
        background:radial-gradient(circle at 18% 25%,rgba(165,130,84,.16),transparent 34%);
      }
      .article-destination-link.is-aesthetics{
        --dest-dark:#50532B;
        --dest-mid:#606330;
        --dest-soft:#DEE1CD;
        --dest-ridge:rgba(73,76,38,.28);
        border-color:rgba(96,99,48,.34);
        background:linear-gradient(145deg,#F1F2E7 0%,#DEE1CD 48%,#BFC49E 100%);
      }
      .article-destination-link.is-aesthetics:after{
        background:radial-gradient(circle at 18% 25%,rgba(96,99,48,.18),transparent 34%);
      }
      .article-destination-link:hover,
      .article-destination-link:focus-visible{
        transform:translateY(-5px) scale(1.012);
        outline:none;
        filter:saturate(1.035) brightness(1.015);
        box-shadow:
          0 10px 0 var(--dest-ridge),
          0 26px 42px rgba(49,40,31,.23),
          inset 0 2px 2px rgba(255,255,255,.96),
          inset 0 -8px 15px rgba(89,79,71,.08);
      }
      .article-destination-link:focus-visible{
        outline:2px solid rgba(197,162,111,.82);
        outline-offset:5px;
      }
      .article-destination-link:active{
        transform:translateY(4px) scale(.995);
        filter:none;
        box-shadow:
          0 2px 0 var(--dest-ridge),
          0 8px 14px rgba(49,40,31,.15),
          inset 0 3px 8px rgba(89,79,71,.13),
          inset 0 -1px 2px rgba(255,255,255,.55);
        transition-duration:.09s;
      }
      .article-destination-icon{
        position:relative;
        z-index:1;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        width:62px;
        height:62px;
        border:1px solid rgba(89,79,71,.3);
        border-radius:50%;
        background:linear-gradient(145deg,rgba(255,255,255,.72),rgba(255,255,255,.22));
        color:var(--dest-dark);
        box-shadow:
          0 5px 9px rgba(55,45,35,.13),
          inset 0 2px 2px rgba(255,255,255,.9),
          inset 0 -4px 7px rgba(89,79,71,.11);
        transition:transform .3s cubic-bezier(.22,.61,.36,1),box-shadow .3s;
      }
      .article-destination-icon:after{
        content:"";
        position:absolute;
        inset:5px;
        border:1px solid currentColor;
        border-radius:50%;
        opacity:.12;
      }
      .article-destination-icon svg{width:27px;height:27px}
      .article-destination-link:hover .article-destination-icon,
      .article-destination-link:focus-visible .article-destination-icon{
        transform:translateY(-2px) rotate(-2deg);
        box-shadow:
          0 8px 13px rgba(55,45,35,.16),
          inset 0 2px 2px rgba(255,255,255,.95),
          inset 0 -4px 7px rgba(89,79,71,.09);
      }
      .article-destination-copy{position:relative;z-index:1;display:block;min-width:0}
      .article-destination-copy small,
      .article-destination-copy strong,
      .article-destination-copy em{display:block}
      .article-destination-copy small{
        margin-bottom:3px;
        font-family:var(--sans,'Noto Sans TC',sans-serif);
        font-size:10.5px;
        font-weight:700;
        line-height:1.4;
        letter-spacing:.18em;
        opacity:.72;
      }
      .article-destination-copy strong{
        font-family:var(--serif,'Noto Serif TC',serif);
        font-size:20px;
        font-weight:700;
        line-height:1.45;
        letter-spacing:.075em;
        text-shadow:0 1px 0 rgba(255,255,255,.52);
      }
      .article-destination-copy em{
        margin-top:4px;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
        font-family:var(--sans,'Noto Sans TC',sans-serif);
        font-size:11px;
        font-style:normal;
        font-weight:500;
        line-height:1.5;
        letter-spacing:.025em;
        opacity:.7;
      }
      .article-destination-arrow{
        position:relative;
        z-index:1;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        width:44px;
        height:44px;
        border:1px solid rgba(89,79,71,.22);
        border-radius:50%;
        background:rgba(255,255,255,.26);
        color:var(--dest-dark);
        font-family:Georgia,serif;
        font-size:20px;
        line-height:1;
        opacity:.76;
        box-shadow:
          0 4px 8px rgba(55,45,35,.11),
          inset 0 1px 1px rgba(255,255,255,.78);
        transition:transform .28s cubic-bezier(.22,.61,.36,1),background .28s,box-shadow .28s;
      }
      .article-destination-link:hover .article-destination-arrow,
      .article-destination-link:focus-visible .article-destination-arrow{
        transform:translateX(4px) scale(1.06);
        background:rgba(255,255,255,.42);
        box-shadow:
          0 6px 10px rgba(55,45,35,.14),
          inset 0 1px 1px rgba(255,255,255,.9);
      }
      @media(max-width:760px){
        .article-destination-links{grid-template-columns:1fr;gap:18px;margin-top:32px;padding-bottom:8px}
        .article-destination-link{
          grid-template-columns:56px minmax(0,1fr) 40px;
          min-height:106px;
          padding:19px 20px 19px 22px;
          gap:14px;
          border-radius:42px;
        }
        .article-destination-icon{width:56px;height:56px}
        .article-destination-arrow{width:40px;height:40px}
        .article-destination-link:hover,
        .article-destination-link:focus-visible{transform:translateY(-3px)}
      }
      @media(max-width:420px){
        .article-destination-link{
          grid-template-columns:50px minmax(0,1fr) 36px;
          min-height:100px;
          padding:17px 16px 17px 18px;
          gap:11px;
          border-radius:36px;
        }
        .article-destination-icon{width:50px;height:50px}
        .article-destination-icon svg{width:24px;height:24px}
        .article-destination-arrow{width:36px;height:36px;font-size:18px}
        .article-destination-copy strong{font-size:17px}
        .article-destination-copy small{font-size:9.5px}
        .article-destination-copy em{white-space:normal;font-size:10px;line-height:1.45}
      }
      @media(prefers-reduced-motion:reduce){
        .article-destination-link,
        .article-destination-icon,
        .article-destination-arrow{transition:none!important}
        .article-destination-link:hover,
        .article-destination-link:focus-visible,
        .article-destination-link:active{transform:none!important}
      }
      /* 2026-07-21 原始文章分享列：Facebook、Instagram、LINE、Telegram、Email、複製連結 */
      .article-share{
        display:flex;
        justify-content:flex-end;
        align-items:center;
        gap:9px;
        margin:22px 0 3px;
        color:rgba(245,240,232,.68);
        font-family:var(--sans,'Noto Sans TC',sans-serif);
        font-size:12px;
        letter-spacing:.1em;
      }
      .article-share>a,.article-share>button{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        width:36px;
        height:36px;
        padding:0;
        border:0;
        border-radius:50%;
        color:#fff;
        cursor:pointer;
        transition:transform .2s,filter .2s;
        box-shadow:0 3px 10px rgba(0,0,0,.22);
        text-decoration:none;
      }
      .article-share .article-social-facebook{background:#1877F2}
      .article-share .article-social-instagram{background:linear-gradient(135deg,#833AB4 5%,#C13584 38%,#E1306C 60%,#F77737 82%,#FCAF45 100%)}
      .article-share .article-share-line{background:#06C755}
      .article-share .article-share-telegram{background:#229ED9}
      .article-share .article-share-email{background:#D86A4A}
      .article-share .article-share-copy{background:#A58254}
      .article-line-mark{font-family:Arial,sans-serif;font-size:8px;font-weight:700;letter-spacing:-.04em;color:#fff}
      .article-share>a:hover,.article-share>button:hover{filter:brightness(1.12);transform:translateY(-2px)}
      .article-share svg{width:18px;height:18px}
      .article-share-status{min-width:0;color:rgba(245,240,232,.66);font-size:11px;letter-spacing:.04em}
      .article-static-page .article-share{color:#493724}
      .article-static-page .article-share-status{color:#725c42}
      @media(max-width:520px){
        .article-share{justify-content:flex-start;flex-wrap:wrap}
      }

    `;
    document.head.appendChild(style);
  }

  function enhanceDestinationLinks() {
    document.querySelectorAll(".article-book-link-wrap:not([data-ci-enhanced])").forEach((wrap) => {
      const bookLink = wrap.querySelector(".article-book-link");
      if (!bookLink) return;

      wrap.dataset.ciEnhanced = "true";
      wrap.className = "article-destination-links";
      wrap.setAttribute("aria-label", "延伸閱讀與靈性生活");

      bookLink.className = "article-destination-link is-books";
      bookLink.innerHTML = `
        <span class="article-destination-icon">${bookIcon}</span>
        <span class="article-destination-copy">
          <small>延伸閱讀</small>
          <strong>宇色靈修著作</strong>
          <em>從文字走入更完整的思想脈絡</em>
        </span>
        <span class="article-destination-arrow" aria-hidden="true">→</span>`;

      const aestheticsLink = document.createElement("a");
      aestheticsLink.className = "article-destination-link is-aesthetics";
      aestheticsLink.href = "spiritual-aesthetics.html";
      aestheticsLink.innerHTML = `
        <span class="article-destination-icon">${aestheticsIcon}</span>
        <span class="article-destination-copy">
          <small>靈性生活</small>
          <strong>靈性美學館</strong>
          <em>讓修行落實於日常選物與生活美感</em>
        </span>
        <span class="article-destination-arrow" aria-hidden="true">→</span>`;
      wrap.appendChild(aestheticsLink);
    });
  }


  function getRestoredShareDetails(article, currentShare) {
    const existingCopy = currentShare?.querySelector(".article-share-copy");
    const shareUrl = existingCopy?.dataset.shareUrl
      || document.querySelector('meta[property="og:url"]')?.content
      || document.querySelector('link[rel="canonical"]')?.href
      || location.href;
    const shareTitle = article.querySelector(":scope > h2")?.textContent?.trim()
      || document.querySelector(".hero h1")?.textContent?.trim()
      || document.querySelector('meta[property="og:title"]')?.content
      || document.title.split("｜")[0].trim()
      || "靈元院文選";
    return { shareUrl, shareTitle };
  }

  function restoredShareMarkup(shareUrl, shareTitle) {
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedTitle = encodeURIComponent(shareTitle);
    const encodedEmail = encodeURIComponent(`${shareTitle}\n\n${shareUrl}`);
    return `
      <a class="article-social-facebook" href="https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}" target="_blank" rel="noopener noreferrer" aria-label="分享到 Facebook" title="分享到 Facebook">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 8h3V4.4c-.5-.1-2.1-.2-4-.2-3.9 0-6.6 2.4-6.6 6.8v3.8H2v4h4.4V24h5.4v-5.2h4.5l.7-4h-5.2v-3.4C11.8 9.8 12.2 8 14 8Z" fill="currentColor"/></svg>
      </a>
      <a class="article-social-instagram" href="https://www.instagram.com/lyyuan03/" target="_blank" rel="noopener noreferrer" aria-label="前往靈元院 Instagram" title="靈元院 Instagram">
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="17.4" cy="6.7" r="1.1" fill="currentColor"/></svg>
      </a>
      <a class="article-share-line" href="https://social-plugins.line.me/lineit/share?url=${encodedUrl}&text=${encodedTitle}" target="_blank" rel="noopener noreferrer" aria-label="分享到 LINE" title="分享到 LINE">
        <span class="article-line-mark" aria-hidden="true">LINE</span>
      </a>
      <a class="article-share-telegram" href="https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}" target="_blank" rel="noopener noreferrer" aria-label="分享到 Telegram" title="分享到 Telegram">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.5 3.3 18.4 20c-.2 1.2-.9 1.5-1.9.9l-4.7-3.5-2.3 2.2c-.2.3-.5.5-1 .5l.4-4.8 8.7-7.9c.4-.3-.1-.5-.6-.2L6.2 14 1.6 12.5c-1-.3-1-1 .2-1.5L20 4c.8-.3 1.6.2 1.5 1.3Z" fill="currentColor"/></svg>
      </a>
      <a class="article-share-email" href="mailto:?subject=${encodedTitle}&body=${encodedEmail}" aria-label="使用 Email 分享" title="使用 Email 分享">
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.8" y="5.2" width="18.4" height="13.6" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m4 7 8 6 8-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </a>
      <button class="article-share-copy" type="button" data-share-url="${shareUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")}" aria-label="複製文章連結" title="複製文章連結">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 8V6a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-2M6 9h6a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3Z" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>
      </button>
      <span class="article-share-status" role="status" aria-live="polite"></span>`;
  }

  function bindRestoredShare(share) {
    const copyButton = share.querySelector(".article-share-copy");
    if (!copyButton || copyButton.dataset.copyBound === "true") return;
    copyButton.dataset.copyBound = "true";
    copyButton.addEventListener("click", async () => {
      const status = share.querySelector(".article-share-status");
      try {
        await navigator.clipboard.writeText(copyButton.dataset.shareUrl);
        if (status) status.textContent = "已複製連結";
      } catch {
        window.prompt("請複製文章連結", copyButton.dataset.shareUrl);
      }
    });
  }

  function restoreArticleShare() {
    document.querySelectorAll(".article-view, article.article").forEach((article) => {
      if (!article.querySelector(".article-body,.content")) return;
      if (article.querySelector(".article-share-restored")) return;
      let share = article.querySelector(".article-share");
      if (share?.dataset.originalSyntaxRestored === "true") return;

      const metrics = share?.querySelector(".article-metrics");
      const { shareUrl, shareTitle } = getRestoredShareDetails(article, share);
      if (!share) {
        share = document.createElement("div");
        share.className = "article-share";
        share.setAttribute("aria-label", "分享文章");
        const ending = article.querySelector(".article-ending");
        (ending || article).appendChild(share);
      }

      share.innerHTML = restoredShareMarkup(shareUrl, shareTitle);
      if (metrics) share.prepend(metrics);
      share.dataset.originalSyntaxRestored = "true";
      bindRestoredShare(share);
    });
  }

  function fixYuanshenArticleImages() {
    const params = new URLSearchParams(location.search);
    if (params.get("id") !== YUANSHEN_ARTICLE_ID) return;

    const version = `?v=${YUANSHEN_IMAGE_VERSION}`;
    const root = document.querySelector(ROOT_SELECTOR);
    if (!root) return;

    const cover = root.querySelector(".article-cover");
    if (cover) {
      const expected = `${YUANSHEN_IMAGE_BASE}book-cover.jpg${version}`;
      if (!cover.src.includes("book-cover.jpg") || !cover.src.includes(YUANSHEN_IMAGE_VERSION)) {
        cover.src = expected;
      }
      cover.alt = "我在人間的元神覺醒";
      cover.style.maxHeight = "none";
      cover.style.height = "auto";
      cover.style.objectFit = "contain";
      cover.style.objectPosition = "center";
    }

    const imageMap = [
      { match: /天庭巨石|stone-origin/i, file: "stone-origin.jpg", alt: "天庭巨石所化的元神" },
      { match: /大鵬鳥|roc-awakening/i, file: "roc-awakening.jpg", alt: "大鵬鳥元神" },
      { match: /九尾七彩神鳥|nine-tailed-bird/i, file: "nine-tailed-bird.jpg", alt: "九尾七彩神鳥元神" }
    ];

    const bodyImages = [...root.querySelectorAll(".article-body img")];
    bodyImages.forEach((img, index) => {
      const signature = `${img.alt || ""} ${img.getAttribute("src") || ""}`;
      const mapped = imageMap.find((item) => item.match.test(signature)) || imageMap[index];
      if (!mapped) return;
      const expected = `${YUANSHEN_IMAGE_BASE}${mapped.file}${version}`;
      if (!img.src.includes(mapped.file) || !img.src.includes(YUANSHEN_IMAGE_VERSION)) {
        img.src = expected;
      }
      img.alt = mapped.alt;
      img.loading = "eager";
      img.decoding = "async";
    });
  }

  function enhanceArticlePage() {
    enhanceDestinationLinks();
    restoreArticleShare();
    fixYuanshenArticleImages();
  }

  installStyles();
  enhanceArticlePage();

  const root = document.querySelector(ROOT_SELECTOR) || document.body;
  new MutationObserver(enhanceArticlePage).observe(root, {
    childList: true,
    subtree: true
  });
})();
