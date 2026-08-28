(() => {
  const navs = Array.from(document.querySelectorAll(".global-site-nav"));
  if (!navs.length) return;

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
