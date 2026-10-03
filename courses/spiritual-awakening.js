(() => {
  "use strict";
  const doc = document, root = doc.documentElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  root.classList.add("js");

  // 公開介紹影片：訪客按下播放才載入
  doc.querySelectorAll(".video-frame[data-video-id]").forEach((frame) => {
    const button = frame.querySelector(".video-poster");
    const videoId = frame.dataset.videoId || "";
    if (!button || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) return;

    button.addEventListener("click", () => {
      const iframe = doc.createElement("iframe");
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

  // 進場：與線上課程頁相同的機制
  const reveals = [...doc.querySelectorAll(".reveal")];
  if ("IntersectionObserver" in window && !reduce) {
    root.classList.add("motion-ready");
    const ob = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("on"); ob.unobserve(e.target); }
    }), { threshold: .08, rootMargin: "0px 0px -10%" });
    requestAnimationFrame(() => reveals.forEach((el) => ob.observe(el)));
  } else {
    reveals.forEach((el) => el.classList.add("on"));
  }

  // 頂端進度線、課程進度線、小導覽目前位置
  const bar = doc.getElementById("progress");
  const list = doc.getElementById("modules");
  const mods = [...doc.querySelectorAll(".module")];
  const links = [...doc.querySelectorAll(".subnav-links a[href^='#']")];
  const targets = links.map((a) => ({ a, el: doc.querySelector(a.getAttribute("href")) })).filter((t) => t.el);
  let ticking = false;
  function onScroll() {
    const h = root.scrollHeight - innerHeight;
    if (bar) bar.style.transform = `scaleX(${h > 0 ? Math.min(1, scrollY / h) : 0})`;
    if (list) {
      const r = list.getBoundingClientRect(), vh = innerHeight;
      const p = Math.min(1, Math.max(0, (vh * .6 - r.top) / r.height));
      list.style.setProperty("--lp", `${(p * 100).toFixed(1)}%`);
      let best = 0, bd = Infinity;
      mods.forEach((m, i) => { const b = m.getBoundingClientRect(), d = Math.abs(b.top + b.height / 2 - vh * .5); if (d < bd) { bd = d; best = i; } });
      mods.forEach((m, i) => m.classList.toggle("on", i === best));
    }
    let cur = null;
    targets.forEach((t) => { if (t.el.getBoundingClientRect().top <= innerHeight * .42) cur = t; });
    links.forEach((a) => a.classList.toggle("active", !!cur && a === cur.a));
    ticking = false;
  }
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  addEventListener("resize", onScroll);
  onScroll();

  // 首屏森林：滑鼠移動時的微幅視差
  const hero = doc.querySelector(".hero");
  if (hero && !reduce && matchMedia("(pointer:fine)").matches) {
    hero.addEventListener("pointermove", (e) => {
      const r = hero.getBoundingClientRect();
      hero.style.setProperty("--motion-x", `${((e.clientX - r.left) / r.width - .5) * 22}px`);
      hero.style.setProperty("--motion-y", `${((e.clientY - r.top) / r.height - .5) * 16}px`);
    });
    hero.addEventListener("pointerleave", () => {
      hero.style.setProperty("--motion-x", "0px");
      hero.style.setProperty("--motion-y", "0px");
    });
  }

  // 光暈邊框：跟著滑鼠或手指
  doc.querySelectorAll(".gcard").forEach((c) => {
    const mv = (e) => { const r = c.getBoundingClientRect(); c.style.setProperty("--mx", `${e.clientX - r.left}px`); c.style.setProperty("--my", `${e.clientY - r.top}px`); };
    c.addEventListener("pointermove", mv);
    c.addEventListener("pointerdown", mv);
  });

  // 手機固定報名鈕：離開首屏後出現，進入報名區就收起
  const mcta = doc.getElementById("mcta"), reg = doc.getElementById("registration");
  if (mcta && hero && reg && "IntersectionObserver" in window) {
    const vis = { hero: true, reg: false };
    const sync = () => mcta.classList.toggle("show", !vis.hero && !vis.reg);
    new IntersectionObserver((e) => { vis.hero = e[0].isIntersecting; sync(); }, { threshold: .35 }).observe(hero);
    new IntersectionObserver((e) => { vis.reg = e[0].isIntersecting; sync(); }, { threshold: .15 }).observe(reg);
  }
})();
