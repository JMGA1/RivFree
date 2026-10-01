const CACHE='rivfree-shell-v50-v7';
const SHELL=['./','index.html','index-es.html','icons/favicon.svg','styles.css','experience.css','experience.js','explore.js','explore-model.js','explore.css','search-api-config.js','product-content.js','site-config.js','analytics.js','privacy-config.js','privacy.html','legal.js','consent.js','consent.css','tracking-config.js','ui-updates.js','ui-updates.css','mobile.css','mobile-shell.js','category-index.js','nav-bar.js','icons/flag-ar.svg','store-directory.js','store-directory.css','icons/social/whatsapp.svg','icons/social/instagram.svg','icons/social/facebook.svg','icons/social/telegram.svg','icons/social/googlemaps.svg','icons/social/tiktok.svg','icons/social/youtube.svg','icons/social/x.svg','icons/ui/globe.svg','icons/ui/phone.svg','icons/ui/mail.svg','icons/ui/map.svg','icons/ui/pin.svg','icons/ui/route.svg','cookies.html','terms.html','icons/flag-br.svg','icons/flag-uy.svg','privacy.css','app.js','product-details.js','features.js','shared-list-codec.js','shopping.js','storefront.js','matching.js','catalog.js','catalog-cache.js','catalog-worker.js','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','data/stores.json','data/exchange.json','data/highlights.json','data/popular.json','data/site-config.json','icons/campaigns/beauty-compare-0.webp','icons/campaigns/beauty-perfumes-0.webp','icons/campaigns/beauty-selfcare-0.webp','icons/campaigns/beauty-skincare-0.webp','icons/campaigns/drinks-compare-0.webp','icons/campaigns/drinks-discover-0.webp','icons/campaigns/drinks-whisky-0.webp','icons/campaigns/drinks-wine-0.webp','icons/campaigns/food-chocolate-0.webp','icons/campaigns/food-discover-0.webp','icons/campaigns/food-gifts-0.webp','icons/campaigns/food-pantry-0.webp','icons/campaigns/smart-category-0.webp','icons/campaigns/smart-compare-0.webp','icons/campaigns/smart-multistore-0.webp','icons/campaigns/smart-offer-0.webp','icons/campaigns/tech-audio-0.webp','icons/campaigns/tech-computing-0.webp','icons/campaigns/tech-electronics-0.webp','icons/campaigns/tech-home-0.webp'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('rivfree-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==location.origin)return;
 const relative=url.pathname.slice(new URL(self.registration.scope).pathname.length);
 if(relative.startsWith('tools/manual_editor/'))return;
 // Version checks and catalogs are owned by IndexedDB, never the shell cache.
 if(relative.startsWith('data/')&&!['data/stores.json','data/exchange.json','data/highlights.json','data/popular.json','data/site-config.json'].includes(relative))return;
 if(!SHELL.includes(relative)&&event.request.mode!=='navigate')return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  try {const response=await fetch(event.request);if(response.ok&&!url.search)await cache.put(event.request,response.clone());return response;}
  catch {return (await cache.match(event.request,{ignoreSearch:true}))||(event.request.mode==='navigate'?await cache.match(relative==='index-es.html'||relative.startsWith('es/')?'index-es.html':'index.html'):null)||Response.error();}
 })());
});
