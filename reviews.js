// Shared rendering helpers for the public review pages. Runs in the browser
// (window.Reviews) and on the server (require), so pages are pre-rendered for SEO.
(function (factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.Reviews = api;
})(() => {
  const escapeHtml = (input) => String(input ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  const reviewUrl = (post) => `/review/${encodeURIComponent(post.slug)}`;
  // Affiliate links go through the central /go/<link>/ redirect; ?c= records the CTA position.
  const goUrl = (post, cta = 'unknown') => post.aff?.id ? `/go/${encodeURIComponent(post.aff.id)}/?c=${cta}` : `/go/review/${encodeURIComponent(post.id)}?c=${cta}`;
  // Data attributes read by site.js for the GA4 affiliate_click event (no secrets, no destinations).
  const affAttrs = (post, cta) => `data-aff="${escapeHtml(post.aff?.id || post.id)}" data-aff-network="${escapeHtml(post.aff?.network || '')}" data-aff-merchant="${escapeHtml(post.aff?.merchant || post.brand || '')}" data-aff-domain="${escapeHtml(post.aff?.domain || '')}" data-product="${escapeHtml(post.brand || '')}" data-category="${escapeHtml(post.category || '')}" data-cta="${cta}"`;

  const formatDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
  };

  const readingTime = (content) => Math.max(1, Math.round(String(content || '').split(/\s+/).filter(Boolean).length / 220));

  const headingId = (text) => String(text).toLowerCase().replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const stars = (rating) => {
    const value = Number(rating) || 0;
    if (!value) return '';
    const icons = Array.from({ length: 5 }, (_, index) => {
      const fill = Math.max(0, Math.min(1, value - index));
      return `<span class="rv-star" style="--fill:${fill * 100}%" aria-hidden="true">&#9733;</span>`;
    }).join('');
    return `<span class="rv-stars" role="img" aria-label="Rated ${value} out of 5">${icons}<b>${value.toFixed(1)}</b></span>`;
  };

  // Themed cover tile (galaxy, gold and silver) rather than vendor artwork, so every
  // card matches the site palette. Vendor images are still used for social sharing.
  const logoMark = (post, className = 'rv-logo') => post.logo
    ? `<span class="${className}"><img src="${escapeHtml(post.logo)}" alt="${escapeHtml(post.brand || '')} logo" width="64" height="64" loading="lazy" decoding="async"></span>`
    : '';

  const cover = (post, className = '') => {
    const name = String(post.brand || post.title || '?').trim();
    return `<div class="rv-cover ${className}" aria-hidden="true">${logoMark(post, 'rv-cover-logo')}<span class="rv-cover-name">${escapeHtml(name)}</span><span class="rv-cover-cat">${escapeHtml(post.category || 'Review')}</span></div>`;
  };

  const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };

  // Structured "Sources & references" block plus the official website link.
  const sourcesBlock = (post) => {
    const sources = Array.isArray(post.sources) ? post.sources.filter((source) => source && source.url) : [];
    if (!sources.length && !post.sourceUrl) return '';
    const official = post.sourceUrl ? `<p class="rv-official">Official website: <a href="${escapeHtml(post.sourceUrl)}" target="_blank" rel="nofollow noopener">${escapeHtml(hostOf(post.sourceUrl))}</a></p>` : '';
    const list = sources.length ? `<ol>${sources.map((source) => `<li><a href="${escapeHtml(source.url)}" target="_blank" rel="nofollow noopener">${escapeHtml(source.label || hostOf(source.url))}</a> <span>${escapeHtml(hostOf(source.url))}</span></li>`).join('')}</ol>` : '';
    return `<section class="rv-sources" aria-labelledby="sources"><h2 id="sources">Sources &amp; references</h2><p class="rv-sources-note">This review is based on the official product information and the independent sources below. Last checked ${escapeHtml(formatDate(post.updatedAt || post.publishedAt))}.</p>${official}${list}</section>`;
  };

  const ctaLink = (post, className, label, cta = 'unknown') => `<a class="${className}" href="${goUrl(post, cta)}" ${affAttrs(post, cta)} target="_blank" rel="sponsored nofollow noopener">${escapeHtml(label || post.ctaLabel || 'Check price')} <span aria-hidden="true">&#8599;</span></a>`;

  const card = (post) => `
    <article class="rv-card">
      <a class="rv-card-link" href="${reviewUrl(post)}" tabindex="-1" aria-hidden="true">${cover(post)}</a>
      <div class="rv-card-body">
        <div class="rv-meta"><span class="rv-chip">${escapeHtml(post.category || 'Review')}</span>${stars(post.rating)}</div>
        <h3><a href="${reviewUrl(post)}">${escapeHtml(post.title)}</a></h3>
        <p>${escapeHtml(post.excerpt)}</p>
        <div class="rv-card-foot"><a class="rv-read" href="${reviewUrl(post)}">Read review <span aria-hidden="true">&rarr;</span></a>${post.hasLink ? ctaLink(post, 'rv-mini-cta', '', 'card') : ''}</div>
      </div>
    </article>`;

  const inline = (escaped) => escaped
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(((?:https?:\/\/|\/)[^\s)]+)\)/g, (_, label, url) => {
      if (url.startsWith('/go/')) return `<a href="${url}" target="_blank" rel="sponsored nofollow noopener">${label}</a>`;
      if (url.startsWith('/')) return `<a href="${url}">${label}</a>`;
      return `<a href="${url}" target="_blank" rel="nofollow noopener">${label}</a>`;
    });

  const cells = (line) => line.replace(/^\||\|$/g, '').split('|').map((cell) => inline(escapeHtml(cell.trim())));

  // Minimal, escape-first formatting: ## headings, - lists, | tables |, **bold**, [text](url).
  const renderContent = (content) => String(content || '').replace(/\r/g, '').trim().split(/\n\s*\n/).map((block) => {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
    if (!lines.length) return '';
    if (lines.length === 1 && /^###\s+/.test(lines[0])) return `<h3>${inline(escapeHtml(lines[0].replace(/^###\s+/, '')))}</h3>`;
    if (lines.length === 1 && /^##\s+/.test(lines[0])) {
      const text = inline(escapeHtml(lines[0].replace(/^##\s+/, '')));
      return `<h2 id="${headingId(text)}">${text}</h2>`;
    }
    if (lines.length >= 2 && lines.every((line) => line.startsWith('|'))) {
      const rows = lines.filter((line) => !/^\|[\s:|-]+\|$/.test(line));
      const [head, ...body] = rows;
      return `<div class="rv-table-wrap"><table><thead><tr>${cells(head).map((cell) => `<th>${cell}</th>`).join('')}</tr></thead><tbody>${body.map((row) => `<tr>${cells(row).map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    }
    if (lines.every((line) => /^[-*]\s+/.test(line))) return `<ul>${lines.map((line) => `<li>${inline(escapeHtml(line.replace(/^[-*]\s+/, '')))}</li>`).join('')}</ul>`;
    return `<p>${lines.map((line) => inline(escapeHtml(line))).join('<br>')}</p>`;
  }).join('');

  const tableOfContents = (content, extra = []) => {
    const headings = String(content || '').split('\n').map((line) => line.trim()).filter((line) => /^##\s+/.test(line))
      .map((line) => inline(escapeHtml(line.replace(/^##\s+/, ''))));
    const items = [...headings.map((text) => [headingId(text), text.replace(/<[^>]+>/g, '')]), ...extra];
    if (items.length < 3) return '';
    return `<nav class="rv-toc" aria-label="On this page"><h2>On this page</h2><ul>${items.map(([id, text]) => `<li><a href="#${id}">${text}</a></li>`).join('')}</ul></nav>`;
  };

  const prosCons = (items, kind) => Array.isArray(items) && items.length
    ? `<div class="rv-pc rv-${kind}"><h3>${kind === 'pros' ? 'Pros' : 'Cons'}</h3><ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>`
    : '';

  // Optional per-criterion scores ("Features | 4.5"), shown as bars in the verdict box.
  const criteriaBars = (criteria) => Array.isArray(criteria) && criteria.length
    ? `<div class="rv-criteria"><h3>Score breakdown</h3>${criteria.map((item) => `<div class="rv-criterion"><span>${escapeHtml(item.label)}</span><span class="rv-bar" aria-hidden="true"><i style="width:${Math.max(0, Math.min(100, Number(item.score) * 20))}%"></i></span><b>${Number(item.score).toFixed(1)}</b></div>`).join('')}<a class="rv-read" href="/methodology.html">How we score &rarr;</a></div>`
    : '';

  // Full single-review markup, shared by server pre-rendering and the client.
  const article = (post) => {
    const verdictList = `${prosCons(post.pros, 'pros')}${prosCons(post.cons, 'cons')}`;
    const cta = (extra = '', position = 'review_top') => post.hasLink ? ctaLink(post, `rv-btn ${extra}`, post.ctaLabel || `Visit ${post.brand || 'website'}`, position) : '';
    const updated = post.updatedAt || post.publishedAt;
    return `
    <article class="rv-article">
      <header class="rv-article-head container">
        <nav class="rv-crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><a href="/blog.html">Reviews</a><span aria-hidden="true">/</span><a href="/blog.html?category=${encodeURIComponent(post.category || '')}">${escapeHtml(post.category || 'Review')}</a></nav>
        ${post.sponsored ? '<span class="rv-sponsored">Sponsored review</span>' : ''}
        <div class="rv-title-row">${logoMark(post, 'rv-logo rv-title-logo')}<h1>${escapeHtml(post.title)}</h1></div>
        <div class="rv-byline">${stars(post.rating)}${post.author ? `<span>By ${escapeHtml(post.author)}</span>` : ''}<span>Updated <time datetime="${escapeHtml(updated)}">${escapeHtml(formatDate(updated))}</time></span><span>${readingTime(post.content)} min read</span></div>
        ${post.excerpt ? `<p class="rv-article-lead">${escapeHtml(post.excerpt)}</p>` : ''}
        ${post.bestFor ? `<p class="rv-bestfor rv-bestfor-lg"><b>Best for:</b> ${escapeHtml(post.bestFor)}</p>` : ''}
      </header>
      <div class="container rv-article-grid${post.rating || post.hasLink || (post.pros || []).length || (post.cons || []).length ? '' : ' rv-article-solo'}">
        <div class="rv-article-main">
          <p class="rv-disclosure">Some links on this page are affiliate links. If you buy through them we may earn a commission, at no extra cost to you. <a href="/affiliate-disclosure.html">Learn more</a>.</p>
          ${tableOfContents(post.content, (post.sources || []).length || post.sourceUrl ? [['sources', 'Sources &amp; references']] : [])}
          <div class="rv-prose">${renderContent(post.content)}</div>
          ${sourcesBlock(post)}
          ${verdictList ? `<section class="rv-verdict-inline" aria-label="Pros and cons"><h2>Pros &amp; cons</h2><div class="rv-pc-grid">${verdictList}</div></section>` : ''}
          <!--@alternatives-->
          ${post.hasLink ? `<section class="rv-final-cta"><div><h2>Ready to try ${escapeHtml(post.brand || 'it')}?</h2>${post.price ? `<p>${escapeHtml(post.price)}</p>` : '<p>Check the latest price and availability.</p>'}</div>${cta('', 'final_verdict')}</section>` : ''}
        </div>
        ${post.rating || post.hasLink || verdictList ? `<aside class="rv-verdict" aria-label="Our verdict">
          <div class="rv-verdict-card">
            <span class="rv-kicker">OUR VERDICT</span>
            <div class="rv-verdict-brand">${logoMark(post)}<h2>${escapeHtml(post.brand || post.title)}</h2></div>
            ${post.rating ? `<div class="rv-score"><strong>${Number(post.rating).toFixed(1)}</strong><span>/ 5</span></div>${stars(post.rating)}` : ''}
            ${post.price ? `<p class="rv-price">${escapeHtml(post.price)}</p>` : ''}
            ${post.bestFor ? `<p class="rv-bestfor"><b>Best for:</b> ${escapeHtml(post.bestFor)}</p>` : ''}
            ${cta('rv-btn-block', 'review_top')}
            ${criteriaBars(post.criteria)}
            ${verdictList ? `<div class="rv-pc-stack">${verdictList}</div>` : ''}
          </div>
        </aside>` : ''}
      </div>
    </article>
    <section class="rv-section rv-related" hidden><div class="container"><div class="rv-section-head"><div><span class="rv-kicker">KEEP READING</span><h2>More reviews</h2></div><a class="rv-link" href="/blog.html">View all &rarr;</a></div><div class="rv-grid" id="related-reviews"></div></div></section>`;
  };

  const fetchPosts = () => fetch('/api/blog', { signal: AbortSignal.timeout(8000) })
    .then((response) => response.ok ? response.json() : [])
    .then((posts) => Array.isArray(posts) ? posts : [])
    .catch(() => []);

  return { escapeHtml, reviewUrl, goUrl, affAttrs, formatDate, readingTime, stars, logoMark, cover, card, renderContent, tableOfContents, article, fetchPosts };
});
