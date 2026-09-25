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
async function fetchOptionalJson(url,fallback) {
 try {return await fetchWithTimeout(url,{cache:'no-store'});} catch {return fallback;}
}
function validManualCatalog(value){return value&&Array.isArray(value.productos);}
function manualVersion(value){return String(value?.version||value?.actualizado||'empty');}
function combineCatalogData(scraped,manual){
 if(typeof mergeCatalogData==='function')return mergeCatalogData(scraped,manual);
 const base=scraped&&Array.isArray(scraped.productos)?scraped:{productos:[]};
 const manualProducts=validManualCatalog(manual)?manual.productos.filter(p=>p&&p.activo!==false).map(p=>({...p,manual:true})):[];
 return {...base,productos:[...(base.productos||[]),...manualProducts],manual_actualizado:manual?.actualizado||null};
}
// Bump when matching, normalization, manual-catalog merging, or the prepared shape changes.
const PREPARED_CATALOG_VERSION='20260924-manual1';
function validPrepared(value){
 return value && Array.isArray(value.products) && Array.isArray(value.groups) &&
  Array.isArray(value.words) && value.legacyKeys && typeof value.legacyKeys==='object';
}
async function loadCatalogLocally() {
 let cached;try {cached=await cachedCatalog();}catch{}
 let scrapedData,scrapedVersion,offline=false;
 const emptyManual={version:'empty',actualizado:null,productos:[]};
 let manualData=await fetchOptionalJson('data/manual-products.json',null);
 if(!validManualCatalog(manualData))manualData=validManualCatalog(cached?.manualData)?cached.manualData:emptyManual;
 try {
  const meta=await fetchWithTimeout('data/meta.json');
  if(typeof meta.version!=='string'||!meta.version)throw new Error('Invalid version');
  scrapedVersion=meta.version;
  if(cached && cached.scrapedVersion===scrapedVersion && Array.isArray(cached.scrapedData?.productos))scrapedData=cached.scrapedData;
  else if(cached && !cached.scrapedVersion && cached.version===scrapedVersion && Array.isArray(cached.data?.productos))scrapedData=cached.data;
  else {
   scrapedData=await fetchWithTimeout('data/products.json?v='+encodeURIComponent(scrapedVersion));
   if(!Array.isArray(scrapedData.productos))throw new Error('Invalid catalog');
  }
 }catch(error){
  if(cached && Array.isArray(cached.scrapedData?.productos)){
   scrapedData=cached.scrapedData;scrapedVersion=cached.scrapedVersion||cached.version||null;offline=true;
  } else if(cached && Array.isArray(cached.data?.productos)){
   scrapedData=cached.data;scrapedVersion=cached.version||null;offline=true;
  } else {
   scrapedData=await fetchWithTimeout('data/products.json');if(!Array.isArray(scrapedData.productos))throw error;scrapedVersion=null;
  }
 }
 const data=combineCatalogData(scrapedData,manualData);
 const version=`${scrapedVersion||'unversioned'}|manual:${manualVersion(manualData)}`;
 const reuse=cached?.version===version && cached.preparedVersion===PREPARED_CATALOG_VERSION && validPrepared(cached.prepared);
 const prepared=reuse?cached.prepared:prepareCatalog(data);
 if(!reuse){try {await cachedCatalog({version,scrapedVersion,scrapedData,manualData,data,preparedVersion:PREPARED_CATALOG_VERSION,prepared});}catch{}}
 return {data:{actualizado:data.actualizado,resumen:data.resumen,manualActualizado:manualData.actualizado||null},prepared,offline};
}
async function loadCatalog() {
 if(typeof Worker==='undefined')return loadCatalogLocally();
 try {return await new Promise((resolve,reject)=>{
  const worker=new Worker('catalog-worker.js?v=20260924-manual1');
  const timer=setTimeout(()=>{worker.terminate();reject(new Error('Worker timeout'));},70000);
  worker.onmessage=({data})=>{clearTimeout(timer);worker.terminate();data.error?reject(new Error(data.error)):resolve(data);};
  worker.onerror=()=>{clearTimeout(timer);worker.terminate();reject(new Error('Worker failed'));};worker.postMessage('load');
 });}catch{return loadCatalogLocally();}
}
if(typeof module!=='undefined') module.exports={fetchWithTimeout,fetchOptionalJson,manualVersion,validManualCatalog};
