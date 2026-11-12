
'use strict';const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],money=n=>'NT$ '+Number(n).toLocaleString('zh-TW'),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DEFAULT_CFG=window.LYYUAN_SIGNUP_DEFAULT_CONFIG;
let eventStatus='開放',previewMode=false;const EVENT_CLOSED_TEXT={'關閉':'本次報名目前已關閉，暫不接受新的報名。','草稿':'本次活動尚未開放報名。'},EVENT_PREVIEW_TEXT='預覽模式：此活動為草稿，尚未公開，目前無法送出報名。';
let CFG=DEFAULT_CFG,lampDefs=[],products=[],sponsors=[],registrationType={},lampPurposes={},lampFortune={},hotKeys=new Set(),lastStats=null;let uid=0,currentTotal=0,currentPending=false;
/* 116年度專屬籤詩對外文案：內建與雲端設定一律以本頁核定版本顯示。 */
const ANNUAL_FORTUNE_COPY={"head_taisui":"慈賜<strong>《歲運呈祥・吉慶天籤》</strong><br>開示116年流年吉凶、運勢起伏與應注意之事，指引趨吉避凶、逢凶化吉，祈願歲序安泰、福運亨通。","head_pozai":"慈賜<strong>《破厄消災・福慧靈籤》</strong><br>開示116年災厄防範、平安護身與修行課題，指引化解障礙、增長福慧，祈願災消障除、身心安泰。","head_guangcai":"慈賜<strong>《財祿亨通・歲運金籤》</strong><br>開示116年財運盛衰、求財契機與事業運程，指引財路宜忌、進退時機，祈願財源廣進、福祿盈門。","co_pozai":"慈賜<strong>《鎮業化煞・安泰聖籤》</strong><br>開示116年企業經營可能面臨的阻礙、風險與應注意之事，指引防範災厄、化解不利、穩固事業根基，祈願營運平安、員工安康、諸事順遂。","co_guangcai":"慈賜<strong>《鴻業昌隆・財祿金籤》</strong><br>開示116年企業財運、營運走勢、商機財路與事業發展，指引經營宜忌、財務進退及拓展契機，祈願生意興隆、財源廣進、鴻業昌盛。"};
const ANNUAL_FORTUNE_NOTE="<strong>116年度慈賜籤詩</strong>本年度太歲燈、破災降魔燈、廣財運通燈總燈首，以及破災降魔燈、廣財運通燈公司行號燈，分別慈賜專屬年度籤詩，開示116年應留意的運勢、平安、修行與事業方向。";
function applyAnnualFortuneCopy(config) {
  if (!config || !Array.isArray(config.lamps)) return config;
  return {
    ...config,
    lamps: config.lamps.map(lamp => {
      const fortune = ANNUAL_FORTUNE_COPY[lamp.key];
      if (!fortune) return lamp;
      return {
        ...lamp,
        fortune,
        ...(lamp.key === 'head_guangcai'
          ? {gift:'特贈結緣－<strong>【廣財運通香2入組】</strong>。'}
          : {})
      };
    }),
    copy:{...config.copy, fortuneTag:'賜籤詩', fortuneLabel:'116年度慈賜籤詩'},
    page:{...config.page, fortuneNote:ANNUAL_FORTUNE_NOTE}
  };
}
/* 設定：內建預設（config.default.js）立即渲染；雲端設定抓回後若不同才重繪。 */
function setCfg(cfg){cfg=applyAnnualFortuneCopy(cfg);if(cfg.event==='lamp-116-dingwei')cfg={...cfg,agreements:[{"key":"agree1","title":"報名規則與注意事項","text":"我已閱讀並了解本法儀之報名規則及相關注意事項。","serverRequired":true},{"key":"agree2","title":"法儀取消與退費","text":"我了解完成報名及繳費後，法儀相關作業即開始進行，恕不受理取消或退費。","serverRequired":true},{"key":"agree3","title":"資料確認與修正","text":"我已確認填寫資料正確；如有明顯誤填或誤選，同意由行政團隊依報名資料協助修正。","serverRequired":true}]};if(cfg.event===DEFAULT_CFG.event){cfg={...cfg,page:{...cfg.page,sec02Note:'',lampsIntro:DEFAULT_CFG.page.lampsIntro}};}CFG=cfg;lampDefs=cfg.lamps.map(l=>({k:l.key,n:l.name,p:l.price,r:l.role}));products=cfg.products.map(p=>[p.name,p.price,p.limit==null?null:p.limit,false]);sponsors=cfg.sponsors.map(s=>[s.key,s.title,s.fixed]);registrationType=cfg.roleLabels;lampPurposes={};lampFortune={};hotKeys=new Set();cfg.lamps.forEach(l=>{lampPurposes[l.key]=l.purpose||'';if(l.fortune||l.gift)lampFortune[l.key]=[l.fortune,l.gift].filter(Boolean).join('<br>');if(l.hot)hotKeys.add(l.key)})}
const cfgVars=()=>({freeThreshold:'NT$'+Number(CFG.shipping.freeThreshold).toLocaleString('en-US'),shippingFee:'NT$'+Number(CFG.shipping.fee).toLocaleString('en-US'),deadline:String(CFG.meta.deadline||'').replace('T',' ').replace(/-/g,'/')});
const tpl=(s,extra)=>String(s==null?'':s).replace(/\{\{(\w+)\}\}/g,(m,k)=>{const v=Object.assign(cfgVars(),extra||{});return k in v?v[k]:m});
const rich=s=>esc(s).replace(/&lt;(\/?)(strong|b)&gt;/g,'<$1$2>').replace(/&lt;br\s*\/?&gt;/g,'<br>');
const cfgGet=path=>path.split('.').reduce((o,k)=>o==null?o:o[k],CFG);
window.LYYUAN_SIGNUP_WEBAPP_URL=window.LYYUAN_SIGNUP_WEBAPP_URL||'https://script.google.com/macros/s/AKfycbzVWhkaSoSIsBKTBcYnmbAg9Gbka0aBczkSQeAVsvWlz7a6rqByzwuCVlkykMnmTHRh/exec';
window.LYYUAN_SIGNUP_EVENT=window.LYYUAN_SIGNUP_EVENT||(()=>{try{const e=new URLSearchParams(location.search).get('event');return e&&/^[a-z0-9][a-z0-9-]{2,60}$/.test(e)?e:''}catch{return''}})()||'lamp-116-dingwei';const icon='<svg viewBox="0 0 40 50" fill="none" aria-hidden="true"><path d="M20 2v5M9 9h22M10 12c-8 10-8 17 0 25h20c8-8 8-15 0-25H10ZM9 40h22M20 40v8M15 43v4M25 43v4" stroke="currentColor" stroke-width="1.1"/><path d="M20 13v23M13 13c-4 10-4 15 0 23M27 13c4 10 4 15 0 23" stroke="currentColor" opacity=".45"/><ellipse cx="20" cy="25" rx="5" ry="8" fill="currentColor" opacity=".18"/></svg>';
function personHTML(l){const id=++uid,company=l.r==='公司',year=new Date().getFullYear()-1911;return `<div class="person"><div class="person-title">${company?'公司行號':'芳名'}資料</div><button type="button" class="remove">移除此位</button><label for="pn${id}" class="req">${company?'公司名稱':'姓名'}</label><input id="pn${id}" data-person-name required placeholder="${company?'公司行號全名':'請填芳名'}">${company?'':`<label for="cal${id}" class="req">曆別</label><select id="cal${id}" required><option value="">請先選擇國曆或農曆</option><option>國曆</option><option>農曆</option></select><label class="req" for="by${id}">出生年月日（民國）</label><div class="birth"><select id="by${id}" aria-label="民國出生年" required><option value="">民國年</option>${Array.from({length:year},(_,i)=>`<option value="${year-i}">民國 ${year-i} 年</option>`).join('')}</select><input aria-label="出生月" type="number" required min="1" max="12" placeholder="月"><input aria-label="出生日" type="number" required min="1" max="31" placeholder="日"></div>`}<label for="pa${id}" class="req">${company?'公司地址':'現居地址'}</label><input id="pa${id}" required placeholder="請填寫完整地址"></div>`}
function buildLamps(){
 const c=CFG.copy,order=CFG.roleOrder;
 $$('[role=tabpanel]').forEach(p=>p.innerHTML='');
 const sorted=[...lampDefs].sort((a,b)=>order.indexOf(a.r)-order.indexOf(b.r));
 sorted.forEach(l=>{
 const cl=CFG.lamps.find(x=>x.key===l.k),target='#lamp-'+cl.family;
$(target).insertAdjacentHTML('beforeend',`<article class="lamp" data-key="${l.k}"${cl.enabled===false?' hidden':''}><label class="lamp-head" for="check-${l.k}"><input type="checkbox" id="check-${l.k}" class="lamp-check"><span class="lamp-icon">${icon}</span><span class="lamp-name"><strong>${esc(registrationType[l.r])}</strong><small>${esc(l.n)}${l.r==='個人'?esc(c.personalSuffix):''}</small>${hotKeys.has(l.k)?`<span class="lamp-hot">${esc(c.hotTag)}</span>`:''}${lampFortune[l.k]?`<span class="lamp-fortune-tag">${esc(c.fortuneTag)}</span>`:''}</span><span class="price" data-price="${l.k}">${l.r==='個人'?money(l.p):`<small>${esc(c.pendingPrice)}</small>`}</span></label><p class="lamp-purpose">${esc(lampPurposes[l.k]||'')}${l.r==='個人'?'':'<br>'+esc(c.companyContact)}</p>${lampFortune[l.k]?`<p class="lamp-fortune"><span class="lamp-fortune-label">${esc(c.fortuneLabel)}</span><span class="lamp-fortune-text">${rich(lampFortune[l.k])}</span></p>`:''}<div class="people" hidden><p class="hint">${l.r==='個人'?esc(c.hintPersonal):esc(c.hintOther)}</p><div class="person-list"></div><button type="button" class="subbtn add-person">${l.r==='公司'?esc(c.addCompany):esc(c.addPerson)}</button></div></article>`)})}
function bindPeople(el, rowHTML){
 const check=el.querySelector('input[type=checkbox]');
 const people=el.querySelector('.people');
 const list=el.querySelector('.person-list');
 function sync(){
  el.classList.toggle('selected',check.checked);
  people.hidden=!check.checked;
  if(check.checked&&!list.children.length)list.innerHTML=rowHTML();
  people.querySelectorAll('input,select').forEach(input=>input.disabled=!check.checked);
 }
 check.onchange=()=>{sync();calc()};
 el.querySelector('.add-person').onclick=()=>{list.insertAdjacentHTML('beforeend',rowHTML());calc()};
 el.onclick=e=>{
  if(!e.target.matches('.remove'))return;
  e.target.closest('.person').remove();
  if(!list.children.length){check.checked=false;sync()}
  calc();
 };
 el.restorePeople=({selected,people:rows})=>{
  list.innerHTML=rows.map(()=>rowHTML()).join('');
  [...list.children].forEach((row,i)=>row.querySelectorAll('input,select').forEach((input,j)=>input.value=rows[i][j]??''));
  check.checked=selected;
  sync();
 };
}
function capturePeople(el){
 return {selected:el.querySelector('input[type=checkbox]').checked,people:[...el.querySelectorAll('.person')].map(row=>[...row.querySelectorAll('input,select')].map(input=>input.value))};
}

