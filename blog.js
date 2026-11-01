document.addEventListener('DOMContentLoaded', async () => {
  const { escapeHtml, card, fetchPosts } = window.Reviews;
  const params = new URLSearchParams(window.location.search);
  const form = document.querySelector('#archive-search');
  const input = form.querySelector('input');
  const sort = document.querySelector('#sort');
  const grid = document.querySelector('#all-reviews');
  const count = document.querySelector('#result-count');
  const filters = document.querySelector('#category-filters');
  let category = params.get('category') || '';
  input.value = params.get('q') || '';
  sort.value = params.get('sort') || 'new';

  const posts = await fetchPosts();
  const categories = [...new Set(posts.map((post) => post.category).filter(Boolean))].sort((a, b) => (a === 'Best Of' ? -1 : b === 'Best Of' ? 1 : a.localeCompare(b)));

  const syncUrl = () => {
    const next = new URLSearchParams();
    if (input.value.trim()) next.set('q', input.value.trim());
    if (category) next.set('category', category);
    if (sort.value !== 'new') next.set('sort', sort.value);
    history.replaceState(null, '', `${location.pathname}${next.toString() ? `?${next}` : ''}`);
  };

  const sorters = {
    new: (a, b) => new Date(b.publishedAt) - new Date(a.publishedAt),
    rating: (a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0),
    name: (a, b) => String(a.brand || a.title).localeCompare(String(b.brand || b.title)),
  };

  const render = () => {
    filters.innerHTML = ['', ...categories].map((name) => `<button type="button" data-category="${escapeHtml(name)}" aria-pressed="${name === category}" class="${name === category ? 'active' : ''}">${escapeHtml(name || 'All')}</button>`).join('');
    if (!posts.length) {
      count.textContent = '';
      grid.innerHTML = '<div class="rv-empty"><h3>No reviews yet</h3><p>Our first reviews are on the way. Check back soon!</p></div>';
      return;
    }
    const query = input.value.trim().toLowerCase();
    const matches = posts.filter((post) => (!category || post.category === category)
      && (!query || [post.title, post.brand, post.category, post.excerpt].join(' ').toLowerCase().includes(query)))
      .sort(sorters[sort.value] || sorters.new);
    count.textContent = `${matches.length} result${matches.length === 1 ? '' : 's'}${category ? ` in ${category}` : ''}`;
    grid.innerHTML = matches.length ? matches.map(card).join('') : '<div class="rv-empty"><h3>No matches</h3><p>Try another search or category.</p></div>';
  };

  form.addEventListener('submit', (event) => { event.preventDefault(); syncUrl(); render(); });
  input.addEventListener('input', () => { syncUrl(); render(); });
  sort.addEventListener('change', () => { syncUrl(); render(); });
  filters.addEventListener('click', (event) => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    category = button.dataset.category;
    syncUrl();
    render();
  });
  render();
});
