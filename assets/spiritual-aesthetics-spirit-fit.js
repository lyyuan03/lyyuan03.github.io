(() => {
  if (document.querySelector('style[data-spirit-fit-20260807]')) return;

  const style = document.createElement('style');
  style.dataset.spiritFit20260807 = 'true';
  style.textContent = `
    .product-card[data-product="spirit"] .product-visual{
      display:flex!important;
      align-items:center!important;
      justify-content:center!important;
      padding:22px 28px!important;
      overflow:hidden!important;
      box-sizing:border-box!important;
    }

    .product-card[data-product="spirit"] .product-visual img.product-photo{
      display:block!important;
      width:auto!important;
      height:auto!important;
      max-width:86%!important;
      max-height:86%!important;
      object-fit:contain!important;
      object-position:center center!important;
      margin:auto!important;
      transform:none!important;
      box-sizing:border-box!important;
    }

    .product-card[data-product="spirit"]:hover .product-visual img.product-photo{
      transform:none!important;
    }

    @media(max-width:760px){
      .product-card[data-product="spirit"] .product-visual{
        padding:16px 20px!important;
      }
      .product-card[data-product="spirit"] .product-visual img.product-photo{
        max-width:88%!important;
        max-height:88%!important;
      }
    }
  `;
  document.head.appendChild(style);
})();
