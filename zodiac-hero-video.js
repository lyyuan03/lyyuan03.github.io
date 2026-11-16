/* 2027 丁未年十二生肖：首圖循環短片（無聲、5 秒）。
   - 先顯示靜態首圖；影片只在允許時才載入，載入並開始播放後才淡入。
   - 使用者設定「減少動態」、省流量模式或 2G 網路時，不載入影片。
   - 影片載入失敗、瀏覽器擋住自動播放時，維持原本的靜態首圖。
   - 不使用 MutationObserver 或 setInterval，不碰 Firebase 與權限。 */
(() => {
  const video = document.querySelector(".zp-main > .zp-hero video.zp-hero-video[data-src]");
  if (!video) return;
  const conn = navigator.connection || {};
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches
    || conn.saveData || /(^|-)2g$/.test(conn.effectiveType || "")) { video.remove(); return; }
  video.muted = true; video.loop = true; video.playsInline = true;
  video.addEventListener("playing", () => video.classList.add("is-playing"), { once: true });
  video.addEventListener("error", () => video.remove(), { once: true });
  let visible = true;
  const play = () => { if (visible && !document.hidden) { const p = video.play(); if (p) p.catch(() => {}); } };
  const start = () => {
    video.src = video.dataset.src;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((list) => {
        visible = list[list.length - 1].isIntersecting;
        if (visible) play(); else video.pause();
      }).observe(video);
    }
    play();
  };
  document.addEventListener("visibilitychange", () => { if (document.hidden) video.pause(); else play(); });
  if ("requestIdleCallback" in window) requestIdleCallback(start, { timeout: 1500 }); else setTimeout(start, 300);
})();
