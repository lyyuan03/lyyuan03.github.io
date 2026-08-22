const params = new URLSearchParams(location.search);
const activeId = params.get("id") || "";

if (activeId === "2026-lineage-lamp-building-record") {
  installExtraConstructionImages();
}

function installExtraConstructionImages() {
  const styleId = "construction-record-extra-images-style";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      .construction-record-mode .construction-record-view .construction-extra-render{
        position:relative;
        margin:34px 0 40px;
        overflow:hidden;
        border:1px solid rgba(139,104,63,.24);
        background:rgba(165,130,84,.045);
      }
      .construction-record-mode .construction-record-view .construction-extra-render::after{display:none!important}
      .construction-record-mode .construction-record-view .construction-extra-render img{
        display:block;
        width:100%;
        height:auto;
        border:0!important;
        box-shadow:none!important;
        background:#d8d0c2;
      }
      .construction-record-mode .construction-record-view .construction-extra-render.is-loading img{min-height:220px}
      .construction-record-mode .construction-record-view .construction-extra-render figcaption{
        padding:13px 16px 15px;
        color:#725b43;
        font-family:"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif;
        font-size:12px;
        line-height:1.75;
        letter-spacing:.04em;
        border-top:1px solid rgba(139,104,63,.18);
      }
      @media(max-width:760px){
        .construction-record-mode .construction-record-view .construction-extra-render{margin:28px 0 32px}
        .construction-record-mode .construction-record-view .construction-extra-render.is-loading img{min-height:150px}
        .construction-record-mode .construction-record-view .construction-extra-render figcaption{padding:11px 13px 13px;font-size:11px}
      }
    `;
    document.head.appendChild(style);
  }

  const specs = [
    {
      id: "entrance-path",
      payload: "assets/construction/2026-lineage-lamp/entrance-path-720.jpg.b64?v=20260822-2",
      alt: "靈元院入口與石徑動線 3D 設計示意",
      caption: "入口與石徑動線｜由入口穿越植栽與木構廊架，逐步進入院區的空間設計示意。",
      anchorImage: /dizhi-render-exterior\.jpg/i
    },
    {
      id: "garden-corridor",
      payload: "assets/construction/2026-lineage-lamp/garden-corridor-500.jpg.b64?v=20260822-2",
      alt: "靈元院庭園與廊道 3D 設計示意",
      caption: "庭園與廊道｜木構建築、植栽與步道彼此銜接，呈現院區安定而內斂的行走尺度。",
      anchorImage: /dizhi-render-garden\.jpg/i
    },
    {
      id: "shrine-hall",
      payload: "assets/construction/2026-lineage-lamp/shrine-hall-500.jpg.b64?v=20260822-2",
      alt: "靈元院內部修持空間 3D 設計示意",
      caption: "內部修持空間｜以木格柵、柔和光線與水景構成沉靜的核心空間，作為未來修持與禮敬場域的設計想像。",
      headingPattern: /(主殿|殿內|內殿|修持|神尊)/
    }
  ];

  const loadImagePayload = async (spec, image, figure) => {
    try {
      const response = await fetch(spec.payload, { cache: "reload" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const base64 = (await response.text()).replace(/\s+/g, "");
      if (!base64.startsWith("/9j/")) throw new Error("invalid JPEG payload");
      image.src = `data:image/jpeg;base64,${base64}`;
      figure.classList.remove("is-loading");
    } catch (error) {
      console.warn(`建院設計圖載入失敗：${spec.id}`, error);
      figure.classList.remove("is-loading");
      figure.classList.add("is-error");
    }
  };

  const makeFigure = (spec) => {
    const figure = document.createElement("figure");
    figure.className = "construction-extra-render is-loading";
    figure.dataset.constructionExtra = spec.id;

    const image = document.createElement("img");
    image.alt = spec.alt;
    image.loading = "lazy";
    image.decoding = "async";

    const caption = document.createElement("figcaption");
    caption.textContent = spec.caption;
    figure.append(image, caption);
    void loadImagePayload(spec, image, figure);
    return figure;
  };

  const sectionEnd = (heading) => {
    let node = heading.nextElementSibling;
    let last = heading;
    while (node && !/^H2$/i.test(node.tagName)) {
      last = node;
      node = node.nextElementSibling;
    }
    return last === heading ? heading : last;
  };

  const ensure = () => {
    const article = document.querySelector(`.article-view[data-article-id="${CSS.escape(activeId)}"]`);
    const body = article?.querySelector(".article-body");
    if (!article || !body) return false;

    specs.forEach((spec) => {
      if (body.querySelector(`[data-construction-extra="${spec.id}"]`)) return;
      const figure = makeFigure(spec);

      if (spec.anchorImage) {
        const anchorImage = [...body.querySelectorAll("img")].find((img) => spec.anchorImage.test(img.getAttribute("src") || ""));
        if (anchorImage) {
          const anchorBlock = anchorImage.closest("figure") || anchorImage.closest("p") || anchorImage;
          anchorBlock.after(figure);
          return;
        }
      }

      if (spec.headingPattern) {
        const heading = [...body.querySelectorAll("h2,h3")].find((h) => spec.headingPattern.test(h.textContent || ""));
        if (heading) {
          sectionEnd(heading).after(figure);
          return;
        }
      }

      const fallback = body.querySelector('[data-construction-extra="garden-corridor"]') || body.lastElementChild;
      if (fallback) fallback.after(figure);
      else body.appendChild(figure);
    });
    return true;
  };

  let scheduled = false;
  const scheduleEnsure = () => {
    if (scheduled) return;
    scheduled = true;
    window.setTimeout(() => {
      scheduled = false;
      ensure();
    }, 40);
  };

  ensure();
  window.setTimeout(ensure, 350);
  window.setTimeout(ensure, 1200);

  const root = document.getElementById("article-root") || document.documentElement;
  const observer = new MutationObserver(scheduleEnsure);
  observer.observe(root, { childList: true, subtree: true });
}