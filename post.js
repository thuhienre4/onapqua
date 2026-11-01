// The review itself is pre-rendered by the server; this adds related reviews
// and a sticky "check price" bar on small screens.
document.addEventListener('DOMContentLoaded', async () => {
  const { escapeHtml, card, goUrl, fetchPosts } = window.Reviews;
  const post = window.__REVIEW__;
  if (!post) return;

  if (post.hasLink) {
    const bar = document.createElement('div');
    bar.className = 'rv-sticky-cta';
    bar.innerHTML = `<div><strong>${escapeHtml(post.brand || post.title)}</strong>${post.rating ? `<span>&#9733; ${Number(post.rating).toFixed(1)} / 5</span>` : ''}</div><a class="rv-btn" href="${goUrl(post)}" target="_blank" rel="sponsored nofollow noopener">${escapeHtml(post.ctaLabel || 'Check price')} &#8599;</a>`;
    document.body.append(bar);
    const verdict = document.querySelector('.rv-final-cta') || document.querySelector('.rv-verdict');
    const lead = document.querySelector('.rv-article-head');
    const toggle = () => {
      const pastHead = lead ? lead.getBoundingClientRect().bottom < 0 : true;
      const atVerdict = verdict ? verdict.getBoundingClientRect().top < window.innerHeight : false;
      bar.classList.toggle('visible', pastHead && !atVerdict);
    };
    window.addEventListener('scroll', toggle, { passive: true });
    toggle();
  }

  const others = (await fetchPosts()).filter((item) => item.id !== post.id);
  const related = [...others.filter((item) => item.category === post.category), ...others.filter((item) => item.category !== post.category)].slice(0, 3);
  if (related.length) {
    document.querySelector('#related-reviews').innerHTML = related.map(card).join('');
    document.querySelector('.rv-related').hidden = false;
  }
});
