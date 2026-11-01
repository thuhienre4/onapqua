// Server-side page shell and SEO for the public review pages.
// HTML files opt in with <!--@head-->, <!--@header:name-->, <!--@footer--> placeholders.
const Reviews = require('./reviews.js');

const { escapeHtml } = Reviews;
const siteName = 'onapqua.';
const defaultDescription = 'Honest, research-based reviews of hosting, WordPress plugins, AI tools and online services, with clear pros, cons and where to buy.';

const nav = [
  ['home', '/', 'Home'],
  ['reviews', '/blog.html', 'Reviews'],
  ['products', '/products.html', 'Products'],
  ['coupons', '/coupons.html', 'Coupons'],
];

function header(active) {
  return `<a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header"><div class="container header-inner">
    <a class="brand-logo" href="/" aria-label="onapqua. home"><img class="brand-logo-mark" src="/assets/logo.svg" alt="" width="34" height="34" /><span class="brand-logo-name">onapqua<span class="brand-dot">.</span></span></a>
    <nav class="main-nav" aria-label="Main navigation">${nav.map(([key, href, label]) => `<a${key === active ? ' class="active" aria-current="page"' : ''} href="${href}">${label}</a>`).join('')}</nav>
  </div></header>`;
}

function footer() {
  return `<footer class="site-footer">
    <div class="container site-footer-grid">
      <div class="site-footer-brand"><a href="/"><img class="footer-logo-mark" src="/assets/logo.svg" alt="" width="40" height="40" loading="lazy" /><strong>onapqua.</strong></a><p>Honest, research-based reviews with clear pros, cons and where to buy.</p><small>Independent reviews &middot; Updated regularly</small></div>
      <nav class="site-footer-column" aria-label="Review categories"><h2>Explore</h2><a href="/blog.html">All reviews</a><a href="/blog.html?category=Best%20Of">Best of guides</a><a href="/blog.html?category=Hosting%20%26%20Servers">Hosting &amp; Servers</a><a href="/blog.html?category=WordPress">WordPress</a></nav>
      <nav class="site-footer-column" aria-label="Company"><h2>Company</h2><a href="/about.html">About us</a><a href="/about.html#how-we-review">How we review</a><a href="mailto:hello@onapqua.com">Contact</a></nav>
      <nav class="site-footer-column" aria-label="Legal"><h2>Legal</h2><a href="/privacy.html">Privacy Policy</a><a href="/terms.html">Terms of Use</a><a href="/affiliate-disclosure.html">Affiliate Disclosure</a></nav>
    </div>
    <div class="container site-footer-bottom"><span>&copy; ${new Date().getUTCFullYear()} onapqua. All rights reserved.</span><span>Some links are affiliate links. We may earn a commission at no extra cost to you.</span></div>
  </footer>`;
}

function jsonLd(value) {
  return `<script type="application/ld+json">${JSON.stringify(value).replace(/</g, '\\u003c')}</script>`;
}

function head({ siteUrl, path, title, description, image, type = 'website', extra = '' }) {
  const url = `${siteUrl}${path}`;
  const ogImage = image ? (image.startsWith('/') ? `${siteUrl}${image}` : image) : `${siteUrl}/assets/og-default.png`;
  return `<title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="${escapeHtml(url)}" />
  <meta property="og:site_name" content="${siteName}" />
  <meta property="og:type" content="${type}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${escapeHtml(url)}" />
  <meta property="og:image" content="${escapeHtml(ogImage)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="theme-color" content="#168fe8" />
  ${extra}`;
}

