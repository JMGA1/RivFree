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
// Bump when matching, normalization, or the prepared catalog shape changes.
const PREPARED_CATALOG_VERSION='20260924-1';
function validPrepared(value){
 return value && Array.isArray(value.products) && Array.isArray(value.groups) &&
  Array.isArray(value.words) && value.legacyKeys && typeof value.legacyKeys==='object';
}
async function loadCatalogLocally() {
 let cached;try {cached=await cachedCatalog();}catch{}
 let data,version,offline=false;
 try {
  const meta=await fetchWithTimeout('data/meta.json');
  if(typeof meta.version!=='string'||!meta.version)throw new Error('Invalid version');
  version=meta.version;
  if(cached && cached.version===version && Array.isArray(cached.data?.productos))data=cached.data;
  else {
   data=await fetchWithTimeout('data/products.json?v='+encodeURIComponent(version));
   if(!Array.isArray(data.productos))throw new Error('Invalid catalog');
  }
 }catch(error){
  if(cached && Array.isArray(cached.data?.productos)){data=cached.data;version=cached.version;offline=true;}
  else {data=await fetchWithTimeout('data/products.json');if(!Array.isArray(data.productos))throw error;version=null;}
 }
 const reuse=data===cached?.data && cached.preparedVersion===PREPARED_CATALOG_VERSION && validPrepared(cached.prepared);
 const prepared=reuse?cached.prepared:prepareCatalog(data);
 if(!reuse){try {await cachedCatalog({version,data,preparedVersion:PREPARED_CATALOG_VERSION,prepared});}catch{}}
 return {data:{actualizado:data.actualizado,resumen:data.resumen},prepared,offline};
}
async function loadCatalog() {
 if(typeof Worker==='undefined')return loadCatalogLocally();
 try {return await new Promise((resolve,reject)=>{
  const worker=new Worker('catalog-worker.js?v=20260924-1');
  const timer=setTimeout(()=>{worker.terminate();reject(new Error('Worker timeout'));},70000);
  worker.onmessage=({data})=>{clearTimeout(timer);worker.terminate();data.error?reject(new Error(data.error)):resolve(data);};
  worker.onerror=()=>{clearTimeout(timer);worker.terminate();reject(new Error('Worker failed'));};worker.postMessage('load');
 });}catch{return loadCatalogLocally();}
}
