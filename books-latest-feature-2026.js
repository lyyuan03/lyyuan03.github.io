(() => {
  "use strict";

  const bookUrl = "https://www.books.com.tw/products/0011060075?sloc=main";
  const originalCover = "https://www.books.com.tw/img/001/106/00/0011060075.jpg";
  const coverUrl = `https://wsrv.nl/?url=${encodeURIComponent(originalCover)}&w=900&output=webp&q=92`;


  const readingParagraphs = [
    "你有沒有遇過這種情況？去宮廟問事，有人說你帶天命、該啟靈；靜坐時身體晃動，或是夢見神明，又有人說你的元神醒了。你想弄清楚，問了幾位老師，得到的說法卻完全不同。聽得越多，心裡越亂，甚至開始擔心：如果不照著做，會不會出事？",
    "《我在人間的元神覺醒》很適合正卡在這些疑問裡的人。也適合已經接觸靈修多年，參加過宮廟儀式、上過課、體驗過靈動，卻還是說不清自己究竟在修什麼的人。宇色把近三十年的修持、觀察與帶領經驗整理下來，談元神、啟靈、靈脈、靈格，也談那些修行人不好意思承認的困惑。",
    "書裡有一個值得慢慢想的問題：當你急著知道自己的元神是誰、前世是什麼身分，這個答案究竟能幫你過好今天的生活，還是讓你更在意自己有多特別？有些人愈修愈怕犯錯，遇到事情先等神明指示；有些人很想被老師肯定，連不舒服的感受都忍下來。人心裡原本就有害怕、期待和想被看見的需要，碰上強烈的宗教經驗，更需要仔細分辨。",
    "你可以從這本書讀到：夢見神明是不是啟靈？靜坐時的氣動、靈動有什麼差別？牽靈儀式、自發功、持咒念經和冥想，各自有哪些限制？遇到自稱能替你開啟天命的人，該觀察哪些地方？作者也談到某些修持方法可能帶來的風險，以及為什麼一位老師的言行和他帶出來的學生，值得比頭銜更仔細地看。",
    "如果你曾因一句「你有使命」而興奮，也曾因一句「不修會有事」而害怕；如果你一直在尋找肯定自己的答案，或是修了多年卻和家人愈來愈遠，這本書能提供一個重新檢查自己的機會。感應出現之後，你怎麼面對脾氣、關係、工作和生活？你能不能承認自己也會嫉妒、固執、依賴別人的認同？這些平常容易跳過的事，往往比一時的神奇經驗更難面對。",
    "你不必先相信每一種靈界說法，才能讀這本書。把它當成一位走過許多彎路的人，向你說明他看過的現象、踩過的陷阱，以及他如何理解修行。讀完之後，至少可以帶著更具體的問題去判斷：我現在做的事，讓我更能照顧自己與身邊的人，還是讓我越來越害怕、越來越需要別人替我決定？"
];
  let previousDialogFocus = null;

  const ensureReadingDialog = () => {
    let dialog = document.getElementById("yuanshen-reading-dialog");
    if (dialog) return dialog;

    dialog = document.createElement("dialog");
    dialog.id = "yuanshen-reading-dialog";
    dialog.setAttribute("aria-labelledby", "yuanshen-reading-title");
    dialog.setAttribute("aria-describedby", "yuanshen-reading-lead");
    dialog.innerHTML = [
      '<div class="yuanshen-dialog-inner">',
      '<button type="button" class="yuanshen-dialog-close" aria-label="關閉書籍導讀">×</button>',
      '<div class="yuanshen-dialog-kicker">讀之前，先問問自己</div>',
      '<h2 id="yuanshen-reading-title">《我在人間的元神覺醒》</h2>',
      '<p id="yuanshen-reading-lead" class="yuanshen-dialog-lead">這本書，適合正在經歷哪些困惑的人？</p>',
      '<div class="yuanshen-dialog-article">',
      ...readingParagraphs.map((paragraph) => "<p>" + paragraph + "</p>"),
      '</div>',
      '<div class="yuanshen-dialog-actions">',
      '<a href="' + bookUrl + '" target="_blank" rel="noopener noreferrer" class="yuanshen-dialog-buy">前往博客來了解這本書</a>',
      '<button type="button" class="yuanshen-dialog-back">返回作品頁</button>',
      '</div>',
      '</div>'
    ].join("");

    dialog.querySelectorAll(".yuanshen-dialog-close, .yuanshen-dialog-back").forEach((button) => {
      button.addEventListener("click", () => dialog.close());
    });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener("close", () => {
      if (previousDialogFocus && previousDialogFocus.isConnected) previousDialogFocus.focus();
      previousDialogFocus = null;
    });
    document.body.appendChild(dialog);
    return dialog;
  };

  const openReadingDialog = () => {
    const dialog = ensureReadingDialog();
    if (dialog.open) return;
    previousDialogFocus = document.activeElement;
    dialog.showModal();
    dialog.querySelector(".yuanshen-dialog-close").focus();
  };

  const installTimelineCover = () => {
    const futureCover = document.querySelector("#worksGrid .future-cover");
    if (!futureCover) {
      setTimeout(installTimelineCover, 250);
      return;
    }

    const oldBook = futureCover.closest(".era-book");
    if (!oldBook || oldBook.dataset.latest2026Installed === "true") return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "era-book yuanshen-timeline-cover";
    button.dataset.latest2026Installed = "true";
    button.setAttribute("aria-label", "閱讀《我在人間的元神覺醒》的書籍導讀");
    button.setAttribute("aria-haspopup", "dialog");
    button.setAttribute("aria-controls", "yuanshen-reading-dialog");
    button.innerHTML = '<img src="' + coverUrl + '" alt="《我在人間的元神覺醒》書封" loading="lazy"><span>我在人間的元神覺醒</span>';
    button.addEventListener("click", openReadingDialog);

    oldBook.replaceWith(button);
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

        #latest-book-2026 .latest-book-cover{width:100%;padding:0;border:0;background:transparent;cursor:pointer;font:inherit}
        #latest-book-2026 .latest-book-cover-label{display:block;margin-top:16px;color:#d9b777;font-size:13px;letter-spacing:.08em;text-align:center}
        #latest-book-2026 .latest-book-read-button{display:inline-block;margin:0 12px 12px 0;padding:12px 18px;border:1px solid rgba(217,183,119,.72);background:transparent;color:#f2dfbd;cursor:pointer;font:inherit;font-size:15px;letter-spacing:.05em;transition:background .25s ease}
        #latest-book-2026 .latest-book-read-button:hover{background:rgba(217,183,119,.14)}
        #worksGrid .yuanshen-timeline-cover{padding:0;border:0;background:transparent;text-align:center;font:inherit;cursor:pointer}
        #worksGrid .yuanshen-timeline-cover img{transition:transform .25s ease}
        #worksGrid .yuanshen-timeline-cover:hover img{transform:translateY(-4px)}
        #yuanshen-reading-dialog{box-sizing:border-box;width:min(760px,calc(100vw - 24px));max-height:88vh;max-height:88dvh;margin:auto;padding:0;border:1px solid #b39362;border-radius:12px;background:#fbf7ee;color:#352718;box-shadow:0 24px 85px rgba(0,0,0,.5);overflow-y:auto}
        #yuanshen-reading-dialog::backdrop{background:rgba(7,11,7,.84);backdrop-filter:blur(4px)}
        #yuanshen-reading-dialog .yuanshen-dialog-inner{position:relative;padding:48px 52px 36px}
        #yuanshen-reading-dialog .yuanshen-dialog-close{position:absolute;top:15px;right:18px;border:0;background:transparent;color:#71573b;font-size:32px;line-height:1;cursor:pointer;padding:8px 12px}
        #yuanshen-reading-dialog .yuanshen-dialog-kicker{margin-bottom:12px;color:#947248;font-size:13px;letter-spacing:.14em}
        #yuanshen-reading-dialog h2{margin:0 0 10px;color:#3a2b19;font:400 29px/1.5 var(--serif)}
        #yuanshen-reading-dialog .yuanshen-dialog-lead{margin:0 0 28px;color:#745b3c;font-size:16px}
        #yuanshen-reading-dialog .yuanshen-dialog-article p{margin:0 0 22px;color:#46382a;font-size:16px;line-height:2.02;letter-spacing:.025em}
        #yuanshen-reading-dialog .yuanshen-dialog-actions{display:flex;align-items:center;gap:18px;flex-wrap:wrap;margin-top:30px;padding-top:24px;border-top:1px solid rgba(165,130,84,.25)}
        #yuanshen-reading-dialog .yuanshen-dialog-buy{display:inline-block;padding:11px 19px;background:#a58254;color:#fffaf2;font-size:14px;letter-spacing:.04em}
        #yuanshen-reading-dialog .yuanshen-dialog-back{padding:10px 3px;border:0;background:transparent;color:#71573b;font:inherit;font-size:14px;cursor:pointer;text-decoration:underline;text-underline-offset:4px}
        #latest-book-2026 button:focus-visible,#worksGrid .yuanshen-timeline-cover:focus-visible,#yuanshen-reading-dialog button:focus-visible,#yuanshen-reading-dialog a:focus-visible{outline:3px solid #d9b777;outline-offset:4px}
        @media(max-width:600px){
          #yuanshen-reading-dialog .yuanshen-dialog-inner{padding:44px 23px 25px}
          #yuanshen-reading-dialog h2{font-size:23px}
          #yuanshen-reading-dialog .yuanshen-dialog-article p{font-size:15px;line-height:1.95}
          #yuanshen-reading-dialog .yuanshen-dialog-actions{gap:12px}
        }
        @media(prefers-reduced-motion:reduce){
          #latest-book-2026:before{animation:none}
          #latest-book-2026 .latest-book-cover,#worksGrid .yuanshen-timeline-cover img{transition:none}
        }
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
          <button type="button" class="latest-book-cover" aria-label="閱讀《我在人間的元神覺醒》的書籍導讀" aria-haspopup="dialog" aria-controls="yuanshen-reading-dialog">
            <img src="${coverUrl}" alt="《我在人間的元神覺醒》書封" loading="eager">
            <span class="latest-book-cover-label">點開書封，看看這本書適不適合你</span>
          </button>
          <div class="latest-book-content">
            <div class="latest-book-kicker">2026 年度重磅新作</div>
            <h2 id="latest-book-2026-title">我在人間的元神覺醒</h2>
            <p class="latest-book-subtitle">靈修這些年走過的彎路、看清的陷阱、體悟到的核心原則</p>
            <p class="latest-book-copy">有人說你帶天命，也有人說身體晃動就是啟靈。聽多了，你有沒有反而更迷糊？這本書談元神，也談如何分辨感應、修行方法和帶領你的老師。</p>
            <button type="button" class="latest-book-read-button">先看書籍導讀</button>
            <a class="latest-book-button" href="${bookUrl}" target="_blank" rel="noopener noreferrer">立即前往博客來</a>
          </div>
        </div>
      </div>`;

    target.parentNode.insertBefore(section, target);
    ensureReadingDialog();
    section.querySelectorAll(".latest-book-cover, .latest-book-read-button").forEach((button) => {
      button.addEventListener("click", openReadingDialog);
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }
})();
