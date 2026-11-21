// 丙午年．無極老母至尊聖誕福壽康寧祝壽懺儀｜懺儀完整內容頁：畫面動態（不涉及閱讀權限）。
// 閱讀權限與全文載入由 chanyi-reader.js 處理；全文載入後會發出 document 事件「chanyi:content」，
// 本檔收到後只替新加入的區塊加上淡入效果，不監聽整頁 DOM。
(function(){
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var io = (!reduce && 'IntersectionObserver' in window) ? new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }) : null;

  function watch(root){
    (root || document).querySelectorAll('.reveal:not(.is-visible)').forEach(function(el){
      if (io) io.observe(el); else el.classList.add('is-visible');
    });
  }
  watch(document);
  document.addEventListener('chanyi:content', function(){ watch(document.getElementById('chanyi-full')); });

  // 圖片尚未提供時，移除空白的圖框（取代原稿中的 inline onerror）。
  document.addEventListener('error', function(ev){
    var t = ev.target;
    if (t && t.tagName === 'IMG') { var fig = t.closest('figure.photo'); if (fig) fig.remove(); }
  }, true);
  document.querySelectorAll('figure.photo img').forEach(function(img){
    if (img.complete && img.naturalWidth === 0) { var fig = img.closest('figure.photo'); if (fig) fig.remove(); }
  });

  var header = document.querySelector('.site-header');
  var bar = document.querySelector('.site-header .progress');
  var onScroll = function(){
    if (header) header.classList.toggle('is-scrolled', window.scrollY > 40);
    if (bar) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.setProperty('--progress', (max > 0 ? Math.min(100, window.scrollY / max * 100) : 0) + '%');
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // 頁內連結：未開通者看不到的區塊，改為捲到專屬閱讀說明。
  document.addEventListener('click', function(ev){
    var a = ev.target.closest && ev.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href').slice(1);
    if (!id) { ev.preventDefault(); return; }
    if (document.getElementById(id)) return;
    var lock = document.getElementById('chanyi-exclusive');
    if (lock) { ev.preventDefault(); lock.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); }
  });
})();
