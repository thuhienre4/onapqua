// Server-side page shell and SEO for the public review pages.
// HTML files opt in with <!--@head-->, <!--@header:name-->, <!--@footer--> placeholders.
const Reviews = require('./reviews.js');
const Catalog = require('./catalog.js');

const { escapeHtml } = Reviews;
const siteName = 'onapqua.';
const defaultDescription = 'Honest, research-based reviews of hosting, WordPress plugins, AI tools and online services, with clear pros, cons and where to buy.';

const nav = [
  ['home', '/', 'Home'],
  ['reviews', '/blog.html', 'Reviews'],
  ['best', '/best-software.html', 'Best Software'],
  ['comparisons', '/comparisons.html', 'Comparisons'],
  ['alternatives', '/alternatives.html', 'Alternatives'],
  ['coupons', '/coupons.html', 'Deals & Coupons'],
  ['about', '/about.html', 'About Us'],
];

// Set by the server: affiliate link metadata for analytics, and the public GA4 config.
let linkInfo = () => new Map();
let publicConfig = () => ({});
const setLinkInfo = (fn) => { linkInfo = fn; };
const setPublicConfig = (fn) => { publicConfig = fn; };

const searchIcon = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>';

function header(active) {
  return `<a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header"><div class="container header-inner">
    <a class="brand-logo" href="/" aria-label="onapqua. home"><img class="brand-logo-mark" src="/assets/logo.svg" alt="" width="34" height="34" /><span class="brand-logo-name">onapqua<span class="brand-dot">.</span></span></a>
    <nav class="main-nav" id="main-nav" aria-label="Main navigation">${nav.map(([key, href, label]) => `<a${key === active ? ' class="active" aria-current="page"' : ''} href="${href}">${escapeHtml(label)}</a>`).join('')}</nav>
    <div class="header-tools">
      <button class="icon-btn" type="button" data-search-toggle aria-expanded="false" aria-controls="site-search" aria-label="Search">${searchIcon}</button>
      <button class="icon-btn nav-toggle" type="button" data-nav-toggle aria-expanded="false" aria-controls="main-nav" aria-label="Menu"><span></span><span></span><span></span></button>
    </div>
  </div>
  <div class="site-search" id="site-search" hidden><form class="container" action="/blog.html" role="search"><label class="rv-sr" for="site-search-q">Search reviews</label><input id="site-search-q" type="search" name="q" placeholder="Search software, reviews or comparisons..." autocomplete="off" /><button type="submit">Search</button></form></div>
  </header>`;
}

