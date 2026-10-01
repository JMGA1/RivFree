const {test}=require('node:test');const plain=v=>JSON.parse(JSON.stringify(v));const assert=require('node:assert/strict');const {JSDOM}=require('jsdom');const vm=require('node:vm');const fs=require('node:fs');
const {Catalog}=require('../catalog.js');const CI=require('../category-index.js');
const read=p=>fs.readFileSync(p,'utf8');

async function page(t,{products,stores={},saved={},extra=[]}={}){
 const dom=new JSDOM(read('index.html'),{url:'https://rivfree.test/',runScripts:'outside-only',pretendToBeVisual:true});t.after(()=>dom.window.close());
 const w=dom.window,d=w.document,run=code=>vm.runInContext(code,dom.getInternalVMContext());
 w.matchMedia=()=>({matches:false,addEventListener(){}});w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};w.fetch=async()=>{throw Error('offline');};
 for(const [key,value] of Object.entries(saved))w.localStorage.setItem(key,value);
 for(const file of ['matching.js','catalog.js','catalog-cache.js','features.js','shared-list-codec.js','shopping.js','storefront.js','product-details.js','app.js',...extra])run(read(file).replace(/initStorefront\(\);\s*loadData\(\);\s*$/,''));
 run(`var prepared=prepareCatalog({productos:${JSON.stringify(products||[])}});ALL_PRODUCTS=prepared.products;PRODUCT_GROUPS=prepared.groups;indexFavoriteOffers();SEARCH_WORDS=prepared.words;STORE_INFO=${JSON.stringify(stores)};populateFilters();restoreFilters();render();`);
 return {w,d,run};
}

test('store slugs and product names rescue products that used to fall into "Otros"',()=>{
 assert.equal(Catalog.category('showroom','Guirlanda 300 Luzes'),'hogar');
 assert.equal(Catalog.category('stanley','STANLEY - Copo Térmico de cerveja 700ml'),'hogar');
 assert.equal(Catalog.category('mavala','MAVALA - Gel top Finish Coat 10ml'),'cosmetica');
 assert.equal(Catalog.category('copia-de-kristo-belga-1','KARL LAGERFELD - Bolsa Feminina'),'accesorios');
 assert.equal(Catalog.category('guerlain','GUERLAIN - Aqua Allegoria EDT 125ml'),'perfumes');
 assert.equal(Catalog.category('Televisores','Smart TV 40" AIWA Google TV'),'electronica');
 assert.equal(Catalog.category('varios','WILSON  WILSON RAQUETA 6.1 95S'),'deportes');
 assert.equal(Catalog.category('jugueteria','KERASYS  REPAIR SHAMPOO 600ML'),'cosmetica');
 assert.equal(Catalog.category('jugueteria','LEGO City 60300'),'juguetes');
 assert.equal(Catalog.category('perfumeria-masculinos','REVLON PHOTOREADY BB CREAM SKIN DEEP'),'cosmetica');
 assert.equal(Catalog.category('perfumeria-masculinos','SUN DI GIOIA EDP / GIORGIO ARMANI'),'perfumes');
 assert.equal(Catalog.category('pet','Training pads pets'),'otros');
});

