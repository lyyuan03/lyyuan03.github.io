/* 116 年共用庫存：後端必須先提供 action=inventory。
 * 沒有收到符合規格的後端庫存回應時，不顯示臆測庫存、也不改動既有報名欄位。
 * 最終防超賣以 Google Apps Script 的 lyStockGuardSave_ 為準。
 */
(() => {
  'use strict';
  if ((window.LYYUAN_SIGNUP_EVENT || '') !== 'lamp-116-dingwei') return;
  const form = document.getElementById('form');
  const items = document.getElementById('items');
  const productsBox = document.getElementById('products');
  if (!form || !items || !productsBox) return;
  const skuUnits = {
    p1:['guangcai-incense',1], p2:['guangcai-incense',3],p3:['guangcai-incense',3],
    p4:['zhen-sha-powder',3],p5:['zhen-sha-powder',3]
  };
  const mappedProducts = () => {
    const list = typeof CFG !== 'undefined' && CFG && Array.isArray(CFG.products) ?
      CFG.products : (window.LYYUAN_SIGNUP_DEFAULT_CONFIG?.products || []);
    return list.map((p,i) => ({i,sku:skuUnits[p.id]?.[0],units:skuUnits[p.id]?.[1] || 0}))
      .filter(p => p.sku && p.units);
  };
  let available = null;
  let requestRunning = false;
  let supported = true;
  let note = null;
  const isEdit = () => typeof editToken !== 'undefined' && !!editToken;
  const quantity = i => {
    const input = document.querySelector('[data-quantity="'+i+'"]');
    const n = input ? Number(input.value) : 0;
    return Number.isSafeInteger(n) && n > 0 ? n : 0;
  };
  const giftCount = () => {
    const checkbox = document.getElementById('check-head_guangcai');
    if (!checkbox || !checkbox.checked) return 0;
    const entry = document.querySelector('[data-key="head_guangcai"]');
    return entry ? entry.querySelectorAll('.person-list .person').length * 2 : 0;
  };
  function demand() {
    const consumed = {'guangcai-incense':giftCount(),'zhen-sha-powder':0};
    mappedProducts().forEach(({i,sku,units}) => { consumed[sku] += quantity(i)*units; });
    return consumed;
  }
  function validatePayload(payload) {
    if (!available || isEdit()) return '';
    let needed = {'guangcai-incense':0,'zhen-sha-powder':0};
    (payload.products || []).forEach((p,i) => {
      const product = mappedProducts().find(x => x.i === i);
      if (product) needed[product.sku] += (Number(p.qty) || 0) * product.units;
    });
    const h = (payload.lamps || []).find(p => p.key === 'head_guangcai' && p.selected);
    if (h) needed['guangcai-incense'] += 2 * (h.people || []).length;
    if (needed['guangcai-incense'] > available['guangcai-incense'])
      return '廣財運通香目前庫存不足；單盒、三盒組及總燈首每位贈送的兩盒，都必須合併計算。請調整數量。';
    if (needed['zhen-sha-powder'] > available['zhen-sha-powder'])
      return '鎮煞護安香粉目前可用庫存不足，請減少三包組數量。';
    return '';
  }
  window.LYYUAN_STOCK_VALIDATE = validatePayload;
  function update() {
    if (!available || form.classList.contains('signup-closed')) return;
    if (!note) {
      note = document.createElement('p');
      note.className = 'hint';
      note.id = 'inventoryLiveNote';
      note.setAttribute('role','status');
      note.style.cssText = 'margin:12px 0;padding:10px 14px;border:1px solid #bda477;border-radius:9px;background:#faf1dd;color:#6d4d2b;font-size:13px;';
      const hint = items.querySelector('.hint');
      if(hint) hint.insertAdjacentElement('afterend',note);
      else items.prepend(note);
    }
    note.textContent = '可登記庫存：廣財運通香 ' + available['guangcai-incense'] +
      ' 盒、鎮煞護安香粉 ' + available['zhen-sha-powder'] +
      ' 包。不同優惠組合與總燈首贈品共用庫存；實際以送出當下確認為準。';
    if (isEdit()) return;
    const used = demand();
    mappedProducts().forEach(({i,sku,units}) => {
      const input = document.querySelector('[data-quantity="'+i+'"]');
      if (!input) return;
      const current = quantity(i);
      const can = Math.max(0, Math.floor((available[sku] - (used[sku] - current*units)) / units));
      input.max = String(can);
      if (current === 0) input.disabled = can === 0;
      else input.disabled = false;
      input.setCustomValidity(current > can ? '庫存不足，請減少請購數量。' : '');
      const row = input.closest('.product');
      if (row) row.classList.toggle('inventory-soldout',can === 0 && current === 0);
    });
    const checkbox = document.getElementById('check-head_guangcai');
    if (checkbox) {
      const other = used['guangcai-incense'] - giftCount();
      const maxGift = available['guangcai-incense'] - other;
      if (!checkbox.checked) checkbox.disabled = maxGift < 2;
      else checkbox.setCustomValidity(giftCount() > maxGift ? '總燈首每位須保留兩盒廣財運通香，目前庫存不足。' : '');
    }
  }
  async function refresh() {
    if (!supported || requestRunning || !window.LYYUAN_SIGNUP_WEBAPP_URL) return;
    requestRunning = true;
    try {
      const url = new URL(window.LYYUAN_SIGNUP_WEBAPP_URL);
      url.searchParams.set('action','inventory');
      url.searchParams.set('event','lamp-116-dingwei');
      const response = await fetch(url,{redirect:'follow'});
      const data = await response.json();
      const stock = data && data.available;
      if (data.ok !== true || data.event !== 'lamp-116-dingwei' ||
          !stock || !Number.isSafeInteger(stock['guangcai-incense']) ||
          !Number.isSafeInteger(stock['zhen-sha-powder'])) {
        supported = false; return;
      }
      available = stock;
      update();
    } catch (e) { supported = false; }
    finally { requestRunning = false; }
  }
  form.addEventListener('input', () => queueMicrotask(update));
  form.addEventListener('change', () => queueMicrotask(update));
  const observer = new MutationObserver(() => queueMicrotask(update));
  observer.observe(productsBox,{childList:true});
  refresh();
  setInterval(() => { if (supported) refresh(); },60000);
})();
