const CATEGORY_LABELS = {
  spiritual: "靈修",
  worldly: "人生",
  "spirit-world": "靈界",
  reading: "宇色書房"
};

const SERIES_BY_ID = {
  "fantasy-intuition-or-yuanshen": "靈修辨證",
  "yuanshen-awakening-eleven-principles": "靈修辨證",
  "lingxiu-yuanshen-reality": "靈修辨證",
  "lingxiu-zouhuo-rumo": "靈修辨證",
  "2026-guanyin-vow-lamp-record": "觀音修行",
  "celebrity-death-dream-spirit-five-checks": "靈界辨證",
  "wealth-discipline-investing-and-self-mastery": "宇色書房",
  "wealth-as-water": "財富與生命",
  "market-crash-money-self-control": "財富與生命",
  "good-fortune-believe-in-yourself-choices": "生命選擇"
};

function displayCategory(article = {}, fallback = "") {
  if (article.displayCategory) return article.displayCategory;
  if (article.accessType === "event" || article.id === "2026-guanyin-vow-lamp-record") return "法會紀實";
  if (CATEGORY_LABELS[article.category]) return CATEGORY_LABELS[article.category];
  if (fallback.includes("活動限定")) return "法會紀實";
  if (fallback.includes("靈．修行")) return "靈修";
  if (fallback.includes("人．俗世")) return "人生";
  if (fallback.includes("異．靈界")) return "靈界";
  if (fallback.includes("思．讀物")) return "宇色書房";
  return "文選";
}

function installStyles() {
  if (document.getElementById("article-taxonomy-v2-style")) return;
  const style = document.createElement("style");
  style.id = "article-taxonomy-v2-style";
  style.textContent = `
    .article-editorial-labels{display:flex;align-items:center;flex-wrap:wrap;gap:7px;margin:0 0 8px}
    .article-editorial-category,.article-editorial-series{display:inline-flex;align-items:center;min-height:24px;padding:3px 9px;border-radius:999px;font-family:'Noto Sans TC',sans-serif;font-size:10px;font-weight:600;line-height:1.25;letter-spacing:.06em}
    .article-editorial-category{border:1px solid rgba(165,130,84,.32);background:rgba(165,130,84,.14);color:#674929}
    .article-editorial-series{border:1px solid rgba(96,99,48,.3);background:rgba(96,99,48,.11);color:#4E5229}
    .article-view>.article-editorial-labels{margin:4px 0 14px}
    .taxonomy-fields{padding:14px;border:1px solid rgba(165,130,84,.22);background:rgba(165,130,84,.05)}
    .article-item-meta .taxonomy-admin-label{color:#CBAA77}
    @media(max-width:760px){.article-editorial-labels{gap:5px}.article-editorial-category,.article-editorial-series{min-height:22px;padding:3px 7px;font-size:9px}}
  `;
  document.head.appendChild(style);
}

function decorateFrontEnd() {
  if (!/(^|\/)articles\.html$/i.test(location.pathname)) return;
  installStyles();

  const decorate = () => {
    document.querySelectorAll(".article-card[data-article-id]").forEach((card) => {
      const id = card.dataset.articleId || "";
      if (card.querySelector(":scope .article-editorial-labels")) return;
      const meta = card.querySelector(".article-meta");
      const category = displayCategory({ id }, meta?.textContent || "");
      const series = SERIES_BY_ID[id] || "";
      const labels = document.createElement("div");
      labels.className = "article-editorial-labels";
      labels.innerHTML = `<span class="article-editorial-category">${category}</span>${series ? `<span class="article-editorial-series">${series}系列</span>` : ""}`;
      card.querySelector(".article-list-title")?.before(labels);
      if (meta) meta.style.display = "none";
    });

    const detail = document.querySelector(".article-view[data-article-id]");
    if (detail && !detail.querySelector(":scope > .article-editorial-labels")) {
      const id = detail.dataset.articleId || "";
      const meta = detail.querySelector(":scope > .article-meta");
      const category = displayCategory({ id }, meta?.textContent || "");
      const series = SERIES_BY_ID[id] || "";
      const labels = document.createElement("div");
      labels.className = "article-editorial-labels";
      labels.innerHTML = `<span class="article-editorial-category">${category}</span>${series ? `<span class="article-editorial-series">${series}系列</span>` : ""}`;
      detail.querySelector(":scope > h2")?.before(labels);
      if (meta) meta.style.display = "none";
    }

    document.querySelectorAll(".category-tabs a").forEach((link) => {
      const replacements = {
        "靈．修行": "靈修",
        "人．俗世": "人生",
        "異．靈界": "靈界",
        "思．讀物": "宇色書房"
      };
      const text = link.childNodes[0]?.textContent?.trim();
      if (text && replacements[text]) link.childNodes[0].textContent = replacements[text];
    });
  };

  decorate();
  new MutationObserver(decorate).observe(document.body, { childList: true, subtree: true });
}

