const isArticlePage = /(^|\/)articles\.html$/i.test(location.pathname);

if (isArticlePage) {
  const style = document.createElement("style");
  style.id = "lyyuan-article-protection-style";
  style.textContent = `
    body.member-article-protected .article-view,
    body.member-article-protected .article-body,
    body.member-article-protected .article-meta,
    body.member-article-protected .article-view h1,
    body.member-article-protected .article-view h2,
    body.member-article-protected .article-view h3,
    body.member-article-protected .article-view p {
      -webkit-user-select: none !important;
      user-select: none !important;
      -webkit-touch-callout: none !important;
    }
    body.member-article-protected .article-view img {
      -webkit-user-drag: none !important;
      user-drag: none !important;
      pointer-events: none;
    }
    .member-watermark-layer {
      position: absolute;
      inset: 0;
      z-index: 8;
      overflow: hidden;
      pointer-events: none;
      opacity: .14;
      contain: layout paint;
    }
    .member-watermark-track {
      position: absolute;
      inset: -18% -24%;
      display: grid;
      grid-template-columns: repeat(3, minmax(220px, 1fr));
      align-content: space-around;
      gap: 92px 56px;
      transform: rotate(-18deg);
      animation: member-watermark-drift 18s ease-in-out infinite alternate;
    }
    .member-watermark-item {
      color: rgba(203,170,119,.92);
      font: 500 13px/1.7 'Noto Sans TC', sans-serif;
      letter-spacing: .16em;
      text-align: center;
      white-space: nowrap;
      text-shadow: 0 1px 1px rgba(0,0,0,.34);
    }
    @keyframes member-watermark-drift {
      0% { transform: translate3d(-2.5%, -1.5%, 0) rotate(-18deg); }
      50% { transform: translate3d(2%, 1.8%, 0) rotate(-16deg); }
      100% { transform: translate3d(-1%, 3%, 0) rotate(-19deg); }
    }
    @media (prefers-reduced-motion: reduce) {
      .member-watermark-track { animation-duration: 42s; }
    }
    @media (max-width: 600px) {
      .member-watermark-track {
        grid-template-columns: repeat(2, minmax(180px, 1fr));
        gap: 74px 24px;
      }
      .member-watermark-item { font-size: 11px; }
    }
    #article-protection-toast {
      position: fixed;
      left: 50%;
      bottom: 28px;
      z-index: 2147483647;
      transform: translate(-50%, 14px);
      max-width: calc(100vw - 36px);
      padding: 10px 18px;
      border: 1px solid rgba(165,130,84,.45);
      background: rgba(7,17,6,.96);
      color: rgba(245,240,232,.9);
      box-shadow: 0 10px 28px rgba(0,0,0,.32);
      font: 13px/1.55 'Noto Sans TC', sans-serif;
      letter-spacing: .06em;
      opacity: 0;
      pointer-events: none;
      transition: opacity .18s ease, transform .18s ease;
    }
    #article-protection-toast.is-visible {
      opacity: 1;
      transform: translate(-50%, 0);
    }
    @media print {
      body.member-article-protected * { display: none !important; }
      body.member-article-protected::before {
        content: "靈元院會員專屬內容受著作權保護，本站不提供列印。";
        display: block !important;
        margin: 48px;
        color: #111;
        font: 18px/1.8 sans-serif;
      }
    }
  `;
  document.head.appendChild(style);

  let toastTimer = 0;
  function showProtectedMessage(message = "本文為會員專屬內容，請勿複製、下載或轉載。") {
    let toast = document.getElementById("article-protection-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "article-protection-toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 1800);
  }

  function protectedArticle() {
    return document.body?.classList.contains("member-article-protected")
      ? document.querySelector(".article-view")
      : null;
  }

  function isInsideProtectedArticle(target) {
    const article = protectedArticle();
    return article && target instanceof Node && article.contains(target);
  }

  function isEditableTarget(target) {
    return target instanceof Element && Boolean(target.closest("input, textarea, [contenteditable='true']"));
  }

  function blockEvent(event, message) {
    if (!isInsideProtectedArticle(event.target) || isEditableTarget(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    showProtectedMessage(message);
  }

  function watermarkLabel() {
    const stamp = new Intl.DateTimeFormat("zh-TW", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(new Date());
    return `靈元院會員專屬 · ${stamp}`;
  }

  function addWatermark(article) {
    if (!article || article.querySelector(":scope > .member-watermark-layer")) return;
    const computedPosition = getComputedStyle(article).position;
    if (computedPosition === "static") article.style.position = "relative";
    const layer = document.createElement("div");
    layer.className = "member-watermark-layer";
    layer.setAttribute("aria-hidden", "true");
    const track = document.createElement("div");
    track.className = "member-watermark-track";
    const label = watermarkLabel();
    for (let index = 0; index < 24; index += 1) {
      const item = document.createElement("span");
      item.className = "member-watermark-item";
      item.textContent = label;
      track.appendChild(item);
    }
    layer.appendChild(track);
    article.prepend(layer);
  }

  function protectImages(article) {
    article?.querySelectorAll("img").forEach((image) => {
      image.draggable = false;
      image.setAttribute("oncontextmenu", "return false");
    });
  }

  function syncProtection() {
    const article = document.querySelector(".article-view");
    const isMemberExclusive = Boolean(article?.querySelector(".paid-lock-zone"));
    document.body?.classList.toggle("member-article-protected", isMemberExclusive);
    if (!isMemberExclusive) {
      article?.querySelector(":scope > .member-watermark-layer")?.remove();
      return;
    }
    addWatermark(article);
    protectImages(article);
  }

  document.addEventListener("contextmenu", (event) => {
    blockEvent(event, "本文已停用右鍵選單。會員專屬內容請勿複製或下載。");
  }, true);

  document.addEventListener("copy", (event) => {
    if (!isInsideProtectedArticle(event.target) || isEditableTarget(event.target)) return;
    event.preventDefault();
    event.clipboardData?.setData("text/plain", "本文為靈元院會員專屬內容，未經許可請勿複製或轉載。\nhttps://lyyuan.tw/articles.html");
    showProtectedMessage("會員專屬文章不提供複製。您仍可使用文章下方的分享按鈕分享連結。");
  }, true);

  document.addEventListener("cut", (event) => blockEvent(event, "會員專屬文章不提供剪下或複製。"), true);
  document.addEventListener("selectstart", (event) => blockEvent(event, "會員專屬文章不提供反白選取。"), true);
  document.addEventListener("dragstart", (event) => blockEvent(event, "會員專屬文章與圖片不提供拖曳下載。"), true);

  document.addEventListener("keydown", (event) => {
    if (!protectedArticle() || isEditableTarget(event.target)) return;
    const key = event.key.toLowerCase();
    const modifier = event.ctrlKey || event.metaKey;
    const blockedModifierKeys = new Set(["a", "c", "x", "s", "p", "u"]);
    const blockedDeveloperShortcut = modifier && event.shiftKey && new Set(["i", "j", "c"]).has(key);
    const blocked = (modifier && blockedModifierKeys.has(key)) || blockedDeveloperShortcut || event.key === "F12";
    if (!blocked) return;
    event.preventDefault();
    event.stopPropagation();
    showProtectedMessage(key === "p" ? "會員專屬文章不提供列印。" : "會員專屬內容受保護，已停用此操作。");
  }, true);

  window.addEventListener("beforeprint", () => {
    if (protectedArticle()) showProtectedMessage("會員專屬文章不提供列印。");
  });

  const observer = new MutationObserver(syncProtection);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", syncProtection, { once: true });
  } else {
    syncProtection();
  }
}
