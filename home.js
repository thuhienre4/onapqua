document.addEventListener('DOMContentLoaded', async () => {
  const { escapeHtml, card, cover, stars, reviewUrl, goUrl, fetchPosts } = window.Reviews;
  const posts = await fetchPosts();
  const latest = document.querySelector('#latest-reviews');
  const featuredRoot = document.querySelector('#featured-review');

  const newsletter = document.querySelector('#newsletter-form');
  newsletter.addEventListener('submit', async (event) => {
    event.preventDefault();
    const note = document.querySelector('#newsletter-note');
    note.textContent = 'Subscribing...';
    try {
      const response = await fetch('/api/newsletter/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: newsletter.email.value }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Please try again.');
      note.textContent = "Thanks! You're on the list.";
      newsletter.reset();
    } catch (error) {
      note.textContent = error.message;
    }
  });

  if (!posts.length) {
    latest.innerHTML = '<div class="rv-empty"><h3>No reviews yet</h3><p>Our first reviews are on the way. Check back soon!</p></div>';
    document.querySelector('#featured-section').hidden = true;
    return;
  }

  const guides = posts.filter((post) => post.category === 'Best Of');
  const reviews = posts.filter((post) => post.category !== 'Best Of');
  document.querySelector('#stat-reviews').textContent = `${reviews.length}+`;

  if (guides.length) {
    document.querySelector('#guides').innerHTML = guides.slice(0, 4).map((post) => `
      <a class="rv-guide" href="${reviewUrl(post)}">
        <span class="rv-guide-kicker">${escapeHtml(post.brand || 'Buyer’s guide')}</span>
        <strong>${escapeHtml(post.title)}</strong>
        <span>${escapeHtml(post.excerpt)}</span>
        <em>Read the guide &rarr;</em>
      </a>`).join('');
    document.querySelector('#guides-section').hidden = false;
  }

  const featured = reviews.find((post) => post.featured) || reviews[0];
  if (featured) {
    featuredRoot.innerHTML = `
      <article class="rv-featured">
        <a href="${reviewUrl(featured)}" class="rv-featured-media" tabindex="-1" aria-hidden="true">${cover(featured, 'rv-cover-lg', true)}<span class="rv-badge">Editor's pick</span></a>
        <div class="rv-featured-body">
          <div class="rv-meta"><span class="rv-chip">${escapeHtml(featured.category || 'Review')}</span>${stars(featured.rating)}</div>
          <h2><a href="${reviewUrl(featured)}">${escapeHtml(featured.title)}</a></h2>
          <p>${escapeHtml(featured.excerpt)}</p>
          ${featured.price ? `<p class="rv-price">${escapeHtml(featured.price)}</p>` : ''}
          <div class="rv-actions"><a class="rv-btn" href="${reviewUrl(featured)}">Read full review</a>${featured.hasLink ? `<a class="rv-btn rv-btn-ghost" href="${goUrl(featured)}" target="_blank" rel="sponsored nofollow noopener">${escapeHtml(featured.ctaLabel || 'Check price')} &#8599;</a>` : ''}</div>
        </div>
      </article>`;
  } else {
    document.querySelector('#featured-section').hidden = true;
  }

  const rest = reviews.filter((post) => post.id !== featured?.id);
  latest.innerHTML = rest.length ? rest.slice(0, 6).map(card).join('') : '<div class="rv-empty"><p>More reviews coming soon.</p></div>';

  const counts = reviews.reduce((map, post) => map.set(post.category, (map.get(post.category) || 0) + 1), new Map());
  if (counts.size) {
    document.querySelector('#categories').innerHTML = [...counts].sort((a, b) => b[1] - a[1]).map(([category, count]) => `
      <a class="rv-cat" href="/blog.html?category=${encodeURIComponent(category)}"><strong>${escapeHtml(category)}</strong><span>${count} review${count === 1 ? '' : 's'}</span></a>`).join('');
    document.querySelector('#categories-section').hidden = false;
  }
});
