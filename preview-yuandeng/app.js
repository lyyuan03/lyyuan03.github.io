/* 115年(丙午) 辭歲謝平安 圓燈總迴向法儀 — 線上登記
   與 /preview-vokdayja/（太歲燈）共用同一個報名後端，以活動代碼 yuandeng-115-bingwu 區分。
   全部內容來自雲端「活動內容設定」；這一頁只負責顯示、試算與送出。 */
'use strict';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const money = n => 'NT$ ' + Number(n).toLocaleString('zh-TW');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rich = s => esc(s).replace(/&lt;(\/?)(strong|b)&gt;/g, '<$1$2>').replace(/&lt;br\s*\/?&gt;/g, '<br>');
const EVENT = 'yuandeng-115-bingwu';
window.LYYUAN_SIGNUP_WEBAPP_URL = window.LYYUAN_SIGNUP_WEBAPP_URL || 'https://script.google.com/macros/s/AKfycbzVWhkaSoSIsBKTBcYnmbAg9Gbka0aBczkSQeAVsvWlz7a6rqByzwuCVlkykMnmTHRh/exec';
const ENDPOINT = window.LYYUAN_SIGNUP_WEBAPP_URL;
const PROFILE_KEY = 'lyyuan.yuandeng.profile.v1';
const PREVIEW_TOKEN = (() => { try { const t = new URLSearchParams(location.search).get('preview'); return t && /^[A-Za-z0-9_-]{16,80}$/.test(t) ? t : ''; } catch { return ''; } })();
const ICON = '<svg viewBox="0 0 40 50" fill="none" aria-hidden="true"><path d="M20 2v5M9 9h22M10 12c-8 10-8 17 0 25h20c8-8 8-15 0-25H10ZM9 40h22M20 40v8M15 43v4M25 43v4" stroke="currentColor" stroke-width="1.1"/><path d="M20 13v23M13 13c-4 10-4 15 0 23M27 13c4 10 4 15 0 23" stroke="currentColor" opacity=".45"/><ellipse cx="20" cy="25" rx="5" ry="8" fill="currentColor" opacity=".18"/></svg>';

let CFG = null, eventStatus = '開放', previewMode = false, uid = 0, currentTotal = 0, submitting = false, loadingEdit = false;
let editToken = null, editId = null;
const previewEntries = new Map();
const formNode = $('#form');
const cfgGet = path => path.split('.').reduce((o, k) => o == null ? o : o[k], CFG);
const optLabel = l => l.option || (/（燈首）\s*$/.test(l.name) ? '燈首' : '個人燈');
const famLabel = id => ((CFG.families || []).find(f => f.id === id) || {}).label || id;

