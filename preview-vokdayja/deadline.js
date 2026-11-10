/* 年度點燈：以臺灣時間 2027/02/10 23:59 作為報名截止。 */
(() => {
  'use strict';
  const DEADLINE = Date.parse('2027-02-10T23:59:00+08:00');
  const DAY = 86400000;
  const root = document.getElementById('annualDeadline');
  const digits = document.getElementById('annualFlipDigits');
  const form = document.getElementById('form');
  if (!root || !digits || !form) return;
  let last = null;
  let closed = false;
  function setDigits(value) {
    const str = String(value);
    if (str === last) return;
    const previous = last;
    last = str;
    digits.innerHTML = '';
    Array.from(str).forEach((character, i) => {
      const tile = document.createElement('span');
      tile.className = 'annual-flip__tile';
      tile.innerHTML = '<span class="annual-flip__top"></span><span class="annual-flip__bottom"></span>';
      tile.querySelectorAll('span').forEach(part => { part.textContent = character; });
      if (previous !== null && previous[i] !== character) tile.classList.add('flipping');
      digits.append(tile);
    });
    digits.setAttribute('aria-label', '還有 ' + str + ' 天截止');
  }
  function disableRegistration() {
    if (closed) return;
    closed = true;
    root.setAttribute('aria-disabled', 'true');
    document.getElementById('annualDeadlineClosed').hidden = false;
    form.classList.add('signup-closed');
    form.querySelectorAll('input,select,textarea,button').forEach(el => { el.disabled = true; });
    document.querySelectorAll('button[type="submit"][form="form"]').forEach(el => {
      el.disabled = true;
      el.textContent = '報名已截止';
    });
    form.querySelectorAll('button[type="submit"]').forEach(el => { el.textContent = '報名已截止'; });
    document.querySelectorAll('.banner-action a[href="#register"]').forEach(el => {
      el.textContent = '報名已截止';
      el.removeAttribute('href');
      el.setAttribute('aria-disabled','true');
    });
  }
  function refresh() {
    const remaining = DEADLINE - Date.now();
    if (remaining <= 0) { disableRegistration(); return; }
    setDigits(Math.ceil(remaining / DAY));
  }
  document.addEventListener('submit', event => {
    if (event.target !== form || Date.now() < DEADLINE) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    disableRegistration();
  }, true);
  refresh();
  window.setInterval(refresh, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
})();
