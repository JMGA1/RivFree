// RivFree analytics: privacy-first GA4 events + optional Microsoft Clarity.
// 1) Replace the placeholders below with your own IDs.
// 2) Keep the consent UI: analytics providers only load after the visitor accepts.
const RIVFREE_ANALYTICS_CONFIG = Object.freeze({
  googleMeasurementId: 'G-DQ9ZN0E47C',
  clarityProjectId: 'CLARITY_PROJECT_ID'
});

(() => {
  const CONSENT_KEY = 'rivfree-analytics-consent-v1';
  const gaId = String(RIVFREE_ANALYTICS_CONFIG.googleMeasurementId || '').trim();
  const clarityId = String(RIVFREE_ANALYTICS_CONFIG.clarityProjectId || '').trim();
  const hasGA = /^G-[A-Z0-9]{6,}$/i.test(gaId) && gaId !== 'G-XXXXXXXXXX';
  const hasClarity = /^[a-z0-9]{6,}$/i.test(clarityId) && clarityId !== 'CLARITY_PROJECT_ID';
  const configured = hasGA || hasClarity;
  const consentBox = document.getElementById('analyticsConsent');
  const acceptButton = document.getElementById('analyticsAccept');
  const rejectButton = document.getElementById('analyticsReject');
  const settingsButton = document.getElementById('privacySettings');
  let providersLoaded = false;
  if (!configured && settingsButton) settingsButton.hidden = true;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function(){ window.dataLayer.push(arguments); };
  window.gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied'
  });

  const safeText = value => String(value || '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/(?:\+?\d[\s().-]*){7,}/g, '[redacted-number]')
    .replace(/\s+/g, ' ').trim().slice(0, 100);
  const safeUrl = value => {
    try { const url = new URL(value, location.href); return `${url.origin}${url.pathname}`.slice(0, 180); } catch { return undefined; }
  };
  const gaEvent = (name, params = {}) => {
    if (!providersLoaded || !hasGA || savedConsent !== 'granted') return;
    const clean = {};
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') continue;
      clean[key] = typeof value === 'string' ? safeText(value) : value;
    }
    window.gtag('event', name, clean);
  };

  function loadGoogleAnalytics() {
    if (!hasGA || document.querySelector('script[data-rivfree-ga]')) return;
    window.gtag('consent', 'update', { analytics_storage: 'granted' });
    const script = document.createElement('script');
    script.async = true;
    script.dataset.rivfreeGa = 'true';
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
    document.head.appendChild(script);
    window.gtag('js', new Date());
    window.gtag('config', gaId, {
      send_page_view: true,
      allow_google_signals: false,
      allow_ad_personalization_signals: false
    });
  }

  function loadClarity() {
    if (!hasClarity || window.clarity || document.querySelector('script[data-rivfree-clarity]')) return;
    window.clarity = function(){ (window.clarity.q = window.clarity.q || []).push(arguments); };
    const script = document.createElement('script');
    script.async = true;
    script.dataset.rivfreeClarity = 'true';
    script.src = `https://www.clarity.ms/tag/${encodeURIComponent(clarityId)}`;
    document.head.appendChild(script);
  }

  function grantProviderConsent() {
    if (hasGA) window.gtag('consent', 'update', { analytics_storage: 'granted' });
    if (hasClarity && window.clarity) window.clarity('consentv2', {
      ad_Storage: 'denied',
      analytics_Storage: 'granted'
    });
  }

  function revokeProviderConsent() {
    if (hasGA) window.gtag('consent', 'update', { analytics_storage: 'denied' });
    if (hasClarity && window.clarity) {
      window.clarity('consentv2', { ad_Storage: 'denied', analytics_Storage: 'denied' });
      window.clarity('consent', false);
    }
  }

  function enableAnalytics() {
    if (!configured) return;
    if (!providersLoaded) {
      providersLoaded = true;
      loadGoogleAnalytics();
      loadClarity();
    }
    grantProviderConsent();
    if (consentBox) consentBox.hidden = true;
  }

  function setConsent(value) {
    savedConsent = value;
    try { localStorage.setItem(CONSENT_KEY, value); } catch {}
    if (value === 'granted') enableAnalytics();
    else {
      revokeProviderConsent();
      if (consentBox) consentBox.hidden = true;
    }
  }

  function showConsent() {
    if (!configured || !consentBox) return;
    consentBox.hidden = false;
  }

  acceptButton?.addEventListener('click', () => setConsent('granted'));
  rejectButton?.addEventListener('click', () => setConsent('denied'));
  settingsButton?.addEventListener('click', showConsent);

  let savedConsent = null;
  try { savedConsent = localStorage.getItem(CONSENT_KEY); } catch {}
  if (savedConsent === 'granted') enableAnalytics();
  else if (savedConsent !== 'denied') showConsent();

  window.RivFreeAnalytics = Object.freeze({
    event: gaEvent,
    configured,
    consent: () => savedConsent,
    showConsent
  });

  // High-value behavioral events. Event delegation keeps this independent from card rerenders.
  document.addEventListener('click', event => {
    const target = event.target.closest('button,a,[data-action]');
    if (!target) return;
    const card = target.closest('.card');
    const name = safeText(card?.querySelector('.card-name')?.textContent);
    const store = safeText(card?.querySelector('.card-store')?.textContent || target.dataset.storeName);
    const action = target.dataset.action;

    if (action === 'external') gaEvent('product_outbound', { product_name: name, store_name: store, link_url: safeUrl(target.href) });
    else if (action === 'compare') gaEvent('compare_product', { product_name: name, store_count: card?.querySelectorAll('.card-store').length || undefined });
    else if (action === 'favorite') gaEvent('favorite_product', { product_name: name, favorite_action: target.getAttribute('aria-pressed') === 'true' ? 'remove' : 'add' });
    else if (action === 'history') gaEvent('view_price_history', { product_name: name });
    else if (action === 'store' || target.classList.contains('offer-store')) gaEvent('view_store', { store_name: safeText(target.textContent || store) });

    if (target.matches('.offer-link')) gaEvent('comparison_outbound', { store_name: safeText(target.closest('.offer-row')?.querySelector('.offer-store')?.textContent), link_url: safeUrl(target.href) });
    if (target.matches('.campaign-cta')) { const campaign = target.closest('.campaign-carousel'); gaEvent('campaign_click', { campaign_id: campaign?.dataset.campaignId, campaign_group: campaign?.dataset.campaignGroup, campaign_type: campaign?.dataset.campaignType, campaign_name: safeText(campaign?.querySelector('h2,h3')?.textContent), link_url: safeUrl(target.href) || undefined }); }
    if (target.matches('#openShoppingList,#headerShoppingList')) gaEvent('open_shopping_list');
    if (target.matches('#shareShoppingList')) gaEvent('share_shopping_list');
    if (target.matches('#backToTop')) gaEvent('back_to_top');
    if (target.matches('#openStoreDirectory')) gaEvent('open_store_directory');
    if (target.matches('#navOffers')) gaEvent('quick_filter', { filter_name: 'offers' });
    if (target.matches('[data-category-shortcut]')) gaEvent('quick_filter', { filter_name: 'category', filter_value: target.dataset.categoryShortcut || 'all' });
  }, true);

  document.getElementById('searchForm')?.addEventListener('submit', () => {
    const term = safeText(document.getElementById('search')?.value);
    window.setTimeout(() => {
      const match = (document.getElementById('resultsMeta')?.textContent || '').match(/[\d.,]+/);
      const count = match ? Number(match[0].replace(/[.,](?=\d{3}(?:\D|$))/g, '').replace(',', '.')) : NaN;
      gaEvent('search', { search_term: term, results_count: Number.isFinite(count) ? count : undefined });
    }, 250);
  });

  document.addEventListener('change', event => {
    const el = event.target;
    if (!(el instanceof HTMLElement)) return;
    if (el.id === 'languageToggle') gaEvent('language_change', { language: el.value });
    else if (el.id === 'orden') gaEvent('sort_change', { sort_value: el.value });
    else if (el.id === 'categoria') gaEvent('filter_change', { filter_name: 'category', filter_value: el.value || 'all' });
    else if (el.id === 'soloOfertas') gaEvent('filter_change', { filter_name: 'offers', filter_value: el.checked ? 'on' : 'off' });
    else if (el.id === 'favoritesOnly') gaEvent('filter_change', { filter_name: 'favorites', filter_value: el.checked ? 'on' : 'off' });
    else if (el.classList.contains('storeChk')) gaEvent('filter_change', { filter_name: 'store', filter_value: el.value, enabled: el.checked });
    else if (el.id === 'minPrice' || el.id === 'maxPrice') gaEvent('filter_change', { filter_name: el.id, filter_value: el.value });
  });

  document.getElementById('themeToggle')?.addEventListener('click', () => {
    window.setTimeout(() => gaEvent('theme_change', { theme: document.documentElement.dataset.theme || 'light' }), 0);
  });

  const thresholds = [25, 50, 75, 90];
  const seen = new Set();
  window.addEventListener('scroll', () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (max <= 0) return;
    const percent = Math.round((window.scrollY / max) * 100);
    for (const threshold of thresholds) if (percent >= threshold && !seen.has(threshold)) {
      seen.add(threshold);
      gaEvent('scroll_depth', { percent_scrolled: threshold });
    }
  }, { passive: true });

  window.addEventListener('error', event => gaEvent('app_error', { error_type: 'javascript', message: safeText(event.message) }));
  window.addEventListener('unhandledrejection', event => gaEvent('app_error', { error_type: 'promise', message: safeText(event.reason?.message || event.reason) }));
})();
