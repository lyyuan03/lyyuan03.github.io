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
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", installChrome, { once: true });
} else {
  installChrome();
}
