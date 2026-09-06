(() => {
  const navs = Array.from(document.querySelectorAll(".global-site-nav"));
  if (!navs.length) return;

  const normalizedPath = (value) => {
    let path = String(value || "/").split("?")[0].split("#")[0];
    if (path.endsWith("/index.html")) path = path.slice(0, -10) || "/";
    return path;
  };

  const currentPath = normalizedPath(window.location.pathname);

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