/* ───── 雲端設定 ───── */
function cfgLooksValid(c) {
  const arr = a => Array.isArray(a) && a.length > 0, num = n => Number.isSafeInteger(n) && n >= 0;
  try {
    return !!(c && c.schema === 1 && c.event === EVENT && arr(c.families) && arr(c.lamps) && Array.isArray(c.products) && Array.isArray(c.sponsors) && arr(c.agreements) &&
      c.meta && c.copy && c.page && c.roleLabels &&
      c.lamps.every(l => l.key && c.families.some(f => f.id === l.family) && l.role === '個人' && num(l.price)) &&
      c.sponsors.every(x => x.key && x.title && num(x.fixed)) && new Set(c.lamps.map(l => l.key)).size === c.lamps.length);
  } catch { return false; }
}
function evGate(msg) {
  const r = document.documentElement;
  if (!msg) { r.removeAttribute('data-ev'); r.removeAttribute('data-ev-msg'); return; }
  document.title = '靈元院・圓燈總迴向法儀';
  r.setAttribute('data-ev', 'unavailable'); r.setAttribute('data-ev-msg', msg);
}
function announceDeadline() {
  document.dispatchEvent(new CustomEvent('lyyuan-config', { detail: { deadline: CFG.meta.deadline || '', ritualDate: CFG.meta.ritualDate || '', ritualNote: CFG.meta.ritualNote || '' } }));
}
function applyStaticCopy() {
  document.title = CFG.meta.pageTitle || document.title;
  $$('[data-cfg]').forEach(el => { const v = cfgGet(el.dataset.cfg); if (typeof v === 'string' && v) el.textContent = v; });
  $$('[data-cfg-html]').forEach(el => { const v = cfgGet(el.dataset.cfgHtml); if (typeof v === 'string' && v) el.innerHTML = rich(v); });
  $$('[data-cfg-tail]').forEach(el => { const v = cfgGet(el.dataset.cfgTail); let t = null; el.childNodes.forEach(n => { if (n.nodeType === 3 && n.nodeValue.trim()) t = n; }); if (t && typeof v === 'string' && v) t.nodeValue = v; });
  const img = { src: '/assets/yuandeng-banner-2027-yuandeng.webp', srcset: '/assets/yuandeng-banner-2027-yuandeng-1048.webp 1048w, /assets/yuandeng-banner-2027-yuandeng.webp 2097w', alt: '辭歲謝平安・圓燈總迴向法儀　116/1/31（日）丙午' }, slot = $('#bannerSlot'), pic = $('#bannerImg');
  if (img && img.src) { if (img.srcset) { pic.srcset = img.srcset; pic.sizes = '(max-width: 1120px) 100vw, 1120px'; } pic.src = img.src; pic.alt = img.alt || ''; pic.hidden = false; slot.classList.remove('empty'); }
  else { pic.hidden = true; slot.classList.add('empty'); }
  $('#transferInfo').innerHTML = rich(CFG.page.transferInfo || '');
  const note = $('#modeNote');
  if (previewMode) { note.textContent = '預覽／測試模式：此活動尚未正式開放。此時送出的資料僅供測試，行政會清除。'; note.hidden = false; }
  else if (eventStatus === '關閉') { note.textContent = '本次報名目前已關閉，暫不接受新的報名。'; note.hidden = false; }
  else note.hidden = true;
}
function applyConfig(c) {
  CFG = c;
  applyStaticCopy(); renderLamps(); renderSponsors(); renderAgreements(); syncAll();
  if (eventStatus === '關閉' && !previewMode) {
    $$('#form input,#form select,#form textarea,#form button').forEach(x => { x.disabled = true; });
    $$('button[type="submit"]').forEach(x => { x.disabled = true; x.textContent = '報名已關閉'; });
  }
}

