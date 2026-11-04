// Coupons & deals: filters (search, type, brand, category), a "Top coupon codes" strip and
// ticket-style codes. Codes stay hidden until revealed; revealing copies the code and opens
// the store through the tracked /go/:id link.
document.addEventListener('DOMContentLoaded', async () => {
  const { escapeHtml } = window.Reviews;
  const $ = (selector) => document.querySelector(selector);
  const root = $('#offers');
  const params = new URLSearchParams(location.search);
  const state = { q: params.get('q') || '', type: params.get('type') || '', brand: params.get('brand') || '', category: params.get('category') || '' };
  const revealed = new Map();
  const offers = await fetch('/api/offers', { signal: AbortSignal.timeout(8000) }).then((response) => response.ok ? response.json() : []).catch(() => []);

  if (!offers.length) {
    root.innerHTML = '<div class="rv-empty"><h3>No coupons right now</h3><p>New offers are added regularly. Meanwhile, compare products in our reviews.</p><a class="rv-btn" href="/blog.html">Read reviews</a></div>';
    return;
  }

  const brands = [...new Set(offers.map((offer) => offer.brand))].sort((a, b) => a.localeCompare(b));
  const categories = [...new Set(offers.map((offer) => offer.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const value = (offer) => Number(String(offer.discount).match(/\d+/)?.[0] || 0) * (String(offer.discount).includes('%') ? 1 : 0.5);
  $('#stat-codes').textContent = offers.filter((offer) => offer.hasCode).length;
  $('#stat-deals').textContent = offers.filter((offer) => !offer.hasCode).length;
  $('#stat-brands').textContent = brands.length;
  $('#brand-filter').insertAdjacentHTML('beforeend', brands.map((brand) => `<option value="${escapeHtml(brand)}">${escapeHtml(brand)}</option>`).join(''));

  const logo = (offer, size = 28) => offer.logo ? `<span class="rv-logo rv-logo-sm"><img src="${escapeHtml(offer.logo)}" alt="" width="${size}" height="${size}" loading="lazy"></span>` : '';

  // Ticket-style code: masked until revealed, then shows the full code with a copy action.
  const ticket = (offer) => revealed.has(offer.id)
    ? `<button class="rv-ticket revealed" type="button" data-copy="${escapeHtml(revealed.get(offer.id))}" title="Copy code"><span class="rv-ticket-code">${escapeHtml(revealed.get(offer.id))}</span><span class="rv-ticket-cta">Copy</span></button>`
    : `<button class="rv-ticket" type="button" data-reveal="${escapeHtml(offer.id)}"><span class="rv-ticket-code" aria-hidden="true">${'•'.repeat(6)}${escapeHtml(offer.codeHint || '')}</span><span class="rv-ticket-cta">Reveal code</span></button>`;

  const card = (offer) => `
    <article class="rv-offer${offer.hasCode ? ' rv-offer-code' : ''}">
      <div class="rv-offer-value"><strong>${escapeHtml(offer.discount || 'DEAL')}</strong><span>${offer.hasCode ? 'Code' : 'Deal'}</span></div>
      <div class="rv-offer-body">
        <div class="rv-offer-brand">${logo(offer)}<span class="rv-chip">${escapeHtml(offer.brand)}</span><span class="rv-verified">&#10003; Verified</span></div>
        <h2>${escapeHtml(offer.title)}</h2>
        ${offer.description ? `<p>${escapeHtml(offer.description)}</p>` : ''}
        ${offer.expiry ? `<small>Expires ${escapeHtml(offer.expiry)}</small>` : ''}
      </div>
      <div class="rv-offer-action">
        ${offer.hasCode ? ticket(offer) : `<a class="rv-btn rv-btn-ghost" href="/go/${encodeURIComponent(offer.id)}?c=coupon_page" data-coupon="${escapeHtml(offer.id)}" data-product="${escapeHtml(offer.brand)}" data-cta="coupon_page" target="_blank" rel="sponsored nofollow noopener">Get deal &#8599;</a>`}
      </div>
    </article>`;

  const renderTop = () => {
    const top = offers.filter((offer) => offer.hasCode).sort((a, b) => Number(b.featured) - Number(a.featured) || value(b) - value(a)).slice(0, 4);
    if (!top.length) return;
    $('#top-codes').innerHTML = top.map((offer) => `
      <article class="rv-top-code">
        <div class="rv-offer-brand">${logo(offer, 32)}<strong>${escapeHtml(offer.brand)}</strong></div>
        <div class="rv-top-discount">${escapeHtml(offer.discount)}</div>
        <p>${escapeHtml(offer.title)}</p>
        ${ticket(offer)}
      </article>`).join('');
    $('#top-codes-section').hidden = false;
  };

  const syncUrl = () => {
    const next = new URLSearchParams(Object.entries(state).filter(([, v]) => v));
    history.replaceState(null, '', `${location.pathname}${next.toString() ? `?${next}` : ''}`);
  };

  const render = () => {
    $('#category-filter').innerHTML = ['', ...categories].map((name) => `<button type="button" data-category="${escapeHtml(name)}" class="${name === state.category ? 'active' : ''}" aria-pressed="${name === state.category}">${escapeHtml(name || 'All categories')}</button>`).join('');
    document.querySelectorAll('#type-filter [data-type]').forEach((button) => {
      const active = button.dataset.type === state.type;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    $('#brand-filter').value = state.brand;
    $('#coupon-q').value = state.q;

    const query = state.q.trim().toLowerCase();
    const matches = offers
      .filter((offer) => !state.type || (state.type === 'code') === offer.hasCode)
      .filter((offer) => !state.brand || offer.brand === state.brand)
      .filter((offer) => !state.category || offer.category === state.category)
      .filter((offer) => !query || [offer.brand, offer.title, offer.description, offer.category].join(' ').toLowerCase().includes(query))
      .sort((a, b) => Number(b.hasCode) - Number(a.hasCode) || Number(b.featured) - Number(a.featured) || value(b) - value(a));

    const filtered = Object.values(state).some(Boolean);
    $('#clear-filters').hidden = !filtered;
    $('#offer-count').textContent = `${matches.length} offer${matches.length === 1 ? '' : 's'}${filtered ? ' match your filters' : ''}`;
    root.innerHTML = matches.length ? matches.map(card).join('') : '<div class="rv-empty"><h3>No matching offers</h3><p>Try another brand or clear the filters.</p></div>';
  };

  $('#coupon-q').addEventListener('input', (event) => { state.q = event.target.value; syncUrl(); render(); });
  $('#brand-filter').addEventListener('change', (event) => { state.brand = event.target.value; syncUrl(); render(); });
  $('#type-filter').addEventListener('click', (event) => {
    const button = event.target.closest('[data-type]');
    if (!button) return;
    state.type = button.dataset.type;
    syncUrl(); render();
  });
  $('#category-filter').addEventListener('click', (event) => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    state.category = button.dataset.category;
    syncUrl(); render();
  });
  $('#clear-filters').addEventListener('click', () => {
    Object.keys(state).forEach((key) => { state[key] = ''; });
    syncUrl(); render();
  });

  const copy = async (button, code) => {
    try { await navigator.clipboard.writeText(code); } catch { /* clipboard may be blocked; the code is still visible */ }
    const label = button.querySelector('.rv-ticket-cta');
    if (label) { label.textContent = 'Copied!'; setTimeout(() => { label.textContent = 'Copy'; }, 1600); }
  };

  document.addEventListener('click', async (event) => {
    const copyButton = event.target.closest('[data-copy]');
    if (copyButton) return copy(copyButton, copyButton.dataset.copy);
    const button = event.target.closest('[data-reveal]');
    if (!button) return;
    const store = window.open('', '_blank');
    try {
      const response = await fetch(`/api/offers/${encodeURIComponent(button.dataset.reveal)}/code`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Code unavailable');
      revealed.set(button.dataset.reveal, data.code);
      window.oqTrack?.('coupon_click', { coupon_id: button.dataset.reveal, merchant_name: offers.find((offer) => offer.id === button.dataset.reveal)?.brand || '', cta_position: 'coupon_page', link_type: 'coupon' });
      renderTop();
      render();
      const shown = document.querySelector(`[data-copy="${CSS.escape(data.code)}"]`);
      if (shown) copy(shown, data.code);
      if (store) store.location = data.redirect;
    } catch (error) {
      store?.close();
      button.querySelector('.rv-ticket-cta').textContent = error.message;
    }
  });

  renderTop();
  render();
});
