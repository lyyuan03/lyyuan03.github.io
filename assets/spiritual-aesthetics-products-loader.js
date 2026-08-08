(() => {
  const VERSION='20260808-mothercard-inline-fix-1';
  document.documentElement.dataset.spiritualProductsReady=VERSION;

  const names={
    spirit:'元神光彩御守',
    wealth:'財富滿堂御守',
    career:'事業成就御守',
    love:'感情緣滿御守',
    incense:'鎮煞護安香粉',
    motherCard:'無極瑤池金母護身卡'
  };

  const photoScripts={
    spirit:'assets/product-spirit-photo.js?v=20260807-fit-4',
    wealth:'assets/product-wealth-photo.js?v=20260807-photo-4',
    career:'assets/product-career-photo.js?v=20260807-career-photo-2',
    love:'assets/product-love-photo.js?v=20260807-love-photo-1',
    incense:'assets/product-incense-photo.js?v=20260808-incense-direct-2'
  };


  const motherCardPhoto='assets/products/mother-card-20260808.webp?v=20260808-1';

  window.LYYProductImages=window.LYYProductImages||{};
  window.LYYProductImages.motherCard=motherCardPhoto;

  function ensureStyle(){
    let style=document.querySelector('style[data-product-photo-layout="20260808"]');
    if(style)return;
    style=document.createElement('style');
    style.dataset.productPhotoLayout='20260808';
    style.textContent=`
      .product-visual{position:relative;overflow:hidden;background:linear-gradient(145deg,#f5ecdc,#dfcaaa);border:1px solid rgba(165,130,84,.18)}
      .product-visual::before,.product-visual::after{display:none!important}
      .product-card[data-product] .product-visual{display:flex!important;align-items:center!important;justify-content:center!important;overflow:hidden!important;padding:12px!important}
      .product-card[data-product] .product-visual img.product-photo{position:relative!important;inset:auto!important;display:block!important;width:auto!important;height:auto!important;max-width:96%!important;max-height:96%!important;margin:auto!important;object-fit:contain!important;object-position:center!important;transform:none!important;filter:drop-shadow(0 18px 22px rgba(45,31,18,.16))}
      .product-card[data-product]:hover .product-visual img.product-photo{transform:none!important}
      #product-mother-card{grid-column:5 / span 4}
      @media(max-width:980px) and (min-width:761px){#product-mother-card{grid-column:4 / span 6}}
      @media(max-width:760px){.product-card[data-product] .product-visual{padding:8px!important}.product-card[data-product] .product-visual img.product-photo{max-width:98%!important;max-height:98%!important}}
      @media(max-width:760px){#product-mother-card{grid-column:auto}}
    `;
    document.head.appendChild(style);
  }

  function getCard(key){return document.querySelector(`[data-product="${key}"]`)||document.getElementById(`product-${key}`)}

  window.LYYApplyProductPhoto=(key,src)=>{
    const visual=getCard(key)?.querySelector('.product-visual');
    if(!visual||!src)return false;
    const image=new Image();
    image.className='product-photo';
    image.alt=names[key]||'靈元院商品';
    image.loading='eager';
    image.decoding='async';
    image.onload=()=>visual.replaceChildren(image);
    image.onerror=()=>console.warn(`商品圖片載入失敗，保留原始內容：${key}`);
    image.src=src;
    return true;
  };

  function installMotherCard(){
    const grid=document.querySelector('.product-grid');
    if(!grid)return null;
    let card=getCard('motherCard');
    if(card)return card;
    card=document.createElement('article');
    card.className='product-card reveal on';
    card.id='product-mother-card';
    card.dataset.category='card';
    card.dataset.product='motherCard';
    card.innerHTML=`
      <span class="badge">金母護持</span>
      <a class="product-link" href="https://reurl.cc/vv1k5e" target="_blank" rel="noopener" aria-label="前往綠界選購無極瑤池金母護身卡">
        <div class="product-visual"><div class="mother-card-fallback" role="img" aria-label="無極瑤池金母護身卡"></div></div>
        <div class="product-info">
          <p class="product-meta">BLESSED CARD · 01</p>
          <div class="product-title-row"><h3>無極瑤池金母護身卡</h3><span class="price">隨喜功德</span></div>
          <p class="product-desc">雙面護身卡三張一套，恭印無極瑤池金母聖像與護念文字，可隨身攜帶或敬慎安奉，作為收攝心念、守正祈安的日常提醒。</p>
          <div class="product-cta"><span>查看護身卡與選購</span><i>→</i></div>
        </div>
      </a>`;
    grid.appendChild(card);
    return card;
  }

  function bindFilters(){
    document.querySelectorAll('.filter-btn').forEach(button=>{
      if(button.dataset.dynamicFilterBound==='true')return;
      button.dataset.dynamicFilterBound='true';
      button.addEventListener('click',()=>{
        document.querySelectorAll('.filter-btn').forEach(item=>item.classList.toggle('active',item===button));
        const key=button.dataset.filter;
        document.querySelectorAll('.product-card').forEach(item=>item.classList.toggle('hidden',key!=='all'&&item.dataset.category!==key));
      });
    });
  }

  function loadPhotoScript(key,src){
    return new Promise(resolve=>{
      const old=document.querySelector(`script[data-product-photo="${key}"]`);if(old)old.remove();
      const script=document.createElement('script');
      script.src=src;script.async=true;script.dataset.productPhoto=key;
      script.onload=resolve;script.onerror=resolve;document.body.appendChild(script);
    });
  }

  function applyKnownPhotos(){
    Object.entries(window.LYYProductImages||{}).forEach(([key,src])=>window.LYYApplyProductPhoto(key,src));
    window.LYYApplyProductPhoto('motherCard',motherCardPhoto);
  }

  ensureStyle();
  installMotherCard();
  bindFilters();
  const incensePrice=document.querySelector('[data-product="incense"] .price');if(incensePrice)incensePrice.textContent='NT$ 680';
  window.LYYApplyProductPhoto('motherCard',motherCardPhoto);

  Promise.all(Object.entries(photoScripts).map(([key,src])=>loadPhotoScript(key,src))).then(()=>{
    applyKnownPhotos();
    setTimeout(applyKnownPhotos,300);
    setTimeout(applyKnownPhotos,900);
  });
  setTimeout(()=>window.LYYApplyProductPhoto('motherCard',motherCardPhoto),1500);
})();
