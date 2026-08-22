const NAV_MARKUP = `
<ul class="nav-links">
  <li><a href="/">首頁</a></li>
  <li><span class="has-dropdown">活動</span><ul class="dropdown"><li><a href="/niandian.html">年度點燈</a></li><li><a href="/dizhi.html">奠基法會</a></li><li><a href="/lixing.html">例行法儀</a></li><li><a href="/fahui.html">報名法儀</a></li></ul></li>
  <li><a class="has-dropdown" href="/articles.html">文選</a><ul class="dropdown"><li><a href="/articles.html">全部</a></li><li><a href="/articles.html?category=spiritual">靈．修行</a></li><li><a href="/articles.html?category=worldly">人．俗世</a></li><li><a href="/articles.html?category=spirit-world">異．靈界</a></li><li><a href="/articles.html?category=reading">思．讀物</a></li></ul></li>
  <li><a href="/membership.html">會員</a></li>
  <li><span class="has-dropdown">選物</span><ul class="dropdown"><li><a href="/books.html">宇色靈修著作</a></li><li><a href="/spiritual-aesthetics.html">靈性美學館</a></li></ul></li>
  <li><span class="has-dropdown">影像</span><ul class="dropdown"><li class="nav-group-label"><span>靈元院官方</span></li><li><a href="https://www.youtube.com/@lyyuan03" target="_blank" rel="noopener">YT ｜ 靈元院</a></li><li class="nav-group-label"><span>宇色老師</span></li><li><a href="https://www.youtube.com/KINKIOSEL" target="_blank" rel="noopener">YT ｜ 宇色心養生</a></li></ul></li>
  <li><span class="has-dropdown">社群</span><ul class="dropdown"><li><a href="https://www.facebook.com/share/18zfvhPkBF/?mibextid=wwXIfr" target="_blank" rel="noopener">FB ｜ 靈元院</a></li><li><a href="https://www.instagram.com/lyyuan03/" target="_blank" rel="noopener">IG ｜ 靈元院</a></li></ul></li>
</ul>`;

const FOOTER_MARKUP = `
<footer class="articles-site-footer"><div class="articles-footer-container"><div class="footer-inner"><img class="footer-brand-mark" src="/assets/footer-logo-gold.svg?v=20260721-1" alt="靈元院"><div class="footer-links"><a href="https://www.facebook.com/share/18zfvhPkBF/?mibextid=wwXIfr" target="_blank" rel="noopener" aria-label="Facebook"><svg width="28" height="28" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="14" r="12.5" stroke="currentColor" stroke-width="1.2"/><path d="M15.5 9h-1.8c-.6 0-1 .4-1 1v1.5H11v2h1.7V19h2.2v-5.5h1.6l.3-2h-1.9V10.2c0-.3.1-.4.5-.4H16.5V9z" fill="currentColor"/></svg></a><a href="https://www.instagram.com/lyyuan03/" target="_blank" rel="noopener" aria-label="Instagram"><svg width="28" height="28" viewBox="0 0 28 28" fill="none"><rect x="7" y="7" width="14" height="14" rx="4" stroke="currentColor" stroke-width="1.2"/><circle cx="14" cy="14" r="3.5" stroke="currentColor" stroke-width="1.2"/><circle cx="18.2" cy="9.8" r="0.9" fill="currentColor"/></svg></a><a href="https://www.youtube.com/@lyyuan03" target="_blank" rel="noopener" aria-label="YouTube"><svg width="28" height="28" viewBox="0 0 28 28" fill="none"><rect x="4.5" y="8" width="19" height="12" rx="3.5" stroke="currentColor" stroke-width="1.2"/><path d="M12 11.5l5 2.5-5 2.5V11.5z" fill="currentColor"/></svg></a><a href="https://t.me/lyyuan_channel" target="_blank" rel="noopener" aria-label="Telegram"><svg width="28" height="28" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="14" r="12.5" stroke="currentColor" stroke-width="1.2"/><path d="M8 14l3 2.5 2-4 5-4-4 8-1.5-2L8 14z" stroke="currentColor" stroke-width="1" stroke-linejoin="round" fill="none"/><path d="M11 16.5l6.5-6.5" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg></a><a href="mailto:lyyuan03@gmail.com" aria-label="Email"><svg width="28" height="28" viewBox="0 0 28 28" fill="none"><rect x="5" y="8.5" width="18" height="12" rx="1.5" stroke="currentColor" stroke-width="1.2"/><path d="M5.5 9.5l8 6.5 8-6.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path d="M14 7.5 C14 5.5 17 5.5 17 7.5" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg></a></div><p class="footer-copy">© 2026 靈元院 Ling Yuan Yuan &nbsp;·&nbsp; 修心在己</p></div></div></footer>`;

