document.addEventListener('DOMContentLoaded', async () => {
  const { escapeHtml, card, fetchPosts } = window.Reviews;
  const params = new URLSearchParams(window.location.search);
  const form = document.querySelector('#archive-search');
  const input = form.querySelector('input');
  const grid = document.querySelector('#all-reviews');
  const count = document.querySelector('#result-count');
  const filters = document.querySelector('#category-filters');
  let category = params.get('category') || '';
  input.value = params.get('q') || '';

  const posts = await fetchPosts();
  const categories = [...new Set(posts.map((post) => post.category).filter(Boolean))];

  const syncUrl = () => {
    const next = new URLSearchParams();
    if (input.value.trim()) next.set('q', input.value.trim());
    if (category) next.set('category', category);
    history.replaceState(null, '', `${location.pathname}${next.toString() ? `?${next}` : ''}`);
  };

  const render = () => {
    filters.innerHTML = ['', ...categories].map((name) => `<button type="button" data-category="${escapeHtml(name)}" class="${name === category ? 'active' : ''}">${escapeHtml(name || 'All')}</button>`).join('');
    if (!posts.length) {
      count.textContent = '';
      grid.innerHTML = '<div class="rv-empty"><h3>No reviews yet</h3><p>Our first reviews are on the way. Check back soon!</p></div>';
      return;
    }
    const query = input.value.trim().toLowerCase();
    const matches = posts.filter((post) => (!category || post.category === category)
      && (!query || [post.title, post.brand, post.category, post.excerpt].join(' ').toLowerCase().includes(query)));
    count.textContent = `${matches.length} review${matches.length === 1 ? '' : 's'}`;
    grid.innerHTML = matches.length ? matches.map(card).join('') : '<div class="rv-empty"><p>No reviews match your search.</p></div>';
  };

  form.addEventListener('submit', (event) => { event.preventDefault(); syncUrl(); render(); });
  input.addEventListener('input', () => { syncUrl(); render(); });
  filters.addEventListener('click', (event) => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    category = button.dataset.category;
    syncUrl();
    render();
  });
  render();
});
