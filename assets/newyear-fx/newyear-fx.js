/*! 靈元院 過年氛圍動畫疊層 newyear-fx v2.0（含 3D 質感層）
 *  獨立 CSS + JS；不修改頁面 HTML 結構與背景圖。頁面只需加 <link> 與 <script>（見 README.md）。
 *  全部以事件監聽 / MutationObserver 掛接既有 DOM；動畫只用 transform、opacity（少量一次性 filter）。
 *  尊重 prefers-reduced-motion（開啟時完全不啟動）、分頁隱藏時暫停、可用 ?fx=0 / localStorage / enabled:false 關閉。 */
(function () {
  'use strict';
  var root = document.documentElement;
  var USER = window.LYYUAN_FX || {};

  /* ───────────── 可調參數（預設值）。用 window.LYYUAN_FX = {...} 在本檔之前覆寫 ───────────── */
  var DEFAULTS = {
    enabled: true,                       // false＝完全關閉
    count: { desktop: 36, mobile: 12 },  // 背景金色光點數量（硬上限：桌機 60、手機 30＝含所有粒子，見 CAPS／room()）
    depth: { desktop: { far: 8, near: 4 }, mobile: { far: 2, near: 1 } }, // 暗色區（主視覺／頁尾／成功彈窗）遠、近兩層粒子數（每區）
    lift: 3,                             // 勾選亮起時卡片上浮高度（px）
    haloIntensity: 1,                    // 亮燈光暈強度（0–1.5）
    flicker: true,                       // 亮燈火光極輕微閃動（週期 4s）
    parallax: 6,                         // 背景祥雲／回紋視差最大位移（px，2–6 建議；0＝關閉）
    ctaSweep: true,                      // CTA 金屬按鈕每 6 秒一次掃光
    speed: 1,                            // 光點上升速度倍率（2＝快一倍、0.5＝慢一半）
    size: 1,                             // 光點大小倍率
    opacity: 1,                          // 光點整體透明度倍率（0–1）
    colors: { gold: '#C9A063', champagne: '#EAD8B4', warm: '#A58254', ink: '#0A100C', text: '#F5F0E8', muted: '#B6B6A5' },
    // 素材（SVG／PNG／WebP）。只寫檔名＝放在 assetBase 下；含「/」＝視為完整路徑；留空＝停用該素材。
    // 載入前會先探測：檔案不存在（404）時自動退回 CSS 繪製的備援圖形（或略過該裝飾），不會出現破圖。
    assetBase: '/assets/yuandeng/',
    assets: {
      titleHalo: 'yuandeng-title-halo.svg',       // 主視覺標題後方光暈，淡入一次
      embersMedium: 'yuandeng-embers-medium.svg', // 主視覺緩慢上升（手機只用這一張）
      embersLarge: 'yuandeng-embers-large.svg',   // 僅桌機：主視覺與成功畫面背景
      embersSmall: 'yuandeng-embers-small.svg',   // 區塊角落裝飾（靜態，僅桌機）
      flameMark: 'yuandeng-flame-mark.svg',       // 區塊標題前的小火焰圖示（靜態）
      cloudTile: 'yuandeng-cloud-tile.svg',        // 祥雲／回紋底紋（視差；缺檔：內建 SVG 回紋）
      cardHalo: 'yuandeng-card-halo.svg',          // 亮燈卡片光暈（缺檔：CSS 漸層）
      cardFlame: 'yuandeng-card-flame.svg',        // 亮燈卡片火光（缺檔：CSS 漸層）
      lanternUnlit: 'yuandeng-lantern-unlit.svg', // 每個燈別選項左側：未亮
      lanternLit: 'yuandeng-lantern-lit.svg',     // 每個燈別選項左側：已勾選＝亮
      successCircle: 'yuandeng-success-circle.svg' // 成功畫面圓環（伺服器回報成功後才出現）
    },
    effects: { ambient: true, title: true, lamp: true, amount: true, steps: true, success: true, dialog: true, cta: true, parallax: true, card3d: true },
    quietWhileTyping: true,              // 表單欄位取得焦點時，隱藏並暫停背景光點（填寫區不放持續動畫）
    successText: '圓滿回向',
    successMs: 2600,
    selectors: {
      title: ['.yd-banner-empty strong', '.banner-hero h1:not(.sr-only)', '#register .heading h2'],
      heroHost: ['#bannerSlot', '.banner-hero'],  // 主視覺容器（光暈與光點疊在其中）
      sectionPanel: '.panel',                     // 角落裝飾掛載的區塊
      lanternHost: '.yd-opt-head',                // 燈別選項列（燈籠插在勾選框右側）
      lampInput: 'input.fam-check, input.opt-check, input.lamp-check, input.sponsor-check',
      lampCard: '.yd-option, .lamp',
      amount: ['#total', '#mobileAmount'],
      steps: '.journey > span',
      form: '#form',
      result: '#result',
      resultEyebrow: '.eyebrow',
      terms: '#registrationTerms input[type=checkbox]',
      lampCardFx: '.lamp',                          // 亮燈時掛光暈／火光層的卡片
      cta: ['.banner-action .btn', '.yd-hero-links .btn', '#form button[type=submit]', '.summary button[type=submit]', '.mobiletotal .btn'],
      glintHosts: ['.sumtotal', '.mobiletotal'],   // 金額更新時閃一次高光的容器
      darkHosts: ['#bannerSlot', '#site-canonical-footer', '.footer'] // 深度粒子（遠近兩層）掛載處
    },
    successEyebrow: 'SIGNUP COMPLETE',   // 頁面在「伺服器回報成功」時才會把彈窗 eyebrow 設成這個文字
    steps: null                          // 可傳入三個函式 [()=>bool, ()=>bool, ()=>bool] 覆寫進度判斷
  };
  var CAPS = { desktop: 60, mobile: 30 };   // 不可超過（手機粒子 30 以內）
  var LS_KEY = 'lyyuan.fx';

  function merge(a, b) { var o = {}, k; for (k in a) o[k] = a[k]; for (k in (b || {})) { o[k] = (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) ? merge(a[k], b[k]) : b[k]; } return o; }
  var C = merge(DEFAULTS, USER);

  /* ───────────── 關閉開關 ───────────── */
  function killed() {
    if (C.enabled === false) return 'config';
    try {
      var q = new URLSearchParams(location.search).get('fx');
      if (q === 'on') { try { localStorage.removeItem(LS_KEY); } catch (e) {} }
      else if (q === 'off') { try { localStorage.setItem(LS_KEY, 'off'); } catch (e) {} return 'url-off'; }
      else if (q === '0') return 'url';
      if (localStorage.getItem(LS_KEY) === 'off') return 'storage';
    } catch (e) {}
    return '';
  }
  if (killed()) { window.LYYUAN_FX_API = { enabled: false, reason: killed(), start: function () {}, destroy: function () {}, celebrate: function () {} }; return; }

  var mqReduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var mqMobile = window.matchMedia ? window.matchMedia('(max-width: 740px), (pointer: coarse)') : { matches: false };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var layer = null, started = false, cleanups = [], observers = [], timers = [];
  function on(t, ev, fn, opt) { t.addEventListener(ev, fn, opt); cleanups.push(function () { t.removeEventListener(ev, fn, opt); }); }
  function later(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function isMobile() { return !!mqMobile.matches; }
  function room() { return Math.max(0, (isMobile() ? CAPS.mobile : CAPS.desktop) - document.querySelectorAll('.fx-p,.fx-dp,.fx-burst').length); }
  function clamp(v, a, b) { v = Number(v); if (!isFinite(v)) v = a; return Math.min(b, Math.max(a, v)); }
  function particleCount() {
    var m = isMobile(), n = Number(m ? C.count.mobile : C.count.desktop);
    if (!isFinite(n) || n < 0) n = 0;
    return Math.min(Math.floor(n), m ? CAPS.mobile : CAPS.desktop);
  }
  function restart(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
  function once(el, cls, ms) { restart(el, cls); later(function () { el.classList.remove(cls); }, ms || 1600); }

  /* ───────────── 顏色與素材 → CSS 變數 ───────────── */
  function applyVars() {
    var s = root.style, c = C.colors;
    s.setProperty('--fx-gold', c.gold); s.setProperty('--fx-champagne', c.champagne); s.setProperty('--fx-warm', c.warm);
    s.setProperty('--fx-ink', c.ink); s.setProperty('--fx-text', c.text); s.setProperty('--fx-muted', c.muted);
    s.setProperty('--fx-lift', clamp(C.lift, 0, 12) + 'px'); s.setProperty('--fx-halo', String(clamp(C.haloIntensity, 0, 1.5)));
    s.setProperty('--fx-opacity', String(Math.max(0, Math.min(1, Number(C.opacity) || 0))));
  }
  function clearVars() {
    var s = root.style;
    ['--fx-gold', '--fx-champagne', '--fx-warm', '--fx-ink', '--fx-text', '--fx-muted', '--fx-opacity', '--fx-lift', '--fx-halo', '--fx-px', '--fx-py'].forEach(function (k) { s.removeProperty(k); });
    Object.keys(C.assets || {}).forEach(function (k) { s.removeProperty('--fx-img-' + k); root.classList.remove('fx-a-' + k); });
    root.classList.remove('fx-lantern-img');
  }

  /* ───────────── 1. 進場：金色光點緩慢上升（背景層，z-index:-1，在所有面板與彈窗之下） ───────────── */
  function buildLayer() {
    if (layer) layer.remove();
    tileEl = null;
    layer = document.createElement('div');
    layer.className = 'fx-layer'; layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);
    if (!C.effects.ambient) return;
    var n = particleCount(), frag = document.createDocumentFragment();
    for (var i = 0; i < n; i++) {
      var p = document.createElement('i'), sz = rnd(3, 9) * (Number(C.size) || 1), dur = rnd(18, 36) / (Number(C.speed) || 1);
      p.className = 'fx-p fx-t' + (i % 3);
      p.style.cssText = 'left:' + rnd(2, 98).toFixed(1) + '%;width:' + sz.toFixed(1) + 'px;height:' + sz.toFixed(1) + 'px;--dx:' + rnd(-40, 40).toFixed(0) + 'px;--o:' + rnd(.35, .9).toFixed(2) + ';animation-duration:' + dur.toFixed(1) + 's;animation-delay:-' + rnd(0, dur).toFixed(1) + 's';
      frag.appendChild(p);
    }
    layer.appendChild(frag);
  }
  function setPaused(v) { root.classList.toggle('fx-paused', !!v); }


  /* ───────────── 素材探測：存在才使用，缺檔自動退回備援 ───────────── */
  var assetState = { loaded: [], missing: [] };
  function assetUrl(k) {
    var v = C.assets && C.assets[k];
    if (!v || typeof v !== 'string' || !/^[\w./%-]+\.(svg|png|webp)$/i.test(v)) return '';
    return v.indexOf('/') >= 0 ? v : String(C.assetBase || '') + v;
  }
  function has(k) { return assetState.loaded.indexOf(k) >= 0; }
  function probeAssets() {
    if (typeof Image === 'undefined') return;
    Object.keys(C.assets || {}).forEach(function (k) {
      var u = assetUrl(k); if (!u) return;
      var im = new Image();
      im.onload = function () {
        if (!started || has(k)) return; assetState.loaded.push(k);
        root.style.setProperty('--fx-img-' + k, 'url("' + u + '")'); root.classList.add('fx-a-' + k);
        if (has('lanternUnlit') && has('lanternLit')) root.classList.add('fx-lantern-img');
        buildDecor(); if (k === 'cloudTile' && tileEl) tileEl.style.backgroundImage = '';
      };
      im.onerror = function () { if (assetState.missing.indexOf(k) < 0) assetState.missing.push(k); };
      im.src = u;
    });
  }

  /* ───────────── 裝飾節點（aria-hidden、pointer-events:none；不改 HTML 結構，全由 JS 插入） ───────────── */
  function node(cls, host, first) {
    var n = document.createElement('i'); n.className = cls; n.setAttribute('aria-hidden', 'true'); n.setAttribute('data-fx-decor', '');
    if (first && host.firstChild) host.insertBefore(n, host.firstChild); else host.appendChild(n); return n;
  }
  function buildDecor() {
    $$('[data-fx-decor].fx-hero,[data-fx-decor].fx-corner').forEach(function (n) { n.remove(); });
    var mobile = isMobile(), host = null; [].concat(C.selectors.heroHost).some(function (q) { host = $(q); return !!host; });
    if (host) {
      host.classList.add('fx-hero-host');
      if (C.effects.title && !$('.fx-title-halo', host)) node('fx-title-halo fx-hero', host, true);  // 光暈：有圖用圖、無圖用 CSS 漸層
      if (C.effects.ambient) {
        if (has('embersLarge') && !mobile) { node('fx-hero fx-hero-embers fx-hero-large', host); }
        if (has('embersMedium')) { node('fx-hero fx-hero-embers fx-hero-medium', host); node('fx-hero fx-hero-embers fx-hero-medium b', host); }
      }
    }
    if (has('embersSmall') && !mobile && C.effects.ambient) $$(C.selectors.sectionPanel).forEach(function (p) { p.classList.add('fx-corner-host'); node('fx-corner', p); });
  }
  function buildLanterns() {
    if (!C.effects.lamp) return;
    $$(C.selectors.lanternHost).forEach(function (h) {
      if (h.querySelector('.fx-lantern-ico')) return;
      var ico = document.createElement('i'); ico.className = 'fx-lantern-ico'; ico.setAttribute('aria-hidden', 'true'); ico.setAttribute('data-fx-decor', '');
      var inp = h.querySelector('input'); if (inp && inp.nextSibling) h.insertBefore(ico, inp.nextSibling); else h.appendChild(ico);
    });
    syncLit();
  }
  function syncLit() {  // 程式性還原勾選（修改模式）時不會有 change 事件，於此靜默同步亮燈狀態
    $$(C.selectors.lampInput).forEach(function (i) { var c = i.closest(C.selectors.lampCard); if (c) c.classList.toggle('fx-lit', !!i.checked); });
  }

  /* ───────────── 3D 質感層：卡片光暈／火光、CTA 掃光、金額高光、深度粒子、視差 ───────────── */
  function buildCardFx() {
    if (!C.effects.lamp) return;
    $$(C.selectors.lampCardFx).forEach(function (c) {
      if (c.querySelector(':scope > .fx-card-halo')) return;
      c.classList.add('fx-card');
      node('fx-card-halo', c, true); node('fx-card-flame' + (C.flicker ? ' fx-flicker' : ''), c, true);
    });
  }
  function buildCta() {
    if (!C.effects.cta) return;
    var seen = [];
    C.selectors.cta.forEach(function (q) { $$(q).forEach(function (b) {
      if (seen.indexOf(b) >= 0) return; seen.push(b);
      b.classList.add('fx-cta'); if (C.ctaSweep && !b.querySelector(':scope > .fx-sweep')) node('fx-sweep', b);
    }); });
  }
  function buildGlints() {
    if (!C.effects.amount) return;
    C.selectors.glintHosts.forEach(function (q) { $$(q).forEach(function (h) { h.classList.add('fx-glint-host'); if (!h.querySelector(':scope > .fx-glint')) node('fx-glint', h); }); });
  }
  function depthPlan() { var d = (isMobile() ? C.depth.mobile : C.depth.desktop) || {}; return { far: clamp(d.far, 0, 30), near: clamp(d.near, 0, 30) }; }
  function fillDepth(host, rise) {
    var plan = depthPlan(), frag = document.createDocumentFragment(), kinds = [['far', plan.far], ['near', plan.near]];
    kinds.forEach(function (k) {
      for (var i = 0; i < k[1]; i++) {
        if (room() - frag.childNodes.length <= 0) break;
        var far = k[0] === 'far', p = document.createElement('i'), sz = far ? rnd(2, 4) : rnd(4, 8), dur = (far ? rnd(34, 52) : rnd(16, 26)) / (Number(C.speed) || 1);
        p.className = 'fx-dp ' + k[0] + ' fx-t' + (i % 3); p.setAttribute('aria-hidden', 'true');
        p.style.cssText = 'left:' + rnd(3, 97).toFixed(1) + '%;width:' + sz.toFixed(1) + 'px;height:' + sz.toFixed(1) + 'px;--rise:' + rise + 'px;--dx:' + rnd(-24, 24).toFixed(0) + 'px;--o:' + (far ? rnd(.25, .5) : rnd(.55, .95)).toFixed(2) + ';animation-duration:' + dur.toFixed(1) + 's;animation-delay:-' + rnd(0, dur).toFixed(1) + 's';
        frag.appendChild(p);
      }
    });
    host.appendChild(frag);
  }
  function buildDepth() {
    $$('.fx-dp[data-fx-host]').forEach(function (n) { n.remove(); });
    if (!C.effects.ambient) return;
    var used = [];
    C.selectors.darkHosts.forEach(function (q) {
      var h = $(q); if (!h || used.indexOf(h) >= 0) return; used.push(h);
      h.classList.add('fx-dark-host');
      var before = h.querySelectorAll('.fx-dp').length; if (before) return;
      var mark = document.createElement('i'); mark.className = 'fx-dp-mark'; h.appendChild(mark);   // 佔位，讓子粒子容易整批移除
      var tmp = document.createElement('div'); fillDepth(tmp, Math.max(120, Math.round(h.offsetHeight || 260)));
      Array.prototype.slice.call(tmp.children).forEach(function (n) { n.setAttribute('data-fx-host', ''); n.setAttribute('data-fx-decor', ''); h.appendChild(n); });
      mark.remove();
    });
  }
  var tileEl = null, tickPending = false;
  var MEANDER = "data:image/svg+xml;utf8," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='72' height='72' viewBox='0 0 72 72'><g fill='none' stroke='#A58254' stroke-width='1.2' stroke-linecap='square' opacity='.55'><path d='M6 66V6h60v48H30V30h18v12'/><path d='M0 36h6M66 36h6M36 0v6M36 66v6'/></g></svg>");
  function parallaxTick() {
    tickPending = false; if (!tileEl) return;
    var max = document.documentElement.scrollHeight - window.innerHeight, p = max > 0 ? Math.min(1, Math.max(0, (window.pageYOffset || 0) / max)) : 0, a = clamp(C.parallax, 0, 12);
    tileEl.style.transform = 'translate3d(' + (p * a * .5).toFixed(2) + 'px,' + (-p * a).toFixed(2) + 'px,0)';
  }
  function bindParallax() {
    if (!layer || !(Number(C.parallax) > 0) || !C.effects.parallax) return;
    tileEl = document.createElement('i'); tileEl.className = 'fx-tile'; layer.insertBefore(tileEl, layer.firstChild);
    tileEl.style.backgroundImage = has('cloudTile') ? '' : 'url("' + MEANDER + '")';
    var req = function () { if (tickPending) return; tickPending = true; (window.requestAnimationFrame || setTimeout)(parallaxTick); };
    on(window, 'scroll', req, { passive: true }); on(window, 'resize', req); parallaxTick();
  }

  /* ───────────── 2. 標題淡入＋微光暈（只播一次） ───────────── */
  function titleOnce() {
    if (!C.effects.title) return;
    var done = false;
    C.selectors.title.forEach(function (sel) {
      var el = $(sel); if (!el || el.__fxTitle) return; el.__fxTitle = true;
      var play = function () { el.classList.add('fx-title-once'); };
      if (!('IntersectionObserver' in window)) { play(); return; }
      var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { play(); io.disconnect(); } }); }, { threshold: .3 });
      io.observe(el); observers.push(io); done = true;
    });
    return done;
  }

  /* ───────────── 3. 勾選燈別：該燈亮起；金額更新帶輕微光感 ───────────── */
  function bindLamps() {
    if (!C.effects.lamp) return;
    on(document, 'change', function (e) {
      var t = e.target; if (!t || !t.matches || !t.matches(C.selectors.lampInput)) return;
      var card = t.closest(C.selectors.lampCard); if (!card) return;
      if (t.checked) { card.classList.add('fx-lit'); once(card, 'fx-lit-pulse', 1500); }
      else { card.classList.remove('fx-lit'); card.classList.remove('fx-lit-pulse'); }
    });
    on(document, 'click', function () { (window.requestAnimationFrame || setTimeout)(syncLit); }, true);
    var tot = $(C.selectors.amount[0]);
    if (tot) { var mo = new MutationObserver(syncLit); mo.observe(tot, { childList: true, characterData: true, subtree: true }); observers.push(mo); }
    later(syncLit, 800);
  }
  function bindAmount() {
    if (!C.effects.amount) return;
    C.selectors.amount.forEach(function (sel) {
      var el = $(sel); if (!el) return; var last = el.textContent;
      var mo = new MutationObserver(function () {
        if (el.textContent === last) return; last = el.textContent;
        var box = el.closest('.sumtotal, .mobiletotal') || el; once(box, 'fx-shine', 1100);
      });
      mo.observe(el, { childList: true, characterData: true, subtree: true }); observers.push(mo);
    });
  }

  /* ───────────── 4. 步驟 01/02/03 完成 → 進度點亮 ───────────── */
  function val(id) { var e = document.getElementById(id); return e ? String(e.value || '').trim() : ''; }
  function totalNumber() { var e = $(C.selectors.amount[0]); var n = e ? Number(String(e.textContent).replace(/[^\d]/g, '')) : 0; return isFinite(n) ? n : 0; }
  var RULES = [
    function () { return !!val('name') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val('email')) && !!val('phone'); },
    function () {
      var picked = $$('input.opt-check:checked, input.lamp-check:checked').length || $$('input.sponsor-check:checked').length;
      if (!picked) return false;
      var names = $$('[data-person-name]:not(:disabled), [data-sponsor-name]:not(:disabled)');
      return !names.length || names.every(function (i) { return String(i.value).trim(); });
    },
    function () {
      var terms = $$(C.selectors.terms);
      return RULES[1]() && totalNumber() > 0 && terms.length > 0 && terms.every(function (t) { return t.checked; });
    }
  ];
  function bindSteps() {
    if (!C.effects.steps) return;
    var steps = $$(C.selectors.steps); if (steps.length < 3) return;
    var rules = (Array.isArray(C.steps) && C.steps.length >= 3) ? C.steps : RULES, state = [false, false, false], first = true, queued = false;
    function evaluate() {
      queued = false;
      steps.slice(0, 3).forEach(function (el, i) {
        var ok = false; try { ok = !!rules[i](); } catch (e) {}
        if (ok === state[i]) return; state[i] = ok;
        el.classList.toggle('fx-step-done', ok);
        if (ok && !first) once(el, 'fx-step-pop', 1300);
      });
      first = false;
    }
    function schedule() { if (queued) return; queued = true; (window.requestAnimationFrame || setTimeout)(evaluate); }
    on(document, 'input', schedule, true); on(document, 'change', schedule, true); on(document, 'click', schedule, true);
    var tot = $(C.selectors.amount[0]); if (tot) { var mo = new MutationObserver(schedule); mo.observe(tot, { childList: true, characterData: true, subtree: true }); observers.push(mo); }
    document.addEventListener('lyyuan-config', schedule); cleanups.push(function () { document.removeEventListener('lyyuan-config', schedule); });
    evaluate(); later(evaluate, 800);  // 修改模式載入既有資料後，靜默補上已完成的步驟（不播動畫）
    later(function () { first = false; }, 900);
  }

  /* ───────────── 5. 送出成功：伺服器回報成功後，一盞燈點亮、放大淡出，「圓滿回向」 ───────────── */
  var celebrating = false;
  function celebrate() {
    if (!C.effects.success || celebrating) return;
    var dlg = $(C.selectors.result) || document.body;
    celebrating = true;
    var wrap = document.createElement('div'); wrap.className = 'fx-success'; wrap.setAttribute('aria-hidden', 'true');
    var mobile = isMobile(), bursts = Math.max(0, Math.min(room(), mobile ? 8 : 18));
    var html = (has('embersLarge') && !mobile ? '<span class="fx-bg-embers"></span>' : '') + '<span class="fx-circle"></span><span class="fx-halo"></span><span class="fx-lantern"><span class="fx-lamp-body"></span></span>';
    for (var i = 0; i < bursts; i++) { var a = (i / bursts) * 6.2832 + rnd(-.2, .2), d = rnd(90, 170); html += '<i class="fx-burst" style="--bx:' + (Math.cos(a) * d).toFixed(0) + 'px;--by:' + (Math.sin(a) * d).toFixed(0) + 'px;--bd:' + rnd(0, .25).toFixed(2) + 's"></i>'; }
    html += '<span class="fx-success-text"></span>';
    wrap.innerHTML = html; wrap.querySelector('.fx-success-text').textContent = String(C.successText);
    wrap.style.setProperty('--fx-ms', (Number(C.successMs) || 2600) + 'ms');
    dlg.classList.add('fx-celebrate'); dlg.appendChild(wrap);
    if (C.effects.ambient) fillDepth(wrap, Math.max(160, Math.round(dlg.offsetHeight || 320)));
    later(function () { wrap.remove(); dlg.classList.remove('fx-celebrate'); celebrating = false; }, (Number(C.successMs) || 2600) + 200);
  }
  function bindSuccess() {
    if (!C.effects.success) return;
    var dlg = $(C.selectors.result), was = false;
    function isSuccess() { var e = dlg && $(C.selectors.resultEyebrow, dlg); return !!(e && e.textContent.trim() === C.successEyebrow && dlg.open); }
    if (dlg) {
      var mo = new MutationObserver(function () { var now = isSuccess(); if (now && !was) celebrate(); was = now; });
      mo.observe(dlg, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['open'] }); observers.push(mo);
    }
    // 頁面若主動發出事件也可觸發：window.dispatchEvent(new CustomEvent('lyyuan:signup-success'))
    on(window, 'lyyuan:signup-success', celebrate);
  }

  /* ───────────── 6. 彈窗柔和淡入：純 CSS（html.fx-on dialog[open]） ───────────── */

  /* ───────────── 生命週期 ───────────── */
  function start() {
    if (started || mqReduce.matches) return; started = true;
    applyVars(); root.classList.add('fx-on');
    if (C.effects.dialog) root.classList.add('fx-dialog');
    if (C.effects.card3d) root.classList.add('fx-3d');
    buildLayer(); buildDecor(); buildLanterns(); buildCardFx(); buildCta(); buildGlints(); buildDepth(); bindParallax(); titleOnce(); bindLamps(); bindAmount(); bindSteps(); bindSuccess(); probeAssets();
    on(document, 'lyyuan-config', function () { later(function () { buildLanterns(); buildCardFx(); buildCta(); buildGlints(); buildDepth(); }, 50); });
    later(buildDepth, 600);
    on(document, 'visibilitychange', function () { setPaused(document.hidden); }); setPaused(document.hidden);
    if (C.quietWhileTyping) {
      var form = $(C.selectors.form);
      if (form) {
        on(form, 'focusin', function (e) { if (e.target.matches('input:not([type=checkbox]):not([type=radio]), select, textarea')) root.classList.add('fx-quiet'); });
        on(form, 'focusout', function () { later(function () { var a = document.activeElement; if (!a || !form.contains(a) || a.matches('[type=checkbox],[type=radio],button')) root.classList.remove('fx-quiet'); }, 120); });
      }
    }
    var mqHandler = function () { if (started && layer) { buildLayer(); buildDecor(); buildDepth(); bindParallax(); } };
    if (mqMobile.addEventListener) { mqMobile.addEventListener('change', mqHandler); cleanups.push(function () { mqMobile.removeEventListener('change', mqHandler); }); }
  }
  function destroy() {
    started = false;
    cleanups.splice(0).forEach(function (f) { try { f(); } catch (e) {} });
    observers.splice(0).forEach(function (o) { try { (o.disconnect || function () {})(); } catch (e) {} });
    timers.splice(0).forEach(clearTimeout);
    if (layer) { layer.remove(); layer = null; }
    $$('[data-fx-decor]').forEach(function (n) { n.remove(); });
    $$('.fx-dark-host,.fx-glint-host,.fx-cta,.fx-card').forEach(function (n) { n.classList.remove('fx-dark-host', 'fx-glint-host', 'fx-cta', 'fx-card'); });
    $$('.fx-hero-host,.fx-corner-host').forEach(function (n) { n.classList.remove('fx-hero-host', 'fx-corner-host'); });
    assetState.loaded = []; assetState.missing = [];
    $$('.fx-success').forEach(function (n) { n.remove(); });
    ['fx-on', 'fx-3d', 'fx-dialog', 'fx-paused', 'fx-quiet', 'fx-lantern-img'].forEach(function (c) { root.classList.remove(c); });
    $$('.fx-lit,.fx-lit-pulse,.fx-step-done,.fx-step-pop,.fx-shine,.fx-title-once,.fx-celebrate').forEach(function (n) { n.classList.remove('fx-lit', 'fx-lit-pulse', 'fx-step-done', 'fx-step-pop', 'fx-shine', 'fx-title-once', 'fx-celebrate'); n.__fxTitle = false; });
    clearVars(); celebrating = false;
  }
  function boot() {
    if (mqReduce.matches) return;
    // 頁面若先隱藏等待活動設定（data-ev="pending"），等顯示後才開始，避免一次性動畫在看不見時播完
    var gate = root.getAttribute('data-ev');
    if (!gate) { start(); return; }
    if (gate === 'unavailable') return;
    var mo = new MutationObserver(function () {
      var g = root.getAttribute('data-ev');
      if (!g) { mo.disconnect(); start(); } else if (g === 'unavailable') mo.disconnect();
    });
    mo.observe(root, { attributes: true, attributeFilter: ['data-ev'] }); observers.push(mo);
  }
  // 使用者之後開啟／關閉「減少動態效果」：即時生效
  var mqChange = function () { if (mqReduce.matches) destroy(); else boot(); };
  if (mqReduce.addEventListener) mqReduce.addEventListener('change', mqChange);

  window.LYYUAN_FX_API = { enabled: true, start: boot, destroy: destroy, celebrate: celebrate, config: C, assets: function () { return { loaded: assetState.loaded.slice(), missing: assetState.missing.slice() }; },
    off: function () { try { localStorage.setItem(LS_KEY, 'off'); } catch (e) {} destroy(); },
    on: function () { try { localStorage.removeItem(LS_KEY); } catch (e) {} boot(); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
