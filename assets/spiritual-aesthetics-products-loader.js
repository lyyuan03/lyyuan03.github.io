(() => {
  window.LYYProductImages = window.LYYProductImages || {};

  const names = {
    spirit: '元神光彩御守',
    wealth: '財富滿堂御守',
    career: '事業成就御守',
    love: '感情緣滿御守',
    incense: '鎮煞護安香粉'
  };
  const sizes = {
    spirit: [220, 349],
    wealth: [220, 349],
    career: [220, 349],
    love: [220, 349],
    incense: [260, 396]
  };

  if (!document.querySelector('style[data-product-photos]')) {
    const style = document.createElement('style');
    style.dataset.productPhotos = 'true';
    style.textContent = `
      .product-visual svg.product-photo-svg{position:relative;z-index:2;width:92%!important;height:92%!important;filter:drop-shadow(0 20px 22px rgba(50,35,20,.24));transition:transform .55s var(--ease),filter .55s var(--ease)}
      .product-card:hover .product-visual svg.product-photo-svg{transform:translateY(-8px) scale(1.025);filter:drop-shadow(0 28px 28px rgba(50,35,20,.32))}
      .result-visual svg.product-photo-svg{display:block;width:auto!important;height:255px!important;max-width:190px!important;max-height:255px!important;filter:drop-shadow(0 18px 28px rgba(0,0,0,.38));animation:realOmamoriReveal .72s cubic-bezier(.2,.8,.2,1) both,realOmamoriFloat 2.8s .72s ease-in-out infinite}
      .quiz-invocation{position:relative;margin:0 auto 17px;padding:12px 15px 13px;border-top:1px solid rgba(197,162,111,.2);border-bottom:1px solid rgba(197,162,111,.2);background:linear-gradient(90deg,transparent,rgba(165,130,84,.08),transparent);color:rgba(245,240,232,.73);font-family:var(--serif);font-size:12px;line-height:1.85;letter-spacing:.07em;text-align:center}
      .quiz-invocation p{margin:0}
      .quiz-invocation strong{display:block;margin:3px 0;color:#e0bc7e;font-size:15px;font-weight:400;letter-spacing:.13em;text-shadow:0 0 16px rgba(224,188,126,.22)}
      .quiz-invocation span{display:block;color:rgba(245,240,232,.62);font-size:11px;letter-spacing:.16em}
      @keyframes realOmamoriReveal{from{opacity:0;transform:translateY(25px) scale(.72) rotate(-3deg);filter:blur(7px) brightness(1.5)}to{opacity:1;transform:translateY(0) scale(1);filter:blur(0) brightness(1)}}
      @keyframes realOmamoriFloat{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-8px) scale(1.025)}}
      @media(max-width:760px){.product-visual svg.product-photo-svg{width:96%!important;height:96%!important}.result-visual svg.product-photo-svg{height:220px!important;max-width:165px!important;max-height:220px!important}.quiz-invocation{font-size:11.5px;padding:10px 11px}.quiz-invocation strong{font-size:14px}}
      @media(prefers-reduced-motion:reduce){.result-visual svg.product-photo-svg{animation:none!important}}
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

  const incensePrice = document.querySelector('[data-product="incense"] .price');
  if (incensePrice) incensePrice.textContent = 'NT$ 680';

  if (!document.querySelector('script[data-aesthetics-copy-polish]')) {
    const copyScript = document.createElement('script');
    copyScript.src = 'assets/spiritual-aesthetics-copy-polish.js?v=1';
    copyScript.async = false;
    copyScript.dataset.aestheticsCopyPolish = 'true';
    document.body.appendChild(copyScript);
  }
})();
