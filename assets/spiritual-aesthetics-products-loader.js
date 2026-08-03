(() => {
  window.LYYProductImages = window.LYYProductImages || {};
  const names = {
    spirit: '元神光彩御守',
    wealth: '財富滿堂御守',
    career: '事業成就御守',
    love: '感情緣滿御守',
    incense: '鎮煞護安香粉'
  };

  if (!document.querySelector('style[data-product-photos]')) {
    const style = document.createElement('style');
    style.dataset.productPhotos = 'true';
    style.textContent = `
      .product-visual img.product-photo{position:relative;z-index:2;width:auto!important;height:92%!important;max-width:88%!important;object-fit:contain;filter:drop-shadow(0 20px 22px rgba(50,35,20,.24));transition:transform .55s var(--ease),filter .55s var(--ease);border:1px solid rgba(165,130,84,.12)}
      .product-card:hover .product-visual img.product-photo{transform:translateY(-8px) scale(1.025);filter:drop-shadow(0 28px 28px rgba(50,35,20,.32))}
      .result-visual img.product-photo{display:block;width:auto!important;height:auto!important;max-width:190px!important;max-height:255px!important;object-fit:contain;border:1px solid rgba(197,162,111,.2);box-shadow:0 18px 48px rgba(0,0,0,.35);animation:realOmamoriReveal .72s cubic-bezier(.2,.8,.2,1) both,realOmamoriFloat 2.8s .72s ease-in-out infinite}
      @keyframes realOmamoriReveal{from{opacity:0;transform:translateY(25px) scale(.72) rotate(-3deg);filter:blur(7px) brightness(1.5)}to{opacity:1;transform:translateY(0) scale(1);filter:blur(0) brightness(1)}}
      @keyframes realOmamoriFloat{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-8px) scale(1.025)}}
      @media(max-width:760px){.product-visual img.product-photo{height:94%!important;max-width:92%!important}.result-visual img.product-photo{max-width:160px!important;max-height:220px!important}}
      @media(prefers-reduced-motion:reduce){.result-visual img.product-photo{animation:none!important}}
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

  const note = document.querySelector('.note-box');
  if (note) note.textContent = '本頁已置入靈元院提供的商品實拍圖。商品庫存、最終售價、會員優惠與出貨規範，仍以綠界表單當下內容為準。';
})();