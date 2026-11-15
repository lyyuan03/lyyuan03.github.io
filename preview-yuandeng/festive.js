/* 圓燈報名頁・過年氛圍：極小輔助腳本
   1. 依贊助項目名稱替卡片標記圖示種類（供 festive.css 換圖示）
   2. 成功彈窗關閉時移除成功樣式
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
  function init() {
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
