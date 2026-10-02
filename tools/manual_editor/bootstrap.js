
window.RIVFREE_STUDIO_HTML_BUILD='20261002-studio12';
// El Studio es una herramienta local: no debe quedar controlado por el Service Worker de la web.
if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistrations().then(list=>Promise.all(list.map(r=>r.unregister()))).catch(()=>{});
if ('caches' in window) caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('rivfree-shell-')).map(k=>caches.delete(k)))).catch(()=>{});
