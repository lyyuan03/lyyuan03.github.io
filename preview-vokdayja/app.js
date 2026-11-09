
'use strict';const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],money=n=>'NT$ '+Number(n).toLocaleString('zh-TW'),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const lampDefs=[['taisui','太歲燈',600,'個人'],['pozai','破災降魔燈',680,'個人'],['guangcai','廣財運通燈',1200,'個人'],['head_taisui','太歲燈',0,'總燈首'],['head_pozai','破災降魔燈',0,'總燈首'],['head_guangcai','廣財運通燈',0,'總燈首'],['co_pozai','破災降魔燈',0,'公司'],['co_guangcai','廣財運通燈',0,'公司']].map(([k,n,p,r])=>({k,n,p,r}));const products=[['廣財運通香（單盒）',3750,null,false],['【會員特惠】廣財運通香・全年修持組 3 盒',9563,null,false],['【一般信眾優惠】廣財運通香・全年修持組 3 盒',10125,null,false],['【會員特惠】鎮煞護安香粉・全家護安套組 3 包',1673,null,false],['【一般信眾優惠】鎮煞護安香粉・全家護安套組 3 包',1938,null,false],['元神光彩御守',888,66,false],['財富滿堂御守',688,null,false],['事業成就御守',688,null,false],['感情緣滿御守',688,null,false]];let uid=0,currentTotal=0,currentPending=false;
window.LYYUAN_SIGNUP_WEBAPP_URL=window.LYYUAN_SIGNUP_WEBAPP_URL||'https://script.google.com/macros/s/AKfycbzVWhkaSoSIsBKTBcYnmbAg9Gbka0aBczkSQeAVsvWlz7a6rqByzwuCVlkykMnmTHRh/exec';
window.LYYUAN_SIGNUP_EVENT=window.LYYUAN_SIGNUP_EVENT||'lamp-116-dingwei';const icon='<svg viewBox="0 0 40 50" fill="none" aria-hidden="true"><path d="M20 2v5M9 9h22M10 12c-8 10-8 17 0 25h20c8-8 8-15 0-25H10ZM9 40h22M20 40v8M15 43v4M25 43v4" stroke="currentColor" stroke-width="1.1"/><path d="M20 13v23M13 13c-4 10-4 15 0 23M27 13c4 10 4 15 0 23" stroke="currentColor" opacity=".45"/><ellipse cx="20" cy="25" rx="5" ry="8" fill="currentColor" opacity=".18"/></svg>';
function personHTML(l){const id=++uid,company=l.r==='公司',year=new Date().getFullYear()-1911;return `<div class="person"><div class="person-title">${company?'公司行號':'芳名'}資料</div><button type="button" class="remove">移除此位</button><label for="pn${id}" class="req">${company?'公司名稱':'姓名'}</label><input id="pn${id}" data-person-name required placeholder="${company?'公司行號全名':'請填芳名'}">${company?'':`<label for="cal${id}" class="req">曆別</label><select id="cal${id}" required><option value="">請先選擇國曆或農曆</option><option>國曆</option><option>農曆</option></select><label class="req" for="by${id}">出生年月日（民國）</label><div class="birth"><select id="by${id}" aria-label="民國出生年" required><option value="">民國年</option>${Array.from({length:year},(_,i)=>`<option value="${year-i}">民國 ${year-i} 年</option>`).join('')}</select><input aria-label="出生月" type="number" required min="1" max="12" placeholder="月"><input aria-label="出生日" type="number" required min="1" max="31" placeholder="日"></div>`}<label for="pa${id}" class="req">${company?'公司地址':'現居地址'}</label><input id="pa${id}" required placeholder="請填寫完整地址"></div>`}
const lampPurposes={"head_taisui": "安奉個人專屬祿位，祈願化解流年沖犯、安定元神，護持全年平安。", "head_pozai": "安奉個人專屬祿位，祈願消災解厄、降伏心魔，護持身心安定。", "head_guangcai": "安奉個人專屬祿位，祈願廣納財氣、財運亨通。", "co_pozai": "安奉公司行號專屬祿位，祈願營運平順、人事和合，減少事業阻礙。", "co_guangcai": "安奉公司行號專屬祿位，祈願財源順暢、貴人相助，護持事業開展。", "taisui": "安奉總祿位，祈願化解流年沖犯，護持個人平安、運勢安定。", "pozai": "安奉總祿位，祈願消災解厄、安定元神，減少生活中的阻礙。", "guangcai": "安奉總祿位，祈願廣納財氣、財運亨通，培養富足善緣。"};
const registrationType={總燈首:'總燈首',公司:'公司行號燈',個人:'個人燈'};
const lampFortune = {
 head_taisui: '116年個人專屬<strong>【歲序康泰】</strong>籤詩。',
 head_pozai: '116年個人專屬<strong>【福慧勵業】</strong>籤詩。',
 head_guangcai: '116年個人專屬<strong>【財祿運勢】</strong>籤詩。<br>特贈結緣－<strong>【廣財運通香2入組】</strong>。',
 co_guangcai: '116年公司專屬<strong>【財祿運勢】</strong>籤詩。'
};
function buildLamps(){
 const order=['總燈首','公司','個人'];
 const sorted=[...lampDefs].sort((a,b)=>order.indexOf(a.r)-order.indexOf(b.r));
 sorted.forEach(l=>{
 const target='#lamp-'+l.k.replace(/^(head_|co_)/,'');

$(target).insertAdjacentHTML('beforeend',`<article class="lamp" data-key="${l.k}"><label class="lamp-head" for="check-${l.k}"><input type="checkbox" id="check-${l.k}" class="lamp-check"><span class="lamp-icon">${icon}</span><span class="lamp-name"><strong>${registrationType[l.r]}</strong><small>${l.n}${l.r==='個人'?'・每位芳名':''}</small></span><span class="price" data-price="${l.k}">${l.r==='個人'?money(l.p):'<small>金額待確認</small>'}</span></label><p class="lamp-purpose">${lampPurposes[l.k]||''}${lampFortune[l.k] ? '<br>'+lampFortune[l.k] : ''}${l.r==='個人'?'':'<br>功德金請洽本院 Telegram。'}</p><div class="people" hidden><p class="hint">${l.r==='個人'?'請填芳名、出生年月日與現居地址。':'金額由行政確認後通知，尚未計入總額。'}</p><div class="person-list"></div><button type="button" class="subbtn add-person">＋ 新增${l.r==='公司'?'公司':'芳名'}</button></div></article>`)})}
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

