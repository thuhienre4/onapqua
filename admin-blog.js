const $ = (selector) => document.querySelector(selector);
let posts = [];
const fields = ['source-url', 'title', 'slug', 'brand', 'category', 'author', 'affiliate-url', 'cta-label', 'rating', 'price', 'pros', 'cons', 'image', 'excerpt', 'content', 'seo-title', 'meta-description', 'featured', 'published'];
const keyFor = (id) => id.replace(/-([a-z])/g, (_, character) => character.toUpperCase());

function value(id) {
  const element = $('#' + id);
  return element.type === 'checkbox' ? element.checked : element.value.trim();
}

function escapeHtml(input) {
  return String(input || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function notice(message, error = false) {
  $('#notice').textContent = message;
  $('#notice').className = 'notice' + (error ? ' error' : '');
}

// Live Google-style preview with the same fallbacks the server uses.
function updateSeo() {
  const title = value('seo-title') || `${value('title') || 'Review title'} | onapqua.`;
  const description = value('meta-description') || value('excerpt') || 'Your meta description appears here.';
  const slugText = value('slug') || value('title').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || '…';
  $('#serp-title').textContent = title;
  $('#serp-desc').textContent = description;
  $('#serp-url').textContent = `www.onapqua.com › review › ${slugText}`;
  document.querySelectorAll('[data-count-for]').forEach((counter) => {
    const length = (counter.dataset.countFor === 'seo-title' ? title : description).length;
    const ideal = Number(counter.dataset.ideal);
    counter.textContent = `${length} / ~${ideal} characters${length > ideal ? ' (may be cut off in Google)' : ''}`;
    counter.className = `count ${length > ideal ? 'warn' : 'ok'}`;
  });
}

['seo-title', 'meta-description', 'title', 'slug', 'excerpt'].forEach((id) => $('#' + id).addEventListener('input', updateSeo));

function showPreview() {
  updateSeo();
  const url = $('#image').value.trim();
  $('#preview').src = url;
  $('#preview').style.display = url ? 'block' : 'none';
}

function resetForm() {
  const form = $('#post-form');
  HTMLFormElement.prototype.reset.call(form);
  $('#post-id').value = '';
  $('#category').value = 'Reviews';
  $('#form-title').textContent = 'New review';
  showPreview();
  notice('');
}

function fill(post) {
  $('#post-id').value = post.id || '';
  fields.forEach((id) => {
    const current = post[keyFor(id)];
    const element = $('#' + id);
    if (element.type === 'checkbox') element.checked = Boolean(current);
    else element.value = Array.isArray(current) ? current.join('\n') : (current ?? '');
  });
  if (!post.rating) $('#rating').value = '';
  $('#form-title').textContent = 'Edit review';
  showPreview();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function render() {
  const root = $('#posts');
  $('#category-list').innerHTML = [...new Set(posts.map((post) => post.category).filter(Boolean))]
    .map((category) => `<option value="${escapeHtml(category)}"></option>`).join('');
  if (!posts.length) {
    root.innerHTML = '<div class="empty">No reviews yet. Write your first one!</div>';
    return;
  }
  root.innerHTML = posts.map((post) => `<article class="post">
    <div class="post-head"><div><h3>${escapeHtml(post.title)}</h3><div class="muted meta">${escapeHtml(post.brand || post.category || 'Review')}${post.rating ? ` · ★ ${post.rating}` : ''} · ${post.affiliateUrl ? `${Number(post.clicks || 0)} click${Number(post.clicks) === 1 ? '' : 's'}` : 'no affiliate link'}</div></div><span class="tag${post.published ? ' live' : ''}">${post.published ? 'Published' : 'Draft'}</span></div>
    <div class="actions"><button type="button" data-edit="${escapeHtml(post.id)}">Edit</button>${post.published ? `<a class="button secondary" href="/review/${encodeURIComponent(post.slug)}" target="_blank" rel="noopener">View</a>` : ''}<button class="secondary danger" type="button" data-delete="${escapeHtml(post.id)}">Delete</button></div>
  </article>`).join('');
}

async function load() {
  posts = await api('/api/admin/blog');
  render();
}

$('#extract').addEventListener('click', async () => {
  const sourceUrl = value('source-url');
  if (!sourceUrl) return notice('Enter an official page URL first.', true);
  $('#extract').disabled = true;
  notice('Reading the page and drafting a review...');
  try {
    const data = await api('/api/admin/blog/extract', { method: 'POST', body: JSON.stringify({ sourceUrl }) });
    ['title', 'slug', 'brand', 'image', 'excerpt', 'content'].forEach((id) => {
      if (data[id]) $('#' + id).value = data[id];
    });
    showPreview();
    notice(data.warning || 'Draft filled in. Add your own opinion, affiliate link and rating before publishing.', Boolean(data.warning));
  } catch (error) {
    notice(error.message, true);
  } finally {
    $('#extract').disabled = false;
  }
});

$('#image').addEventListener('input', showPreview);
$('#new-post').addEventListener('click', resetForm);
$('#post-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = $('#post-id').value;
  const payload = {};
  fields.forEach((field) => { payload[keyFor(field)] = value(field); });
  notice('Saving...');
  try {
    await api(id ? '/api/admin/blog/' + encodeURIComponent(id) : '/api/admin/blog', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(payload)
    });
    resetForm();
    await load();
    notice('Review saved.');
  } catch (error) {
    notice(error.message, true);
  }
});

$('#posts').addEventListener('click', async (event) => {
  const editId = event.target.dataset.edit;
  const deleteId = event.target.dataset.delete;
  if (editId) fill(posts.find((post) => post.id === editId));
  if (deleteId && confirm('Delete this review?')) {
    try {
      await api('/api/admin/blog/' + encodeURIComponent(deleteId), { method: 'DELETE' });
      await load();
    } catch (error) {
      notice(error.message, true);
    }
  }
});

(async () => {
  try {
    const session = await api('/api/admin/session');
    $('#admin-email').textContent = session.email || '';
    await load();
  } catch {
    location.href = '/admin';
  }
})();
