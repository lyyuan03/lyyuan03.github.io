(() => {
  if (document.querySelector('style[data-wealth-fit]')) return;
  const style = document.createElement('style');
  style.dataset.wealthFit = 'true';
  style.textContent = `
    .product-card[data-product="wealth"] .product-visual{
      display:flex!important;
      align-items:center!important;
      justify-content:center!important;
      overflow:hidden!important;
    }
    .product-card[data-product="wealth"] .product-visual img.product-photo{
      position:relative!important;
      inset:auto!important;
      display:block!important;
      width:auto!important;
      height:auto!important;
      max-width:88%!important;
      max-height:88%!important;
      margin:auto!important;
      object-fit:contain!important;
      object-position:center!important;
      transform:none!important;
    }
    .product-card[data-product="wealth"]:hover .product-visual img.product-photo{
      transform:none!important;
    }
    @media(max-width:760px){
      .product-card[data-product="wealth"] .product-visual img.product-photo{
        max-width:92%!important;
        max-height:92%!important;
      }
    }
  `;
  document.head.appendChild(style);
})();