function sponsorRow(fixed){
 const id=++uid;
 return `<div class="person"><div class="person-title">贊助資料</div><button type="button" class="remove">移除此筆</button><label for="sn${id}" class="req">姓名</label><input id="sn${id}" required placeholder="請填寫姓名">${fixed?'':`<label for="sa${id}" class="req">隨喜金額（NT$）</label><input id="sa${id}" type="number" required min="1" max="9999999" step="1" placeholder="請填入金額">`}</div>`;
}
function buildSponsors(){
 $('#sponsorChoices').innerHTML='';
 sponsors.forEach(([key,title,fixed])=>{
  $('#sponsorChoices').insertAdjacentHTML('beforeend',`<article class="lamp" id="sponsor-${key}"><label class="lamp-head"><input type="checkbox" class="sponsor-check"><span class="lamp-icon">${icon}</span><span class="lamp-name"><strong>${title}</strong></span><span class="price">${fixed?money(fixed)+'／筆':'隨喜功德'}</span></label><div class="people" hidden><div class="person-list"></div><button type="button" class="subbtn add-person">＋ 新增一筆</button></div></article>`);
  bindPeople($('#sponsor-'+key),()=>sponsorRow(fixed));
 });
}
var editLocks=null;
function prodSig(){return $$('[data-quantity]').map(x=>Number(x.value)||0).join(',')}
function applyEditLocks(){
 if(!editLocks)return;
 if(editLocks.sig==null)editLocks.sig=prodSig();
 editLocks.lamps.forEach(k=>{const el=$(`[data-key="${k}"]`);if(!el)return;
  el.querySelectorAll('input,select,textarea,button').forEach(x=>x.disabled=true);
  el.classList.add('admin-locked');
  const head=el.querySelector('.lamp-head');
  if(head&&!el.querySelector('[data-locked-note]'))head.insertAdjacentHTML('afterend','<p class="hint lock-note" data-locked-note role="note">此項已由行政確認，如需更改請聯絡行政。</p>');
 });
}
function calc(){let lines=[],lamps=0,goods=0,hasGuang=false,pending=false;lampDefs.forEach(l=>{const el=$(`[data-key="${l.k}"]`);if(!el.querySelector('.lamp-check').checked)return;const count=el.querySelectorAll('.person').length;if(l.n==='廣財運通燈')hasGuang=true;if(l.r==='個人'){lamps+=l.p*count;lines.push([`${l.n}・個人燈 ${count} 位`,l.p*count])}else if(editLocks&&editLocks.lamps.includes(l.k)){lines.push([`${l.n}・${registrationType[l.r]} ${count} ${l.r==='公司'?'家':'位'}`,'已由行政確認'])}else{pending=true;lines.push([`${l.n}・${registrationType[l.r]} ${count} ${l.r==='公司'?'家':'位'}`,'待行政確認'])}});products.forEach(([n,p,stock],i)=>{const input=$(`[data-quantity="${i}"]`),raw=Number(input.value),valid=Number.isSafeInteger(raw)&&raw>=0&&(stock===null||raw<=stock);input.setCustomValidity(valid?'':stock===null?'請填寫零或正整數數量。':'請填寫 0 至 '+stock+' 的整數數量。');const qty=valid?raw:0;if(qty){goods+=qty*p;lines.push([n+' × '+qty,qty*p])}});let donation=0;
sponsors.forEach(([key,title,fixed])=>{
 const card=$('#sponsor-'+key);
 if(!card.querySelector('.sponsor-check').checked)return;
 card.querySelectorAll('.person').forEach(row=>{
  const [name,amount]=row.querySelectorAll('input');
  const cleanName=name.value.trim();
  name.setCustomValidity(cleanName?'':'請填寫姓名。');
  if(!cleanName||(amount&&!amount.validity.valid))return;
  const price=fixed||Number(amount.value);
  lines.push([title+'・'+cleanName,price]);
  donation+=price;
 });
});
// 登記人三個聯絡欄位始終必填，紅色星號不受燈別選擇影響。
['name','email','phone'].forEach(id=>{
 const field=$('#'+id);
 field.required=true;
 field.labels[0].classList.add('req');
});
const over=goods>0&&$('#overseas').checked,shipping=goods?(over?0:goods>=CFG.shipping.freeThreshold?0:CFG.shipping.fee):0;const shipLocked=!!(editLocks&&editLocks.shipping)&&over&&goods>0&&editLocks.sig===prodSig();if(goods)lines.push(['運費',over?(shipLocked?'已由行政確認':'海外另計'):shipping]);if(over&&goods&&!shipLocked)pending=true;currentTotal=lamps+goods+donation+shipping;currentPending=pending;$('#shippingFields').hidden=goods===0;$('#noShipping').hidden=goods>0;$('#overseas').disabled=goods===0||shipLocked;$('#address').disabled=goods===0;$('#address').required=goods>0;$('#addressLabel').classList.toggle('req',goods>0);$('#shippingMsg').classList.toggle('shipping-free',goods>0&&!over&&shipping===0);$('#shippingMsg').textContent=goods?(over?(shipLocked?'海外運費已由行政確認；若更改請購品，運費需由行政重新確認。':'海外運費由行政另行確認。'):shipping?`本次運費 NT$${CFG.shipping.fee}。`:'本次請購已達免運門檻。'):'僅登記點燈，無須運費。';$('#pendingHint').hidden=!pending;$('#totalLabel').textContent=pending?'目前可計算金額':'功德金總計';$('#totalNote').textContent=pending?'另有金額待行政確認':lines.length?'依本次登記項目即時計算':'請選擇燈別、贊助項目或請購品。';const hideTotal=!!(editLocks&&editLocks.totalHidden);$('#total').textContent=$('#mobileAmount').textContent=hideTotal?'請以確認信為準':money(currentTotal);if(hideTotal){$('#totalLabel').textContent='功德金總計';$('#totalNote').textContent='總金額請以確認信為準'}$('#sidebarRows').innerHTML=lines.length?lines.map(([n,p])=>`<div class="sumrow"><span>${esc(n)}</span><span>${typeof p==='number'?money(p):p}</span></div>`).join(''):'<p class="hint">尚未選擇登記項目</p>';$('#breakdown').innerHTML=(lines.length?lines:[['尚未選擇項目',0]]).map(([n,p])=>`<tr><td>${esc(n)}</td><td>${typeof p==='number'?money(p):p}</td></tr>`).join('')+`<tr><td><b>${pending?'目前可計算金額':'合計'}</b></td><td><b>${hideTotal?'請以確認信為準':money(currentTotal)}</b></td></tr>`}
$('#form').addEventListener('input',calc);$('#form').addEventListener('change',calc);
function activateTab(b){$$('[data-role]').forEach(x=>{const active=x===b;x.setAttribute('aria-selected',active);x.tabIndex=active?0:-1;$('#'+x.getAttribute('aria-controls')).hidden=!active})}function bindTabs(){const tabs=$$('[data-role]');tabs.forEach((b,i)=>{b.tabIndex=i? -1:0;b.onclick=()=>activateTab(b);b.onkeydown=e=>{if(['ArrowRight','ArrowLeft','Home','End'].includes(e.key)){e.preventDefault();const n=tabs.length,next=e.key==='Home'?0:e.key==='End'?n-1:(i+(e.key==='ArrowRight'?1:n-1))%n;activateTab(tabs[next]);tabs[next].focus()}}})}

