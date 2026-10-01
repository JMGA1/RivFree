const {test}=require('node:test');const assert=require('node:assert/strict');const {JSDOM}=require('jsdom');const vm=require('node:vm');const fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');

async function page(t,{products=[],saved={},extra=[],url='https://rivfree.test/'}={}){
 const dom=new JSDOM(read('index.html'),{url,runScripts:'outside-only',pretendToBeVisual:true});t.after(()=>dom.window.close());
 const w=dom.window,d=w.document,run=code=>vm.runInContext(code,dom.getInternalVMContext());
 w.matchMedia=()=>({matches:false,addEventListener(){}});w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};w.fetch=async()=>{throw Error('offline');};
 for(const [key,value] of Object.entries(saved))w.localStorage.setItem(key,value);
 for(const file of ['matching.js','catalog.js','catalog-cache.js','features.js','shared-list-codec.js','shopping.js','storefront.js','product-details.js','app.js',...extra])run(read(file).replace(/initStorefront\(\);\s*loadData\(\);\s*$/,''));
 run(`var prepared=prepareCatalog({productos:${JSON.stringify(products)}});ALL_PRODUCTS=prepared.products;PRODUCT_GROUPS=prepared.groups;indexFavoriteOffers();SEARCH_WORDS=prepared.words;STORE_INFO={};populateFilters();restoreFilters();render();`);
 // Same event site-config.js sends after reading data/site-config.json (or a Studio preview).
 const config=value=>d.dispatchEvent(new w.CustomEvent('rivfree-site-config-applied',{detail:value}));
 return {w,d,run,config};
}
const products=[
 {nombre:'Perfume Uno EDP 100ml',tienda:'Barão Free Shop',url:'https://barao.test/1',precio_usd:50,precio_original_usd:100,en_oferta:true,categoria:'perfumes',imagen:'https://barao.test/img/perfume-uno.jpg'},
 {nombre:'Whisky Dos 12 anos 1L',tienda:'Barão Free Shop',url:'https://barao.test/2',precio_usd:70,precio_original_usd:100,en_oferta:true,categoria:'bebidas'},
 {nombre:'Chocolate Tres 100g',tienda:'Barão Free Shop',url:'https://barao.test/3',precio_usd:30,precio_original_usd:100,en_oferta:true,categoria:'alimentos'},
 {nombre:'Parlante Cuatro',tienda:'Barão Free Shop',url:'https://barao.test/4',precio_usd:85,precio_original_usd:100,en_oferta:true,categoria:'electronica'}
];
const social=(over={})=>({show_without_link:true,instagram:{url:'',visible:true},facebook:{url:'',visible:true},tiktok:{url:'',visible:true},whatsapp:{url:'',visible:true},youtube:{url:'',visible:false},x:{url:'',visible:false},telegram:{url:'',visible:false},...over});

test('results bar keeps discount buttons, favourites and sorting together, without the exchange rate',async t=>{
 const {d}=await page(t,{products});
 const bar=d.querySelector('.rf-results-bar');
 assert(bar.querySelector('#offerTiers'),'discount buttons live in the bar');
 assert(bar.querySelector('.rf-results-actions #favoritesOnly'),'favourites toggle sits next to them');
 assert(bar.querySelector('.rf-results-actions #orden'),'sorting sits next to them');
 assert.equal(bar.querySelector('#referenceCurrency, .exchange-details, #exchangeNote'),null,'no exchange rate in the results area');
 assert.equal(d.querySelector('.planning-tools').hidden,true);
});

test('site social icons: brand tiles, real links only for https, "coming soon" without a link',async t=>{
 const {d,config}=await page(t,{products,extra:['ui-updates.js']});
 config({social:social({instagram:{url:'https://instagram.com/rivfree',visible:true},tiktok:{url:'javascript:alert(1)',visible:true},youtube:{url:'https://youtube.com/@rivfree',visible:true}})});
 for(const id of ['headerSocial','footerSocial']){
  const box=d.getElementById(id);assert.equal(box.hidden,false);
  const items=[...box.children];
  assert.deepEqual(items.map(x=>x.querySelector('.rf-app-icon').className.replace('rf-app-icon rf-app-','')),['instagram','facebook','tiktok','whatsapp','youtube']);
  const ig=items[0];assert.equal(ig.tagName,'A');assert.equal(ig.href,'https://instagram.com/rivfree');assert.equal(ig.target,'_blank');assert.match(ig.rel,/noopener/);assert.match(ig.rel,/noreferrer/);
  assert.equal(items[1].tagName,'SPAN','no link yet');assert.match(items[1].getAttribute('aria-label'),/Facebook · (próximamente|em breve)/);
  assert.equal(items[2].tagName,'SPAN','unsafe links are never rendered');
  assert.equal(items[4].tagName,'A');
 }
 config({social:social({show_without_link:false,facebook:{url:'https://facebook.com/rivfree',visible:true}})});
 assert.deepEqual([...d.querySelectorAll('#headerSocial > *')].map(x=>x.tagName+':'+x.href),['A:https://facebook.com/rivfree']);
 config({social:social({show_without_link:false})});
 assert.equal(d.getElementById('headerSocial').hidden,true,'nothing to show hides the row');
});

