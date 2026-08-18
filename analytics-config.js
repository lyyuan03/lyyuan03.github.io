/*
 * 靈元院網站分析設定
 *
 * 建立 Google Tag Manager 容器後，將下方空字串改成 GTM-XXXXXXX。
 * 若暫時只使用 GA4，也可填入 measurementId（G-XXXXXXXXXX）。
 */
window.LYY_ANALYTICS_CONFIG = Object.freeze({
  gtmId: "",
  measurementId: ""
});

if (location.pathname.endsWith("/books.html")) {
  const latestBookScript = document.createElement("script");
  latestBookScript.src = "/books-latest-feature-2026.js?v=20260807-1505";
  latestBookScript.defer = true;
  document.head.appendChild(latestBookScript);
}

if (location.pathname.endsWith("/articles.html")) {
  // 必須在 body/footer 解析前就固定頁尾 Logo 尺寸，避免重新載入時先以 SVG 原始尺寸放大閃現。
  if (!document.getElementById("articles-footer-logo-first-paint")) {
    const footerLogoFirstPaintStyle = document.createElement("style");
    footerLogoFirstPaintStyle.id = "articles-footer-logo-first-paint";
    footerLogoFirstPaintStyle.textContent = `
      .footer-brand-mark {
        display: block;
        width: 128px;
        max-width: 34vw;
        height: auto;
        opacity: .64;
        filter: saturate(.72) brightness(.78);
      }
    `;
    document.head.appendChild(footerLogoFirstPaintStyle);
  }

  const filterScript = document.createElement("script");
  filterScript.src = "/article-filter-fix.js?v=20260730-1";
  filterScript.defer = true;
  document.head.appendChild(filterScript);

  const tocPolicyScript = document.createElement("script");
  tocPolicyScript.src = "/article-toc-policy.js?v=20260730-1";
  tocPolicyScript.defer = true;
  document.head.appendChild(tocPolicyScript);

  const eventDiagnosticsScript = document.createElement("script");
  eventDiagnosticsScript.type = "module";
  eventDiagnosticsScript.src = "/event-access-diagnostics-v2.js?v=20260803-2";
  document.head.appendChild(eventDiagnosticsScript);

  const mobileNavFixScript = document.createElement("script");
  mobileNavFixScript.src = "/article-mobile-nav-fix.js?v=20260809-1";
  mobileNavFixScript.defer = true;
  document.head.appendChild(mobileNavFixScript);
}

if (location.pathname.endsWith("/admin.html")) {
  const accessAuditScript = document.createElement("script");
  accessAuditScript.type = "module";
  accessAuditScript.src = "/activity-access-audit-v2.js?v=20260803-2";
  document.head.appendChild(accessAuditScript);

  const emailAccessCheckScript = document.createElement("script");
  emailAccessCheckScript.type = "module";
  emailAccessCheckScript.src = "/activity-email-access-check.js?v=20260804-1";
  document.head.appendChild(emailAccessCheckScript);
}

if (location.pathname.endsWith("/fahui.html")) {
  const registrationClosedScript = document.createElement("script");
  registrationClosedScript.src = "/fahui-registration-closed.js?v=20260803-1";
  registrationClosedScript.defer = true;
  document.head.appendChild(registrationClosedScript);
}

if (location.pathname.endsWith("/membership.html")) {
  const eightBenefitsScript = document.createElement("script");
  eightBenefitsScript.src = "/membership-eight-benefits.js?v=20260803-2";
  eightBenefitsScript.defer = true;
  document.head.appendChild(eightBenefitsScript);
}

