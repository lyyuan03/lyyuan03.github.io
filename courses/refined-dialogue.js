(() => {
  const choices = [...document.querySelectorAll('.theme-choice')];
  const panels = [...document.querySelectorAll('.theme-panel')];
  const panelContainer = document.querySelector('.theme-panels');
  if (!choices.length || !panels.length || !panelContainer) return;

  const showTheme = (name) => {
    const target = panels.find(panel => panel.id === `theme-${name}`);
    if (!target) return;
    panels.forEach(panel => { panel.hidden = panel !== target; });
    choices.forEach(choice => {
      if (choice.dataset.theme === name) choice.setAttribute('aria-current', 'true');
      else choice.removeAttribute('aria-current');
    });
  };
  panelContainer.classList.add('is-interactive');
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