$('#products').innerHTML=products.map(([n,p,stock],i)=>`<div class="product" data-product="${i}"><div class="desc">${n}</div><span class="price">${money(p)}</span><input style="width:78px;flex-shrink:0;padding:7px" type="number" min="0" step="1" ${stock!==null?'max="'+stock+'"':''} aria-label="${n}數量" data-quantity="${i}" value="0"></div>`).join('');
const sponsors=[['garden', '景觀園藝贊助', 200], ['statue', '神像供具贊助', 0], ['equipment', '硬體設備贊助', 0]];
function sponsorRow(fixed){
 const id=++uid;
 return `<div class="person"><div class="person-title">贊助資料</div><button type="button" class="remove">移除此筆</button><label for="sn${id}" class="req">姓名</label><input id="sn${id}" required placeholder="請填寫姓名">${fixed?'':`<label for="sa${id}" class="req">隨喜金額（NT$）</label><input id="sa${id}" type="number" required min="1" max="9999999" step="1" placeholder="請填入金額">`}</div>`;
}
function buildSponsors(){
 sponsors.forEach(([key,title,fixed])=>{
  $('#sponsorChoices').insertAdjacentHTML('beforeend',`<article class="lamp" id="sponsor-${key}"><label class="lamp-head"><input type="checkbox" class="sponsor-check"><span class="lamp-icon">${icon}</span><span class="lamp-name"><strong>${title}</strong></span><span class="price">${fixed?money(fixed)+'／筆':'隨喜功德'}</span></label><div class="people" hidden><div class="person-list"></div><button type="button" class="subbtn add-person">＋ 新增一筆</button></div></article>`);
  bindPeople($('#sponsor-'+key),()=>sponsorRow(fixed));
 });
}
function calc(){let lines=[],lamps=0,goods=0,hasGuang=false,pending=false;lampDefs.forEach(l=>{const el=$(`[data-key="${l.k}"]`);if(!el.querySelector('.lamp-check').checked)return;const count=el.querySelectorAll('.person').length;if(l.n==='廣財運通燈')hasGuang=true;if(l.r==='個人'){lamps+=l.p*count;lines.push([`${l.n}・個人燈 ${count} 位`,l.p*count])}else{pending=true;lines.push([`${l.n}・${registrationType[l.r]} ${count} ${l.r==='公司'?'家':'位'}`,'待行政確認'])}});products.forEach(([n,p,stock],i)=>{const input=$(`[data-quantity="${i}"]`),raw=Number(input.value),valid=Number.isSafeInteger(raw)&&raw>=0&&(stock===null||raw<=stock);input.setCustomValidity(valid?'':stock===null?'請填寫零或正整數數量。':'請填寫 0 至 '+stock+' 的整數數量。');const qty=valid?raw:0;if(qty){goods+=qty*p;lines.push([n+' × '+qty,qty*p])}});let donation=0;
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
const standardRegistration=Boolean($$('.lamp-check:checked').length||goods);
['name','email','phone'].forEach(id=>{
 const field=$('#'+id);
 field.required=standardRegistration;
 field.labels[0].classList.toggle('req',standardRegistration);
});
const over=goods>0&&$('#overseas').checked,shipping=goods?(over?0:goods>=4000?0:65):0;if(goods)lines.push(['運費',over?'海外另計':shipping]);if(over&&goods)pending=true;currentTotal=lamps+goods+donation+shipping;currentPending=pending;$('#shippingFields').hidden=goods===0;$('#noShipping').hidden=goods>0;$('#overseas').disabled=goods===0;$('#address').disabled=goods===0;$('#address').required=goods>0;$('#addressLabel').classList.toggle('req',goods>0);$('#shippingMsg').textContent=goods?(over?'海外運費由行政另行確認。':shipping?'本次運費 NT$65。':'本次請購已達免運門檻。'):'僅登記點燈，無須運費。';$('#pendingHint').hidden=!pending;$('#totalLabel').textContent=pending?'目前可計算金額':'功德金總計';$('#totalNote').textContent=pending?'另有金額待行政確認':lines.length?'依本次登記項目即時計算':'請選擇燈別、贊助項目或請購品。';$('#total').textContent=$('#mobileAmount').textContent=money(currentTotal);$('#sidebarRows').innerHTML=lines.length?lines.map(([n,p])=>`<div class="sumrow"><span>${esc(n)}</span><span>${typeof p==='number'?money(p):p}</span></div>`).join(''):'<p class="hint">尚未選擇登記項目</p>';$('#breakdown').innerHTML=(lines.length?lines:[['尚未選擇項目',0]]).map(([n,p])=>`<tr><td>${esc(n)}</td><td>${typeof p==='number'?money(p):p}</td></tr>`).join('')+`<tr><td><b>${pending?'目前可計算金額':'合計'}</b></td><td><b>${money(currentTotal)}</b></td></tr>`}
buildLamps();lampDefs.forEach(l=>bindPeople($(`[data-key="${l.k}"]`),()=>personHTML(l)));buildSponsors();calc();$('#form').addEventListener('input',calc);$('#form').addEventListener('change',calc);
function activateTab(b){$$('[data-role]').forEach(x=>{const active=x===b;x.setAttribute('aria-selected',active);x.tabIndex=active?0:-1;$('#'+x.getAttribute('aria-controls')).hidden=!active})}$$('[data-role]').forEach((b,i)=>{b.tabIndex=i? -1:0;b.onclick=()=>activateTab(b);b.onkeydown=e=>{if(['ArrowRight','ArrowLeft','Home','End'].includes(e.key)){e.preventDefault();const tabs=$$('[data-role]'),next=e.key==='Home'?0:e.key==='End'?2:(i+(e.key==='ArrowRight'?1:2))%3;activateTab(tabs[next]);tabs[next].focus()}}});

