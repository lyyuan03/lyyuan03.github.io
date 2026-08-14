(() => {
  "use strict";

  window.dataLayer = window.dataLayer || [];

  const push = (event, parameters = {}) => {
    window.dataLayer.push({
      event,
      page_path: location.pathname + location.search,
      page_title: document.title,
      ...parameters
    });
  };

  window.lyyuanTrack = push;

  const loadScript = (src, id, type = "") => {
    if (id && document.getElementById(id)) return;
    const script = document.createElement("script");
    script.async = true;
    script.src = src;
    if (type) script.type = type;
    if (id) script.id = id;
    document.head.appendChild(script);
  };

  const loadGoogleAnalytics = () => {
    const config = window.LYY_ANALYTICS_CONFIG || {};
    const gtmId = String(config.gtmId || "").trim();
    const measurementId = String(config.measurementId || "").trim();

    if (/^GTM-[A-Z0-9]+$/i.test(gtmId)) {
      window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
      loadScript(`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(gtmId)}`, "lyyuan-gtm");
      return;
    }

    if (/^G-[A-Z0-9]+$/i.test(measurementId)) {
      window.gtag = function gtag() { window.dataLayer.push(arguments); };
      window.gtag("js", new Date());
      window.gtag("config", measurementId, { send_page_view: true, transport_type: "beacon" });
      loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`, "lyyuan-gtag");
    }
  };

  const normalizeText = (value) => String(value || "").replace(/\s+/g, " ").trim().slice(0, 120);

  const classifyLink = (anchor) => {
    const rawHref = anchor.getAttribute("href") || "";
    if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("javascript:")) return null;

    let url;
    try { url = new URL(anchor.href, location.href); } catch { return null; }

    const text = normalizeText(anchor.dataset.analyticsLabel || anchor.getAttribute("aria-label") || anchor.textContent);
    const context = normalizeText(anchor.closest("article, section, .card, .book-rec")?.querySelector("h1,h2,h3,h4,h5")?.textContent) || text;
    const host = url.hostname.replace(/^www\./, "");
    const path = url.pathname.toLowerCase();
    const isExternal = url.origin !== location.origin;

    if (host === "books.com.tw" || host.endsWith(".books.com.tw")) {
      return { event: "click_books_com_tw", parameters: { book_name: context, link_text: text, link_url: url.href, destination_platform: "books.com.tw", button_location: location.pathname } };
    }

    if (location.pathname.endsWith("/books.html") && (/購書|購買|簽名書|預購/.test(text) || isExternal)) {
      return { event: "click_books_buy", parameters: { book_name: context, link_text: text, link_url: url.href, destination_platform: host, button_location: location.pathname } };
    }

    if (path.endsWith("/books.html")) {
      return { event: "view_books_page", parameters: { link_text: text, link_url: url.href, button_location: location.pathname } };
    }

    if (/課程/.test(text)) return { event: "click_course", parameters: { link_text: text, link_url: url.href } };
    if (/會員|登入/.test(text)) return { event: "click_membership", parameters: { link_text: text, link_url: url.href } };
    if (/報名|法會|活動/.test(text) || host === "beclass.com") return { event: "click_event_registration", parameters: { link_text: text, link_url: url.href, destination_platform: host } };
    if (isExternal) return { event: "click_external_link", parameters: { link_text: text, link_url: url.href, destination_domain: host } };
    return null;
  };

  const installLatestBookFeature = () => {
    if (!location.pathname.endsWith("/books.html")) return;
    if (document.getElementById("latest-book-2026")) return;

    const target = document.querySelector("section.sec#books");
    if (!target) return;

    const style = document.createElement("style");
    style.id = "latest-book-2026-style";
    style.textContent = `
      #latest-book-2026{position:relative;padding:58px 0 54px;background:linear-gradient(180deg,#0b100c,#070a07);border-top:1px solid rgba(197,162,111,.22);border-bottom:1px solid rgba(197,162,111,.24);color:#f5f0e8;overflow:hidden}
      #latest-book-2026:before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 50% 0,rgba(197,162,111,.09),transparent 46%);pointer-events:none}
      #latest-book-2026 .latest-book-wrap{position:relative;z-index:1;max-width:1120px;margin:auto;padding:0 24px}
      #latest-book-2026 .latest-book-head{text-align:center;max-width:820px;margin:0 auto 28px}
      #latest-book-2026 .latest-book-kicker{font-family:var(--en);font-size:12px;letter-spacing:.42em;color:#c5a26f;margin-bottom:8px}
      #latest-book-2026 h2{font-family:var(--serif);font-size:34px;font-weight:400;letter-spacing:.12em;color:#efd29d;line-height:1.5;margin:0 0 8px}
      #latest-book-2026 .latest-book-sub{font-family:var(--serif);font-size:16px;letter-spacing:.08em;color:rgba(245,240,232,.66);line-height:1.9}
      #latest-book-2026 .latest-book-media{max-width:1040px;margin:0 auto;border:1px solid rgba(197,162,111,.34);background:#030503;box-shadow:0 26px 64px rgba(0,0,0,.44);overflow:hidden;display:flex;flex-direction:column;align-items:stretch}
      #latest-book-2026 .latest-book-video{order:2;display:none;width:100%;height:auto;background:#000;aspect-ratio:16/9;object-fit:contain;border-top:1px solid rgba(197,162,111,.26)}
      #latest-book-2026 .latest-book-fallback{order:1;display:block!important;position:relative;width:100%;background:#050605;overflow:hidden}
      #latest-book-2026 .latest-book-fallback img{display:block;width:100%;height:auto;aspect-ratio:1920/755;object-fit:cover}
      #latest-book-2026 .latest-book-fallback-badge{position:absolute;left:18px;bottom:16px;padding:7px 11px;border:1px solid rgba(217,183,119,.44);background:rgba(5,7,5,.78);backdrop-filter:blur(10px);font-size:11px;letter-spacing:.14em;color:rgba(245,240,232,.78)}
      #latest-book-2026 .latest-book-actions{display:flex;justify-content:center;gap:12px;flex-wrap:wrap;margin-top:24px}
      #latest-book-2026 .latest-book-button{display:inline-flex;align-items:center;justify-content:center;min-width:250px;padding:14px 34px;border:1px solid rgba(217,183,119,.72);background:linear-gradient(135deg,#a58254,#c5a26f,#a58254);color:#171109;font-family:var(--serif);font-size:15px;letter-spacing:.16em;box-shadow:0 12px 28px rgba(0,0,0,.28);transition:transform .25s ease,box-shadow .25s ease,filter .25s ease}
      #latest-book-2026 .latest-book-button:hover{transform:translateY(-3px);box-shadow:0 16px 34px rgba(0,0,0,.38);filter:brightness(1.05)}
      .works .era.latest-era .era-year{color:#9b7242}
      .works .era.latest-era .era-book img{width:62px;height:93px;border-color:rgba(165,130,84,.52);box-shadow:0 10px 24px rgba(73,48,24,.22),0 0 0 1px rgba(197,162,111,.08)}
      .works .era.latest-era .era-book span{color:#4d3823;font-weight:500}
      @media(max-width:960px){
        .works .era.latest-era .era-book img{width:84px;height:120px;box-shadow:0 10px 22px rgba(73,48,24,.18),0 0 0 1px rgba(197,162,111,.10)}
      }
      @media(max-width:820px){
        #latest-book-2026{padding:44px 0 46px}
        #latest-book-2026 .latest-book-wrap{padding:0 16px}
        #latest-book-2026 .latest-book-head{margin-bottom:22px}
        #latest-book-2026 h2{font-size:29px;letter-spacing:.08em}
        #latest-book-2026 .latest-book-sub{font-size:15px}
        #latest-book-2026 .latest-book-media{max-width:430px;border-radius:8px}
        #latest-book-2026 .latest-book-video{aspect-ratio:608/1080;max-height:78vh}
        #latest-book-2026 .latest-book-fallback img{display:block;width:100%;max-width:100%;height:auto;min-height:0;aspect-ratio:auto;object-fit:contain;margin:0}
        #latest-book-2026 .latest-book-fallback-badge{left:12px;bottom:10px;font-size:10px}
        #latest-book-2026 .latest-book-button{width:100%;max-width:360px;min-width:0;padding:14px 20px}
      }
    `;
    document.head.appendChild(style);

    const section = document.createElement("section");
    section.id = "latest-book-2026";
    section.setAttribute("aria-label", "2026 新書《我在人間的元神覺醒》");
    section.innerHTML = `
      <div class="latest-book-wrap">
        <div class="latest-book-head">
          <div class="latest-book-kicker">2026 NEW RELEASE</div>
          <h2>《我在人間的元神覺醒》</h2>
          <p class="latest-book-sub">宇色最新靈修著作｜新書形象影片</p>
        </div>
        <div class="latest-book-media">
          <video class="latest-book-video" controls playsinline preload="metadata" aria-label="《我在人間的元神覺醒》新書宣傳影片"></video>
          <a class="latest-book-fallback" href="https://www.books.com.tw/products/0011060075?sloc=main" target="_blank" rel="noopener noreferrer" aria-label="前往博客來預購《我在人間的元神覺醒》">
            <img id="latest-book-2026-banner-image" alt="《我在人間的元神覺醒》2026 新書 Banner" loading="eager">
            <span class="latest-book-fallback-badge">NEW BOOK · 2026</span>
          </a>
        </div>
        <div class="latest-book-actions">
          <a class="latest-book-button" href="https://www.books.com.tw/products/0011060075?sloc=main" target="_blank" rel="noopener noreferrer">前往博客來立即預購</a>
        </div>
      </div>`;

    target.insertAdjacentElement("afterend", section);

    const bannerImage = section.querySelector("#latest-book-2026-banner-image");
    const bannerParts = [
      "/assets/latest-book-2026-banner-avif-01.txt?v=20260807-0950",
      "/assets/latest-book-2026-banner-avif-02.txt?v=20260807-0950",
      "/assets/latest-book-2026-banner-avif-03.txt?v=20260807-0950",
      "/assets/latest-book-2026-banner-avif-04.txt?v=20260807-0950",
      "/assets/latest-book-2026-banner-avif-05.txt?v=20260807-0950",
      "/assets/latest-book-2026-banner-avif-06.txt?v=20260807-0950"
    ];

    Promise.all(bannerParts.map((url) => fetch(url, { cache: "no-store" }).then((response) => {
      if (!response.ok) throw new Error(`Banner load failed: ${response.status}`);
      return response.text();
    })))
      .then((parts) => {
        const cleanBase64 = parts.join("").replace(/\s+/g, "").trim();
        bannerImage.src = `data:image/avif;base64,${cleanBase64}`;
      })
      .catch(() => {
        bannerImage.alt = "《我在人間的元神覺醒》2026 新書 Banner 載入失敗";
      });

    const video = section.querySelector(".latest-book-video");
    const fallback = section.querySelector(".latest-book-fallback");
    const videoSrc = matchMedia("(max-width:820px)").matches
      ? "/assets/videos/osel-awakening-2026-mobile.mp4?v=20260813-3"
      : "/assets/videos/osel-awakening-2026-desktop.mp4?v=20260813-3";

    fetch(videoSrc, { method: "HEAD", cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(`Video unavailable: ${response.status}`);
        video.src = videoSrc;
        video.addEventListener("loadedmetadata", () => {
          video.style.display = "block";
          fallback.style.display = "none";
        }, { once: true });
        video.addEventListener("error", () => {
          video.style.display = "none";
          fallback.style.display = "block";
        }, { once: true });
        video.load();
      })
      .catch(() => {
        video.style.display = "none";
        fallback.style.display = "block";
      });
  };

  const upgradeLatestBookTimeline = () => {
    if (!location.pathname.endsWith("/books.html")) return;
    const timeline = document.getElementById("worksGrid");
    if (!timeline) return;
    const era2026 = Array.from(timeline.querySelectorAll(".era")).find((era) => era.querySelector(".era-year")?.textContent.trim() === "2026");
    if (!era2026) return;

    era2026.classList.add("latest-era");
    const books = era2026.querySelector(".era-books");
    if (!books) return;
    books.innerHTML = `
      <a class="era-book" href="https://www.books.com.tw/products/0011060075?sloc=main" target="_blank" rel="noopener noreferrer" aria-label="查看《我在人間的元神覺醒》">
        <img src="https://www.books.com.tw/img/001/106/00/0011060075.jpg" alt="《我在人間的元神覺醒》書封">
        <span>我在人間的元神覺醒</span>
      </a>`;
  };

  const fixBookCovers = () => {
    if (!location.pathname.endsWith("/books.html")) return;

    const repair = (root = document) => {
      root.querySelectorAll?.('img[src^="https://www.books.com.tw/img/"]').forEach((image) => {
        if (image.dataset.coverProxyApplied === "1") return;
        const original = image.getAttribute("src");
        if (!original) return;
        image.dataset.coverProxyApplied = "1";
        image.referrerPolicy = "no-referrer";
        image.loading = "lazy";
        image.src = `https://wsrv.nl/?url=${encodeURIComponent(original)}&w=480&output=webp&q=88`;
        image.addEventListener("error", () => {
          if (image.dataset.coverFallbackApplied === "1") return;
          image.dataset.coverFallbackApplied = "1";
          image.src = `https://images.weserv.nl/?url=${encodeURIComponent(original)}&w=480&output=jpg&q=88`;
        }, { once: true });
      });
    };

    repair();
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) repair(node);
      }));
    });
    observer.observe(document.body, { childList: true, subtree: true });
  };

  const trackPageType = () => {
    const path = location.pathname;
    if (path.endsWith("/books.html")) push("view_books_page", { page_category: "books" });
    if (path.endsWith("/articles.html") && new URLSearchParams(location.search).has("id")) {
      push("view_article_detail", { article_id: new URLSearchParams(location.search).get("id") });
    }
  };

  const trackReading = () => {
    if (!location.pathname.endsWith("/articles.html")) return;
    let sent = false;
    const onScroll = () => {
      if (sent) return;
      const max = document.documentElement.scrollHeight - innerHeight;
      if (max <= 0 || scrollY / max < 0.9) return;
      sent = true;
      push("article_read_complete", { article_id: new URLSearchParams(location.search).get("id") || "", read_threshold: 90 });
      removeEventListener("scroll", onScroll);
    };
    addEventListener("scroll", onScroll, { passive: true });
  };

  const loadSponsorCheckout = () => {
    if (!location.pathname.endsWith("/articles.html")) return;
    if (!new URLSearchParams(location.search).has("id")) return;
    loadScript("/sponsor-checkout.js?v=20260803-public-checkout-1", "lyyuan-sponsor-checkout", "module");
  };

  document.addEventListener("click", (event) => {
    const loginButton = event.target.closest("#member-login-button,[data-member-login]");
    if (loginButton) push("member_login", { button_text: normalizeText(loginButton.textContent), button_location: location.pathname });
    const anchor = event.target.closest("a[href]");
    if (!anchor) return;
    const tracking = classifyLink(anchor);
    if (tracking) push(tracking.event, tracking.parameters);
  }, true);

  loadGoogleAnalytics();

  const init = () => {
    installLatestBookFeature();
    upgradeLatestBookTimeline();
    fixBookCovers();
    trackPageType();
    trackReading();
    loadSponsorCheckout();
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
