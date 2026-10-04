(() => {
  const choices = [...document.querySelectorAll('.theme-choice')];
  const panels = [...document.querySelectorAll('.theme-panel')];
  const panelContainer = document.querySelector('.theme-panels');
  if (!choices.length || !panels.length || !panelContainer) return;

  const showTheme = (name) => {
    const target = panels.find(panel => panel.id === `theme-${name}`);
    if (!target) return;
    panelContainer.dataset.theme = name;
    panels.forEach(panel => { panel.hidden = panel !== target; });
    choices.forEach(choice => {
      if (choice.dataset.theme === name) choice.setAttribute('aria-current', 'true');
      else choice.removeAttribute('aria-current');
    });
  };
  panelContainer.classList.add('is-interactive');

  const canTilt = window.matchMedia('(hover: hover) and (min-width: 721px) and (prefers-reduced-motion: no-preference)').matches;
  if (canTilt) {
    let frame = 0;
    panelContainer.addEventListener('pointermove', event => {
      const box = panelContainer.getBoundingClientRect();
      const x = (event.clientX - box.left) / box.width;
      const y = (event.clientY - box.top) / box.height;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        panelContainer.style.setProperty('--ry', ((x - 0.5) * 7).toFixed(2) + 'deg');
        panelContainer.style.setProperty('--rx', ((0.5 - y) * 5).toFixed(2) + 'deg');
        panelContainer.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
        panelContainer.style.setProperty('--my', (y * 100).toFixed(1) + '%');
      });
    });
    panelContainer.addEventListener('pointerleave', () => {
      ['--rx', '--ry'].forEach(name => panelContainer.style.setProperty(name, '0deg'));
    });
  }
  const initialTheme = location.hash.startsWith('#theme-') ? location.hash.slice(7) : 'spiritual';
  showTheme(panels.some(panel => panel.id === `theme-${initialTheme}`) ? initialTheme : 'spiritual');
  choices.forEach(choice => {
    choice.addEventListener('click', event => {
      event.preventDefault();
      showTheme(choice.dataset.theme);
      if (window.matchMedia('(max-width: 720px)').matches) {
        panels.find(panel => !panel.hidden)?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      }
    });
  });
  window.addEventListener('hashchange', () => {
    if (location.hash.startsWith('#theme-')) showTheme(location.hash.slice(7));
  });

  const navLinks = [...document.querySelectorAll('.dialogue-page-nav a')];
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        navLinks.forEach(link => link.classList.toggle('is-current', link.hash === `#${entry.target.id}`));
      });
    }, { rootMargin: '-20% 0px -65% 0px', threshold: 0 });
    document.querySelectorAll('main > section[id]').forEach(section => observer.observe(section));
  }
})();

// 編輯風文案：緩慢淡入（無 JS 或減少動態時直接顯示）
(() => {
  const items = [...document.querySelectorAll('.ed-reveal')];
  if (!items.length || !('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.documentElement.classList.add('ed-js');
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { threshold: .15 });
  items.forEach(el => io.observe(el));
})();
