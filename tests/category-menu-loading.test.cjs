const {test}=require('node:test'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom'),fs=require('fs'),vm=require('vm');
function page(t){
 const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{url:'https://rivfree.test/',runScripts:'outside-only',pretendToBeVisual:true});t.after(()=>dom.window.close());
 const w=dom.window;w.matchMedia=()=>({matches:false,addEventListener(){}});w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.fetch=async()=>{throw Error('offline');};w.requestIdleCallback=()=>0;
 const run=code=>vm.runInContext(code,dom.getInternalVMContext());
 for(const file of ['matching.js','catalog.js','catalog-cache.js','features.js','shared-list-codec.js','shopping.js','storefront.js','product-details.js','app.js','experience.js','explore-model.js','category-index.js','explore.js'])run(fs.readFileSync(file,'utf8').replace(/initStorefront\(\);\s*loadData\(\);\s*$/,''));
 const menu=w.document.querySelector('.rf-category-menu');
 const load=()=>run("var sample=prepareCatalog({productos:[{nombre:'Apple iPhone 15 128GB',tienda:'DFA',url:'https://example.com/phone',precio_usd:500,categoria:'electronica'}]});ALL_PRODUCTS=sample.products;PRODUCT_GROUPS=sample.groups;");
 return {w,menu,load};
}
test('opening categories refreshes the loading view after the index finishes with menu closed',async t=>{
 const {w,menu,load}=page(t);assert(menu.querySelector('.rf-mega-loading'));
 load();await w.RivFreeExplore.build();assert(w.RivFreeExplore.ready());assert.equal(menu.open,false);
 menu.open=true;await new Promise(resolve=>w.setTimeout(resolve,0));
 assert.equal(menu.querySelector('.rf-mega-loading'),null);
 assert.match(menu.querySelector('#categoryDetailPanel').textContent,/iPhone/);
 assert(menu.querySelector('[data-family="phones"] .rf-mega-count'));
});
test('an already open category menu clears loading when the catalog becomes ready',async t=>{
 const {w,menu,load}=page(t);menu.open=true;await new Promise(resolve=>w.setTimeout(resolve,0));assert(menu.querySelector('.rf-mega-loading'));
 load();await w.RivFreeExplore.build();
 assert.equal(menu.querySelector('.rf-mega-loading'),null);
 assert.match(menu.querySelector('#categoryDetailPanel').textContent,/iPhone/);
});
