// Shared rendering helpers for the public review pages (home, archive, single review).
window.Reviews = (() => {
  const escapeHtml = (input) => String(input ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  const reviewUrl = (post) => `/review/${encodeURIComponent(post.slug)}`;
  const goUrl = (post) => `/go/review/${encodeURIComponent(post.id)}`;

  const formatDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const stars = (rating) => {
    const value = Number(rating) || 0;
    if (!value) return '';
    const icons = Array.from({ length: 5 }, (_, index) => {
      const fill = Math.max(0, Math.min(1, value - index));
      return `<span class="rv-star" style="--fill:${fill * 100}%">&#9733;</span>`;
    }).join('');
    return `<span class="rv-stars" aria-label="${value} out of 5 stars">${icons}<b>${value.toFixed(1)}</b></span>`;
  };

  const cover = (post, className = '') => {
    const label = escapeHtml(post.brand || post.title || '?');
    const media = post.image
      ? `<img src="${escapeHtml(post.image)}" alt="${label}" loading="lazy" onerror="this.remove()">`
      : '';
    return `<div class="rv-cover ${className}" data-initial="${escapeHtml(String(post.brand || post.title || '?').trim().charAt(0).toUpperCase())}">${media}</div>`;
  };

  const card = (post) => `
    <article class="rv-card">
      <a class="rv-card-link" href="${reviewUrl(post)}" aria-label="${escapeHtml(post.title)}">${cover(post)}</a>
      <div class="rv-card-body">
        <div class="rv-meta"><span class="rv-chip">${escapeHtml(post.category || 'Review')}</span>${stars(post.rating)}</div>
        <h3><a href="${reviewUrl(post)}">${escapeHtml(post.title)}</a></h3>
        <p>${escapeHtml(post.excerpt)}</p>
        <div class="rv-card-foot"><a class="rv-read" href="${reviewUrl(post)}">Read review &rarr;</a>${post.hasLink ? `<a class="rv-mini-cta" href="${goUrl(post)}" target="_blank" rel="sponsored nofollow noopener">${escapeHtml(post.ctaLabel || 'Check price')} &#8599;</a>` : ''}</div>
      </div>
    </article>`;

  const inline = (escaped) => escaped
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="nofollow noopener">$1</a>');

  // Minimal, escape-first formatting: ## headings, - lists, **bold**, [text](url).
  const renderContent = (content) => String(content || '').trim().split(/\n\s*\n/).map((block) => {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
    if (!lines.length) return '';
    if (lines.length === 1 && /^###\s+/.test(lines[0])) return `<h3>${inline(escapeHtml(lines[0].replace(/^###\s+/, '')))}</h3>`;
    if (lines.length === 1 && /^##\s+/.test(lines[0])) return `<h2>${inline(escapeHtml(lines[0].replace(/^##\s+/, '')))}</h2>`;
    if (lines.every((line) => /^[-*]\s+/.test(line))) return `<ul>${lines.map((line) => `<li>${inline(escapeHtml(line.replace(/^[-*]\s+/, '')))}</li>`).join('')}</ul>`;
    return `<p>${lines.map((line) => inline(escapeHtml(line))).join('<br>')}</p>`;
  }).join('');

  const fetchPosts = () => fetch('/api/blog', { signal: AbortSignal.timeout(8000) })
    .then((response) => response.ok ? response.json() : [])
    .then((posts) => Array.isArray(posts) ? posts : [])
    .catch(() => []);

  return { escapeHtml, reviewUrl, goUrl, formatDate, stars, cover, card, renderContent, fetchPosts };
})();