test('top notice texts and visibility come from Studio',async t=>{
 const {d,config}=await page(t,{products,extra:['ui-updates.js'],saved:{'rivfree-language':'es'}});
 d.getElementById('languageToggle').value='es';
 config({top_notice:{enabled:true,title_es:'Comparador independiente.',text_es:'No vendemos nada.',short_es:'Aviso: solo comparamos.',title_pt:'Comparador independente.',text_pt:'Não vendemos nada.',short_pt:'Aviso: só comparamos.'}});
 const notice=d.getElementById('siteDisclaimer');
 assert.equal(notice.querySelector('strong.rf-d-long').textContent,'Comparador independiente.');
 assert.equal(notice.querySelector('span.rf-d-long').textContent,'No vendemos nada.');
 assert.equal(notice.querySelector('.rf-d-short strong').textContent,'Aviso:');
 config({top_notice:{enabled:false}});assert.equal(notice.hidden,true);
});

test('Studio can hide quick-access items of the navigation bar',async t=>{
 const {d,config}=await page(t,{products,extra:['nav-bar.js']});
 config({nav:{stores:true,offers:true,exchange:false,list:true}});
 assert.equal(d.getElementById('navExchange').hidden,true);assert.equal(d.getElementById('navOffers').hidden,false);
 assert.equal(d.getElementById('navQuick').dataset.items,'3');
 config({nav:{stores:false,offers:true,exchange:true,list:true}});
 assert.equal(d.getElementById('navStores').hidden,true);assert.equal(d.getElementById('navExchange').hidden,false);
});

test('discount buttons follow the tiers set in Studio and the shared link',async t=>{
 const {w,d,run,config}=await page(t,{products});
 run("window.RIVFREE_SITE_CONFIG={offers:{tiers:[70,15,'30',200,15]}}");config(w.RIVFREE_SITE_CONFIG);
 const tiers=()=>[...d.querySelectorAll('#offerTiers [data-discount]')].map(b=>Number(b.dataset.discount));
 assert.deepEqual(tiers(),[0,15,30,70],'sorted, unique, between 5 and 95');
 d.getElementById('navOffers').disabled=false;d.getElementById('navOffers').click();
 const count=v=>d.querySelector(`.offer-tier[data-discount="${v}"] .offer-tier-count`).textContent;
 assert.equal(count(70),'1');assert.equal(count(30),'3');
 d.querySelector('.offer-tier[data-discount="70"]').click();
 assert.equal(new URL(w.location.href).searchParams.get('discount'),'70');assert.equal(d.querySelectorAll('#grid .card').length,1);
 run("MIN_DISCOUNT=0;restoreFilters()");assert.equal(run('MIN_DISCOUNT'),70,'any configured tier survives the URL');
});

test('Mi lista shows the product photo, a short summary and the total',async t=>{
 const {d,run}=await page(t,{products});
 run("for(const g of PRODUCT_GROUPS.filter(g=>/Perfume|Whisky/.test(g.name)))favorites.add(g.key);persistShopping();renderShoppingList();");
 const rows=[...d.querySelectorAll('#shoppingList .shopping-row')];assert.equal(rows.length,2);
 const perfume=rows.find(r=>/Perfume/.test(r.textContent));
 assert.equal(perfume.querySelector('.rf-list-thumb img').getAttribute('src'),'https://barao.test/img/perfume-uno.jpg');
 const whisky=rows.find(r=>/Whisky/.test(r.textContent));assert(whisky.querySelector('.rf-list-thumb svg'),'placeholder when there is no photo');
 assert.match(d.getElementById('shoppingSummary').textContent,/2 (unidades) · 1 (loja|tienda)/);
 assert.match(d.querySelector('#shoppingList .shopping-total').textContent,/120/);
});