test('brand index reads the brand position each store uses and ignores generic words',()=>{
 const names=['PACO RABANNE - Invictus EDP','PACO RABANNE - 1 Million EDT','PACO RABANNE - Phantom','SANTA BARBARA - Jaqueta','SANTA BARBARA - Short','SANTA BARBARA - Moletom','COACH  DREAMS EDP 90ML','COACH  WILD ROSE EDP','COACH  FLORAL EDT','MANIFESTO EDP / YVES SAINT LAURENT','CASIO RELOJ G-SHOCK GA2100','CASIO RELOJ A158W','Q&Q RELOJ C10A-001PY','TH RELOJ 1791093','RAY BAN ANTEOJOS RB3025 001 58','PANELA A PRESSÃO 7LT VENUS CUORI','Térmica Stanley 1L','Térmica Stanley 2L','Térmica Stanley 3L','JOSEPH TABLA DE PICAR','JOSEPH SALERO OVI','JOSEPH ESCURRIDOR'];
 const products=names.map(nombre=>({nombre}));const index=CI.build(products);
 const brand=name=>index.brandOf(products.find(p=>p.nombre===name))?.label;
 assert.equal(brand('PACO RABANNE - Invictus EDP'),'Paco Rabanne');
 assert.equal(brand('SANTA BARBARA - Short'),'Santa Barbara');
 assert.equal(brand('COACH  DREAMS EDP 90ML'),'Coach');
 assert.equal(brand('MANIFESTO EDP / YVES SAINT LAURENT'),'Yves Saint Laurent');
 assert.equal(brand('CASIO RELOJ G-SHOCK GA2100'),'Casio');
 assert.equal(brand('Q&Q RELOJ C10A-001PY'),'Q&Q');
 assert.equal(brand('TH RELOJ 1791093'),'Tommy Hilfiger');
 assert.equal(brand('RAY BAN ANTEOJOS RB3025 001 58'),'Ray-Ban');
 assert.equal(brand('PANELA A PRESSÃO 7LT VENUS CUORI'),'Cuori');
 assert.equal(brand('Térmica Stanley 2L'),'Stanley');
 assert.equal(brand('JOSEPH SALERO OVI'),'Joseph Joseph');
 assert(![...index.brands.values()].some(b=>/^t[eé]rmica$/i.test(b.label)),'generic words are not brands');
 assert.deepEqual(CI.structured('Notebook - Asus Vivobook'),[]);
});

test('every catalog category has product-type suggestions',()=>{
 for(const id of Object.keys(Catalog.categories))assert(CI.types(id).length>0,id);
 const watch=CI.types('relojes').find(x=>x.es==='Smartwatches');assert(watch.regex.test('garmin reloj venu sq'));
 const wear=CI.types('ropa').find(x=>x.es==='Calzado');assert(wear.regex.test('nike - tenis masculino dunk low'));
});

const offerProducts=[
 {nombre:'Perfume Uno EDP 100ml',tienda:'Barão Free Shop',url:'https://barao.test/1',precio_usd:50,precio_original_usd:100,en_oferta:true,categoria:'perfumes'},
 {nombre:'Whisky Dos 12 anos 1L',tienda:'Barão Free Shop',url:'https://barao.test/2',precio_usd:70,precio_original_usd:100,en_oferta:true,categoria:'bebidas'},
 {nombre:'Chocolate Tres 100g',tienda:'Barão Free Shop',url:'https://barao.test/3',precio_usd:30,precio_original_usd:100,en_oferta:true,categoria:'alimentos'},
 {nombre:'Parlante Cuatro',tienda:'DFA',url:'https://dfa.test/4',precio_usd:90,precio_original_usd:100,en_oferta:true,categoria:'electronica'},
 {nombre:'Reloj Cinco',tienda:'DFA',url:'https://dfa.test/5',precio_usd:40,categoria:'relojeria'}
];
test('offers show discount tiers that filter, sort and survive the URL',async t=>{
 const {w,d,run}=await page(t,{products:offerProducts});
 assert.equal(d.getElementById('offerTiers').hidden,true);
 run("document.getElementById('navOffers').disabled=false");d.getElementById('navOffers').click();
 assert.equal(d.getElementById('offerTiers').hidden,false);
 const count=v=>d.querySelector(`.offer-tier[data-discount="${v}"] .offer-tier-count`).textContent;
 assert.equal(count(0),'4');assert.equal(count(20),'3');assert.equal(count(40),'2');assert.equal(count(60),'1');
 assert.match(d.querySelector('#grid .card').textContent,/Chocolate Tres/,'offers start with the biggest discount');
 d.querySelector('.offer-tier[data-discount="40"]').click();
 assert.equal(d.querySelectorAll('#grid .card').length,2);
 assert.equal(d.querySelector('.offer-tier[data-discount="40"]').getAttribute('aria-pressed'),'true');
 assert.equal(new URL(w.location.href).searchParams.get('discount'),'40');
 assert.match(d.querySelector('#grid .badge-oferta').textContent,/−70%/);
 run("MIN_DISCOUNT=0;restoreFilters();render(true)");assert.equal(run('MIN_DISCOUNT'),40);assert.equal(d.querySelectorAll('#grid .card').length,2);
 run("selectCampaignCategory('')");assert.equal(run('MIN_DISCOUNT'),0);assert.equal(d.getElementById('offerTiers').hidden,true);
 assert.equal(new URL(w.location.href).searchParams.has('discount'),false);
});