function installStyle() {
  if (document.getElementById("articles-standard-chrome-style")) return;
  const style = document.createElement("style");
  style.id = "articles-standard-chrome-style";
  style.textContent = `
    html body.site-auth-enabled{padding-top:0!important}
    .site-header{position:fixed!important;top:0!important;left:0!important;right:0!important;z-index:1200!important;background:rgba(18,23,15,.96)!important;border-bottom:1px solid rgba(165,130,84,.18)!important;backdrop-filter:blur(18px)!important}
    .site-header .site-nav{display:flex!important;justify-content:center!important;align-items:center!important;max-width:none!important;min-height:56px!important;height:56px!important;padding:0 30px!important;gap:0!important}
    .site-header .nav-links{display:flex;align-items:center;gap:30px;margin:0;padding:0;list-style:none}
    .site-header .nav-links>li{position:relative}
    .site-header .nav-links>li>a,.site-header .nav-links>li>span{display:flex;align-items:center;gap:4px;color:rgba(245,240,232,.78);font-size:13.5px;letter-spacing:.14em;white-space:nowrap;cursor:pointer;text-decoration:none}
    .site-header .nav-links>li>a:hover,.site-header .nav-links>li>span:hover{color:#C5A26F}
    .site-header .has-dropdown:after{content:'▾';font-size:9px;opacity:.55}
    .site-header .dropdown{display:none;position:absolute;top:calc(100% + 14px);left:50%;transform:translateX(-50%);min-width:190px;margin:0;padding:6px 0;background:rgba(14,20,12,.98);border:1px solid rgba(165,130,84,.22);box-shadow:0 14px 34px rgba(0,0,0,.38);list-style:none;white-space:nowrap;z-index:1305}
    .site-header .dropdown:before{content:'';position:absolute;top:-14px;left:0;right:0;height:14px}
    .site-header .dropdown li a,.site-header .dropdown li span{display:block;padding:10px 20px;color:rgba(245,240,232,.72);font-size:13px;letter-spacing:.08em;text-decoration:none}
    .site-header .dropdown li a:hover{background:rgba(165,130,84,.12);color:#C5A26F}
    .site-header .nav-links>li:hover>.dropdown,.site-header .nav-links>li.open>.dropdown,.site-header .nav-links>li.dropdown-open>.dropdown{display:block}
    .site-header .nav-group-label{pointer-events:none;border-top:1px solid rgba(165,130,84,.15)}
    .site-header .nav-group-label:first-child{border-top:0}
    .site-header .nav-group-label span{color:rgba(165,130,84,.78)!important;font-size:10px!important;letter-spacing:.16em!important}
    body.site-auth-enabled .site-header{top:0!important}
    .hero{padding-top:120px!important}
    .articles-site-footer{padding:38px 0 30px;text-align:center;background:#10150D;border-top:1px solid rgba(165,130,84,.18)}
    .articles-footer-container{width:min(1100px,calc(100% - 40px));margin:0 auto}
    .articles-site-footer .footer-inner{display:flex;flex-direction:column;align-items:center;gap:14px}
    .articles-site-footer .footer-brand-mark{display:block;width:118px;height:auto;margin:0 auto 2px;opacity:.66;filter:saturate(.72) brightness(.86)}
    .articles-site-footer .footer-links{display:flex;align-items:center;justify-content:center;gap:28px;flex-wrap:wrap}
    .articles-site-footer .footer-links a{display:flex;color:rgba(245,240,232,.4);transition:color .2s,transform .2s}
    .articles-site-footer .footer-links a:hover{color:#C5A26F;transform:translateY(-2px)}
    .articles-site-footer .footer-links svg{display:block}
    .articles-site-footer .footer-copy{margin:0;color:rgba(245,240,232,.28);font-size:11px;letter-spacing:.12em}
    @media(min-width:769px){
      html body #site-auth-bar{position:fixed!important;top:0!important;left:auto!important;right:0!important;width:auto!important;min-width:132px!important;height:56px!important;padding:0 24px!important;background:transparent!important;border:0!important;box-shadow:none!important;backdrop-filter:none!important;z-index:1201!important}
      html body #site-auth-bar .site-auth-actions{pointer-events:auto!important}
      .site-header .site-nav{padding-left:132px!important;padding-right:132px!important}
    }
    @media(max-width:768px){
      .site-header .site-nav{justify-content:flex-start!important;height:56px!important;padding:0 12px!important;overflow-x:auto!important;overflow-y:visible!important}
      .site-header .nav-links{width:max-content;gap:16px}
      .site-header .nav-links>li>a,.site-header .nav-links>li>span{font-size:12px}
      html body #site-auth-bar{top:56px!important}
      .hero{padding-top:138px!important}
      .articles-footer-container{width:min(100% - 28px,1100px)}
    }
  `;
  document.head.appendChild(style);
}

function installChrome() {
  installStyle();
  const header = document.querySelector(".site-header");
  const nav = header?.querySelector(".site-nav");
  if (nav) nav.innerHTML = NAV_MARKUP;
  if (!document.querySelector(".articles-site-footer")) document.body.insertAdjacentHTML("beforeend", FOOTER_MARKUP);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", installChrome, { once: true });
} else {
  installChrome();
}
