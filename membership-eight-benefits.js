(() => {
  "use strict";

  const applyEightBenefits = () => {
    const benefitsSection = document.querySelector("#benefits");
    if (!benefitsSection) return;

    const heading = benefitsSection.querySelector(".section-heading h2");
    if (heading) heading.textContent = "新版會員八大權益";

    const benefitsGrid = benefitsSection.querySelector(".benefits");
    if (!benefitsGrid) return;

    let benefit = benefitsGrid.querySelector('[data-benefit="member-center"]');
    if (!benefit) {
      benefit = document.createElement("article");
      benefit.className = "benefit";
      benefit.dataset.benefit = "member-center";
      benefitsGrid.appendChild(benefit);
    }

    benefit.innerHTML = `
      <span class="number">BENEFIT 08</span>
      <h3>專屬會員中心</h3>
    `;

    if (!document.getElementById("membership-eight-benefits-style")) {
      const style = document.createElement("style");
      style.id = "membership-eight-benefits-style";
      style.textContent = `
        #benefits .benefit:nth-child(n+5),
        #benefits .benefit:last-child {
          grid-column: span 3;
        }
        #benefits .benefit[data-benefit="member-center"] {
          background: linear-gradient(145deg, #91877D, #6B625A);
          color: #F5F0E8;
        }
        @media (max-width: 900px) {
          #benefits .benefit:nth-child(n+5),
          #benefits .benefit:last-child {
            grid-column: auto;
          }
        }
      `;
      document.head.appendChild(style);
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyEightBenefits, { once: true });
  } else {
    applyEightBenefits();
  }
})();
