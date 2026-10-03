const {test}=require('node:test');const assert=require('node:assert/strict');const {JSDOM}=require('jsdom');const vm=require('node:vm');const fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');

async function page(t,{products=[],lang='es'}={}){
 const dom=new JSDOM(read('index.html'),{url:'https://rivfree.test/',runScripts:'outside-only',pretendToBeVisual:true});t.after(()=>dom.window.close());
 const w=dom.window,d=w.document,run=code=>vm.runInContext(code,dom.getInternalVMContext());
 w.matchMedia=()=>({matches:false,addEventListener(){}});w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.fetch=async()=>{throw Error('offline');};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.localStorage.setItem('rivfree-language',lang);
 for(const file of ['matching.js','catalog.js','catalog-cache.js','features.js','shared-list-codec.js','shopping.js','storefront.js','product-details.js','app.js','nav-bar.js','ui-updates.js','mobile-shell.js'])run(read(file).replace(/initStorefront\(\);\s*loadData\(\);\s*$/,''));
 run(`var prepared=prepareCatalog({productos:${JSON.stringify(products)}});ALL_PRODUCTS=prepared.products;PRODUCT_GROUPS=prepared.groups;STORE_INFO={};populateFilters();render();`);
 return {w,d,run};
}
const products=[{nombre:'Perfume Uno EDP 100ml',tienda:'DFA',url:'https://dfa.test/1',precio_usd:50,categoria:'perfumes'}];

test('phone bar: menu, RivFree, search and Mi lista; the page scale is 110%',async t=>{
 const {d}=await page(t,{products});
 const bar=d.querySelector('.topbar-inner');
 assert.equal(bar.firstElementChild.id,'mobileMenuButton');
 assert.ok(bar.querySelector('.rf-m-actions #mobileSearchButton'));assert.ok(bar.querySelector('.rf-m-actions #mobileListButton'));
 assert.equal(d.getElementById('mobileMenuButton').getAttribute('aria-controls'),'mobileMenu');
 const css=read('ui-updates.css');assert.match(css,/--rf-zoom:1\.1\b/);assert.match(css,/html\{zoom:var\(--rf-zoom\)\}/);assert.doesNotMatch(css,/1\.25/);
 const html=read('index.html');assert.match(html,/mobile\.css\?v=/);assert.match(html,/mobile-shell\.js\?v=/);
 const mobile=read('mobile.css');assert.match(mobile,/@media\(max-width:650px\)/);assert.match(mobile,/aspect-ratio:16\/8\.5/,'short carousel on phones');
});

test('search opens under the bar, gets the focus and closes again',async t=>{
 const {w,d}=await page(t,{products});
 const button=d.getElementById('mobileSearchButton');
 assert.equal(d.body.classList.contains('rf-m-search-open'),false);assert.equal(button.getAttribute('aria-expanded'),'false');
 button.click();
 assert.equal(d.body.classList.contains('rf-m-search-open'),true);assert.equal(d.activeElement,d.getElementById('search'));
 assert.match(button.getAttribute('aria-label'),/Cerrar búsqueda/);
 button.click();assert.equal(d.body.classList.contains('rf-m-search-open'),false);
 w.dispatchEvent(new w.HashChangeEvent('hashchange'));assert.equal(d.body.classList.contains('rf-m-search-open'),false);
});

test('side menu: shortcuts, categories, dollar, language and theme; Escape closes it',async t=>{
 const {w,d,run}=await page(t,{products});
 const open=d.getElementById('mobileMenuButton'),menu=d.getElementById('mobileMenu');
 assert.equal(menu.hidden,true);
 open.click();
 assert.equal(menu.hidden,false);assert.equal(open.getAttribute('aria-expanded'),'true');assert.equal(menu.getAttribute('role'),'dialog');
 assert.deepEqual([...menu.querySelectorAll('.rf-m-tile')].map(b=>b.dataset.m),['offers','stores','list']);
 const rows=[...menu.querySelectorAll('.rf-m-row')].map(r=>r.textContent);
 assert.ok(rows.includes('Todas las categorías'));assert.ok(rows.some(r=>r.includes('Perfumes')));
 assert.equal(menu.querySelector('.rf-m-rates'),null,'preferences are separate from categories');
 menu.querySelector('.rf-m-tile[data-m=stores]').click();
 await new Promise(r=>setTimeout(r,10));
 assert.equal(w.location.hash,'#/tiendas');assert.equal(open.getAttribute('aria-expanded'),'false');
 d.getElementById('mobileSettingsButton').click();
 assert.ok(menu.querySelector('.rf-m-rates .rf-rate-row'),'rates are accessible from the gear');
 const [es,pt]=menu.querySelectorAll('.rf-m-segment')[0].querySelectorAll('button');
 assert.equal(es.getAttribute('aria-pressed'),'true');pt.click();
 assert.equal(d.getElementById('languageToggle').value,'pt-BR');
 let themeClicks=0;d.getElementById('themeToggle').addEventListener('click',()=>themeClicks++);
 menu.querySelectorAll('.rf-m-segment')[1].querySelectorAll('button')[1].click();assert.equal(themeClicks,1);
 menu.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
 assert.equal(open.getAttribute('aria-expanded'),'false');
 run("for(const g of PRODUCT_GROUPS)favorites.add(g.key);persistShopping();");
 await new Promise(r=>setTimeout(r,20));
 assert.equal(d.querySelector('#mobileListButton .rf-m-count').textContent,'1');assert.equal(d.querySelector('#mobileListButton .rf-m-count').hidden,false);
});

test('categories in the phone menu use the same families, brands and types as the desktop menu',()=>{
 assert.match(read('explore.js'),/families:\(\)=>families,ready:\(\)=>facetsReady\(\),build:\(\)=>buildFacets\(\)/);
 const shell=read('mobile-shell.js');assert.match(shell,/explore\(\)\.activateFacet\(f\)/);assert.match(shell,/activateFacet\(item\)/);
});

test('social links use existing icons beside the drawer brand and settings have their own trigger',async t=>{
 const {w,d}=await page(t,{products});const source=d.getElementById('footerSocial');source.hidden=false;
 source.innerHTML='<a href="https://example.com/social" aria-label="Instagram"><img class="rf-app-icon" src="icons/social/instagram.svg" alt=""></a>';
 d.getElementById('mobileMenuButton').click();
 const menu=d.getElementById('mobileMenu'),link=menu.querySelector('.rf-m-head .rf-m-head-social a');
 assert.equal(link.href,'https://example.com/social');assert.equal(link.querySelector('img').getAttribute('src'),'icons/social/instagram.svg');assert.equal(menu.querySelector('.rf-m-section .rf-m-social'),null);
 const gear=d.getElementById('mobileSettingsButton');gear.click();assert.equal(gear.getAttribute('aria-expanded'),'true');assert.equal(menu.querySelector('.rf-m-head-social'),null);assert.ok(menu.querySelector('[aria-label="Idioma"]'));assert.ok(menu.querySelector('[aria-label="Tema"]'));
 menu.querySelector('.rf-rate-row[data-currency="USD"]').click();assert.equal(menu.querySelector('.rf-rate-row[data-currency="USD"]').getAttribute('aria-pressed'),'true');
 menu.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(gear.getAttribute('aria-expanded'),'false');
});

test('the SEO heading is published above the footer, not above the shop',()=>{
 const builder=read('tools/build_seo.cjs');
 assert.match(builder,/html\.replace\('<footer>',`<section class="seo-home-heading"/);
 assert.doesNotMatch(builder,/html\.replace\('<main>',`<main><section class="seo-home-heading"/);
});