$('#form').noValidate=true;$('#form').onsubmit=e=>{e.preventDefault();calc();const selected=$$('.lamp-check:checked').length||$$('[data-quantity]').some(x=>+x.value)||$$('.sponsor-check:checked').length;$('#lampError').textContent=selected?'':'請至少登記一項燈別、贊助或請購品。';if(!selected){$('#lanterns').scrollIntoView({block:'start'});return}const invalid=$('#form').querySelector(':invalid');if(invalid){const pane=invalid.closest('[role=tabpanel]');if(pane&&pane.hidden)activateTab($(`[aria-controls="${pane.id}"]`));invalid.reportValidity();invalid.focus();return}$('#result .eyebrow')&&($('#result .eyebrow').textContent='SIGNUP');$('#result h2').textContent='正在送出…';$('#resultBody').innerHTML=`<p>正在將報名資料送至靈元院報名表，請稍候。</p>`;const _rf=$('#result .result-foot');if(_rf)_rf.hidden=true;$('#result').showModal()};$$('#result .close,#result .closeResult').forEach(b=>b.onclick=()=>$('#result').close());
let records=[{id:'DEMO-001',name:'王小明',lamp:'太歲燈、廣財運通燈',amount:1800,status:'已核帳'},{id:'DEMO-002',name:'林美華',lamp:'破災降魔燈・總燈首',amount:null,status:'待確認'},{id:'DEMO-003',name:'陳怡君',lamp:'破災降魔燈',amount:680,status:'已回報匯款'}];function renderRecords(){const q=$('#search').value.trim(),status=$('#filterStatus').value;$('#adminRows').innerHTML=records.filter(r=>(!q||[r.id,r.name,r.lamp].join().includes(q))&&(!status||r.status===status)).map(r=>`<tr><td>${r.id.replace('DEMO-','登記-')}</td><td>${r.name}</td><td>${r.lamp}</td><td>${r.amount===null?'待確認':money(r.amount)}</td><td><span class="tag">${r.status}</span></td><td><button class="subbtn" data-detail="${r.id}">檢視</button></td></tr>`).join('')||'<tr><td colspan="6">查無符合的報名資料</td></tr>'}renderRecords();$('#search').oninput=renderRecords;$('#filterStatus').onchange=renderRecords;$('#adminRows').onclick=e=>{const id=e.target.dataset.detail;if(!id)return;const r=records.find(x=>x.id===id);$('#resultBody').innerHTML=`<p>${r.id.replace('DEMO-','登記-')}・${r.name}</p><p>${r.lamp}</p><p>金額：${r.amount===null?'待確認':money(r.amount)}｜狀態：${r.status}</p><p class="hint">版面操作示意，非雲端報名紀錄。</p>`;$('#result').showModal()};
function switchView(admin){$('#front').hidden=admin;$('#admin').hidden=!admin;const sv=$('#switchView');if(sv)sv.textContent=admin?'查看報名頁':'管理後台';window.scrollTo({top:0,behavior:'instant'})}const switchViewBtn=$('#switchView');if(switchViewBtn)switchViewBtn.onclick=()=>switchView($('#admin').hidden);const backFrontBtn=$('#backFront');if(backFrontBtn)backFrontBtn.onclick=()=>switchView(false);$$('[data-admin]').forEach(b=>b.onclick=()=>{$$('[data-admin]').forEach(x=>x.classList.toggle('on',x===b));$$('[data-admin-pane]').forEach(p=>p.hidden=p.dataset.adminPane!==b.dataset.admin)});$('#priceSettings').innerHTML=lampDefs.filter(l=>l.r==='個人').map(l=>`<label for="price-${l.k}">${l.n}（每位芳名）</label><input id="price-${l.k}" type="number" min="0" step="1" value="${l.p}">`).join('');$('#applyPrices').onclick=()=>{let defs=lampDefs.filter(l=>l.r==='個人');if(defs.some(l=>!$('#price-'+l.k).checkValidity()||$('#price-'+l.k).value==='')){$('#settingMsg').textContent='請填寫有效的非負整數金額。';return}defs.forEach(l=>{l.p=+$('#price-'+l.k).value;$(`[data-price="${l.k}"]`).textContent=money(l.p)});calc();$('#settingMsg').textContent='已套用至本頁，重新整理後還原。'};$('#applyText').onclick=()=>{$('h1').textContent=$('#editHero').value;if($('.banner-action p span')){$('.banner-action p span').textContent=$('#editSub').value;}$('#textMsg').textContent='已套用至報名頁，重新整理後還原。'};
if('IntersectionObserver'in window){const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('in');observer.unobserve(entry.target)}}),{threshold:.08});$$('.reveal').forEach(el=>observer.observe(el))}for(let i=0;i<12;i++){const p=document.createElement('i');p.className='mote';p.style.cssText=`left:${8+i*7.4}%;top:${20+(i*17)%60}%;animation-delay:-${i*.8}s;animation-duration:${8+i%5}s`;document.querySelector('.hero')?.append(p)}

