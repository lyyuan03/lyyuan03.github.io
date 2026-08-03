(() => {
  "use strict";

  const applyEightBenefits = () => {
    const benefitsSection = document.querySelector("#benefits");
    if (!benefitsSection) return;

    const heading = benefitsSection.querySelector(".section-heading h2");
    if (heading) heading.textContent = "新版會員八大權益";

    const benefitsGrid = benefitsSection.querySelector(".benefits");
    if (!benefitsGrid) return;

    if (!benefitsGrid.querySelector('[data-benefit="member-center"]')) {
      const benefit = document.createElement("article");
      benefit.className = "benefit";
      benefit.dataset.benefit = "member-center";
      benefit.innerHTML = `
        <span class="number">BENEFIT 08</span>
        <h3>專屬會員中心</h3>
        <p>登入後可查閱個人會員資格、有效期限與專屬權益。</p>
      `;
      benefitsGrid.appendChild(benefit);
    }

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
        #benefits .benefit[data-benefit="member-center"] p {
          margin: 10px 0 0;
          color: inherit;
          font-size: 14px;
          line-height: 1.8;
          letter-spacing: .04em;
          opacity: .86;
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
