const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../catalog-cache.js'),'utf8');
function env(cached,meta,catalog,fail=false){
 let stored=cached;const calls=[];
 const ctx=vm.createContext({AbortController,setTimeout,clearTimeout,prepareCatalog:data=>({count:data.productos.length}),fetch:async url=>{calls.push(url);if(fail)throw Error('offline');return {ok:true,json:async()=>url.includes('meta.json')?meta:catalog};}});
 vm.runInContext(source,ctx);ctx.cachedCatalog=async value=>value?(stored=value):stored;
 return {ctx,calls,getStored:()=>stored};
}
test('unchanged version only requests metadata',async()=>{const {ctx,calls}=env({version:'a',data:{productos:[]}}, {version:'a'});await ctx.loadCatalogLocally();assert.deepEqual(calls,['data/meta.json']);});
test('new version downloads and persists catalog',async()=>{const e=env({version:'a',data:{productos:[]}}, {version:'b'}, {productos:[{}]});const result=await e.ctx.loadCatalogLocally();assert.equal(e.calls.length,2);assert.equal(e.getStored().version,'b');assert.equal(result.prepared.count,1);});
test('offline falls back to the last complete catalog',async()=>{const e=env({version:'a',data:{productos:[{}]}},null,null,true);const result=await e.ctx.loadCatalogLocally();assert.equal(result.offline,true);assert.equal(result.prepared.count,1);});
test('invalid new catalog does not replace the saved version',async()=>{const e=env({version:'a',data:{productos:[{}]}},{version:'b'},{invalid:true});const result=await e.ctx.loadCatalogLocally();assert.equal(e.getStored().version,'a');assert.equal(result.offline,true);});
