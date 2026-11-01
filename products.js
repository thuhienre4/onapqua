document.addEventListener('DOMContentLoaded', async () => {
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const getJson = (url) => fetch(url, { signal: AbortSignal.timeout(8000) }).then((response) => response.ok ? response.json() : []).catch(() => []);
  const [stores, offers] = await Promise.all([getJson('/api/stores'), getJson('/api/offers')]);
  document.querySelector('#product-grid').innerHTML = stores.map((store) => {
    const storeOffers = offers.filter((offer) => offer.storeId === store.id);
    const offer = storeOffers[0];
    const logo = store.logo || `https://www.google.com/s2/favicons?sz=256&domain=${encodeURIComponent(store.domain)}`;
    const dealHref = offer ? `deal.html?id=${encodeURIComponent(offer.id)}&brand=${encodeURIComponent(store.name)}&domain=${encodeURIComponent(store.domain)}` : '';
    return `<article class="product-card" data-category="${escapeHtml(String(store.category || '').toLowerCase())}" data-search="${escapeHtml([store.name, store.domain, store.category].join(' ').toLowerCase())}">
      <div class="product-top"><img src="${escapeHtml(logo)}" alt="${escapeHtml(store.name)} logo" /><div><h2>${escapeHtml(store.name)}</h2><p>${escapeHtml(store.description)}</p></div></div>
      <div class="product-rating"><strong hidden>0</strong><small>(${storeOffers.length} offer${storeOffers.length === 1 ? '' : 's'})</small></div><div class="product-tags"><span>${escapeHtml(store.category || 'Other')}</span></div>
      <div class="product-actions">${dealHref ? `<a class="explore" href="${dealHref}">Explore &#8599;</a>` : ''}<a class="visit" href="https://${escapeHtml(store.domain)}" target="_blank" rel="noopener">Visit website &#8599;</a></div>
    </article>`;
  }).join('');

  const input = document.querySelector('#product-search');
  const headerInput = document.querySelector('#header-product-search');
  const sort = document.querySelector('#product-sort');
  const grid = document.querySelector('#product-grid');
  const filters = [...document.querySelectorAll('.product-filters [data-category]')];
  const viewButtons = [...document.querySelectorAll('[data-product-view]')];
  const moreCategories = document.querySelector('#more-categories');
  const cards = [...document.querySelectorAll('.product-card')];
  const empty = document.querySelector('.products-empty');
  let category = 'all';
  let view = 'all';

  const initialSearch = new URLSearchParams(window.location.search).get('search');
  if (initialSearch) {
    if (headerInput) headerInput.value = initialSearch;
    if (input) input.value = initialSearch;
  }

  cards.forEach((card) => {
    const couponLink = card.querySelector('.product-actions .explore');
    if (!couponLink) return;
    card.tabIndex = 0;
    card.setAttribute('role', 'link');
    card.setAttribute('aria-label', `View coupons for ${card.querySelector('h2')?.textContent || 'this product'}`);
    card.addEventListener('click', (event) => {
      if (event.target.closest('a, button')) return;
      window.location.href = couponLink.href;
    });
    card.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      window.location.href = couponLink.href;
    });
  });

  const update = () => {
    const query = (headerInput?.value || input?.value || '').trim().toLowerCase();
    let visible = 0;
    cards.forEach((card) => {
      const categoryMatch = category === 'all' || card.dataset.category.split(' ').includes(category);
      const viewMatch = view !== 'popular' || Number(card.querySelector('.product-rating strong').textContent) >= 4.8;
      const searchMatch = !query || card.dataset.search.includes(query) || card.textContent.toLowerCase().includes(query);
      card.hidden = !(categoryMatch && viewMatch && searchMatch);
      if (!card.hidden) visible += 1;
    });
    empty.hidden = visible !== 0;
  };

  filters.forEach((button) => button.addEventListener('click', () => {
    category = button.dataset.category;
    view = 'all';
    filters.forEach((item) => item.classList.remove('active'));
    viewButtons.forEach((item) => item.classList.toggle('active', item.dataset.productView === 'all'));
    button.classList.add('active');
    update();
  }));
  viewButtons.forEach((button) => button.addEventListener('click', () => {
    view = button.dataset.productView;
    category = 'all';
    filters.forEach((item) => item.classList.remove('active'));
    viewButtons.forEach((item) => item.classList.toggle('active', item === button));
    update();
  }));
  moreCategories?.addEventListener('click', () => {
    const expanded = moreCategories.getAttribute('aria-expanded') === 'true';
    moreCategories.setAttribute('aria-expanded', String(!expanded));
    moreCategories.closest('.product-category-grid')?.classList.toggle('expanded', !expanded);
    const label = moreCategories.querySelector('.more-label');
    if (label) label.textContent = expanded ? 'More' : 'Fewer categories';
  });
  let updateFrame = 0;
  const scheduleUpdate = (event) => {
    const value = event.currentTarget.value;
    if (event.currentTarget === headerInput && input) input.value = value;
    if (event.currentTarget === input && headerInput) headerInput.value = value;
    cancelAnimationFrame(updateFrame);
    updateFrame = requestAnimationFrame(update);
  };
  headerInput?.addEventListener('input', scheduleUpdate);
  input?.addEventListener('input', scheduleUpdate);
  sort?.addEventListener('change', () => {
    const sorted = [...cards].sort((a, b) => {
      if (sort.value === 'name') return a.querySelector('h2').textContent.localeCompare(b.querySelector('h2').textContent);
      if (sort.value === 'reviews') {
        const reviews = (card) => Number((card.querySelector('.product-rating small').textContent.match(/[\d,]+/)?.[0] || '0').replaceAll(',', ''));
        return reviews(b) - reviews(a);
      }
      return Number(b.querySelector('.product-rating strong').textContent) - Number(a.querySelector('.product-rating strong').textContent);
    });
    sorted.forEach((card) => grid.append(card));
  });
  update();
});
