const {test}=require('node:test');const assert=require('node:assert/strict');const {JSDOM}=require('jsdom');const vm=require('node:vm');const fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
const wait=ms=>new Promise(r=>setTimeout(r,ms));

async function site(t,{products,stores={},lang='es',hash=''}={}){
 const dom=new JSDOM(read('index.html'),{url:'https://rivfree.test/'+hash,runScripts:'outside-only',pretendToBeVisual:true});t.after(()=>dom.window.close());
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
 {nombre:'Agenda de regalo DIOR Sauvage',tienda:'DFA',url:'https://dfa.test/kit',precio_usd:80,categoria:'otros'},
 {nombre:'DIOR Sauvage EDT 100ml',tienda:'DFA',url:'https://dfa.test/1',precio_usd:120,categoria:'perfumes'},
 {nombre:'DIOR Sauvage EDT 100ml',tienda:'Barão Free Shop',url:'https://barao.test/1',precio_usd:99.9,precio_original_usd:125,en_oferta:true,categoria:'perfumes'},
 {nombre:'Whisky Dos 750ml',tienda:'Barão Free Shop',url:'https://barao.test/2',precio_usd:30,precio_original_usd:45,en_oferta:true,categoria:'bebidas'}
];
const stores={DFA:{nombre_completo:'DFA Uruguay',color:'#123A75'},'Barão Free Shop':{nombre_completo:'Barão Free Shop',color:'#176A3A',email:'ventas@barao.test?bcc=otro@x.test'}};

test('a search is ordered by relevance by default and the title repeats the search',async t=>{
 const {w,d,run}=await site(t,{products,stores});
 d.getElementById('search').value='dior sauvage';await run('runSearch()');
 assert.equal(d.getElementById('orden').value,'relevancia');
 assert.match(d.querySelector('#grid .card .card-name').textContent,/^DIOR Sauvage/i,'the name that starts with the search goes before the gift (A-Z would put the gift first)');
 assert.equal(d.querySelector('#catalogStart h2').textContent,'Resultados para “dior sauvage”');
 assert.equal(new URL(w.location.href).searchParams.get('sort'),null,'relevance is the default, so the link stays short');
 d.getElementById('search').value='';await run('runSearch()');
 assert.equal(d.getElementById('orden').value,'nombre_asc','without a search the order goes back to A-Z');
 assert.match(read('index.html'),/<option value="relevancia">Más relevantes<\/option>/);
});

test('results count groups thousands and the offers view is titled Ofertas',async t=>{
 const {d,run}=await site(t,{products,stores});
 run(`selectCampaignCategory('',{offers:true})`);await wait(20);
 assert.equal(d.querySelector('#catalogStart h2').textContent,'Ofertas');
 assert.match(read('app.js'),/useGrouping: 'always'/);
});

test('store page: buttons open that store\'s products or offers in the results',async t=>{
 const {w,d}=await site(t,{products,stores});
 await go(w,'#/tienda/'+encodeURIComponent('Barão Free Shop'));
 const buttons=[...d.querySelectorAll('#detailPage .rf-store-go')];
 assert.deepEqual(buttons.map(b=>b.textContent),['Ver sus 2 productos','Ver ofertas (2)']);
 buttons[1].click();await wait(30);
 assert.equal(w.location.hash,'#/buscar');
 assert.equal(d.querySelector('#catalogStart h2').textContent,'Ofertas de Barão Free Shop');
 assert.deepEqual([...d.querySelectorAll('.storeChk:checked')].map(b=>b.value),['Barão Free Shop']);
 assert.ok(d.getElementById('soloOfertas').checked);
 assert.ok([...d.querySelectorAll('#grid .card-store')].every(chip=>chip.textContent==='Barão Free Shop'));
});

test('product page: best price summary and how much more each other store asks',async t=>{
 const {w,d,run}=await site(t,{products,stores});
 const key=run(`PRODUCT_GROUPS.find(g=>g.offers.length===2).key`);
 await go(w,'#/producto/'+encodeURIComponent(key));
 assert.equal(d.querySelector('#detailPage .rf-muted').textContent,'Desde USD 99.90 en Barão Free Shop · 2 tiendas');
 const [best,other]=d.querySelectorAll('#detailPage .rf-offer');
 assert.equal(best.querySelector('.rf-offer-gap'),null);
 assert.equal(other.querySelector('.rf-offer-gap').textContent,'USD 20.10 más que el mejor precio (+20%)');
});

