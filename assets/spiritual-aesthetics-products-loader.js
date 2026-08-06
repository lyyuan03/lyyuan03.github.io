(() => {
  if (document.documentElement.dataset.spiritualProductsReady === 'true') return;
  document.documentElement.dataset.spiritualProductsReady = 'true';

  window.LYYProductImages = window.LYYProductImages || {};

  const names = {
    spirit: '元神光彩御守',
    wealth: '財富滿堂御守',
    career: '事業成就御守',
    love: '感情緣滿御守',
    incense: '鎮煞護安香粉',
    motherCard: '無極瑤池金母護身卡'
  };
  const sizes = {
    spirit: [220, 349],
    wealth: [220, 349],
    career: [220, 349],
    love: [220, 349],
    incense: [260, 396],
    motherCard: [450, 188]
  };

  if (!document.querySelector('style[data-product-photos]')) {
    const style = document.createElement('style');
    style.dataset.productPhotos = 'true';
    style.textContent = `
      .product-visual{position:relative;isolation:isolate;overflow:hidden;background:
        radial-gradient(circle at 50% 32%,rgba(255,255,255,.96) 0,rgba(250,246,237,.86) 28%,rgba(231,222,203,.48) 62%,rgba(196,177,142,.2) 100%),
        linear-gradient(145deg,rgba(255,255,255,.88),rgba(226,215,195,.62));
        border:1px solid rgba(165,130,84,.18);box-shadow:inset 0 1px 0 rgba(255,255,255,.8),inset 0 -28px 50px rgba(111,92,64,.06)}
      .product-visual::before{content:'';position:absolute;inset:7% 10% 14%;z-index:0;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.95) 0,rgba(255,248,232,.58) 38%,rgba(205,169,105,.12) 64%,transparent 76%);filter:blur(2px);opacity:.92;pointer-events:none}
      .product-visual::after{content:'';position:absolute;left:13%;right:13%;bottom:7%;height:14%;z-index:1;border-radius:50%;background:radial-gradient(ellipse,rgba(43,31,19,.26) 0,rgba(43,31,19,.12) 38%,transparent 72%);filter:blur(12px);transform:scaleX(.9);opacity:.58;pointer-events:none}
      .product-visual svg.product-photo-svg{position:relative;z-index:2;width:88%!important;height:88%!important;overflow:visible;filter:drop-shadow(0 10px 8px rgba(255,255,255,.42)) drop-shadow(0 22px 24px rgba(45,31,18,.24));transition:transform .65s var(--ease),filter .65s var(--ease);will-change:transform,filter}
      .product-visual svg.product-photo-svg image{filter:saturate(.92) contrast(1.045) brightness(1.035)}
      .product-card:hover .product-visual svg.product-photo-svg{transform:translateY(-9px) scale(1.022);filter:drop-shadow(0 12px 10px rgba(255,255,255,.5)) drop-shadow(0 30px 30px rgba(45,31,18,.31))}
      .product-card:hover .product-visual::before{opacity:1;transform:scale(1.035)}
      .product-card .product-visual::before{transition:opacity .6s var(--ease),transform .6s var(--ease)}
      .result-visual svg.product-photo-svg{display:block;width:auto!important;height:255px!important;max-width:190px!important;max-height:255px!important;filter:drop-shadow(0 18px 28px rgba(0,0,0,.38));animation:realOmamoriReveal .72s cubic-bezier(.2,.8,.2,1) both,realOmamoriFloat 2.8s .72s ease-in-out infinite}
      .product-card[data-product="incense"] .product-visual svg.product-photo-svg{width:82%!important;height:82%!important}
      .product-card[data-product="motherCard"] .product-visual svg.product-photo-svg{width:88%!important;height:auto!important;max-height:240px!important;filter:drop-shadow(0 9px 7px rgba(255,255,255,.42)) drop-shadow(0 18px 22px rgba(50,35,20,.22))}
      .product-card[data-product="motherCard"]:hover .product-visual svg.product-photo-svg{transform:translateY(-6px) scale(1.015)}
      .mother-card-placeholder{position:relative;z-index:2;display:grid;place-items:center;width:86%;height:58%;border:1px solid rgba(165,130,84,.25);color:#8b704c;font-family:var(--serif);font-size:22px;letter-spacing:.16em;background:rgba(255,252,246,.36)}
      .quiz-invocation{position:relative;margin:0 auto 17px;padding:12px 15px 13px;border-top:1px solid rgba(197,162,111,.2);border-bottom:1px solid rgba(197,162,111,.2);background:linear-gradient(90deg,transparent,rgba(165,130,84,.08),transparent);color:rgba(245,240,232,.73);font-family:var(--serif);font-size:12px;line-height:1.85;letter-spacing:.07em;text-align:center}
      .quiz-invocation p{margin:0}
      .quiz-invocation strong{display:block;margin:3px 0;color:#e0bc7e;font-size:15px;font-weight:400;letter-spacing:.13em;text-shadow:0 0 16px rgba(224,188,126,.22)}
      .quiz-invocation span{display:block;color:rgba(245,240,232,.62);font-size:11px;letter-spacing:.16em}
      @media(min-width:981px){.product-grid .product-card:nth-child(4),.product-grid .product-card:nth-child(5),.product-grid .product-card:nth-child(6){grid-column:span 4!important}}
      @keyframes realOmamoriReveal{from{opacity:0;transform:translateY(25px) scale(.72) rotate(-3deg);filter:blur(7px) brightness(1.5)}to{opacity:1;transform:translateY(0) scale(1);filter:blur(0) brightness(1)}}
      @keyframes realOmamoriFloat{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-8px) scale(1.025)}}
      @media(max-width:760px){.product-visual svg.product-photo-svg{width:92%!important;height:92%!important}.product-card[data-product="incense"] .product-visual svg.product-photo-svg{width:86%!important;height:86%!important}.product-card[data-product="motherCard"] .product-visual svg.product-photo-svg{width:92%!important;height:auto!important;max-height:220px!important}.result-visual svg.product-photo-svg{height:220px!important;max-width:165px!important;max-height:220px!important}.quiz-invocation{font-size:11.5px;padding:10px 11px}.quiz-invocation strong{font-size:14px}}
      @media(prefers-reduced-motion:reduce){.result-visual svg.product-photo-svg{animation:none!important}.product-visual svg.product-photo-svg,.product-visual::before{transition:none!important}}
    `;
    document.head.appendChild(style);
  }

  window.LYYApplyProductPhoto = (key, src) => {
    const card = document.querySelector(`[data-product="${key}"]`) || document.getElementById(`product-${key}`);
    const visual = card?.querySelector('.product-visual');
    if (!visual || !src) return;
    const [width, height] = sizes[key] || [220, 349];
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('product-photo-svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', names[key] || '靈元院商品');
    const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    image.setAttribute('x', '0');
    image.setAttribute('y', '0');
    image.setAttribute('width', String(width));
    image.setAttribute('height', String(height));
    image.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    image.setAttributeNS('http://www.w3.org/1999/xlink', 'href', src);
    image.setAttribute('href', src);
    svg.appendChild(image);
    visual.replaceChildren(svg);
  };

  function installMotherCard() {
    const grid = document.querySelector('.product-grid');
    if (!grid || document.querySelector('[data-product="motherCard"]')) return;

    const card = document.createElement('article');
    card.className = 'product-card reveal on';
    card.id = 'product-mother-card';
    card.dataset.category = 'card';
    card.dataset.product = 'motherCard';
    card.innerHTML = `
      <span class="badge">金母護持</span>
      <a class="product-link" href="https://reurl.cc/vv1k5e" target="_blank" rel="noopener" aria-label="前往綠界選購無極瑤池金母護身卡">
        <div class="product-visual"><div class="mother-card-placeholder">無極瑤池金母護身卡</div></div>
        <div class="product-info">
          <p class="product-meta">BLESSED CARD · 01</p>
          <div class="product-title-row"><h3>無極瑤池金母護身卡</h3><span class="price">隨喜功德</span></div>
          <p class="product-desc">雙面護身卡三張一套，恭印無極瑤池金母聖像與護念文字，可隨身攜帶或敬慎安奉，作為收攝心念、守正祈安的日常提醒。</p>
          <div class="product-cta"><span>查看護身卡與選購</span><i>→</i></div>
        </div>
      </a>`;
    grid.appendChild(card);

    const filterBar = document.querySelector('.filter-bar');
    if (filterBar && !filterBar.querySelector('[data-filter="card"]')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'filter-btn';
      button.dataset.filter = 'card';
      button.textContent = '護身卡';
      filterBar.appendChild(button);
    }

    document.querySelectorAll('.filter-btn').forEach(button => {
      if (button.dataset.dynamicFilterBound === 'true') return;
      button.dataset.dynamicFilterBound = 'true';
      button.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(item => item.classList.toggle('active', item === button));
        const key = button.dataset.filter;
        document.querySelectorAll('.product-card').forEach(item => {
          item.classList.toggle('hidden', key !== 'all' && item.dataset.category !== key);
        });
      });
    });
  }

  function applyExpandedCopy() {
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.content = '靈元院靈性美學館，收錄祈願御守、無極瑤池金母護身卡與鎮煞護安香粉，讓虔敬、守護與日常修持安住於生活之中。';

    const heroDesc = document.querySelector('.hero-copy .hero-desc');
    if (heroDesc) heroDesc.textContent = '靈性美學館收錄靈元院祈願御守、無極瑤池金母護身卡與護安香品。每一件選物皆以虔敬之心承載願念，提醒我們在日常起心動念之間，守住正念、善念與行願之心。';

    const productsCopy = document.querySelector('.products .section-head p:not(.section-en)');
    if (productsCopy) productsCopy.textContent = '收錄四款祈願御守、無極瑤池金母護身卡與鎮煞護安香粉。請先閱讀各品項的祈願方向，再依此刻所願與實際需要選擇；點選商品即可前往綠界選購。';

    const firstPromise = document.querySelector('.promise span');
    if (firstPromise) firstPromise.textContent = '每一款御守與護身卡皆承載不同的祈願方向，提醒持有者守心、正念，並以實際行動回應自己的願。';

    const note = document.querySelector('.note-box');
    if (note) note.textContent = '御守、護身卡與香品皆為祈願與日常修持之助緣，並非取代個人的判斷、行動與責任。商品價格、會員方案、庫存、使用方式與出貨規範，請以綠界表單當下內容為準。';

    const secondStep = document.querySelectorAll('.experience .step')[1]?.querySelector('p');
    if (secondStep) secondStep.textContent = '閱讀各款御守、護身卡與護安香品的用途，選定相應品項後，前往綠界完成數量、方案與訂購資料。';
  }

  installMotherCard();

  const incensePrice = document.querySelector('[data-product="incense"] .price');
  if (incensePrice) incensePrice.textContent = 'NT$ 680';

  if (!document.querySelector('script[data-mother-card-photo]')) {
    const photoScript = document.createElement('script');
    photoScript.src = 'assets/product-mother-card-photo.js?v=1';
    photoScript.async = false;
    photoScript.dataset.motherCardPhoto = 'true';
    document.body.appendChild(photoScript);
  }

  if (!document.querySelector('script[data-aesthetics-copy-polish]')) {
    const copyScript = document.createElement('script');
    copyScript.src = 'assets/spiritual-aesthetics-copy-polish.js?v=1';
    copyScript.async = false;
    copyScript.dataset.aestheticsCopyPolish = 'true';
    copyScript.addEventListener('load', applyExpandedCopy, { once: true });
    document.body.appendChild(copyScript);
  }

  window.setTimeout(applyExpandedCopy, 450);
  window.setTimeout(applyExpandedCopy, 1400);
})();
