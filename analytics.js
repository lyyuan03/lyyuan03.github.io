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

  const loadScript = (src, id) => {
    if (id && document.getElementById(id)) return;
    const script = document.createElement("script");
    script.async = true;
    script.src = src;
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
    fixBookCovers();
    trackPageType();
    trackReading();
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