const storeInfo={
 'Barão Free Shop':{nombre_completo:'Barão Free Shop',direccion:'Agraciada 397',sitio_web:'https://barao.test/',telefono:'+598 4623 9211',redes:{instagram:'https://www.instagram.com/barao/',facebook:'https://www.facebook.com/barao/',whatsapp:'https://wa.me/5555981187666',telegram:'https://t.me/barao'},google:{rating:4.5,count:1255,url:'https://maps.app.goo.gl/x'},color:'#176a3a'},
 DFA:{nombre_completo:'DFA Uruguay',direccion:'Av. Sarandí 475',redes:{instagram:'javascript:alert(1)'},google:{rating:4.3,count:611,url:'https://www.google.com/maps/place/DFA/@-30.89,-55.53,19z/data=!3d-30.898677!4d-55.538879'}},
 Sineriz:{nombre_completo:'Siñeriz Shopping',direccion:'Sepé 51',google:{rating:4.5,count:15061},ubicacion:{lat:-30.9000187,lng:-55.5251471}}
};
test('store contacts render app icons directly, in order and only with safe links',async t=>{
 const {d,run}=await page(t,{products:offerProducts,stores:storeInfo,extra:['store-directory.js']});
 const box=run("RivFreeStores.contactLinks(STORE_INFO['Barão Free Shop'],'Barão Free Shop')");
 assert.deepEqual([...box.querySelectorAll('.rf-app-icon')].map(x=>x.className.replace('rf-app-icon rf-app-','')),['whatsapp','instagram','facebook','telegram','maps','web','phone']);
 assert(box.querySelector('.rf-contact-telegram').href.startsWith('https://t.me/'));
 assert.equal(box.querySelector('details'),null,'nothing is collapsed');
 const unsafe=run("RivFreeStores.contactLinks(STORE_INFO.DFA,'DFA')");assert.equal(unsafe.querySelector('.rf-contact-instagram'),null);
 assert.deepEqual(plain(run("RivFreeStores.coordinates(STORE_INFO.DFA)")),{lat:-30.898677,lng:-55.538879});
 assert.deepEqual(plain(run("RivFreeStores.coordinates(STORE_INFO.Sineriz)")),{lat:-30.9000187,lng:-55.5251471});
 assert.equal(run("RivFreeStores.coordinates(STORE_INFO['Barão Free Shop'])"),null);
});
test('store directory sorts by name, rating, catalog size and reviews',async t=>{
 const {run}=await page(t,{products:offerProducts,stores:storeInfo,extra:['store-directory.js']});
 const names="['Sineriz','DFA','Barão Free Shop']";
 assert.deepEqual(plain(run(`RivFreeStores.sortNames(${names},'alpha')`)),['Barão Free Shop','DFA','Sineriz']);
 assert.deepEqual(plain(run(`RivFreeStores.sortNames(${names},'rating')`)),['Sineriz','Barão Free Shop','DFA']);
 assert.deepEqual(plain(run(`RivFreeStores.sortNames(${names},'items')`)),['Barão Free Shop','DFA','Sineriz']);
 assert.deepEqual(plain(run(`RivFreeStores.sortNames(${names},'reviews')`)),['Sineriz','Barão Free Shop','DFA']);
});