const pages = {
  '/index.html': { title: 'onapqua. | Honest Reviews of Hosting, WordPress & AI Tools', description: defaultDescription },
  '/blog.html': { title: 'All Reviews | onapqua.', description: 'Browse every onapqua. review by category, with ratings, pros, cons and where to buy.' },
  '/about.html': { title: 'About onapqua. & How We Review', description: 'Who we are, how we research and score products, and how onapqua. is funded.' },
  '/privacy.html': { title: 'Privacy Policy | onapqua.', description: 'How onapqua. handles information when you visit the site.' },
  '/terms.html': { title: 'Terms of Use | onapqua.', description: 'The terms that apply when you use onapqua.' },
  '/products.html': { title: 'Product Directory | onapqua.', description: 'Every product we review, with our score and a direct link to the official site.' },
  '/coupons.html': { title: 'Coupons & Deals | onapqua.', description: 'Promo codes and deals for the hosting, WordPress and AI tools we review.' },
  '/404.html': { title: 'Page not found | onapqua.', description: defaultDescription },
  '/affiliate-disclosure.html': { title: 'Affiliate Disclosure | onapqua.', description: 'How affiliate links work on onapqua. and how they affect (and do not affect) our reviews.' },
};

function siteSchema(siteUrl) {
  return jsonLd({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', '@id': `${siteUrl}/#org`, name: siteName, url: `${siteUrl}/`, logo: `${siteUrl}/assets/logo.svg` },
      { '@type': 'WebSite', '@id': `${siteUrl}/#website`, name: siteName, url: `${siteUrl}/`, publisher: { '@id': `${siteUrl}/#org` },
        potentialAction: { '@type': 'SearchAction', target: `${siteUrl}/blog.html?q={search_term_string}`, 'query-input': 'required name=search_term_string' } },
    ],
  });
}

const newestFirst = (posts) => [...posts].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

// Server-rendered review lists, so search engines see real links instead of a loading message.
function latestReviews(posts) {
  const reviews = newestFirst(posts).filter((post) => post.category !== 'Best Of');
  const featured = reviews.find((post) => post.featured) || reviews[0];
  return reviews.filter((post) => post !== featured).slice(0, 6).map((post) => Reviews.card(publicPost(post))).join('');
}

// Fills placeholders in a static page. Returns the original HTML when it has none.
function renderPage(html, { siteUrl, path, posts = [] }) {
  if (!html.includes('<!--@')) return html;
  const meta = pages[path] || { title: siteName, description: defaultDescription };
  const loading = '<div class="rv-loading">Loading reviews...</div>';
  return html
    .replace('<!--@latest-->', () => latestReviews(posts) || loading)
    .replace('<!--@all-->', () => newestFirst(posts).map((post) => Reviews.card(publicPost(post))).join('') || loading)
    .replace('<!--@head-->', head({ siteUrl, path: path === '/index.html' ? '/' : path, ...meta, extra: path === '/index.html' ? siteSchema(siteUrl) : '' }))
    .replace(/<!--@header:(\w+)-->/, (_, active) => header(active))
    .replace('<!--@footer-->', footer());
}

function publicPost(post) {
  const { affiliateUrl, clicks, ...safe } = post;
  return { ...safe, hasLink: Boolean(affiliateUrl) };
}

