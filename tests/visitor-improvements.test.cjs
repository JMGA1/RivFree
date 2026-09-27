const {test}=require('node:test');const assert=require('node:assert/strict');const {JSDOM}=require('jsdom');const vm=require('node:vm');const fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function page(t,saved={}){
 const dom=new JSDOM(read('index.html'),{url:'https://rivfree.test/',runScripts:'outside-only',pretendToBeVisual:true});t.after(()=>dom.window.close());const w=dom.window,d=w.document,run=code=>vm.runInContext(code,dom.getInternalVMContext());
 w.matchMedia=()=>({matches:false,addEventListener(){}});w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};w.fetch=async()=>{throw Error('offline')};
 for(const [key,value] of Object.entries(saved))w.localStorage.setItem(key,value);
 for(const file of ['matching.js','catalog.js','catalog-cache.js','features.js','shared-list-codec.js','shopping.js','storefront.js','product-details.js','app.js'])run(read(file).replace(/initStorefront\(\);\s*loadData\(\);\s*$/,''));
 const now=new Date().toISOString(),old=new Date(Date.now()-10*86400000).toISOString();
 const products=[{nombre:'Dior Sauvage EDT 100ml',tienda:'DFA',url:'https://dfa.test/p',precio_usd:88,categoria:'perfumes',primera_deteccion:old,caida_precio:{porcentaje:12,precio_anterior:100,desde:old,hasta:now,ventana_dias:30}},{nombre:'Whisky Chivas 12 1L',tienda:'Yury',url:'https://yury.test/w',precio_usd:40,categoria:'bebidas',primera_deteccion:now},{nombre:'Chocolate Milka 100g',tienda:'Barão',url:'https://barao.test/c',precio_usd:5,categoria:'alimentos',creado:old}];
 run(`var prepared=prepareCatalog({productos:${JSON.stringify(products)}});ALL_PRODUCTS=prepared.products;PRODUCT_GROUPS=prepared.groups;indexFavoriteOffers();SEARCH_WORDS=prepared.words;STORE_INFO={DFA:{direccion:'Sarandí 100, Rivera'},Yury:{direccion:'Sarandí 200, Rivera'}};populateFilters();restoreFilters();render();`);
 return {w,d,run};
}
test('multiple categories use OR, survive URL restore and clear together',async t=>{
 const {d,run}=await page(t);run("chooseCategory('perfumes');chooseCategory('bebidas');render(true)");assert.equal(d.querySelectorAll('#grid .card').length,2);assert.equal(d.querySelectorAll('.category-chip').length,2);
 run("document.getElementById('categoria').value='';restoreFilters();render(true)");assert.equal(d.querySelectorAll('#grid .card').length,2);
 d.getElementById('clearCategory').click();run('render(true)');assert.equal(d.querySelectorAll('#grid .card').length,3);
});
test('new and price-drop order use observation metadata, with store-labelled badge',async t=>{
 const {d,run}=await page(t);run("document.getElementById('orden').value='caida';render(true)");assert.match(d.querySelector('#grid .card').textContent,/Dior/);assert.match(d.querySelector('.badge-price-drop').textContent,/12%.*DFA/);
 run("document.getElementById('orden').value='nuevos';render(true)");assert.match(d.querySelector('#grid .card').textContent,/Whisky/);
});
test('typing suggestions does not rerender grid; selection explicitly searches',async t=>{
 const {w,d,run}=await page(t);const first=d.querySelector('#grid .card');const search=d.getElementById('search');search.value='Dior';search.dispatchEvent(new w.Event('input'));await pause(250);
 assert.equal(d.querySelector('#grid .card'),first);assert.equal(run('ACTIVE_SEARCH'),'');assert.equal(d.querySelectorAll('#searchSuggestions [role=option]').length,1);
 d.querySelector('#searchSuggestions [role=option]').click();await pause(120);assert.equal(d.querySelectorAll('#grid .card').length,1);assert.equal(run('ACTIVE_SEARCH'),'Dior Sauvage EDT 100ml');
});
test('purchased state persists and routes contain unique shops in bounded segments',async t=>{
 const {w,d,run}=await page(t);run('for(const group of PRODUCT_GROUPS)favorites.add(group.key);persistShopping();renderShoppingList()');const check=d.querySelector('[data-purchased-key]');check.checked=true;check.dispatchEvent(new w.Event('change'));
 assert.equal(JSON.parse(w.localStorage.getItem('rivfree-purchased')).length,1);assert.equal(d.querySelectorAll('.shopping-row.purchased').length,1);assert.match(d.getElementById('shoppingRoute').textContent,/Barão/);
 const url=new URL(d.querySelector('.shopping-route-link').href);assert.ok(url.searchParams.get('waypoints').includes('DFA'));assert.ok(url.searchParams.get('destination').includes('Yury'));
 const parts=run("shoppingRouteSegments(['A','B','C','D','E','F','G'],4)");assert.equal(parts.length,2);assert.equal(new URL(parts[1].url).searchParams.get('origin'),'D');assert.equal(parts.flatMap(p=>p.stops).length,7);
 const next=await page(t,{'rivfree-favorites':w.localStorage.getItem('rivfree-favorites'),'rivfree-purchased':w.localStorage.getItem('rivfree-purchased')});next.run('renderShoppingList()');assert.equal(next.d.querySelectorAll('.shopping-row.purchased').length,1);
});
test('single product sharing uses one item and does not alter favorites',async t=>{
 const {w,d,run}=await page(t);let shared;Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async value=>{shared=value;}}});d.querySelector('#grid [data-action=share]').click();await pause(20);
 w.shared=shared;assert.equal(run('SharedListCodec.decodeCompact(new URL(shared).hash).size'),1);assert.equal(run('favorites.size'),0);
});
test('currency selection and manual rates stay isolated and persist',async t=>{
 const {w,d,run}=await page(t);run("automaticExchange={rates:{BRL:{rate:5,date:'2026-09-27'},UYU:{rate:40,date:'2026-09-27'},ARS:{rate:1400,date:'2026-09-27'}}};updateExchangeNote()");
 const select=d.getElementById('referenceCurrency');select.value='UYU';select.dispatchEvent(new w.Event('change'));assert.match(d.querySelector('.card-price-secondary').textContent,/UYU/);
 const input=d.getElementById('exchangeRate');input.value='42';input.dispatchEvent(new w.Event('change'));assert.equal(run('exchange.rate'),42);
 select.value='ARS';select.dispatchEvent(new w.Event('change'));assert.equal(run('exchange.rate'),1400);assert.match(d.getElementById('exchangeNote').textContent,/blue/);
 select.value='USD';select.dispatchEvent(new w.Event('change'));assert.equal(d.querySelector('.card-price-secondary'),null);assert.equal(w.localStorage.getItem('rivfree-currency'),'USD');
});
test('iOS guide is dismissible and absent in standalone mode',async t=>{
 const {w,d,run}=await page(t);Object.defineProperty(w.navigator,'userAgent',{value:'Mozilla/5.0 (iPhone) AppleWebKit Safari/604.1'});run('renderIOSInstallHint()');assert.ok(d.getElementById('iosInstallHint'));d.querySelector('#iosInstallHint button').click();run('renderIOSInstallHint()');assert.equal(d.getElementById('iosInstallHint'),null);
 w.localStorage.removeItem('rivfree-ios-install-dismissed');Object.defineProperty(w.navigator,'standalone',{value:true});run('renderIOSInstallHint()');assert.equal(d.getElementById('iosInstallHint'),null);
});