const imageDialog=$('#imageDialog'),imageScroll=$('.image-scroll');$$('.poster-open').forEach(button=>button.addEventListener('click',()=>{const img=button.querySelector('img');$('#imageLarge').src=img.src;$('#imageLarge').alt=img.alt;$('#imageTitle').textContent=button.getAttribute('aria-label').replace('放大閱讀：','');imageScroll.classList.remove('zoomed');$('#imageZoom').textContent='原尺寸閱讀';imageDialog.showModal();imageScroll.scrollTop=0;imageScroll.scrollLeft=0}));$('#imageClose').onclick=()=>imageDialog.close();$('#imageZoom').onclick=()=>{const zoomed=imageScroll.classList.toggle('zoomed');$('#imageZoom').textContent=zoomed?'符合視窗':'原尺寸閱讀'};imageDialog.addEventListener('click',e=>{if(e.target===imageDialog)imageDialog.close()});

// Session-only preview: no authentication, email delivery or production persistence.
const previewEntries = new Map();
let editingEntry = null, preEditDraft = null, entryCounter = 0;
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
}
function restoreRegistration(data){
 unlockPreview();
 scalarIds.forEach(id=>{const el=$('#'+id);if(el)el.type==='checkbox'?el.checked=!!data.fields[id]:el.value=data.fields[id]??''});
 data.lamps.forEach(item=>$(`[data-key="${item.key}"]`).restorePeople(item));
 sponsors.forEach(([key],i)=>$('#sponsor-'+key).restorePeople(data.sponsors[i]));
 $$('[data-quantity]').forEach((x,i)=>x.value=data.quantities[i]??'0');
 $$('#registrationTerms input').forEach((x,i)=>x.checked=!!data.agreements[i]);calc();
}
const recordsDialog=document.createElement('dialog');recordsDialog.className='modal';recordsDialog.id='myRecordsDialog';recordsDialog.setAttribute('aria-label','查詢與修改報名');
recordsDialog.innerHTML='<button class="close" type="button" aria-label="關閉">×</button><h2>查詢／修改我的報名</h2><div class="notice">報名資料送出成功後會寫入靈元院 Google 報名表。<br>此處僅列出本次開啟期間的紀錄，重新整理後清除；已成功寫入的雲端資料仍保留。</div><p class="hint">Gmail 驗證及線上查詢／修改流程仍在建置中；目前如需更正請聯繫行政。本頁操作不會寄送驗證碼或通知信。</p><div id="myRecordsList"></div>';
document.body.append(recordsDialog);recordsDialog.querySelector('.close').onclick=()=>recordsDialog.close();
function showMyRecords(){
 $('#myRecordsList').innerHTML=previewEntries.size?[...previewEntries.values()].map(r=>`<section style="border-top:1px solid var(--line);padding:18px 0"><strong>${esc(r.id)}・${esc(registrationName(r.data))}</strong><p class="hint">版本 ${r.version}｜${esc(r.updated)}<br>${r.pending?'有變更待行政確認；目前核定資料維持原內容。':'尚無待審變更'}</p><label for="stage-${r.id}">本頁處理進度（不更新雲端，實際進度請洽行政）</label><select id="stage-${r.id}" data-stage="${r.id}">${['尚未匯款','已回報匯款','已核帳','芳名已製作','法儀已執行','商品已出貨'].map(x=>`<option ${r.stage===x?'selected':''}>${x}</option>`).join('')}</select><p><button type="button" class="subbtn" data-edit-entry="${r.id}">查看／修改這筆報名</button></p><details><summary>查看修改紀錄（${r.history.length}）</summary>${r.history.map(h=>`<p class="hint">${esc(h.time)}｜${esc(h.message)}</p>`).join('')||'<p class="hint">尚未修改</p>'}</details></section>`).join(''):'<p>目前尚無本次開啟期間的紀錄。請先填寫報名表並按「確認送出」；先前已送出的報名如需查詢或更正，請聯繫行政。</p>';
 recordsDialog.showModal();
}
$('#openMyRecords').onclick=showMyRecords;$('#heroMyRecords').onclick=showMyRecords;
recordsDialog.addEventListener('change',e=>{if(e.target.dataset.stage)previewEntries.get(e.target.dataset.stage).stage=e.target.value});
function setEditButtons(active){$$('button[type="submit"]').filter(x=>x.form===formNode).forEach(x=>x.textContent=active?'儲存修改':'確認送出 →')}
function applyStageLocks(r){
 const nameLocked=['芳名已製作','法儀已執行','商品已出貨'].includes(r.stage), shipped=r.stage==='商品已出貨';
 // Later stages conservatively lock both ritual entries and paid quantities.
 if(nameLocked)$$('.lamp input,.lamp select,.lamp button').forEach(x=>x.disabled=true);
 if(shipped){$$('[data-quantity]').forEach(x=>x.disabled=true);$('#address').disabled=true;$('#overseas').disabled=true}
 $('#email').disabled=true;
 $('#editPolicy').textContent='登記信箱用於身分驗證，變更請聯繫行政。'+(r.stage==='尚未匯款'?'目前可修改資料、燈別及數量。':'涉及燈別、請購品或金額的變更須送行政確認。')+(nameLocked?'芳名相關資料已鎖定，需更正請聯繫行政。':'')+(shipped?'商品已出貨，數量及寄送地址已鎖定。':'');
}
recordsDialog.addEventListener('click',e=>{
 const id=e.target.dataset.editEntry;if(!id)return;
 if(editingEntry){alert('請先儲存或離開目前正在修改的報名。');return}
 const r=previewEntries.get(id);preEditDraft=captureRegistration();editingEntry=r;
 restoreRegistration(r.pending||r.data);$$('#registrationTerms input').forEach(x=>x.checked=false);
 $('#editBanner').hidden=false;$('#editTitle').textContent=`修改 ${id}｜${r.stage}`;applyStageLocks(r);setEditButtons(true);recordsDialog.close();$('#register').scrollIntoView({block:'start'});
});
formNode.addEventListener('input',()=>{if(editingEntry)applyStageLocks(editingEntry)});
formNode.addEventListener('change',()=>{if(editingEntry)applyStageLocks(editingEntry)});
$('#cancelEdit').onclick=()=>{if(!confirm('離開後將放棄這次尚未儲存的修改，是否繼續？'))return;const draft=preEditDraft;editingEntry=null;restoreRegistration(draft);preEditDraft=null;$('#editBanner').hidden=true;setEditButtons(false)};
function changedDescriptions(before,after){
 const labels={name:'登記人姓名',email:'Email',phone:'聯絡方式',overseas:'海外寄送',address:'寄送地址',last5:'匯款後五碼',remitNote:'匯款附言',cert:'感謝狀',note:'備註'};
 const changes=[];for(const k of scalarIds)if(before.fields[k]!==after.fields[k])changes.push(labels[k]);
 if(JSON.stringify(before.lamps)!==JSON.stringify(after.lamps))changes.push('燈別／芳名資料');
 if(JSON.stringify(before.sponsors)!==JSON.stringify(after.sponsors))changes.push('贊助項目／資料');
 if(JSON.stringify(before.quantities)!==JSON.stringify(after.quantities))changes.push('請購數量');return changes;
}
function financialSignature(d){return JSON.stringify({lamps:d.lamps.filter(l=>l.selected).map(l=>[l.key,l.people.length]),quantities:d.quantities,sponsors:d.sponsors.map((item,i)=>item.selected?item.people.map(([,amount])=>sponsors[i][2]||Number(amount)):[]),overseas:d.fields.overseas})}
const originalPreviewSubmit=formNode.onsubmit;
formNode.onsubmit=e=>{
 originalPreviewSubmit(e);if(!$('#result').open)return;
 const data=captureRegistration(),now=new Date().toLocaleString('zh-TW',{timeZone:'Asia/Taipei'});let r=editingEntry,review=false;
 if(r){
 const before=r.pending||r.data,changes=changedDescriptions(before,data);
 if(!changes.length){$('#result h2').textContent='沒有變更';$('#resultBody').innerHTML='<p>沒有資料變更，原登記紀錄維持不變。</p>';return}
 review=r.stage!=='尚未匯款'&&financialSignature(r.data)!==financialSignature(data);
 r.history.push({time:now,message:(review?'送行政確認：':'已更新：')+changes.join('、'),before:structuredClone(before),after:structuredClone(data)});
 if(review)r.pending=data;else{r.data=data;r.pending=null}r.version++;r.updated=now;
 }else{
 r={id:'LOCAL-'+String(++entryCounter).padStart(3,'0'),data,stage:'尚未匯款',version:1,updated:now,history:[],pending:null};previewEntries.set(r.id,r);
 }
 if(editingEntry){editingEntry=null;unlockPreview();restoreRegistration(data);$('#editBanner').hidden=true;preEditDraft=null;setEditButtons(false)}
 (function sendSignupToSheet(regData, localId){
   const endpoint=String(window.LYYUAN_SIGNUP_WEBAPP_URL||'').trim();
   const eyebrow=$('#result .eyebrow');
   const foot=$('#result .result-foot');
   const showFail=msg=>{
     if(eyebrow)eyebrow.textContent='SIGNUP FAILED';
     $('#result h2').textContent='送出失敗';
     if(foot)foot.hidden=true;
     $('#resultBody').innerHTML=`<p class="statusmsg error">${esc(msg)}</p><p class="hint">本頁仍保留本次填寫內容，請修正後再試，或聯繫行政。</p>`;
   };
   const showOk=(serverId)=>{
     if(eyebrow)eyebrow.textContent='SIGNUP COMPLETE';
     $('#result h2').textContent='報名已送出';
     if(foot)foot.hidden=true;
     const who=esc(registrationName(regData)||'');
     $('#resultBody').innerHTML=`<p>${who}，報名資料已送出。</p><p>報名編號：<b style="color:var(--gold)">${esc(serverId||'')}</b></p><p>${currentPending?'目前可計算金額':'功德金總計'}：<b style="color:var(--gold)">${money(currentTotal)}</b></p>${currentPending?'<p class="hint">另有項目待行政確認金額。</p>':''}<div class="notice">${$('#transferInfo').innerHTML}</div><p class="hint">請於收到行政確認通知後，再依通知金額匯款。本編號已寫入靈元院報名表。</p>`;
   };
   if(!endpoint){showFail('報名後端尚未設定。');return;}
   const roleOf=k=>(lampDefs.find(l=>l.k===k)||{}).r||'';
   const nameOf=k=>(lampDefs.find(l=>l.k===k)||{}).n||'';
   const priceOf=k=>(lampDefs.find(l=>l.k===k)||{}).p||0;
   const payload={
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
   fetch(endpoint,{method:'POST',mode:'cors',redirect:'follow',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)})
     .then(r=>r.json().catch(()=>({ok:false,error:'回應格式錯誤'})))
     .then(res=>{
       if(res&&res.ok){
         if(localId&&previewEntries.has(localId)){const ent=previewEntries.get(localId);ent.serverId=res.id;ent.id=res.id;previewEntries.delete(localId);previewEntries.set(res.id,ent);}
         showOk(res.id);
       }else{
         showFail('寫入報名表失敗：'+((res&&res.error)||'未知錯誤'));
       }
     })
     .catch(()=>showFail('無法連線報名後端，請稍後再試或聯繫行政。'));
 })(data, r&&r.id);
};