test('cards: the heart stays on products sold in several stores, labels without stars, store link translated',async t=>{
 const {d,run}=await site(t,{products,stores,lang:'pt-BR'});
 const multi=run(`(()=>{const g=PRODUCT_GROUPS.find(g=>g.offers.length===2);return createProductCard({...g,visibleOffers:g.offers});})()`);
 const heart=multi.querySelector(':scope > .heart-button');
 assert.ok(heart,'heart kept');assert.doesNotMatch(heart.getAttribute('aria-label'),/[★☆]/);assert.match(heart.getAttribute('aria-label'),/^Salvar na Minha lista: /);
 const single=run(`(()=>{const g=PRODUCT_GROUPS.find(g=>g.offers.length===1&&/Whisky/.test(g.name));return createProductCard({...g,visibleOffers:g.offers});})()`);
 assert.ok(single);
 assert.match(read('app.js'),/words\(`Ver na \$\{product\.tienda\} ↗`,`Ver en \$\{product\.tienda\} ↗`\)/);
});

test('Mi lista: shortcuts when empty, no share button until there is something to share, visible "Comprado"',async t=>{
 const {d,run}=await site(t,{products,stores});
 run('renderShoppingList()');
 assert.deepEqual([...d.querySelectorAll('.rf-list-empty-actions button')].map(b=>b.textContent),['Ver ofertas','Buscar productos']);
 assert.equal(d.querySelector('#shoppingDialog .share-list').hidden,true);
 run('favorites.add(PRODUCT_GROUPS[0].key);persistShopping();renderShoppingList()');
 assert.equal(d.querySelector('#shoppingDialog .share-list').hidden,false);
 assert.equal(d.querySelector('.purchased-control .rf-list-check-label').textContent,'Comprado');
});

test('"Más buscados" is hidden until there is real search data',async t=>{
 const {d,run}=await site(t,{products,stores});
 run('renderPopularProducts()');await wait(30);
 assert.equal(d.getElementById('mostSearched').hidden,true);
});

test('security: banner colours, shared lists and store e-mails',async t=>{
 const {w,d,run}=await site(t,{products,stores});
 const colors=run(`campaignColors({colors:{light:{background:'url(https://x.test/a.png)',accent:'#AABBCC',text:'red;position:fixed'}}})`);
 assert.deepEqual({...colors},{accent:'#AABBCC'},'only #rrggbb colours reach the page');
 const real=run('PRODUCT_GROUPS[0].key');
 w.location.hash='#list='+encodeURIComponent(JSON.stringify({v:1,items:[[real,2],['<img src=x onerror=alert(1)>',1]]}));
 run('inspectSharedList();importPendingShopping()');
 assert.deepEqual(JSON.parse(run('JSON.stringify([...favorites])')),[real],'old links only add products that exist in the catalog');
 const box=run(`window.RivFreeStores.contactLinks(STORE_INFO['Barão Free Shop'],'Barão Free Shop')`);
 assert.equal(box.querySelector('a[href^="mailto:"]'),null,'an e-mail with ?bcc= is not turned into a link');
 assert.ok(d);
});

test('static pages carry a Content-Security-Policy and only link to https',()=>{
 const seo=read('tools/build_seo.cjs');
 assert.match(seo,/<meta http-equiv="Content-Security-Policy" content="\$\{esc\(pageCSP\)\}">/);
 assert.match(seo,/return u\.protocol==='https:'&&!u\.username/);
 for(const page of ['privacy.html','cookies.html','terms.html']){
  const html=read(page);
  assert.match(html,/<meta http-equiv="Content-Security-Policy" content="default-src 'self';[^"]*object-src 'none'/);
  assert.doesNotMatch(html,/style="/,'no inline styles');
 }
 assert.match(read('privacy.css'),/#legalContent\{white-space:pre-wrap;overflow-wrap:anywhere;\}/);
});

test('phone layout: room for "Mostrar más", all discount tiers in one row, results below the sticky bar',()=>{
 const css=read('mobile.css');
 assert.match(css,/\.load-more-wrap\{margin:16px 12px 28px!important/);
 assert.match(css,/#catalogSection \.offer-tiers:not\(\[hidden\]\)\{display:grid!important;grid-auto-flow:column/);
 assert.match(css,/#grid \.card \.heart-button\{width:40px!important;height:40px!important/);
 assert.match(css,/scroll-margin-top:136px!important/);
});
