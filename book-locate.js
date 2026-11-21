(() => {
  "use strict";
  // 影音專頁的「延伸閱讀」以 /books.html#book-xxx 連入：捲到對應書封並加上標示。
  // 只在網址帶有 #book-… 時才執行，其他情況完全不動作。
  let hash = "";
  try { hash = decodeURIComponent(location.hash.slice(1)); } catch (error) { return; }
  if (!/^book-[a-z0-9-]+$/.test(hash)) return;

  const style = document.createElement("style");
  style.id = "book-target-style";
  style.textContent = ".book-target{outline:2px solid #c5a26f;outline-offset:8px;box-shadow:0 0 0 12px rgba(197,162,111,.16),0 16px 36px rgba(60,40,15,.28)}.covers a.book-target{outline:0;box-shadow:none}.covers a.book-target img{outline:2px solid #c5a26f;outline-offset:8px;box-shadow:0 0 0 12px rgba(197,162,111,.16),0 16px 36px rgba(60,40,15,.28)}";
  document.head.appendChild(style);

  let userMoved = false;
  ["wheel", "touchstart", "keydown", "mousedown"].forEach((type) => {
    window.addEventListener(type, () => { userMoved = true; }, { once: true, passive: true });
  });

  let target = null;
  const center = (element) => element.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
  const align = () => { if (target && !userMoved) center(target); };

  // 書籍列表由 books.html 在載入時產生，新書展示區則由其他腳本稍後建立，所以最多等 10 秒（40 次 × 250 毫秒）就停止。
  let attempts = 0;
  const find = () => {
    const element = document.getElementById(hash);
    if (element) {
      target = element;
      element.classList.add("book-target");
      center(element);
      // 影片橫幅與書封圖載入後版面高度會改變：頁面載入完成與 1.5 秒後各校正一次（讀者開始捲動後不再校正）。
      if (document.readyState !== "complete") window.addEventListener("load", align, { once: true });
      setTimeout(align, 1500);
      return;
    }
    attempts += 1;
    if (attempts < 40) setTimeout(find, 250);
  };
  find();
})();
