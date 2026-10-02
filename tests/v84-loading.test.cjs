const {test}=require('node:test'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom'),fs=require('fs'),vm=require('vm');
function page(t){
 const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{url:'https://rivfree.test/',runScripts:'outside-only',pretendToBeVisual:true});t.after(()=>dom.window.close());
 const w=dom.window;w.matchMedia=()=>({matches:false,addEventListener(){}});w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.fetch=async()=>{throw Error('offline');};
 const run=code=>vm.runInContext(code,dom.getInternalVMContext());
 for(const file of ['matching.js','catalog.js','catalog-cache.js','features.js','shared-list-codec.js','shopping.js','storefront.js','product-details.js','app.js'])run(fs.readFileSync(file,'utf8').replace(/initStorefront\(\);\s*loadData\(\);\s*$/,''));
 return {w,run};
}
test('offline directory preserves manual store contacts and photo visibility',async t=>{
 const {w,run}=page(t);w.localStorage.setItem('rivfree-store-directory',JSON.stringify({base:{DFA:{direccion:'base'}},manual:{DFA:{direccion:'manual',ocultar_fotos:true}}}));
 const info=await run('loadStoreInfoFiles()');assert.equal(info.DFA.direccion,'manual');assert.equal(info.DFA.ocultar_fotos,true);
 w.fetch=async url=>({ok:true,json:async()=>String(url).includes('manual-stores')?{tiendas:{}}:{DFA:{direccion:'nueva'}}});
 assert.equal((await run('loadStoreInfoFiles()')).DFA.direccion,'nueva','valid empty manual document removes old overrides');
});
test('catalog renders while rates and directory are pending; directory does not erase typed search',async t=>{
 const {w,run}=page(t);let stores;
 w.loadStoreInfoFiles=()=>new Promise(resolve=>stores=resolve);
 w.fetchWithTimeout=()=>new Promise(()=>{});
 run("loadCatalog=async()=>({data:{},prepared:prepareCatalog({productos:[{nombre:'JBL Flip 6',tienda:'DFA',url:'https://example.com/p',precio_usd:100}]}),offline:false});refreshLiveRates=()=>{};");
 await run('loadData()');assert.equal(run('ALL_PRODUCTS.length'),1);assert.equal(w.document.getElementById('loadError').hidden,true);
 w.document.getElementById('search').value='escribiendo';stores({DFA:{direccion:'calle'}});await new Promise(r=>setImmediate(r));
 assert.equal(w.document.getElementById('search').value,'escribiendo');
});
