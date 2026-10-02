const {test}=require('node:test');const assert=require('node:assert/strict');const {JSDOM}=require('jsdom');const vm=require('node:vm');const fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
const wait=ms=>new Promise(r=>setTimeout(r,ms));

async function page(t,{saved={},fetcher}={}){
 const dom=new JSDOM(read('index.html'),{url:'https://rivfree.test/',runScripts:'outside-only',pretendToBeVisual:true});t.after(()=>dom.window.close());
 const w=dom.window,d=w.document,run=code=>vm.runInContext(code,dom.getInternalVMContext());
 w.matchMedia=()=>({matches:false,addEventListener(){}});w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
 const calls=[];w.fetch=async(url,options)=>{calls.push({url:String(url),options});if(fetcher)return fetcher(String(url));throw Error('offline');};
 w.localStorage.setItem('rivfree-language','es');
 for(const [key,value] of Object.entries(saved))w.localStorage.setItem(key,value);
 for(const file of ['matching.js','catalog.js','catalog-cache.js','features.js','shared-list-codec.js','shopping.js','storefront.js','product-details.js','app.js','nav-bar.js'])run(read(file).replace(/initStorefront\(\);\s*loadData\(\);\s*$/,''));
 run(`var prepared=prepareCatalog({productos:[{nombre:'Perfume 100ml',tienda:'DFA',url:'https://dfa.test/1',precio_usd:100,categoria:'perfumes'}]});ALL_PRODUCTS=prepared.products;PRODUCT_GROUPS=prepared.groups;STORE_INFO={};populateFilters();render();`);
 return {w,d,run,calls};
}
const today=()=>new Date().toISOString().slice(0,10);
const live=[{date:'2026-10-02',base:'USD',quote:'BRL',rate:5.2006},{date:'2026-10-02',base:'USD',quote:'UYU',rate:40.387},{date:'2026-10-02',base:'USD',quote:'ARS',rate:1526.29}];

test('the browser asks Frankfurter for today\'s rate (no cookies, no referrer) and updates the dollar shown',async t=>{
 const {d,run,calls}=await page(t,{fetcher:url=>url.startsWith('https://api.frankfurter.dev/')?{ok:true,json:async()=>live}:Promise.reject(Error('offline'))});
 run(`automaticExchange={rates:{BRL:{rate:5.18,date:'2026-10-01',source:'Frankfurter'}}};updateExchangeNote()`);
 assert.match(d.getElementById('navExchangeValue').textContent,/5,18/);
 assert.equal(await run('refreshLiveRates()'),true);
 const call=calls.find(c=>c.url.startsWith('https://api.frankfurter.dev/'));
 assert.equal(call.url,'https://api.frankfurter.dev/v2/rates?base=USD&quotes=BRL,UYU,ARS');
 assert.equal(call.options.credentials,'omit');assert.equal(call.options.referrerPolicy,'no-referrer');
 assert.equal(run('automaticExchange.rates.BRL.rate'),5.2006);assert.equal(run('automaticExchange.rates.ARS.rate'),1526.29);
 assert.match(d.getElementById('navExchangeValue').textContent,/5,20/,'the bar shows the new rate');
 const before=calls.length;assert.equal(await run('refreshLiveRates()'),false,'at most every 30 minutes');assert.equal(calls.length,before);
 run(`automaticExchange=mergeExchange(automaticExchange,{rates:{BRL:{rate:5.19,date:'2026-10-02',source:'Frankfurter',checked:'2026-10-02T08:00:00Z'}}})`);
 assert.equal(run('automaticExchange.rates.BRL.rate'),5.2006,'an earlier check of the same day does not replace a later one');
 run(`automaticExchange=mergeExchange(automaticExchange,{rates:{BRL:{rate:5.077,date:'2026-07-25',source:'Frankfurter'}}})`);
 assert.equal(run('automaticExchange.rates.BRL.rate'),5.2006,'an older day never replaces a newer one');
 assert.match(read('index.html'),/connect-src 'self' https:\/\/api\.frankfurter\.dev/);
});

test('without the API, the published rate keeps working',async t=>{
 const {run}=await page(t);
 run(`automaticExchange={rates:{BRL:{rate:5.18,date:'2026-10-01',source:'Frankfurter'}}};updateExchangeNote()`);
 assert.equal(await run('refreshLiveRates(true)'),false);
 assert.equal(run('exchange.rate'),5.18);
});

test('a rate typed by hand only lasts that day; older ones no longer hide the real rate',async t=>{
 const {run}=await page(t,{saved:{'rivfree-manual-rates':JSON.stringify({BRL:{rate:4.9,actualizado:'2026-06-01'},UYU:{rate:41,actualizado:today()}}),'rivfree-exchange':JSON.stringify({usd_brl:4.5,actualizado:'2025-12-01'})}});
 assert.deepEqual(JSON.parse(run('JSON.stringify(manualRates)')),{UYU:{rate:41,actualizado:today()}});
 assert.equal(run(`localStorage.getItem('rivfree-exchange')`),null);
 run(`automaticExchange={rates:{BRL:{rate:5.2,date:'2026-10-02',source:'Frankfurter'}}};referenceCurrency='BRL';updateExchangeNote()`);
 assert.equal(run('exchange.rate'),5.2);
});
