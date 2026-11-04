// Software catalog shared by the server (pre-rendering) and the browser: category hubs,
// "best for" summaries, product cards, comparison tables and alternatives.
(function (factory) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const api = factory(isNode ? require('./reviews.js') : window.Reviews);
  if (isNode) module.exports = api;
  else window.Catalog = api;
})((Reviews) => {
  const { escapeHtml, reviewUrl, goUrl, stars, logoMark, cover, formatDate } = Reviews;

  const icon = (path) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
  const HUBS = [
    { key: 'wordpress', label: 'WordPress Plugins', short: 'WordPress', blurb: 'Build, protect and grow WordPress sites', icon: icon('<circle cx="12" cy="12" r="9"/><path d="M4.5 8.5 9 20M9.5 7l4 11.5M14 7h3.5l-3 9M6 7h6"/>') },
    { key: 'seo', label: 'SEO Tools', short: 'SEO', blurb: 'Rank higher and track keywords', icon: icon('<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4M8.5 12.5l2-2 1.5 1.5 2.5-3"/>') },
    { key: 'marketing', label: 'Marketing Software', short: 'Marketing', blurb: 'Email, affiliates, chat and social proof', icon: icon('<path d="M4 10v4l11 4V6L4 10Z"/><path d="M15 9a3 3 0 0 1 0 6M7 15l1 4h3l-1-3.5"/>') },
    { key: 'hosting', label: 'Hosting & Domains', short: 'Hosting', blurb: 'VPS, dedicated and offshore servers', icon: icon('<rect x="4" y="4" width="16" height="7" rx="2"/><rect x="4" y="13" width="16" height="7" rx="2"/><path d="M8 7.5h.01M8 16.5h.01M12 7.5h5M12 16.5h5"/>') },
    { key: 'proxy', label: 'Proxy & VPN', short: 'Proxy & VPN', blurb: 'Private proxies and online privacy', icon: icon('<path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/>') },
    { key: 'productivity', label: 'Productivity Tools', short: 'Productivity', blurb: 'Automation, scheduling and AI tools', icon: icon('<path d="M13 3 5 14h6l-1 7 8-11h-6l1-7Z"/>') },
    { key: 'business', label: 'Business Software', short: 'Business', blurb: 'Support, payments, booking and community', icon: icon('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2M3 13h18"/>') },
  ];

  // Defaults for reviews published before hubs and "best for" were editable in the admin.
  const DEFAULTS = {
    'make-review': [['productivity', 'marketing'], 'Automating workflows without code'],
    'cherry-servers-review': [['hosting'], 'Dedicated bare metal with flexible billing'],
    'time4vps-review': [['hosting'], 'Cheap, reliable VPS in Europe'],
    'topaz-labs-review': [['productivity'], 'AI photo and video enhancement'],
    'wp-fusion-review': [['wordpress', 'marketing'], 'Syncing WordPress with your CRM'],
    'wpvivid-review': [['wordpress'], 'WordPress backups and migrations'],
    'easy-affiliate-review': [['wordpress', 'marketing'], 'Running your own affiliate program'],
    'smartsupp-review': [['marketing', 'business'], 'Live chat for online stores'],
    'myprivateproxy-review': [['proxy'], 'Affordable dedicated datacenter proxies'],
    'hostatom-review': [['hosting'], 'Websites targeting Thailand'],
    'shinjiru-review': [['hosting'], 'Privacy-focused offshore hosting'],
    'bitlaunch-review': [['hosting'], 'Paying for a VPS with crypto'],
    'monovm-review': [['hosting'], 'Choosing from 30+ server locations'],
    'musement-review': [[], 'Booking tours and attractions abroad'],
    'barn2-review': [['wordpress', 'business'], 'WooCommerce product tables and B2B stores'],
    'fluentcrm-review': [['wordpress', 'marketing'], 'Email marketing without per-contact fees'],
    'fluentbooking-review': [['wordpress', 'productivity', 'business'], 'Appointment scheduling on WordPress'],
    'ninja-tables-review': [['wordpress', 'productivity'], 'Responsive data and pricing tables'],
    'fluent-support-review': [['wordpress', 'business'], 'An in-house support helpdesk'],
    'wp-social-ninja-review': [['wordpress', 'marketing'], 'Social feeds and Google reviews'],
    'paymattic-review': [['wordpress', 'business'], 'Payment and donation forms'],
    'azonpress-review': [['wordpress', 'marketing'], 'Amazon affiliate product boxes'],
    'fluentcommunity-review': [['wordpress', 'business'], 'Communities and online courses'],
  };
  const CATEGORY_HUBS = { WordPress: ['wordpress'], 'Hosting & Servers': ['hosting'], 'Proxies & Privacy': ['proxy'], Automation: ['productivity'], 'AI Tools': ['productivity'], 'Customer Support': ['business'] };

  const isGuide = (post) => post.category === 'Best Of';
  const hubsOf = (post) => (Array.isArray(post.hubs) && post.hubs.length ? post.hubs : DEFAULTS[post.slug]?.[0] || CATEGORY_HUBS[post.category] || []);
  const bestForOf = (post) => post.bestFor || DEFAULTS[post.slug]?.[1] || '';
  const products = (posts) => posts.filter((post) => !isGuide(post) && post.brand);
  const topRated = (posts) => [...products(posts)].sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
  const inHub = (posts, key) => topRated(posts).filter((post) => hubsOf(post).includes(key));
  const hubBy = (key) => HUBS.find((hub) => hub.key === key);
  const visit = (post, label = 'Visit website', extra = '') => post.hasLink
    ? `<a class="rv-btn ${extra}" href="${goUrl(post)}" target="_blank" rel="sponsored nofollow noopener">${escapeHtml(label)} <span aria-hidden="true">&#8599;</span></a>` : '';

  const hubCards = (posts) => HUBS.map((hub) => [hub, inHub(posts, hub.key).length]).filter(([, count]) => count).map(([hub, count]) => `
    <a class="rv-hub" href="/best-software.html#${hub.key}">
      <span class="rv-hub-icon">${hub.icon}</span>
      <strong>${escapeHtml(hub.label)}</strong>
      <span>${escapeHtml(hub.blurb)}</span>
      <em>${count} review${count === 1 ? '' : 's'} &rarr;</em>
    </a>`).join('');

  // Product card: logo, score, pros/cons summary and a clear two-button CTA.
  const productCard = (post) => `
    <article class="rv-pcard">
      <div class="rv-pcard-top">
        ${logoMark(post) || `<span class="rv-logo rv-logo-letter">${escapeHtml(String(post.brand).charAt(0))}</span>`}
        <div><h3><a href="${reviewUrl(post)}">${escapeHtml(post.brand)}</a></h3><span class="rv-chip">${escapeHtml(hubBy(hubsOf(post)[0])?.short || post.category || 'Review')}</span></div>
        ${post.rating ? `<div class="rv-score-badge" aria-label="Score ${Number(post.rating).toFixed(1)} out of 5"><b>${Number(post.rating).toFixed(1)}</b><span>/5</span></div>` : ''}
      </div>
      <p>${escapeHtml(post.excerpt)}</p>
      ${bestForOf(post) ? `<p class="rv-bestfor"><b>Best for:</b> ${escapeHtml(bestForOf(post))}</p>` : ''}
      <ul class="rv-pcard-pc">${(post.pros || []).slice(0, 2).map((item) => `<li class="pro">${escapeHtml(item)}</li>`).join('')}${(post.cons || []).slice(0, 1).map((item) => `<li class="con">${escapeHtml(item)}</li>`).join('')}</ul>
      <div class="rv-pcard-actions"><a class="rv-btn rv-btn-ghost" href="${reviewUrl(post)}">Read full review</a>${visit(post)}</div>
    </article>`;

  const latestItem = (post) => `
    <article class="rv-latest">
      <a href="${reviewUrl(post)}" class="rv-latest-thumb" tabindex="-1" aria-hidden="true">${cover(post)}</a>
      <div>
        <div class="rv-meta"><span class="rv-chip">${escapeHtml(post.category || 'Review')}</span>${stars(post.rating)}</div>
        <h3><a href="${reviewUrl(post)}">${escapeHtml(post.title)}</a></h3>
        <p>${escapeHtml(post.excerpt)}</p>
        <div class="rv-latest-foot"><span>${escapeHtml(post.author || 'onapqua. Editorial')} &middot; Updated ${escapeHtml(formatDate(post.updatedAt || post.publishedAt))}</span><a class="rv-read" href="${reviewUrl(post)}">Read review &rarr;</a></div>
      </div>
    </article>`;

  // Comparison table: rank, product, rating, price, key features, best for, CTA.
  const compareTable = (items) => `
    <div class="rv-table-wrap rv-compare"><table>
      <thead><tr><th>#</th><th>Product</th><th>Rating</th><th>Pricing</th><th>Key features</th><th>Best for</th><th><span class="rv-sr">Links</span></th></tr></thead>
      <tbody>${items.map((post, index) => `<tr>
        <td class="rv-rank" data-label="Rank">${index + 1}</td>
        <td class="rv-prod-cell" data-label="Product"><div class="rv-prod">${logoMark(post, 'rv-logo rv-logo-sm') || ''}<span><a href="${reviewUrl(post)}">${escapeHtml(post.brand)}</a><small>${escapeHtml(post.category || '')}</small></span></div></td>
        <td data-label="Rating">${stars(post.rating)}</td>
        <td data-label="Pricing">${escapeHtml(post.price || 'See website')}</td>
        <td data-label="Key features"><ul>${(post.pros || []).slice(0, 2).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></td>
        <td data-label="Best for">${escapeHtml(bestForOf(post))}</td>
        <td class="rv-cta-cell">${visit(post, 'Visit', 'rv-btn-sm')}<a class="rv-read" href="${reviewUrl(post)}">Review</a></td>
      </tr>`).join('')}</tbody>
    </table></div>`;

  const activeHubs = (posts) => HUBS.filter((hub) => inHub(posts, hub.key).length);

  // Homepage tabs: top 3 per category with a link to the full ranking.
  const bestTabs = (posts) => {
    const hubs = activeHubs(posts);
    if (!hubs.length) return '';
    return `<div class="rv-tabs" role="tablist" aria-label="Best software by category">${hubs.map((hub, index) => `<button type="button" role="tab" id="tab-${hub.key}" aria-controls="panel-${hub.key}" aria-selected="${index === 0}"${index ? ' tabindex="-1"' : ''}>${escapeHtml(hub.short)}</button>`).join('')}</div>
      ${hubs.map((hub, index) => `<div class="rv-tab-panel" role="tabpanel" id="panel-${hub.key}" aria-labelledby="tab-${hub.key}"${index ? ' hidden' : ''}>
        ${compareTable(inHub(posts, hub.key).slice(0, 3))}
        <a class="rv-link" href="/best-software.html#${hub.key}">See all ${escapeHtml(hub.label.toLowerCase())} &rarr;</a>
      </div>`).join('')}`;
  };

  const bestSections = (posts) => activeHubs(posts).map((hub) => {
    const items = inHub(posts, hub.key);
    return `<section class="rv-best" id="${hub.key}" aria-labelledby="h-${hub.key}">
      <div class="rv-best-head"><span class="rv-hub-icon">${hub.icon}</span><div><h2 id="h-${hub.key}">Best ${escapeHtml(hub.label)} in ${new Date().getUTCFullYear()}</h2><p>${escapeHtml(hub.blurb)}. Ranked by our review score.</p></div></div>
      ${compareTable(items)}
    </section>`;
  }).join('');

  const alternativesFor = (post, posts, limit = 3) => {
    const hubs = hubsOf(post);
    return topRated(posts).filter((item) => item.id !== post.id && hubsOf(item).some((key) => hubs.includes(key))).slice(0, limit);
  };

  const alternativesDirectory = (posts) => topRated(posts).map((post) => {
    const alternatives = alternativesFor(post, posts);
    if (!alternatives.length) return '';
    return `<section class="rv-alt" id="alt-${escapeHtml(post.slug)}" data-search="${escapeHtml([post.brand, post.category, ...alternatives.map((item) => item.brand)].join(' ').toLowerCase())}">
      <div class="rv-alt-head">${logoMark(post, 'rv-logo rv-logo-sm')}<h2>${escapeHtml(post.brand)} alternatives</h2><a class="rv-read" href="${reviewUrl(post)}">Read ${escapeHtml(post.brand)} review &rarr;</a></div>
      <div class="rv-alt-list">${alternatives.map((item) => `<a class="rv-alt-item" href="${reviewUrl(item)}">${logoMark(item, 'rv-logo rv-logo-sm')}<span><b>${escapeHtml(item.brand)}</b><small>${escapeHtml(bestForOf(item))}</small></span>${stars(item.rating)}</a>`).join('')}</div>
    </section>`;
  }).join('');

  const guideCards = (posts) => posts.filter(isGuide).map((post) => `
    <a class="rv-guide" href="${reviewUrl(post)}">
      <span class="rv-guide-kicker">${escapeHtml(post.brand || 'Buyer’s guide')}</span>
      <strong>${escapeHtml(post.title)}</strong>
      <span>${escapeHtml(post.excerpt)}</span>
      <em>Read the comparison &rarr;</em>
    </a>`).join('');

  return { HUBS, hubsOf, bestForOf, products, topRated, inHub, hubCards, productCard, latestItem, compareTable, bestTabs, bestSections, alternativesFor, alternativesDirectory, guideCards, isGuide };
});
