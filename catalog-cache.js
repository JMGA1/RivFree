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
async function fetchWithTimeout(url,options={},timeout=30000) {
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeout);
 try {const response=await fetch(url,{...options,signal:controller.signal});if(!response.ok)throw new Error(`HTTP ${response.status}`);return await response.json();}
 finally {clearTimeout(timer);}
}
async function fetchOptionalJson(url,fallback) {
 try {return await fetchWithTimeout(url,{cache:'no-store'});} catch {return fallback;}
}
function validManualCatalog(value){return value&&Array.isArray(value.productos);}
function manualVersion(value){return String(value?.version||value?.actualizado||'empty');}
// Studio corrections to store products; without any, the cache key stays as before.
function correctionsUsable(value){return !!value&&typeof value==='object'&&!!value.correcciones&&typeof value.correcciones==='object'&&!Array.isArray(value.correcciones);}
function correctionsSuffix(value){return correctionsUsable(value)&&Object.keys(value.correcciones).length?'|fix:'+String(value.version||value.actualizado||Object.keys(value.correcciones).length):'';}
function validStoreVersions(value){return !!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length>0&&Object.values(value).every(v=>typeof v==='string'&&v);}
function storeSignature(versions){return 'stores:'+Object.entries(versions||{}).sort(([a],[b])=>a.localeCompare(b)).map(([slug,version])=>`${slug}=${version}`).join(';');}
function catalogFromPartitions(storeData,meta={}){
 return {
  actualizado:meta.actualizado||null,
  resumen:Array.isArray(meta.resumen)?meta.resumen:[],
  productos:Object.keys(storeData||{}).sort().flatMap(slug=>Array.isArray(storeData[slug])?storeData[slug]:[])
 };
}
function combineCatalogData(scraped,manual,corrections){
 if(typeof mergeCatalogData==='function')return mergeCatalogData(scraped,manual,corrections);
 const base=scraped&&Array.isArray(scraped.productos)?scraped:{productos:[]};
 const manualProducts=validManualCatalog(manual)?manual.productos.filter(p=>p&&p.activo!==false).map(p=>({...p,manual:true})):[];
 return {...base,productos:[...(base.productos||[]),...manualProducts],manual_actualizado:manual?.actualizado||null};
}
// Bump when matching, normalization, manual-catalog merging, or the prepared shape changes.
const PREPARED_CATALOG_VERSION='20261001-v51-brands';
function validPrepared(value){
 return value && Array.isArray(value.products) && Array.isArray(value.groups) &&
  Array.isArray(value.words) && value.legacyKeys && typeof value.legacyKeys==='object';
}
async function loadStorePartitions(meta,cached){
 const currentVersions=meta.stores;
 const oldData=cached?.partitioned&&cached.storeData&&typeof cached.storeData==='object'?cached.storeData:{};
 const oldVersions=cached?.partitioned&&cached.storeVersions&&typeof cached.storeVersions==='object'?cached.storeVersions:{};
 const storeData={},effectiveVersions={};let offline=false;
 const entries=Object.entries(currentVersions).sort(([a],[b])=>a.localeCompare(b));
 const results=await Promise.allSettled(entries.map(async ([slug,version])=>{
  if(oldVersions[slug]===version&&Array.isArray(oldData[slug]))return oldData[slug];
  const part=await fetchWithTimeout(`data/products/${encodeURIComponent(slug)}.json?v=${encodeURIComponent(version)}`);
  if(!Array.isArray(part))throw new Error('Invalid store catalog');
  return part;
 }));
 results.forEach((result,i)=>{
  const [slug,version]=entries[i];
  if(result.status==='fulfilled'){storeData[slug]=result.value;effectiveVersions[slug]=version;}
  else if(Array.isArray(oldData[slug])){storeData[slug]=oldData[slug];effectiveVersions[slug]=oldVersions[slug]||`cached-${slug}`;offline=true;}
  else throw result.reason;
 });
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
function preparedSnapshot(cached){
 if(cached?.preparedVersion!==PREPARED_CATALOG_VERSION||!validPrepared(cached.prepared))return null;
 const meta=cached.partitioned?cached.scrapedMeta:(cached.scrapedData||cached.data);
 if(!meta)return null;
 return {version:cached.version,data:{actualizado:meta.actualizado,resumen:meta.resumen||[],manualActualizado:cached.manualData?.actualizado||null},prepared:cached.prepared,offline:false,refreshing:true};
}
async function loadCatalogLocally(onCached) {
 const manualRequest=fetchOptionalJson('data/manual-products.json',null);
 const correctionsRequest=fetchOptionalJson('data/product-corrections.json',null);
 const metaRequest=fetchWithTimeout('data/meta.json',{cache:'no-store'}).then(value=>({value}),error=>({error}));
 let cached;try {cached=await cachedCatalog();}catch{}
 const snapshot=preparedSnapshot(cached);if(snapshot&&onCached)onCached(snapshot);
 const emptyManual={version:'empty',actualizado:null,productos:[]};
 let manualData=await manualRequest;
 if(!validManualCatalog(manualData))manualData=validManualCatalog(cached?.manualData)?cached.manualData:emptyManual;
 let corrections=await correctionsRequest;
 if(!correctionsUsable(corrections))corrections=correctionsUsable(cached?.corrections)?cached.corrections:null;

 let scrapedData,scrapedVersion,offline=false,partitioned=false,storeData=null,storeVersions=null,scrapedMeta=null;
 try {
  const result=await metaRequest;if(result.error)throw result.error;const meta=result.value;
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

 const data=combineCatalogData(scrapedData,manualData,corrections);
 const version=`${scrapedVersion||'unversioned'}|manual:${manualVersion(manualData)}${correctionsSuffix(corrections)}`;
 const reuse=cached?.version===version&&cached.preparedVersion===PREPARED_CATALOG_VERSION&&validPrepared(cached.prepared);
 const prepared=reuse?cached.prepared:prepareCatalog(data);
 if(!reuse||cached?.data||JSON.stringify(cached?.scrapedMeta)!==JSON.stringify(scrapedMeta)){
  const entry={version,scrapedVersion,manualData,corrections,preparedVersion:PREPARED_CATALOG_VERSION,prepared,partitioned};
  if(partitioned){entry.storeData=storeData;entry.storeVersions=storeVersions;entry.scrapedMeta=scrapedMeta;}
  else entry.scrapedData=scrapedData;
  try {await cachedCatalog(entry);}catch{}
 }
 return {version,data:{actualizado:data.actualizado,resumen:data.resumen,manualActualizado:manualData.actualizado||null},prepared,offline};
}
function loadCatalogWithoutWorker(onRefresh,preferCache=true){
 return new Promise((resolve,reject)=>{
  let initial;
  loadCatalogLocally(preferCache?snapshot=>{initial=snapshot;resolve(snapshot);}:null).then(result=>{
   if(initial)onRefresh({changed:result.version!==initial.version,offline:result.offline,data:result.data});else resolve(result);
  },error=>{if(initial)onRefresh({changed:false,offline:true});else reject(error);});
 });
}
async function loadCatalog(onRefresh=()=>{},preferCache=true) {
 if(typeof Worker==='undefined')return loadCatalogWithoutWorker(onRefresh,preferCache);
 try {return await new Promise((resolve,reject)=>{
  const worker=new Worker('catalog-worker.js?v=20261002-v84');let delivered=false;
  const timer=setTimeout(()=>{worker.terminate();if(delivered)onRefresh({changed:false,offline:true});else reject(Object.assign(new Error('Worker timeout'),{catalogFailure:true}));},70000);
  const products=[],groups=[],legacyKeys={};
  worker.onmessage=({data})=>{
   if(data?.part==='refresh'){clearTimeout(timer);worker.terminate();onRefresh(data);return;}
   if(data?.part==='products'){for(const p of data.items)products.push(p);return;}
   if(data?.part==='groups'){for(const g of data.items){g.offers=g.o.map(x=>typeof x==='number'?products[x]:x);delete g.o;groups.push(g);}return;}
   if(data?.part==='legacy'){for(const [key,value] of data.items)legacyKeys[key]=value;return;}
   if(data?.phase!=='cached'){clearTimeout(timer);worker.terminate();}
   if(data?.part==='done'){delivered=true;resolve({data:data.data,offline:data.offline,refreshing:data.phase==='cached',prepared:{products,groups,legacyKeys,words:data.words}});}
   else if(delivered)onRefresh({changed:false,offline:true});
   else data.error?reject(Object.assign(new Error(data.error),{catalogFailure:true})):resolve(data);
  };
  worker.onerror=()=>{clearTimeout(timer);worker.terminate();if(delivered)onRefresh({changed:false,offline:true});else reject(new Error('Worker failed'));};worker.postMessage({preferCache});
 });}catch(error){if(error.catalogFailure)throw error;return loadCatalogWithoutWorker(onRefresh,preferCache);}
}
if(typeof module!=='undefined') module.exports={fetchWithTimeout,fetchOptionalJson,manualVersion,validManualCatalog,validStoreVersions,storeSignature,catalogFromPartitions,correctionsSuffix};