$('#form').noValidate=true;$('#form').onsubmit=e=>{e.preventDefault();calc();const selected=$$('.lamp-check:checked').length||$$('[data-quantity]').some(x=>+x.value)||$$('.sponsor-check:checked').length;$('#lampError').textContent=selected?'':'請至少登記一項燈別、贊助或請購品。';if(!selected){$('#lanterns').scrollIntoView({block:'start'});return}const invalid=$('#form').querySelector(':invalid');if(invalid){const pane=invalid.closest('[role=tabpanel]');if(pane&&pane.hidden)activateTab($(`[aria-controls="${pane.id}"]`));invalid.reportValidity();invalid.focus();return}$('#result .eyebrow')&&($('#result .eyebrow').textContent='SIGNUP');$('#result h2').textContent='正在送出…';$('#resultBody').innerHTML=`<p>正在將報名資料送至靈元院報名表，請稍候。</p>`;const _rf=$('#result .result-foot');if(_rf)_rf.hidden=true;$('#result').showModal();return true};$$('#result .close,#result .closeResult').forEach(b=>b.onclick=()=>$('#result').close());
let records=[{id:'DEMO-001',name:'王小明',lamp:'太歲燈、廣財運通燈',amount:1800,status:'已核帳'},{id:'DEMO-002',name:'林美華',lamp:'破災降魔燈・總燈首',amount:null,status:'待確認'},{id:'DEMO-003',name:'陳怡君',lamp:'破災降魔燈',amount:680,status:'已回報匯款'}];function renderRecords(){const q=$('#search').value.trim(),status=$('#filterStatus').value;$('#adminRows').innerHTML=records.filter(r=>(!q||[r.id,r.name,r.lamp].join().includes(q))&&(!status||r.status===status)).map(r=>`<tr><td>${r.id.replace('DEMO-','登記-')}</td><td>${r.name}</td><td>${r.lamp}</td><td>${r.amount===null?'待確認':money(r.amount)}</td><td><span class="tag">${r.status}</span></td><td><button class="subbtn" data-detail="${r.id}">檢視</button></td></tr>`).join('')||'<tr><td colspan="6">查無符合的報名資料</td></tr>'}renderRecords();$('#search').oninput=renderRecords;$('#filterStatus').onchange=renderRecords;$('#adminRows').onclick=e=>{const id=e.target.dataset.detail;if(!id)return;const r=records.find(x=>x.id===id);$('#resultBody').innerHTML=`<p>${r.id.replace('DEMO-','登記-')}・${r.name}</p><p>${r.lamp}</p><p>金額：${r.amount===null?'待確認':money(r.amount)}｜狀態：${r.status}</p><p class="hint">版面操作示意，非雲端報名紀錄。</p>`;$('#result').showModal()};
function switchView(admin){$('#front').hidden=admin;$('#admin').hidden=!admin;const sv=$('#switchView');if(sv)sv.textContent=admin?'查看報名頁':'管理後台';window.scrollTo({top:0,behavior:'instant'})}const switchViewBtn=$('#switchView');if(switchViewBtn)switchViewBtn.onclick=()=>switchView($('#admin').hidden);const backFrontBtn=$('#backFront');if(backFrontBtn)backFrontBtn.onclick=()=>switchView(false);$$('[data-admin]').forEach(b=>b.onclick=()=>{$$('[data-admin]').forEach(x=>x.classList.toggle('on',x===b));$$('[data-admin-pane]').forEach(p=>p.hidden=p.dataset.adminPane!==b.dataset.admin)});$('#applyPrices').onclick=()=>{let defs=lampDefs.filter(l=>l.r==='個人');if(defs.some(l=>!$('#price-'+l.k).checkValidity()||$('#price-'+l.k).value==='')){$('#settingMsg').textContent='請填寫有效的非負整數金額。';return}defs.forEach(l=>{l.p=+$('#price-'+l.k).value;$(`[data-price="${l.k}"]`).textContent=money(l.p)});calc();$('#settingMsg').textContent='已套用至本頁，重新整理後還原。'};$('#applyText').onclick=()=>{$('h1').textContent=$('#editHero').value;if($('.banner-action p span')){$('.banner-action p span').textContent=$('#editSub').value;}$('#textMsg').textContent='已套用至報名頁，重新整理後還原。'};
if('IntersectionObserver'in window){const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('in');observer.unobserve(entry.target)}}),{threshold:.08});$$('.reveal').forEach(el=>observer.observe(el))}for(let i=0;i<12;i++){const p=document.createElement('i');p.className='mote';p.style.cssText=`left:${8+i*7.4}%;top:${20+(i*17)%60}%;animation-delay:-${i*.8}s;animation-duration:${8+i%5}s`;document.querySelector('.hero')?.append(p)}

