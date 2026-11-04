// Side-by-side comparison of up to three reviewed products. Selections live in the URL
// (?p=slug,slug) so a comparison can be shared.
document.addEventListener('DOMContentLoaded', async () => {
  const { escapeHtml, stars, logoMark, reviewUrl, goUrl, fetchPosts } = window.Reviews;
  const { topRated, bestForOf, hubsOf, HUBS } = window.Catalog;
  const products = topRated(await fetchPosts());
  const selects = [...document.querySelectorAll('#compare-pickers select')];
  const result = document.querySelector('#compare-result');
  if (products.length < 2) { result.innerHTML = '<div class="rv-empty"><p>Not enough products to compare yet.</p></div>'; return; }

  const bySlug = new Map(products.map((post) => [post.slug, post]));
  const options = `<option value="">Choose a product</option>${HUBS.map((hub) => {
    const items = products.filter((post) => hubsOf(post)[0] === hub.key);
    return items.length ? `<optgroup label="${escapeHtml(hub.label)}">${items.map((post) => `<option value="${escapeHtml(post.slug)}">${escapeHtml(post.brand)}</option>`).join('')}</optgroup>` : '';
  }).join('')}<optgroup label="Other">${products.filter((post) => !hubsOf(post).length).map((post) => `<option value="${escapeHtml(post.slug)}">${escapeHtml(post.brand)}</option>`).join('')}</optgroup>`;
  selects.forEach((select) => { select.innerHTML = options; });

  // Popular head-to-heads: the top two products of each category.
  document.querySelector('#compare-quick').innerHTML = `<span>Popular:</span>${HUBS.map((hub) => products.filter((post) => hubsOf(post).includes(hub.key)).slice(0, 2)).filter((pair) => pair.length === 2)
    .map(([a, b]) => `<button type="button" data-pair="${escapeHtml(a.slug)},${escapeHtml(b.slug)}">${escapeHtml(a.brand)} vs ${escapeHtml(b.brand)}</button>`).join('')}`;

  const row = (label, cells) => `<tr><th scope="row">${label}</th>${cells.map((cell) => `<td>${cell}</td>`).join('')}</tr>`;
  const list = (items, kind) => items?.length ? `<ul class="rv-pc-list rv-${kind}">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '&mdash;';

  const render = () => {
    const chosen = selects.map((select) => bySlug.get(select.value)).filter(Boolean);
    const unique = [...new Map(chosen.map((post) => [post.slug, post])).values()];
    history.replaceState(null, '', unique.length ? `?p=${unique.map((post) => post.slug).join(',')}` : location.pathname);
    if (unique.length < 2) { result.innerHTML = '<p class="rv-compare-hint">Choose at least two products to see the comparison.</p>'; return; }
    const top = Math.max(...unique.map((post) => Number(post.rating) || 0));
    result.innerHTML = `<div class="rv-table-wrap rv-compare-grid"><table>
      <thead><tr><th><span class="rv-sr">Feature</span></th>${unique.map((post) => `<th scope="col"><div class="rv-prod">${logoMark(post, 'rv-logo rv-logo-sm')}<span><a href="${reviewUrl(post)}">${escapeHtml(post.brand)}</a><small>${escapeHtml(post.category || '')}</small></span></div>${Number(post.rating) === top ? '<span class="rv-winner">Highest rated</span>' : ''}</th>`).join('')}</tr></thead>
      <tbody>
        ${row('Our rating', unique.map((post) => stars(post.rating)))}
        ${row('Pricing', unique.map((post) => escapeHtml(post.price || 'See website')))}
        ${row('Best for', unique.map((post) => escapeHtml(bestForOf(post))))}
        ${row('Pros', unique.map((post) => list(post.pros, 'pros')))}
        ${row('Cons', unique.map((post) => list(post.cons, 'cons')))}
        ${row('', unique.map((post) => `${post.hasLink ? `<a class="rv-btn rv-btn-sm" href="${goUrl(post)}" target="_blank" rel="sponsored nofollow noopener">Visit website &#8599;</a>` : ''}<a class="rv-read" href="${reviewUrl(post)}">Read review</a>`))}
      </tbody></table></div>`;
  };

  const initial = (new URLSearchParams(location.search).get('p') || '').split(',').filter((slug) => bySlug.has(slug));
  const start = initial.length >= 2 ? initial : [products[0].slug, products[1].slug];
  selects.forEach((select, index) => { select.value = start[index] || ''; });
  selects.forEach((select) => select.addEventListener('change', render));
  document.querySelector('#compare-quick').addEventListener('click', (event) => {
    const button = event.target.closest('[data-pair]');
    if (!button) return;
    const pair = button.dataset.pair.split(',');
    selects.forEach((select, index) => { select.value = pair[index] || ''; });
    render();
  });
  render();
});
