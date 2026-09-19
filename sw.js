const CACHE='rivfree-shell-v7';
const SHELL=['./','index.html','styles.css','app.js','features.js','matching.js','catalog.js','catalog-cache.js','catalog-worker.js','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','data/stores.json','data/exchange.json'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('rivfree-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==location.origin)return;
 const relative=url.pathname.slice(new URL(self.registration.scope).pathname.length);
 // Version checks and catalogs are owned by IndexedDB, never the shell cache.
 if(relative.startsWith('data/')&&!['data/stores.json','data/exchange.json'].includes(relative))return;
 if(!SHELL.includes(relative)&&event.request.mode!=='navigate')return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  try {const response=await fetch(event.request);if(response.ok&&!url.search)await cache.put(event.request,response.clone());return response;}
  catch {return (await cache.match(event.request,{ignoreSearch:true}))||(event.request.mode==='navigate'?await cache.match('index.html'):null)||Response.error();}
 })());
});
