// Site-wide behaviour: mobile menu, header search and accessible tabs.
document.addEventListener('DOMContentLoaded', () => {
  const header = document.querySelector('.site-header');
  const navToggle = document.querySelector('[data-nav-toggle]');
  const searchToggle = document.querySelector('[data-search-toggle]');
  const search = document.querySelector('#site-search');

  navToggle?.addEventListener('click', () => {
    const open = header.classList.toggle('nav-open');
    navToggle.setAttribute('aria-expanded', String(open));
  });

  searchToggle?.addEventListener('click', () => {
    search.hidden = !search.hidden;
    searchToggle.setAttribute('aria-expanded', String(!search.hidden));
    if (!search.hidden) search.querySelector('input')?.focus();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (search && !search.hidden) { search.hidden = true; searchToggle?.setAttribute('aria-expanded', 'false'); searchToggle?.focus(); }
    if (header?.classList.contains('nav-open')) { header.classList.remove('nav-open'); navToggle?.setAttribute('aria-expanded', 'false'); }
  });

  // Tabs: click or arrow keys switch panels.
  document.querySelectorAll('[role="tablist"]').forEach((list) => {
    const tabs = [...list.querySelectorAll('[role="tab"]')];
    const select = (tab) => {
      tabs.forEach((item) => {
        const active = item === tab;
        item.setAttribute('aria-selected', String(active));
        item.tabIndex = active ? 0 : -1;
        document.getElementById(item.getAttribute('aria-controls')).hidden = !active;
      });
      tab.focus();
    };
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => select(tab));
      tab.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowRight') select(tabs[(index + 1) % tabs.length]);
        if (event.key === 'ArrowLeft') select(tabs[(index - 1 + tabs.length) % tabs.length]);
      });
    });
  });
});
