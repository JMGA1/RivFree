const {test}=require('node:test');const assert=require('node:assert/strict');const {JSDOM}=require('jsdom');const vm=require('node:vm');const fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');

async function productPage(t,{products,stores={},lang='es'}){
 const dom=new JSDOM(read('index.html'),{url:'https://rivfree.test/',runScripts:'outside-only',pretendToBeVisual:true});t.after(()=>dom.window.close());
 const w=dom.window,d=w.document,run=code=>vm.runInContext(code,dom.getInternalVMContext());
 w.matchMedia=()=>({matches:false,addEventListener(){}});w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.fetch=async()=>{throw Error('offline');};
 w.localStorage.setItem('rivfree-language',lang);
 for(const file of ['matching.js','catalog.js','catalog-cache.js','features.js','shared-list-codec.js','shopping.js','storefront.js','product-details.js','app.js','store-directory.js','experience.js','explore-model.js','category-index.js','explore.js','nav-bar.js'])run(read(file).replace(/initStorefront\(\);\s*loadData\(\);\s*$/,''));
 run(`var prepared=prepareCatalog({productos:${JSON.stringify(products)}});ALL_PRODUCTS=prepared.products;PRODUCT_GROUPS=prepared.groups;STORE_INFO=${JSON.stringify(stores)};indexFavoriteOffers();populateFilters();
  automaticExchange={rates:{BRL:{rate:5.18,date:'2026-10-01'},UYU:{rate:40.2,date:'2026-10-01'},ARS:{rate:1520,date:'2026-10-01'}}};referenceCurrency='BRL';updateExchangeNote();`);
 const key=run('PRODUCT_GROUPS[0].key');w.location.hash='#/producto/'+encodeURIComponent(key);w.dispatchEvent(new w.HashChangeEvent('hashchange'));
 await new Promise(r=>setTimeout(r,30));
 return {w,d,run};
}
const products=[
 {nombre:'DIOR Sauvage EDT 100ml',tienda:'DFA',url:'https://dfa.test/1',precio_usd:120,categoria:'perfumes'},
 {nombre:'DIOR Sauvage EDT 100ml',tienda:'Barão Free Shop',url:'https://barao.test/1',precio_usd:99.9,precio_original_usd:125,en_oferta:true,categoria:'perfumes'}
];
const stores={DFA:{color:'#123A75',color_texto:'#FFFFFF'},'Barão Free Shop':{color:'#176A3A',redes:{whatsapp:'https://wa.me/5555981187666'}}};

test('store offers: store-coloured chip, best price, price in other currencies and two actions',async t=>{
 const {d,run}=await productPage(t,{products,stores});
 const cards=[...d.querySelectorAll('#detailPage .rf-offer')];assert.equal(cards.length,2);
 const [barao,dfa]=cards;
 assert.equal(barao.querySelector('.rf-offer-store').textContent,'Barão Free Shop');
 assert.equal(barao.querySelector('.rf-offer-store').style.getPropertyValue('--store-bg'),'#176A3A','chip uses the store colour, not the site red');
 assert.ok(barao.classList.contains('is-best'));assert.match(barao.querySelector('.rf-offer-best').textContent,/Mejor precio/);
 assert.equal(dfa.querySelector('.rf-offer-best'),null);
 assert.equal(barao.querySelector('.rf-offer-amount').textContent,'99.90');
 assert.match(barao.querySelector('.rf-offer-old').textContent,/125\.00/);assert.equal(barao.querySelector('.rf-offer-off').textContent,'−20%');
 const chips=[...barao.querySelectorAll('.rf-offer-conv-chip')];
 assert.deepEqual(chips.map(c=>c.textContent.replace(/\s/g,' ')),['≈ R$ 517','≈ $U 4.016','≈ AR$ 151.848']);
 assert.equal(chips[0].getAttribute('aria-pressed'),'true');
 chips[1].click();
 assert.equal(run('referenceCurrency'),'UYU','choosing a currency changes the reference currency of the site');
 const again=d.querySelector('#detailPage .rf-offer .rf-offer-conv-chip[aria-pressed=true]');assert.match(again.textContent,/\$U/);
 const shop=barao.ownerDocument.querySelector('#detailPage .rf-offer .rf-offer-shop');
 assert.equal(shop.getAttribute('href'),'https://barao.test/1');assert.equal(shop.target,'_blank');assert.match(shop.rel,/noopener/);assert.match(shop.textContent,/Ver en la tienda/);
 const [first,second]=d.querySelectorAll('#detailPage .rf-offer');
 assert.ok(first.querySelector('.rf-offer-actions a.rf-whatsapp'),'WhatsApp sits next to the store button');
 assert.equal(second.querySelector('.rf-whatsapp'),null,'no grey WhatsApp button when the store has none');
 assert.ok(second.querySelector('.rf-offer-actions .rf-offer-shop'));
});

test('light theme has contrast: grey page, bordered white cards, grey photo boxes that absorb white photo backgrounds',()=>{
 const css=read('ui-updates.css');
 assert.match(css,/:root:not\(\[data-theme="dark"\]\)\{--paper:#e8ecf2/);
 assert.match(css,/\.card-image-stage\{background:#f1f3f7!important/);
 assert.match(css,/\.card-image-stage img[^{]*\{mix-blend-mode:multiply\}/);
 assert.match(read('site-config.js'),/background:'#E8ECF2'/);
});
