(() => {
  "use strict";

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

    if (!document.getElementById("fahui-registration-closed-style")) {
      const style = document.createElement("style");
      style.id = "fahui-registration-closed-style";
      style.textContent = `
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
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyRegistrationClosedState, { once: true });
  } else {
    applyRegistrationClosedState();
  }
})();
