(() => {
  const src='assets/products/incense-photo-20260807.webp?v=20260808-incense-direct-2';
  window.LYYProductImages=window.LYYProductImages||{};
  window.LYYProductImages.incense=src;

  function renderIncensePhoto(){
    const card=document.querySelector('[data-product="incense"]')||document.getElementById('product-incense');
    const visual=card?.querySelector('.product-visual');
    if(!visual)return false;

    let image=visual.querySelector('img.product-photo[data-incense-direct="true"]');
    if(!image){
      image=document.createElement('img');
      image.className='product-photo';
      image.dataset.incenseDirect='true';
      image.alt='鎮煞護安香粉';
      image.loading='eager';
      image.decoding='async';
      image.style.cssText='display:block;width:auto;height:auto;max-width:96%;max-height:96%;margin:auto;object-fit:contain;object-position:center;transform:none;';
      visual.replaceChildren(image);
    }
    if(image.src!==new URL(src,document.baseURI).href)image.src=src;
    return true;
  }

  renderIncensePhoto();
  setTimeout(renderIncensePhoto,250);
  setTimeout(renderIncensePhoto,900);
  setTimeout(renderIncensePhoto,1800);

  if(window.LYYApplyProductPhoto){
    window.LYYApplyProductPhoto('incense',src);
    setTimeout(()=>window.LYYApplyProductPhoto&&window.LYYApplyProductPhoto('incense',src),500);
  }
})();