// Pre-renders a single review: SEO tags, structured data and the article body.
function renderReview(html, { siteUrl, post, posts = [] }) {
  if (!post) {
    return html
      .replace('<!--@head-->', head({ siteUrl, path: '/blog.html', title: 'Review not found | onapqua.', description: defaultDescription, extra: '<meta name="robots" content="noindex" />' }))
      .replace(/<!--@header:(\w+)-->/, header('reviews'))
      .replace('<!--@footer-->', footer())
      .replace('<!--@article-->', '<div class="container rv-section"><div class="rv-empty"><h1>Review not found</h1><p>This review may have been moved or unpublished.</p><a class="rv-btn" href="/blog.html">Browse all reviews</a></div></div>');
  }
  const safe = publicPost(post);
  const path = `/review/${encodeURIComponent(post.slug)}`;
  const url = `${siteUrl}${path}`;
  const image = post.image ? (post.image.startsWith('/') ? `${siteUrl}${post.image}` : post.image) : `${siteUrl}/assets/og-default.png`;
  const graph = [
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl}/` },
      { '@type': 'ListItem', position: 2, name: 'Reviews', item: `${siteUrl}/blog.html` },
      { '@type': 'ListItem', position: 3, name: post.title, item: url },
    ] },
    { '@type': 'Article', headline: post.title, description: post.excerpt, image, url,
      datePublished: post.publishedAt, dateModified: post.updatedAt || post.publishedAt,
      ...((post.sources || []).length ? { citation: post.sources.map((source) => source.url) } : {}),
      author: { '@type': 'Organization', name: post.author || siteName }, publisher: { '@type': 'Organization', name: siteName, logo: { '@type': 'ImageObject', url: `${siteUrl}/assets/logo.svg` } } },
  ];
  if (post.rating && post.brand) {
    graph.push({ '@type': 'Review', name: post.title, url, datePublished: post.publishedAt,
      itemReviewed: { '@type': 'Product', name: post.brand, image: post.logo ? `${siteUrl}${post.logo}` : image, ...(post.sourceUrl ? { url: post.sourceUrl } : {}) },
      reviewRating: { '@type': 'Rating', ratingValue: post.rating, bestRating: 5, worstRating: 0 },
      author: { '@type': 'Organization', name: siteName }, reviewBody: post.excerpt,
      ...(post.pros?.length ? { positiveNotes: { '@type': 'ItemList', itemListElement: post.pros.map((name, index) => ({ '@type': 'ListItem', position: index + 1, name })) } } : {}),
      ...(post.cons?.length ? { negativeNotes: { '@type': 'ItemList', itemListElement: post.cons.map((name, index) => ({ '@type': 'ListItem', position: index + 1, name })) } } : {}) });
  }
  const extra = `<meta property="article:published_time" content="${escapeHtml(post.publishedAt)}" />
  <meta property="article:modified_time" content="${escapeHtml(post.updatedAt || post.publishedAt)}" />
  ${jsonLd({ '@context': 'https://schema.org', '@graph': graph })}
  <script>window.__REVIEW__ = ${JSON.stringify(safe).replace(/</g, '\\u003c')};</script>`;
  return html
    .replace('<!--@head-->', head({ siteUrl, path, title: post.seoTitle || `${post.title} | onapqua.`, description: post.metaDescription || post.excerpt || post.title, image: post.image, type: 'article', extra }))
    .replace(/<!--@header:(\w+)-->/, header('reviews'))
    .replace('<!--@footer-->', footer())
    .replace('<!--@article-->', () => withRelated(Reviews.article(safe), post, posts));
}

// Fills the "More reviews" block on the server: same category first, then the rest.
function withRelated(markup, post, posts) {
  const others = newestFirst(posts).filter((item) => item.id !== post.id);
  const related = [...others.filter((item) => item.category === post.category), ...others.filter((item) => item.category !== post.category)].slice(0, 3);
  if (!related.length) return markup;
  const cards = related.map((item) => Reviews.card(publicPost(item))).join('');
  return markup
    .replace('<section class="rv-section rv-related" hidden>', '<section class="rv-section rv-related">')
    .replace('<div class="rv-grid" id="related-reviews"></div>', `<div class="rv-grid" id="related-reviews">${cards}</div>`);
}

function sitemap(siteUrl, posts) {
  const urls = [
    ['/', null, '1.0'], ['/blog.html', null, '0.9'], ['/products.html', null, '0.6'], ['/coupons.html', null, '0.5'], ['/about.html', null, '0.5'],
    ['/affiliate-disclosure.html', null, '0.3'], ['/privacy.html', null, '0.2'], ['/terms.html', null, '0.2'],
    ...posts.map((post) => [`/review/${encodeURIComponent(post.slug)}`, post.updatedAt || post.publishedAt, '0.8']),
  ];
  const lastPost = posts.map((post) => post.updatedAt || post.publishedAt).sort().pop();
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([path, modified, priority]) => `  <url><loc>${escapeHtml(siteUrl + path)}</loc>${(modified || (path === '/' || path === '/blog.html' ? lastPost : '')) ? `<lastmod>${new Date(modified || lastPost).toISOString().slice(0, 10)}</lastmod>` : ''}<priority>${priority}</priority></url>`).join('\n')}
</urlset>
`;
}

function robots(siteUrl) {
  return `User-agent: *
Allow: /
Disallow: /admin
Disallow: /admin-blog.html
Disallow: /api/
Disallow: /go/

Sitemap: ${siteUrl}/sitemap.xml
`;
}

module.exports = { renderPage, renderReview, sitemap, robots, publicPost };
