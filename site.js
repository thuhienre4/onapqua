// Site-wide behaviour: mobile menu, header search, tabs, cookie consent and analytics.
// GA4 loads only when a Measurement ID is configured AND the visitor accepts analytics cookies.
(() => {
  const config = window.OQ_CONFIG || {};
  const getCookie = (name) => document.cookie.split('; ').find((part) => part.startsWith(`${name}=`))?.split('=').slice(1).join('=') || '';
  const setCookie = (name, value, maxAge) => { document.cookie = `${name}=${value}; Path=/; SameSite=Lax${maxAge ? `; Max-Age=${maxAge}` : ''}${location.protocol === 'https:' ? '; Secure' : ''}`; };
  const gpc = navigator.globalPrivacyControl === true;
  const consent = () => (gpc ? 'denied' : getCookie('oq_consent'));
  let gaReady = false;

  function loadGa() {
    if (gaReady || !config.ga4 || consent() !== 'granted') return;
    gaReady = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    window.gtag('js', new Date());
    window.gtag('config', config.ga4);
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(config.ga4)}`;
    document.head.append(script);
  }

  // First-party, session-only attribution (source / medium / campaign), stored only with consent.
  function rememberAttribution() {
    if (consent() !== 'granted' || getCookie('oq_attr')) return;
    const params = new URLSearchParams(location.search);
    let src = params.get('utm_source') || '';
    const med = params.get('utm_medium') || '';
    const camp = params.get('utm_campaign') || '';
    if (!src && document.referrer) { try { const host = new URL(document.referrer).hostname.replace(/^www\./, ''); if (host !== location.hostname.replace(/^www\./, '')) src = host; } catch { /* ignore */ } }
    const value = btoa(JSON.stringify({ src: src || 'direct', med, camp })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    setCookie('oq_attr', value);
  }

  // Analytics events are sent only when GA4 is active; otherwise this is a no-op.
  window.oqTrack = (name, params = {}) => { if (gaReady && window.gtag) window.gtag('event', name, { ...params, transport_type: 'beacon' }); };

  function showBanner() {
    if (document.querySelector('.cookie-banner')) return;
    const banner = document.createElement('div');
    banner.className = 'cookie-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Cookie preferences');
    banner.innerHTML = `<p>We use optional analytics cookies to understand which reviews and links are useful. Affiliate partners may set their own cookies when you visit them. <a href="/privacy.html#cookies">Learn more</a></p>
      <div><button type="button" data-consent="denied" class="cookie-reject">Reject</button><button type="button" data-consent="granted" class="cookie-accept">Accept analytics</button></div>`;
    banner.addEventListener('click', (event) => {
      const choice = event.target.closest('[data-consent]')?.dataset.consent;
      if (!choice) return;
      setCookie('oq_consent', choice, 31536000);
      if (choice === 'denied') { setCookie('oq_attr', '', 0); }
      banner.remove();
      if (choice === 'granted') { rememberAttribution(); loadGa(); }
    });
    document.body.append(banner);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('.site-header');
    const navToggle = document.querySelector('[data-nav-toggle]');
    const searchToggle = document.querySelector('[data-search-toggle]');
    const search = document.querySelector('#site-search');

    navToggle?.addEventListener('click', () => {
      const open = header.classList.toggle('nav-open');
      navToggle.setAttribute('aria-expanded', String(open));
    });
    searchToggle?.addEventListener('click', () => {
      search.hidden = !search.hidden;
      searchToggle.setAttribute('aria-expanded', String(!search.hidden));
      if (!search.hidden) search.querySelector('input')?.focus();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (search && !search.hidden) { search.hidden = true; searchToggle?.setAttribute('aria-expanded', 'false'); searchToggle?.focus(); }
      if (header?.classList.contains('nav-open')) { header.classList.remove('nav-open'); navToggle?.setAttribute('aria-expanded', 'false'); }
    });

    // Tabs: click or arrow keys switch panels.
    document.querySelectorAll('[role="tablist"]').forEach((list) => {
      const tabs = [...list.querySelectorAll('[role="tab"]')];
      const select = (tab) => {
        tabs.forEach((item) => {
          const active = item === tab;
          item.setAttribute('aria-selected', String(active));
          item.tabIndex = active ? 0 : -1;
          document.getElementById(item.getAttribute('aria-controls')).hidden = !active;
        });
        tab.focus();
      };
      tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => select(tab));
        tab.addEventListener('keydown', (event) => {
          if (event.key === 'ArrowRight') select(tabs[(index + 1) % tabs.length]);
          if (event.key === 'ArrowLeft') select(tabs[(index - 1 + tabs.length) % tabs.length]);
        });
      });
    });

    // Consent: banner until the visitor chooses; "Cookie settings" in the footer reopens it.
    if (!consent() && !gpc) showBanner();
    document.querySelectorAll('[data-cookie-settings]').forEach((link) => link.addEventListener('click', (event) => { event.preventDefault(); showBanner(); }));
    rememberAttribution();
    loadGa();
    if (location.pathname === '/best-software.html') window.oqTrack('comparison_view', { comparison_type: 'best_software' });

    // affiliate_click for every outbound /go/ link. In-content links get their CTA position here.
    document.addEventListener('click', (event) => {
      const link = event.target.closest('a[href*="/go/"]');
      if (!link) return;
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin) return;
      if (!url.searchParams.get('c')) { url.searchParams.set('c', link.closest('.rv-prose') ? 'in_content' : 'unknown'); link.href = url.pathname + url.search; }
      const review = window.__REVIEW__;
      const data = link.dataset;
      const coupon = Boolean(data.coupon);
      window.oqTrack(coupon ? 'coupon_click' : 'affiliate_click', {
        affiliate_id: data.aff || url.pathname.split('/').filter(Boolean).pop(),
        affiliate_network: data.affNetwork || '',
        merchant_name: data.affMerchant || data.product || '',
        product_name: data.product || '',
        product_category: data.category || '',
        article_id: review?.id || location.pathname,
        article_title: review?.title || document.title,
        article_url: location.pathname,
        cta_position: url.searchParams.get('c'),
        cta_text: link.textContent.replace(/\s+/g, ' ').replace(/[↗↗]/g, '').trim().slice(0, 100),
        destination_domain: data.affDomain || '',
        link_type: coupon ? 'coupon' : 'affiliate',
      });
    });
  });
})();
