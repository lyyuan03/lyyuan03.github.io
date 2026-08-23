(() => {
  if (!location.pathname.endsWith('/articles.html')) return;
  if (document.getElementById('article-mobile-nav-fix')) return;

  const style = document.createElement('style');
  style.id = 'article-mobile-nav-fix';
  style.textContent = `
    @media (max-width: 768px) {
      nav .nav-inner {
        height: 56px;
        padding: 0 12px;
        justify-content: flex-start;
        overflow: visible;
      }

      nav .nav-links {
        width: 100%;
        min-width: 0;
        gap: 6px;
        flex-wrap: nowrap;
        justify-content: space-between;
      }

      nav .nav-links > li {
        flex: 0 0 auto;
      }

      nav .nav-links > li > a,
      nav .nav-links > li > span {
        font-size: 12px;
      }

      nav .dropdown {
        position: absolute;
        top: calc(100% + 14px);
        left: 50%;
        transform: translateX(-50%);
        margin-top: 0;
        max-width: calc(100vw - 24px);
        background: rgba(14,20,12,.98);
      }

      nav .nav-links > li:hover .dropdown {
        display: none;
      }

      nav .nav-links > li.open .dropdown {
        display: block;
      }

      nav .nav-links > li:nth-last-child(-n+2) .dropdown {
        left: auto;
        right: 0;
        transform: none;
      }
    }
  `;

  document.head.appendChild(style);
})();
