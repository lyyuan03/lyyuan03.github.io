/* 2027 丁未年十二生肖：首圖循環短片（無聲、5 秒）。
   - 影片直接寫在頁面內，載入後自動播放；開始播放後才淡入，之前顯示靜態首圖。
   - 右下角有「暫停動態／播放動態」按鈕：使用者可暫停；手機擋住自動播放時，點一下即可播放。
   - 影片載入失敗時維持靜態首圖。
   - 不使用 MutationObserver 或 setInterval，不碰 Firebase 與權限。 */
(() => {
  const fig = document.querySelector(".zp-main > .zp-hero");
  const video = fig && fig.querySelector("video.zp-hero-video");
  if (!video) return;
  video.muted = true; video.loop = true; video.playsInline = true;
  video.setAttribute("playsinline", ""); video.setAttribute("webkit-playsinline", "");

  const btn = document.createElement("button");
  btn.type = "button"; btn.className = "zp-hero-toggle"; btn.hidden = true;
  fig.append(btn);
  const label = (playing) => {
    btn.textContent = playing ? "暫停動態" : "播放動態";
    btn.setAttribute("aria-label", playing ? "暫停首圖動態" : "播放首圖動態");
  };
  let userPaused = false;
  const tryPlay = () => {
    if (userPaused || document.hidden) return;
    const p = video.play();
    if (p) p.catch(() => { label(false); btn.hidden = false; });
  };
  // 影片寫在頁面內、可能在本程式載入前就已開始播放，所以除了監聽事件，啟動時也要主動檢查
  const markPlaying = () => {
    if (video.paused || !(video.currentTime > 0 || video.readyState >= 3)) return;
    video.classList.add("is-playing"); label(true); btn.hidden = false;
  };
  ["playing", "timeupdate", "canplay"].forEach((ev) => video.addEventListener(ev, markPlaying));
  label(false);
  video.addEventListener("error", () => { video.remove(); btn.remove(); }, { once: true });
  btn.addEventListener("click", () => {
    if (video.paused) { userPaused = false; video.play().then(() => {}, () => {}); }
    else { userPaused = true; video.pause(); label(false); }
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden) video.pause(); else tryPlay(); });
  markPlaying();
  tryPlay();
})();
