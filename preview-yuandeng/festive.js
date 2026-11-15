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
  /* 照片分散在報名流程各處，各自配合所在區塊的文案 */
  function fig(cls, src, w, h, alt, title, text) {
    return '<figure class="yd-ph ' + cls + '"><img src="' + src + '" width="' + w + '" height="' + h + '" alt="' + alt + '" loading="lazy" decoding="async"><figcaption><strong>' + title + '</strong><span>' + text + '</span></figcaption></figure>';
  }
  function put(el, where, html, tag) {
    if (!el || !el.parentNode) return;
    var n = document.createElement(tag || 'div'); n.innerHTML = html;
    var node = n.firstChild;
    if (where === 'before') el.parentNode.insertBefore(node, el);
    else el.parentNode.insertBefore(node, el.nextSibling);
  }
  function photos() {
    if (document.querySelector('.yd-ph')) return;
    var h2 = document.querySelector('h2[data-cfg="page.formTitle"]');
    var head = h2 && h2.closest('.heading');
    /* A. 報名表開頭：春滿福（直幅，維持原比例，旁邊配文字） */
    put(head || document.querySelector('section.panel.reveal'), 'before',
      '<section class="yd-feature reveal" aria-label="歲末迎新">' +
      fig('yd-ph--tall', 'photos/g-banner.webp', 800, 1067, '道場牆面掛著三幅紅色布條，分別寫著「春」「滿」「福」，下方有木製矮櫃', '春滿福', '道場牆上新掛的紅布條。') +
      '<div class="yd-feature__txt"><h2>歲末迎新</h2><p>辭舊迎新之際，道場牆上掛起紅色布條，春、滿、福三字依序排開。</p><p>一年將盡，邀請您以一盞燈回向過去一年的平安，也為新的一年留下一份心願。</p></div></section>', 'div');
    /* B. 選擇燈別：燭光與菊花（16:9） */
    var lan = document.querySelector('#lanterns .sectionline');
    put(lan, 'after', fig('yd-ph--band yd-ph--candle', 'photos/g-candle.webp', 1000, 804, '一盞點亮的燭燈，旁邊是一朵桃紅色的菊花，後方是供燈架', '一盞燈，一份誠心', '燭光與鮮花，安靜陪著每一份心願。'));
    /* C. 建院隨喜功德：進寶招財（16:9） */
    var don = document.querySelector('#donationSection > h3');
    put(don, 'after', fig('yd-ph--band', 'photos/g-apples.webp', 1024, 655, '供桌上的紅蘋果，貼著寫有「進寶招財」的紅色貼紙', '進寶招財', '供桌上的蘋果，貼著紅色吉祥貼紙。'));
    /* D. 明細之前：成排供燈（寬幅 21:9，作為收尾） */
    put(document.getElementById('review'), 'before', fig('yd-ph--wide', 'photos/g-lamps.webp', 1200, 773, '成排點亮的供燈，橘紅色燈盞中各有一點火光', '一點火光，一份心意', '確認登記明細並送出後，即完成報名。'));
  }
  function init() {
    garland();
    photos();
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
