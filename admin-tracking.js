// Affiliate tracking dashboard: reports, link management, transactions, imports and settings.
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
let meta = { networks: {}, ctas: {} };
let report = null;
let links = [];
let transactions = [];

async function api(url, options = {}) {
  const response = await fetch(url, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
const notice = (id, message, error = false) => { const node = $(id); node.textContent = message; node.className = `notice${error ? ' error' : ''}`; };
const money = (value, currency = report?.currency || 'USD') => `${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

// Sortable table: columns = [key, label, numeric?, format?]
function table(root, rows, columns, sortKey = columns.find((column) => column[2])?.[0]) {
  let key = sortKey;
  let direction = -1;
  const paint = () => {
    const sorted = [...rows].sort((a, b) => (typeof a[key] === 'number' ? (a[key] - b[key]) : String(a[key]).localeCompare(String(b[key]))) * direction);
    root.innerHTML = rows.length ? `<table><thead><tr>${columns.map(([k, label, numeric]) => `<th data-key="${k}" class="${numeric ? 'num' : ''}${k === key ? ' sorted' : ''}">${label}${k === key ? (direction < 0 ? ' ↓' : ' ↑') : ''}</th>`).join('')}</tr></thead>
      <tbody>${sorted.map((row) => `<tr>${columns.map(([k, , numeric, format]) => `<td class="${numeric ? 'num' : ''}">${format ? format(row[k], row) : escapeHtml(row[k])}</td>`).join('')}</tr>`).join('')}</tbody></table>`
      : '<p class="muted">No data for this period yet.</p>';
  };
  root.onclick = (event) => { const th = event.target.closest('th[data-key]'); if (!th) return; direction = th.dataset.key === key ? -direction : -1; key = th.dataset.key; paint(); };
  paint();
}

const perf = (labelHeader, extra = []) => [['label', labelHeader], ...extra, ['clicks', 'Clicks', true], ['unique', 'Unique', true], ['conversions', 'Conversions', true], ['rate', 'Conv. rate', true, (v) => `${v}%`], ['pending', 'Pending', true], ['commission', 'Commission', true, (v) => money(v)]];

async function loadReport() {
  report = await api(`/api/admin/tracking/report?days=${$('#days').value}`);
  const o = report.overview;
  const others = Object.entries(o.otherCurrencies).map(([currency, value]) => money(value, currency)).join(' + ');
  $('#metrics').innerHTML = [
    ['Affiliate clicks', o.clicks], ['Unique clicks', o.unique], ['Confirmed conversions', o.conversions, `${o.pending} pending`],
    ['Commissions', money(o.commission), others ? `+ ${others}` : 'approved only'], ['Conversion rate', `${o.rate}%`, 'approved ÷ clicks'],
    ['Average commission', money(o.average)], ['Confirmed sales', money(o.sales)], ['Rejected / reversed', o.rejected],
  ].map(([label, value, sub]) => `<div class="metric"><span>${label}</span><strong>${escapeHtml(value)}</strong>${sub ? `<small>${escapeHtml(sub)}</small>` : ''}</div>`).join('');
  table($('#top-products'), report.products.slice(0, 8), [['label', 'Product'], ['clicks', 'Clicks', true], ['conversions', 'Conv.', true], ['commission', 'Commission', true, (v) => money(v)]]);
  const max = Math.max(1, ...report.daily.map(([, count]) => count));
  $('#daily').innerHTML = report.daily.length ? `<table><tbody>${report.daily.slice(-31).map(([day, count]) => `<tr><td>${day}</td><td style="width:60%"><div class="bar"><i style="width:${(count / max) * 100}%"></i></div></td><td class="num">${count}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">No clicks yet.</p>';
  table($('#articles'), report.articles, [['label', 'Article'], ['views', 'Views', true], ['clicks', 'Affiliate clicks', true], ['unique', 'Unique', true], ['conversions', 'Conversions', true], ['commission', 'Revenue', true, (v) => money(v)]], 'clicks');
  table($('#products'), report.products.map((row) => ({ ...row, merchant: links.find((link) => link.id === row.key)?.merchant || '' })), perf('Product', [['merchant', 'Merchant']]));
  table($('#networks'), report.networks, perf('Network'));
  table($('#merchants'), report.merchants, perf('Merchant'));
  table($('#ctas'), report.ctas, perf('CTA position'), 'clicks');
  table($('#sources'), report.sources, [['label', 'Source / medium'], ['clicks', 'Clicks', true], ['conversions', 'Conversions', true], ['commission', 'Commission', true, (v) => money(v)]], 'clicks');
  table($('#devices'), report.devices, [['label', 'Device'], ['clicks', 'Clicks', true], ['conversions', 'Conversions', true], ['rate', 'Conv. rate', true, (v) => `${v}%`]], 'clicks');
}

function renderLinks() {
  table($('#links'), links, [
    ['id', 'Slug', false, (v) => `<a href="/go/${escapeHtml(v)}/?c=unknown" target="_blank" rel="noopener">/go/${escapeHtml(v)}/</a>`],
    ['merchant', 'Merchant'], ['network', 'Network', false, (v) => escapeHtml(meta.networks[v]?.label || v)],
    ['status', 'Status', false, (v, row) => `<span class="tag ${row.expiresAt && Date.parse(row.expiresAt) < Date.now() ? 'paused' : escapeHtml(v)}">${row.expiresAt && Date.parse(row.expiresAt) < Date.now() ? 'expired' : escapeHtml(v)}</span>`],
    ['id', '', false, (v) => `<button class="secondary small" data-edit-link="${escapeHtml(v)}">Edit</button> <button class="danger small" data-delete-link="${escapeHtml(v)}">Delete</button>`],
  ], 'id');
  $('#tx-link').innerHTML = `<option value="">— none —</option>${links.map((link) => `<option value="${escapeHtml(link.id)}">${escapeHtml(link.name)}</option>`).join('')}`;
}

function renderTransactions() {
  const status = $('#tx-status').value;
  table($('#transactions'), transactions.filter((tx) => !status || tx.status === status), [
    ['convertedAt', 'Date', false, (v) => escapeHtml(String(v).slice(0, 10))], ['txId', 'Transaction'], ['network', 'Network'], ['product', 'Product'],
    ['commission', 'Commission', true, (v, row) => money(v, row.currency)], ['status', 'Status', false, (v, row) => `<select data-tx-status="${escapeHtml(row.network)}|${escapeHtml(row.txId)}">${['pending', 'approved', 'rejected', 'reversed'].map((s) => `<option${s === v ? ' selected' : ''}>${s}</option>`).join('')}</select>`],
    ['source', 'Source'], ['txId', '', false, (v, row) => `<button class="danger small" data-delete-tx="${escapeHtml(row.network)}|${escapeHtml(v)}">Delete</button>`],
  ], 'convertedAt');
}

async function loadAll() {
  [links, transactions] = await Promise.all([api('/api/admin/tracking/links'), api('/api/admin/tracking/transactions')]);
  renderLinks();
  renderTransactions();
  await loadReport();
}

async function loadSettings() {
  const settings = await api('/api/admin/tracking/settings');
  const form = $('#settings-form');
  ['ga4Id', 'utmSource', 'utmMedium', 'currency', 'retentionDays', 'dedupSeconds'].forEach((name) => { form[name].value = settings[name] ?? ''; });
  form.trackingEnabled.checked = settings.trackingEnabled;
  form.appendUtm.checked = settings.appendUtm;
  form.ga4ApiSecret.placeholder = settings.ga4ApiSecret ? 'Saved (leave blank to keep)' : 'Not set';
  const base = `${meta.postbackBase}`;
  const templates = {
    impact: '?token=TOKEN&tx={ActionId}&clickId={SubId1}&commission={Payout}&amount={SaleAmount}&currency={Currency}&status={ActionStatus}',
    awin: '?token=TOKEN&tx=!!!transactionid!!!&clickId=!!!clickref!!!&commission=!!!commission!!!&amount=!!!amount!!!&currency=!!!currency!!!&status=!!!status!!!',
    cj: '?token=TOKEN&tx=[orderId]&clickId=[sid]&commission=[commission]&amount=[saleAmount]&currency=[currency]&status=[actionStatus]',
    shareasale: '?token=TOKEN&tx={transid}&clickId={afftrack}&commission={commission}&amount={amount}&status={status}',
    partnerstack: '  (POST JSON webhook) ?token=TOKEN with body { "tx": ..., "clickId": ..., "commission": ..., "status": ... }',
    direct: '?token=TOKEN&tx=ORDER_ID&clickId=SUBID&commission=AMOUNT&currency=USD&status=approved',
  };
  $('#postbacks').innerHTML = Object.entries(templates).map(([network, query]) => `<h3>${escapeHtml(meta.networks[network]?.label || network)}</h3><div class="code">${escapeHtml(`${base}${network}${query.replace('TOKEN', settings.postbackToken)}`)}</div>`).join('');
}

$('#tabs').addEventListener('click', (event) => {
  const button = event.target.closest('[data-tab]');
  if (!button) return;
  document.querySelectorAll('#tabs button').forEach((item) => item.classList.toggle('active', item === button));
  document.querySelectorAll('[data-view]').forEach((view) => view.classList.toggle('hidden', view.dataset.view !== button.dataset.tab));
  if (button.dataset.tab === 'settings') loadSettings();
  if (button.dataset.tab === 'logs') api('/api/admin/tracking/logs?limit=200').then((rows) => table($('#logs'), rows, [['ts', 'Time', false, (v) => escapeHtml(String(v).replace('T', ' ').slice(0, 19))], ['link', 'Link'], ['articleTitle', 'Article', false, (v, row) => escapeHtml(v || row.articlePath)], ['cta', 'CTA'], ['device', 'Device'], ['source', 'Source'], ['consent', 'Consent'], ['id', 'Click ID']], 'ts'));
});
$('#days').addEventListener('change', loadReport);
$('#tx-status').addEventListener('change', renderTransactions);

const linkForm = $('#link-form');
const resetLink = () => { linkForm.reset(); linkForm.editing.value = ''; linkForm.id.readOnly = false; $('#link-form-title').textContent = 'Add link'; notice('#link-notice', ''); };
$('#link-reset').addEventListener('click', resetLink);
linkForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(linkForm));
  const editing = payload.editing; delete payload.editing;
  try {
    await api(editing ? `/api/admin/tracking/links/${encodeURIComponent(editing)}` : '/api/admin/tracking/links', { method: editing ? 'PUT' : 'POST', body: JSON.stringify(payload) });
    links = await api('/api/admin/tracking/links'); renderLinks(); resetLink(); notice('#link-notice', 'Link saved.');
  } catch (error) { notice('#link-notice', error.message, true); }
});
$('#links').addEventListener('click', async (event) => {
  const edit = event.target.closest('[data-edit-link]')?.dataset.editLink;
  const remove = event.target.closest('[data-delete-link]')?.dataset.deleteLink;
  if (edit) {
    const link = links.find((item) => item.id === edit);
    ['id', 'name', 'merchant', 'product', 'destination', 'network', 'subIdParam', 'status', 'fallbackUrl', 'category'].forEach((name) => { linkForm[name].value = link[name] || ''; });
    linkForm.expiresAt.value = link.expiresAt ? link.expiresAt.slice(0, 10) : '';
    linkForm.editing.value = link.id; linkForm.id.readOnly = true; $('#link-form-title').textContent = `Edit /go/${link.id}/`;
  }
  if (remove && confirm(`Delete /go/${remove}/?`)) {
    try { await api(`/api/admin/tracking/links/${encodeURIComponent(remove)}`, { method: 'DELETE' }); links = await api('/api/admin/tracking/links'); renderLinks(); } catch (error) { alert(error.message); }
  }
});

$('#tx-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(event.target));
  if (payload.convertedAt) payload.convertedAt = new Date(payload.convertedAt).toISOString(); else delete payload.convertedAt;
  try { await api('/api/admin/tracking/transactions', { method: 'POST', body: JSON.stringify(payload) }); event.target.reset(); notice('#tx-notice', 'Transaction saved.'); await loadAll(); } catch (error) { notice('#tx-notice', error.message, true); }
});
$('#transactions').addEventListener('change', async (event) => {
  const select = event.target.closest('[data-tx-status]');
  if (!select) return;
  const [network, txId] = select.dataset.txStatus.split('|');
  try { await api(`/api/admin/tracking/transactions/${network}/${encodeURIComponent(txId)}`, { method: 'PUT', body: JSON.stringify({ status: select.value }) }); await loadAll(); } catch (error) { alert(error.message); }
});
$('#transactions').addEventListener('click', async (event) => {
  const remove = event.target.closest('[data-delete-tx]')?.dataset.deleteTx;
  if (!remove || !confirm('Delete this transaction?')) return;
  const [network, txId] = remove.split('|');
  try { await api(`/api/admin/tracking/transactions/${network}/${encodeURIComponent(txId)}`, { method: 'DELETE' }); await loadAll(); } catch (error) { alert(error.message); }
});

$('#import-file').addEventListener('change', async (event) => { const file = event.target.files[0]; if (file) $('#import-csv').value = await file.text(); });
async function runImport(dryRun) {
  try {
    const result = await api('/api/admin/tracking/import', { method: 'POST', body: JSON.stringify({ csv: $('#import-csv').value, network: $('#import-network').value, dryRun }) });
    if (dryRun) {
      notice('#import-notice', `${result.total} rows found, ${result.valid} with a transaction ID. Showing the first ${result.preview.length}.`);
      table($('#import-table'), result.preview, [['row', 'Row', true], ['txId', 'Transaction'], ['status', 'Status'], ['commission', 'Commission'], ['orderValue', 'Sale'], ['currency', 'Currency'], ['clickId', 'Click ID'], ['valid', 'OK', false, (v) => (v ? 'yes' : 'no ID')]], 'row');
    } else {
      notice('#import-notice', `Imported: ${result.created} new, ${result.updated} updated, ${result.skipped} skipped${result.errors.length ? `, ${result.errors.length} errors` : ''}.`, Boolean(result.errors.length));
      await loadAll();
    }
  } catch (error) { notice('#import-notice', error.message, true); }
}
$('#import-preview').addEventListener('click', () => runImport(true));
$('#import-run').addEventListener('click', () => { if (confirm('Import these transactions?')) runImport(false); });

$('#settings-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target;
  const payload = { trackingEnabled: form.trackingEnabled.checked, appendUtm: form.appendUtm.checked, ga4Id: form.ga4Id.value, utmSource: form.utmSource.value, utmMedium: form.utmMedium.value, currency: form.currency.value, retentionDays: form.retentionDays.value, dedupSeconds: form.dedupSeconds.value };
  if (form.ga4ApiSecret.value) payload.ga4ApiSecret = form.ga4ApiSecret.value;
  try { await api('/api/admin/tracking/settings', { method: 'PUT', body: JSON.stringify(payload) }); form.ga4ApiSecret.value = ''; notice('#settings-notice', 'Settings saved.'); loadSettings(); } catch (error) { notice('#settings-notice', error.message, true); }
});
$('#clear-secret').addEventListener('click', async () => { if (confirm('Remove the GA4 API secret?')) { await api('/api/admin/tracking/settings', { method: 'PUT', body: JSON.stringify({ clearApiSecret: true }) }); loadSettings(); } });
$('#rotate-token').addEventListener('click', async () => { if (confirm('Rotate the postback token? Update every network afterwards.')) { await api('/api/admin/tracking/settings', { method: 'PUT', body: JSON.stringify({ rotatePostbackToken: true }) }); loadSettings(); } });

(async () => {
  try {
    const session = await api('/api/admin/session');
    $('#admin-email').textContent = session.email || '';
    meta = await api('/api/admin/tracking/meta');
    const options = Object.entries(meta.networks).map(([key, value]) => `<option value="${key}">${escapeHtml(value.label)}</option>`).join('');
    $('#network-select').innerHTML = options; $('#tx-network').innerHTML = options; $('#import-network').innerHTML = options;
    await loadAll();
  } catch { location.href = '/admin'; }
})();
