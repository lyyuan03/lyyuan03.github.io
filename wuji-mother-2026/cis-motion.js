/* 節制的捲動進場與 3D 視差，尊重裝置減少動態效果設定。 */
(()=>{'use strict';
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 if(reduced)return;
 if('IntersectionObserver' in window){
  const targets=document.querySelectorAll('.journey > div,.archive-grid figure,.event-explainer > div,.form-heading,.lookup-panel,.panel,.summary,.admin-metrics article,.admin-card');
  targets.forEach((el,i)=>{
   el.classList.add('cis-reveal');
   el.style.setProperty('--cis-delay',((i%3)*70)+'ms');
  });
  document.documentElement.classList.add('cis-motion');
  const observer=new IntersectionObserver(entries=>{
   entries.forEach(entry=>{
    if(!entry.isIntersecting)return;
    entry.target.classList.add('is-visible');
    observer.unobserve(entry.target);
   });
  },{rootMargin:'0px 0px -28px 0px',threshold:0.04});
  targets.forEach(el=>observer.observe(el));
 }
 if(!window.matchMedia('(hover:hover) and (pointer:fine)').matches)return;
 document.querySelectorAll('.archive-grid figure,.journey > div,.placeholder-visual,.admin-metrics article').forEach(card=>{
  card.classList.add('cis-tilt');
  let frame=0;
  card.addEventListener('pointermove',event=>{
   if(frame)return;
   const rect=card.getBoundingClientRect();
   const x=((event.clientX-rect.left)/rect.width-.5)*5;
   const y=((event.clientY-rect.top)/rect.height-.5)*-5;
   frame=requestAnimationFrame(()=>{
    card.style.setProperty('--cis-rotate-x',y.toFixed(2)+'deg');
    card.style.setProperty('--cis-rotate-y',x.toFixed(2)+'deg');
    frame=0;
   });
  },{passive:true});
  card.addEventListener('pointerleave',()=>{
   if(frame)cancelAnimationFrame(frame);
   frame=0;
   card.style.setProperty('--cis-rotate-x','0deg');
   card.style.setProperty('--cis-rotate-y','0deg');
  });
 });
})();