const imageDialog=$('#imageDialog'),imageScroll=$('.image-scroll');$$('.poster-open').forEach(button=>button.addEventListener('click',()=>{const img=button.querySelector('img');const largeURL=new URL(img.src);if(largeURL.pathname.endsWith('/image-03.webp'))largeURL.pathname=largeURL.pathname.replace(/image-03\.webp$/,'image-03-hd.webp');$('#imageLarge').src=largeURL.href;$('#imageLarge').alt=img.alt;$('#imageTitle').textContent=button.getAttribute('aria-label').replace('放大閱讀：','');imageScroll.classList.remove('zoomed');$('#imageZoom').textContent='原尺寸閱讀';imageDialog.showModal();imageScroll.scrollTop=0;imageScroll.scrollLeft=0}));$('#imageClose').onclick=()=>imageDialog.close();$('#imageZoom').onclick=()=>{const zoomed=imageScroll.classList.toggle('zoomed');$('#imageZoom').textContent=zoomed?'符合視窗':'原尺寸閱讀'};imageDialog.addEventListener('click',e=>{if(e.target===imageDialog)imageDialog.close()});

/* —— 設定渲染：與雲端「活動內容設定」同一份結構；內建預設先渲染，雲端不同才重繪 —— */
function renderTabs(){
 const fam=CFG.families;
 $('.tabs').innerHTML=fam.map((f,i)=>`<button type="button" role="tab" id="tab-${f.id}" aria-selected="${i===0}" aria-controls="lamp-${f.id}" data-role="${esc(f.label)}">${esc(f.label)}</button>`).join('');
 $$('#lanterns [role=tabpanel]').forEach(x=>x.remove());
 $('.tabs').insertAdjacentHTML('afterend',fam.map((f,i)=>`<div id="lamp-${f.id}" role="tabpanel" aria-labelledby="tab-${f.id}"${i?' hidden':''}></div>`).join(''));
 bindTabs();
}
function renderZodiacCards(){
 const images=new Map([
  ['羊','<img class="zodiac-animal" src="./assets/taisui-ink-goat.webp" srcset="./assets/taisui-ink-goat.webp 1x, ./assets/taisui-ink-goat@2x.webp 2x, ./assets/taisui-ink-goat@3x.webp 3x" width="128" height="128" loading="lazy" decoding="async" alt="羊的生肖圖">'],
  ['牛','<img class="zodiac-animal" src="./assets/taisui-ink-ox.webp" srcset="./assets/taisui-ink-ox.webp 1x, ./assets/taisui-ink-ox@2x.webp 2x, ./assets/taisui-ink-ox@3x.webp 3x" width="128" height="128" loading="lazy" decoding="async" alt="牛的生肖圖">'],
  ['龍','<img class="zodiac-animal" src="./assets/taisui-ink-dragon.webp" srcset="./assets/taisui-ink-dragon.webp 1x, ./assets/taisui-ink-dragon@2x.webp 2x, ./assets/taisui-ink-dragon@3x.webp 3x" width="128" height="128" loading="lazy" decoding="async" alt="龍的生肖圖">'],
  ['狗','<img class="zodiac-animal" src="./assets/taisui-ink-dog.webp" srcset="./assets/taisui-ink-dog.webp 1x, ./assets/taisui-ink-dog@2x.webp 2x, ./assets/taisui-ink-dog@3x.webp 3x" width="128" height="128" loading="lazy" decoding="async" alt="狗的生肖圖">'],
 ]);
 $('#zodiacCards').innerHTML=CFG.zodiac.cards.map(c=>{const image=images.get(c.zodiac)||'';return `<article class="zodiac-card${c.emphasis?' zodiac-card-emphasis':''}${image?' zodiac-card-illustrated':''}"><div class="zodiac-copy"><h5>${esc(c.zodiac)}（${esc(c.relation)}）</h5>${c.emphasis?`<span class="zodiac-priority">${esc(c.tag)}</span>`:''}<p>${esc(c.text)}</p></div>${image}</article>`}).join('');
 $('#zodiacCards').hidden=false;$('#zodiacBars').hidden=true;$('#zodiacBars').innerHTML='';$('#zodiacBars').classList.remove('stats-ready');
}
function renderProducts(){
 $('#products').innerHTML=products.map(([n,p,stock],i)=>`<div class="product" data-product="${i}"><div class="desc">${esc(n)}</div><span class="price">${money(p)}</span><input style="width:78px;flex-shrink:0;padding:7px" type="number" min="0" step="1" ${stock!==null?'max="'+stock+'"':''} aria-label="${esc(n)}數量" data-quantity="${i}" value="0"></div>`).join('');
 const detailPoster=document.querySelector('#items .poster-open img').src;
 $$('[data-product]').forEach(row=>{const i=Number(row.dataset.product);if(!Number.isInteger(i)||!products[i])return;const cp=CFG.products[i],actual=cp.photo||'',src=actual||detailPoster;const button=document.createElement('button');button.type='button';button.className='product-thumb';button.setAttribute('aria-label','放大查看：'+products[i][0]);const img=document.createElement('img');img.src=src;img.alt=products[i][0]+(actual?'商品示意圖':'細則圖（非商品實照）');img.loading='lazy';button.append(img);const caption=document.createElement('span');caption.textContent=actual?'放大照片':'細則圖';button.append(caption);row.prepend(button);const d=document.createElement('small');d.textContent=tpl(cp.detail||'',{limit:cp.limit==null?'':cp.limit});row.querySelector('.desc').append(d);button.onclick=()=>{$('#imageLarge').src=src;$('#imageLarge').alt=img.alt;$('#imageTitle').textContent=products[i][0]+(actual?'':'・商品實照待補');imageScroll.classList.remove('zoomed');$('#imageZoom').textContent='原尺寸閱讀';imageDialog.showModal();imageScroll.scrollTop=0}});
}
function renderAgreements(){
 const box=$('#registrationTerms');box.querySelectorAll('label.choice').forEach(x=>x.remove());
 box.insertAdjacentHTML('beforeend',CFG.agreements.map(a=>`<label class="choice"><input type="checkbox" id="${esc(a.key)}" required><span>${esc(tpl(a.text))}</span></label>`).join(''));
}
function renderPriceSettings(){
 $('#priceSettings').innerHTML=lampDefs.filter(l=>l.r==='個人').map(l=>`<label for="price-${l.k}">${l.n}（每位芳名）</label><input id="price-${l.k}" type="number" min="0" step="1" value="${l.p}">`).join('');
}
function applyStaticCopy(){
 if(CFG.event===window.LYYUAN_SIGNUP_EVENT)document.title=CFG.meta.pageTitle;
 $$('[data-cfg]').forEach(el=>{const v=cfgGet(el.dataset.cfg);if(typeof v==='string')el.textContent=tpl(v)});
 $$('[data-cfg-html]').forEach(el=>{const v=cfgGet(el.dataset.cfgHtml);if(typeof v==='string')el.innerHTML=rich(tpl(v))});
 $$('[data-cfg-tail]').forEach(el=>{const v=cfgGet(el.dataset.cfgTail);let t=null;el.childNodes.forEach(n=>{if(n.nodeType===3&&n.nodeValue.trim())t=n});if(t&&typeof v==='string')t.nodeValue=tpl(v)});
 $$('img[data-img]').forEach(img=>{const c=(CFG.images||{})[img.dataset.img];if(!c)return;if(c.src&&img.getAttribute('src')!==c.src)img.setAttribute('src',c.src);if(typeof c.alt==='string')img.alt=c.alt;const b=img.closest('button');if(b&&c.label)b.setAttribute('aria-label','放大閱讀：'+c.label)});
 const dl=CFG.meta.deadline;{const note=previewMode?EVENT_PREVIEW_TEXT:EVENT_CLOSED_TEXT[eventStatus];if(note)$('.preview').append(document.createElement('br'),note)}if(dl){const banner=$('.preview');const passed=Date.parse(dl+(/[zZ]|[+-]\d\d:?\d\d$/.test(dl)?'':'+08:00'))<Date.now();const dn=tpl(passed?CFG.copy.deadlinePassed:CFG.copy.deadlineNote);if(dn)banner.append(document.createElement('br'),dn)}
}
function renderDynamic(){
 renderTabs();renderZodiacCards();buildLamps();lampDefs.forEach(l=>bindPeople($(`[data-key="${l.k}"]`),()=>personHTML(l)));buildSponsors();applyStaticCopy();renderProducts();renderAgreements();renderPriceSettings();calc();
 if(lastStats)applyStats(lastStats);
}
function snapKeyed(){
 const s={lamps:{},sponsors:{},qty:{},agree:{},tab:(document.querySelector('[data-role][aria-selected=true]')||{}).id||''};
 lampDefs.forEach(l=>{const el=$(`[data-key="${l.k}"]`);if(el)s.lamps[l.k]=capturePeople(el)});
 sponsors.forEach(([key])=>{const el=$('#sponsor-'+key);if(el)s.sponsors[key]=capturePeople(el)});
 products.forEach(([n],i)=>{const el=$(`[data-quantity="${i}"]`);if(el)s.qty[n]=el.value});
 $$('#registrationTerms input').forEach(x=>s.agree[x.id]=x.checked);
 return s;
}
function restoreKeyed(s){
 lampDefs.forEach(l=>{const el=$(`[data-key="${l.k}"]`);if(el&&s.lamps[l.k]&&s.lamps[l.k].selected){el.hidden=false;el.restorePeople(s.lamps[l.k])}});
 sponsors.forEach(([key])=>{const el=$('#sponsor-'+key);if(el&&s.sponsors[key]&&s.sponsors[key].selected)el.restorePeople(s.sponsors[key])});
 products.forEach(([n],i)=>{const el=$(`[data-quantity="${i}"]`);if(el&&s.qty[n]!=null)el.value=s.qty[n]});
 $$('#registrationTerms input').forEach(x=>{if(s.agree[x.id])x.checked=true});
 const tab=s.tab&&$('#'+s.tab);if(tab)activateTab(tab);
 applyEditLocks();calc();
}
setCfg(DEFAULT_CFG);renderDynamic();

