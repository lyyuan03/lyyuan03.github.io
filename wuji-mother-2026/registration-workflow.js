/* 無極老母私人草稿：依靈元院太歲燈的登記／管理流程提供本次瀏覽的模擬操作。
   不會連接、修改或寫入任何正式 Google 報名資料。 */
(() => {
  'use strict';
  const api = window.WujiDraft;
  if (!api) return;
  const $ = (selector, context=document) => context.querySelector(selector);
  const $$ = (selector, context=document) => [...context.querySelectorAll(selector)];
  const {roleDefs, sponsors, personMarkup, calculate, refreshAvailability,
    switchView, fmt, previewRecords, escapeHTML} = api;
  const roleMap = new Map(roleDefs.map(role => [role.key, role]));
  const sponsorMap = new Map(sponsors.map(sponsor => [sponsor.id, sponsor]));
  let editingRecordId = null;

  const value = (selector, scope=document) => $(selector, scope)?.value || '';
  const rowValue = row => ({
    name: value('[data-person-name]', row),
    calendar: value('[data-calendar]', row),
    year: value('[data-birth-year]', row),
    month: value('[data-birth-month]', row),
    day: value('[data-birth-day]', row),
    homeAddress: value('[data-home-address]', row),
    spiritualQuestion: value('[data-spiritual-question]', row),
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
      ['[data-donation-amount]', data.donation]
    ];
    values.forEach(([selector, next]) => { const input = $(selector, row); if (input) input.value = next || ''; });
  }

  function restoreRegistration(snapshot) {
    const set = (selector, next) => { const input = $(selector); if (input) input.value = next || ''; };
    set('#registrant-name', snapshot.registrant.name);
    set('#registrant-email', snapshot.registrant.email);
    set('#registrant-phone', snapshot.registrant.phone);
    $$('.role-card').forEach(card => {
      const saved = snapshot.roles.find(x => x.key === card.dataset.roleKey);
      const checked = Boolean(saved);
      $('.role-check', card).checked = checked;
      $('.role-details', card).hidden = !checked;
      card.classList.toggle('selected', checked);
      const list = $('.people-list', card);
      list.replaceChildren();
      if (saved) {
        saved.rows.forEach(rowData => {
          list.insertAdjacentHTML('beforeend', personMarkup(false, false, card.dataset.roleKey.endsWith('-deputy')));
          writeRow(list.lastElementChild, rowData);
        });
        $$('[data-qual]', card).forEach(x => { x.checked = saved.qualifications.includes(x.value); });
        const delivery = $('[data-delivery-address]', card);
        if (delivery) delivery.value = saved.delivery;
      }
    });
    $$('.sponsor-card').forEach(card => {
      const saved = snapshot.sponsors.find(x => x.key === card.dataset.sponsor);
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
    set('#remit-last-five', snapshot.remittance.lastFive);
    set('#remit-reference', snapshot.remittance.reference);
    set('#certificate', snapshot.remittance.certificate);
    set('#registrant-note', snapshot.remittance.note);
    $$('.required-agreement').forEach((x, i) => { x.checked = Boolean(snapshot.agreements[i]); });
    refreshAvailability();
    calculate();
  }

  function registrationLabel(snapshot) {
    return [...snapshot.roles.map(x => roleMap.get(x.key)?.name || x.key),
      ...snapshot.sponsors.map(x => sponsorMap.get(x.key)?.name || x.key)].join('、');
  }
  function makeRecord(snapshot, id) {
    return {
      id,
      name: snapshot.registrant.name,
      lamp: registrationLabel(snapshot),
      amount: Number(($('#sidebar-total')?.textContent || '').replace(/[^\d]/g, '')) || 0,
      pending: snapshot.roles.some(x => roleMap.get(x.key)?.price == null),
      status: '待確認',
      snapshot,
      updatedAt: new Date().toLocaleString('zh-TW', {timeZone:'Asia/Taipei', hour12:false})
    };
  }

  function showDialog(dialog) {
    if (!dialog.open && typeof dialog.showModal === 'function') dialog.showModal();
    else if (!dialog.open) dialog.setAttribute('open', '');
  }
  function renderRecordDetail(record, isNew=false) {
    const dialog = $('#registration-result-dialog');
    $('h2', dialog).textContent = isNew ? '模擬登記完成' : '模擬報名資料';
    $('#registration-result-content').innerHTML = `
      <dl class="registration-receipt">
        <div><dt>登記編號</dt><dd>${escapeHTML(record.id)}</dd></div>
        <div><dt>登記人</dt><dd>${escapeHTML(record.name)}</dd></div>
        <div><dt>點燈與護持項目</dt><dd>${escapeHTML(record.lamp)}</dd></div>
        <div><dt>目前可計算金額</dt><dd>${fmt(record.amount)}</dd></div>
        <div><dt>核定狀態</dt><dd>${record.pending ? '另有金額待核定' : '全部金額已試算'}（示意）</dd></div>
      </dl>
      <label for="preview-record-status">行政狀態（本頁模擬）</label>
      <select id="preview-record-status" data-record-status="${escapeHTML(record.id)}">
        <option${record.status==='待確認'?' selected':''}>待確認</option>
        <option${record.status==='已回報匯款'?' selected':''}>已回報匯款</option>
        <option${record.status==='已核帳'?' selected':''}>已核帳</option>
      </select>
      <button type="button" class="btn neutral" data-edit-record="${escapeHTML(record.id)}">修改本次模擬登記</button>`;
    showDialog(dialog);
  }

  function recordValidSubmission() {
    const snapshot = captureRegistration();
    let record;
    if (editingRecordId) {
      const at = previewRecords.findIndex(x => x.id === editingRecordId);
      if (at >= 0) {
        record = makeRecord(snapshot, editingRecordId);
        record.status = previewRecords[at].status;
        previewRecords.splice(at, 1, record);
      }
      editingRecordId = null;
    }
    if (!record) {
      const id = '草稿-115-' + String(previewRecords.length + 1).padStart(4, '0');
      record = makeRecord(snapshot, id);
      previewRecords.push(record);
    }
    renderRecords();
    renderRecordDetail(record, true);
  }

  function renderRecords() {
    const q = value('#admin-search').trim().toLowerCase();
    const status = value('#admin-status-filter');
    const filtered = previewRecords.filter(record =>
      (!q || [record.id, record.name, record.lamp].join(' ').toLowerCase().includes(q)) &&
      (!status || record.status === status));
    $('#admin-record-rows').innerHTML = filtered.length ? filtered.map(record => `
      <tr><td>${escapeHTML(record.id)}</td><td>${escapeHTML(record.name)}</td>
      <td>${escapeHTML(record.lamp)}</td><td>${record.pending ? `${fmt(record.amount)}＋待核定` : fmt(record.amount)}</td>
      <td><span class="admin-status-tag">${escapeHTML(record.status)}</span></td>
      <td><button type="button" class="admin-detail-button" data-detail-record="${escapeHTML(record.id)}">檢視</button></td></tr>`).join('') : '<tr><td colspan="6" class="empty">查無符合的模擬登記資料</td></tr>';
    $('#admin-count').textContent = previewRecords.length;
    $('#admin-pending-count').textContent = previewRecords.filter(x => x.status === '待確認').length;
    $('#admin-paid-count').textContent = previewRecords.filter(x => x.status === '已核帳').length;
  }

  function renderSessionRecords() {
    $('#session-record-list').innerHTML = previewRecords.length ? previewRecords.map(record => `
      <div class="session-record"><div><strong>${escapeHTML(record.id)}・${escapeHTML(record.name)}</strong>
      <small>${escapeHTML(record.lamp)}</small></div>
      <button type="button" class="btn neutral" data-edit-record="${escapeHTML(record.id)}">修改</button></div>`).join('') :
      '<p>目前沒有本次開啟期間的模擬紀錄。正式報名的查詢與修改須使用確認信中的專屬連結。</p>';
  }
  function showRecords() {
    renderSessionRecords();
    showDialog($('#session-records-dialog'));
  }

  function beginEdit(record) {
    restoreRegistration(record.snapshot);
    editingRecordId = record.id;
    $$('.registration-dialog').forEach(dialog => { if (dialog.open) dialog.close(); });
    switchView('front');
    const feedback = $('#form-feedback');
    feedback.hidden = false;
    feedback.textContent = '正在修改 ' + record.id + '（本次瀏覽的模擬資料），再次確認送出即可更新。';
    $('#register').scrollIntoView({behavior:'auto', block:'start'});
  }

  document.addEventListener('click', event => {
    const close = event.target.closest('[data-close-dialog]');
    if (close) { const dialog = document.getElementById(close.dataset.closeDialog); if (dialog?.open) dialog.close(); return; }
    const detail = event.target.closest('[data-detail-record]');
    if (detail) { const record = previewRecords.find(x => x.id === detail.dataset.detailRecord); if (record) renderRecordDetail(record); return; }
    const edit = event.target.closest('[data-edit-record]');
    if (edit) { const record = previewRecords.find(x => x.id === edit.dataset.editRecord); if (record) beginEdit(record); }
  });
  document.addEventListener('change', event => {
    if (!event.target.matches('[data-record-status]')) return;
    const record = previewRecords.find(x => x.id === event.target.dataset.recordStatus);
    if (record) { record.status = event.target.value; renderRecords(); }
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
  Object.assign(api, {showRecords, recordValidSubmission});
})();
