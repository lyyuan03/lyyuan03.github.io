// 2026-10-05 改版前由使用者發布於公開課程頁的原稿。
 // 僅在已驗證管理員的課程頁讀取；不將詳細段落重新放進公開 HTML。
const LEGACY_SOURCE = "https://raw.githubusercontent.com/lyyuan03/lyyuan03.github.io/fab40ab2e214f5a70bf7d7f49ab575cb3dbaa900/courses/male-yoga-energy.html";

const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();

export async function recoverLegacyMaleYogaBody() {
  const response = await fetch(LEGACY_SOURCE, { cache: "no-store" });
  if (!response.ok) throw new Error("舊版來源暫時無法讀取：" + response.status);
  const oldHtml = new DOMParser().parseFromString(await response.text(), "text/html");
  const original = oldHtml.querySelector("#workshop .workshop-story");
  const current = document.querySelector("#workshop .workshop-story");
  if (!original || !current) throw new Error("無法辨識歷史課程正文");

  const publicTexts = new Set(Array.from(current.children)
    .filter((node) => node.tagName === "P")
    .map((node) => clean(node.textContent)));

  const recovered = document.createElement("div");
  const header = document.createElement("h3");
  header.textContent = "課程詳細內容";
  recovered.appendChild(header);

  let recoveredParagraphs = 0;
  for (const child of original.children) {
    if (child.tagName === "P" && !publicTexts.has(clean(child.textContent))) {
      const paragraph = document.createElement(child.classList.contains("story-lead") ? "h3" : "p");
      paragraph.textContent = clean(child.textContent);
      recovered.appendChild(paragraph);
      recoveredParagraphs += 1;
    }
    if (child.tagName === "FIGURE") {
      const sourceImg = child.querySelector("img");
      const path = sourceImg?.getAttribute("src") || "";
      if (!path.startsWith("/assets/")) continue;
      const figure = document.createElement("figure");
      const img = document.createElement("img");
      img.src = path;
      img.alt = sourceImg.getAttribute("alt") || "";
      img.loading = "lazy";
      figure.appendChild(img);
      const sourceCaption = child.querySelector("figcaption");
      if (sourceCaption) {
        const caption = document.createElement("figcaption");
        caption.textContent = clean(sourceCaption.textContent);
        figure.appendChild(caption);
      }
      recovered.appendChild(figure);
    }
  }
  // 只接受原始文章的完整歷史版本，避免錯誤的來源造成局部文章被發布。
  if (recoveredParagraphs < 10 || !recovered.textContent.includes("男性身體")) {
    throw new Error("舊版內容不完整，未進行恢復");
  }
  return recovered.innerHTML;
}
