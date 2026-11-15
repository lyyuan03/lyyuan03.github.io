/* 圓燈報名頁・過年氛圍：極小輔助腳本
   1. 依贊助項目名稱替卡片標記圖示種類（供 festive.css 換圖示）
   2. 在報名區上方放一排裝飾用的燈串（純裝飾，aria-hidden），其上方放「道場實景」真實照片畫廊
   3. 成功彈窗關閉時移除成功樣式
   只觀察 #sponsorChoices 的直接子節點新增，且只寫入屬性，不會觸發自己；無計時器、無輪詢。 */
(function () {
  'use strict';
  var MAP = [['景觀', 'landscape'], ['園藝', 'landscape'], ['供具', 'ritual'], ['神像', 'ritual'], ['硬體', 'hardware'], ['設備', 'hardware']];
  function kindOf(text) {
    for (var i = 0; i < MAP.length; i++) if (text.indexOf(MAP[i][0]) > -1) return MAP[i][1];
    return 'flame';
  }
  function decorate(box) {
    var cards = box.querySelectorAll('.sponsor-card');
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].getAttribute('data-yd-icon')) continue;
      var t = cards[i].querySelector('.lamp-name strong');
      cards[i].setAttribute('data-yd-icon', kindOf(t ? t.textContent : ''));
    }
  }
  function garland() {
    var reg = document.getElementById('register');
    if (!reg || !reg.parentNode || document.querySelector('.yd-garland')) return;
    var g = document.createElement('div');
    g.className = 'yd-garland'; g.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < 7; i++) g.appendChild(document.createElement('i'));
    reg.parentNode.insertBefore(g, reg);
  }
  var PHOTOS = [
    ['banner', 'photos/g-banner.webp', 800, 1067, '道場牆面掛著三幅紅色布條，分別寫著「春」「滿」「福」，下方有木製矮櫃', '春滿福', '歲末迎新，紅布條高掛。'],
    ['lamps', 'photos/g-lamps.webp', 1200, 773, '成排點亮的供燈，橘紅色燈盞中各有一點火光', '一盞一盞，都是心願', '成排點亮的供燈，一點火光，一份心意。'],
    ['candle', 'photos/g-candle.webp', 1000, 804, '一盞點亮的燭燈，旁邊是一朵桃紅色的菊花，後方是供燈架', '一盞燈，一份誠心', '燭光與鮮花，安靜陪著每一份心願。'],
    ['apples', 'photos/g-apples.webp', 1024, 655, '供桌上的紅蘋果，貼著寫有「進寶招財」的紅色貼紙', '進寶招財', '供桌上的蘋果，貼著紅色吉祥貼紙。']
  ];
  function gallery(before) {
    if (!before || !before.parentNode || document.querySelector('.yd-gallery')) return;
    var sec = document.createElement('section');
    sec.className = 'yd-gallery'; sec.setAttribute('aria-label', '道場實景');
    var html = '<div class="yd-gallery__head"><h2>歲末迎新・道場一隅</h2><p>以下皆為道場實際拍攝的畫面</p></div><div class="yd-gallery__grid">';
    for (var i = 0; i < PHOTOS.length; i++) {
      var p = PHOTOS[i];
      html += '<figure class="yd-ph yd-ph--' + p[0] + '"><img src="' + p[1] + '" width="' + p[2] + '" height="' + p[3] + '" alt="' + p[4] + '" loading="lazy" decoding="async"><figcaption><strong>' + p[5] + '</strong><span>' + p[6] + '</span></figcaption></figure>';
    }
    sec.innerHTML = html + '</div>';
    before.parentNode.insertBefore(sec, before);
  }
  function init() {
    garland();
    gallery(document.querySelector('.yd-garland') || document.getElementById('register'));
    var box = document.getElementById('sponsorChoices');
    if (box) {
      decorate(box);
      if ('MutationObserver' in window) new MutationObserver(function () { decorate(box); }).observe(box, { childList: true });
    }
    var res = document.getElementById('result');
    if (res) res.addEventListener('close', function () { res.classList.remove('yd-ok'); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
