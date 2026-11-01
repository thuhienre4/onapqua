// Product directory: every reviewed product plus any stores added in admin.
document.addEventListener('DOMContentLoaded', async () => {
  const { escapeHtml, stars, reviewUrl, goUrl, fetchPosts } = window.Reviews;
  const getJson = (url) => fetch(url, { signal: AbortSignal.timeout(8000) }).then((response) => response.ok ? response.json() : []).catch(() => []);
  const [posts, stores] = await Promise.all([fetchPosts(), getJson('/api/stores')]);
  const grid = document.querySelector('#product-grid');
  const count = document.querySelector('#product-count');
  const input = document.querySelector('#product-q');
  input.value = new URLSearchParams(location.search).get('search') || '';

  const products = posts.filter((post) => post.category !== 'Best Of').map((post) => ({
    name: post.brand || post.title, category: post.category, rating: post.rating, summary: post.excerpt,
    review: reviewUrl(post), visit: post.hasLink ? goUrl(post) : '', cta: post.ctaLabel || 'Visit website',
  }));
  const known = new Set(products.map((item) => item.name.toLowerCase()));
  stores.filter((store) => !known.has(String(store.name).toLowerCase())).forEach((store) => products.push({
    name: store.name, category: store.category, rating: 0, summary: store.description,
    review: '', visit: `https://${store.domain}`, cta: 'Visit website',
  }));

  const render = () => {
    const query = input.value.trim().toLowerCase();
    const matches = products.filter((item) => !query || [item.name, item.category, item.summary].join(' ').toLowerCase().includes(query))
      .sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
    count.textContent = products.length ? `${matches.length} product${matches.length === 1 ? '' : 's'}` : '';
    if (!products.length) { grid.innerHTML = '<div class="rv-empty"><h3>No products yet</h3><p>Products will appear here as we publish reviews.</p></div>'; return; }
    grid.innerHTML = matches.length ? matches.map((item) => `
      <article class="rv-dir-item">
        <div class="rv-dir-mark" aria-hidden="true">${escapeHtml(item.name.charAt(0).toUpperCase())}</div>
        <div class="rv-dir-main">
          <div class="rv-meta"><h2>${escapeHtml(item.name)}</h2><span class="rv-chip">${escapeHtml(item.category || 'Other')}</span>${stars(item.rating)}</div>
          <p>${escapeHtml(item.summary)}</p>
        </div>
        <div class="rv-dir-actions">
          ${item.review ? `<a class="rv-btn rv-btn-ghost" href="${item.review}">Read review</a>` : ''}
          ${item.visit ? `<a class="rv-btn" href="${escapeHtml(item.visit)}" target="_blank" rel="sponsored nofollow noopener">${escapeHtml(item.cta)} &#8599;</a>` : ''}
        </div>
      </article>`).join('') : '<div class="rv-empty"><h3>No matches</h3><p>Try another search.</p></div>';
  };
  document.querySelector('#product-search').addEventListener('submit', (event) => { event.preventDefault(); render(); });
  input.addEventListener('input', render);
  render();
});
