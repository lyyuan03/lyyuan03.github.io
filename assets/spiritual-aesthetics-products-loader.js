(() => {
  if (document.documentElement.dataset.spiritualProductsReady === '20260806') return;
  document.documentElement.dataset.spiritualProductsReady = '20260806';

  const names = {
    spirit: '元神光彩御守',
    wealth: '財富滿堂御守',
    career: '事業成就御守',
    love: '感情緣滿御守',
    incense: '鎮煞護安香粉',
    motherCard: '無極瑤池金母護身卡'
  };

  const productPhotos = {
    spirit: 'assets/products/spirit-omamori-20260806.webp?v=1',
    wealth: 'assets/products/wealth-omamori-20260806.webp?v=1',
    career: 'assets/products/career-omamori-20260806.webp?v=1',
    love: 'assets/products/love-omamori-20260806.webp?v=1',
    incense: 'assets/products/incense-20260806.webp?v=1',
    motherCard: 'assets/products/mother-card-20260806.webp?v=1'
  };

  if (!document.querySelector('style[data-product-photos-20260806]')) {
    const style = document.createElement('style');
    style.dataset.productPhotos20260806 = 'true';
    style.textContent = `
      .product-visual{
        position:relative;
        isolation:isolate;
        overflow:hidden;
        background:linear-gradient(145deg,#f5ecdc,#dfcaaa);
        border:1px solid rgba(165,130,84,.18);
      }
      .product-visual::before,
      .product-visual::after{display:none!important}
      .product-visual img.product-photo{
        position:relative;
        z-index:2;
        display:block;
        width:100%;
        height:100%;
        object-fit:contain;
        object-position:center;
        transition:transform .65s var(--ease),filter .65s var(--ease);
        filter:drop-shadow(0 20px 24px rgba(45,31,18,.18));
      }
      .product-card:hover .product-visual img.product-photo{
        transform:translateY(-6px) scale(1.018);
        filter:drop-shadow(0 28px 30px rgba(45,31,18,.28));
      }
      .product-card[data-product="motherCard"] .product-visual img.product-photo{
        object-fit:contain;
        padding:18px;
        box-sizing:border-box;
      }
      .result-visual img.product-photo{
        display:block;
        width:100%!important;
        height:100%!important;
        object-fit:contain;
        filter:drop-shadow(0 15px 22px rgba(0,0,0,.32));
        animation:realOmamoriReveal .72s cubic-bezier(.2,.8,.2,1) both,
                  realOmamoriFloat 2.8s .72s ease-in-out infinite;
      }
      .mother-card-placeholder{display:none!important}
      @media(min-width:981px){
        .product-grid .product-card:nth-child(4),
        .product-grid .product-card:nth-child(5),
        .product-grid .product-card:nth-child(6){grid-column:span 4!important}
      }
      @keyframes realOmamoriReveal{
        from{opacity:0;transform:translateY(18px) scale(.82);filter:blur(5px) brightness(1.3)}
        to{opacity:1;transform:translateY(0) scale(1);filter:blur(0) brightness(1)}
      }
      @keyframes realOmamoriFloat{
        0%,100%{transform:translateY(0)}
        50%{transform:translateY(-5px)}
      }
      @media(max-width:760px){
        .product-card[data-product="motherCard"] .product-visual img.product-photo{padding:10px}
      }
      @media(prefers-reduced-motion:reduce){
        .product-visual img.product-photo,
        .result-visual img.product-photo{animation:none!important;transition:none!important}
      }
    `;
    document.head.appendChild(style);
  }

  window.LYYApplyProductPhoto = (key, src) => {
    const card = document.querySelector(`[data-product="${key}"]`) || document.getElementById(`product-${key}`);
    const visual = card?.querySelector('.product-visual');
    if (!visual || !src) return;
    const image = document.createElement('img');
    image.className = 'product-photo';
    image.src = src;
    image.alt = names[key] || '靈元院商品';
    image.loading = key === 'spirit' ? 'eager' : 'lazy';
    image.decoding = 'async';
    visual.replaceChildren(image);
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
      <a class="product-link" href="https://reurl.cc/vv1k5e" target="_blank" rel="noopener"
         aria-label="前往綠界選購無極瑤池金母護身卡">
        <div class="product-visual"></div>
        <div class="product-info">
          <p class="product-meta">BLESSED CARD · 01</p>
          <div class="product-title-row">
            <h3>無極瑤池金母護身卡</h3>
            <span class="price">隨喜功德</span>
          </div>
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
  }

  function bindFilters() {
    document.querySelectorAll('.filter-btn').forEach(button => {
      if (button.dataset.dynamicFilterBound === 'true') return;
      button.dataset.dynamicFilterBound = 'true';
      button.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn')
          .forEach(item => item.classList.toggle('active', item === button));
        const key = button.dataset.filter;
        document.querySelectorAll('.product-card').forEach(item => {
          item.classList.toggle('hidden', key !== 'all' && item.dataset.category !== key);
        });
      });
    });
  }

  function applyAllPhotos() {
    Object.entries(productPhotos).forEach(([key, src]) => window.LYYApplyProductPhoto(key, src));
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
  bindFilters();

  const incensePrice = document.querySelector('[data-product="incense"] .price');
  if (incensePrice) incensePrice.textContent = 'NT$ 680';

  applyAllPhotos();

  if (!document.querySelector('script[data-aesthetics-copy-polish]')) {
    const copyScript = document.createElement('script');
    copyScript.src = 'assets/spiritual-aesthetics-copy-polish.js?v=1';
    copyScript.async = false;
    copyScript.dataset.aestheticsCopyPolish = 'true';
    copyScript.addEventListener('load', applyExpandedCopy, { once: true });
    document.body.appendChild(copyScript);
  }

  // 防止舊快取或舊商品圖程式稍後覆蓋新版圖片。
  window.setTimeout(applyAllPhotos, 200);
  window.setTimeout(applyAllPhotos, 900);
  window.setTimeout(applyExpandedCopy, 450);
  window.setTimeout(applyExpandedCopy, 1400);
})();