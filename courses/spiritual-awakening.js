(() => {
  "use strict";

  // Public introduction videos load only when a visitor chooses to play one.
  document.querySelectorAll(".video-frame[data-video-id]").forEach((frame) => {
    const button = frame.querySelector(".video-poster");
    const videoId = frame.dataset.videoId || "";
    if (!button || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) return;

    button.addEventListener("click", () => {
      const iframe = document.createElement("iframe");
      iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&autoplay=1`;
      iframe.title = frame.dataset.videoTitle || "宇色老師課程介紹影片";
      iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
      iframe.allowFullscreen = true;
      iframe.referrerPolicy = "strict-origin-when-cross-origin";
      iframe.tabIndex = 0;
      frame.replaceChildren(iframe);
      iframe.focus();
    }, { once: true });
  });
})();
