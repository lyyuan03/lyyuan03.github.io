/**
 * 靈元院 116 年丁未歲年度點燈 — Google Apps Script
 * 本檔為部署原始碼；GitHub 上不存放真實信眾資料或金鑰。
 * 使用 lyyuan03@gmail.com 建立獨立 Apps Script 專案，
 * 在指令碼編輯器建立 Code.gs、Index.html，執行 setupLampSystem()。
 * 以「執行身分：我」、「存取權限：任何人」部署網頁應用程式。
 * 必須經 Email 驗證才能存取個人及家人資料。
 */
const CFG = Object.freeze({
  spreadsheet: PropertiesService.getScriptProperties().getProperty('LAMP_SPREADSHEET_ID'),
  year: '116年丁未',
  bankCode: '822',
  bankAccount: '1595-4039-1887'
});
const S = {setting:'燈別設定',member:'信眾主檔',family:'家庭名單',orders:'年度訂單',detail:'點燈明細',codes:'登入驗證',audit:'操作紀錄'};
function table_(name) { const sh=SpreadsheetApp.openById(CFG.spreadsheet).getSheetByName(name);if(!sh)throw Error('找不到工作表：'+name);return sh; }
function data_(name){return table_(name).getDataRange().getValues().slice(1);}
function str_(s,max){return String(s==null?'':s).trim().slice(0,max||100);}
function mail_(v){const s=str_(v,120).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))throw Error('Email 格式錯誤');return s;}
function hex_(s){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(s),Utilities.Charset.UTF_8).map(x=>('0'+(x&255).toString(16)).slice(-2)).join('');}
function lock_(fn){const l=LockService.getScriptLock();if(!l.tryLock(20000))throw Error('系統忙碌，請稍後重試');try{return fn();}finally{l.releaseLock();}}
function pepper_(){const p=PropertiesService.getScriptProperties().getProperty('PEPPER');if(!p)throw Error('請先完成系統初始化');return p;}
function setupLampSystem(){const p=PropertiesService.getScriptProperties();if(!p.getProperty('LAMP_SPREADSHEET_ID'))throw Error('請先設定 LAMP_SPREADSHEET_ID 指令碼屬性');if(!p.getProperty('PEPPER'))p.setProperty('PEPPER',Utilities.getUuid()+Utilities.getUuid()+Utilities.getUuid());return '完成初始化';}
function doGet(){return HtmlService.createHtmlOutputFromFile('Index').setTitle('靈元院｜116年丁未歲年度點燈').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);}
function trace_(who,action,id,result){table_(S.audit).appendRow([new Date(),who,action,id,result,'']);}
function lamps_(){return data_(S.setting).filter(r=>String(r[0])===CFG.year&&String(r[2])==='個人燈').map(r=>({lamp:String(r[1]),price:Number(r[3])||0,open:String(r[5])==='開放'}));}
function getProfile_(email){
  const m=data_(S.member).find(r=>str_(r[1],120).toLowerCase()===email),id=m?m[0]:'';
  return {email:email,name:m?str_(m[2],80):'',phone:m?str_(m[3],30):'',family:id?data_(S.family).filter(r=>r[1]===id).map(r=>({id:r[0],name:str_(r[2],80),calendar:str_(r[3],10),birth:str_(r[4],30),hour:str_(r[5],20)})):[],lamps:lamps_()};
}
function requestCode(v){
  const e=mail_(v);
  return lock_(()=>{
    const cache=CacheService.getScriptCache(),k='send:'+hex_(e);
    if(cache.get(k))throw Error('驗證碼已寄出，請稍候再申請');
    const code=String(parseInt(hex_(Utilities.getUuid()+Utilities.getUuid()).slice(0,12),16)%1000000).padStart(6,'0'),hash=hex_(pepper_()+':'+e+':'+code);
    const sh=table_(S.codes),rows=data_(S.codes),i=rows.findIndex(r=>str_(r[0],120).toLowerCase()===e);
    const line=[e,hash,new Date(Date.now()+600000),0,new Date(),''];
    if(i>=0)sh.getRange(i+2,1,1,6).setValues([line]);else sh.appendRow(line);
    MailApp.sendEmail({to:e,subject:'靈元院｜年度點燈驗證碼',body:'您的登入驗證碼：'+code+'\n有效期限 10 分鐘。請勿提供給任何人。'});
    cache.put(k,'1',90);return {ok:true};
  });
}
function verifyCode(v,c){
  const e=mail_(v),code=str_(c,6);if(!/^\d{6}$/.test(code))throw Error('請輸入6位驗證碼');
  return lock_(()=>{
    const sh=table_(S.codes),rows=data_(S.codes),i=rows.findIndex(r=>str_(r[0],120).toLowerCase()===e);
    if(i<0)throw Error('請重新申請驗證碼');
    const r=rows[i],fail=Number(r[3])||0;
    if(r[5]||new Date(r[2]).getTime()<Date.now()||fail>=5)throw Error('驗證碼已失效，請重新申請');
    if(hex_(pepper_()+':'+e+':'+code)!==r[1]){sh.getRange(i+2,4).setValue(fail+1);throw Error('驗證碼不正確');}
    sh.getRange(i+2,6).setValue(new Date());
    const token=Utilities.getUuid()+Utilities.getUuid();
    CacheService.getScriptCache().put('auth:'+hex_(token),e,14400);
    return {token:token,profile:getProfile_(e)};
  });
}
function emailFor_(token){const t=str_(token,130);if(t.length<60)throw Error('請重新登入');const e=CacheService.getScriptCache().get('auth:'+hex_(t));if(!e)throw Error('登入已逾時，請重新驗證');return e;}
function loadProfile(token){return getProfile_(emailFor_(token));}
function saveContact(token,contact){
  const e=emailFor_(token),name=str_(contact.name,80),phone=str_(contact.phone,30);
  if(name.length<2)throw Error('請填寫聯絡人姓名');
  if(phone&&!/^[0-9()+\- ]{7,30}$/.test(phone))throw Error('電話格式不正確');
  return lock_(()=>{
    const sh=table_(S.member),rows=data_(S.member),i=rows.findIndex(r=>str_(r[1],120).toLowerCase()===e);
    if(i>=0)sh.getRange(i+2,3,1,4).setValues([[name,phone,rows[i][4]||new Date(),new Date()]]);
    else sh.appendRow(['M-'+Utilities.getUuid(),e,name,phone,new Date(),new Date(),'啟用']);
    return getProfile_(e);
  });
}
function saveFamily(token,person){
  const e=emailFor_(token),p=person||{},name=str_(p.name,80),calendar=str_(p.calendar,10),birth=str_(p.birth,30),hour=str_(p.hour,20);
  if(name.length<2||!['國曆','農曆'].includes(calendar)||!/^(\d{3,4})[-\/](\d{1,2})[-\/](\d{1,2})$/.test(birth))throw Error('請填寫姓名、曆法與出生年月日');
  return lock_(()=>{
    const m=data_(S.member).find(r=>str_(r[1],120).toLowerCase()===e);if(!m)throw Error('請先儲存聯絡資料');
    const sh=table_(S.family),all=data_(S.family),owned=all.filter(r=>r[1]===m[0]);
    const i=all.findIndex(r=>r[0]===str_(p.id,80)&&r[1]===m[0]);
    if(p.id&&i<0)throw Error('無權限修改此位家人資料');
    if(!p.id&&owned.length>=30)throw Error('家人資料已達上限');
    const id=i>=0?all[i][0]:'P-'+Utilities.getUuid(),line=[id,m[0],name,calendar,birth,hour,'',i>=0?all[i][7]:new Date(),new Date()];
    if(i>=0)sh.getRange(i+2,1,1,9).setValues([line]);else sh.appendRow(line);
    trace_(e,'儲存家人資料',id,'成功');return getProfile_(e);
  });
}
function submitOrder(token,selection,consent){
  const e=emailFor_(token);if(consent!==true)throw Error('請確認資料使用告知及代登記授權');
  if(!Array.isArray(selection)||!selection.length||selection.length>60)throw Error('請選擇要登記的個人燈');
  return lock_(()=>{
    const member=data_(S.member).find(r=>str_(r[1],120).toLowerCase()===e);if(!member)throw Error('請先儲存聯絡資料');
    const family=new Map(data_(S.family).filter(r=>r[1]===member[0]).map(r=>[String(r[0]),r]));
    const prices=new Map(lamps_().filter(l=>l.open&&l.price>0).map(l=>[l.lamp,l.price]));
    if(!prices.size)throw Error('116年丁未歲尚未開放登記');
    let total=0;const details=[],seen=new Set();
    for(const s of selection){
      const pid=str_(s.personId,80),lamp=str_(s.lamp,40),key=pid+'|'+lamp;
      if(seen.has(key)||!family.has(pid)||!prices.has(lamp))throw Error('選擇內容不符合規則');
      seen.add(key);const cost=prices.get(lamp);total+=cost;details.push({id:pid,lamp:lamp,name:String(family.get(pid)[2]),cost:cost});
    }
    const oid='116-'+Utilities.formatDate(new Date(),'Asia/Taipei','yyyyMMdd')+'-'+Utilities.getUuid().slice(0,8).toUpperCase();
    table_(S.orders).appendRow([oid,member[0],CFG.year,e,member[2],total,'待匯款',new Date(),new Date(),'']);
    const ds=table_(S.detail);details.forEach(d=>ds.appendRow(['D-'+Utilities.getUuid(),oid,CFG.year,d.lamp,'個人燈',d.id,d.name,d.cost,1,d.cost]));
    trace_(e,'建立訂單',oid,'成功');
    const lines=details.map(d=>d.lamp+'｜'+d.name.slice(0,1)+'○｜NT$'+d.cost).join('\n');
    const body='感謝您登記靈元院 116年丁未歲年度點燈。\n\n訂單編號：'+oid+
      '\n登記明細：\n'+lines+'\n\n功德金合計：NT$'+total+
      '\n\n【轉帳資訊】\n中國信託科博館分行\n銀行代碼：822\n帳號：1595-4039-1887\n\n狀態：待匯款；須經行政核款後方完成作業。';
    let mailed=true;try{MailApp.sendEmail({to:e,subject:'靈元院｜116年丁未歲點燈回函 '+oid,body:body});}catch(err){mailed=false;trace_(e,'回函寄送失敗',oid,'需補寄');}
    return {id:oid,total:total,mailed:mailed,lines:details.map(d=>({name:d.name,lamp:d.lamp,price:d.cost}))};
  });
}