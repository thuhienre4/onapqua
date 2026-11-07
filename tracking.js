// Affiliate tracking: centralized links, click logging, transactions (postbacks, CSV,
// manual entry), reporting and optional GA4 Measurement Protocol for confirmed conversions.
// Storage is first-party and privacy-conscious: no raw IPs or user agents are stored.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const NETWORKS = {
  direct: { label: 'Direct program', subIdParam: '' },
  impact: { label: 'Impact', subIdParam: 'subId1' },
  awin: { label: 'Awin', subIdParam: 'clickref' },
  cj: { label: 'CJ Affiliate', subIdParam: 'sid' },
  shareasale: { label: 'ShareASale', subIdParam: 'afftrack' },
  partnerstack: { label: 'PartnerStack', subIdParam: '' },
  other: { label: 'Other network', subIdParam: '' },
};
const STATUSES = ['pending', 'approved', 'rejected', 'reversed'];
const CTA_POSITIONS = {
  review_top: 'Review top (verdict box)', final_verdict: 'Final verdict CTA', in_content: 'In-content link',
  sticky_mobile: 'Sticky mobile bar', comparison_table: 'Comparison table', alternatives_table: 'Alternatives table',
  product_card: 'Product card', card: 'Review card', compare_tool: 'Compare tool', coupon_page: 'Coupons page',
  review_deals: 'Deals box in review', unknown: 'Unknown',
};
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|headless|lighthouse|monitor|curl|wget|python|axios|node-fetch/i;

