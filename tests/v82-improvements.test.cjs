const {test}=require('node:test');const assert=require('node:assert/strict');const {JSDOM}=require('jsdom');const vm=require('node:vm');const fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
const wait=ms=>new Promise(r=>setTimeout(r,ms));

async function site(t,{products,stores={},lang='es'}){
 const dom=new JSDOM(read('index.html'),{url:'https://rivfree.test/',runScripts:'outside-only',pretendToBeVisual:true});t.after(()=>dom.window.close());
 const w=dom.window,d=w.document,run=code=>vm.runInContext(code,dom.getInternalVMContext());
 w.matchMedia=()=>({matches:false,addEventListener(){}});w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.fetch=async()=>{throw Error('offline');};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.localStorage.setItem('rivfree-language',lang);
 for(const file of ['matching.js','catalog.js','catalog-cache.js','features.js','shared-list-codec.js','shopping.js','storefront.js','product-details.js','app.js','store-directory.js','experience.js','explore-model.js','category-index.js','explore.js','nav-bar.js'])run(read(file).replace(/initStorefront\(\);\s*loadData\(\);\s*$/,''));
 run(`var prepared=prepareCatalog({productos:${JSON.stringify(products)}});ALL_PRODUCTS=prepared.products;PRODUCT_GROUPS=prepared.groups;STORE_INFO=${JSON.stringify(stores)};indexFavoriteOffers();populateFilters();render();`);
 return {w,d,run};
}
const go=async(w,hash)=>{w.location.hash=hash;w.dispatchEvent(new w.HashChangeEvent('hashchange'));await wait(30);};
const products=[
 {nombre:'DIOR Sauvage EDT 100ml',tienda:'DFA',url:'https://dfa.test/1',precio_usd:120,categoria:'perfumes',imagen:'https://dfa.test/sauvage.jpg'},
 {nombre:'Dior Sauvage Eau de Toilette 100 ml',tienda:'Barão Free Shop',url:'https://barao.test/1',precio_usd:99.9,precio_original_usd:180,en_oferta:true,categoria:'perfumes',imagen:'https://barao.test/sauvage.jpg'},
 {nombre:'Whisky Chivas Regal 12 años 1L',tienda:'DFA',url:'https://dfa.test/2',precio_usd:30,precio_original_usd:40,en_oferta:true,categoria:'bebidas'},
 {nombre:'Whisky Johnnie Walker Black 1L',tienda:'Barão Free Shop',url:'https://barao.test/2',precio_usd:20,precio_original_usd:50,en_oferta:true,categoria:'bebidas'}
];
const logoStores={'Barão Free Shop':{color:'#176A3A',logo:'assets/manual/barao-logo.webp',etiqueta:'logo'},DFA:{color:'#123A75',logo:'assets/manual/dfa-logo.webp',etiqueta:'nombre'}};

test('product page: every store shows its own photo and its own name for the product, next to its price',async t=>{
 const {w,d,run}=await site(t,{products,stores:{DFA:{color:'#123A75',ocultar_fotos:true}}});
 run('applyHiddenPhotos()');
 const key=run(`PRODUCT_GROUPS.find(g=>g.offers.length===2).key`);
 await go(w,'#/producto/'+encodeURIComponent(key));
 const offers=[...d.querySelectorAll('#detailPage .rf-offer')];
 assert.equal(offers.length,2);
 const [barao,dfa]=offers;
 assert.equal(barao.querySelector('.rf-offer-top .rf-offer-photo img').getAttribute('src'),'https://barao.test/sauvage.jpg');
 assert.equal(barao.querySelector('.rf-offer-name').textContent,'Dior Sauvage Eau de Toilette 100 ml');
 assert.ok(barao.querySelector('.rf-offer-info .rf-offer-price'),'price beside the photo');
 assert.ok(dfa.querySelector('.rf-offer-photo').classList.contains('is-empty'),'a store with hidden photos shows no photo');
 assert.equal(dfa.querySelector('.rf-offer-photo').dataset.empty,'Sin foto');
});

