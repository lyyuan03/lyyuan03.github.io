const TARGET_ID = "2026-building-patron-record";
const activeId = new URLSearchParams(location.search).get("id") || "";

if (activeId === TARGET_ID) installBuildingPatronArticleEnhancements();

function installBuildingPatronArticleEnhancements() {
  document.documentElement.classList.add("building-patron-article-mode");

  if (!document.getElementById("building-patron-article-style")) {
    const style = document.createElement("style");
    style.id = "building-patron-article-style";
    style.textContent = `
      .building-patron-article-mode .article-view[data-article-id="${TARGET_ID}"] .building-story-figure{
        margin:34px 0 42px;
        border:1px solid rgba(108,88,64,.18);
        background:#f6f2ea;
        overflow:hidden;
      }
      .building-patron-article-mode .article-view[data-article-id="${TARGET_ID}"] .building-story-figure img{
        display:block;
        width:100%;
        height:auto;
        margin:0;
        border:0;
        box-shadow:none;
      }
      .building-patron-article-mode .article-view[data-article-id="${TARGET_ID}"] .building-story-figure figcaption{
        padding:12px 15px 14px;
        border-top:1px solid rgba(108,88,64,.13);
        color:#756652;
        font-family:"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif;
        font-size:12px;
        line-height:1.75;
        letter-spacing:.02em;
      }
      .building-patron-article-mode .article-view[data-article-id="${TARGET_ID}"] .article-body h2{
        scroll-margin-top:100px;
      }
      @media(max-width:760px){
        .building-patron-article-mode .article-view[data-article-id="${TARGET_ID}"] .building-story-figure{
          margin:28px 0 34px;
        }
        .building-patron-article-mode .article-view[data-article-id="${TARGET_ID}"] .building-story-figure figcaption{
          padding:10px 12px 12px;
          font-size:11px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function findParagraph(body, needle) {
    return [...body.querySelectorAll("p")].find((node) =>
      (node.textContent || "").replace(/\s+/g, " ").includes(needle)
    );
  }

  function addFigure(body, { id, anchor, src, caption, alt, base64Url = "" }) {
    if (body.querySelector(`[data-building-photo="${id}"]`)) return;
    const paragraph = findParagraph(body, anchor);
    if (!paragraph) return;

    const figure = document.createElement("figure");
    figure.className = "building-story-figure";
    figure.dataset.buildingPhoto = id;
    const img = document.createElement("img");
    img.alt = alt || "";
    img.loading = "lazy";
    img.decoding = "async";
    const note = document.createElement("figcaption");
    note.textContent = caption;
    figure.append(img, note);
    paragraph.after(figure);

    if (base64Url) {
      fetch(base64Url, { cache: "no-store" })
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.text();
        })
        .then((value) => {
          const base64 = value.replace(/\s+/g, "");
          if (!base64.startsWith("UklGR")) throw new Error("Invalid WebP payload");
          img.src = `data:image/webp;base64,${base64}`;
        })
        .catch((error) => {
          console.warn("建院照片載入失敗：", id, error);
          figure.remove();
        });
    } else {
      img.src = src;
    }
  }

  function decorate() {
    const article = document.querySelector(`.article-view[data-article-id="${CSS.escape(TARGET_ID)}"]`);
    const body = article?.querySelector(".article-body");
    if (!article || !body) return false;

    addFigure(body, {
      id: "paused-site",
      anchor: "閉園兩年半，這個問題一直都在",
      src: "images/dizhi-build-pause.jpg?v=20260901-story-1",
      alt: "靈元院停工期間的工程現場",
      caption: "停工期間留下的工程現場。工程停下來，時間卻沒有停止，原有設施與半成品仍持續承受風吹、日曬與雨淋。"
    });

    addFigure(body, {
      id: "site-environment",
      anchor: "院裡原有的樹木、環境、建築規劃",
      src: "assets/construction/lingyuan-site-aerial-overview-20260822.webp?v=20260901-story-1",
      alt: "靈元院院區與周邊環境",
      caption: "院區與周邊環境。閉園期間，找地、看地與既有院區的建築、樹木、環境規劃並沒有中斷。"
    });

    addFigure(body, {
      id: "current-progress",
      anchor: "現在大家在照片裡看到的外部結構，已經先做了起來",
      base64Url: "assets/lingyuan-progress-202608.webp.b64?v=20260901-story-2",
      alt: "靈元院目前建院進度與外部結構",
      caption: "2026 年目前建院進度。外部結構已先行完成，這只是能讓後續工程重新往前的一個殼，並不是靈元院最後的樣子。"
    });

    addFigure(body, {
      id: "building-dimensions",
      anchor: "這一座鐵構，前後寬約十四點四二公尺",
      src: "images/dizhi-blueprint.jpg?v=20260901-story-1",
      alt: "靈元院建築尺度與工程配置參考",
      caption: "建築尺度與配置參考。現有結構前後寬約 14.42 公尺、左右深度約 14.36 公尺，最高處約 6.17 公尺。"
    });

    addFigure(body, {
      id: "interior-direction",
      anchor: "下一步，是在現有結構裡繼續往內興建",
      src: "images/dizhi-space.jpg?v=20260901-story-1",
      alt: "靈元院內部空間與後續施工方向",
      caption: "外部結構完成之後，真正繁複的是往內施工。主殿、水電、泥作、木構、廁所與其他空間，都必須依序重新銜接。"
    });

    addFigure(body, {
      id: "future-garden",
      anchor: "所以當年規劃靈元院時，我一直很在意庭園、樹木、廊道、光線",
      src: "images/dizhi-render-garden.jpg?v=20260901-story-1",
      alt: "靈元院未來庭園與修行空間設計意象",
      caption: "未來空間設計意象。希望建築、庭園、樹木、廊道與光線能一起構成一個讓人真正慢下來的修行場所。"
    });

    return true;
  }

  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      decorate();
    });
  };

  decorate();
  [80, 250, 700, 1500, 3000, 6000].forEach((delay) => setTimeout(decorate, delay));
  const root = document.getElementById("article-root") || document.body;
  new MutationObserver(schedule).observe(root, { childList: true, subtree: true });
}