test('load more keeps existing cards and normal renders refresh them',async t=>{
 const {d,run}=await page(t);run('visibleLimit=1;render()');const first=d.querySelector('#grid .card');
 d.getElementById('loadMore').click();assert.equal(d.querySelectorAll('#grid .card').length,3);assert.equal(d.querySelector('#grid .card'),first);
 run('render()');assert.notEqual(d.querySelector('#grid .card'),first);
});
test('history fetches only unique URL buckets and retries failed requests',async t=>{
 const {w,run}=await page(t);Object.defineProperty(w.crypto,'subtle',{value:require('node:crypto').webcrypto.subtle});w.TextEncoder=TextEncoder;
 const url='https://shop.test/café',key=require('node:crypto').createHash('sha256').update(url).digest('hex').slice(0,2),calls=[];
 let fail=true;w.fetchWithTimeout=async path=>{calls.push(path);if(path.endsWith('index.json'))return {algorithm:'sha256-2',shards:{[key]:'v1'}};if(fail)throw Error('offline');return {[url]:[['2026-09-01',100]]};};
 w.historyOffers=[{url},{url}];await assert.rejects(run('historyForOffers(historyOffers)'));fail=false;
 const history=await run('historyForOffers(historyOffers)');assert.equal(history[url][0][1],100);await run('historyForOffers(historyOffers)');
 assert.equal(calls.length,3);assert.ok(calls.every(p=>!p.includes('price-history.json')));
});
test('vertical touch scroll never changes carousel campaign',async t=>{
 const {w,d,run}=await page(t);run('campaigns.hero=FALLBACK_HIGHLIGHTS.slice(0,2);renderCampaigns()');const root=d.getElementById('heroCampaign'),id=root.dataset.campaignId;
 root.ontouchstart({changedTouches:[{clientX:100,clientY:100}]});root.ontouchend({changedTouches:[{clientX:170,clientY:240}]});assert.equal(root.dataset.campaignId,id);
 root.ontouchstart({changedTouches:[{clientX:100,clientY:100}]});root.ontouchend({changedTouches:[{clientX:170,clientY:110}]});assert.notEqual(root.dataset.campaignId,id);
});
test('large carousel index yields and is reused across advances',async t=>{
 const {d,run}=await page(t);
 run('PRODUCT_GROUPS=Array.from({length:650},(_,i)=>({...PRODUCT_GROUPS[0],key:"large"+i}));campaigns.hero=[FALLBACK_HIGHLIGHTS[8],FALLBACK_HIGHLIGHTS[9]];renderCampaigns()');
 assert.equal(run('campaignIndex'),null,'large index must not block initial render');
 await pause(100);assert.equal(run('campaignIndex.byKey.size'),650);
 const index=run('campaignIndex');run('campaignPositions.hero=1;renderCampaigns()');assert.equal(run('campaignIndex'),index);
});