test('store logos: only when the owner turns them on in Studio, in every store tag',async t=>{
 const {w,d,run}=await site(t,{products,stores:logoStores});
 assert.equal(run(`storeLogo('Barão Free Shop')`),'assets/manual/barao-logo-thumb.webp');
 assert.equal(run(`storeLogo('DFA')`),null,'logo uploaded but not turned on');
 const card=run(`createProductCard({...PRODUCT_GROUPS.find(g=>g.offers.length===2),visibleOffers:PRODUCT_GROUPS.find(g=>g.offers.length===2).offers})`);
 const chips=[...card.querySelectorAll('.card-store')];
 const barao=chips.find(c=>c.dataset.storeName==='Barão Free Shop'),dfa=chips.find(c=>c.dataset.storeName==='DFA');
 assert.ok(barao.classList.contains('has-logo'));assert.equal(barao.querySelector('img.store-logo').getAttribute('src'),'assets/manual/barao-logo-thumb.webp');
 assert.match(barao.textContent,/Barão Free Shop/,'the name stays next to the logo');
 assert.equal(dfa.querySelector('img'),null);
 const filter=[...d.querySelectorAll('.store-filter-chip')].find(l=>l.querySelector('.storeChk')?.value==='Barão Free Shop');
 assert.ok(filter.querySelector('img.store-logo'),'filters too');
 const key=run(`PRODUCT_GROUPS.find(g=>g.offers.length===2).key`);
 await go(w,'#/producto/'+encodeURIComponent(key));
 assert.ok(d.querySelector('#detailPage .rf-offer-store.has-logo img.store-logo'));
 await go(w,'#/tienda/'+encodeURIComponent('Barão Free Shop'));
 assert.equal(d.querySelector('#detailPage h1 .rf-store-title-logo').getAttribute('src'),'assets/manual/barao-logo-thumb.webp');
 run(`favorites.add(PRODUCT_GROUPS.find(g=>g.offers.some(o=>o.tienda==='Barão Free Shop')).key);renderShoppingList()`);
 assert.ok(d.querySelector('.rf-list-store.has-logo img.store-logo'),'Mi lista too');
 const css=read('ui-updates.css');
 assert.match(css,/\.has-logo>img\.store-logo\{display:block!important\}/,'beats the rule that hides logos taken from store websites');
 assert.match(css,/\.has-logo\{--store-bg:#fff!important/);
});

test('discount levels belong to the offers view: hidden in a regular search, searchable inside offers',async t=>{
 const {w,d,run}=await site(t,{products});
 d.getElementById('search').value='whisky';await run('runSearch()');
 assert.equal(d.getElementById('offerTiers').hidden,true,'regular search: no discount buttons');
 assert.equal(d.getElementById('offersModeChip').hidden,true);
 assert.match(read('mobile.css'),/#catalogSection \.offer-tiers:not\(\[hidden\]\)\{display:grid!important/,'the phone grid no longer overrides hidden');
 d.getElementById('search').value='';await run('runSearch()');
 run(`selectCampaignCategory('',{offers:true})`);await wait(20);
 assert.equal(d.getElementById('offerTiers').hidden,false);
 assert.equal(d.getElementById('search').placeholder,'Buscar en ofertas…');
 assert.equal(d.getElementById('offersModeChip').hidden,false);
 d.querySelector('#offerTiers [data-discount="60"]').click();await wait(10);
 assert.equal(d.querySelector('#offerTiers [aria-pressed=true]').dataset.discount,'60');
 assert.match(d.getElementById('resultsMeta').textContent,/1 producto · 60% o más/);
 d.getElementById('search').value='chivas';await run('runSearch()');
 assert.equal(run('soloOfertas.checked'),true,'searching keeps the offers view');
 assert.equal(run('MIN_DISCOUNT'),0,'no 60% offer for this search: every offer is shown instead of nothing');
 assert.equal(d.querySelector('#offerTiers [aria-pressed=true]').dataset.discount,'0');
 assert.equal(d.querySelector('#catalogStart h2').textContent,'Ofertas: “chivas”');
 assert.match(d.getElementById('actionStatus').textContent,/No hay ofertas de 60% o más/);
 assert.equal(d.querySelectorAll('#grid .card').length,1);
 d.getElementById('offersModeChip').click();await wait(10);
 assert.equal(run('soloOfertas.checked'),false);assert.equal(d.getElementById('offerTiers').hidden,true);
 assert.equal(d.getElementById('search').placeholder,'Ej.: perfume Dior, whisky, parlante JBL');
 const css=read('ui-updates.css');
 assert.match(css,/\.offer-tier\[aria-pressed=true\] \.offer-tier-main::before\{content:"✓"/,'the chosen level shows a check');
 assert.match(css,/\.offer-tier\[aria-pressed=true\]\{--tier-bg:#c91f3a!important/);
});
