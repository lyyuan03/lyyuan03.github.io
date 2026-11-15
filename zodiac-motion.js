/* 2027 丁未年十二生肖：閱讀系統的輕量動態控制（屬鼠範本）
   - 只操作 class、屬性與 CSS 變數，不改寫文章內容，不碰 Firebase 與權限。
   - 不使用 MutationObserver 或 setInterval；捲動以 requestAnimationFrame 節流。
   - 專屬全文由 zodiac-lamp-reader.js 從 Firestore 載入後發出「zodiac:content」事件，
     這裡據此重建目錄並觀察新章節；登出或權限改變時目錄會一併移除私人章節標題。
   - prefers-reduced-motion 時只建立目錄，不加任何動態。 */
(() => {
  const main = document.querySelector(".zp-main");
  if (!main) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(min-width: 769px) and (hover: hover) and (pointer: fine)").matches;
  const sideToc = window.matchMedia("(min-width: 1360px)");
  const lamp = main.querySelector("[data-lamp-reader]");

  let toc = null;
  let entries = []; // { el, link }

  const visible = (el) => !el.closest("[hidden]");

  /* 章節目錄：公開章節＋點燈專屬章節（只有已授權載入時才有專屬章節標題） */
  function buildToc() {
    const publicHeads = [...main.querySelectorAll(":scope > h2")].filter(visible);
    const lampHeads = lamp ? [...lamp.querySelectorAll(".zr-exclusive h2")] : [];
    const groups = [{ label: "公開篇", items: publicHeads.map((el) => ({ el, text: el.textContent.trim() })) }];
    if (lampHeads.length) groups.push({ label: "點燈專屬", items: lampHeads.map((el) => ({ el, text: el.textContent.trim() })) });
    else if (lamp && visible(lamp) && !lamp.hidden) groups.push({ label: "點燈專屬", items: [{ el: lamp, text: "年度點燈專屬解讀" }] });

    const total = groups.reduce((n, g) => n + g.items.length, 0);
    const wasOpen = toc ? toc.open : null;
    toc?.remove();
    toc = null;
    entries = [];
    if (total < 2) return;

    toc = document.createElement("details");
    toc.className = "zm-toc";
    const summary = document.createElement("summary");
    summary.textContent = "本文章節";
    toc.append(summary);
    let n = 0;
    groups.forEach((g) => {
      if (!g.items.length) return;
      const label = document.createElement("p");
      label.className = "zm-toc-group";
      label.textContent = g.label;
      const list = document.createElement("ol");
      g.items.forEach(({ el, text }) => {
        if (!el.id) el.id = `zp-section-${++n}`;
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = `#${el.id}`;
        a.textContent = text;
        li.append(a);
        list.append(li);
        entries.push({ el, link: a });
      });
      toc.append(label, list);
    });
    (publicHeads[0] || main.querySelector(":scope > .zp-reading") || lamp).before(toc);
    toc.open = wasOpen ?? sideToc.matches;
    if (sideToc.matches) toc.open = true;
    toc.addEventListener("click", (e) => {
      if (e.target.closest("a") && !sideToc.matches) toc.open = false; // 手機選取章節後收合
    });
  }

  /* 手機點擊回饋：觸控時補上按下狀態 */
  const pressables = ".zp-gated-link, .zp-lamp-login, .zm-btn, .zp-nav a, .zr-switch a";
  document.addEventListener("pointerdown", (e) => {
    const el = e.target.closest?.(pressables);
    if (!el || e.pointerType === "mouse") return;
    el.classList.add("zm-pressed");
    const clear = () => el.classList.remove("zm-pressed");
    el.addEventListener("pointerup", clear, { once: true });
    el.addEventListener("pointercancel", clear, { once: true });
    el.addEventListener("pointerleave", clear, { once: true });
  }, { passive: true });

  buildToc();

  let reveal = null;
  const revealTargets = () => [
    ...main.querySelectorAll(":scope > h2, .zr-exclusive h2, .zr-exclusive h3, .zr-quote, .zr-summary, .zr-divide")
  ].filter((el) => !el.classList.contains("zm-in"));
  const observeNew = () => {
    const targets = revealTargets();
    if (!reveal) { targets.forEach((el) => el.classList.add("zm-in")); return; }
    targets.forEach((el) => reveal.observe(el));
  };

  if (!reduce) {
    document.documentElement.classList.add("zm-ready");
    if ("IntersectionObserver" in window) {
      reveal = new IntersectionObserver((list) => {
        list.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("zm-in");
            reveal.unobserve(entry.target);
          }
        });
      }, { rootMargin: "0px 0px -6% 0px" });
    }
    observeNew();
  }

  /* 閱讀進度、輕微視差、目前章節 */
  const bar = reduce ? null : document.createElement("div");
  if (bar) {
    bar.className = "zm-progress";
    bar.setAttribute("aria-hidden", "true");
    document.body.append(bar);
  }
  const heroImg = main.querySelector(":scope > .zp-hero img");
  let ticking = false;
  const update = () => {
    ticking = false;
    if (bar) {
      const rect = main.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const p = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 1;
      bar.style.setProperty("--zm-progress", p.toFixed(4));
    }
    if (!reduce && heroImg && finePointer) {
      const r = heroImg.parentElement.getBoundingClientRect();
      if (r.bottom > 0 && r.top < window.innerHeight) {
        const offset = Math.max(-18, Math.min(18, (r.top + r.height / 2 - window.innerHeight / 2) * -0.04));
        heroImg.style.setProperty("--zm-parallax", `${offset.toFixed(1)}px`);
      }
    }
    if (entries.length) {
      let current = -1;
      entries.forEach(({ el }, i) => { if (el.getBoundingClientRect().top < window.innerHeight * 0.35) current = i; });
      entries.forEach(({ link }, i) => {
        if (i === Math.max(current, 0)) link.setAttribute("aria-current", "true");
        else link.removeAttribute("aria-current");
      });
    }
  };
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  sideToc.addEventListener?.("change", () => { if (toc) toc.open = sideToc.matches || toc.open; onScroll(); });

  /* 專屬全文載入、切換帳號或登出後：重建目錄、觀察新章節、更新進度 */
  document.addEventListener("zodiac:content", () => {
    buildToc();
    if (!reduce) observeNew();
    onScroll();
  });

  update();
})();
