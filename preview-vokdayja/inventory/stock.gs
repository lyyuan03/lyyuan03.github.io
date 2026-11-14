/**
 * 靈元院 116 丁未年共用庫存服務（Google Apps Script V8）
 *
 * 部署限制：此模組須加入「目前實際接收報名」的 Apps Script 專案，
 * 並在現有 doGet/doPost 路由明確呼叫（詳見 README.md）。
 * 單獨存放於 GitHub 不會自動保護正式訂單，請勿宣稱已啟用。
 */
var LYY_STOCK = {
  event: 'lamp-116-dingwei',
  stockTab: '商品庫存',
  ledgerTab: '_庫存異動',
  legacyTab: '_庫存測試登記',
  publicConfigTab: '活動內容設定',
  incense: 'guangcai-incense',
  powder: 'zhen-sha-powder',
  productUnits: {p1:1, p2:3, p3:3, p4:3, p5:3}
};
function lyStockBook_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    var id = PropertiesService.getScriptProperties().getProperty('LYYUAN_SIGNUP_SHEET_ID');
    if (!id) throw Error('找不到年度點燈試算表，請在 Script Properties 設定 LYYUAN_SIGNUP_SHEET_ID');
    ss = SpreadsheetApp.openById(id);
  }
  return ss;
}
function lyStockSheet_(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) throw Error('缺少必要庫存分頁：' + name);
  return sheet;
}
function lyStockCatalog_(ss) {
  var sh = lyStockSheet_(ss, LYY_STOCK.publicConfigTab);
  var all = sh.getRange(2,1,Math.max(1,sh.getLastRow()-1),5).getValues();
  for (var i=0;i<all.length;i++) {
    if (String(all[i][0])!==LYY_STOCK.event) continue;
    var config=JSON.parse(String(all[i][4]||'{}'));
    if (!Array.isArray(config.products)) throw Error('商品公開設定格式不正確');
    var map={};
    config.products.forEach(function(p){map[p.name]=p;});
    return map;
  }
  throw Error('找不到116年活動商品設定');
}
function lyStockNeeded_(payload, ss) {
  if (!payload || payload.event!==LYY_STOCK.event) throw Error('活動代碼不符');
  var catalog=lyStockCatalog_(ss),used={},want={};
  want[LYY_STOCK.incense]=0;want[LYY_STOCK.powder]=0;
  (payload.products||[]).forEach(function(item){
    var name=String(item.name||''),setting=catalog[name],q=Number(item.qty);
    if (!setting || !setting.id) throw Error('商品設定已更新，請重新整理網頁再送出');
    if (!Number.isSafeInteger(q) || q<0 || q>1000) throw Error('商品數量必須為非負整數');
    if (used[setting.id]) throw Error('重複的商品選項：'+name);
    used[setting.id]=true;
    if (!q) return;
    if (setting.id==='p1'||setting.id==='p2'||setting.id==='p3') {
      want[LYY_STOCK.incense]+=q*LYY_STOCK.productUnits[setting.id];
    } else if (setting.id==='p4'||setting.id==='p5') {
      want[LYY_STOCK.powder]+=q*LYY_STOCK.productUnits[setting.id];
    }
  });
  var giftRows=(payload.lamps||[]).filter(function(l){return l.key==='head_guangcai'&&l.selected;});
  if (giftRows.length>1) throw Error('廣財運通總燈首不可重複登記');
  if (giftRows.length) {
    var people=giftRows[0].people||[];
    if (!Array.isArray(people)||people.length<1) throw Error('總燈首必須填寫芳名');
    people.forEach(function(person){if (!person||!String(person.name||'').trim())throw Error('總燈首芳名未填完整');});
    want[LYY_STOCK.incense]+=2*people.length;
  }
  return want;
}
function lyStockIsLegacy_(ss, orderId) {
  if (!orderId) return false;
  var sh=lyStockSheet_(ss,LYY_STOCK.legacyTab),n=sh.getLastRow();
  if (n<2)return false;
  return sh.getRange(2,1,n-1,1).getValues().some(function(row){return String(row[0])===String(orderId);});
}
function lyStockBalances_(ss) {
  var stock=lyStockSheet_(ss,LYY_STOCK.stockTab).getRange('A2:C3').getValues();
  var available={};
  stock.forEach(function(row){
    var count=Number(row[2]);
    if (!Number.isSafeInteger(count)||count<0)throw Error('庫存期初數量有誤');
    available[String(row[0])]=count;
  });
  if (!Object.prototype.hasOwnProperty.call(available,LYY_STOCK.incense)
      ||!Object.prototype.hasOwnProperty.call(available,LYY_STOCK.powder)) throw Error('庫存代碼不完整');
  return available;
}
function lyStockLedgerRows_(ss) {
  var sh=lyStockSheet_(ss,LYY_STOCK.ledgerTab),last=sh.getLastRow();
  return last<2?[]:sh.getRange(2,1,last-1,10).getValues();
}
function lyStockReserved_(ss) {
  var available=lyStockBalances_(ss);
  lyStockLedgerRows_(ss).forEach(function(row){
    var sku=String(row[3]),amount=Number(row[5]);
    if (!Object.prototype.hasOwnProperty.call(available,sku))throw Error('庫存異動存在不明商品');
    if(!Number.isSafeInteger(amount))throw Error('庫存異動含有不正確數量');
    available[sku]-=amount;
  });
  return available;
}
function lyStockHeldForOrder_(ss,orderId) {
  var held={};held[LYY_STOCK.incense]=0;held[LYY_STOCK.powder]=0;
  lyStockLedgerRows_(ss).forEach(function(row){
    if(String(row[2])===String(orderId)&&Object.prototype.hasOwnProperty.call(held,String(row[3]))) {
      held[String(row[3])]+=Number(row[5]);
    }
  });
  return held;
}
function lyStockAppend_(ss,orderId,delta,kind,note) {
  var changes=Object.keys(delta).filter(function(sku){return delta[sku]!==0;});
  if(!changes.length)return;
  var sh=lyStockSheet_(ss,LYY_STOCK.ledgerTab),stamp=new Date();
  var rows=changes.map(function(sku){
    return[stamp,Utilities.getUuid(),String(orderId),sku,kind,delta[sku],kind,note||'','system',String(orderId)+':'+sku+':'+Utilities.getUuid()];
  });
  sh.getRange(sh.getLastRow()+1,1,rows.length,10).setValues(rows);
  SpreadsheetApp.flush();
}
/**
 * 給既有 doPost 使用的原子化庫存入口。
 * 注意 orderId 必須是現有正式儲存程式即將使用的「同一個穩定報名編號」。
 * persistCallback 必須是現有「寫入訂單」函式，回傳 {ok:true, id:orderId}。
 * 同一個 Apps Script 專案內，所有會消耗庫存的報名/修改入口都必須使用本函式。
 */
