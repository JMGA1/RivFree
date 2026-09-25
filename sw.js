const CACHE='rivfree-shell-v22';
const SHELL=['./','index.html','styles.css','analytics.js','privacy-config.js','privacy.html','privacy.js','privacy.css','app.js','product-details.js','features.js','shopping.js','storefront.js','matching.js','catalog.js','catalog-cache.js','catalog-worker.js','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','data/stores.json','data/exchange.json','data/highlights.json','data/popular.json','icons/campaigns/beauty-compare-0.webp','icons/campaigns/beauty-perfumes-0.webp','icons/campaigns/beauty-selfcare-0.webp','icons/campaigns/beauty-skincare-0.webp','icons/campaigns/drinks-compare-0.webp','icons/campaigns/drinks-discover-0.webp','icons/campaigns/drinks-whisky-0.webp','icons/campaigns/drinks-wine-0.webp','icons/campaigns/food-chocolate-0.webp','icons/campaigns/food-discover-0.webp','icons/campaigns/food-gifts-0.webp','icons/campaigns/food-pantry-0.webp','icons/campaigns/smart-category-0.webp','icons/campaigns/smart-compare-0.webp','icons/campaigns/smart-multistore-0.webp','icons/campaigns/smart-offer-0.webp','icons/campaigns/tech-audio-0.webp','icons/campaigns/tech-computing-0.webp','icons/campaigns/tech-electronics-0.webp','icons/campaigns/tech-home-0.webp'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('rivfree-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==location.origin)return;
 const relative=url.pathname.slice(new URL(self.registration.scope).pathname.length);
 // Version checks and catalogs are owned by IndexedDB, never the shell cache.
 if(relative.startsWith('data/')&&!['data/stores.json','data/exchange.json','data/highlights.json','data/popular.json'].includes(relative))return;
 if(!SHELL.includes(relative)&&event.request.mode!=='navigate')return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  try {const response=await fetch(event.request);if(response.ok&&!url.search)await cache.put(event.request,response.clone());return response;}
  catch {return (await cache.match(event.request,{ignoreSearch:true}))||(event.request.mode==='navigate'?await cache.match('index.html'):null)||Response.error();}
 })());
});
