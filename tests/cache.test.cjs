const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../catalog-cache.js'),'utf8');
function env({cached=null,meta={version:'a'},catalog={productos:[]},manual={version:'empty',productos:[]},failMeta=false,failManual=false}={}){
 let stored=cached;const calls=[];
 const ctx=vm.createContext({AbortController,setTimeout,clearTimeout,prepareCatalog:data=>({count:data.productos.length,products:[],groups:[],words:[],legacyKeys:{}}),fetch:async url=>{
  calls.push(url);
  if(url.includes('manual-products.json')){if(failManual)throw Error('manual offline');return {ok:true,json:async()=>manual};}
  if(url.includes('meta.json')){if(failMeta)throw Error('offline');return {ok:true,json:async()=>meta};}
  return {ok:true,json:async()=>catalog};
 }});
 vm.runInContext(source,ctx);ctx.cachedCatalog=async value=>value?(stored=value):stored;
 return {ctx,calls,getStored:()=>stored};
}
test('unchanged scraped version reuses scraped data and only checks meta plus manual file',async()=>{
 const cached={version:'a|manual:empty',scrapedVersion:'a',scrapedData:{productos:[]},manualData:{version:'empty',productos:[]},preparedVersion:'20260924-manual1',prepared:{products:[],groups:[],words:[],legacyKeys:{}}};
 const e=env({cached});await e.ctx.loadCatalogLocally();
 assert.equal(e.calls.some(url=>url.includes('products.json?v=')),false);
 assert.equal(e.calls.some(url=>url.includes('meta.json')),true);
 assert.equal(e.calls.some(url=>url.includes('manual-products.json')),true);
});
test('new scraped version downloads catalog and persists combined version',async()=>{
 const e=env({cached:{version:'a|manual:empty',scrapedVersion:'a',scrapedData:{productos:[]}},meta:{version:'b'},catalog:{productos:[{}]}});
 const result=await e.ctx.loadCatalogLocally();
 assert.equal(e.calls.some(url=>url.includes('products.json?v=b')),true);
 assert.equal(e.getStored().scrapedVersion,'b');assert.equal(e.getStored().version,'b|manual:empty');assert.equal(result.prepared.count,1);
});
test('manual products are merged without changing products.json',async()=>{
 const e=env({cached:{version:'a|manual:old',scrapedVersion:'a',scrapedData:{productos:[{nombre:'base'}]}},manual:{version:'new',productos:[{nombre:'manual',activo:true},{nombre:'hidden',activo:false}]}});
 const result=await e.ctx.loadCatalogLocally();
 assert.equal(result.prepared.count,2);assert.equal(e.calls.some(url=>url.includes('products.json?v=')),false);assert.equal(e.getStored().version,'a|manual:new');
});
test('offline falls back to cached scraped and manual data',async()=>{
 const cached={version:'a|manual:m1',scrapedVersion:'a',scrapedData:{productos:[{}]},manualData:{version:'m1',productos:[{activo:true}]}};
 const e=env({cached,failMeta:true,failManual:true});const result=await e.ctx.loadCatalogLocally();assert.equal(result.offline,true);assert.equal(result.prepared.count,2);
});
test('invalid new catalog falls back to cached scraped data',async()=>{
 const cached={version:'a|manual:empty',scrapedVersion:'a',scrapedData:{productos:[{}]},manualData:{version:'empty',productos:[]}};
 const e=env({cached,meta:{version:'b'},catalog:{invalid:true}});const result=await e.ctx.loadCatalogLocally();assert.equal(result.offline,true);assert.equal(result.prepared.count,1);
});
test('prepared groups are reused when both versions match',async()=>{
 const prepared={products:[],groups:[],words:[],legacyKeys:{}};
 const cached={version:'a|manual:m1',scrapedVersion:'a',scrapedData:{productos:[]},manualData:{version:'m1',productos:[]},preparedVersion:'20260924-manual1',prepared};
 const e=env({cached,manual:{version:'m1',productos:[]}});e.ctx.prepareCatalog=()=>{throw Error('Matching must not run');};assert.equal((await e.ctx.loadCatalogLocally()).prepared,prepared);
});
test('engine revision invalidates prepared groups without redownloading scraped catalog',async()=>{
 const cached={version:'a|manual:m1',scrapedVersion:'a',scrapedData:{productos:[{}]},manualData:{version:'m1',productos:[]},preparedVersion:'old',prepared:{products:[],groups:[],words:[],legacyKeys:{}}};
 const e=env({cached,manual:{version:'m1',productos:[]}});assert.equal((await e.ctx.loadCatalogLocally()).prepared.count,1);assert.equal(e.calls.some(url=>url.includes('products.json?v=')),false);assert.equal(e.getStored().preparedVersion,'20260924-manual1');
});