// Leaving a preview must never imply durable registration.
window.addEventListener('beforeunload',e=>{if(previewEntries.size||editingEntry){e.preventDefault();e.returnValue=''}});


const productPhotos={"spirit": "assets/image-05.webp", "wealth": "assets/image-06.webp", "incense": "assets/image-07.webp", "career": "assets/image-08.webp", "love": "assets/image-09.webp", "single": "assets/image-10.webp", "triple": "assets/image-11.webp"};
const detailPoster=document.querySelector('#items .poster-open img').src;
const productDetails=['以特殊香材製成，點燃供香時可祈請招財之氣，為財運祈福。', '適合全年日常供香與修持，於供香時祈願一年財運亨通、財路順遂。', '適合全年日常供香與修持，於供香時祈願一年財運亨通、財路順遂。', '用於居家淨化，祈請驅除穢氣、護佑家宅，願全家一年平安。', '用於居家淨化，祈請驅除穢氣、護佑家宅，願全家一年平安。', '祈願元神安定、光彩顯發，護持日常身心安穩。本年度僅限 66 枚請供。', '祈願財富滿堂、富足善緣。', '祈願事業順遂、願行開展。', '祈願感情和合、善緣圓滿。'];
const photoKeys=['single','triple','triple','incense','incense','spirit','wealth','career','love'];
$$('[data-product]').forEach(row=>{const i=Number(row.dataset.product);if(!Number.isInteger(i)||!products[i])return;const actual=productPhotos[photoKeys[i]],src=actual||detailPoster;const button=document.createElement('button');button.type='button';button.className='product-thumb';button.setAttribute('aria-label','放大查看：'+products[i][0]);const img=document.createElement('img');img.src=src;img.alt=products[i][0]+(actual?'商品示意圖':'細則圖（非商品實照）');img.loading='lazy';button.append(img);const caption=document.createElement('span');caption.textContent=actual?'放大照片':'細則圖';button.append(caption);row.prepend(button);const d=document.createElement('small');d.textContent=productDetails[i];row.querySelector('.desc').append(d);button.onclick=()=>{$('#imageLarge').src=src;$('#imageLarge').alt=img.alt;$('#imageTitle').textContent=products[i][0]+(actual?'':'・商品實照待補');imageScroll.classList.remove('zoomed');$('#imageZoom').textContent='原尺寸閱讀';imageDialog.showModal();imageScroll.scrollTop=0}});

