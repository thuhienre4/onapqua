document.addEventListener('DOMContentLoaded', async () => {
  const { escapeHtml, card, cover, stars, goUrl, formatDate, renderContent, fetchPosts } = window.Reviews;
  const root = document.querySelector('#review-root');
  const slug = decodeURIComponent(location.pathname.match(/^\/review\/([^/]+)/)?.[1] || new URLSearchParams(location.search).get('slug') || '');

  const notFound = () => {
    document.title = 'Review not found | onapqua.';
    root.innerHTML = '<div class="container rv-section"><div class="rv-empty"><h3>Review not found</h3><p>This review may have been moved or unpublished.</p><a class="rv-btn" href="/blog.html">Browse all reviews</a></div></div>';
  };
  if (!slug) return notFound();

  const post = await fetch(`/api/blog/${encodeURIComponent(slug)}`, { signal: AbortSignal.timeout(8000) })
    .then((response) => response.ok ? response.json() : null)
    .catch(() => null);
  if (!post) return notFound();

  document.title = `${post.title} | onapqua.`;
  document.querySelector('meta[name="description"]')?.setAttribute('content', post.excerpt || post.title);

  const cta = (extraClass = '') => post.hasLink
    ? `<a class="rv-btn ${extraClass}" href="${goUrl(post)}" target="_blank" rel="sponsored nofollow noopener">${escapeHtml(post.ctaLabel || `Visit ${post.brand || 'website'}`)} &#8599;</a>`
    : '';
  const list = (items, kind) => Array.isArray(items) && items.length
    ? `<div class="rv-pc rv-${kind}"><h4>${kind === 'pros' ? 'Pros' : 'Cons'}</h4><ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>`
    : '';
  const verdictList = `${list(post.pros, 'pros')}${list(post.cons, 'cons')}`;

  root.innerHTML = `
    <article class="rv-article">
      <header class="rv-article-head container">
        <nav class="rv-crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><a href="/blog.html">Reviews</a><span>/</span><a href="/blog.html?category=${encodeURIComponent(post.category || '')}">${escapeHtml(post.category || 'Review')}</a></nav>
        <h1>${escapeHtml(post.title)}</h1>
        <div class="rv-byline">${stars(post.rating)}${post.author ? `<span>By ${escapeHtml(post.author)}</span>` : ''}<span>${escapeHtml(formatDate(post.updatedAt || post.publishedAt))}</span></div>
        ${post.excerpt ? `<p class="rv-article-lead">${escapeHtml(post.excerpt)}</p>` : ''}
      </header>
      <div class="container rv-article-grid">
        <div class="rv-article-main">
          ${post.image ? cover(post, 'rv-cover-lg rv-article-cover') : ''}
          <p class="rv-disclosure">Disclosure: some links on this page are affiliate links. If you buy through them we may earn a commission, at no extra cost to you.</p>
          <div class="rv-prose">${renderContent(post.content)}</div>
          ${verdictList ? `<section class="rv-verdict-inline"><h2>Pros &amp; cons</h2><div class="rv-pc-grid">${verdictList}</div></section>` : ''}
          ${post.hasLink ? `<section class="rv-final-cta"><div><h2>Ready to try ${escapeHtml(post.brand || 'it')}?</h2>${post.price ? `<p>${escapeHtml(post.price)}</p>` : '<p>Check the latest price and availability.</p>'}</div>${cta()}</section>` : ''}
        </div>
        <aside class="rv-verdict">
          <div class="rv-verdict-card">
            <span class="rv-kicker">OUR VERDICT</span>
            <h3>${escapeHtml(post.brand || post.title)}</h3>
            ${post.rating ? `<div class="rv-score"><strong>${Number(post.rating).toFixed(1)}</strong><span>/ 5</span></div>${stars(post.rating)}` : ''}
            ${post.price ? `<p class="rv-price">${escapeHtml(post.price)}</p>` : ''}
            ${cta('rv-btn-block')}
            ${verdictList ? `<div class="rv-pc-stack">${verdictList}</div>` : ''}
          </div>
        </aside>
      </div>
    </article>
    <section class="rv-section rv-related" hidden><div class="container"><div class="rv-section-head"><div><span class="rv-kicker">KEEP READING</span><h2>More reviews</h2></div><a class="rv-link" href="/blog.html">View all &rarr;</a></div><div class="rv-grid" id="related-reviews"></div></div></section>`;

  const others = (await fetchPosts()).filter((item) => item.id !== post.id);
  const related = [...others.filter((item) => item.category === post.category), ...others.filter((item) => item.category !== post.category)].slice(0, 3);
  if (related.length) {
    document.querySelector('#related-reviews').innerHTML = related.map(card).join('');
    document.querySelector('.rv-related').hidden = false;
  }
});
