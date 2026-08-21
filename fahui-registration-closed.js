(() => {
  "use strict";

  const ensureStyles = () => {
    if (document.getElementById("fahui-registration-state-style")) return;

    const style = document.createElement("style");
    style.id = "fahui-registration-state-style";
    style.textContent = `
      /* 8/29：靈元院 CIS 主色｜深棕 #594F47、墨綠 #606330、金棕 #A58254 */
      .announcement-item.featured.cis-featured {
        background: linear-gradient(135deg, #594F47 0%, #606330 62%, #A58254 100%) !important;
        border: 1px solid rgba(165, 130, 84, .9) !important;
        box-shadow: 0 14px 42px rgba(0, 0, 0, .32), 0 0 0 1px rgba(245, 240, 232, .08) inset !important;
      }
      .announcement-item.featured.cis-featured .announcement-thumb {
        filter: saturate(.92) brightness(.92) !important;
      }
      .announcement-item.featured.cis-featured .announcement-meta {
        color: #D9C29E !important;
        text-shadow: none !important;
      }
      .announcement-item.featured.cis-featured .announcement-body h3 {
        color: #F5F0E8 !important;
        text-shadow: 0 2px 14px rgba(0, 0, 0, .22) !important;
      }
      .announcement-item.featured.cis-featured .announcement-btn.upcoming-btn {
        background: #A58254 !important;
        color: #F5F0E8 !important;
        border: 1px solid rgba(245, 240, 232, .3) !important;
        box-shadow: 0 4px 14px rgba(0, 0, 0, .18) !important;
        cursor: pointer !important;
        pointer-events: auto !important;
        opacity: 1 !important;
      }
      .announcement-item.featured.cis-featured .announcement-btn.upcoming-btn:hover {
        transform: translateY(-2px) !important;
        box-shadow: 0 6px 22px rgba(165, 130, 84, .46) !important;
      }

      /* 8/1：報名截止維持灰階 */
      .announcement-item.registration-closed {
        background: rgba(205, 205, 200, .94) !important;
        border-color: rgba(105, 105, 100, .42) !important;
        box-shadow: 0 8px 28px rgba(0, 0, 0, .18) !important;
        filter: grayscale(1);
        opacity: .82;
      }
      .announcement-item.registration-closed .announcement-thumb {
        filter: grayscale(1) brightness(.72) !important;
      }
      .announcement-item.registration-closed .announcement-meta {
        color: #777 !important;
        text-shadow: none !important;
      }
      .announcement-item.registration-closed .announcement-body h3 {
        color: #555 !important;
      }
      .announcement-item.registration-closed .announcement-btn.disabled {
        background: #858581 !important;
        color: #eeeeeb !important;
        border: 1px solid #74746f !important;
        box-shadow: none !important;
        cursor: default !important;
        pointer-events: none !important;
        transform: none !important;
      }
    `;
    document.head.appendChild(style);
  };

  const applyUpcomingState = () => {
    const eventCards = Array.from(document.querySelectorAll(".announcement-item"));
    const targetCard = eventCards.find((card) =>
      card.querySelector("h3")?.textContent.includes("無極瑤池金母聖誕祝壽暨解冤赦業法儀")
    );

    if (!targetCard) return;

    targetCard.classList.add("cis-featured");

    let action = targetCard.querySelector(".announcement-action");
    if (!action) {
      action = document.createElement("div");
      action.className = "announcement-action";
      targetCard.querySelector(".announcement-body")?.appendChild(action);
    }

    if (action && !action.querySelector(".upcoming-btn")) {
      const button = document.createElement("a");
      button.className = "announcement-btn upcoming-btn";
      button.textContent = "開放報名";
      button.href = "https://lyyuan.tw/yaochi-event-v2.html";
      action.appendChild(button);
    }
  };

  const applyRegistrationClosedState = () => {
    const eventCards = Array.from(document.querySelectorAll(".announcement-item"));
    const targetCard = eventCards.find((card) =>
      card.querySelector("h3")?.textContent.includes("觀世音菩薩成道日")
    );

    if (!targetCard) return;

    targetCard.classList.add("registration-closed");

    const button = targetCard.querySelector(".announcement-btn");
    if (button) {
      button.textContent = "報名截止";
      button.classList.add("disabled");
      button.removeAttribute("href");
      button.removeAttribute("target");
      button.setAttribute("aria-disabled", "true");
      button.setAttribute("tabindex", "-1");
    }
  };

  const repairArticleNavigation = () => {
    const articleTrigger = Array.from(document.querySelectorAll(".nav-links > li > span.has-dropdown"))
      .find((item) => item.textContent.trim() === "文選");
    const menu = articleTrigger?.closest("li")?.querySelector(".dropdown");

    if (!menu) return;

    const articleLinks = [
      ["靈．修行", "articles.html?category=spiritual"],
      ["人．俗世", "articles.html?category=worldly"],
      ["異．靈界", "articles.html?category=spirit-world"],
      ["思．讀物", "articles.html?category=reading"]
    ];

    menu.replaceChildren(
      ...articleLinks.map(([label, href]) => {
        const listItem = document.createElement("li");
        const link = document.createElement("a");
        link.href = href;
        link.textContent = label;
        listItem.appendChild(link);
        return listItem;
      })
    );
  };

  const applyPageState = () => {
    ensureStyles();
    applyUpcomingState();
    applyRegistrationClosedState();
    repairArticleNavigation();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyPageState, { once: true });
  } else {
    applyPageState();
  }
})();
