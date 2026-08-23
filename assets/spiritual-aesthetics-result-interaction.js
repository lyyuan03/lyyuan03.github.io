(() => {
  const quiz = document.getElementById('energyQuiz');
  if (!quiz || document.documentElement.dataset.resultInteractionReady === 'true') return;
  document.documentElement.dataset.resultInteractionReady = 'true';

  const style = document.createElement('style');
  style.dataset.resultInteraction = 'true';
  style.textContent = `
    .result-visual-wrap{
      width:136px!important;
      height:156px!important;
      margin:8px auto 12px!important;
      overflow:hidden!important;
      border-radius:8px;
      cursor:pointer;
      touch-action:manipulation;
      transition:transform .25s ease,box-shadow .25s ease,border-color .25s ease;
      border:1px solid rgba(197,162,111,.14);
      box-shadow:inset 0 0 28px rgba(165,130,84,.06);
    }
    .result-visual-wrap:hover{
      transform:translateY(-2px);
      border-color:rgba(225,189,128,.38);
      box-shadow:inset 0 0 28px rgba(165,130,84,.1),0 10px 24px rgba(0,0,0,.18);
    }
    .result-visual-wrap:focus-visible{
      outline:2px solid rgba(225,189,128,.8);
      outline-offset:4px;
    }
    .result-visual{
      width:96px!important;
      height:128px!important;
      pointer-events:none;
    }
    .result-visual svg.product-photo-svg,
    .result-visual img.product-photo,
    .result-visual img{
      width:100%!important;
      height:100%!important;
      max-width:100%!important;
      max-height:100%!important;
      object-fit:contain!important;
      filter:drop-shadow(0 12px 18px rgba(0,0,0,.34))!important;
      animation:compactOmamoriReveal .55s cubic-bezier(.2,.8,.2,1) both,compactOmamoriFloat 3s .55s ease-in-out infinite!important;
    }
    .product-card.product-focus-target .product-visual svg.product-photo-svg,
    .product-card.product-focus-target .product-visual img.product-photo,
    .product-card.product-focus-target .product-visual img{
      transform-origin:center;
      animation:productPhotoFocus 1.15s ease-in-out 2!important;
    }
    .product-focus-scan{
      position:absolute;
      z-index:6;
      top:-28%;
      left:-58%;
      width:30%;
      height:156%;
      pointer-events:none;
      transform:rotate(17deg);
      background:linear-gradient(90deg,transparent,rgba(255,241,205,.18),rgba(255,241,205,.78),rgba(255,241,205,.18),transparent);
      filter:blur(1.5px);
      mix-blend-mode:screen;
      animation:productScanSweep 1.15s ease-in-out 2;
    }
    @keyframes compactOmamoriReveal{
      from{opacity:0;transform:translateY(10px) scale(.88);filter:blur(4px) brightness(1.25)}
      to{opacity:1;transform:translateY(0) scale(1);filter:blur(0) brightness(1)}
    }
    @keyframes compactOmamoriFloat{
      0%,100%{transform:translateY(0) scale(1)}
      50%{transform:translateY(-4px) scale(1.01)}
    }
    @keyframes productPhotoFocus{
      0%,100%{transform:scale(1)}
      45%{transform:scale(1.09)}
    }
    @keyframes productScanSweep{
      0%{left:-58%;opacity:0}
      12%{opacity:1}
      100%{left:128%;opacity:0}
    }
    @media(max-width:760px){
      .result-visual-wrap{width:126px!important;height:146px!important}
      .result-visual{width:90px!important;height:120px!important}
    }
    @media(prefers-reduced-motion:reduce){
      .result-visual-wrap,
      .result-visual svg.product-photo-svg,
      .result-visual img,
      .product-card.product-focus-target .product-visual svg.product-photo-svg,
      .product-card.product-focus-target .product-visual img,
      .product-focus-scan{animation:none!important;transition:none!important}
      .product-card.product-focus-target .product-visual{box-shadow:inset 0 0 0 3px rgba(225,189,128,.5)}
    }
  `;
  document.head.appendChild(style);

  const resultVisualWrap = quiz.querySelector('.result-visual-wrap');
  const resultButton = document.getElementById('resultProduct');
  const productNameMap = {
    '元神光彩御守': 'product-spirit',
    '財富滿堂御守': 'product-wealth',
    '事業成就御守': 'product-career',
    '感情緣滿御守': 'product-love'
  };
  let focusTimer = 0;

  function getRecommendedProduct() {
    const name = document.getElementById('resultName')?.textContent?.trim();
    const id = productNameMap[name];
    return id ? document.getElementById(id) : null;
  }

  function focusRecommendedProduct() {
    const target = getRecommendedProduct();
    if (!target) return;

    document.querySelectorAll('.filter-btn').forEach(button => {
      button.classList.toggle('active', button.dataset.filter === 'all');
    });

    document.querySelectorAll('.product-card').forEach(card => {
      card.classList.remove('hidden', 'recommended', 'product-focus-target');
      card.style.transform = '';
    });
    document.querySelectorAll('.product-focus-scan').forEach(scan => scan.remove());

    target.classList.add('recommended', 'product-focus-target');
    const visual = target.querySelector('.product-visual');
    if (visual) {
      const scan = document.createElement('span');
      scan.className = 'product-focus-scan';
      scan.setAttribute('aria-hidden', 'true');
      visual.appendChild(scan);
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });

    window.clearTimeout(focusTimer);
    focusTimer = window.setTimeout(() => {
      target.classList.remove('recommended', 'product-focus-target');
      target.querySelector('.product-focus-scan')?.remove();
    }, 6500);
  }

  if (resultVisualWrap) {
    resultVisualWrap.setAttribute('role', 'button');
    resultVisualWrap.setAttribute('tabindex', '0');
    resultVisualWrap.setAttribute('aria-label', '點選查看推薦御守商品');
    resultVisualWrap.title = '點選查看推薦御守商品';
    resultVisualWrap.addEventListener('click', focusRecommendedProduct);
    resultVisualWrap.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      focusRecommendedProduct();
    });
  }

  resultButton?.addEventListener('click', () => {
    window.setTimeout(focusRecommendedProduct, 80);
  });
})();