function installAdminFields() {
  if (!/(^|\/)admin\.html$/i.test(location.pathname)) return;
  installStyles();

  const mount = () => {
    const form = document.getElementById("article-form");
    const accessFields = form?.querySelector(".event-access-fields");
    if (!form || !accessFields || document.getElementById("displayCategory")) return;

    const fields = document.createElement("div");
    fields.className = "grid taxonomy-fields";
    fields.innerHTML = `
      <div class="field">
        <label for="displayCategory">前台顯示分類</label>
        <select id="displayCategory" name="displayCategory">
          <option value="">依主分類自動判斷</option>
          <option value="靈修">靈修</option>
          <option value="法會紀實">法會紀實</option>
          <option value="宇色書房">宇色書房</option>
          <option value="人生">人生</option>
          <option value="靈界">靈界</option>
        </select>
      </div>
      <div class="field">
        <label for="series">文章系列</label>
        <input id="series" name="series" list="article-series-options" placeholder="例：靈修辨證、觀音修行">
        <datalist id="article-series-options">
          <option value="靈修辨證"><option value="觀音修行"><option value="宇色書房"><option value="財富與生命"><option value="生命選擇"><option value="靈界辨證">
        </datalist>
      </div>
    `;
    accessFields.after(fields);

    const originalSetValues = () => {
      const id = document.querySelector(".article-item.is-active")?.dataset.id || "";
      const category = document.getElementById("category")?.value || "";
      const access = document.getElementById("accessType")?.value || "";
      const categoryInput = document.getElementById("displayCategory");
      const seriesInput = document.getElementById("series");
      if (categoryInput && !categoryInput.value) categoryInput.value = access === "event" ? "法會紀實" : (CATEGORY_LABELS[category] || "");
      if (seriesInput && !seriesInput.value && SERIES_BY_ID[id]) seriesInput.value = SERIES_BY_ID[id];
    };

    form.addEventListener("submit", () => {
      const id = document.querySelector(".article-item.is-active")?.dataset.id || "";
      const categoryValue = document.getElementById("displayCategory")?.value || "";
      const seriesValue = document.getElementById("series")?.value || "";
      window.setTimeout(async () => {
        if (!id) return;
        try {
          const [{ db }, firestore] = await Promise.all([
            import("./firebase-config.js"),
            import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js")
          ]);
          await firestore.setDoc(firestore.doc(db, "articles", id), {
            displayCategory: categoryValue,
            series: seriesValue,
            taxonomyUpdatedAt: firestore.serverTimestamp()
          }, { merge: true });
        } catch (error) {
          console.warn("分類與系列欄位儲存失敗。", error);
        }
      }, 1200);
    }, true);

    document.getElementById("category")?.addEventListener("change", originalSetValues);
    document.getElementById("accessType")?.addEventListener("change", originalSetValues);
    new MutationObserver(originalSetValues).observe(document.getElementById("article-list"), { childList: true, subtree: true, attributes: true });
    originalSetValues();
  };

  mount();
  new MutationObserver(mount).observe(document.body, { childList: true, subtree: true });
}

decorateFrontEnd();
installAdminFields();
