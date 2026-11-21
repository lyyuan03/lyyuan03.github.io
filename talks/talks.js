(() => {
  "use strict";
  const EMBED = "https://www.youtube-nocookie.com";
  // YouTube 播放器回報「禁止嵌入／無法播放」的錯誤碼
  const BLOCKED = new Set([2, 5, 100, 101, 150, 153]);
  const players = [];

  const showFallback = (entry) => {
    if (entry.iframe) entry.iframe.remove();
    entry.iframe = null;
    entry.button.hidden = true;
    entry.fallback.hidden = false;
  };

  const loadPlayer = (entry) => {
    if (entry.iframe) return;
    const { button, media } = entry;
    const iframe = document.createElement("iframe");
    const params = new URLSearchParams({
      autoplay: "1",
      rel: "0",
      modestbranding: "1",
      playsinline: "1",
      enablejsapi: "1",
      origin: location.origin
    });
    iframe.src = EMBED + "/embed/" + encodeURIComponent(button.dataset.videoId) + "?" + params.toString();
    iframe.title = button.dataset.title || "YouTube 影片";
    iframe.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.addEventListener("load", () => {
      try {
        iframe.contentWindow.postMessage(JSON.stringify({ event: "listening", id: button.dataset.videoId, channel: "widget" }), EMBED);
      } catch (error) { /* 無法監聽時，仍保有「在 YouTube 觀看」連結 */ }
    });
    entry.iframe = iframe;
    button.hidden = true;
    media.appendChild(iframe);
    iframe.focus();
  };

  document.querySelectorAll(".talk-media").forEach((media) => {
    const button = media.querySelector(".talk-player");
    const fallback = media.querySelector(".talk-fallback");
    if (!button || !fallback) return;
    const entry = { media, button, fallback, iframe: null };
    players.push(entry);
    button.addEventListener("click", () => loadPlayer(entry));
    const image = button.querySelector("img");
    if (image) image.addEventListener("error", () => image.remove(), { once: true });
  });

  window.addEventListener("message", (event) => {
    if (event.origin !== EMBED) return;
    const entry = players.find((item) => item.iframe && item.iframe.contentWindow === event.source);
    if (!entry) return;
    let data = event.data;
    if (typeof data === "string") {
      try { data = JSON.parse(data); } catch (error) { return; }
    }
    if (data && data.event === "onError" && BLOCKED.has(Number(data.info))) showFallback(entry);
  });
})();
