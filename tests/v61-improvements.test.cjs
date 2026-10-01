const {test}=require('node:test');const assert=require('node:assert/strict');const {JSDOM}=require('jsdom');const vm=require('node:vm');const fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');

async function page(t,{products=[],stores={},url='https://rivfree.test/'}={}){
 const dom=new JSDOM(read('index.html'),{url,runScripts:'outside-only',pretendToBeVisual:true});t.after(()=>dom.window.close());
 const w=dom.window,d=w.document,run=code=>vm.runInContext(code,dom.getInternalVMContext());
 w.matchMedia=()=>({matches:false,addEventListener(){}});w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.fetch=async()=>{throw Error('offline');};
 for(const file of ['matching.js','catalog.js','catalog-cache.js','features.js','shared-list-codec.js','shopping.js','storefront.js','product-details.js','app.js'])run(read(file).replace(/initStorefront\(\);\s*loadData\(\);\s*$/,''));
 run(`var prepared=prepareCatalog({productos:${JSON.stringify(products)}});ALL_PRODUCTS=prepared.products;PRODUCT_GROUPS=prepared.groups;STORE_INFO=${JSON.stringify(stores)};applyHiddenPhotos();indexFavoriteOffers();SEARCH_WORDS=prepared.words;populateFilters();restoreFilters();render();`);
 return {w,d,run};
}
const products=[
 {nombre:'DIOR Sauvage EDT 100ml',tienda:'DFA',url:'https://dfa.test/1',precio_usd:50,categoria:'perfumes',imagen:'https://dfa.test/img/1.jpg'},
 {nombre:'DIOR Sauvage EDT 100ml',tienda:'Barão Free Shop',url:'https://barao.test/1',precio_usd:55,categoria:'perfumes',imagen:'https://barao.test/img/1.jpg'},
 {nombre:'Whisky Dos 1L',tienda:'DFA',url:'https://dfa.test/2',precio_usd:30,categoria:'bebidas',imagen:'https://dfa.test/img/2.jpg'},
 {nombre:'Chocolate Tres',tienda:'Neutral',url:'https://neutral.test/3',precio_usd:5,categoria:'alimentos',imagen:'https://neutral.test/img/3.jpg'}
];
const stores={DFA:{nombre_completo:'DFA'},'Barão Free Shop':{},Neutral:{}};

test('store filter starts with every store and the visitor picks which ones to see',async t=>{
 const {w,d}=await page(t,{products,stores});
 const boxes=()=>[...d.querySelectorAll('.storeChk')];
 const cards=()=>[...d.querySelectorAll('#grid .card')].length;
 assert.equal(boxes().length,3);assert.equal(boxes().some(b=>b.checked),false,'nothing chosen by default');
 assert.equal(d.getElementById('storeFilterAll').getAttribute('aria-pressed'),'true');
 assert.equal(cards(),3,'all stores are shown');assert.equal(d.getElementById('advancedCount').hidden,true);
 const pick=name=>{const box=boxes().find(b=>b.value===name);box.checked=!box.checked;box.dispatchEvent(new w.Event('change'));};
 pick('Neutral');
 assert.equal(cards(),1);assert.match(d.querySelector('#grid .card').textContent,/Chocolate/);
 assert.equal(d.getElementById('storeFilterAll').getAttribute('aria-pressed'),'false');
 assert.equal(d.getElementById('advancedCount').textContent,'1');
 const link=new URL(w.location.href).searchParams;assert.equal(link.get('stores'),'selected');assert.deepEqual(link.getAll('store'),['Neutral']);
 pick('DFA');assert.equal(cards(),3,'DFA adds the perfume and the whisky');
 pick('Barão Free Shop');assert.equal(boxes().some(b=>b.checked),false,'choosing every store goes back to «Todas»');
 assert.equal(new URL(w.location.href).searchParams.has('stores'),false);
 pick('DFA');d.getElementById('storeFilterAll').click();
 assert.equal(boxes().some(b=>b.checked),false);assert.equal(cards(),3);
});

test('shared links keep the chosen stores',async t=>{
 const {d}=await page(t,{products,stores,url:'https://rivfree.test/?stores=selected&store=DFA'});
 assert.deepEqual([...d.querySelectorAll('.storeChk:checked')].map(b=>b.value),['DFA']);
 assert.equal(d.querySelectorAll('#grid .card').length,2);
});

test('Studio can hide the product photos of one store; another store\'s photo is used when there is one',async t=>{
 const {d,run}=await page(t,{products,stores:{...stores,DFA:{ocultar_fotos:true}}});
 const src=name=>[...d.querySelectorAll('#grid .card')].find(c=>c.textContent.includes(name))?.querySelector('.card-img img')?.getAttribute('src')||null;
 assert.equal(src('Sauvage'),'https://barao.test/img/1.jpg','same product from another store keeps a photo');
 assert.equal(src('Whisky Dos'),null,'DFA-only product shows the placeholder');
 assert.equal(src('Chocolate Tres'),'https://neutral.test/img/3.jpg');
 assert.equal(run("ALL_PRODUCTS.filter(p=>p.tienda==='DFA').every(p=>!p.imagen&&p.imagen_oculta)"),true,'nothing is deleted');
 run("STORE_INFO.DFA.ocultar_fotos=false;window.RivFreeApplyHiddenPhotos()");
 assert.equal(src('Whisky Dos'),'https://dfa.test/img/2.jpg','switching the option off brings the photos back');
});

test('static pages skip the hidden photos too',()=>{
 const source=read('tools/build_seo.cjs');
 assert.match(source,/ocultar_fotos===true/);
 assert.ok(source.indexOf('hiddenPhotos.has(product.tienda)')<source.indexOf('prepareCatalog(data)'),'photos are removed before the pages are built');
});
