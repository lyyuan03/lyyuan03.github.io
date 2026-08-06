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

    if (location.pathname.endsWith("/books.html") && (/購書|購買|簽名書/.test(text) || isExternal)) {
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
      #latest-book-2026{position:relative;overflow:hidden;padding:66px 0;background:linear-gradient(145deg,#090b08 0%,#17150f 48%,#0b0d09 100%);border-top:1px solid rgba(197,162,111,.24);border-bottom:1px solid rgba(197,162,111,.24)}
      #latest-book-2026:before{content:'';position:absolute;inset:-35%;background:radial-gradient(circle,rgba(197,162,111,.14),transparent 58%);animation:latestBookAura 7s ease-in-out infinite}
      #latest-book-2026 .latest-book-frame{position:relative;z-index:1;display:grid;grid-template-columns:minmax(280px,400px) minmax(0,1fr);gap:68px;align-items:center;max-width:1040px;margin:auto;padding:50px 58px;border:1px solid rgba(197,162,111,.44);background:linear-gradient(135deg,rgba(255,255,255,.035),rgba(165,130,84,.08));box-shadow:0 28px 70px rgba(0,0,0,.34),inset 0 0 46px rgba(165,130,84,.04)}
      #latest-book-2026 .latest-book-cover{display:block;position:relative;max-width:390px;margin:auto;transition:transform .35s ease,filter .35s ease}
      #latest-book-2026 .latest-book-cover:hover{transform:translateY(-7px);filter:brightness(1.06)}
      #latest-book-2026 .latest-book-cover img{display:block;width:100%;height:auto;max-height:560px;object-fit:contain;filter:drop-shadow(0 24px 30px rgba(0,0,0,.45))}
      #latest-book-2026 .latest-book-kicker{display:inline-flex;align-items:center;gap:10px;margin-bottom:18px;padding:7px 14px;border:1px solid rgba(217,183,119,.58);color:#d9b777;font-family:var(--sans);font-size:12px;letter-spacing:.22em}
      #latest-book-2026 .latest-book-kicker:before{content:'✦';font-size:10px}
      #latest-book-2026 h2{margin:0 0 18px;color:#f2dfbd;font-family:var(--serif);font-size:42px;line-height:1.45;letter-spacing:.12em;font-weight:400}
      #latest-book-2026 .latest-book-subtitle{max-width:570px;margin:0 0 15px;color:rgba(245,240,232,.82);font-family:var(--serif);font-size:20px;line-height:2;letter-spacing:.07em}
      #latest-book-2026 .latest-book-copy{max-width:600px;margin:0 0 28px;color:rgba(245,240,232,.58);font-size:14px;line-height:2}
      #latest-book-2026 .latest-book-button{display:inline-block;padding:13px 32px;border:1px solid rgba(217,183,119,.72);background:linear-gradient(135deg,#a58254,#c5a26f,#a58254);color:#171109;font-family:var(--serif);font-size:15px;letter-spacing:.16em;box-shadow:0 12px 28px rgba(0,0,0,.24);transition:transform .25s ease,box-shadow .25s ease}
      #latest-book-2026 .latest-book-button:hover{transform:translateY(-3px);box-shadow:0 16px 34px rgba(0,0,0,.34)}
      @keyframes latestBookAura{0%,100%{transform:translate3d(-2%,0,0);opacity:.68}50%{transform:translate3d(3%,-2%,0);opacity:1}}
      @media(max-width:820px){
        #latest-book-2026{padding:34px 0}
        #latest-book-2026 .latest-book-frame{grid-template-columns:1fr;gap:34px;margin:0 18px;padding:34px 24px;text-align:center}
        #latest-book-2026 .latest-book-cover{max-width:330px}
        #latest-book-2026 h2{font-size:31px;line-height:1.5}
        #latest-book-2026 .latest-book-subtitle{font-size:17px;margin-left:auto;margin-right:auto}
        #latest-book-2026 .latest-book-copy{margin-left:auto;margin-right:auto}
      }
    `;
    document.head.appendChild(style);

    const section = document.createElement("section");
    section.id = "latest-book-2026";
    section.setAttribute("aria-labelledby", "latest-book-2026-title");
    section.innerHTML = `
      <div class="wrap">
        <div class="latest-book-frame">
          <a class="latest-book-cover" href="https://www.books.com.tw/products/0011060075?sloc=main" target="_blank" rel="noopener noreferrer" aria-label="前往博客來購買《我在人間的元神覺醒》">
            <img src="https://www.books.com.tw/img/001/106/00/0011060075.jpg" alt="《我在人間的元神覺醒》書封" loading="eager" referrerpolicy="no-referrer">
          </a>
          <div class="latest-book-content">
            <div class="latest-book-kicker">2026 年度重磅新作</div>
            <h2 id="latest-book-2026-title">我在人間的元神覺醒</h2>
            <p class="latest-book-subtitle">靈修這些年走過的彎路、看清的陷阱、體悟到的核心原則</p>
            <p class="latest-book-copy">重新理解元神、靈脈、靈格，以及啟靈之後必須面對的生命課題。這不只是一部靈修經驗之書，更是一張協助修行者辨識方向、遠離迷失的生命地圖。</p>
            <a class="latest-book-button" href="https://www.books.com.tw/products/0011060075?sloc=main" target="_blank" rel="noopener noreferrer">立即前往博客來</a>
          </div>
        </div>
      </div>`;

    target.parentNode.insertBefore(section, target);
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
    fixBookCovers();
    trackPageType();
    trackReading();
    loadSponsorCheckout();
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
