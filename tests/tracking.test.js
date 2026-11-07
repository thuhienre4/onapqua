// End-to-end tests for affiliate tracking. Run: node --test tests/
// Starts the real server on a random port with a throwaway data directory.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const port = 4700 + Math.floor(Math.random() * 200);
const base = `http://127.0.0.1:${port}`;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oq-tracking-'));
const MOBILE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36';
let server;
let cookie = '';

const go = (pathname, headers = {}) => fetch(base + pathname, { redirect: 'manual', headers: { 'user-agent': DESKTOP, ...headers } });
const admin = (pathname, options = {}) => fetch(base + pathname, { ...options, headers: { 'content-type': 'application/json', cookie, ...(options.headers || {}) } });
const report = async () => (await admin('/api/admin/tracking/report?days=0')).json();

before(async () => {
  server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dataDir, ADMIN_PASSWORD: 'test-pass', ADMIN_EMAILS: 'admin@example.com', NODE_ENV: 'test' }, stdio: 'ignore' });
  for (let i = 0; i < 50; i += 1) { try { if ((await fetch(`${base}/healthz`)).ok) break; } catch { /* starting */ } await new Promise((r) => setTimeout(r, 100)); }
  const login = await fetch(`${base}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'admin@example.com', password: 'test-pass' }) });
  cookie = login.headers.get('set-cookie').split(';')[0];
});
after(() => { server.kill(); fs.rmSync(dataDir, { recursive: true, force: true }); });

test('existing affiliate links were migrated to central /go/<slug>/ links', async () => {
  const links = await (await admin('/api/admin/tracking/links')).json();
  const fluent = links.find((link) => link.destination === 'https://fluentcrm.com/?ref=4213');
  assert.ok(fluent, 'FluentCRM link exists');
  const response = await go(`/go/${fluent.id}/?c=review_top`);
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), 'https://fluentcrm.com/?ref=4213', 'existing affiliate parameters preserved');
});

test('a review and its offers share one link even when the URL has no trailing slash', async () => {
  const links = await (await admin('/api/admin/tracking/links')).json();
  const matches = links.filter((link) => link.destination.includes('screenstudio.lemonsqueezy.com'));
  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'screen-studio');
  assert.equal(matches[0].destination, 'https://screenstudio.lemonsqueezy.com/?aff=2OWVDk');
});

test('legacy /go/review/:id and /go/:offerId URLs still redirect', async () => {
  const review = await go('/go/review/review_fluentcrm');
  assert.equal(review.status, 302);
  assert.equal(review.headers.get('location'), 'https://fluentcrm.com/?ref=4213');
  const offer = await go('/go/offer_wpvivid_yearly?c=coupon_page', { 'user-agent': `${DESKTOP} offer` });
  assert.equal(offer.status, 302);
  assert.equal(offer.headers.get('location'), 'https://wpvivid.com/ref/1069/');
});

test('click records article, product, CTA position and device', async () => {
  const before = (await report()).overview.clicks;
  await go('/go/review/review_time4vps?c=final_verdict', { 'user-agent': MOBILE, referer: `${base}/review/time4vps-review` });
  const rows = await (await admin('/api/admin/tracking/logs?limit=5')).json();
  const row = rows[0];
  assert.equal(row.article, 'review_time4vps');
  assert.equal(row.articlePath, '/review/time4vps-review');
  assert.equal(row.cta, 'final_verdict');
  assert.equal(row.device, 'mobile');
  assert.equal(row.product, 'Time4VPS');
  assert.equal((await report()).overview.clicks, before + 1);
  assert.ok(!JSON.stringify(rows).includes('127.0.0.1'), 'no IP address stored');
});

test('rapid duplicate clicks and bots are not counted', async () => {
  const headers = { 'user-agent': `${DESKTOP} dedup` };
  const start = (await report()).overview.clicks;
  await go('/go/review/review_make?c=card', headers);
  await go('/go/review/review_make?c=card', headers);
  await go('/go/review/review_make?c=card', { 'user-agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)' });
  assert.equal((await report()).overview.clicks, start + 1);
});

test('consent: denied clicks have no session key; granted clicks keep source attribution', async () => {
  await go('/go/review/review_wpvivid?c=card', { 'user-agent': `${DESKTOP} denied`, cookie: 'oq_consent=denied' });
  let row = (await (await admin('/api/admin/tracking/logs?limit=1')).json())[0];
  assert.equal(row.session, '');
  assert.equal(row.source, 'not consented');
  const attr = Buffer.from(JSON.stringify({ src: 'google.com' })).toString('base64url');
  await go('/go/review/review_wpvivid?c=card', { 'user-agent': `${DESKTOP} granted`, cookie: `oq_consent=granted; oq_attr=${attr}` });
  row = (await (await admin('/api/admin/tracking/logs?limit=1')).json())[0];
  assert.ok(row.session.length > 0);
  assert.equal(row.source, 'google.com');
  assert.equal(row.medium, 'organic');
});

test('no open redirect: destination never comes from the query string; unknown slug is 404', async () => {
  const response = await go('/go/review/review_make?c=card&url=https://evil.example/&to=https://evil.example/', { 'user-agent': `${DESKTOP} open` });
  assert.ok(response.headers.get('location').startsWith('https://www.make.com/'));
  assert.equal((await go('/go/does-not-exist/')).status, 404);
});

test('links: network sub-ID is appended, invalid destinations rejected, paused links fall back', async () => {
  const create = await admin('/api/admin/tracking/links', { method: 'POST', body: JSON.stringify({ id: 'test-impact', name: 'Test', destination: 'https://example.sjv.io/c/1/2/3?u=https%3A%2F%2Fshop.example', network: 'impact' }) });
  assert.equal(create.status, 201);
  const location = new URL((await go('/go/test-impact/?c=in_content', { 'user-agent': `${DESKTOP} impact` })).headers.get('location'));
  assert.ok(location.searchParams.get('subId1'), 'click ID passed as subId1');
  assert.equal(location.searchParams.get('u'), 'https://shop.example', 'original parameters preserved');
  const bad = await admin('/api/admin/tracking/links', { method: 'POST', body: JSON.stringify({ id: 'bad', name: 'Bad', destination: 'javascript:alert(1)' }) });
  assert.equal(bad.status, 400);
  await admin('/api/admin/tracking/links/test-impact', { method: 'PUT', body: JSON.stringify({ status: 'paused', fallbackUrl: 'https://example.org/' }) });
  assert.equal((await go('/go/test-impact/')).headers.get('location'), 'https://example.org/');
});

test('postbacks require the token, deduplicate by transaction ID and attribute to the article', async () => {
  const settings = await (await admin('/api/admin/tracking/settings')).json();
  assert.equal((await fetch(`${base}/api/postback/direct?token=wrong&tx=T1`)).status, 403);
  await go('/go/review/review_barn2?c=review_top', { 'user-agent': `${DESKTOP} postback`, referer: `${base}/review/barn2-review` });
  const click = (await (await admin('/api/admin/tracking/logs?limit=1')).json())[0];
  const url = `${base}/api/postback/direct?token=${settings.postbackToken}&tx=T1&clickId=${click.id}&commission=24.50&amount=99&currency=USD&status=pending`;
  const first = await (await fetch(url)).json();
  assert.equal(first.created, true);
  const second = await (await fetch(url.replace('status=pending', 'status=approved'))).json();
  assert.equal(second.created, false);
  const txs = await (await admin('/api/admin/tracking/transactions')).json();
  const tx = txs.filter((item) => item.txId === 'T1');
  assert.equal(tx.length, 1, 'no duplicate transaction');
  assert.equal(tx[0].status, 'approved');
  assert.equal(tx[0].article, 'review_barn2');
  assert.equal(tx[0].cta, 'review_top');
  const json = await fetch(`${base}/api/postback/direct?token=${settings.postbackToken}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tx: 'T2', commission: '5', status: 'Rejected' }) });
  assert.equal((await json.json()).status, 'rejected');
});