// Session list contains only server-confirmed submissions; editing uses email tokens.
const previewEntries = new Map();
let editToken = null, editId = null, loadingEdit = false, submitting = false;
const formNode = $('#form');
function registrationName(data){return data.fields.name.trim()||data.sponsors.filter(item=>item.selected).flatMap(item=>item.people).map(([name])=>name.trim()).find(Boolean)||''}
const scalarIds = ['name','email','phone','overseas','address','last5','remitNote','cert','note'];
function captureRegistration(){
 const fields={}; scalarIds.forEach(id=>{const el=$('#'+id); if(el) fields[id]=el.type==='checkbox'?el.checked:el.value});
 return {fields,sponsors:sponsors.map(([key])=>capturePeople($('#sponsor-'+key))),lamps:lampDefs.map(l=>{const el=$(`[data-key="${l.k}"]`);return {key:l.k,selected:el.querySelector('.lamp-check').checked,people:[...el.querySelectorAll('.person')].map(p=>[...p.querySelectorAll('input,select')].map(x=>x.value))}}),quantities:$$('[data-quantity]').map(x=>x.value),agreements:$$('#registrationTerms input').map(x=>x.checked)};
}
function unlockPreview(){
 $$('.lamp input,.lamp select,.lamp button,[data-quantity]').forEach(x=>x.disabled=false);
 scalarIds.forEach(id=>{if($('#'+id))$('#'+id).disabled=false});
 $$('[data-locked-note]').forEach(x=>x.remove());
 $$('.admin-locked').forEach(x=>x.classList.remove('admin-locked'));
}
function restoreRegistration(data){
 unlockPreview();
 scalarIds.forEach(id=>{const el=$('#'+id);if(el)el.type==='checkbox'?el.checked=!!data.fields[id]:el.value=data.fields[id]??''});
 data.lamps.forEach(item=>{const el=$(`[data-key="${item.key}"]`);if(item.selected)el.hidden=false;el.restorePeople(item)});
 sponsors.forEach(([key],i)=>$('#sponsor-'+key).restorePeople(data.sponsors[i]));
 $$('[data-quantity]').forEach((x,i)=>x.value=data.quantities[i]??'0');
 $$('#registrationTerms input').forEach((x,i)=>x.checked=!!data.agreements[i]);calc();
}
const recordsDialog=document.createElement('dialog');recordsDialog.className='modal';recordsDialog.id='myRecordsDialog';recordsDialog.setAttribute('aria-label','查詢與修改報名');
recordsDialog.innerHTML='<button class="close" type="button" aria-label="關閉">×</button><h2>查詢／修改我的報名</h2><div class="notice">修改請使用確認信中的專屬連結。Gmail 收件匣中的確認信連結是正式修改途徑，請勿轉傳。</div><p class="hint">以下僅列出本次開啟期間成功送出的紀錄，重新整理後清除；雲端資料仍保留。</p><div id="myRecordsList"></div>';
document.body.append(recordsDialog);recordsDialog.querySelector('.close').onclick=()=>recordsDialog.close();
function showMyRecords(){
 $('#myRecordsList').innerHTML=previewEntries.size?[...previewEntries.values()].map(r=>`<p>${esc(r.id)}・${esc(registrationName(r.data))}</p>`).join(''):'<p>目前尚無本次開啟期間的紀錄。查詢或修改先前報名，請使用確認信中的專屬連結。</p>';
 recordsDialog.showModal();
}
$('#openMyRecords').onclick=showMyRecords;$('#heroMyRecords').onclick=showMyRecords;
function setEditButtons(active){$$('button[type="submit"]').filter(x=>x.form===formNode).forEach(x=>x.textContent=active?'儲存修改':'確認送出 →')}
function clearEditQuery(){const url=new URL(location.href);url.searchParams.delete('edit');history.replaceState(null,'',url)}
$('#cancelEdit').onclick=()=>{
 if(!confirm('離開後將放棄這次尚未儲存的修改，是否繼續？'))return;
 editToken=null;editId=null;editLocks=null;clearEditQuery();formNode.reset();
 restoreRegistration({fields:{},lamps:lampDefs.map(l=>({key:l.k,selected:false,people:[]})),sponsors:sponsors.map(()=>({selected:false,people:[]})),quantities:[],agreements:[]});
 $('#editBanner').hidden=true;setEditButtons(false);
};
// Convert API objects to the input-value arrays used by capture/restore.
function registrationFromApi(data){
 return {
  fields:data.fields||{},
  lamps:lampDefs.map(l=>{
   const item=(data.lamps||[]).find(item=>item.key===l.k);
   return {key:l.k,selected:!!item&&(item.selected??true),people:(item?.people||[]).map(p=>l.r==='公司'?[p.name,p.address]:[p.name,p.calendar,p.birthYear,p.birthMonth,p.birthDay,p.address])};
  }),
  sponsors:sponsors.map(([key])=>{
   const item=(data.sponsors||[]).find(item=>item.key===key);
   return {selected:!!item&&(item.selected??true),people:(item?.people||[]).map(p=>[p.name,p.amount])};
  }),
  quantities:products.map(([name])=>(data.products||[]).find(p=>p.name===name)?.qty??0),
  agreements:Array.from({length:CFG.agreements.length},(_,i)=>!!data.agreements?.['agree'+(i+1)])
 };
}
(async function loadEmailRegistration(){
 const params=new URLSearchParams(location.search);if(!params.has('edit'))return;
 const token=params.get('edit');loadingEdit=true;
 $('#editBanner').hidden=false;$('#editTitle').textContent='正在載入報名…';$('#cancelEdit').hidden=true;
 const blank=captureRegistration();
 try{
  if(!token)throw new Error('missing token');
  const url=new URL(window.LYYUAN_SIGNUP_WEBAPP_URL);url.searchParams.set('action','load');url.searchParams.set('token',token);
  const response=await fetch(url,{redirect:'follow'});if(!response.ok)throw new Error('load failed');
  const data=await response.json();if(data.ok!==true||!data.id)throw new Error('invalid token');
  restoreRegistration(registrationFromApi(data));editToken=token;editId=data.id;editLocks=data.locks||null;applyEditLocks();calc();
  $('#editTitle').textContent=`正在修改報名 ${editId}`;
  $('#editPolicy').textContent='修改完成後請按「儲存修改」，資料將更新至原報名。請勿轉傳專屬連結。';
  $('#cancelEdit').hidden=false;setEditButtons(true);
 }catch{
  editLocks=null;restoreRegistration(blank);clearEditQuery();
  $('#editTitle').textContent='無法載入報名資料';
  $('#editPolicy').textContent='修改連結可能無效或已過期，請確認使用確認信中的完整連結，或聯繫行政。下方空白表單仍可填寫新報名。';
 }finally{loadingEdit=false}
})();
const originalPreviewSubmit=formNode.onsubmit;
formNode.onsubmit=e=>{
 e.preventDefault();if(loadingEdit||submitting)return;
 if(originalPreviewSubmit(e)!==true)return;
 const data=captureRegistration(),savingEdit=!!editToken;
 submitting=true;
 (function sendSignupToSheet(regData){
   const endpoint=String(window.LYYUAN_SIGNUP_WEBAPP_URL||'').trim();
   const eyebrow=$('#result .eyebrow');
   const foot=$('#result .result-foot');
   const showFail=msg=>{
     if(eyebrow)eyebrow.textContent='SIGNUP FAILED';
     $('#result h2').textContent='送出失敗';
     if(foot)foot.hidden=true;
     $('#resultBody').innerHTML=`<p class="statusmsg error">${esc(msg)}</p><p class="hint">本頁仍保留本次填寫內容，請修正後再試，或聯繫行政。</p>`;
   };
   const showOk=(serverId,res)=>{
     const hiddenTotal=!!(res&&res.totals&&res.totals.hidden);
     if(res&&res.totals&&Number.isFinite(res.totals.computable)){currentTotal=res.totals.computable;currentPending=!!res.totals.pending}else if(hiddenTotal){currentPending=!!res.totals.pending}
     if(eyebrow)eyebrow.textContent='SIGNUP COMPLETE';
     $('#result h2').textContent=savingEdit?'已更新':'報名已送出';
     if(foot)foot.hidden=true;
     const who=esc(registrationName(regData)||'');
     $('#resultBody').innerHTML=`<p>${who}，${savingEdit?'報名資料已更新':'報名資料已送出'}。</p><p>報名編號：<b style="color:var(--gold)">${esc(serverId||'')}</b></p>${hiddenTotal?'<p>總金額請以確認信為準。</p>':`<p>${currentPending?'目前可計算金額':'功德金總計'}：<b style="color:var(--gold)">${money(currentTotal)}</b></p>`}${currentPending?'<p class="hint">另有項目待行政確認金額。</p>':''}<div class="notice">${$('#transferInfo').innerHTML}</div><p class="hint">請於收到行政確認通知後，再依通知金額匯款。本編號已寫入靈元院報名表。</p>${res&&res.priceAdjusted?'<p class="hint">金額已依最新價格設定重新計算。</p>':''}`;
   };
   if(!endpoint){showFail('報名後端尚未設定。');submitting=false;return;}
   const roleOf=k=>(lampDefs.find(l=>l.k===k)||{}).r||'';
   const nameOf=k=>(lampDefs.find(l=>l.k===k)||{}).n||'';
   const priceOf=k=>(lampDefs.find(l=>l.k===k)||{}).p||0;
   const payload={
     ...(savingEdit?{mode:'edit',token:editToken}:{}),
     event:window.LYYUAN_SIGNUP_EVENT||'lamp-116-dingwei',
     honeypot:($('#website')&&$('#website').value)||'',
     fields:regData.fields,
     lamps:regData.lamps.map(item=>({
       key:item.key,name:nameOf(item.key),role:roleOf(item.key),unitPrice:priceOf(item.key),selected:!!item.selected,
       people:(item.people||[]).map(vals=>{
         if((vals||[]).length>=6)return{name:vals[0],calendar:vals[1],birthYear:vals[2],birthMonth:vals[3],birthDay:vals[4],address:vals[5]};
         return{name:vals[0]||'',address:vals[1]||'',calendar:'',birthYear:'',birthMonth:'',birthDay:''};
       })
     })),
     sponsors:sponsors.map(([key,title,fixed],i)=>{
       const item=regData.sponsors[i]||{selected:false,people:[]};
       return{key,title,fixed:fixed||0,selected:!!item.selected,people:(item.people||[]).map(vals=>({name:vals[0]||'',amount:vals[1]||''}))};
     }),
     products:products.map(([n,p],i)=>({name:n,qty:Number(regData.quantities[i]||0)||0,unitPrice:p})),
     agreements:Object.fromEntries((regData.agreements||[]).map((v,i)=>['agree'+(i+1),!!v])),
     totals:{computable:currentTotal,pending:!!currentPending}
   };
   // 庫存 API 上線後才啟用；未取得後端即時庫存時不臆測、不阻斷原收單。
   const stockFailure = typeof window.LYYUAN_STOCK_VALIDATE==='function' ? window.LYYUAN_STOCK_VALIDATE(payload) : '';
   if(stockFailure){showFail(stockFailure);submitting=false;return;}
   fetch(endpoint,{method:'POST',mode:'cors',redirect:'follow',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)})
     .then(r=>r.json().catch(()=>({ok:false,error:'回應格式錯誤'})))
     .then(res=>{
       if(res&&res.ok===true&&res.id&&(!savingEdit||res.updated===true)){
         previewEntries.set(res.id,{id:res.id,data:regData});
         showOk(res.id,res);
       }else{
         showFail('寫入報名表失敗：'+((res&&res.error)||'未知錯誤'));
       }
     })
     .catch(()=>showFail('無法連線報名後端，請稍後再試或聯繫行政。'))
     .finally(()=>{submitting=false});
 })(data);
};

