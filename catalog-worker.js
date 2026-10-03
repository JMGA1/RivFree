importScripts('matching.js?v=20261001-v5','category-index.js?v=20261001-v51','catalog.js?v=20261002-v84','catalog-cache.js?v=20261002-v84');
// The prepared catalog travels in parts: one huge message used to freeze the page while it was decoded.
function sendPrepared(result,phase){
 const prepared=result.prepared,index=new Map(prepared.products.map((p,i)=>[p,i]));
 for(let i=0;i<prepared.products.length;i+=4000)self.postMessage({part:'products',items:prepared.products.slice(i,i+4000)});
 const groups=prepared.groups.map(g=>{const {offers,...rest}=g;rest.o=offers.map(o=>{const i=index.get(o);return i===undefined?o:i;});return rest;});
 for(let i=0;i<groups.length;i+=5000)self.postMessage({part:'groups',items:groups.slice(i,i+5000)});
 const legacy=Object.entries(prepared.legacyKeys||{});
 for(let i=0;i<legacy.length;i+=10000)self.postMessage({part:'legacy',items:legacy.slice(i,i+10000)});
 self.postMessage({part:'done',phase,data:result.data,offline:result.offline,words:prepared.words});
}
self.onmessage=async({data:request})=>{try{
 let initial;
 const result=await loadCatalogLocally(request?.preferCache===false?null:snapshot=>{initial=snapshot;sendPrepared(snapshot,'cached');});
 if(initial)self.postMessage({part:'refresh',changed:result.version!==initial.version,offline:result.offline,data:result.data});
 else sendPrepared(result,'fresh');
}catch(e){self.postMessage({error:e.message});}};
