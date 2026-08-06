(() => {
  const STYLE_ID = "article-destination-links-style-v1";
  const ROOT_SELECTOR = "#article-root";

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
        gap:12px;
        margin:34px 0 14px;
      }
      .article-destination-link{
        position:relative;
        display:grid;
        grid-template-columns:42px minmax(0,1fr) 18px;
        align-items:center;
        gap:12px;
        min-height:88px;
        padding:15px 16px;
        overflow:hidden;
        border:1px solid;
        text-decoration:none;
        transition:transform .28s cubic-bezier(.22,.61,.36,1),border-color .28s,background .28s,box-shadow .28s;
      }
      .article-destination-link:before{
        content:"";
        position:absolute;
        top:0;
        left:0;
        width:3px;
        height:100%;
        background:currentColor;
        opacity:.66;
      }
      .article-destination-link.is-books{
        border-color:rgba(89,79,71,.3);
        background:linear-gradient(135deg,rgba(165,130,84,.18),rgba(238,231,218,.74));
        color:#594F47;
      }
      .article-destination-link.is-aesthetics{
        border-color:rgba(96,99,48,.34);
        background:linear-gradient(135deg,rgba(96,99,48,.17),rgba(222,225,205,.82));
        color:#50532B;
      }
      .article-destination-link:hover,
      .article-destination-link:focus-visible{
        transform:translateY(-3px);
        outline:none;
        box-shadow:0 12px 24px rgba(48,42,35,.13);
      }
      .article-destination-link.is-books:hover,
      .article-destination-link.is-books:focus-visible{
        border-color:rgba(89,79,71,.52);
        background:linear-gradient(135deg,rgba(165,130,84,.27),rgba(238,231,218,.9));
      }
      .article-destination-link.is-aesthetics:hover,
      .article-destination-link.is-aesthetics:focus-visible{
        border-color:rgba(96,99,48,.58);
        background:linear-gradient(135deg,rgba(96,99,48,.26),rgba(222,225,205,.95));
      }
      .article-destination-icon{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        width:42px;
        height:42px;
        border:1px solid currentColor;
        background:rgba(255,255,255,.2);
        opacity:.82;
      }
      .article-destination-icon svg{width:23px;height:23px}
      .article-destination-copy{display:block;min-width:0}
      .article-destination-copy small,
      .article-destination-copy strong,
      .article-destination-copy em{display:block}
      .article-destination-copy small{
        margin-bottom:2px;
        font-family:var(--sans,'Noto Sans TC',sans-serif);
        font-size:10px;
        font-weight:500;
        line-height:1.4;
        letter-spacing:.16em;
        opacity:.72;
      }
      .article-destination-copy strong{
        font-family:var(--serif,'Noto Serif TC',serif);
        font-size:17px;
        font-weight:700;
        line-height:1.45;
        letter-spacing:.065em;
      }
      .article-destination-copy em{
        margin-top:3px;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
        font-family:var(--sans,'Noto Sans TC',sans-serif);
        font-size:10.5px;
        font-style:normal;
        line-height:1.45;
        letter-spacing:.025em;
        opacity:.7;
      }
      .article-destination-arrow{
        align-self:center;
        font-family:Georgia,serif;
        font-size:18px;
        line-height:1;
        opacity:.58;
        transition:transform .28s;
      }
      .article-destination-link:hover .article-destination-arrow,
      .article-destination-link:focus-visible .article-destination-arrow{transform:translateX(3px)}
      @media(max-width:620px){
        .article-destination-links{grid-template-columns:1fr;gap:10px;margin-top:28px}
        .article-destination-link{min-height:82px}
      }
      @media(max-width:420px){
        .article-destination-link{grid-template-columns:38px minmax(0,1fr) 16px;padding:13px 14px;gap:10px}
        .article-destination-icon{width:38px;height:38px}
        .article-destination-copy strong{font-size:16px}
        .article-destination-copy em{white-space:normal}
      }
      @media(prefers-reduced-motion:reduce){
        .article-destination-link,
        .article-destination-arrow{transition:none!important}
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

  installStyles();
  enhanceDestinationLinks();

  const root = document.querySelector(ROOT_SELECTOR) || document.body;
  new MutationObserver(enhanceDestinationLinks).observe(root, {
    childList: true,
    subtree: true
  });
})();
