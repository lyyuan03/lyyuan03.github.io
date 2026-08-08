(() => {
  const src='assets/products/incense-photo-20260807.webp?v=20260808-incense-direct-2';

  if(!document.querySelector('style[data-incense-fit]')){
    const style=document.createElement('style');
    style.dataset.incenseFit='true';
    style.textContent=`
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
        opacity:1!important;
        visibility:visible!important;
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
  }

  function forceRender(){
    const card=document.querySelector('[data-product="incense"]')||document.getElementById('product-incense');
    const visual=card?.querySelector('.product-visual');
    if(!visual)return;

    const image=document.createElement('img');
    image.className='product-photo';
    image.dataset.incenseForced='true';
    image.alt='鎮煞護安香粉';
    image.loading='eager';
    image.decoding='async';
    image.style.cssText='display:block;width:auto;height:auto;max-width:96%;max-height:96%;margin:auto;object-fit:contain;object-position:center;opacity:1;visibility:visible;transform:none;';
    image.src=src;
    visual.replaceChildren(image);
  }

  forceRender();
  setTimeout(forceRender,300);
  setTimeout(forceRender,1000);
  setTimeout(forceRender,2200);
})();