/* ───── 禮謝燈 ───── */
function personHTML() {
  const id = ++uid;
  return `<div class="person"><div class="person-title">芳名</div><button type="button" class="remove">移除此位</button><label for="pn${id}" class="req">姓名</label><input id="pn${id}" data-person-name required maxlength="40" autocomplete="off" placeholder="請填芳名"></div>`;
}
function optionHTML(l) {
  /* 沿用太歲燈（preview-vokdayja）「總燈首」卡片版型：勾選框＋圖示＋粗體標題＋小標（燈別）＋右側金額，勾選後展開詳細框（.people） */
  const fam = (CFG.families.find(f => f.id === l.family) || {}).label || '';
  return `<div class="yd-option" data-key="${esc(l.key)}"><label class="lamp-head yd-opt-head"><input type="checkbox" class="opt-check"><span class="lamp-icon">${ICON}</span><span class="lamp-name"><strong>${esc(optLabel(l))}</strong><small>${esc(fam)}</small></span><span class="price">${money(l.price)}／位</span></label><div class="people yd-names" hidden><div class="person-list"></div><button type="button" class="subbtn add-person">${esc(CFG.copy.addPerson || '＋ 新增芳名')}</button></div></div>`;
}
function renderLamps() {
  /* 上方一排燈別分頁（沿用太歲燈 .tabs 底線樣式）；點選燈別後，下方顯示該燈別的「燈首／個人燈」兩張卡片 */
  const box = $('#lampFamilies'); box.innerHTML = '';
  const fams = CFG.families.map(f => ({ f, ls: CFG.lamps.filter(l => l.family === f.id && l.enabled !== false).sort((a, b) => (optLabel(a) === '燈首' ? 0 : 1) - (optLabel(b) === '燈首' ? 0 : 1)) })).filter(x => x.ls.length);
  box.insertAdjacentHTML('beforeend', `<div class="tabs yd-tabs" role="tablist" aria-label="禮謝燈別">${fams.map((x, i) => `<button type="button" role="tab" id="yd-tab-${esc(x.f.id)}" aria-selected="${i === 0}" aria-controls="yd-lamp-${esc(x.f.id)}" data-yd-tab="${esc(x.f.id)}"${i ? ' tabindex="-1"' : ''}><span class="yd-tab-label">${esc(x.f.label)}</span><em class="yd-tab-count" hidden></em></button>`).join('')}</div>`);
  fams.forEach((x, i) => {
    box.insertAdjacentHTML('beforeend', `<div class="yd-family" id="yd-lamp-${esc(x.f.id)}" role="tabpanel" aria-labelledby="yd-tab-${esc(x.f.id)}" data-family="${esc(x.f.id)}" data-label="${esc(x.f.label)}"${i ? ' hidden' : ''}><input type="checkbox" class="fam-check" id="fam-${esc(x.f.id)}" hidden tabindex="-1" aria-hidden="true"><div class="yd-options">${x.ls.map(optionHTML).join('')}</div></div>`);
  });
}
function activateLampTab(id, focus) {
  $$('#lampFamilies [data-yd-tab]').forEach(b => {
    const on = b.dataset.ydTab === id;
    b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus();
    const panel = $('#' + b.getAttribute('aria-controls')); if (panel) panel.hidden = !on;
  });
}
function lampEl(key) { return $(`.yd-option[data-key="${key}"]`); }
function isSelected(key) { const o = lampEl(key); return !!(o && o.querySelector('.opt-check').checked); }
function namesOf(key) { const o = lampEl(key); return o ? [...o.querySelectorAll('[data-person-name]')].map(i => i.value) : []; }
function syncAll() {
  $$('.yd-family').forEach(f => {
    /* 燈別由分頁切換；只要該燈別有勾選任一項，就視為已選（隱藏的 .fam-check 僅作內部同步） */
    const n = f.querySelectorAll('.opt-check:checked').length, on = n > 0;
    f.querySelector('.fam-check').checked = on;
    f.classList.toggle('selected', on);
    const cnt = $(`[data-yd-tab="${f.dataset.family}"] .yd-tab-count`); if (cnt) { cnt.hidden = !on; cnt.textContent = on ? String(n) : ''; }
    f.querySelectorAll('.yd-option').forEach(o => {
      const oc = o.querySelector('.opt-check').checked, list = o.querySelector('.person-list');
      o.classList.toggle('on', oc);
      o.querySelector('.yd-names').hidden = !oc;
      if (oc && !list.children.length) list.insertAdjacentHTML('beforeend', personHTML());
      list.querySelectorAll('input').forEach(i => { i.disabled = !oc; });
    });
  });
  $$('.sponsor-card').forEach(card => {
    const on = card.querySelector('.sponsor-check').checked, list = card.querySelector('.person-list');
    card.classList.toggle('selected', on);
    card.querySelector('.people').hidden = !on;
    if (on && !list.children.length) list.insertAdjacentHTML('beforeend', sponsorRow(card.dataset.fixed));
    list.querySelectorAll('input').forEach(i => { i.disabled = !on; });
  });
  calc();
}
document.addEventListener('click', e => {
  const t = e.target;
  const tab = t.closest && t.closest('#lampFamilies [data-yd-tab]'); if (tab) { activateLampTab(tab.dataset.ydTab); return; }
  if (t.closest('#lampFamilies') || t.closest('#sponsorChoices')) {
    if (t.matches('.add-person')) {
      const list = t.parentElement.querySelector('.person-list'), sponsor = t.closest('.sponsor-card');
      list.insertAdjacentHTML('beforeend', sponsor ? sponsorRow(sponsor.dataset.fixed) : personHTML());
      list.lastElementChild.querySelector('input')?.focus(); calc();
    } else if (t.matches('.remove')) {
      const list = t.closest('.person-list'); t.closest('.person').remove();
      if (!list.children.length) { const c = list.closest('.yd-option')?.querySelector('.opt-check') || list.closest('.sponsor-card')?.querySelector('.sponsor-check'); if (c) c.checked = false; }
      syncAll();
    }
  }
});
document.addEventListener('change', e => { if (e.target.matches('.fam-check,.opt-check,.sponsor-check')) syncAll(); });
document.addEventListener('keydown', e => {
  const b = e.target.closest && e.target.closest('#lampFamilies [data-yd-tab]');
  if (!b || !['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return;
  e.preventDefault();
  const tabs = $$('#lampFamilies [data-yd-tab]'), i = tabs.indexOf(b), n = tabs.length;
  const next = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : (i + (e.key === 'ArrowRight' ? 1 : n - 1)) % n;
  activateLampTab(tabs[next].dataset.ydTab, true);
});

/* ───── 建院隨喜功德 ───── */
function sponsorRow(fixed) {
  const id = ++uid, isFixed = Number(fixed) > 0;
  return `<div class="person"><div class="person-title">贊助資料</div><button type="button" class="remove">移除此筆</button><label for="sn${id}" class="req">姓名</label><input id="sn${id}" data-sponsor-name required maxlength="40" placeholder="請填寫姓名">${isFixed ? '' : `<label for="sa${id}" class="req">隨喜金額（NT$）</label><input id="sa${id}" data-sponsor-amount type="number" required min="1" max="9999999" step="1" placeholder="請填入金額">`}</div>`;
}
function renderSponsors() {
  const box = $('#sponsorChoices'); box.innerHTML = '';
  CFG.sponsors.forEach(s => {
    box.insertAdjacentHTML('beforeend', `<article class="lamp sponsor-card" id="sponsor-${esc(s.key)}" data-key="${esc(s.key)}" data-fixed="${Number(s.fixed) || 0}"><label class="lamp-head"><input type="checkbox" class="sponsor-check"><span class="lamp-icon">${ICON}</span><span class="lamp-name"><strong>${esc(s.title)}</strong></span><span class="price">${s.fixed ? money(s.fixed) + '／筆' : '隨喜功德'}</span></label><div class="people" hidden><div class="person-list"></div><button type="button" class="subbtn add-person">＋ 新增一筆</button></div></article>`);
  });
  $('#donationSection').hidden = !CFG.sponsors.length;
}
function renderAgreements() {
  const box = $('#registrationTerms'); box.querySelectorAll('label.choice').forEach(x => x.remove());
  box.insertAdjacentHTML('beforeend', CFG.agreements.filter(a => a.serverRequired !== false).map(a => `<label class="choice"><input type="checkbox" id="${esc(a.key)}" required><span>${esc(a.text)}</span></label>`).join(''));
}

/* ───── 試算 ───── */
function calc() {
  if (!CFG) return;
  const lines = []; let total = 0;
  CFG.lamps.forEach(l => {
    if (!isSelected(l.key)) return;
    const n = namesOf(l.key).length; if (!n) return;
    lines.push([`${famLabel(l.family)}・${optLabel(l)} ${n} 位`, l.price * n]); total += l.price * n;
  });
  $$('.sponsor-card').forEach(card => {
    if (!card.querySelector('.sponsor-check').checked) return;
    const s = CFG.sponsors.find(x => x.key === card.dataset.key);
    card.querySelectorAll('.person').forEach(row => {
      const name = row.querySelector('[data-sponsor-name]'), amt = row.querySelector('[data-sponsor-amount]'), nm = name.value.trim();
      name.setCustomValidity(nm ? '' : '請填寫姓名。');
      if (!nm || (amt && !amt.validity.valid)) return;
      const price = s.fixed || Number(amt.value); lines.push([`${s.title}・${nm}`, price]); total += price;
    });
  });
  $$('[data-person-name]').forEach(i => { if (!i.disabled) i.setCustomValidity(i.value.trim() ? '' : '請填寫姓名。'); });
  currentTotal = total;
  $('#total').textContent = $('#mobileAmount').textContent = money(total);
  $('#totalNote').textContent = lines.length ? '依本次登記項目即時計算' : '請選擇禮謝燈別或贊助項目。';
  $('#sidebarRows').innerHTML = lines.length ? lines.map(([n, p]) => `<div class="sumrow"><span>${esc(n)}</span><span>${money(p)}</span></div>`).join('') : '<p class="hint">尚未選擇登記項目。</p>';
  $('#breakdown').innerHTML = (lines.length ? lines.map(([n, p]) => `<tr><td>${esc(n)}</td><td class="n">${money(p)}</td></tr>`).join('') : '<tr><td colspan="2">尚未選擇登記項目</td></tr>') + `<tr class="total"><td>功德金總計</td><td class="n">${money(total)}</td></tr>`;
}
formNode.addEventListener('input', calc);

/* ───── 擷取／還原 ───── */
const scalarIds = ['name', 'email', 'phone', 'last5', 'remitNote', 'cert', 'note'];
function captureFields() { const f = {}; scalarIds.forEach(id => { const el = $('#' + id); if (el) f[id] = el.value; }); return f; }
function setPeople(list, rowFn, rows) { list.innerHTML = ''; rows.forEach(vals => { list.insertAdjacentHTML('beforeend', rowFn()); const inputs = list.lastElementChild.querySelectorAll('input'); vals.forEach((v, i) => { if (inputs[i]) inputs[i].value = v ?? ''; }); }); }
function restoreRegistration(data) {
  scalarIds.forEach(id => { const el = $('#' + id); if (el) el.value = (data.fields || {})[id] ?? (id === 'cert' ? '不索取' : ''); });
  $$('.fam-check,.opt-check,.sponsor-check').forEach(c => { c.checked = false; });
  CFG.lamps.forEach(l => {
    const item = (data.lamps || []).find(x => x.key === l.key), names = ((item && item.people) || []).map(p => p.name).filter(n => n != null);
    if (!item || (item.selected === false) || !names.length) return;
    const o = lampEl(l.key); if (!o) return;
    o.closest('.yd-family').querySelector('.fam-check').checked = true; o.querySelector('.opt-check').checked = true;
    setPeople(o.querySelector('.person-list'), personHTML, names.map(n => [n]));
  });
  const firstOn = $$('.yd-option .opt-check').find(c => c.checked); if (firstOn) activateLampTab(firstOn.closest('.yd-family').dataset.family);
  CFG.sponsors.forEach(s => {
    const item = (data.sponsors || []).find(x => x.key === s.key), rows = (item && item.people) || [];
    if (!item || item.selected === false || !rows.length) return;
    const card = $('#sponsor-' + s.key); if (!card) return;
    card.querySelector('.sponsor-check').checked = true;
    setPeople(card.querySelector('.person-list'), () => sponsorRow(s.fixed), rows.map(p => s.fixed ? [p.name] : [p.name, p.amount]));
  });
  $$('#registrationTerms input').forEach(x => { x.checked = !!(data.agreements || {})[x.id]; });
  syncAll();
}

/* ───── 套用之前的報名資料（姓名／Email／電話） ───── */
function readProfile() { try { const p = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null'); return p && p.email ? p : null; } catch { return null; } }
function saveProfile(f, src) { try { localStorage.setItem(PROFILE_KEY, JSON.stringify({ name: f.name || '', email: f.email || '', phone: f.phone || '', src, at: Date.now() })); } catch { /* 無痕模式等：略過 */ } }
function clearProfile() { try { localStorage.removeItem(PROFILE_KEY); } catch { /* ignore */ } }
function showProfileNote(msg, withClear) {
  const n = $('#profileNote'); n.hidden = false;
  n.innerHTML = `<p>${esc(msg)}</p>` + (withClear ? '<button type="button" class="subbtn" id="clearProfile">清除這台裝置記住的資料</button>' : '');
  const b = $('#clearProfile'); if (b) b.onclick = () => { clearProfile(); n.hidden = true; };
}
function fillProfile(p, msg) {
  ['name', 'email', 'phone'].forEach(k => { if (p[k]) $('#' + k).value = p[k]; });
  showProfileNote(msg, true); calc();
  $('#name').scrollIntoView({ block: 'center', behavior: 'smooth' });
}
function applyPrevious() {
  const p = readProfile();
  if (p) { fillProfile(p, '已套用之前的資料（姓名、Email、電話），可自行修改。資料只存在這台裝置的瀏覽器。'); return; }
  const d = $('#myRecordsDialog'); $('#myRecordsBody').innerHTML = '<h2>套用之前的報名資料</h2><div class="notice">這台裝置上沒有找到之前的報名資料。</div><p>請打開您「太歲燈」報名的確認信，點信中的專屬連結，進入頁面後按「以此資料報名圓燈」，即可帶入姓名、Email 與電話。</p><p class="hint">帶入的資料仍可修改；送出後會建立一筆新的圓燈報名，不會更動您的太歲燈報名。</p>'; d.showModal();
}
$('#heroApplyPrev').onclick = applyPrevious; $('#applyPrev').onclick = applyPrevious;

/* ───── 查詢／修改我的報名 ───── */
const recordsDialog = document.createElement('dialog'); recordsDialog.className = 'modal'; recordsDialog.id = 'myRecordsDialog'; recordsDialog.setAttribute('aria-label', '查詢與修改報名');
recordsDialog.innerHTML = '<button class="close" type="button" aria-label="關閉">×</button><div id="myRecordsBody"></div>';
document.body.append(recordsDialog); recordsDialog.querySelector('.close').onclick = () => recordsDialog.close();
recordsDialog.addEventListener('click', e => { if (e.target === recordsDialog) recordsDialog.close(); });
function registrationName(d) { return (d.fields.name || '').trim() || (d.firstName || ''); }
function showMyRecords() {
  $('#myRecordsBody').innerHTML = '<h2>查詢／修改我的報名</h2><div class="notice">修改請使用確認信中的專屬連結。Gmail 收件匣中的確認信連結是正式修改途徑，請勿轉傳。</div><p class="hint">以下僅列出本次開啟期間成功送出的紀錄，重新整理後清除；已寫入報名表的資料仍保留。</p><div>' +
    (previewEntries.size ? [...previewEntries.values()].map(r => `<p>${esc(r.id)}・${esc(registrationName(r.data))}</p>`).join('') : '<p>目前尚無本次開啟期間的紀錄。查詢或修改先前報名，請使用確認信中的專屬連結。</p>') + '</div>';
  recordsDialog.showModal();
}
$('#openMyRecords').onclick = showMyRecords; $('#heroMyRecords').onclick = showMyRecords;

/* ───── 確認信連結：載入並修改 ───── */
function setEditButtons(active) { $$('button[type="submit"]').filter(x => x.form === formNode).forEach(x => { x.textContent = active ? '儲存修改' : '確認送出 →'; }); }
function clearQuery(...keys) { const url = new URL(location.href); keys.forEach(k => url.searchParams.delete(k)); history.replaceState(null, '', url); }
$('#cancelEdit').onclick = () => {
  if (!confirm('離開後將放棄這次尚未儲存的修改，是否繼續？')) return;
  editToken = null; editId = null; clearQuery('edit'); formNode.reset(); restoreRegistration({ fields: {}, lamps: [], sponsors: [], agreements: {} });
  $('#editBanner').hidden = true; setEditButtons(false);
};
async function loadEmailRegistration(token) {
  loadingEdit = true; $('#editBanner').hidden = false; $('#editTitle').textContent = '正在載入報名…'; $('#cancelEdit').hidden = true;
  try {
    const url = new URL(ENDPOINT); url.searchParams.set('action', 'load'); url.searchParams.set('token', token);
    const response = await fetch(url, { redirect: 'follow' }); if (!response.ok) throw new Error('load');
    const data = await response.json(); if (data.ok !== true || !data.id || data.event !== EVENT) throw new Error('token');
    restoreRegistration(data); editToken = token; editId = data.id;
    $('#editTitle').textContent = `正在修改報名 ${editId}`;
    $('#editPolicy').textContent = '修改完成後請按「儲存修改」，資料將更新至原報名。請勿轉傳專屬連結。';
    $('#cancelEdit').hidden = false; setEditButtons(true);
  } catch {
    clearQuery('edit'); $('#editTitle').textContent = '無法載入報名資料';
    $('#editPolicy').textContent = '修改連結可能無效或已過期，請確認使用確認信中的完整連結，或聯繫行政。下方空白表單仍可填寫新報名。';
  } finally { loadingEdit = false; }
}

/* ───── 送出 ───── */
function checkSelection() {
  $('#lampError').textContent = '';
  let lamps = 0, problem = '';
  $$('.yd-family').forEach(f => {
    if (!f.querySelector('.fam-check').checked) return;
    const n = f.querySelectorAll('.opt-check:checked').length;
    if (!n && !problem) problem = `請在「${f.dataset.label}」選擇燈首或個人燈。`;
    lamps += n;
  });
  const sponsors = $$('.sponsor-check:checked').length;
  if (!problem && !lamps && !sponsors) problem = '請至少登記一項禮謝燈或贊助項目。';
  $('#lampError').textContent = problem;
  if (problem) $('#lanterns').scrollIntoView({ block: 'start' });
  return !problem;
}
function buildPayload(savingEdit) {
  const f = captureFields();
  return {
    ...(savingEdit ? { mode: 'edit', token: editToken } : {}),
    ...(PREVIEW_TOKEN ? { preview: PREVIEW_TOKEN } : {}),
    event: EVENT, honeypot: ($('#website') && $('#website').value) || '',
    fields: { name: f.name, email: f.email, phone: f.phone, overseas: false, address: '', last5: f.last5, remitNote: f.remitNote, cert: f.cert, note: f.note },
    lamps: CFG.lamps.map(l => { const sel = isSelected(l.key); return { key: l.key, name: l.name, role: l.role, unitPrice: l.price, selected: sel, people: sel ? namesOf(l.key).map(n => ({ name: n.trim(), calendar: '', birthYear: '', birthMonth: '', birthDay: '', address: '' })) : [] }; }),
    sponsors: CFG.sponsors.map(s => {
      const card = $('#sponsor-' + s.key), sel = !!card && card.querySelector('.sponsor-check').checked;
      return { key: s.key, title: s.title, fixed: s.fixed || 0, selected: sel, people: sel ? [...card.querySelectorAll('.person')].map(r => ({ name: r.querySelector('[data-sponsor-name]').value.trim(), amount: (r.querySelector('[data-sponsor-amount]') || {}).value || '' })) : [] };
    }),
    products: [],
    agreements: Object.fromEntries(CFG.agreements.filter(a => a.serverRequired !== false).map(a => [a.key, !!($('#' + a.key) || {}).checked])),
    totals: { computable: currentTotal, pending: false }
  };
}
formNode.noValidate = true;
formNode.onsubmit = e => {
  e.preventDefault(); if (loadingEdit || submitting || !CFG) return;
  calc();
  if (!checkSelection()) return;
  const invalid = formNode.querySelector(':invalid'); if (invalid) { const pane = invalid.closest('.yd-family'); if (pane && pane.hidden) activateLampTab(pane.dataset.family); invalid.reportValidity(); invalid.focus(); return; }
  const savingEdit = !!editToken, payload = buildPayload(savingEdit), eyebrow = $('#result .eyebrow'), foot = $('#result .result-foot');
  const showFail = msg => { if (eyebrow) eyebrow.textContent = 'SIGNUP FAILED'; $('#result h2').textContent = '送出失敗'; if (foot) foot.hidden = true; $('#resultBody').innerHTML = `<p class="statusmsg error">${esc(msg)}</p><p class="hint">本頁仍保留本次填寫內容，請修正後再試，或聯繫行政。</p>`; };
  const showOk = res => {
    if (res.totals && Number.isFinite(res.totals.computable)) currentTotal = res.totals.computable;
    $('#result').classList.add('yd-ok'); // 過年氛圍：伺服器確認成功後才顯示點亮的燈（festive.css）
    if (eyebrow) eyebrow.textContent = 'SIGNUP COMPLETE'; $('#result h2').textContent = savingEdit ? '已更新' : '報名已送出'; if (foot) foot.hidden = true;
    $('#resultBody').innerHTML = `<p>${esc(payload.fields.name)}，${savingEdit ? '報名資料已更新' : '報名資料已送出'}。</p><p>報名編號：<b style="color:var(--gold)">${esc(res.id || '')}</b></p><p>功德金總計：<b style="color:var(--gold)">${money(currentTotal)}</b></p><div class="notice">${$('#transferInfo').innerHTML}</div><p class="hint">確認信將寄至 ${esc(payload.fields.email)}（若未收到請檢查垃圾郵件匣）。本編號已寫入靈元院報名表。</p>${res.priceAdjusted ? '<p class="hint">金額已依最新價格設定重新計算。</p>' : ''}`;
  };
  submitting = true;
  eyebrow && (eyebrow.textContent = 'SIGNUP'); $('#result h2').textContent = '正在送出…'; $('#resultBody').innerHTML = '<p>正在將報名資料送至靈元院報名表，請稍候。</p>'; if (foot) foot.hidden = true; $('#result').showModal();
  fetch(ENDPOINT, { method: 'POST', mode: 'cors', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) })
    .then(r => r.json().catch(() => ({ ok: false, error: '回應格式錯誤' })))
    .then(res => {
      if (res && res.ok === true && res.id && (!savingEdit || res.updated === true)) {
        previewEntries.set(res.id, { id: res.id, data: { fields: payload.fields } }); saveProfile(payload.fields, 'submit'); showOk(res);
      } else showFail('寫入報名表失敗：' + ((res && res.error) || '未知錯誤'));
    })
    .catch(() => showFail('無法連線報名後端，請稍後再試或聯繫行政。'))
    .finally(() => { submitting = false; });
};
$$('#result .close,#result .closeResult').forEach(b => { b.onclick = () => $('#result').close(); });
window.addEventListener('beforeunload', e => { if (editToken) { e.preventDefault(); e.returnValue = ''; } });

/* ───── 啟動：先載入雲端設定（草稿且沒有預覽金鑰時顯示「尚未開放」） ───── */
(async function boot() {
  let fail = '';
  try {
    const url = new URL(ENDPOINT); url.searchParams.set('action', 'config'); url.searchParams.set('event', EVENT); if (PREVIEW_TOKEN) url.searchParams.set('preview', PREVIEW_TOKEN);
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok) fail = 'net';
    else {
      const data = await response.json();
      if (data.ok !== true || data.event !== EVENT) fail = data && data.status === 404 ? 'unknown' : 'net';
      else {
        eventStatus = typeof data.status === 'string' && data.status ? data.status : '開放';
        previewMode = data.preview === true && eventStatus === '草稿';
        if (!cfgLooksValid(data.config)) fail = eventStatus === '草稿' ? 'draft' : 'net';
        else applyConfig(data.config);
      }
    }
  } catch { fail = 'net'; }
  if (fail) { evGate({ unknown: '找不到這個活動，請確認網址是否正確。', draft: '本次活動尚未開放報名。' }[fail] || '目前無法載入活動內容，請稍後重新整理頁面。'); return; }
  evGate(''); announceDeadline();
  const params = new URLSearchParams(location.search);
  if (params.has('applied')) { clearQuery('applied'); const p = readProfile(); if (p) fillProfile(p, '已帶入您太歲燈報名的資料（姓名、Email、電話），可自行修改。送出後會建立一筆新的圓燈報名，不會更動太歲燈報名。'); }
  if (params.get('edit')) loadEmailRegistration(params.get('edit'));
  if ('IntersectionObserver' in window) { const ob = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); ob.unobserve(en.target); } }), { threshold: .08 }); $$('.reveal').forEach(el => ob.observe(el)); }
  else $$('.reveal').forEach(el => el.classList.add('in'));
})();

/* 右側浮動按鈕：桌機捲動時縮成貼邊半圓，停止捲動 900ms 後展開（只切換 class，不改按鈕本身行為） */
(() => {
  const btn = document.getElementById('exclusiveFloat'); if (!btn) return;
  const mq = window.matchMedia('(min-width: 741px)'); let t = 0;
  addEventListener('scroll', () => {
    if (!mq.matches) { btn.classList.remove('yd-dock'); return; }
    btn.classList.add('yd-dock'); clearTimeout(t); t = setTimeout(() => btn.classList.remove('yd-dock'), 900);
  }, { passive: true });
})();