test('discovery arrows generate more, bound DOM, and restore earlier products',async t=>{
 const {w,d,run}=await page(t);
 run('PRODUCT_GROUPS=Array.from({length:45},(_,i)=>({...PRODUCT_GROUPS[0],key:"discovery"+i,name:"Product "+i}));renderDiscoverProducts()');
 const grid=d.getElementById('discoverGrid');
 Object.defineProperty(grid,'clientWidth',{get:()=>1000});Object.defineProperty(grid,'scrollWidth',{get:()=>grid.children.length*200});
 Object.defineProperty(w.HTMLElement.prototype,'offsetLeft',{configurable:true,get(){return this.parentElement===grid?[...grid.children].indexOf(this)*200:0;}});
 grid.style.gap='14px';grid.scrollTo=({left})=>{grid.scrollLeft=left;};w.HTMLElement.prototype.getBoundingClientRect=()=>({width:186});
 const initial=run('discoveryKeys.slice()');assert.equal(d.getElementById('shuffleDiscover'),null);assert.equal(d.getElementById('discoverPause'),null);
 d.getElementById('discoverNext').click();assert.equal(grid.children.length,10);assert.equal(grid.scrollLeft,200);
 for(let i=0;i<9;i++){grid.scrollLeft=grid.scrollWidth-grid.clientWidth;d.getElementById('discoverNext').click();}
 assert.ok(grid.children.length<=30);assert.equal(run('new Set(discoveryKeys).size'),45);assert.equal(d.getElementById('discoverNext').disabled,true);
 for(let i=0;i<4;i++){grid.scrollLeft=0;d.getElementById('discoverPrevious').click();}
 assert.equal(run('discoveryStart'),0);assert.deepEqual(run('discoveryKeys.slice(0,5)'),initial);
 grid.scrollLeft=0;run('updateDiscoveryArrows()');assert.equal(d.getElementById('discoverPrevious').disabled,true);
});
test('native discovery scroll extends the selection without refresh',async t=>{
 const {w,d,run}=await page(t);run('PRODUCT_GROUPS=Array.from({length:20},(_,i)=>({...PRODUCT_GROUPS[0],key:"swipe"+i}));renderDiscoverProducts()');
 const grid=d.getElementById('discoverGrid');Object.defineProperty(grid,'clientWidth',{get:()=>400});Object.defineProperty(grid,'scrollWidth',{get:()=>grid.children.length*200});
 const first=grid.firstElementChild;grid.scrollLeft=550;grid.dispatchEvent(new w.Event('scroll'));await pause(50);
 assert.equal(grid.children.length,10);assert.equal(grid.firstElementChild,first);
});
