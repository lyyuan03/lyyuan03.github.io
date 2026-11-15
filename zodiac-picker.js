/* 十二生肖選擇區：共用觸控按下回饋。
   獨立於 zodiac-motion.js（後者只在含 .zp-main 的頁面運作），
   讓總覽頁與十二個生肖文章頁都能取得一致的手機點擊回饋。
   不讀寫 Firebase、不影響連結的預設行為。 */
(() => {
  document.addEventListener("pointerdown", (e) => {
    const el = e.target.closest?.(".zm-seal");
    if (!el || e.pointerType === "mouse") return;
    el.classList.add("zm-pressed");
    const clear = () => el.classList.remove("zm-pressed");
    el.addEventListener("pointerup", clear, { once: true });
    el.addEventListener("pointercancel", clear, { once: true });
    el.addEventListener("pointerleave", clear, { once: true });
  }, { passive: true });
})();
