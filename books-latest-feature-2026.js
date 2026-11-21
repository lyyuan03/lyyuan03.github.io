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

  const styleText = `
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

    #latest-book-2026 .yuanshen-feature{position:relative;overflow:hidden;display:grid;grid-template-columns:minmax(180px,230px) minmax(0,1fr);gap:48px;align-items:center;max-width:1040px;margin:28px auto 0;padding:34px 48px;border:1px solid rgba(197,162,111,.34);background:linear-gradient(135deg,rgba(255,255,255,.03),rgba(165,130,84,.08));box-shadow:0 20px 50px rgba(0,0,0,.3),inset 0 0 40px rgba(165,130,84,.04)}
    #latest-book-2026 .yuanshen-feature:before{content:'';position:absolute;top:-10%;bottom:-10%;left:-45%;width:45%;z-index:0;pointer-events:none;background:linear-gradient(105deg,transparent,rgba(217,183,119,.08) 50%,transparent);transform:translate3d(0,0,0) skewX(-12deg);animation:yuanshenSweep 9s ease-in-out infinite}
    #latest-book-2026 .yuanshen-feature-cover{position:relative;z-index:1;display:block;width:100%;padding:0;border:0;background:transparent;cursor:pointer;font:inherit;transition:transform .35s ease}
    #latest-book-2026 .yuanshen-feature-cover:hover{transform:translateY(-5px)}
    #latest-book-2026 .yuanshen-glow{position:absolute;z-index:0;inset:-16% -22%;pointer-events:none;background:radial-gradient(ellipse at 50% 46%,rgba(217,183,119,.34),rgba(197,162,111,.12) 44%,transparent 68%);opacity:.5;animation:yuanshenGlow 9s ease-in-out infinite}
    #latest-book-2026 .yuanshen-feature-cover img{position:relative;z-index:1;display:block;width:100%;height:auto;aspect-ratio:5/7;object-fit:contain;filter:drop-shadow(0 18px 24px rgba(0,0,0,.5))}
    #latest-book-2026 .yuanshen-feature-text{position:relative;z-index:1;min-width:0}
    #latest-book-2026 .yuanshen-feature-kicker{margin:0 0 12px;color:#d9b777;font-size:13px;letter-spacing:.2em}
    #latest-book-2026 .yuanshen-feature-copy{max-width:600px;margin:0 0 24px;color:rgba(245,240,232,.78);font-family:var(--serif);font-size:17px;line-height:2;letter-spacing:.05em}
    #latest-book-2026 .yuanshen-feature-read{display:inline-block;padding:13px 32px;border:1px solid rgba(217,183,119,.72);background:linear-gradient(135deg,#a58254,#c5a26f,#a58254);color:#171109;cursor:pointer;font-family:var(--serif);font-size:15px;letter-spacing:.16em;box-shadow:0 12px 28px rgba(0,0,0,.24);transition:transform .25s ease,box-shadow .25s ease}
    #latest-book-2026 .yuanshen-feature-read:hover{transform:translateY(-3px);box-shadow:0 16px 34px rgba(0,0,0,.34)}
    #latest-book-2026 .yuanshen-feature-hint{display:block;margin-top:14px;color:rgba(217,183,119,.78);font-size:13px;letter-spacing:.08em}
    #worksGrid .latest-era a.era-book[data-yuanshen-reading]{cursor:pointer}
    #latest-book-2026 .yuanshen-feature button:focus-visible,#worksGrid .latest-era a.era-book:focus-visible,#yuanshen-reading-dialog button:focus-visible,#yuanshen-reading-dialog a:focus-visible{outline:3px solid #d9b777;outline-offset:4px}
    @keyframes yuanshenGlow{0%,100%{transform:translate3d(-4%,2%,0) scale(.96);opacity:.38}50%{transform:translate3d(4%,-3%,0) scale(1.06);opacity:.7}}
    @keyframes yuanshenSweep{0%{transform:translate3d(0,0,0) skewX(-12deg)}55%,100%{transform:translate3d(420%,0,0) skewX(-12deg)}}
    @media(max-width:820px){
      #latest-book-2026 .yuanshen-feature{grid-template-columns:1fr;gap:26px;margin:22px 16px 0;padding:30px 22px;text-align:center}
      #latest-book-2026 .yuanshen-feature-cover{max-width:190px;margin:0 auto}
      #latest-book-2026 .yuanshen-feature-copy{margin-left:auto;margin-right:auto;font-size:16px}
    }
    @media(max-width:600px){
      #yuanshen-reading-dialog .yuanshen-dialog-inner{padding:44px 23px 25px}
      #yuanshen-reading-dialog h2{font-size:23px}
      #yuanshen-reading-dialog .yuanshen-dialog-article p{font-size:15px;line-height:1.95}
      #yuanshen-reading-dialog .yuanshen-dialog-actions{gap:12px}
    }
    @media(prefers-reduced-motion:reduce){
      #latest-book-2026 .yuanshen-feature:before{animation:none;display:none}
      #latest-book-2026 .yuanshen-glow{animation:none;opacity:.5}
      #latest-book-2026 .yuanshen-feature-cover,#latest-book-2026 .yuanshen-feature-read{transition:none}
    }
  `;

  const injectStyle = () => {
    if (document.getElementById("yuanshen-reading-style")) return;
    const style = document.createElement("style");
    style.id = "yuanshen-reading-style";
    style.textContent = styleText;
    document.head.appendChild(style);
  };

  const coverSources = [
    coverUrl,
    "https://images.weserv.nl/?url=" + encodeURIComponent(originalCover) + "&w=900&output=jpg&q=90",
    originalCover
  ];

  const attachCover = (image) => {
    let index = 0;
    image.referrerPolicy = "no-referrer";
    image.addEventListener("error", () => {
      index += 1;
      if (index < coverSources.length) image.src = coverSources[index];
    });
    image.src = coverSources[0];
  };

  // 展示區：沿用 analytics.js 已建立的區塊（影片與橫幅原封不動），只在其後補上書封與導讀按鈕。
  const enhanceShowcase = () => {
    const section = document.getElementById("latest-book-2026");
    const media = section && section.querySelector(".latest-book-media");
    if (!media) return false;
    if (section.querySelector("[data-yuanshen-feature]")) return true;

    injectStyle();
    const panel = document.createElement("div");
    panel.className = "yuanshen-feature";
    panel.id = "book-yuanshen-awakening"; // 影音專頁「延伸閱讀」的定位錨點，請勿更名
    panel.setAttribute("data-yuanshen-feature", "");
    panel.innerHTML = [
      '<button type="button" class="yuanshen-feature-cover" aria-label="閱讀《我在人間的元神覺醒》的書籍導讀" aria-haspopup="dialog" aria-controls="yuanshen-reading-dialog">',
      '<span class="yuanshen-glow" aria-hidden="true"></span>',
      '<img alt="《我在人間的元神覺醒》書封" width="300" height="420" loading="lazy" decoding="async">',
      '</button>',
      '<div class="yuanshen-feature-text">',
      '<p class="yuanshen-feature-kicker">讀之前，先問問自己</p>',
      '<p class="yuanshen-feature-copy">有人說你帶天命，也有人說身體晃動就是啟靈。聽多了，你有沒有反而更迷糊？這本書談元神，也談如何分辨感應、修行方法和帶領你的老師。</p>',
      '<button type="button" class="yuanshen-feature-read" aria-haspopup="dialog" aria-controls="yuanshen-reading-dialog">先看書籍導讀</button>',
      '<span class="yuanshen-feature-hint">點開書封，看看這本書適不適合你</span>',
      '</div>'
    ].join("");
    attachCover(panel.querySelector("img"));
    panel.querySelectorAll(".yuanshen-feature-cover, .yuanshen-feature-read").forEach((button) => {
      button.addEventListener("click", openReadingDialog);
    });
    media.insertAdjacentElement("afterend", panel);
    return true;
  };

  // 作品年表：保留 analytics.js 產生的博客來連結（無 JavaScript 或按住 Ctrl／Cmd 點擊時仍可前往），一般點擊改開導讀。
  let timelineBound = false;
  const enhanceTimeline = () => {
    const grid = document.getElementById("worksGrid");
    const link = grid && grid.querySelector(".latest-era a.era-book");
    if (!link) return false;
    injectStyle();
    if (!timelineBound) {
      timelineBound = true;
      grid.addEventListener("click", (event) => {
        const target = event.target.closest && event.target.closest(".latest-era a.era-book");
        if (!target || !grid.contains(target)) return;
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        openReadingDialog();
      });
    }
    if (!link.hasAttribute("data-yuanshen-reading")) {
      link.setAttribute("data-yuanshen-reading", "");
      link.setAttribute("aria-haspopup", "dialog");
      link.setAttribute("aria-controls", "yuanshen-reading-dialog");
      link.setAttribute("aria-label", "閱讀《我在人間的元神覺醒》的書籍導讀");
    }
    return true;
  };

  const install = () => {
    if (!location.pathname.endsWith("/books.html")) return;
    if (window.__yuanshenReadingInstalled) return;
    window.__yuanshenReadingInstalled = true;

    // analytics.js 可能比本檔晚執行，所以最多等待 10 秒（40 次 × 250 毫秒），之後即停止。
    let attempts = 0;
    const tick = () => {
      attempts += 1;
      const showcaseReady = enhanceShowcase();
      const timelineReady = enhanceTimeline();
      if ((showcaseReady && timelineReady) || attempts >= 40) return;
      setTimeout(tick, 250);
    };
    tick();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }
})();