function footer() {
  return `<footer class="site-footer">
    <div class="container site-footer-grid">
      <div class="site-footer-brand"><a href="/"><img class="footer-logo-mark" src="/assets/logo.svg" alt="" width="40" height="40" loading="lazy" /><strong>onapqua.</strong></a><p>Honest, research-based reviews with clear pros, cons and where to buy.</p><small>Independent reviews &middot; Updated regularly</small></div>
      <nav class="site-footer-column" aria-label="Explore"><h2>Explore</h2><a href="/blog.html">All reviews</a><a href="/best-software.html">Best software</a><a href="/comparisons.html">Comparisons</a><a href="/alternatives.html">Alternatives</a><a href="/coupons.html">Deals &amp; coupons</a><a href="/products.html">Product directory</a></nav>
      <nav class="site-footer-column" aria-label="Company"><h2>Company</h2><a href="/about.html">About Onapqua</a><a href="/editorial-policy.html">Editorial policy</a><a href="/methodology.html">Review methodology</a><a href="mailto:hello@onapqua.com">Contact</a></nav>
      <nav class="site-footer-column" aria-label="Legal"><h2>Legal</h2><a href="/affiliate-disclosure.html">Affiliate disclosure</a><a href="/privacy.html">Privacy policy</a><a href="/terms.html">Terms of service</a><a href="/sitemap.html">Sitemap</a><a href="#cookie-settings" data-cookie-settings>Cookie settings</a></nav>
    </div>
    <div class="container site-footer-bottom"><span>&copy; ${new Date().getUTCFullYear()} onapqua. All rights reserved.</span><span>Some links are affiliate links. We may earn a commission at no extra cost to you.</span></div>
  </footer>
  <script>window.OQ_CONFIG = ${JSON.stringify(publicConfig()).replace(/</g, '\\u003c')};</script>
  <script src="/site.js?v=2" defer></script>`;
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
  '/best-software.html': { title: 'Best Software 2026: Top-Rated Tools by Category | onapqua.', description: 'The best WordPress plugins, hosting, marketing, productivity and business software, ranked by our review scores with pricing and key features.' },
  '/comparisons.html': { title: 'Software Comparisons: Compare Tools Side by Side | onapqua.', description: 'Compare software side by side: ratings, pricing, pros, cons and best use cases, plus in-depth comparison guides.' },
  '/alternatives.html': { title: 'Software Alternatives: Find a Better Fit | onapqua.', description: 'Top-rated alternatives to popular software, hosting and WordPress plugins, based on our reviews.' },
  '/editorial-policy.html': { title: 'Editorial Policy | onapqua.', description: 'How onapqua. keeps reviews independent, accurate and up to date.' },
  '/methodology.html': { title: 'Review Methodology | onapqua.', description: 'How onapqua. researches, scores and updates software reviews.' },
  '/sitemap.html': { title: 'Sitemap | onapqua.', description: 'Every page and review on onapqua.' },
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

// Server-rendered sections, so search engines see real content and links instead of a loading message.
const sitemapList = (posts) => {
  const links = [['/', 'Home'], ['/blog.html', 'All reviews'], ['/best-software.html', 'Best software'], ['/comparisons.html', 'Comparisons'], ['/alternatives.html', 'Alternatives'], ['/coupons.html', 'Deals & coupons'], ['/products.html', 'Product directory'], ['/about.html', 'About Onapqua'], ['/editorial-policy.html', 'Editorial policy'], ['/methodology.html', 'Review methodology'], ['/affiliate-disclosure.html', 'Affiliate disclosure'], ['/privacy.html', 'Privacy policy'], ['/terms.html', 'Terms of service']];
  const item = ([href, label]) => `<li><a href="${escapeHtml(href)}">${escapeHtml(label)}</a></li>`;
  return `<h2>Pages</h2><ul>${links.map(item).join('')}</ul><h2>Reviews &amp; guides</h2><ul>${newestFirst(posts).map((post) => item([Reviews.reviewUrl(post), post.title])).join('')}</ul>`;
};

// Fills placeholders in a static page. Returns the original HTML when it has none.
function renderPage(html, { siteUrl, path, posts = [] }) {
  if (!html.includes('<!--@')) return html;
  const meta = pages[path] || { title: siteName, description: defaultDescription };
  const loading = '<div class="rv-loading">Loading reviews...</div>';
  const safe = posts.map(publicPost);
  const products = Catalog.topRated(safe);
  return html
    .replace('<!--@home-hubs-->', () => Catalog.hubCards(safe))
    .replace('<!--@home-featured-->', () => products.slice(0, 6).map(Catalog.productCard).join('') || loading)
    .replace('<!--@home-best-->', () => Catalog.bestTabs(safe))
    .replace('<!--@latest-->', () => newestFirst(safe).filter((post) => !Catalog.isGuide(post)).slice(0, 6).map(Catalog.latestItem).join('') || loading)
    .replace('<!--@all-->', () => newestFirst(safe).map(Reviews.card).join('') || loading)
    .replace('<!--@best-->', () => Catalog.bestSections(safe))
    .replace('<!--@guides-->', () => Catalog.guideCards(newestFirst(safe)))
    .replace('<!--@alternatives-->', () => Catalog.alternativesDirectory(safe))
    .replace('<!--@sitemap-->', () => sitemapList(safe))
    .replace('<!--@count-->', () => String(products.length))
    .replace('<!--@head-->', head({ siteUrl, path: path === '/index.html' ? '/' : path, ...meta, extra: path === '/index.html' ? siteSchema(siteUrl) : '' }))
    .replace(/<!--@header:(\w+)-->/, (_, active) => header(active))
    .replace('<!--@footer-->', footer());
}

function publicPost(post) {
  const { affiliateUrl, clicks, ...safe } = post;
  const info = post.linkId ? linkInfo().get(post.linkId) : null;
  return { ...safe, hasLink: Boolean(affiliateUrl), aff: info ? { id: post.linkId, ...info } : null };
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
  const safe = { ...publicPost(post), bestFor: Catalog.bestForOf(post) };
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
    .replace('<!--@article-->', () => withRelated(Reviews.article(safe), post, posts).replace('<!--@alternatives-->', () => alternativesBlock(safe, posts)));
}

// "Alternatives to X" comparison table inside a review.
function alternativesBlock(post, posts) {
  if (Catalog.isGuide(post)) return '';
  const items = Catalog.alternativesFor(post, posts.map(publicPost));
  if (!items.length) return '';
  return `<section class="rv-alternatives" aria-labelledby="alternatives"><h2 id="alternatives">${escapeHtml(post.brand)} alternatives</h2><p class="rv-sources-note">Other top-rated options in the same category, ranked by our review score.</p>${Catalog.compareTable(items, 'alternatives_table')}</section>`;
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
    ['/', null, '1.0'], ['/blog.html', null, '0.9'], ['/best-software.html', null, '0.9'], ['/comparisons.html', null, '0.8'], ['/alternatives.html', null, '0.8'], ['/editorial-policy.html', null, '0.3'], ['/methodology.html', null, '0.4'], ['/sitemap.html', null, '0.2'], ['/products.html', null, '0.6'], ['/coupons.html', null, '0.5'], ['/about.html', null, '0.5'],
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

module.exports = { renderPage, renderReview, sitemap, robots, publicPost, setLinkInfo, setPublicConfig };
