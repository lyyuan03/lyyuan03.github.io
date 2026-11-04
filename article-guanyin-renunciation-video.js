const ARTICLE_ID = "2026-guanyin-renunciation-suffering";
const VIDEO_FIGURE_ID = "guanyin-renunciation-video";
const VIDEO_SRC = "/assets/videos/2026-guanyin-eight-questions.mp4?v=20261104-1";
const POSTER_SRC = "/assets/articles/2026-guanyin-renunciation-suffering/video-poster.jpg?v=20261104-1";

function installStyles() {
  if (document.getElementById("guanyin-renunciation-video-styles")) return;
  const style = document.createElement("style");
  style.id = "guanyin-renunciation-video-styles";
  style.textContent = `
    .article-guanyin-video {
      margin: 36px 0 44px !important;
      padding: 14px 14px 12px;
      border: 1px solid rgba(139,104,63,.28);
      background: rgba(255,255,255,.28);
    }
    .article-guanyin-video__player {
      display: block;
      width: 100%;
      height: auto;
      aspect-ratio: 16 / 9;
      border: 0;
      background: #000;
    }
    .article-guanyin-video figcaption {
      margin-top: 11px;
      color: #725D48;
      font-family: var(--sans, "Noto Sans TC", sans-serif);
      font-size: 13px;
      line-height: 1.7;
      text-align: center;
    }
    @media (max-width: 760px) {
      .article-guanyin-video {
        margin: 28px 0 36px !important;
        padding: 8px 8px 10px;
      }
      .article-guanyin-video figcaption {
        padding: 0 5px;
        font-size: 12px;
      }
    }
  `;
  document.head.appendChild(style);
}

function createVideoFigure() {
  const figure = document.createElement("figure");
  figure.id = VIDEO_FIGURE_ID;
  figure.className = "article-guanyin-video";

  const video = document.createElement("video");
  video.className = "article-guanyin-video__player";
  video.controls = true;
  video.playsInline = true;
  video.preload = "metadata";
  video.poster = POSTER_SRC;
  video.width = 1920;
  video.height = 1080;
  video.setAttribute("aria-label", "念經持咒多年，為何心性仍未改變？修持觀音法脈八問");

  const source = document.createElement("source");
  source.src = VIDEO_SRC;
  source.type = "video/mp4";
  video.appendChild(source);
  video.append("您的瀏覽器不支援影片播放，請使用下方連結觀看。");

  const fallbackLink = document.createElement("a");
  fallbackLink.href = VIDEO_SRC;
  fallbackLink.textContent = "開啟影片";
  video.appendChild(fallbackLink);

  const caption = document.createElement("figcaption");
  caption.textContent = "影音導讀｜修持觀音法脈八問（約 12 分鐘）";

  figure.append(video, caption);
  return figure;
}

function mountVideo() {
  if (new URLSearchParams(location.search).get("id") !== ARTICLE_ID) return;
  const article = document.querySelector(`.article-view[data-article-id="${ARTICLE_ID}"]`);
  if (!article || !article.hasAttribute("data-article-access")) return;
  if (article.querySelector(`#${VIDEO_FIGURE_ID}`)) return;

  const body = article.querySelector(".article-body");
  if (!body) return;

  installStyles();
  const figure = createVideoFigure();
  const firstSection = [...body.children].find((element) => element.tagName === "H2");
  if (firstSection) firstSection.before(figure);
  else body.appendChild(figure);
}

document.addEventListener("lyyuan:article-rendered", (event) => {
  if (event.detail?.articleId === ARTICLE_ID) mountVideo();
});

mountVideo();