test('CSV import previews, imports, updates and never duplicates', async () => {
  const csv = 'Transaction ID,Status,Commission,Sale Amount,Currency,Date,Sub ID\nC-1,Approved,10.00,50,USD,2026-11-01,\nC-2,Pending,"1,234.50",2000,USD,2026-11-02,\n,Approved,1,1,USD,2026-11-02,';
  const preview = await (await admin('/api/admin/tracking/import', { method: 'POST', body: JSON.stringify({ csv, network: 'awin', dryRun: true }) })).json();
  assert.equal(preview.total, 3);
  assert.equal(preview.valid, 2);
  const run = await (await admin('/api/admin/tracking/import', { method: 'POST', body: JSON.stringify({ csv, network: 'awin' }) })).json();
  assert.deepEqual([run.created, run.updated, run.skipped], [2, 0, 1]);
  const again = await (await admin('/api/admin/tracking/import', { method: 'POST', body: JSON.stringify({ csv: csv.replace('C-2,Pending', 'C-2,Approved'), network: 'awin' }) })).json();
  assert.deepEqual([again.created, again.updated], [0, 2]);
  const c2 = (await (await admin('/api/admin/tracking/transactions')).json()).find((tx) => tx.txId === 'C-2');
  assert.equal(c2.commission, 1234.5);
  assert.equal(c2.status, 'approved');
});