// Leaving a preview must never imply durable registration.
window.addEventListener('beforeunload',e=>{if(editToken){e.preventDefault();e.returnValue=''}});



// 雲端設定：每次載入只抓一次；與內建預設相同就什麼都不做，不同才重繪（保留已填內容）。
const canon=v=>JSON.stringify(v,(k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.keys(x).sort().reduce((o,key)=>(o[key]=x[key],o),{}):x);
function cfgLooksValid(c){
 const arr=a=>Array.isArray(a)&&a.length>0,num=n=>Number.isSafeInteger(n)&&n>=0;
 try{return c&&c.schema===1&&c.event===window.LYYUAN_SIGNUP_EVENT&&arr(c.families)&&arr(c.lamps)&&arr(c.products)&&Array.isArray(c.sponsors)&&arr(c.agreements)&&c.zodiac&&Array.isArray(c.zodiac.cards)&&c.shipping&&num(c.shipping.fee)&&num(c.shipping.freeThreshold)&&c.copy&&c.meta&&c.roleLabels&&Array.isArray(c.roleOrder)&&
  c.lamps.every(l=>l.key&&c.families.some(f=>f.id===l.family)&&['個人','公司','總燈首'].includes(l.role)&&num(l.price))&&c.products.every(p=>p.name&&num(p.price)&&(p.limit==null||(Number.isSafeInteger(p.limit)&&p.limit>0)))&&c.sponsors.every(x=>x.key&&x.title&&num(x.fixed))&&new Set(c.lamps.map(l=>l.key)).size===c.lamps.length&&new Set(c.products.map(p=>p.name)).size===c.products.length}catch{return false}
}
/* 非內建活動（?event=其他活動）：載入完成前整頁隱藏（<head> 內小段指令已先標記 data-ev），避免閃現預設活動內容；失敗時顯示說明文字，不顯示預設活動。 */
const BUILTIN_EV=DEFAULT_CFG.event===window.LYYUAN_SIGNUP_EVENT;
const PREVIEW_TOKEN=(()=>{try{const t=new URLSearchParams(location.search).get('preview');return t&&/^[A-Za-z0-9_-]{16,80}$/.test(t)?t:''}catch{return''}})();
function evGate(msg){const r=document.documentElement;if(!msg){r.removeAttribute('data-ev');r.removeAttribute('data-ev-msg');return}document.title='靈元院點燈報名';r.setAttribute('data-ev','unavailable');r.setAttribute('data-ev-msg',msg)}
function announceDeadline(){document.dispatchEvent(new CustomEvent('lyyuan-config',{detail:{deadline:CFG.meta.deadline||''}}))}
(async function loadCloudConfig(){
 let fail='';
 try{
  const url=new URL(window.LYYUAN_SIGNUP_WEBAPP_URL);url.searchParams.set('action','config');url.searchParams.set('event',window.LYYUAN_SIGNUP_EVENT);if(PREVIEW_TOKEN)url.searchParams.set('preview',PREVIEW_TOKEN);
  const response=await fetch(url,{redirect:'follow'});
  if(!response.ok)fail='net';else{
   const data=await response.json();
   if(data.ok!==true||data.event!==window.LYYUAN_SIGNUP_EVENT)fail=data&&data.status===404?'unknown':'net';
   else{
    const st=typeof data.status==='string'&&data.status?data.status:'開放',pv=data.preview===true&&st==='草稿';
    if(st!==eventStatus||pv!==previewMode){eventStatus=st;previewMode=pv;applyStaticCopy()}
    if(!cfgLooksValid(data.config))fail=st==='草稿'?'draft':'net';
    else if(canon(data.config)!==canon(CFG)&&!submitting){const snap=snapKeyed();setCfg(data.config);renderDynamic();restoreKeyed(snap)}
   }
  }
 }catch{fail='net'}
 if(BUILTIN_EV){announceDeadline();return} /* 內建活動：行為與以前相同，只多通知倒數條目前截止時間 */
 if(fail){evGate({unknown:'找不到這個活動，請確認網址是否正確。',draft:'本次活動尚未開放報名。'}[fail]||'目前無法載入活動內容，請稍後重新整理頁面。');return}
 evGate('');announceDeadline();
})();

// Read-only social proof: one request per page load, independent of registration.
function applyStats(stats){
 const proof=document.getElementById('signupProof'),bars=document.getElementById('zodiacBars');
 const countOf=value=>Number.isSafeInteger(value)&&value>=0?value:0;
 $$('.lamp-hot[data-stat]').forEach(x=>x.remove());
 const total=stats.totalSignups;
 if(total<CFG.stats.threshold){proof.hidden=true;proof.textContent='';return}
 proof.textContent=tpl(CFG.copy.signupProof,{count:total.toLocaleString('zh-TW')});
 proof.hidden=false;
 const families={};lampDefs.filter(l=>l.r==='個人').forEach(l=>{families[l.n]=l.k});
 const lamps=Array.isArray(stats.lamps)?stats.lamps:[];
 lamps.filter(lamp=>Object.hasOwn(families,lamp.name)&&countOf(lamp.count)>0)
  .sort((a,b)=>b.count-a.count).slice(0,CFG.stats.hotTopN).forEach(lamp=>{
   const card=document.querySelector(`.lamp[data-key="${families[lamp.name]}"] .lamp-name`);
   if(!card||card.querySelector('.lamp-hot'))return;
   const tag=document.createElement('span');
   tag.className='lamp-hot';tag.dataset.stat='1';
   tag.textContent=CFG.copy.hotTag;
   card.append(tag);
  });
 const zodiacs=CFG.zodiac.cards.map(c=>c.zodiac);
 const counts=stats.taisuiFanZodiacs?.counts;
 if(!Array.isArray(counts)||!zodiacs.every(zodiac=>counts.filter(item=>item?.zodiac===zodiac).length===1&&counts.some(item=>item?.zodiac===zodiac&&Number.isSafeInteger(item.count)&&item.count>=0)))return;
 const rows=zodiacs.map(zodiac=>({zodiac,count:counts.find(item=>item.zodiac===zodiac).count})).sort((a,b)=>b.count-a.count);
 const max=Math.max(1,...rows.map(row=>row.count));
 bars.innerHTML='';
 rows.forEach((row,index)=>{
  const item=document.createElement('div');
  item.className='zodiac-row';
  const label=document.createElement('p');
  label.textContent=tpl(CFG.copy.zodiacBar,{zodiac:row.zodiac,count:row.count.toLocaleString('zh-TW')})+(index===0&&row.count>0?CFG.copy.zodiacTop:'');
  const track=document.createElement('div');
  track.className='zodiac-track';
  track.setAttribute('aria-hidden','true');
  const fill=document.createElement('span');
  fill.style.setProperty('--bar-width',`${row.count/max*100}%`);
  track.append(fill);
  item.append(label,track);
  bars.append(item);
 });
 document.getElementById('zodiacCards').hidden=true;
 bars.hidden=false;
 // Commit the initial zero width before the single animation start.
 void bars.offsetWidth;
 requestAnimationFrame(()=>bars.classList.add('stats-ready'));
}
(async function loadSignupStats(){
 try{
  if(!document.getElementById('signupProof')||!document.getElementById('zodiacBars'))return;
  const url=new URL(window.LYYUAN_SIGNUP_WEBAPP_URL);url.searchParams.set('action','stats');url.searchParams.set('event',window.LYYUAN_SIGNUP_EVENT);
  const response=await fetch(url);
  if(!response.ok)return;
  const stats=await response.json();
  if(stats.ok!==true||stats.event!==window.LYYUAN_SIGNUP_EVENT||!Number.isSafeInteger(stats.totalSignups)||stats.totalSignups<0)return;
  lastStats=stats;applyStats(stats);
 }catch{ /* Keep the static zodiac cards when stats are unavailable. */ }
})();
