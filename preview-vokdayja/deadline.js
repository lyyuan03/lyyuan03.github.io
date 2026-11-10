/* 年度點燈：報名截止時間讀取「目前活動」設定的 meta.deadline（臺灣時間）；沒有設定截止時間就隱藏倒數。
   丁未年（lamp-116-dingwei）內建設定為 2027-02-10T23:59，行為與先前寫死 2027/02/10 23:59 相同。 */
(() => {
  'use strict';
  const toMs = dl => {
    if (typeof dl !== 'string' || !dl.trim()) return NaN;
    dl = dl.trim();
    return Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(dl) ? dl : (dl.length <= 10 ? dl + 'T23:59:59+08:00' : (dl.length === 16 ? dl + ':00+08:00' : dl + '+08:00')));
  };
  let DEADLINE = NaN;
  let started = false;
  let refreshTimer = 0;
  const DAY = 86400000;
  const root = document.getElementById('annualDeadline');
  const digits = document.getElementById('annualFlipDigits');
  const form = document.getElementById('form');
  if (!root || !digits || !form) return;
  const wrap = root.parentElement;
  let last = null;
  let closed = false;
  let introSequence = 0;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function setDigits(value, animate = true) {
    const str = String(value);
    if (str === last) return;
    const previous = last;
    last = str;
    digits.innerHTML = '';
    Array.from(str).forEach((character, i) => {
      const tile = document.createElement('span');
      tile.className = 'annual-flip__tile';
      tile.innerHTML = '<span class="annual-flip__top"></span><span class="annual-flip__bottom"></span><span class="annual-flip__number"></span>';
      tile.querySelector('.annual-flip__number').textContent = character;
      if (animate && !reducedMotion && previous !== null && previous[i] !== character) tile.classList.add('flipping');
      digits.append(tile);
    });
    digits.setAttribute('aria-label', '還有 ' + str + ' 天截止');
  }
  function startIntro() {
    const remaining = DEADLINE - Date.now();
    if (remaining <= 0) return;
    const actual = Math.ceil(remaining / DAY);
    if (reducedMotion) { setDigits(actual, false); return; }
    // The entry sequence uses several fast flap changes, then settles on actual days.
    const count = String(actual).length;
    const steps = 11;
    let step = 0;
    setDigits('8'.repeat(count), false);
    const sequence = window.setInterval(() => {
      if (Date.now() >= DEADLINE) { window.clearInterval(sequence); disableRegistration(); return; }
      step += 1;
      if (step >= steps) { window.clearInterval(sequence); introSequence = 0; setDigits(Math.ceil((DEADLINE - Date.now()) / DAY)); return; }
      setDigits(String((step * 37 + 19) % (10 ** count)).padStart(count, '0'));
    }, 160);
    introSequence = sequence;
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
    if (!introSequence) setDigits(Math.ceil(remaining / DAY));
  }
  document.addEventListener('submit', event => {
    if (event.target !== form || !(Date.now() >= DEADLINE)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    disableRegistration();
  }, true);
  // 其他活動的日期說明改由截止時間產生（內建丁未年維持原本頁面文字）。
  function customDates() {
    const box = root.querySelector('.annual-deadline__dates');
    if (!box) return;
    const parts = {};
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Taipei', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(DEADLINE)).forEach(p => { parts[p.type] = p.value; });
    const line = document.createElement('p');
    const mark = document.createElement('span');
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = '✧';
    const text = document.createElement('span');
    const b = document.createElement('b');
    b.textContent = '民國 ' + (Number(parts.year) - 1911) + ' 年 ' + Number(parts.month) + ' 月 ' + Number(parts.day) + ' 日';
    text.append(b, document.createElement('br'), parts.hour + ':' + parts.minute + ' 截止報名');
    line.append(mark, text);
    box.replaceChildren(line);
  }
  function begin(dl) {
    const ms = toMs(dl);
    if (started && (ms === DEADLINE || (isNaN(ms) && isNaN(DEADLINE)))) return;
    if (introSequence) { window.clearInterval(introSequence); introSequence = 0; }
    if (refreshTimer) { window.clearInterval(refreshTimer); refreshTimer = 0; }
    started = true;
    DEADLINE = ms;
    if (isNaN(ms)) { wrap.hidden = true; return; }
    wrap.hidden = false;
    if (builtin !== window.LYYUAN_SIGNUP_EVENT) customDates();
    last = null;
    refresh();
    startIntro();
    refreshTimer = window.setInterval(refresh, 30000);
  }
  const builtinCfg = window.LYYUAN_SIGNUP_DEFAULT_CONFIG || {};
  const builtin = builtinCfg.event;
  // 內建活動：立即用內建設定開始（與先前相同、不延遲）；若內建截止已過，先等雲端設定確認，避免後台延長截止後仍被關閉。
  // 其他活動：先隱藏，等 app.js 載入該活動設定後（lyyuan-config 事件）才開始。
  if (builtin === window.LYYUAN_SIGNUP_EVENT && builtinCfg.meta && toMs(builtinCfg.meta.deadline) > Date.now()) begin(builtinCfg.meta.deadline);
  else wrap.hidden = true;
  document.addEventListener('lyyuan-config', event => begin(event.detail && event.detail.deadline));
  document.addEventListener('visibilitychange', () => { if (!document.hidden && started) refresh(); });
})();
