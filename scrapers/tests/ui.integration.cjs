// DOM integration test: no real browser, Worker or service worker emulation.
const {JSDOM,VirtualConsole}=require('jsdom');
const {indexedDB}=require('fake-indexeddb');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const http=require('node:http');
const root=path.resolve(__dirname,'..');
const fixture={actualizado:'2026-09-17T00:00:00Z',resumen:[],productos:[
 {nombre:'JBL Flip 6 Negro',tienda:'DFA',categoria:'electronica',precio_usd:80,url:'https://example.com/a'},
 {nombre:'JBL Flip 6 Preto',tienda:"Yury's Free Shop",categoria:'electronica',precio_usd:90,url:'https://example.com/b'}
]};
(async()=>{
 const server=http.createServer((req,res)=>{
  if(req.url.startsWith('/data/products.json')){res.end(JSON.stringify(fixture));return;}
  if(req.url.startsWith('/data/meta.json')){res.end(JSON.stringify({version:'fixture-v1'}));return;}
  const filename=path.join(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!filename.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(filename,(error,data)=>{if(error)res.writeHead(404).end();else res.end(data);});
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}/`;
 let dom;
 try{
  const errors=[],calls=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));vc.on('error',e=>errors.push(String(e)));
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/<link[^>]*fonts.googleapis[^>]*>/g,'');
  dom=new JSDOM(html,{url:base+'?q=JBL',resources:'usable',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
   w.AbortController=AbortController;w.indexedDB=indexedDB;w.matchMedia=()=>({matches:false});
   w.fetch=async(url,options)=>{calls.push(String(url));return fetch(new URL(url,base),options);};
   w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  }});
  const w=dom.window,d=w.document;
  for(let i=0;i<200&&!d.querySelector('.card');i++)await new Promise(r=>setTimeout(r,100));
  assert.ok(d.querySelector('.card'),'Catalog renders');assert.equal(d.querySelector('#search').value,'JBL');
  // Store UI must be text-only (no third-party logos), and store tags must not
  // be nested inside the product anchor/button, which could trigger two actions.
  assert.equal(d.querySelectorAll('.store-filter-chip img,.card-store img').length,0);
  const storeTag=d.querySelector('.card .card-store');
  assert.ok(storeTag,'Store tag renders');
  assert.equal(Boolean(storeTag.closest('.product-target')),false,'Store tag is independent from product action');
  storeTag.click();assert.equal(d.querySelector('#storeDialog').open,true,'Store tag opens only store information');d.querySelector('#storeDialogClose').click();
  d.querySelector('[data-action=favorite]').click();d.querySelector('#favoritesOnly').checked=true;d.querySelector('#favoritesOnly').dispatchEvent(new w.Event('change'));
  assert.equal(d.querySelectorAll('.card').length,1);assert.ok(w.location.search.includes('favorites=1'));
  d.querySelector('#openShoppingList').click();assert.ok(d.querySelector('#shoppingList').textContent.includes('Subtotal'));d.querySelector('#closeShoppingList').click();
  d.querySelector('#exchangeRate').value='5.2';d.querySelector('#exchangeRate').dispatchEvent(new w.Event('change'));assert.ok(d.querySelector('.card-price').textContent.includes('R$'));
  const count=calls.filter(x=>x.includes('products.json')).length;await w.loadData();assert.equal(calls.filter(x=>x.includes('products.json')).length,count);
  w.fetch=async()=>{throw Error('offline');};await w.loadData();assert.equal(d.querySelector('#connectionNote').hidden,false);
  assert.deepEqual(errors,[]);console.log('DOM: filters, favorites, shopping list, BRL, IndexedDB reuse and offline fallback passed.');
 }finally{dom?.window.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
