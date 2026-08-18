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
      margin-top: 8px;
      padding: 34px 34px 32px;
      border: 1px solid rgba(200,170,123,.30);
      border-radius: 12px;
      background: linear-gradient(145deg,rgba(34,46,29,.96),rgba(18,27,18,.98));
      box-shadow: 0 14px 32px rgba(0,0,0,.16);
    }
    .building-witness-head {
      max-width: 760px;
      margin: 0 auto 24px;
      text-align: center;
    }
    .building-witness-head span {
      display: block;
      margin-bottom: 7px;
      color: #c8aa7b;
      font-size: 11px;
      letter-spacing: .20em;
    }
    .building-witness-head h3 {
      margin: 0 0 11px;
      color: #f1dec0;
      font-family: var(--serif);
      font-size: 29px;
      font-weight: 500;
      letter-spacing: .08em;
    }
    .building-witness-head p {
      margin: 0;
      color: rgba(247,242,233,.76);
      font-size: 15.5px;
      line-height: 1.9;
    }
    .building-witness-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .witness-card {
      padding: 24px 24px 22px;
      border: 1px solid rgba(200,170,123,.20);
      border-radius: 9px;
      background: rgba(255,255,255,.035);
    }
    .witness-card.premium {
      border-color: rgba(224,173,85,.42);
      background: linear-gradient(145deg,rgba(224,173,85,.10),rgba(96,99,48,.08));
    }
    .witness-card small {
      display: block;
      margin-bottom: 6px;
      color: #b9b386;
      font-size: 11px;
      letter-spacing: .14em;
    }
    .witness-card.premium small { color: #ddb86f; }
    .witness-card h4 {
      margin: 0 0 10px;
      color: #f5e7cf;
      font-family: var(--serif);
      font-size: 21px;
      font-weight: 500;
      letter-spacing: .06em;
    }
    .witness-card p {
      margin: 0 0 9px;
      color: rgba(247,242,233,.72);
      font-size: 14.5px;
      line-height: 1.85;
    }
    .witness-card p:last-child { margin-bottom: 0; }
    .witness-card strong { color: #f3d6a3; font-weight: 500; }
    @media (max-width: 700px) {
      .building-witness { padding: 27px 20px 24px; }
      .building-witness-head h3 { font-size: 25px; }
      .building-witness-grid { grid-template-columns: 1fr; }
      .witness-card { padding: 21px 19px 20px; }
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