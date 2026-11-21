(()=>{'use strict';
const $=(selector,ctx=document)=>ctx.querySelector(selector);
const $$=(selector,ctx=document)=>Array.from(ctx.querySelectorAll(selector));
const fmt=amount=>'NT$ '+Number(amount).toLocaleString('en-US');
const DEADLINE_MAIN=new Date('2026-12-21T23:59:00+08:00').getTime();
const DEADLINE_MASTER=new Date('2026-12-03T23:59:00+08:00').getTime();
const lamps=[
 {id:'source',name:'主神靈脈燈',color:'#ad5746',personal:888},
 {id:'immortals',name:'諸仙靈氣燈',color:'#865c82',personal:688},
 {id:'sensing',name:'靈通感應燈',color:'#476d9e',personal:688},
 {id:'merit',name:'福報善業燈',color:'#a77c39',personal:688},
 {id:'longevity',name:'長壽續命燈',color:'#497e64',personal:688}
];
const sponsors=[
 {id:'dharma',name:'建院護法燈',price:6000},
 {id:'completion',name:'建院圓滿燈',price:1000},
 {id:'lingshan',name:'靈山派護持燈',price:1280},
 {id:'garden',name:'景觀園藝贊助',price:200},
 {id:'statue',name:'神像供具贊助',price:null},
 {id:'equipment',name:'硬體設備贊助',price:null}
];
let rowId=0;let bannerObjectUrl=null;
const previewRecords=[];
let editingRecordId=null;
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const roleKey=(lamp,role)=>lamp+'-'+role;
const roleDefs=[{key:'master',name:'總功德主',limit:3,deadline:DEADLINE_MASTER,price:null}];
for(const lamp of lamps){
 roleDefs.push({key:roleKey(lamp.id,'head'),name:lamp.name+'・燈首',role:'燈首',limit:2,deadline:DEADLINE_MASTER,price:null,deliver:true});
 roleDefs.push({key:roleKey(lamp.id,'deputy'),name:lamp.name+'・副燈首',role:'副燈首',limit:3,deadline:DEADLINE_MAIN,price:null});
 roleDefs.push({key:roleKey(lamp.id,'personal'),name:lamp.name+'・個人燈',role:'個人燈',limit:null,deadline:DEADLINE_MAIN,price:lamp.personal});
}
const defByKey=Object.fromEntries(roleDefs.map(d=>[d.key,d]));
function personMarkup(sponsor=false,variableDonation=false,spiritualInquiry=false,familyNames=false){
 const i=++rowId;
 if(sponsor)return '<div class="person-entry"><div class="person-title"><button class="remove-person" type="button">移除此筆</button></div><div class="person-fields"><div class="wide"><label for="person-'+i+'">芳名<span class="req">＊</span></label><input id="person-'+i+'" data-person-name required autocomplete="off" placeholder="請填芳名"></div>'+(variableDonation?'<div class="wide"><label for="amount-'+i+'">隨喜金額（NT$）<span class="req">＊</span></label><input id="amount-'+i+'" data-donation-amount required type="number" min="1" step="1" inputmode="numeric" placeholder="請填金額"></div>':'')+'</div></div>';
 const currentMinguoYear=new Date().getFullYear()-1911;
 const years=Array.from({length:currentMinguoYear},(_,i)=>'<option value="'+(currentMinguoYear-i)+'">民國 '+(currentMinguoYear-i)+' 年</option>').join('');
 const inquiry=spiritualInquiry?'<div class="wide spiritual-question"><label for="inquiry-'+i+'">靈修釋疑</label><p class="spiritual-question-note">敬請留意：每人僅限提出一項靈修疑問。本項諮詢並非通靈問事，敬請勿填寫涉及個人主神、靈脈、元神等相關詢問內容。為利後續釋疑回覆，煩請詳述您的疑問及相關情況；若內容尚有不足之處，將再請您補充說明，感謝您的理解與配合。</p><textarea id="inquiry-'+i+'" data-spiritual-question rows="4" placeholder="如需釋疑，請在此詳述一項靈修疑問"></textarea></div>':'';
 return '<div class="person-entry"><div class="person-title"><b>點燈芳名</b><button class="remove-person" type="button">移除此位</button></div><div class="person-fields"><div><label for="person-'+i+'">姓名<span class="req">＊</span></label><input id="person-'+i+'" data-person-name required autocomplete="off" placeholder="請填芳名"></div><div><label for="cal-'+i+'">曆別<span class="req">＊</span></label><select id="cal-'+i+'" data-calendar required><option value="">請先選擇國曆或農曆</option><option>國曆</option><option>農曆</option></select></div><div class="wide"><label>出生年月日（民國）<span class="req">＊</span></label><div class="birth-row"><select data-birth-year aria-label="民國出生年" required><option value="">民國年</option>'+years+'</select><input data-birth-month aria-label="出生月" inputmode="numeric" required type="number" min="1" max="12" placeholder="月"><input data-birth-day aria-label="出生日" inputmode="numeric" required type="number" min="1" max="31" placeholder="日"></div></div><div class="wide"><label for="addr-'+i+'">現居地址<span class="req">＊</span></label><input id="addr-'+i+'" data-home-address required autocomplete="off" placeholder="請填寫完整地址"></div>'+inquiry+(familyNames?'<div class="wide family-names"><label for="family-'+i+'">闔家姓名</label><p class="family-names-note">請填寫要一起列入疏文及牌位的闔家成員姓名，多位請以頓號或換行分隔。</p><textarea id="family-'+i+'" data-family-names rows="3" placeholder="例如：王大明、王小華、王美麗"></textarea></div>':'')+'</div></div>';
}
function roleMarkup(d){
 const priced=d.price!=null;
 const eligibility=d.key==='master'?'<div class="eligibility"><b>總功德主・115年資格自述</b><p>須於乙巳年（2025年）三場聖誕懺儀中，至少兩場登記燈首以上，且必須包含「無極老母聖誕」。</p><label><input type="checkbox" value="guanyin" data-qual> 2025 觀音菩薩聖誕</label><label><input type="checkbox" value="yaochi" data-qual> 2025 瑤池金母聖誕</label><label><input type="checkbox" value="wuji" data-qual> 2025 無極老母聖誕</label></div>':'';
 const delivery=(d.deliver||d.key==='master')?'<div class="delivery-field"><label>紙本符令與祈請迴向文寄送地址<span class="req">＊</span></label><input data-delivery-address autocomplete="off" placeholder="郵遞區號、縣市、鄉鎮市區、路街門牌"></div>':'';
 const caption=d.limit!=null?'尚可報名 '+d.limit+' 位｜'+(d.deadline===DEADLINE_MASTER?'115/12/03':'115/12/21')+' 23:59 截止':'';
 return '<article class="role-card" data-role-key="'+d.key+'" data-limit="'+(d.limit??'')+'"><label class="role-head"><input type="checkbox" class="role-check"><span><span class="role-name">'+d.name+'</span><span class="role-limit" data-status>'+caption+'</span></span><span class="role-price">'+(priced?fmt(d.price)+'／位':'金額待核定')+'</span></label><div class="role-details" hidden>'+eligibility+'<div class="people-list"></div><button class="add-person" type="button">＋ 新增芳名</button>'+delivery+'</div></article>';
}
$('#master-choice').innerHTML=roleMarkup(roleDefs[0]);
$('#lamp-tabs').innerHTML=lamps.map((l,i)=>'<button type="button" role="tab" data-lamp-tab="'+l.id+'" id="tab-'+l.id+'" aria-controls="panel-'+l.id+'" aria-selected="'+(i===0)+'"><span class="dot" style="background:'+l.color+'"></span>'+l.name+'</button>').join('');
$('#lamp-panels').innerHTML=lamps.map((l,i)=>'<section class="lamp-panel" id="panel-'+l.id+'" role="tabpanel" aria-labelledby="tab-'+l.id+'" '+(i?'hidden':'')+'>'+roleDefs.filter(d=>d.key.startsWith(l.id+'-')).map(roleMarkup).join('')+'</section>').join('');
$('#sponsor-choices').className='sponsor-grid';
$('#sponsor-choices').innerHTML=sponsors.map(s=>'<article class="sponsor-card" data-sponsor="'+s.id+'" data-price="'+(s.price==null?'variable':s.price)+'"><label class="sponsor-head"><input type="checkbox" class="sponsor-check"><span>'+s.name+'<b>'+(s.price==null?'隨喜金額':fmt(s.price)+'／筆')+'</b></span></label><div class="sponsor-people" hidden><div class="people-list"></div><button type="button" class="add-person">＋ 新增芳名</button></div></article>').join('');
$('#capacity-settings').innerHTML=roleDefs.map(d=>'<div class="cap-row"><span>'+d.name+'</span><label>示意已用 <input aria-label="'+d.name+'示意已使用名額" type="number" min="0" max="'+(d.limit??100)+'" value="0" data-used="'+d.key+'"></label><small>'+(d.limit==null?'不限名額':'總上限 '+d.limit+' 位')+'</small></div>').join('');
const liveUsed={};let ownCounts={};let editMode=false;
function setEditMode(on,counts){editMode=Boolean(on);ownCounts=on?Object.assign({},counts||{}):{};}
function usedSeats(key){return Math.max(0,(liveUsed[key]||0)-(ownCounts[key]||0));}
function maxAvailable(d){return d.limit==null?Infinity:Math.max(0,d.limit-usedSeats(d.key));}
function refreshAvailability(){
 const now=Date.now();
 $$('.role-card').forEach(card=>{
  const d=defByKey[card.dataset.roleKey],check=$('.role-check',card),count=$$('.person-entry',card).length;
  const closed=now>=d.deadline||maxAvailable(d)===0;const keep=check.checked&&(ownCounts[d.key]||0)>0;
  if(closed&&check.checked&&!keep){check.checked=false;$('.role-details',card).hidden=true;card.classList.remove('selected');}
  check.disabled=closed&&!keep;card.classList.toggle('is-closed',closed);
  const status=$('[data-status]',card);
  status.textContent=(now>=d.deadline?'報名已截止':d.limit==null?'':'尚可報名 '+maxAvailable(d)+' 位｜'+(d.deadline===DEADLINE_MASTER?'115/12/03':'115/12/21')+' 23:59 截止');
  const add=$('.add-person',card);if(add)add.disabled=(d.limit!=null&&count>=maxAvailable(d))||(now>=d.deadline&&count>=(ownCounts[d.key]||0));
 });
 if(now>=DEADLINE_MAIN&&!editMode){$$('.sponsor-check').forEach(c=>{c.disabled=true;c.checked=false;const box=c.closest('.sponsor-card');$('.sponsor-people',box).hidden=true});}
 calculate();
}
function selectTab(id){
 $$('[data-lamp-tab]').forEach(btn=>btn.setAttribute('aria-selected',String(btn.dataset.lampTab===id)));
 $$('.lamp-panel').forEach(panel=>{panel.hidden=panel.id!=='panel-'+id});
}
$('#lamp-tabs').addEventListener('click',e=>{const btn=e.target.closest('[data-lamp-tab]');if(btn)selectTab(btn.dataset.lampTab)});
document.addEventListener('change',e=>{
 const t=e.target;
 if(t.matches('.role-check,.sponsor-check')){
  const card=t.closest('.role-card,.sponsor-card');const detail=$('.role-details,.sponsor-people',card);
  detail.hidden=!t.checked;card.classList.toggle('selected',t.checked);
  if(t.checked&&!$('.person-entry',card))$('.people-list',card).insertAdjacentHTML('beforeend',personMarkup(card.classList.contains('sponsor-card'),card.dataset.price==='variable',card.dataset.roleKey?.endsWith('-deputy'),card.dataset.roleKey==='master'));
  calculate();
 }else if(t.matches('[data-used]'))refreshAvailability();
});
document.addEventListener('input',e=>{if(e.target.matches('[data-used]'))refreshAvailability();else if(e.target.closest('#offering-form'))calculate()});
document.addEventListener('click',e=>{
 const add=e.target.closest('.add-person');
 if(add){
  const card=add.closest('.role-card,.sponsor-card');const d=card.dataset.roleKey?defByKey[card.dataset.roleKey]:null;
  if(d&&($$('.person-entry',card).length>=maxAvailable(d)||(Date.now()>=d.deadline&&$$('.person-entry',card).length>=(ownCounts[d.key]||0))))return;
  $('.people-list',card).insertAdjacentHTML('beforeend',personMarkup(card.classList.contains('sponsor-card'),card.dataset.price==='variable',card.dataset.roleKey?.endsWith('-deputy'),card.dataset.roleKey==='master'));
  refreshAvailability();return;
 }
 const remove=e.target.closest('.remove-person');
 if(remove){const card=remove.closest('.role-card,.sponsor-card');remove.closest('.person-entry').remove();
  if(!$('.person-entry',card)){const check=$('.role-check,.sponsor-check',card);check.checked=false;$('.role-details,.sponsor-people',card).hidden=true;card.classList.remove('selected');}
  refreshAvailability();
 }
});
function calculate(){
 let sum=0;let pending=0;const items=[];
 $$('.role-card').forEach(card=>{
  if(!$('.role-check',card).checked)return;
  const d=defByKey[card.dataset.roleKey],n=$$('.person-entry',card).length;
  if(d.price==null){pending++;items.push({label:d.name+' × '+n+'位',amount:null});}
  else {const value=d.price*n;sum+=value;items.push({label:d.name+' × '+n+'位',amount:value});}
 });
 $$('.sponsor-card').forEach(card=>{
  if(!$('.sponsor-check',card).checked)return;
  const s=sponsors.find(s=>s.id===card.dataset.sponsor),n=$$('.person-entry',card).length;
  const amounts=$$('[data-donation-amount]',card);
  const missingAmount=amounts.some(x=>!x.value||Number(x.value)<=0);
  const value=s.price==null?amounts.reduce((total,x)=>total+Math.max(0,Number(x.value)||0),0):s.price*n;
  sum+=value;items.push({label:s.name+' × '+n+'筆',amount:value,missingAmount});
 });
 const body=$('#breakdown');
 body.innerHTML='';
 if(items.length===0){const tr=document.createElement('tr');const td=document.createElement('td');td.colSpan=2;td.textContent='尚未選擇項目';tr.appendChild(td);body.appendChild(tr);}
 else items.forEach(item=>{const tr=document.createElement('tr'),a=document.createElement('td'),b=document.createElement('td');a.textContent=item.label;b.textContent=item.missingAmount?'待填金額':item.amount==null?'待核定':fmt(item.amount);tr.append(a,b);body.appendChild(tr);});
 $('#total-amount').textContent=$('#sidebar-total').textContent=fmt(sum);
 $('#pending-prices').hidden=!pending;
 const panel=$('#summary-lines');panel.innerHTML='';
 if(!items.length)panel.textContent='尚未勾選點燈項目';
 else items.forEach(item=>{const div=document.createElement('div'),a=document.createElement('span'),b=document.createElement('em');div.className='summary-row';a.textContent=item.label;b.textContent=item.missingAmount?'待填金額':item.amount==null?'待核定':fmt(item.amount);div.append(a,b);panel.appendChild(div)});
}
$('#lookup-button').addEventListener('click',()=>{if(window.WujiDraft?.showRecords)window.WujiDraft.showRecords();else $('#lookup-message').hidden=false});
function switchView(value){
 $('#front-view').hidden=value!=='front';$('#admin-view').hidden=value!=='admin';
 $$('[data-view]').forEach(button=>{const yes=button.dataset.view===value;button.classList.toggle('active',yes);button.setAttribute('aria-pressed',String(yes));});
 window.scrollTo({top:0,behavior:'instant'});
}
$$('[data-view]').forEach(button=>button.addEventListener('click',()=>switchView(button.dataset.view)));
$$('[data-admin]').forEach(button=>button.addEventListener('click',()=>{
 const key=button.dataset.admin;
 $$('[data-admin]').forEach(b=>b.classList.toggle('active',b===button));
 $$('.admin-pane').forEach(pane=>pane.hidden=pane.id!=='admin-'+key);
}));
function updateClock(){
 const now=Date.now(),ms=Math.max(0,DEADLINE_MAIN-now);
 const days=Math.ceil(ms/86400000);
 $('#days-left').textContent=ms===0?'0':String(days);
 const whole=Math.floor(ms/1000),dd=Math.floor(whole/86400),hh=Math.floor(whole%86400/3600),mm=Math.floor(whole%3600/60),ss=whole%60;
 $('#countdown-ticks').textContent=ms===0?'本次點燈報名已截止':dd+' 天　'+String(hh).padStart(2,'0')+' 時　'+String(mm).padStart(2,'0')+' 分　'+String(ss).padStart(2,'0')+' 秒';
 refreshAvailability();
}
$('#offering-form').addEventListener('submit',e=>{
 e.preventDefault();
 const feedback=$('#form-feedback');feedback.hidden=false;
 const registrant=['#registrant-name','#registrant-email','#registrant-phone'].map(selector=>$(selector));
 if(registrant.some(input=>!input.value.trim())||!$('#registrant-email').checkValidity()){
  feedback.textContent='請先填妥登記人姓名、有效電子郵件及行動電話／Telegram。';return;
 }
 const selected=$$('.role-check:checked,.sponsor-check:checked');
 if(!selected.length){feedback.textContent='請先勾選至少一項點燈或隨喜功德。';return;}
 const master=$('[data-role-key="master"]');
 if($('.role-check',master).checked){
  const picks=$$('[data-qual]:checked',master).map(x=>x.value);
  if(picks.length<2||!picks.includes('wuji')){feedback.textContent='總功德主資格自述須勾選至少兩場，並包含2025年無極老母聖誕。';return;}
 }
 if($$('.required-agreement:checked').length!==3){feedback.textContent='請閱讀並勾選三項報名注意事項。';return;}
 const overLimit=roleDefs.some(d=>{
  const card=$('[data-role-key="'+d.key+'"]');
  return $('.role-check',card).checked&&d.limit!=null&&$$('.person-entry',card).length>maxAvailable(d);
 });
 if(overLimit){feedback.textContent='目前填寫芳名超過剩餘名額，請調整。';return;}
 const missing=$$('.role-card.selected .person-entry input:not([type=checkbox]),.role-card.selected .person-entry select,.sponsor-card.selected .person-entry input').some(input=>!String(input.value||'').trim());
 if(missing){feedback.textContent='已選擇的芳名資料尚有空白欄位，請檢查姓名、曆別、出生日期及現居地址。';return;}
 const invalid=$$('.role-card.selected [data-birth-month],.role-card.selected [data-birth-day],.sponsor-card.selected [data-donation-amount]').some(input=>!input.checkValidity()||Number(input.value)<Number(input.min));
 if(invalid){feedback.textContent='出生月日或隨喜金額不符合填寫範圍，請檢查。';return;}
 const noDelivery=$$('.role-card.selected [data-delivery-address]').some(input=>!input.value.trim());
 if(noDelivery){feedback.textContent='總功德主與燈首請填寫符令寄送地址。';return;}
 if(!$('#remit-last-five').checkValidity()||!/^\d{5}$/.test($('#remit-last-five').value.trim())){feedback.textContent='請依太歲燈登記格式填寫匯款帳號後五碼（五位數字）。';$('#remit-last-five').focus();return;}
 if(!$('#remit-reference').value.trim()){feedback.textContent='請填寫備註附言。';$('#remit-reference').focus();return;}
 feedback.textContent='資料送出中，請稍候…';
 if(window.WujiDraft?.submitLive)window.WujiDraft.submitLive(feedback);else feedback.textContent='系統載入中，請稍後再按一次確認送出。';
});
$('#banner-upload').addEventListener('change',e=>{
 const file=e.target.files?.[0];if(!file)return;
 if(!/^image\/(png|jpeg|webp)$/.test(file.type)){alert('請選擇 PNG、JPEG 或 WebP 圖片');return;}
 if(bannerObjectUrl)URL.revokeObjectURL(bannerObjectUrl);
 bannerObjectUrl=URL.createObjectURL(file);$('#hero-banner').src=bannerObjectUrl;
});
const sheetURL='https://docs.google.com/spreadsheets/d/1DvfDmmpAf7RJAT7JDlvqZT4zdjYeFo8CwR3ZsvSAVME/edit#gid=1876276825';
const link=document.createElement('a');link.href=sheetURL;link.target='_blank';link.rel='noopener noreferrer';link.textContent='開啟靈元院報名表（行政權限）';$('#sheet-link-holder').textContent='';$('#sheet-link-holder').appendChild(link);
window.WujiDraft={roleDefs,sponsors,personMarkup,calculate,refreshAvailability,switchView,selectTab,fmt,previewRecords,escapeHTML,liveUsed,setEditMode};
window.addEventListener('load',()=>$$('.global-site-nav a[href^="/"]').forEach(a=>{a.href='https://lyyuan.tw'+a.getAttribute('href')}));
updateClock();setInterval(updateClock,1000);calculate();
})();