function lyStockGuardSave_(payload,orderId,persistCallback) {
  if(typeof persistCallback!=='function'||!orderId)throw Error('缺少儲存動作或正式報名編號');
  if(!payload||payload.event!==LYY_STOCK.event)return persistCallback();
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(30000))throw Error('目前報名人數較多，請稍後重新送出');
  try {
    var ss=lyStockBook_();
    if(lyStockIsLegacy_(ss,orderId))return persistCallback();
    var want=lyStockNeeded_(payload,ss),held=lyStockHeldForOrder_(ss,orderId),
        left=lyStockReserved_(ss),delta={};
    Object.keys(want).forEach(function(sku){
      delta[sku]=want[sku]-(held[sku]||0);
      if(delta[sku]>left[sku]){
        var label=sku===LYY_STOCK.incense?'廣財運通香':'鎮煞護安香粉';
        throw Error(label+'庫存不足，請減少數量或取消部分登記後重新送出');
      }
    });
    // 先預留，再執行原始儲存；儲存失敗時在同一把鎖內釋回。
    lyStockAppend_(ss,orderId,delta,'預留／修正','與正式報名送出同步');
    try{
      var result=persistCallback();
      if(!result||result.ok!==true)throw Error(result&&result.error||'報名寫入失敗');
      return result;
    }catch(err){
      var inverse={};
      Object.keys(delta).forEach(function(sku){inverse[sku]=-delta[sku];});
      lyStockAppend_(ss,orderId,inverse,'失敗釋回','原訂單寫入未成功：'+String(err));
      throw err;
    }
  } finally {lock.releaseLock();}
}
function lyStockPublicStatus_(event) {
  if(event!==LYY_STOCK.event)return{ok:false,error:'活動代碼不符'};
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(12000))return{ok:false,error:'目前庫存忙碌中'};
  try{
    return{ok:true,event:LYY_STOCK.event,available:lyStockReserved_(lyStockBook_())};
  }finally{lock.releaseLock();}
}
/** 行政取消正式訂單時，必須在鎖內釋回持有數，請與原有取消流程整合。 */
function lyStockReleaseOrder_(orderId,persistCancel) {
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(30000))throw Error('庫存忙碌中，請稍後重試');
  try{
    var ss=lyStockBook_();
    if(lyStockIsLegacy_(ss,orderId))return persistCancel();
    var held=lyStockHeldForOrder_(ss,orderId),result=persistCancel();
    if(!result||result.ok!==true)throw Error(result&&result.error||'取消訂單失敗');
    var inverse={};
    Object.keys(held).forEach(function(k){inverse[k]=-held[k];});
    lyStockAppend_(ss,orderId,inverse,'取消釋回','行政取消正式訂單');
    return result;
  }finally{lock.releaseLock();}
}
