(() => {
  const navs = Array.from(document.querySelectorAll(".global-site-nav"));
  if (!navs.length) return;

  const normalizedPath = (value) => {
    let path = String(value || "/").split("?")[0].split("#")[0];
    if (path.endsWith("/index.html")) path = path.slice(0, -10) || "/";
    return path;
  };

  const currentPath = normalizedPath(window.location.pathname);

  const installNamingPageShell = () => {
    if (currentPath !== "/services/naming.html") return;

    import("/site-auth-nav.js?v=20260804-strict-wellness-1").catch((error) => {
      console.warn("命名頁會員登入列載入失敗", error);
    });

    const footer = document.querySelector("footer");
    if (footer && !document.getElementById("site-canonical-footer")) {
      footer.outerHTML = `
        <footer id="site-canonical-footer">
          <div class="site-footer-container">
            <div class="site-footer-inner">
              <img class="site-footer-brand-mark" src="/assets/footer-logo-gold.svg?v=20260721-1" alt="靈元院">
              <div class="site-footer-links">
                <a href="https://www.facebook.com/share/18zfvhPkBF/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer" aria-label="Facebook"><svg width="28" height="28" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="14" r="12.5" stroke="currentColor" stroke-width="1.2"/><path d="M15.5 9h-1.8c-.6 0-1 .4-1 1v1.5H11v2h1.7V19h2.2v-5.5h1.6l.3-2h-1.9V10.2c0-.3.1-.4.5-.4H16.5V9z" fill="currentColor"/></svg></a>
                <a href="https://www.instagram.com/lyyuan03/" target="_blank" rel="noopener noreferrer" aria-label="Instagram"><svg width="28" height="28" viewBox="0 0 28 28" fill="none"><rect x="7" y="7" width="14" height="14" rx="4" stroke="currentColor" stroke-width="1.2"/><circle cx="14" cy="14" r="3.5" stroke="currentColor" stroke-width="1.2"/><circle cx="18.2" cy="9.8" r="0.9" fill="currentColor"/></svg></a>
                <a href="https://www.youtube.com/@lyyuan03" target="_blank" rel="noopener noreferrer" aria-label="YouTube"><svg width="28" height="28" viewBox="0 0 28 28" fill="none"><rect x="4.5" y="8" width="19" height="12" rx="3.5" stroke="currentColor" stroke-width="1.2"/><path d="M12 11.5l5 2.5-5 2.5V11.5z" fill="currentColor"/></svg></a>
                <a href="https://t.me/lyyuan_channel" target="_blank" rel="noopener noreferrer" aria-label="Telegram"><svg width="28" height="28" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="14" r="12.5" stroke="currentColor" stroke-width="1.2"/><path d="M8 14l3 2.5 2-4 5-4-4 8-1.5-2L8 14z" stroke="currentColor" stroke-width="1" stroke-linejoin="round" fill="none"/><path d="M11 16.5l6.5-6.5" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg></a>
                <a href="mailto:lyyuan03@gmail.com" aria-label="Email"><svg width="28" height="28" viewBox="0 0 28 28" fill="none"><rect x="5" y="8.5" width="18" height="12" rx="1.5" stroke="currentColor" stroke-width="1.2"/><path d="M5.5 9.5l8 6.5 8-6.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path d="M14 7.5 C14 5.5 17 5.5 17 7.5" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg></a>
              </div>
              <p class="site-footer-copy">© 2026 靈元院 Ling Yuan Yuan &nbsp;·&nbsp; 修心在己</p>
            </div>
          </div>
        </footer>`;
    }

    if (!document.getElementById("site-canonical-footer-style")) {
      const style = document.createElement("style");
      style.id = "site-canonical-footer-style";
      style.textContent = `
        #site-canonical-footer{background:rgba(6,9,5,.95);border-top:1px solid rgba(165,130,84,.1);padding:36px 0 28px;color:#F5F0E8}
        #site-canonical-footer .site-footer-container{max-width:1080px;margin:0 auto;padding:0 24px}
        #site-canonical-footer .site-footer-inner{display:flex;flex-direction:column;align-items:center;gap:14px}
        #site-canonical-footer .site-footer-brand-mark{display:block;width:128px;max-width:34vw;height:auto;margin:0 auto 2px;opacity:.64;filter:saturate(.72) brightness(.78)}
        #site-canonical-footer .site-footer-links{display:flex;gap:28px;flex-wrap:wrap;justify-content:center}
        #site-canonical-footer .site-footer-links a{color:rgba(245,240,232,.38);display:flex;transition:color .2s,transform .2s}
        #site-canonical-footer .site-footer-links a:hover{color:#A58254;transform:translateY(-2px)}
        #site-canonical-footer .site-footer-links svg{display:block}
        #site-canonical-footer .site-footer-copy{margin:0;font-size:11px;color:rgba(245,240,232,.2);letter-spacing:.12em}
        @media(max-width:560px){#site-canonical-footer .site-footer-brand-mark{width:112px;max-width:38vw}}
      `;
      document.head.appendChild(style);
    }
  };

  installNamingPageShell();

  const pruneUnfinishedServiceItems = (services) => {
    if (!services) return;
    services.querySelectorAll("a").forEach((link) => {
      const href = link.getAttribute("href") || "";
      if (href.includes("#deity-birthday") || href.includes("#chanting-blessing")) {
        link.closest("li")?.remove();
      }
    });
  };

  navs.forEach((nav) => {
    if (!nav.querySelector("#global-nav-services")) {
      const articleTrigger = nav.querySelector('[aria-controls="global-nav-articles"]');
      const articleItem = articleTrigger?.closest(".global-nav-item");
      const item = document.createElement("li");
      item.className = "global-nav-item";
      item.innerHTML = `
        <button class="global-nav-trigger" type="button" aria-haspopup="true" aria-expanded="false" aria-controls="global-nav-services">信眾服務</button>
        <ul class="global-nav-dropdown" id="global-nav-services">
          <li><a href="/services/">服務總覽</a></li>
          <li><a href="/services/naming.html">靈乩神示命名</a></li>
        </ul>`;
      if (articleItem) articleItem.before(item);
      else nav.querySelector(".global-nav-links")?.appendChild(item);
    }

    const services = nav.querySelector("#global-nav-services");
    pruneUnfinishedServiceItems(services);
    if (services && currentPath.startsWith("/services")) {
      services.closest(".global-nav-item")?.querySelector(":scope > .global-nav-trigger")?.classList.add("is-active");
      services.querySelectorAll("a").forEach((link) => {
        const target = normalizedPath(new URL(link.href, window.location.origin).pathname);
        if ((currentPath === "/services/" || currentPath === "/services") && (target === "/services/" || target === "/services")) {
          link.setAttribute("aria-current", "page");
        } else if (currentPath === "/services/naming.html" && target === "/services/naming.html") {
          link.setAttribute("aria-current", "page");
        }
      });
    }
  });

  const closeNav = (nav, except = null) => {
    nav.querySelectorAll(".global-nav-item.is-open").forEach((item) => {
      if (item === except) return;
      item.classList.remove("is-open");
      item.querySelector(":scope > .global-nav-trigger")?.setAttribute("aria-expanded", "false");
    });
  };

  navs.forEach((nav) => {
    nav.querySelectorAll(".global-nav-trigger").forEach((trigger) => {
      const item = trigger.closest(".global-nav-item");
      if (!item) return;

      trigger.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const willOpen = !item.classList.contains("is-open");
        closeNav(nav, item);
        item.classList.toggle("is-open", willOpen);
        trigger.setAttribute("aria-expanded", String(willOpen));
      });

      trigger.addEventListener("keydown", (event) => {
        if (event.key !== "ArrowDown") return;
        event.preventDefault();
        closeNav(nav, item);
        item.classList.add("is-open");
        trigger.setAttribute("aria-expanded", "true");
        item.querySelector(".global-nav-dropdown a")?.focus();
      });
    });

    nav.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      const openItem = nav.querySelector(".global-nav-item.is-open");
      const trigger = openItem?.querySelector(":scope > .global-nav-trigger");
      closeNav(nav);
      trigger?.focus();
    });

    nav.addEventListener("focusout", (event) => {
      if (event.relatedTarget && nav.contains(event.relatedTarget)) return;
      closeNav(nav);
    });
  });

  document.addEventListener("click", () => navs.forEach((nav) => closeNav(nav)));
})();