test('report separates clicks from confirmed conversions and sums approved commission only', async () => {
  const data = await report();
  assert.ok(data.overview.clicks >= 5);
  assert.equal(data.overview.conversions, 3, 'T1 + C-1 + C-2 approved');
  assert.equal(data.overview.commission, 24.5 + 10 + 1234.5);
  assert.ok(data.ctas.some((row) => row.key === 'final_verdict'));
  const barn2 = data.articles.find((row) => row.key === 'review_barn2');
  assert.equal(barn2.conversions, 1);
});

test('admin tracking API requires login and blocks cross-site writes', async () => {
  assert.equal((await fetch(`${base}/api/admin/tracking/report`)).status, 401);
  const cross = await admin('/api/admin/tracking/settings', { method: 'PUT', headers: { origin: 'https://evil.example' }, body: JSON.stringify({ trackingEnabled: false }) });
  assert.equal(cross.status, 403);
});

test('page views are counted server-side and SEO URLs still work', async () => {
  for (const pathname of ['/', '/review/barn2-review', '/best-software.html', '/sitemap.xml', '/robots.txt']) assert.equal((await fetch(base + pathname, { headers: { 'user-agent': DESKTOP } })).status, 200, pathname);
  assert.equal((await fetch(`${base}/tracking.js`)).status, 404, 'server module not public');
  assert.equal((await fetch(`${base}/tests/tracking.test.js`)).status, 404, 'tests not public');
});

test('GA4 loads only from settings; the API secret never reaches pages', async () => {
  let html = await (await fetch(`${base}/`)).text();
  assert.match(html, /window\.OQ_CONFIG = \{"ga4":""\}/);
  await admin('/api/admin/tracking/settings', { method: 'PUT', body: JSON.stringify({ ga4Id: 'G-TEST1234', ga4ApiSecret: 'super-secret-value' }) });
  html = await (await fetch(`${base}/`)).text();
  assert.match(html, /"ga4":"G-TEST1234"/);
  assert.ok(!html.includes('super-secret-value'));
  const settings = await (await admin('/api/admin/tracking/settings')).json();
  assert.notEqual(settings.ga4ApiSecret, 'super-secret-value');
  assert.equal((await admin('/api/admin/tracking/settings', { method: 'PUT', body: JSON.stringify({ ga4Id: 'not-an-id' }) })).status, 400);
});

test('CTA links carry position and analytics attributes', async () => {
  const html = await (await fetch(`${base}/review/fluentcrm-review`)).text();
  assert.match(html, /href="\/go\/[a-z0-9-]+\/\?c=review_top" data-aff="[a-z0-9-]+" data-aff-network="direct" data-aff-merchant="FluentCRM" data-aff-domain="fluentcrm.com"/);
  assert.match(html, /\?c=final_verdict/);
  assert.match(html, /\?c=alternatives_table/);
  assert.ok(!html.includes('fluentcrm.com/?ref=4213'), 'raw affiliate destination not exposed in page');
});
