/* 2027 丁未年十二生肖：輕量動態控制（屬鼠範本）
   - 只操作 class 與 CSS 變數，不改寫文章內容，不碰 Firebase 與權限。
   - 不使用 MutationObserver 或 setInterval；捲動以 requestAnimationFrame 節流。
   - prefers-reduced-motion 時只建立目錄，不加任何動態。 */
(() => {
  const main = document.querySelector(".zp-main");
  if (!main) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(min-width: 769px) and (hover: hover) and (pointer: fine)").matches;

  /* 章節目錄：由目前可見的章節標題自動產生（含日後的上半年、下半年、十二流月） */
  const headings = [...main.querySelectorAll(":scope > h2")].filter((h) => !h.closest("[hidden]"));
  const links = [];
  if (headings.length >= 2) {
    const toc = document.createElement("details");
    toc.className = "zm-toc";
    const summary = document.createElement("summary");
    summary.textContent = "本文章節";
    const list = document.createElement("ol");
    headings.forEach((h, i) => {
      if (!h.id) h.id = `zp-section-${i + 1}`;
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = `#${h.id}`;
      a.textContent = h.textContent.trim();
      li.append(a);
      list.append(li);
      links.push(a);
    });
    toc.append(summary, list);
    headings[0].before(toc);
    if (window.matchMedia("(min-width: 769px)").matches) toc.open = true;
  }

  /* 手機點擊回饋：觸控時補上按下狀態 */
  const pressables = ".zp-gated-link, .zp-lamp-login, .zm-btn, .zp-nav a"; // .zm-seal 按下回饋見 zodiac-picker.js
  document.addEventListener("pointerdown", (e) => {
    const el = e.target.closest?.(pressables);
    if (!el || e.pointerType === "mouse") return;
    el.classList.add("zm-pressed");
    const clear = () => el.classList.remove("zm-pressed");
    el.addEventListener("pointerup", clear, { once: true });
    el.addEventListener("pointercancel", clear, { once: true });
    el.addEventListener("pointerleave", clear, { once: true });
  }, { passive: true });

  if (reduce) return;
  document.documentElement.classList.add("zm-ready");

  /* 章節標題進入畫面時淡入；目前章節同步標示於目錄 */
  if ("IntersectionObserver" in window) {
    const reveal = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("zm-in");
          reveal.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    headings.forEach((h) => reveal.observe(h));
  } else {
    headings.forEach((h) => h.classList.add("zm-in"));
  }

  /* 閱讀進度與輕微視差 */
  const bar = document.createElement("div");
  bar.className = "zm-progress";
  bar.setAttribute("aria-hidden", "true");
  document.body.append(bar);
  const heroImg = main.querySelector(":scope > .zp-hero img");
  let ticking = false;
  const update = () => {
    ticking = false;
    const rect = main.getBoundingClientRect();
    const total = rect.height - window.innerHeight;
    const p = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 1;
    bar.style.setProperty("--zm-progress", p.toFixed(4));
    if (heroImg && finePointer) {
      const r = heroImg.parentElement.getBoundingClientRect();
      if (r.bottom > 0 && r.top < window.innerHeight) {
        const offset = Math.max(-18, Math.min(18, (r.top + r.height / 2 - window.innerHeight / 2) * -0.04));
        heroImg.style.setProperty("--zm-parallax", `${offset.toFixed(1)}px`);
      }
    }
    if (links.length) {
      let current = 0;
      headings.forEach((h, i) => { if (h.getBoundingClientRect().top < window.innerHeight * 0.35) current = i; });
      links.forEach((a, i) => {
        if (i === current) a.setAttribute("aria-current", "true");
        else a.removeAttribute("aria-current");
      });
    }
  };
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  update();
})();
