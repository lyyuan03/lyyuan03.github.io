/* 以靈元院丁未年太歲燈頁的翻頁倒數與限定選物浮標為參照。 */
(()=>{'use strict';
 const deadline=Date.parse('2026-12-21T23:59:00+08:00');
 const digits=document.getElementById('annualFlipDigits');
 const countdown=document.getElementById('annualDeadline');
 const reduced=window.matchMedia('(prefers-reduced-motion:reduce)').matches;
 let last=null,intro=null;
 function setDigits(value,animate=true){
  const str=String(value);
  if(str===last)return;
  const previous=last;last=str;
  digits.replaceChildren(...Array.from(str,(char,i)=>{
   const tile=document.createElement('span');tile.className='annual-flip__tile';
   tile.innerHTML='<span class="annual-flip__top"></span><span class="annual-flip__bottom"></span><span class="annual-flip__number"></span>';
   tile.querySelector('.annual-flip__number').textContent=char;
   if(animate&&!reduced&&previous!=null&&previous[i]!==char)tile.classList.add('flipping');
   return tile;
  }));
  digits.setAttribute('aria-label','還有 '+str+' 天截止');
 }
 function refresh(){
  const remaining=deadline-Date.now();
  if(remaining<=0){
   countdown.setAttribute('aria-disabled','true');
   document.getElementById('annualDeadlineClosed').hidden=false;
   if(intro){clearInterval(intro);intro=null;}
   return;
  }
  setDigits(Math.ceil(remaining/86400000));
 }
 function animateIntro(){
  const remaining=deadline-Date.now();
  if(remaining<=0){refresh();return;}
  const actual=Math.ceil(remaining/86400000);
  if(reduced){setDigits(actual,false);return;}
  let step=0;const count=String(actual).length;
  setDigits('8'.repeat(count),false);
  intro=setInterval(()=>{
   if(Date.now()>=deadline){refresh();return;}
   step++;
   if(step>=11){clearInterval(intro);intro=null;refresh();return;}
   setDigits(String((step*37+19)%(10**count)).padStart(count,'0'));
  },160);
 }
 animateIntro();setInterval(refresh,30000);

 const float=document.getElementById('exclusiveFloat');
 const dismiss=document.getElementById('exclusiveFloatDismiss');
 const poster=document.getElementById('exclusivePosterDialog');
 const mobile=window.matchMedia('(max-width:740px)');
 const front=document.getElementById('front-view');
 let collapsed=false;
 function collapse(){
  if(!mobile.matches||collapsed)return;
  collapsed=true;float.classList.add('exclusive-float--collapsed');
  float.setAttribute('aria-label','開啟丁未年限定商品海報');dismiss.hidden=true;
 }
 function syncVisibility(){
  const visible=!front.hidden;
  float.hidden=!visible;dismiss.hidden=!visible||collapsed;
  if(!visible&&poster.open)poster.close();
 }
 dismiss.addEventListener('click',e=>{e.stopPropagation();collapse();});
 window.addEventListener('scroll',()=>{if(window.scrollY>48)collapse();},{passive:true});
 document.getElementById('offering-form')?.addEventListener('focusin',collapse);
 if(window.scrollY>48)collapse();
 float.addEventListener('click',()=>{if(!poster.open)poster.showModal();collapse();});
 document.getElementById('exclusivePosterClose').addEventListener('click',()=>poster.close());
 poster.addEventListener('click',e=>{if(e.target===poster)poster.close();});
 new MutationObserver(syncVisibility).observe(front,{attributes:true,attributeFilter:['hidden']});
 syncVisibility();
})();
