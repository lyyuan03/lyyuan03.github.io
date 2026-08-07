(() => {
  if (document.querySelector('style[data-incense-fit]')) return;
  const style = document.createElement('style');
  style.dataset.incenseFit = 'true';
  style.textContent = `
    .product-card[data-product="incense"] .product-visual{
      display:flex!important;
      align-items:center!important;
      justify-content:center!important;
      overflow:hidden!important;
      padding:12px!important;
    }
    .product-card[data-product="incense"] .product-visual img.product-photo{
      position:relative!important;
      inset:auto!important;
      display:block!important;
      width:auto!important;
      height:auto!important;
      max-width:96%!important;
      max-height:96%!important;
      margin:auto!important;
      object-fit:contain!important;
      object-position:center!important;
      transform:none!important;
    }
    .product-card[data-product="incense"]:hover .product-visual img.product-photo{
      transform:none!important;
    }
    @media(max-width:760px){
      .product-card[data-product="incense"] .product-visual{padding:8px!important}
      .product-card[data-product="incense"] .product-visual img.product-photo{
        max-width:98%!important;
        max-height:98%!important;
      }
    }
  `;
  document.head.appendChild(style);
})();