test('language picker shows both flags and drives the original selector',async t=>{
 const {w,d}=await page(t,{products:offerProducts,extra:['ui-updates.js']});
 const button=d.querySelector('.rf-lang-button');assert(button);assert.equal(button.getAttribute('aria-expanded'),'false');
 button.click();assert.equal(button.getAttribute('aria-expanded'),'true');
 const options=[...d.querySelectorAll('.rf-lang-option')];
 assert.deepEqual(options.map(o=>o.querySelector('img').getAttribute('src')),['icons/flag-uy.svg','icons/flag-br.svg']);
 let changed=null;d.getElementById('languageToggle').addEventListener('change',e=>{changed=e.target.value;});
 options[0].click();assert.equal(changed,'es');assert.equal(d.querySelector('.rf-lang-code').textContent,'ES');assert.equal(button.getAttribute('aria-expanded'),'false');
 assert.equal(d.querySelector('.rf-lang-button .rf-lang-flag').getAttribute('src'),'icons/flag-uy.svg');
});
test('top notice says RivFree only compares prices and remembers when it is closed',async t=>{
 const first=await page(t,{products:offerProducts,extra:['ui-updates.js']});
 const notice=first.d.getElementById('siteDisclaimer');assert.equal(notice.hidden,false);assert.match(notice.textContent,/no vendemos|não vendemos/i);assert.match(notice.textContent,/afiliad/i);
 first.d.getElementById('siteDisclaimerClose').click();assert.equal(notice.hidden,true);
 const again=await page(t,{products:offerProducts,extra:['ui-updates.js'],saved:{'rivfree-disclaimer-closed':first.w.localStorage.getItem('rivfree-disclaimer-closed')}});
 assert.equal(again.d.getElementById('siteDisclaimer').hidden,true);
});

test('navigation bar: quick access with icons replaces the old section links',async t=>{
 const {d}=await page(t,{products:offerProducts});
 const nav=d.querySelector('.category-shortcuts');
 assert.equal(nav.querySelector('a[href="#discoverProducts"]'),null);assert.equal(nav.querySelector('a[href="#popularProducts"]'),null);
 assert(d.getElementById('discoverProducts')&&d.getElementById('popularProducts'),'the sections themselves stay on the page');
 const quick=[...d.querySelectorAll('#navQuick > .rf-nav-item')];
 assert.deepEqual(quick.map(x=>x.id),['navStores','navOffers','navExchange','navList']);
 for(const item of quick)assert(item.querySelector('svg.rf-nav-icon'),item.id+' has an icon');
 assert(d.querySelector('#navList .rf-icon-list'),'list uses the heart icon');
});
test('navigation bar shows today\'s dollar rate, switches currency and mirrors the list',async t=>{
 const {w,d,run}=await page(t,{products:offerProducts,extra:['nav-bar.js']});
 run("automaticExchange={rates:{BRL:{rate:5.1849,date:'2026-09-27',source:'Frankfurter'},UYU:{rate:40.239,date:'2026-09-27'},ARS:{rate:1520.56,date:'2026-09-27'}}};referenceCurrency='BRL';updateExchangeNote()");
 assert.match(d.getElementById('navExchangeValue').textContent,/R\$\s5,18/);
 d.getElementById('navExchange').click();
 const rows=[...d.querySelectorAll('#navExchangePanel .rf-rate-row')];assert.deepEqual(rows.map(r=>r.dataset.currency),['BRL','UYU','ARS','USD']);
 rows[1].click();assert.equal(run('referenceCurrency'),'UYU');assert.match(d.getElementById('navExchangeValue').textContent,/\$U\s40,24/);
 assert.equal(d.getElementById('navExchangePanel').hidden,true);
 run("for(const g of PRODUCT_GROUPS.slice(0,2))favorites.add(g.key);persistShopping();");
 await new Promise(r=>setTimeout(r,20));
 assert.equal(d.getElementById('navListCount').textContent,'2');assert.equal(d.getElementById('navListCount').hidden,false);
 let opened=false;d.getElementById('openShoppingList').addEventListener('click',()=>{opened=true;});d.getElementById('navList').click();assert(opened);
});
