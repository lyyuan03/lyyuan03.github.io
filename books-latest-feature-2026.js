(() => {
  "use strict";

  const bookUrl = "https://www.books.com.tw/products/0011060075?sloc=main";
  const originalCover = "https://www.books.com.tw/img/001/106/00/0011060075.jpg";
  const coverUrl = `https://wsrv.nl/?url=${encodeURIComponent(originalCover)}&w=900&output=webp&q=92`;

  const installTimelineCover = () => {
    const futureCover = document.querySelector("#worksGrid .future-cover");
    if (!futureCover) {
      setTimeout(installTimelineCover, 250);
      return;
    }

    const oldBook = futureCover.closest(".era-book");
    if (!oldBook || oldBook.dataset.latest2026Installed === "true") return;

    const link = document.createElement("a");
    link.className = "era-book";
    link.dataset.latest2026Installed = "true";
    link.href = bookUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", "前往博客來購買《我在人間的元神覺醒》");
    link.innerHTML = `
      <img src="${coverUrl}" alt="《我在人間的元神覺醒》書封" loading="lazy">
      <span>我在人間的元神覺醒</span>`;

    oldBook.replaceWith(link);
  };

  const install = () => {
    if (!location.pathname.endsWith("/books.html")) return;

    installTimelineCover();

    if (document.getElementById("latest-book-2026")) return;

    const target = document.querySelector("section.sec#books") || document.querySelector("#books");
    if (!target) {
      setTimeout(install, 300);
      return;
    }

    if (!document.getElementById("latest-book-2026-style")) {
      const style = document.createElement("style");
      style.id = "latest-book-2026-style";
      style.textContent = `
        #latest-book-2026{position:relative;overflow:hidden;padding:66px 0;background:linear-gradient(145deg,#090b08 0%,#17150f 48%,#0b0d09 100%);border-top:1px solid rgba(197,162,111,.24);border-bottom:1px solid rgba(197,162,111,.24)}
        #latest-book-2026:before{content:'';position:absolute;inset:-35%;background:radial-gradient(circle,rgba(197,162,111,.14),transparent 58%);animation:latestBookAura 7s ease-in-out infinite}
        #latest-book-2026 .latest-book-frame{position:relative;z-index:1;display:grid;grid-template-columns:minmax(280px,400px) minmax(0,1fr);gap:68px;align-items:center;max-width:1040px;margin:auto;padding:50px 58px;border:1px solid rgba(197,162,111,.44);background:linear-gradient(135deg,rgba(255,255,255,.035),rgba(165,130,84,.08));box-shadow:0 28px 70px rgba(0,0,0,.34),inset 0 0 46px rgba(165,130,84,.04)}
        #latest-book-2026 .latest-book-cover{display:block;position:relative;max-width:390px;margin:auto;transition:transform .35s ease,filter .35s ease}
        #latest-book-2026 .latest-book-cover:hover{transform:translateY(-7px);filter:brightness(1.06)}
        #latest-book-2026 .latest-book-cover img{display:block;width:100%;height:auto;max-height:560px;object-fit:contain;filter:drop-shadow(0 24px 30px rgba(0,0,0,.45))}
        #latest-book-2026 .latest-book-kicker{display:inline-flex;align-items:center;gap:10px;margin-bottom:18px;padding:7px 14px;border:1px solid rgba(217,183,119,.58);color:#d9b777;font-family:var(--sans);font-size:12px;letter-spacing:.22em}
        #latest-book-2026 .latest-book-kicker:before{content:'✦';font-size:10px}
        #latest-book-2026 h2{margin:0 0 18px;color:#f2dfbd;font-family:var(--serif);font-size:42px;line-height:1.45;letter-spacing:.12em;font-weight:400}
        #latest-book-2026 .latest-book-subtitle{max-width:570px;margin:0 0 15px;color:rgba(245,240,232,.82);font-family:var(--serif);font-size:20px;line-height:2;letter-spacing:.07em}
        #latest-book-2026 .latest-book-copy{max-width:600px;margin:0 0 28px;color:rgba(245,240,232,.58);font-size:14px;line-height:2}
        #latest-book-2026 .latest-book-button{display:inline-block;padding:13px 32px;border:1px solid rgba(217,183,119,.72);background:linear-gradient(135deg,#a58254,#c5a26f,#a58254);color:#171109;font-family:var(--serif);font-size:15px;letter-spacing:.16em;box-shadow:0 12px 28px rgba(0,0,0,.24);transition:transform .25s ease,box-shadow .25s ease}
        #latest-book-2026 .latest-book-button:hover{transform:translateY(-3px);box-shadow:0 16px 34px rgba(0,0,0,.34)}
        @keyframes latestBookAura{0%,100%{transform:translate3d(-2%,0,0);opacity:.68}50%{transform:translate3d(3%,-2%,0);opacity:1}}
        @media(max-width:820px){
          #latest-book-2026{padding:34px 0}
          #latest-book-2026 .latest-book-frame{grid-template-columns:1fr;gap:34px;margin:0 18px;padding:34px 24px;text-align:center}
          #latest-book-2026 .latest-book-cover{max-width:330px}
          #latest-book-2026 h2{font-size:31px;line-height:1.5}
          #latest-book-2026 .latest-book-subtitle{font-size:17px;margin-left:auto;margin-right:auto}
          #latest-book-2026 .latest-book-copy{margin-left:auto;margin-right:auto}
        }
      `;
      document.head.appendChild(style);
    }

    const section = document.createElement("section");
    section.id = "latest-book-2026";
    section.setAttribute("aria-labelledby", "latest-book-2026-title");
    section.innerHTML = `
      <div class="wrap">
        <div class="latest-book-frame">
          <a class="latest-book-cover" href="${bookUrl}" target="_blank" rel="noopener noreferrer" aria-label="前往博客來購買《我在人間的元神覺醒》">
            <img src="${coverUrl}" alt="《我在人間的元神覺醒》書封" loading="eager">
          </a>
          <div class="latest-book-content">
            <div class="latest-book-kicker">2026 年度重磅新作</div>
            <h2 id="latest-book-2026-title">我在人間的元神覺醒</h2>
            <p class="latest-book-subtitle">靈修這些年走過的彎路、看清的陷阱、體悟到的核心原則</p>
            <p class="latest-book-copy">重新理解元神、靈脈、靈格，以及啟靈之後必須面對的生命課題。這不只是一部靈修經驗之書，更是一張協助修行者辨識方向、遠離迷失的生命地圖。</p>
            <a class="latest-book-button" href="${bookUrl}" target="_blank" rel="noopener noreferrer">立即前往博客來</a>
          </div>
        </div>
      </div>`;

    target.parentNode.insertBefore(section, target);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }
})();
