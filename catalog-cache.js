// IndexedDB keeps the prepared catalog without localStorage's small quota.
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
function validStoreVersions(value){return !!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length>0&&Object.values(value).every(v=>typeof v==='string'&&v);}
function storeSignature(versions){return 'stores:'+Object.entries(versions||{}).sort(([a],[b])=>a.localeCompare(b)).map(([slug,version])=>`${slug}=${version}`).join(';');}
function catalogFromPartitions(storeData,meta={}){
 return {
  actualizado:meta.actualizado||null,
  resumen:Array.isArray(meta.resumen)?meta.resumen:[],
  productos:Object.keys(storeData||{}).sort().flatMap(slug=>Array.isArray(storeData[slug])?storeData[slug]:[])
 };
}
function combineCatalogData(scraped,manual){
 if(typeof mergeCatalogData==='function')return mergeCatalogData(scraped,manual);
 const base=scraped&&Array.isArray(scraped.productos)?scraped:{productos:[]};
 const manualProducts=validManualCatalog(manual)?manual.productos.filter(p=>p&&p.activo!==false).map(p=>({...p,manual:true})):[];
 return {...base,productos:[...(base.productos||[]),...manualProducts],manual_actualizado:manual?.actualizado||null};
}
// Bump when matching, normalization, manual-catalog merging, or the prepared shape changes.
const PREPARED_CATALOG_VERSION='20260925-partitions1';
function validPrepared(value){
 return value && Array.isArray(value.products) && Array.isArray(value.groups) &&
  Array.isArray(value.words) && value.legacyKeys && typeof value.legacyKeys==='object';
}
async function loadStorePartitions(meta,cached){
 const currentVersions=meta.stores;
 const oldData=cached?.partitioned&&cached.storeData&&typeof cached.storeData==='object'?cached.storeData:{};
 const oldVersions=cached?.partitioned&&cached.storeVersions&&typeof cached.storeVersions==='object'?cached.storeVersions:{};
 const storeData={},effectiveVersions={};let offline=false;
 for(const [slug,version] of Object.entries(currentVersions).sort(([a],[b])=>a.localeCompare(b))){
  if(oldVersions[slug]===version&&Array.isArray(oldData[slug])){
   storeData[slug]=oldData[slug];effectiveVersions[slug]=version;continue;
  }
  try{
   const part=await fetchWithTimeout(`data/products/${encodeURIComponent(slug)}.json?v=${encodeURIComponent(version)}`);
   if(!Array.isArray(part))throw new Error('Invalid store catalog');
   storeData[slug]=part;effectiveVersions[slug]=version;
  }catch(error){
   if(Array.isArray(oldData[slug])){
    storeData[slug]=oldData[slug];effectiveVersions[slug]=oldVersions[slug]||`cached-${slug}`;offline=true;
   }else throw error;
  }
 }
 return {storeData,storeVersions:effectiveVersions,offline};
}
async function loadLegacyFullCatalog(meta,cached){
 const version=meta.version;
 if(cached&&!cached.partitioned&&cached.scrapedVersion===version&&Array.isArray(cached.scrapedData?.productos))return {scrapedData:cached.scrapedData,scrapedVersion:version,offline:false};
 if(cached&&!cached.partitioned&&!cached.scrapedVersion&&cached.version===version&&Array.isArray(cached.data?.productos))return {scrapedData:cached.data,scrapedVersion:version,offline:false};
 const scrapedData=await fetchWithTimeout('data/products.json?v='+encodeURIComponent(version));
 if(!Array.isArray(scrapedData.productos))throw new Error('Invalid catalog');
 return {scrapedData,scrapedVersion:version,offline:false};
}
async function loadCatalogLocally() {
 let cached;try {cached=await cachedCatalog();}catch{}
 const emptyManual={version:'empty',actualizado:null,productos:[]};
 let manualData=await fetchOptionalJson('data/manual-products.json',null);
 if(!validManualCatalog(manualData))manualData=validManualCatalog(cached?.manualData)?cached.manualData:emptyManual;

 let scrapedData,scrapedVersion,offline=false,partitioned=false,storeData=null,storeVersions=null,scrapedMeta=null;
 try {
  const meta=await fetchWithTimeout('data/meta.json',{cache:'no-store'});
  if(typeof meta.version!=='string'||!meta.version)throw new Error('Invalid version');
  if(validStoreVersions(meta.stores)){
   try{
    const loaded=await loadStorePartitions(meta,cached);
    partitioned=true;storeData=loaded.storeData;storeVersions=loaded.storeVersions;offline=loaded.offline;
    scrapedMeta={actualizado:meta.actualizado||null,resumen:Array.isArray(meta.resumen)?meta.resumen:[]};
    scrapedData=catalogFromPartitions(storeData,scrapedMeta);
    scrapedVersion=storeSignature(storeVersions);
   }catch(partitionError){
    // Compatibilidad/rescate: una publicación incompleta todavía puede usar products.json.
    const full=await loadLegacyFullCatalog(meta,cached);
    scrapedData=full.scrapedData;scrapedVersion=full.scrapedVersion;offline=full.offline;
   }
  }else{
   const full=await loadLegacyFullCatalog(meta,cached);
   scrapedData=full.scrapedData;scrapedVersion=full.scrapedVersion;offline=full.offline;
  }
 }catch(error){
  if(cached?.partitioned&&cached.storeData&&validStoreVersions(cached.storeVersions)){
   partitioned=true;storeData=cached.storeData;storeVersions=cached.storeVersions;scrapedMeta=cached.scrapedMeta||{};
   scrapedData=catalogFromPartitions(storeData,scrapedMeta);scrapedVersion=storeSignature(storeVersions);offline=true;
  }else if(cached&&Array.isArray(cached.scrapedData?.productos)){
   scrapedData=cached.scrapedData;scrapedVersion=cached.scrapedVersion||cached.version||null;offline=true;
  }else if(cached&&Array.isArray(cached.data?.productos)){
   scrapedData=cached.data;scrapedVersion=cached.version||null;offline=true;
  }else{
   scrapedData=await fetchWithTimeout('data/products.json');if(!Array.isArray(scrapedData.productos))throw error;scrapedVersion=null;offline=true;
  }
 }

 const data=combineCatalogData(scrapedData,manualData);
 const version=`${scrapedVersion||'unversioned'}|manual:${manualVersion(manualData)}`;
 const reuse=cached?.version===version&&cached.preparedVersion===PREPARED_CATALOG_VERSION&&validPrepared(cached.prepared);
 const prepared=reuse?cached.prepared:prepareCatalog(data);
 if(!reuse){
  const entry={version,scrapedVersion,manualData,data,preparedVersion:PREPARED_CATALOG_VERSION,prepared,partitioned};
  if(partitioned){entry.storeData=storeData;entry.storeVersions=storeVersions;entry.scrapedMeta=scrapedMeta;}
  else entry.scrapedData=scrapedData;
  try {await cachedCatalog(entry);}catch{}
 }
 return {data:{actualizado:data.actualizado,resumen:data.resumen,manualActualizado:manualData.actualizado||null},prepared,offline};
}
async function loadCatalog() {
 if(typeof Worker==='undefined')return loadCatalogLocally();
 try {return await new Promise((resolve,reject)=>{
  const worker=new Worker('catalog-worker.js?v=20260925-partitions1');
  const timer=setTimeout(()=>{worker.terminate();reject(new Error('Worker timeout'));},70000);
  worker.onmessage=({data})=>{clearTimeout(timer);worker.terminate();data.error?reject(new Error(data.error)):resolve(data);};
  worker.onerror=()=>{clearTimeout(timer);worker.terminate();reject(new Error('Worker failed'));};worker.postMessage('load');
 });}catch{return loadCatalogLocally();}
}
if(typeof module!=='undefined') module.exports={fetchWithTimeout,fetchOptionalJson,manualVersion,validManualCatalog,validStoreVersions,storeSignature,catalogFromPartitions};
