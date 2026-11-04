// The review itself is pre-rendered by the server; this adds related reviews
// and a sticky "check price" bar on small screens.
document.addEventListener('DOMContentLoaded', async () => {
  const { escapeHtml, card, goUrl, fetchPosts } = window.Reviews;
  const post = window.__REVIEW__;
  if (!post) return;

  if (post.hasLink) {
    const bar = document.createElement('div');
    bar.className = 'rv-sticky-cta';
    bar.innerHTML = `<div><strong>${escapeHtml(post.brand || post.title)}</strong>${post.rating ? `<span>&#9733; ${Number(post.rating).toFixed(1)} / 5</span>` : ''}</div><a class="rv-btn" href="${goUrl(post)}" target="_blank" rel="sponsored nofollow noopener">${escapeHtml(post.ctaLabel || 'Check price')} &#8599;</a>`;
    document.body.append(bar);
    const verdict = document.querySelector('.rv-final-cta') || document.querySelector('.rv-verdict');
    const lead = document.querySelector('.rv-article-head');
    const toggle = () => {
      const pastHead = lead ? lead.getBoundingClientRect().bottom < 0 : true;
      const atVerdict = verdict ? verdict.getBoundingClientRect().top < window.innerHeight : false;
      bar.classList.toggle('visible', pastHead && !atVerdict);
    };
    window.addEventListener('scroll', toggle, { passive: true });
    toggle();
  }

  // Coupons and deals for this brand, revealed the same way as on the Coupons page.
  const offers = await fetch('/api/offers', { signal: AbortSignal.timeout(8000) }).then((response) => response.ok ? response.json() : []).catch(() => []);
  const brandOffers = offers.filter((offer) => String(offer.brand).toLowerCase() === String(post.brand || '').toLowerCase());
  if (brandOffers.length) {
    const box = document.createElement('section');
    box.className = 'rv-deals';
    box.setAttribute('aria-labelledby', 'deals');
    box.innerHTML = `<h2 id="deals">${escapeHtml(post.brand)} deals &amp; coupons</h2>${brandOffers.map((offer) => `
      <div class="rv-deal"><strong>${escapeHtml(offer.discount || 'DEAL')}</strong><div><b>${escapeHtml(offer.title)}</b>${offer.description ? `<span>${escapeHtml(offer.description)}</span>` : ''}</div>
      ${offer.hasCode ? `<button class="rv-ticket" type="button" data-reveal="${escapeHtml(offer.id)}"><span class="rv-ticket-code" aria-hidden="true">${'•'.repeat(6)}${escapeHtml(offer.codeHint || '')}</span><span class="rv-ticket-cta">Reveal code</span></button>` : `<a class="rv-btn rv-btn-ghost" href="/go/${encodeURIComponent(offer.id)}" target="_blank" rel="sponsored nofollow noopener">Get deal &#8599;</a>`}</div>`).join('')}`;
    const anchor = document.querySelector('.rv-sources') || document.querySelector('.rv-final-cta');
    anchor ? anchor.before(box) : document.querySelector('.rv-article-main')?.append(box);
    box.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-reveal]');
      if (!button) return;
      const store = window.open('', '_blank');
      try {
        const response = await fetch(`/api/offers/${encodeURIComponent(button.dataset.reveal)}/code`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Code unavailable');
        button.outerHTML = `<button class="rv-ticket revealed" type="button" title="Copied"><span class="rv-ticket-code">${escapeHtml(data.code)}</span><span class="rv-ticket-cta">Copied!</span></button>`;
        navigator.clipboard?.writeText(data.code).catch(() => {});
        if (store) store.location = data.redirect;
      } catch (error) {
        store?.close();
        (button.querySelector('.rv-ticket-cta') || button).textContent = error.message;
      }
    });
  }

  const others = (await fetchPosts()).filter((item) => item.id !== post.id);
  const related = [...others.filter((item) => item.category === post.category), ...others.filter((item) => item.category !== post.category)].slice(0, 3);
  if (related.length) {
    document.querySelector('#related-reviews').innerHTML = related.map(card).join('');
    document.querySelector('.rv-related').hidden = false;
  }
});
