// Coupons & deals from admin. Codes stay hidden until revealed, then the
// tracked /go/:id link opens the store in a new tab.
document.addEventListener('DOMContentLoaded', async () => {
  const { escapeHtml } = window.Reviews;
  const root = document.querySelector('#offers');
  const offers = await fetch('/api/offers', { signal: AbortSignal.timeout(8000) }).then((response) => response.ok ? response.json() : []).catch(() => []);

  if (!offers.length) {
    root.innerHTML = '<div class="rv-empty"><h3>No coupons right now</h3><p>New offers are added regularly. Meanwhile, compare products in our reviews.</p><a class="rv-btn" href="/blog.html">Read reviews</a></div>';
    return;
  }

  root.innerHTML = offers.map((offer) => `
    <article class="rv-offer">
      <div class="rv-offer-value"><strong>${escapeHtml(offer.discount || 'DEAL')}</strong><span>${offer.hasCode ? 'Code' : 'Deal'}</span></div>
      <div class="rv-offer-body">
        <div class="rv-offer-brand">${offer.logo ? `<span class="rv-logo rv-logo-sm"><img src="${escapeHtml(offer.logo)}" alt="" width="28" height="28" loading="lazy"></span>` : ''}<span class="rv-chip">${escapeHtml(offer.brand)}</span></div>
        <h2>${escapeHtml(offer.title)}</h2>
        ${offer.description ? `<p>${escapeHtml(offer.description)}</p>` : ''}
        ${offer.expiry ? `<small>Expires ${escapeHtml(offer.expiry)}</small>` : ''}
      </div>
      <div class="rv-offer-action">
        ${offer.hasCode
          ? `<button class="rv-btn" type="button" data-reveal="${escapeHtml(offer.id)}">Reveal code</button>`
          : `<a class="rv-btn" href="/go/${encodeURIComponent(offer.id)}" target="_blank" rel="sponsored nofollow noopener">Get deal &#8599;</a>`}
      </div>
    </article>`).join('');

  root.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-reveal]');
    if (!button) return;
    const store = window.open('', '_blank');
    try {
      const response = await fetch(`/api/offers/${encodeURIComponent(button.dataset.reveal)}/code`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Code unavailable');
      button.outerHTML = `<button class="rv-code" type="button" data-copy="${escapeHtml(data.code)}" title="Click to copy">${escapeHtml(data.code)}</button>`;
      navigator.clipboard?.writeText(data.code).catch(() => {});
      if (store) store.location = data.redirect;
    } catch (error) {
      store?.close();
      button.textContent = error.message;
    }
  });
  root.addEventListener('click', (event) => {
    const code = event.target.closest('[data-copy]');
    if (!code) return;
    navigator.clipboard?.writeText(code.dataset.copy).then(() => { code.classList.add('copied'); }).catch(() => {});
  });
});
