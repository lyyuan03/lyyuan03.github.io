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
      .building-patron-article-mode .article-view[data-article-id="${TARGET_ID}"] .building-story-media{
        width:100%;
        aspect-ratio:16 / 9;
        overflow:hidden;
        background:#ebe6dc;
      }
      .building-patron-article-mode .article-view[data-article-id="${TARGET_ID}"] .building-story-figure img{
        display:block;
        width:100%;
        height:100%;
        object-fit:cover;
        object-position:center center;
        margin:0;
        border:0;
        box-shadow:none;
        image-rendering:auto;
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

  function addFigure(body, { id, anchor, src, caption, alt }) {
    if (body.querySelector(`[data-building-photo="${id}"]`)) return;
    const paragraph = findParagraph(body, anchor);
    if (!paragraph) return;

    const figure = document.createElement("figure");
    figure.className = "building-story-figure";
    figure.dataset.buildingPhoto = id;

    const media = document.createElement("div");
    media.className = "building-story-media";

    const img = document.createElement("img");
    img.alt = alt || "";
    img.loading = "lazy";
    img.decoding = "async";
    img.width = 2048;
    img.height = 1152;

    const note = document.createElement("figcaption");
    note.textContent = caption;

    media.append(img);
    figure.append(media, note);
    paragraph.after(figure);

    img.src = src;
    img.onerror = () => {
      console.warn("建院照片載入失敗：", id, src);
      figure.remove();
    };
  }

  function decorate() {
    const article = document.querySelector(`.article-view[data-article-id="${CSS.escape(TARGET_ID)}"]`);
    const body = article?.querySelector(".article-body");
    if (!article || !body) return false;

    addFigure(body, {
      id: "old-structure",
      anchor: "閉園兩年半，這個問題一直都在",
      src: "assets/construction/2026-building-patron/05-old-structure-hq.webp?v=20260901-hq-2",
      alt: "停工期間尚未整理的舊結構空間",
      caption: "停工期間的原有結構。兩年半沒有持續施工，空間、材料與設備都承受時間與環境的消耗。"
    });

    addFigure(body, {
      id: "site-vision",
      anchor: "院裡原有的樹木、環境、建築規劃",
      src: "assets/construction/2026-building-patron/02-site-vision-hq.webp?v=20260901-hq-2",
      alt: "靈元院整體空間設計示意",
      caption: "早期整體空間設計示意。靈元院從一開始就希望讓建築、庭園與自然環境彼此相連。"
    });

    addFigure(body, {
      id: "current-exterior",
      anchor: "現在大家在照片裡看到的外部結構，已經先做了起來",
      src: "assets/construction/2026-building-patron/06-current-exterior-hq.webp?v=20260901-hq-2",
      alt: "靈元院目前完成的外部建築結構",
      caption: "目前完成的外部建築結構。這只是後續工程能夠重新往前的基礎，還不是最後完成的樣子。"
    });

    addFigure(body, {
      id: "building-dimensions",
      anchor: "這一座鐵構，前後寬約十四點四二公尺",
      src: "assets/construction/2026-building-patron/03-building-dimensions-hq.webp?v=20260901-hq-2",
      alt: "靈元院建築尺寸與外觀配置圖",
      caption: "建築尺寸與外觀配置。前後寬約 14.42 公尺、左右深度約 14.36 公尺，最高處約 6.17 公尺。"
    });

    addFigure(body, {
      id: "steel-interior",
      anchor: "下一步，是在現有結構裡繼續往內興建",
      src: "assets/construction/2026-building-patron/04-steel-interior-hq.webp?v=20260901-hq-2",
      alt: "鐵構建築目前內部空間",
      caption: "目前鐵構內部。外殼完成後，主殿、水電、泥作、木構、廁所與其他空間才會逐步往內施作。"
    });

    addFigure(body, {
      id: "design-courtyard",
      anchor: "所以當年規劃靈元院時，我一直很在意庭園、樹木、廊道、光線",
      src: "assets/construction/2026-building-patron/01-design-courtyard-hq.webp?v=20260901-hq-2",
      alt: "靈元院庭園與建築設計示意",
      caption: "庭園與建築設計示意。希望未來走進靈元院時，建築本身不會壓過自然，而是讓人能慢下來。"
    });

    addFigure(body, {
      id: "site-trees",
      anchor: "庭園、樹木、廊道、光線",
      src: "assets/construction/2026-building-patron/07-site-trees-hq.webp?v=20260901-hq-2",
      alt: "靈元院建築旁保留的樹木與草地",
      caption: "建築旁保留的樹木與草地。未來的空間規劃會繼續把樹木、庭園與建築之間的關係放在重要位置。"
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
