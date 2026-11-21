/* 無極老母聖誕點燈：正式報名、查詢與修改。
   比照靈元院太歲燈的登記／管理流程：送出後寫入 Google 試算表「靈元院報名表｜116年（2027）」的
   「115無極老母聖誕｜報名總表」與「115無極老母聖誕」分頁，並寄出附有專屬修改連結的確認信。 */
(() => {
  'use strict';
  const api = window.WujiDraft;
  if (!api) return;
  const ENDPOINT = 'https://script.google.com/macros/s/AKfycbxLttoHeCny0M73MJK7LiWDGMWYkG278hPMGzO97N0dG6x8eOzJNL-7cNIWeG_mlpQ/exec';
  const $ = (selector, context=document) => context.querySelector(selector);
  const $$ = (selector, context=document) => [...context.querySelectorAll(selector)];
  const {roleDefs, sponsors, personMarkup, calculate, refreshAvailability,
    switchView, fmt, previewRecords, escapeHTML, liveUsed, setEditMode} = api;
  const roleMap = new Map(roleDefs.map(role => [role.key, role]));
  const sponsorMap = new Map(sponsors.map(sponsor => [sponsor.id, sponsor]));
  let editToken = '';
  let editId = '';
  let submitting = false;

  const value = (selector, scope=document) => $(selector, scope)?.value || '';
  const rowValue = row => ({
    name: value('[data-person-name]', row),
    calendar: value('[data-calendar]', row),
    year: value('[data-birth-year]', row),
    month: value('[data-birth-month]', row),
    day: value('[data-birth-day]', row),
    homeAddress: value('[data-home-address]', row),
    spiritualQuestion: value('[data-spiritual-question]', row),
    familyNames: value('[data-family-names]', row),
    donation: value('[data-donation-amount]', row)
  });
  const selectedRows = card => $$('.person-entry', card).map(rowValue);

  function captureRegistration() {
    return {
      registrant: {
        name: value('#registrant-name'),
        email: value('#registrant-email'),
        phone: value('#registrant-phone')
      },
      roles: $$('.role-card').filter(card => $('.role-check', card).checked).map(card => ({
        key: card.dataset.roleKey,
        rows: selectedRows(card),
        qualifications: $$('[data-qual]:checked', card).map(x => x.value),
        delivery: value('[data-delivery-address]', card)
      })),
      sponsors: $$('.sponsor-card').filter(card => $('.sponsor-check', card).checked).map(card => ({
        key: card.dataset.sponsor,
        rows: selectedRows(card)
      })),
      remittance: {
        lastFive: value('#remit-last-five'),
        reference: value('#remit-reference'),
        certificate: value('#certificate'),
        note: value('#registrant-note')
      },
      agreements: $$('.required-agreement').map(x => x.checked)
    };
  }

  function writeRow(row, data) {
    const values = [
      ['[data-person-name]', data.name], ['[data-calendar]', data.calendar],
      ['[data-birth-year]', data.year], ['[data-birth-month]', data.month],
      ['[data-birth-day]', data.day], ['[data-home-address]', data.homeAddress],
      ['[data-spiritual-question]', data.spiritualQuestion],
      ['[data-family-names]', data.familyNames],
      ['[data-donation-amount]', data.donation]
    ];
    values.forEach(([selector, next]) => { const input = $(selector, row); if (input) input.value = next || ''; });
  }

  function restoreRegistration(snapshot) {
    const set = (selector, next) => { const input = $(selector); if (input) input.value = next || ''; };
    const roles = snapshot.roles || [], sponsorList = snapshot.sponsors || [];
    const registrant = snapshot.registrant || {}, remittance = snapshot.remittance || {};
    set('#registrant-name', registrant.name);
    set('#registrant-email', registrant.email);
    set('#registrant-phone', registrant.phone);
    $$('.role-card').forEach(card => {
      const saved = roles.find(x => x.key === card.dataset.roleKey);
      const checked = Boolean(saved);
      $('.role-check', card).checked = checked;
      $('.role-details', card).hidden = !checked;
      card.classList.toggle('selected', checked);
      const list = $('.people-list', card);
      list.replaceChildren();
      $$('[data-qual]', card).forEach(x => { x.checked = Boolean(saved && (saved.qualifications || []).includes(x.value)); });
      const delivery = $('[data-delivery-address]', card);
      if (delivery) delivery.value = saved?.delivery || '';
      if (saved) {
        saved.rows.forEach(rowData => {
          list.insertAdjacentHTML('beforeend', personMarkup(false, false, card.dataset.roleKey.endsWith('-deputy'), card.dataset.roleKey === 'master'));
          writeRow(list.lastElementChild, rowData);
        });
      }
    });
    $$('.sponsor-card').forEach(card => {
      const saved = sponsorList.find(x => x.key === card.dataset.sponsor);
      const checked = Boolean(saved);
      $('.sponsor-check', card).checked = checked;
      $('.sponsor-people', card).hidden = !checked;
      card.classList.toggle('selected', checked);
      const list = $('.people-list', card);
      list.replaceChildren();
      if (saved) saved.rows.forEach(rowData => {
        list.insertAdjacentHTML('beforeend', personMarkup(true, card.dataset.price === 'variable'));
        writeRow(list.lastElementChild, rowData);
      });
    });
    set('#remit-last-five', remittance.lastFive);
    set('#remit-reference', remittance.reference);
    if (remittance.certificate) set('#certificate', remittance.certificate);
    set('#registrant-note', remittance.note);
    $$('.required-agreement').forEach((x, i) => { x.checked = Boolean((snapshot.agreements || [])[i]); });
    refreshAvailability();
    calculate();
  }

  function resetRegistration() {
    $('#offering-form').reset();
    $$('.role-card,.sponsor-card').forEach(card => {
      const check = $('.role-check,.sponsor-check', card);
      check.checked = false;
      $('.role-details,.sponsor-people', card).hidden = true;
      card.classList.remove('selected');
      $('.people-list', card).replaceChildren();
    });
    refreshAvailability();
    calculate();
  }

  function showDialog(dialog) {
    if (!dialog.open && typeof dialog.showModal === 'function') dialog.showModal();
    else if (!dialog.open) dialog.setAttribute('open', '');
  }

  async function callApi(payload) {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {'Content-Type': 'text/plain;charset=utf-8'},
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!data || data.ok !== true) throw new Error(data && data.error ? data.error : '系統暫時無法處理，請稍後再試。');
    return data;
  }

  async function loadStatus() {
    try {
      const url = new URL(ENDPOINT);
      url.searchParams.set('action', 'wuji-status');
      url.searchParams.set('t', String(Date.now()));
      const response = await fetch(url.toString());
      const data = await response.json();
      if (data && data.ok && data.used) {
        Object.keys(liveUsed).forEach(key => delete liveUsed[key]);
        Object.assign(liveUsed, data.used);
        refreshAvailability();
      }
    } catch (error) { /* 名額由伺服器送出時再次檢查 */ }
  }

  function ownCountsOf(snapshot) {
    const counts = {};
    (snapshot.roles || []).forEach(x => { counts[x.key] = (x.rows || []).length; });
    return counts;
  }

  function showEditBanner() {
    const box = $('#lookup-message');
    box.replaceChildren();
    const text = document.createElement('span');
    text.textContent = '正在修改報名編號 ' + editId + ' 的資料，修改後請按「確認送出」更新。';
    const leave = document.createElement('button');
    leave.type = 'button';
    leave.className = 'btn neutral edit-leave';
    leave.textContent = '離開修改，填寫新報名';
    leave.addEventListener('click', () => leaveEdit(true));
    box.append(text, leave);
    box.hidden = false;
  }

  function leaveEdit(reset) {
    editToken = '';
    editId = '';
    setEditMode(false);
    const box = $('#lookup-message');
    box.hidden = true;
    box.replaceChildren();
    const url = new URL(location.href);
    if (url.searchParams.has('edit')) { url.searchParams.delete('edit'); history.replaceState(null, '', url); }
    if (reset) resetRegistration();
    refreshAvailability();
  }

  function beginEdit(id, token, snapshot) {
    editToken = token;
    editId = id;
    setEditMode(true, ownCountsOf(snapshot));
    restoreRegistration(snapshot);
    $$('.registration-dialog').forEach(dialog => { if (dialog.open) dialog.close(); });
    switchView('front');
    showEditBanner();
    $('#form-feedback').hidden = true;
    $('#register').scrollIntoView({behavior:'auto', block:'start'});
  }

  async function openEditFromLink() {
    const token = new URLSearchParams(location.search).get('edit');
    if (!token) return;
    const box = $('#lookup-message');
    box.textContent = '正在載入您的報名資料…';
    box.hidden = false;
    try {
      const url = new URL(ENDPOINT);
      url.searchParams.set('action', 'wuji-load');
      url.searchParams.set('token', token);
      const response = await fetch(url.toString());
      const data = await response.json();
      if (!data || data.ok !== true || !data.data) throw new Error(data && data.error ? data.error : '找不到這筆報名');
      beginEdit(data.id, token, data.data);
    } catch (error) {
      box.textContent = '無法載入報名資料：' + error.message + '。請改用「開啟查詢／修改」重新查詢。';
    }
  }

  function setSubmitting(on) {
    submitting = on;
    $$('button[type=submit][form="offering-form"], #offering-form button[type=submit]').forEach(button => { button.disabled = on; });
  }

  function renderResult(data, registrantEmail) {
    const dialog = $('#registration-result-dialog');
    $('h2', dialog).textContent = data.updated ? '報名資料已更新' : '報名完成';
    const pending = (data.totals && data.totals.pending) || [];
    $('#registration-result-content').innerHTML = `
      <dl class="registration-receipt">
        <div><dt>報名編號</dt><dd>${escapeHTML(data.id)}</dd></div>
        <div><dt>點燈與護持項目</dt><dd>${(data.items || []).map(escapeHTML).join('<br>')}</dd></div>
        <div><dt>目前可計算金額</dt><dd>${fmt((data.totals && data.totals.computable) || 0)}</dd></div>
        ${pending.length ? `<div><dt>待行政核定</dt><dd>${pending.map(escapeHTML).join('<br>')}</dd></div>` : ''}
      </dl>`;
    const note = $('#registration-result-note');
    note.textContent = data.emailed
      ? '確認信已寄至 ' + registrantEmail + '，信中附有「查詢／修改我的報名」專屬連結，請妥善保存並勿轉傳。'
      : '請記下報名編號。之後可在本頁「查詢／修改我的報名」輸入報名編號、Gmail 與行動電話／Telegram 修改資料。';
    showDialog(dialog);
  }

  async function submitLive(feedback) {
    if (submitting) return;
    const snapshot = captureRegistration();
    const payload = Object.assign({action: 'wuji-submit', mode: editToken ? 'edit' : 'new', honeypot: ''}, snapshot);
    if (editToken) payload.token = editToken;
    setSubmitting(true);
    try {
      const data = await callApi(payload);
      feedback.hidden = true;
      feedback.textContent = '';
      leaveEdit(false);
      resetRegistration();
      renderResult(data, snapshot.registrant.email);
    } catch (error) {
      feedback.hidden = false;
      feedback.textContent = error.message || '送出失敗，請稍後再試。';
    } finally {
      setSubmitting(false);
      loadStatus();
    }
  }

  function showRecords() {
    const result = $('#lookup-result');
    result.hidden = true;
    result.textContent = '';
    if (!value('#lookup-email') && value('#registrant-email')) $('#lookup-email').value = value('#registrant-email');
    if (!value('#lookup-phone') && value('#registrant-phone')) $('#lookup-phone').value = value('#registrant-phone');
    showDialog($('#session-records-dialog'));
  }

  $('#lookup-form').addEventListener('submit', async event => {
    event.preventDefault();
    const result = $('#lookup-result');
    const button = $('#lookup-submit');
    result.hidden = false;
    const email = value('#lookup-email').trim(), phone = value('#lookup-phone').trim();
    if (!email || !$('#lookup-email').checkValidity() || !phone) { result.textContent = '請填寫報名時的 Gmail 與行動電話／Telegram。'; return; }
    result.textContent = '查詢中，請稍候…';
    button.disabled = true;
    try {
      const data = await callApi({action: 'wuji-lookup', regId: value('#lookup-reg-id').trim(), email, phone});
      if (data.found === true && data.token && data.data) beginEdit(data.id, data.token, data.data);
      else result.textContent = data.message || '查無符合的報名。';
    } catch (error) {
      result.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });

  // 行政後台（隱藏區塊）沿用原有試算工具
  function renderRecords() {
    const q = value('#admin-search').trim().toLowerCase();
    const status = value('#admin-status-filter');
    const filtered = previewRecords.filter(record =>
      (!q || [record.id, record.name, record.lamp].join(' ').toLowerCase().includes(q)) &&
      (!status || record.status === status));
    $('#admin-record-rows').innerHTML = filtered.length ? filtered.map(record => `
      <tr><td>${escapeHTML(record.id)}</td><td>${escapeHTML(record.name)}</td>
      <td>${escapeHTML(record.lamp)}</td><td>${fmt(record.amount)}</td>
      <td><span class="admin-status-tag">${escapeHTML(record.status)}</span></td><td></td></tr>`).join('') : '<tr><td colspan="6" class="empty">查無符合的登記資料</td></tr>';
    $('#admin-count').textContent = previewRecords.length;
    $('#admin-pending-count').textContent = previewRecords.filter(x => x.status === '待確認').length;
    $('#admin-paid-count').textContent = previewRecords.filter(x => x.status === '已核帳').length;
  }

  document.addEventListener('click', event => {
    const close = event.target.closest('[data-close-dialog]');
    if (close) { const dialog = document.getElementById(close.dataset.closeDialog); if (dialog?.open) dialog.close(); }
  });
  $('#admin-search').addEventListener('input', renderRecords);
  $('#admin-status-filter').addEventListener('change', renderRecords);

  function renderPriceSettings() {
    const roleRows = roleDefs.map(role => `<label class="admin-price-row"><span>${escapeHTML(role.name)}</span>
      <input type="number" min="0" step="1" inputmode="numeric" data-role-price="${role.key}"
      value="${role.price == null ? '' : role.price}" placeholder="待行政核定" aria-label="${escapeHTML(role.name)}功德金"></label>`);
    const sponsorRows = sponsors.filter(s => s.price != null).map(s => `<label class="admin-price-row"><span>${escapeHTML(s.name)}</span>
      <input type="number" min="0" step="1" inputmode="numeric" data-sponsor-price="${s.id}"
      value="${s.price}" aria-label="${escapeHTML(s.name)}功德金"></label>`);
    $('#price-settings').innerHTML = '<h3>點燈功德金</h3>' + roleRows.join('') +
      '<h3>建院隨喜功德</h3>' + sponsorRows.join('') +
      '<p class="small-notice">「神像供具贊助」與「硬體設備贊助」維持逐筆填寫隨喜金額。</p>';
  }

  $('#apply-prices').addEventListener('click', () => {
    const inputs = $$('[data-role-price],[data-sponsor-price]');
    const invalid = inputs.find(input => input.value !== '' && (!input.checkValidity() || !Number.isSafeInteger(Number(input.value))));
    const msg = $('#price-settings-message');
    msg.hidden = false;
    if (invalid) { msg.textContent = '請填寫有效的非負整數功德金，尚未核定的欄位請留白。'; invalid.focus(); return; }
    $$('[data-role-price]').forEach(input => {
      const role = roleMap.get(input.dataset.rolePrice);
      role.price = input.value === '' ? null : Number(input.value);
      const card = $(`[data-role-key="${role.key}"]`);
      if (card) $('.role-price', card).textContent = role.price == null ? '金額待核定' : fmt(role.price) + '／位';
    });
    $$('[data-sponsor-price]').forEach(input => {
      const sponsor = sponsorMap.get(input.dataset.sponsorPrice);
      sponsor.price = Number(input.value);
      const card = $(`[data-sponsor="${sponsor.id}"]`);
      if (card) { card.dataset.price = sponsor.price; $('.sponsor-head b', card).textContent = fmt(sponsor.price) + '／筆'; }
    });
    calculate();
    msg.textContent = '已套用至目前開啟的頁面；重新整理後還原，沒有更改正式設定。';
  });

  $('#apply-page-text').addEventListener('click', () => {
    const msg = $('#page-text-message');
    msg.hidden = false;
    $('.event-explainer > div > p').textContent = value('#edit-event-info');
    const benefits = $('.reserved-benefits .benefit-copy');
    benefits.replaceChildren();
    value('#edit-benefits').split(/\n+/).filter(line => line.trim()).forEach(line => {
      const paragraph = document.createElement('p');
      paragraph.textContent = line;
      benefits.appendChild(paragraph);
    });
    msg.textContent = '網頁文字已套用至本頁，重新整理後還原。';
  });

  renderPriceSettings();
  renderRecords();
  Object.assign(api, {showRecords, submitLive});
  loadStatus();
  setInterval(loadStatus, 60000);
  openEditFromLink();
})();
