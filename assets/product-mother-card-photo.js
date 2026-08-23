(() => {
  const src='assets/products/mother-card-photo-20260808.webp?v=20260808-mother-card-1';
  window.LYYProductImages=window.LYYProductImages||{};
  window.LYYProductImages.motherCard=src;

  function renderMotherCardPhoto(){
    const card=document.querySelector('[data-product="motherCard"]')||document.getElementById('product-mother-card');
    const visual=card?.querySelector('.product-visual');
    if(!visual)return false;

    let image=visual.querySelector('img.product-photo[data-mother-card-direct="true"]');
    if(!image){
      image=document.createElement('img');
      image.className='product-photo';
      image.dataset.motherCardDirect='true';
      image.alt='無極瑤池金母雙面護身卡（三張一套）';
      image.loading='eager';
      image.decoding='async';
      image.style.cssText='display:block;width:auto;height:auto;max-width:96%;max-height:96%;margin:auto;object-fit:contain;object-position:center;transform:none;';
      visual.replaceChildren(image);
    }
    if(image.src!==new URL(src,document.baseURI).href)image.src=src;
    return true;
  }

  renderMotherCardPhoto();
  setTimeout(renderMotherCardPhoto,250);
  setTimeout(renderMotherCardPhoto,900);
  setTimeout(renderMotherCardPhoto,1800);

  if(window.LYYApplyProductPhoto){
    window.LYYApplyProductPhoto('motherCard',src);
    setTimeout(()=>window.LYYApplyProductPhoto&&window.LYYApplyProductPhoto('motherCard',src),500);
  }
})();
