// IndexedDB keeps the complete response without localStorage's small quota.
function catalogDB() {
 return new Promise((resolve,reject)=>{
  const req=indexedDB.open('rivfree-catalog',1);
  req.onupgradeneeded=()=>req.result.createObjectStore('catalog');
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
 });
}
async function cachedCatalog(value) {
 const db=await catalogDB();
 try {return await new Promise((resolve,reject)=>{
  const tx=db.transaction('catalog',value?'readwrite':'readonly');
  const req=value?tx.objectStore('catalog').put(value,'current'):tx.objectStore('catalog').get('current');
  tx.oncomplete=()=>resolve(req.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
 });} finally {db.close();}
}
async function fetchWithTimeout(url,options={}) {
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),30000);
 try {const response=await fetch(url,{...options,signal:controller.signal});if(!response.ok)throw new Error(`HTTP ${response.status}`);return await response.json();}
 finally {clearTimeout(timer);}
}
async function loadCatalogLocally() {
 let cached;try {cached=await cachedCatalog();}catch{}
 let data,offline=false;
 try {
  const meta=await fetchWithTimeout('data/meta.json',{cache:'no-cache'});
  if(cached && cached.version===meta.version && Array.isArray(cached.data?.productos))data=cached.data;
  else {
   data=await fetchWithTimeout('data/products.json?v='+encodeURIComponent(meta.version),{cache:'no-cache'});
   if(!Array.isArray(data.productos))throw new Error('Invalid catalog');
   try {await cachedCatalog({version:meta.version,data});}catch{}
  }
 }catch(error){
  if(cached && Array.isArray(cached.data?.productos)){data=cached.data;offline=true;}
  else {data=await fetchWithTimeout('data/products.json',{cache:'no-cache'});if(!Array.isArray(data.productos))throw error;try{await cachedCatalog({version:null,data});}catch{}}
 }
 const prepared=prepareCatalog(data);
 return {data:{actualizado:data.actualizado,resumen:data.resumen},prepared,offline};
}
async function loadCatalog() {
 if(typeof Worker==='undefined')return loadCatalogLocally();
 try {return await new Promise((resolve,reject)=>{
  const worker=new Worker('catalog-worker.js');
  const timer=setTimeout(()=>{worker.terminate();reject(new Error('Worker timeout'));},70000);
  worker.onmessage=({data})=>{clearTimeout(timer);worker.terminate();data.error?reject(new Error(data.error)):resolve(data);};
  worker.onerror=()=>{clearTimeout(timer);worker.terminate();reject(new Error('Worker failed'));};worker.postMessage('load');
 });}catch{return loadCatalogLocally();}
}