function create({ dataDir, readArray, writeArray, safeUrl, text }) {
  const files = {
    links: path.join(dataDir, 'links.json'),
    transactions: path.join(dataDir, 'transactions.json'),
    settings: path.join(dataDir, 'tracking-settings.json'),
    clicks: path.join(dataDir, 'clicks.jsonl'),
    views: path.join(dataDir, 'views.json'),
  };
  const defaults = () => ({
    trackingEnabled: true, ga4Id: '', ga4ApiSecret: '', postbackToken: crypto.randomBytes(18).toString('base64url'),
    appendUtm: false, utmSource: 'onapqua', utmMedium: 'affiliate', currency: 'USD', retentionDays: 400, dedupSeconds: 30,
  });

  let settings = (() => { try { return { ...defaults(), ...JSON.parse(fs.readFileSync(files.settings, 'utf8')) }; } catch { return defaults(); } })();
  const saveSettings = () => fs.writeFileSync(files.settings, `${JSON.stringify(settings, null, 2)}\n`);
  if (!fs.existsSync(files.settings)) saveSettings();

  // Clicks: append-only JSON lines, kept in memory for fast reporting; old rows pruned on start.
  const cutoff = () => Date.now() - Number(settings.retentionDays || 400) * 86400000;
  let clicks = [];
  try {
    clicks = fs.readFileSync(files.clicks, 'utf8').split('\n').filter(Boolean).map((line) => { try { return JSON.parse(line); } catch { return null; } })
      .filter((row) => row && Date.parse(row.ts) >= cutoff());
    fs.writeFileSync(files.clicks, clicks.map((row) => JSON.stringify(row)).join('\n') + (clicks.length ? '\n' : ''));
  } catch { /* no clicks yet */ }
  let views = (() => { try { return JSON.parse(fs.readFileSync(files.views, 'utf8')); } catch { return {}; } })();
  let viewsDirty = false;
  setInterval(() => { if (viewsDirty) { fs.writeFileSync(files.views, JSON.stringify(views)); viewsDirty = false; } }, 15000).unref();

  const links = () => readArray(files.links);
  const transactions = () => readArray(files.transactions);
  const slugify = (value) => String(value || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);

  function detectNetwork(url) {
    let host = '';
    try { host = new URL(url).hostname; } catch { return 'direct'; }
    if (/(^|\.)(sjv\.io|pxf\.io|impact\.com|ojrq\.net|evyy\.net)$/.test(host)) return 'impact';
    if (/(^|\.)awin1\.com$/.test(host)) return 'awin';
    if (/(^|\.)(anrdoezrs\.net|dpbolvw\.net|jdoqocy\.com|kqzyfj\.com|tkqlhce\.com|emjcd\.com)$/.test(host)) return 'cj';
    if (/(^|\.)shareasale\.com$/.test(host)) return 'shareasale';
    if (/partnerstack|grsm\.io|getreditus\.com/.test(host)) return 'partnerstack';
    return 'direct';
  }

  // Destinations must be public http(s) URLs; nothing is ever redirected from a query parameter.
  function validDestination(value) {
    const url = new URL(safeUrl(value));
    if (url.username || url.password) throw new Error('Destination must not contain credentials.');
    if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(url.hostname) || url.hostname.endsWith('.local') || url.hostname.endsWith('.internal')) throw new Error('Destination must be a public website.');
    return url.toString();
  }

  function cleanLink(payload, previous = {}) {
    const id = slugify(payload.id ?? previous.id ?? payload.name);
    if (!id) throw new Error('Link slug is required.');
    const destination = validDestination(payload.destination ?? previous.destination);
    const network = NETWORKS[payload.network ?? previous.network] ? (payload.network ?? previous.network) : detectNetwork(destination);
    const expiresAt = text(payload.expiresAt ?? previous.expiresAt, 40);
    return {
      ...previous, id, name: text(payload.name ?? previous.name, 120) || id,
      merchant: text(payload.merchant ?? previous.merchant, 120) || text(payload.name ?? previous.name, 120) || id,
      product: text(payload.product ?? previous.product, 120) || text(payload.name ?? previous.name, 120) || id,
      category: text(payload.category ?? previous.category, 80),
      network, destination,
      subIdParam: text(payload.subIdParam ?? previous.subIdParam ?? NETWORKS[network].subIdParam, 40).replace(/[^\w-]/g, ''),
      status: payload.status === 'paused' ? 'paused' : (payload.status ?? previous.status) === 'paused' ? 'paused' : 'active',
      expiresAt: expiresAt && !Number.isNaN(Date.parse(expiresAt)) ? new Date(expiresAt).toISOString() : '',
      fallbackUrl: (payload.fallbackUrl ?? previous.fallbackUrl) ? validDestination(payload.fallbackUrl ?? previous.fallbackUrl) : '',
      createdAt: previous.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
  }

  // Keeps one link per affiliate destination and remembers it on the post/offer.
  function ensureLink({ destination, name, merchant, product, category, preferredId }) {
    if (!destination) return '';
    const all = links();
    // Compare normalized URLs: example.com?a=1 and example.com/?a=1 are the same destination.
    const normalized = validDestination(destination);
    const existing = all.find((link) => link.destination === normalized);
    if (existing) return existing.id;
    let id = slugify(preferredId || name) || 'link';
    for (let n = 2; all.some((link) => link.id === id); n += 1) id = `${slugify(preferredId || name)}-${n}`;
    const link = cleanLink({ id, name, merchant, product, category, destination });
    writeArray(files.links, [...all, link]);
    return link.id;
  }

  function syncFrom(postsFile, offersFile) {
    const posts = readArray(postsFile);
    let changed = false;
    for (const post of posts) {
      if (!post.affiliateUrl) continue;
      const linkId = post.linkId && links().some((link) => link.id === post.linkId) ? post.linkId : ensureLink({ destination: post.affiliateUrl, name: post.brand || post.title, merchant: post.brand, product: post.brand, category: post.category });
      if (post.linkId !== linkId) { post.linkId = linkId; changed = true; }
    }
    if (changed) writeArray(postsFile, posts);
    const offers = readArray(offersFile);
    changed = false;
    for (const offer of offers) {
      if (!offer.link) continue;
      const linkId = offer.linkId && links().some((link) => link.id === offer.linkId) ? offer.linkId : ensureLink({ destination: offer.link, name: offer.brand, merchant: offer.brand, product: offer.brand, category: offer.category });
      if (offer.linkId !== linkId) { offer.linkId = linkId; changed = true; }
    }
    if (changed) writeArray(offersFile, offers);
  }

  // When an admin edits a post's affiliate URL, keep its central link in step.
  function updateLinkDestination(linkId, destination, meta) {
    if (!destination) return '';
    const all = links();
    const index = all.findIndex((link) => link.id === linkId);
    if (index < 0) return ensureLink({ destination, ...meta });
    if (all[index].destination !== destination) { all[index] = cleanLink({ destination, network: detectNetwork(destination) }, all[index]); writeArray(files.links, all); }
    return linkId;
  }

  const deviceOf = (ua) => /ipad|tablet|kindle|playbook|silk|(android(?!.*mobile))/i.test(ua) ? 'tablet' : /mobi|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua) ? 'mobile' : 'desktop';
  const consentOf = (cookieMap, headers) => (headers['sec-gpc'] === '1' ? 'denied' : cookieMap.oq_consent === 'granted' ? 'granted' : cookieMap.oq_consent === 'denied' ? 'denied' : 'unset');
  // Rotating daily key: counts unique sessions without storing IPs or user agents.
  const daySalt = () => crypto.createHash('sha256').update(`${settings.postbackToken}:${new Date().toISOString().slice(0, 10)}`).digest('hex');
  const sessionKey = (ip, ua) => crypto.createHash('sha256').update(`${daySalt()}|${ip}|${ua}`).digest('base64url').slice(0, 16);

  function sourceOf(attr) {
    const source = text(attr.src, 80).toLowerCase();
    const medium = text(attr.med, 40).toLowerCase();
    if (medium) return { source: source || 'unknown', medium };
    if (!source || source === 'direct') return { source: 'direct', medium: 'none' };
    if (/google|bing|duckduckgo|yahoo|yandex|baidu|ecosia/.test(source)) return { source, medium: 'organic' };
    if (/facebook|instagram|t\.co|twitter|x\.com|linkedin|reddit|pinterest|youtube|tiktok|zalo/.test(source)) return { source, medium: 'social' };
    return { source, medium: 'referral' };
  }

  const recentKeys = new Map();
  // Records one outbound click and returns the final destination URL (with sub-ID and UTMs).
  function recordClick({ link, req, url, cookieMap, postId, offerId, articleId, articleTitle, articlePath }) {
    const ua = String(req.headers['user-agent'] || '');
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    const consent = consentOf(cookieMap, req.headers);
    const cta = CTA_POSITIONS[url.searchParams.get('c')] ? url.searchParams.get('c') : 'unknown';
    const clickId = crypto.randomBytes(9).toString('base64url');
    let destination = link.destination;
    try {
      const target = new URL(link.destination);
      if (link.subIdParam && !target.searchParams.has(link.subIdParam)) target.searchParams.set(link.subIdParam, clickId);
      if (settings.appendUtm && !target.searchParams.has('utm_source')) {
        target.searchParams.set('utm_source', settings.utmSource || 'onapqua');
        target.searchParams.set('utm_medium', settings.utmMedium || 'affiliate');
        target.searchParams.set('utm_campaign', articleId ? 'product_review' : 'site');
        target.searchParams.set('utm_content', cta);
      }
      destination = target.toString();
    } catch { /* keep stored destination */ }

    if (!settings.trackingEnabled || BOT.test(ua) || req.method === 'HEAD') return { destination, clickId: '' };
    const key = consent === 'denied' ? '' : sessionKey(ip, ua);
    // Ignore rapid repeats (double clicks, prefetch) and cap abusive bursts.
    const dedupKey = `${key || ip}|${link.id}`;
    const last = recentKeys.get(dedupKey) || [];
    const now = Date.now();
    const window = last.filter((time) => now - time < 60000);
    if (window.length && now - window[window.length - 1] < Number(settings.dedupSeconds || 30) * 1000) return { destination, clickId: '' };
    if (window.length >= 20) return { destination, clickId: '' };
    recentKeys.set(dedupKey, [...window, now]);
    if (recentKeys.size > 50000) recentKeys.clear();

    let attr = {};
    try { attr = JSON.parse(Buffer.from(cookieMap.oq_attr || '', 'base64url').toString('utf8')) || {}; } catch { /* none */ }
    const { source, medium } = consent === 'granted' ? sourceOf(attr) : { source: 'not consented', medium: 'unknown' };
    const gaClientId = consent === 'granted' ? String(cookieMap._ga || '').split('.').slice(-2).join('.') : '';
    const row = {
      ts: new Date().toISOString(), id: clickId, link: link.id, product: link.product, merchant: link.merchant, network: link.network,
      post: postId || '', offer: offerId || '', article: articleId || '', articleTitle: text(articleTitle, 160), articlePath: text(articlePath, 200),
      cta, device: deviceOf(ua), source, medium, campaign: consent === 'granted' ? text(attr.camp, 80) : '',
      session: key, consent, ga: /^\d+\.\d+$/.test(gaClientId) ? gaClientId : '',
    };
    clicks.push(row);
    fs.appendFile(files.clicks, `${JSON.stringify(row)}\n`, () => {});
    return { destination, clickId };
  }

  function recordView(pathKey, ua) {
    if (!settings.trackingEnabled || BOT.test(String(ua || ''))) return;
    const day = new Date().toISOString().slice(0, 10);
    views[pathKey] = views[pathKey] || {};
    views[pathKey][day] = (views[pathKey][day] || 0) + 1;
    viewsDirty = true;
  }

  // ---- Transactions ----
  const money = (value) => { const n = Number(String(value ?? '').replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0; };
  function normalizeStatus(value) {
    const status = String(value || '').trim().toLowerCase();
    if (/approv|confirm|paid|locked|valid|accepted|complete/.test(status)) return 'approved';
    if (/revers|refund|chargeback|clawback/.test(status)) return 'reversed';
    if (/reject|declin|invalid|void|cancel/.test(status)) return 'rejected';
    return 'pending';
  }

  // Upserts by network + transaction ID; returns { tx, created, statusChanged }.
  function upsertTransaction(input, sourceName) {
    const txId = text(input.txId ?? input.tx ?? input.transaction_id ?? input.transactionId ?? input.order_id ?? input.id, 120);
    if (!txId) throw new Error('Transaction ID is required.');
    const clickId = text(input.clickId ?? input.subid ?? input.sub_id ?? input.subId1 ?? input.clickref ?? input.sid ?? input.afftrack ?? input.click_id, 60);
    const click = clickId ? clicks.find((row) => row.id === clickId) : null;
    const linkId = text(input.linkId ?? input.link, 60) || click?.link || '';
    const link = links().find((item) => item.id === linkId);
    const network = NETWORKS[input.network] ? input.network : link?.network || click?.network || 'direct';
    const all = transactions();
    const index = all.findIndex((tx) => tx.network === network && tx.txId === txId);
    const previous = index >= 0 ? all[index] : null;
    const status = input.status ? normalizeStatus(input.status) : previous?.status || 'pending';
    const tx = {
      ...(previous || {}), txId, network, linkId, clickId: clickId || previous?.clickId || '',
      merchant: text(input.merchant, 120) || link?.merchant || click?.merchant || previous?.merchant || '',
      product: text(input.product, 120) || link?.product || click?.product || previous?.product || '',
      article: click?.article || previous?.article || text(input.article, 120), cta: click?.cta || previous?.cta || '',
      orderValue: input.orderValue !== undefined || input.amount !== undefined || input.sale_amount !== undefined ? money(input.orderValue ?? input.amount ?? input.sale_amount) : previous?.orderValue || 0,
      commission: input.commission !== undefined || input.payout !== undefined ? money(input.commission ?? input.payout) : previous?.commission || 0,
      currency: (text(input.currency, 3) || previous?.currency || settings.currency || 'USD').toUpperCase(),
      status, convertedAt: text(input.convertedAt ?? input.date ?? input.conversion_date, 40) || previous?.convertedAt || new Date().toISOString(),
      source: previous?.source || sourceName, updatedAt: new Date().toISOString(), createdAt: previous?.createdAt || new Date().toISOString(),
      gaSent: previous?.gaSent || [],
    };
    if (Number.isNaN(Date.parse(tx.convertedAt))) tx.convertedAt = new Date().toISOString();
    if (index >= 0) all[index] = tx; else all.push(tx);
    writeArray(files.transactions, all);
    return { tx, created: index < 0, statusChanged: !previous || previous.status !== status };
  }

  // Sends affiliate_conversion / affiliate_refund to GA4 only for confirmed status changes
  // on clicks from visitors who consented, and only once per event per transaction.
  async function sendToGa(tx) {
    if (!settings.ga4Id || !settings.ga4ApiSecret) return;
    const click = tx.clickId ? clicks.find((row) => row.id === tx.clickId) : null;
    if (!click?.ga) return;
    const event = tx.status === 'approved' ? 'affiliate_conversion' : tx.status === 'reversed' ? 'affiliate_refund' : '';
    if (!event || tx.gaSent.includes(event) || (event === 'affiliate_refund' && !tx.gaSent.includes('affiliate_conversion'))) return;
    const body = { client_id: click.ga, events: [{ name: event, params: {
      transaction_id: tx.txId, value: event === 'affiliate_refund' ? -tx.commission : tx.commission, currency: tx.currency,
      affiliate_id: tx.linkId, affiliate_network: tx.network, merchant_name: tx.merchant, product_name: tx.product, article_id: tx.article, cta_position: tx.cta,
    } }] };
    try {
      const response = await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(settings.ga4Id)}&api_secret=${encodeURIComponent(settings.ga4ApiSecret)}`, { method: 'POST', body: JSON.stringify(body), signal: AbortSignal.timeout(8000) });
      if (response.ok || response.status === 204) {
        const all = transactions();
        const index = all.findIndex((item) => item.network === tx.network && item.txId === tx.txId);
        if (index >= 0) { all[index].gaSent = [...(all[index].gaSent || []), event]; writeArray(files.transactions, all); }
      }
    } catch { /* retried on the next status update */ }
  }

  // CSV parsing with quoted fields; maps common network export headers.
  function parseCsv(csv) {
    const rows = [];
    let row = []; let field = ''; let quoted = false;
    const input = String(csv || '').replace(/^﻿/, '');
    for (let i = 0; i < input.length; i += 1) {
      const char = input[i];
      if (quoted) {
        if (char === '"' && input[i + 1] === '"') { field += '"'; i += 1; } else if (char === '"') quoted = false; else field += char;
      } else if (char === '"') quoted = true;
      else if (char === ',' || char === ';' || char === '\t') { row.push(field); field = ''; }
      else if (char === '\n' || char === '\r') { if (char === '\r' && input[i + 1] === '\n') i += 1; row.push(field); field = ''; if (row.some((cell) => cell.trim())) rows.push(row); row = []; }
      else field += char;
    }
    row.push(field);
    if (row.some((cell) => cell.trim())) rows.push(row);
    if (rows.length < 2) return [];
    const aliases = {
      txId: /^(transaction[ _-]?id|order[ _-]?id|action[ _-]?id|tx[ _-]?id|id|reference|conversion[ _-]?id)$/,
      clickId: /^(sub[ _-]?id1?|subid|click[ _-]?ref|clickref|sid|afftrack|click[ _-]?id|tracking[ _-]?id)$/,
      status: /^(status|state|action[ _-]?status|commission[ _-]?status)$/,
      commission: /^(commission|payout|earnings|commission[ _-]?amount|publisher[ _-]?commission)$/,
      orderValue: /^(sale[ _-]?amount|order[ _-]?value|amount|revenue|sale[ _-]?value)$/,
      currency: /^(currency|currency[ _-]?code)$/,
      convertedAt: /^(date|conversion[ _-]?date|transaction[ _-]?date|event[ _-]?date|click[ _-]?date)$/,
      merchant: /^(merchant|advertiser|brand|program|campaign[ _-]?name)$/,
      product: /^(product|product[ _-]?name|item)$/,
      linkId: /^(link|link[ _-]?id|affiliate[ _-]?id)$/,
      network: /^(network)$/,
    };
    const header = rows[0].map((cell) => cell.trim().toLowerCase());
    const map = {};
    header.forEach((name, index) => { const key = Object.keys(aliases).find((field) => aliases[field].test(name)); if (key && map[key] === undefined) map[key] = index; });
    return rows.slice(1).map((cells) => Object.fromEntries(Object.entries(map).map(([key, index]) => [key, String(cells[index] ?? '').trim()])));
  }

  // ---- Reporting ----
  function report({ days = 30, posts = [] } = {}) {
    const since = days ? Date.now() - days * 86400000 : 0;
    const inRange = (iso) => Date.parse(iso) >= since;
    const rows = clicks.filter((row) => inRange(row.ts));
    const txs = transactions().filter((tx) => inRange(tx.convertedAt));
    const approved = txs.filter((tx) => tx.status === 'approved');
    const sum = (list, field) => Math.round(list.reduce((total, item) => total + Number(item[field] || 0), 0) * 100) / 100;
    const uniqueOf = (list) => new Set(list.map((row) => (row.session ? `${row.session}|${row.link}|${row.ts.slice(0, 10)}` : row.id))).size;
    const byCurrency = approved.reduce((map, tx) => ({ ...map, [tx.currency]: Math.round(((map[tx.currency] || 0) + tx.commission) * 100) / 100 }), {});
    const main = settings.currency || 'USD';
    const group = (keyOf, labelOf) => {
      const map = new Map();
      const entry = (key) => { if (!map.has(key)) map.set(key, { key, label: labelOf(key), clicks: 0, unique: new Set(), conversions: 0, pending: 0, commission: 0, sales: 0 }); return map.get(key); };
      rows.forEach((row) => { const item = entry(keyOf(row) || 'unknown'); item.clicks += 1; item.unique.add(row.session ? `${row.session}|${row.ts.slice(0, 10)}` : row.id); });
      txs.forEach((tx) => {
        const click = tx.clickId ? clicks.find((row) => row.id === tx.clickId) : null;
        const key = keyOf(click || { link: tx.linkId, product: tx.product, merchant: tx.merchant, network: tx.network, article: tx.article, cta: tx.cta }) || 'unknown';
        const item = entry(key);
        if (tx.status === 'approved') { item.conversions += 1; if (tx.currency === main) { item.commission += tx.commission; item.sales += tx.orderValue; } }
        if (tx.status === 'pending') item.pending += 1;
      });
      return [...map.values()].map((item) => ({ ...item, unique: item.unique.size, commission: Math.round(item.commission * 100) / 100, sales: Math.round(item.sales * 100) / 100, rate: item.clicks ? Math.round((item.conversions / item.clicks) * 10000) / 100 : 0 }))
        .sort((a, b) => b.commission - a.commission || b.clicks - a.clicks);
    };
    const postTitle = new Map(posts.map((post) => [post.id, post.title]));
    const articleViews = (articleId) => {
      const post = posts.find((item) => item.id === articleId);
      const counts = post ? views[`/review/${post.slug}`] || {} : views[articleId] || {};
      return Object.entries(counts).filter(([day]) => Date.parse(day) >= since - 86400000).reduce((total, [, n]) => total + n, 0);
    };
    const linkName = new Map(links().map((link) => [link.id, link.name]));
    const articles = group((row) => row.article || row.articlePath, (key) => postTitle.get(key) || key).map((item) => ({ ...item, views: articleViews(item.key) }));
    return {
      days, currency: main,
      overview: {
        clicks: rows.length, unique: uniqueOf(rows), conversions: approved.length, pending: txs.filter((tx) => tx.status === 'pending').length,
        rejected: txs.filter((tx) => tx.status === 'rejected' || tx.status === 'reversed').length,
        commission: byCurrency[main] || 0, otherCurrencies: Object.fromEntries(Object.entries(byCurrency).filter(([currency]) => currency !== main)),
        sales: sum(approved.filter((tx) => tx.currency === main), 'orderValue'),
        rate: rows.length ? Math.round((approved.length / rows.length) * 10000) / 100 : 0,
        average: approved.length ? Math.round(((byCurrency[main] || 0) / Math.max(1, approved.filter((tx) => tx.currency === main).length)) * 100) / 100 : 0,
      },
      articles, products: group((row) => row.link, (key) => linkName.get(key) || key),
      merchants: group((row) => row.merchant, (key) => key), networks: group((row) => row.network, (key) => NETWORKS[key]?.label || key),
      ctas: group((row) => row.cta, (key) => CTA_POSITIONS[key] || key), devices: group((row) => row.device, (key) => key),
      sources: group((row) => (row.medium && row.medium !== 'none' ? `${row.source} / ${row.medium}` : row.source), (key) => key),
      daily: Object.entries(rows.reduce((map, row) => ({ ...map, [row.ts.slice(0, 10)]: (map[row.ts.slice(0, 10)] || 0) + 1 }), {})).sort(),
    };
  }

  const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const toCsv = (rows, columns) => [columns.join(','), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(','))].join('\n');

  return {
    NETWORKS, STATUSES, CTA_POSITIONS, files,
    get settings() { return settings; },
    publicConfig: () => ({ ga4: settings.trackingEnabled ? settings.ga4Id : '' }),
    updateSettings(payload) {
      const next = { ...settings };
      if (payload.trackingEnabled !== undefined) next.trackingEnabled = payload.trackingEnabled === true;
      if (payload.ga4Id !== undefined) { const id = text(payload.ga4Id, 20).toUpperCase(); if (id && !/^G-[A-Z0-9]{4,15}$/.test(id)) throw new Error('GA4 Measurement ID looks like G-XXXXXXXXXX.'); next.ga4Id = id; }
      if (payload.ga4ApiSecret) next.ga4ApiSecret = text(payload.ga4ApiSecret, 80);
      if (payload.clearApiSecret === true) next.ga4ApiSecret = '';
      if (payload.appendUtm !== undefined) next.appendUtm = payload.appendUtm === true;
      if (payload.utmSource !== undefined) next.utmSource = slugify(payload.utmSource) || 'onapqua';
      if (payload.utmMedium !== undefined) next.utmMedium = slugify(payload.utmMedium) || 'affiliate';
      if (payload.currency !== undefined) next.currency = (text(payload.currency, 3) || 'USD').toUpperCase();
      if (payload.retentionDays !== undefined) next.retentionDays = Math.min(1095, Math.max(30, Number(payload.retentionDays) || 400));
      if (payload.dedupSeconds !== undefined) next.dedupSeconds = Math.min(600, Math.max(0, Number(payload.dedupSeconds) || 0));
      if (payload.rotatePostbackToken === true) next.postbackToken = crypto.randomBytes(18).toString('base64url');
      settings = next; saveSettings();
      return settings;
    },
    safeSettings: () => ({ ...settings, ga4ApiSecret: settings.ga4ApiSecret ? '••••••••' : '' }),
    links, cleanLink, ensureLink, syncFrom, updateLinkDestination, detectNetwork,
    saveLinks: (list) => writeArray(files.links, list),
    recordClick, recordView, clicks: () => clicks,
    transactions, upsertTransaction, sendToGa, parseCsv, normalizeStatus, report, toCsv,
  };
}

module.exports = { create, NETWORKS, CTA_POSITIONS };
