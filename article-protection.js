const isArticlePage = /(^|\/)articles\.html$/i.test(location.pathname);

if (isArticlePage) {
  const style = document.createElement("style");
  style.id = "lyyuan-article-protection-style";
  style.textContent = `
    body.article-protected,
    body.article-protected .article-view,
    body.article-protected .article-body,
    body.article-protected .article-card,
    body.article-protected .article-meta,
    body.article-protected h1,
    body.article-protected h2,
    body.article-protected h3,
    body.article-protected p {
      -webkit-user-select: none !important;
      user-select: none !important;
      -webkit-touch-callout: none !important;
    }
    body.article-protected img {
      -webkit-user-drag: none !important;
      user-drag: none !important;
      pointer-events: none;
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
      body.article-protected * { display: none !important; }
      body.article-protected::before {
        content: "靈元院文選內容受著作權保護，本站不提供列印。";
        display: block !important;
        margin: 48px;
        color: #111;
        font: 18px/1.8 sans-serif;
      }
    }
  `;
  document.head.appendChild(style);

  const activate = () => document.body?.classList.add("article-protected");
  if (document.body) activate();
  else document.addEventListener("DOMContentLoaded", activate, { once: true });

  let toastTimer = 0;
  function showProtectedMessage(message = "本頁文章內容受著作權保護，請勿複製、下載或列印。") {
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

  function isEditableTarget(target) {
    return target instanceof Element && Boolean(target.closest("input, textarea, [contenteditable='true']"));
  }

  function blockEvent(event, message) {
    if (isEditableTarget(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    showProtectedMessage(message);
  }

  document.addEventListener("contextmenu", (event) => {
    blockEvent(event, "本頁已停用右鍵選單。文章內容請勿複製或下載。");
  }, true);

  document.addEventListener("copy", (event) => {
    if (isEditableTarget(event.target)) return;
    event.preventDefault();
    event.clipboardData?.setData("text/plain", "本文為靈元院文選內容，未經許可請勿複製或轉載。\nhttps://lyyuan.tw/articles.html");
    showProtectedMessage("文章內容不提供複製。您仍可使用文章下方的分享按鈕分享連結。");
  }, true);

  document.addEventListener("cut", (event) => blockEvent(event, "文章內容不提供剪下或複製。"), true);
  document.addEventListener("selectstart", (event) => blockEvent(event, "文章內容不提供反白選取。"), true);
  document.addEventListener("dragstart", (event) => blockEvent(event, "文章與圖片不提供拖曳下載。"), true);

  document.addEventListener("keydown", (event) => {
    if (isEditableTarget(event.target)) return;
    const key = event.key.toLowerCase();
    const modifier = event.ctrlKey || event.metaKey;
    const blockedModifierKeys = new Set(["a", "c", "x", "s", "p", "u"]);
    const blockedDeveloperShortcut = modifier && event.shiftKey && new Set(["i", "j", "c"]).has(key);
    const blocked = (modifier && blockedModifierKeys.has(key)) || blockedDeveloperShortcut || event.key === "F12";
    if (!blocked) return;
    event.preventDefault();
    event.stopPropagation();
    showProtectedMessage(key === "p" ? "本頁文章不提供列印。" : "本頁文章內容受保護，已停用此操作。");
  }, true);

  window.addEventListener("beforeprint", () => showProtectedMessage("本頁文章不提供列印。"));

  const protectImages = (root = document) => {
    root.querySelectorAll?.("img").forEach((image) => {
      image.draggable = false;
      image.setAttribute("oncontextmenu", "return false");
    });
  };

  document.addEventListener("DOMContentLoaded", () => protectImages(), { once: true });
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof Element) protectImages(node);
      });
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}