/* 主站導覽：下拉＋手機選單（純 click，無 timer／MutationObserver） */
(function initSiteNav(){
  const nav=document.querySelector('nav');
  if(!nav)return;
  const links=nav.querySelector('#siteNavLinks');
  const toggle=nav.querySelector('#navToggle');
  const closeAll=except=>{
    nav.querySelectorAll('.nav-item.is-open').forEach(item=>{
      if(item===except)return;
      item.classList.remove('is-open');
      const t=item.querySelector(':scope > .nav-trigger');
      if(t)t.setAttribute('aria-expanded','false');
    });
  };
  nav.querySelectorAll('.nav-trigger').forEach(trigger=>{
    trigger.addEventListener('click',e=>{
      e.preventDefault();
      e.stopPropagation();
      const item=trigger.closest('.nav-item');
      if(!item)return;
      const willOpen=!item.classList.contains('is-open');
      closeAll(item);
      item.classList.toggle('is-open',willOpen);
      trigger.setAttribute('aria-expanded',String(willOpen));
    });
  });
  if(toggle&&links){
    toggle.addEventListener('click',e=>{
      e.stopPropagation();
      const open=!links.classList.contains('is-open');
      links.classList.toggle('is-open',open);
      toggle.setAttribute('aria-expanded',String(open));
      toggle.textContent=open?'關閉':'選單';
      if(!open)closeAll();
    });
  }
  document.addEventListener('click',()=>{
    closeAll();
    if(links&&links.classList.contains('is-open')){
      links.classList.remove('is-open');
      if(toggle){toggle.setAttribute('aria-expanded','false');toggle.textContent='選單';}
    }
  });
  if(links)links.addEventListener('click',e=>e.stopPropagation());
  nav.addEventListener('keydown',e=>{
    if(e.key!=='Escape')return;
    closeAll();
    if(links)links.classList.remove('is-open');
    if(toggle){toggle.setAttribute('aria-expanded','false');toggle.textContent='選單';toggle.focus();}
  });
})();