if (location.pathname.endsWith("/yaochi-event-v2.html")) {
  const pilgrimageMotionStyle = document.createElement("style");
  pilgrimageMotionStyle.id = "yaochi-pilgrimage-calm-motion";
  pilgrimageMotionStyle.textContent = `
    .pilgrimage-invite.motion-visible {
      position: relative;
      overflow: hidden;
      isolation: isolate;
      border: 1px solid rgba(224,173,85,.30) !important;
      background: linear-gradient(135deg,rgba(224,173,85,.13),rgba(96,99,48,.10)) !important;
      animation: none !important;
      box-shadow: none;
    }
    .pilgrimage-invite.motion-visible::after {
      content: '';
      position: absolute;
      z-index: 0;
      top: -45%;
      bottom: -45%;
      left: -32%;
      width: 28%;
      pointer-events: none;
      background: linear-gradient(90deg,transparent,rgba(255,236,196,.24),transparent);
      filter: blur(2px);
      transform: translateX(-220%) skewX(-16deg);
      opacity: 0;
      animation: pilgrimageSweepCalm 14s ease-in-out infinite;
    }
    .pilgrimage-invite.motion-visible > * {
      position: relative;
      z-index: 1;
    }
    @keyframes pilgrimageSweepCalm {
      0%, 82% {
        transform: translateX(-220%) skewX(-16deg);
        opacity: 0;
      }
      84% {
        opacity: .38;
      }
      96% {
        transform: translateX(520%) skewX(-16deg);
        opacity: .22;
      }
      100% {
        transform: translateX(520%) skewX(-16deg);
        opacity: 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .pilgrimage-invite.motion-visible::after {
        animation: none !important;
        opacity: 0 !important;
      }
    }
  `;
  document.head.appendChild(pilgrimageMotionStyle);

  const witnessStyle = document.createElement("style");
  witnessStyle.id = "yaochi-building-witness-style";
  witnessStyle.textContent = `
    .building-witness {
      position: relative;
      overflow: hidden;
      isolation: isolate;
      margin-top: 8px;
      padding: 38px 36px 34px;
      border: 1px solid rgba(210,178,124,.44);
      border-radius: 12px;
      background:
        linear-gradient(135deg,rgba(9,18,11,.88) 0%,rgba(17,29,18,.84) 48%,rgba(8,16,10,.92) 100%),
        url("/assets/yaochi-building-witness-20260818.webp?v=20260818-1") 58% center / cover no-repeat;
      box-shadow: 0 18px 42px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,236,199,.06);
    }
    .building-witness::after {
      content: '';
      position: absolute;
      inset: 0;
      z-index: 0;
      pointer-events: none;
      background: radial-gradient(circle at 20% 12%,rgba(203,169,112,.13),transparent 38%), linear-gradient(180deg,rgba(4,10,6,.05),rgba(4,10,6,.22));
    }
    .building-witness > * {
      position: relative;
      z-index: 1;
    }
    .building-witness-head {
      max-width: 760px;
      margin: 0 auto 26px;
      text-align: center;
    }
    .building-witness-head span {
      display: block;
      margin-bottom: 7px;
      color: #d4b77f;
      font-size: 11px;
      letter-spacing: .20em;
    }
    .building-witness-head h3 {
      margin: 0 0 11px;
      color: #fff0d5;
      font-family: var(--serif);
      font-size: 30px;
      font-weight: 500;
      letter-spacing: .08em;
      text-shadow: 0 2px 16px rgba(0,0,0,.36);
    }
    .building-witness-head p {
      margin: 0;
      color: rgba(252,248,240,.90);
      font-size: 15.5px;
      line-height: 1.9;
      text-shadow: 0 1px 10px rgba(0,0,0,.48);
    }
    .building-witness-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .witness-card {
      padding: 25px 24px 23px;
      border: 1px solid rgba(214,184,132,.34);
      border-radius: 9px;
      background: linear-gradient(145deg,rgba(14,25,16,.84),rgba(10,18,12,.79));
      -webkit-backdrop-filter: blur(3px);
      backdrop-filter: blur(3px);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.035), 0 8px 20px rgba(0,0,0,.10);
    }
    .witness-card.premium {
      border-color: rgba(224,173,85,.56);
      background: linear-gradient(145deg,rgba(71,57,30,.78),rgba(21,31,18,.84));
    }
    .witness-card small {
      display: block;
      margin-bottom: 6px;
      color: #d0c28e;
      font-size: 11px;
      letter-spacing: .14em;
    }
    .witness-card.premium small { color: #edc77b; }
    .witness-card h4 {
      margin: 0 0 10px;
      color: #fff0d8;
      font-family: var(--serif);
      font-size: 22px;
      font-weight: 500;
      letter-spacing: .06em;
      text-shadow: 0 1px 10px rgba(0,0,0,.30);
    }
    .witness-card p {
      margin: 0 0 9px;
      color: rgba(252,248,240,.86);
      font-size: 14.5px;
      line-height: 1.85;
      text-shadow: 0 1px 8px rgba(0,0,0,.34);
    }
    .witness-card p:last-child { margin-bottom: 0; }
    .witness-card strong { color: #ffdca2; font-weight: 500; }
    @media (max-width: 700px) {
      .building-witness {
        padding: 28px 20px 25px;
        background-position: 64% center;
      }
      .building-witness-head { margin-bottom: 22px; }
      .building-witness-head h3 { font-size: 26px; }
      .building-witness-head p { color: rgba(252,248,240,.92); }
      .building-witness-grid { grid-template-columns: 1fr; }
      .witness-card { padding: 22px 19px 21px; background: linear-gradient(145deg,rgba(12,23,15,.88),rgba(8,16,10,.84)); }
      .witness-card.premium { background: linear-gradient(145deg,rgba(66,52,27,.84),rgba(17,28,16,.88)); }
    }
  `;
  document.head.appendChild(witnessStyle);

  const installBuildingWitness = () => {
    if (document.getElementById("building-witness")) return;
    const notice = document.querySelector("#items .common-notice-block");
    if (!notice) return;

    const witness = document.createElement("section");
    witness.id = "building-witness";
    witness.className = "building-witness";
    witness.setAttribute("aria-labelledby", "building-witness-title");
    witness.innerHTML = `
      <div class="building-witness-head">
        <span>建院願心見證</span>
        <h3 id="building-witness-title">一念護持・共同見證</h3>
        <p>凡本次法會登記護持者，皆可獲邀以 Gmail 帳號登入「靈元院建院願心見證專頁」，持續了解目前建院進度、重要規劃與各階段推動情形，共同見證靈元院一步一步從願心走向成就。</p>
      </div>
      <div class="building-witness-grid">
        <article class="witness-card">
          <small>所有本次法會護持者</small>
          <h4>建院願心見證專頁</h4>
          <p>持續掌握建院進度、重要規劃與各階段推動情形，看見每一份護持如何逐步成為道場的一部分。</p>
        </article>
        <article class="witness-card premium">
          <small>丙午建院總功德主・專屬閱覽</small>
          <h4>更完整的建院紀錄</h4>
          <p>登記本次<strong>「丙午建院總功德主」</strong>者，將可進一步閱覽更完整的建院紀錄。</p>
          <p>並可觀看由<strong>宇色老師親自說明</strong>目前建院所面對的重要課題、推進方向與下一階段規劃。</p>
          <p>這不只是一份進度公開，更希望讓每一位發心護持者，都能清楚看見自己的願心，正在如何實際成就靈元院的建院聖業。</p>
        </article>
      </div>`;

    notice.insertAdjacentElement("afterend", witness);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installBuildingWitness, { once: true });
  } else {
    installBuildingWitness();
  }
}