// Read-only social proof: one request per page load, independent of registration.
(async function loadSignupStats() {
 const proof = document.getElementById('signupProof');
 const bars = document.getElementById('zodiacBars');
 const countOf = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
 try {
  if (!proof || !bars) return;
  const mock = new URLSearchParams(location.search).get('mockStats') === '1';
  let stats;
  if (mock) {
   stats = {ok:true,event:'lamp-116-dingwei',totalSignups:25,lamps:[{name:'太歲燈',count:12},{name:'破災降魔燈',count:9},{name:'廣財運通燈',count:4}],taisuiFanZodiacs:{counts:[{zodiac:'羊',count:9},{zodiac:'牛',count:7},{zodiac:'龍',count:5},{zodiac:'狗',count:3}]}};
  } else {
   const response = await fetch('https://script.google.com/macros/s/AKfycbzVWhkaSoSIsBKTBcYnmbAg9Gbka0aBczkSQeAVsvWlz7a6rqByzwuCVlkykMnmTHRh/exec?action=stats&event=lamp-116-dingwei');
   if (!response.ok) return;
   stats = await response.json();
  }
  if (stats.ok !== true || stats.event !== 'lamp-116-dingwei' || !Number.isSafeInteger(stats.totalSignups) || stats.totalSignups < 0) return;
  const total = stats.totalSignups;
  if (total < 10) {
   proof.hidden = true;
   proof.textContent = '';
   return;
  }
  proof.textContent = `已有 ${total.toLocaleString('zh-TW')} 位信眾點亮`;
  proof.hidden = false;
  const families = {'太歲燈':'taisui','破災降魔燈':'pozai','廣財運通燈':'guangcai'};
  const lamps = Array.isArray(stats.lamps) ? stats.lamps : [];
  lamps.filter(lamp => families[lamp.name] && countOf(lamp.count) > 0)
   .sort((a,b) => b.count - a.count).slice(0,3).forEach(lamp => {
    const card = document.querySelector(`.lamp[data-key="${families[lamp.name]}"] .lamp-name`);
    if (!card || card.querySelector('.lamp-hot')) return;
    const tag = document.createElement('span');
    tag.className = 'lamp-hot';
    tag.textContent = '熱門';
    card.append(tag);
   });
  const counts = stats.taisuiFanZodiacs?.counts;
  if (!Array.isArray(counts) || !['羊','牛','龍','狗'].every(zodiac => counts.some(item => item.zodiac === zodiac && Number.isSafeInteger(item.count) && item.count >= 0))) return;
  const rows = ['羊','牛','龍','狗'].map(zodiac => ({zodiac, count:counts.find(item => item.zodiac === zodiac).count})).sort((a,b) => b.count - a.count);
  const max = Math.max(1, ...rows.map(row => row.count));
  rows.forEach((row,index) => {
   const item = document.createElement('div');
   item.className = 'zodiac-row';
   const label = document.createElement('p');
   label.textContent = `${row.zodiac}　${row.count.toLocaleString('zh-TW')} 人已點${index === 0 && row.count > 0 ? '　🔥 最多人點' : ''}`;
   const track = document.createElement('div');
   track.className = 'zodiac-track';
   track.setAttribute('aria-hidden','true');
   const fill = document.createElement('span');
   fill.style.setProperty('--bar-width', `${row.count / max * 100}%`);
   track.append(fill);
   item.append(label,track);
   bars.append(item);
  });
  bars.hidden = false;
  // Commit the initial zero width before the single animation start.
  void bars.offsetWidth;
  requestAnimationFrame(() => bars.classList.add('stats-ready'));
 } catch { /* Keep the static zodiac introduction when stats are unavailable. */ }
})();
