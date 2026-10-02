const {test}=require('node:test');const assert=require('node:assert/strict');const {JSDOM}=require('jsdom');const vm=require('node:vm');const fs=require('node:fs');
const os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
const read=p=>fs.readFileSync(p,'utf8');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const {mergeCatalogData,prepareCatalog,applyCorrections,imageThumbUrl}=require('../catalog.js');
const {correctionsSuffix}=require('../catalog-cache.js');

const base={productos:[
 {tienda:'DFA',url:'https://dfa.test/1',nombre:'Perfum X 100ml',precio_usd:50,categoria:'perfumes'},
 {tienda:'DFA',url:'https://dfa.test/2',nombre:'Oculto',precio_usd:10,categoria:'otros'},
 {tienda:'DFA',url:'https://dfa.test/3',nombre:'Precio viejo',precio_usd:40,categoria:'otros',caida_precio:{precio_anterior:50}},
 {tienda:'DFA',url:'https://dfa.test/4',nombre:'Precio fijo',precio_usd:40,categoria:'otros'}]};
const corrections={version:'c1',correcciones:{
 'DFA|https://dfa.test/1':{nombre:'Perfume X EDP 100ml',categoria:'cosmetica',precio_usd:45,precio_original_usd:60,precio_base:50},
 'DFA|https://dfa.test/2':{oculto:true},
 'DFA|https://dfa.test/3':{precio_usd:35,precio_base:30},
 'DFA|https://dfa.test/4':{precio_usd:33,precio_base:30,precio_fijo:true},
 'DFA|https://dfa.test/gone':{nombre:'Ya no existe'}}};

test('corrections rename, recategorize, hide and re-price store products; a stale price gives way to the store',()=>{
 const merged=mergeCatalogData(base,{productos:[{nombre:'Manual',tienda:'Local',precio_usd:3}]},corrections);
 const byUrl=Object.fromEntries(merged.productos.map(p=>[p.url||p.nombre,p]));
 assert.equal(byUrl['https://dfa.test/2'],undefined,'hidden');
 assert.deepEqual([byUrl['https://dfa.test/1'].nombre,byUrl['https://dfa.test/1'].precio_usd,byUrl['https://dfa.test/1'].en_oferta],['Perfume X EDP 100ml',45,true]);
 assert.equal(byUrl['https://dfa.test/3'].precio_usd,40,'the store changed the price since the correction');
 assert.ok(byUrl['https://dfa.test/3'].caida_precio,'store data untouched');
 assert.equal(byUrl['https://dfa.test/4'].precio_usd,33,'fixed price wins');
 assert.ok(byUrl.Manual,'manual products are kept');
 const {products}=prepareCatalog(merged);
 assert.equal(products.find(p=>p.url==='https://dfa.test/1').categoryId,'cosmetica','the chosen category is kept even for a perfume name');
 assert.equal(applyCorrections(base.productos,null),base.productos);
 assert.equal(applyCorrections(base.productos,{correcciones:[]}),base.productos,'invalid file is ignored');
 const unsafe=applyCorrections(base.productos,{correcciones:{'DFA|https://dfa.test/1':{imagen:'javascript:alert(1)',categoria:'<b>'}}});
 assert.equal(unsafe[0].imagen,undefined);assert.equal(unsafe[0].categoria,'perfumes');
});

test('catalog cache: the version changes only when there are corrections',()=>{
 assert.equal(correctionsSuffix(null),'');assert.equal(correctionsSuffix({correcciones:{}}),'');
 assert.equal(correctionsSuffix(corrections),'|fix:c1');
 const cache=read('catalog-cache.js');
 assert.match(cache,/fetchOptionalJson\('data\/product-corrections\.json',null\)/);
 assert.match(cache,/new Worker\('catalog-worker\.js\?v=20261002-v84'\)/);
 assert.match(read('catalog-worker.js'),/'catalog\.js\?v=20261002-v84','catalog-cache\.js\?v=20261002-v84'/);
 assert.equal(imageThumbUrl('assets/manual/fachada-1.webp'),'assets/manual/fachada-1-thumb.webp');
 assert.equal(imageThumbUrl('https://x.test/a.webp'),'https://x.test/a.webp');
});

test('static pages apply the corrections too',()=>{
 const root=path.resolve(__dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'rivfree-fix-'));
 try{
  for(const folder of ['tools','data','_site'])fs.mkdirSync(path.join(temp,folder));
  for(const f of ['tools/build_seo.cjs','catalog.js','matching.js','app.js','seo-config.json'])fs.copyFileSync(path.join(root,f),path.join(temp,f));
  fs.copyFileSync(path.join(root,'index.html'),path.join(temp,'_site/index.html'));
  const p={nombre:'Dior Sauvage EDT 100 ml',tienda:'Test Shop',url:'https://example.com/p',categoria:'perfumes',precio_usd:20};
  const files={'products.json':{productos:[p,{...p,tienda:'Second Shop',url:'https://example.org/p',precio_usd:25},{...p,nombre:'Producto Secreto 1L',url:'https://example.com/secret'}]},
   'manual-products.json':{productos:[]},'stores.json':{},'manual-stores.json':{tiendas:{}},
   'product-corrections.json':{correcciones:{'Test Shop|https://example.com/secret':{oculto:true},'Second Shop|https://example.org/p':{precio_usd:18,precio_base:25}}}};
  for(const [f,d] of Object.entries(files))fs.writeFileSync(path.join(temp,'data',f),JSON.stringify(d));
  execFileSync(process.execPath,[path.join(temp,'tools/build_seo.cjs'),path.join(temp,'_site')]);
  const html=fs.readdirSync(path.join(temp,'_site/pt/produtos')).map(d=>read(path.join(temp,'_site/pt/produtos',d,'index.html'))).join('\n');
  assert.ok(!html.includes('Producto Secreto'),'hidden products get no page');
  assert.ok(html.includes('USD 18.00'),'corrected price');
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});

async function site(t,{stores}){
 const dom=new JSDOM(read('index.html'),{url:'https://rivfree.test/',runScripts:'outside-only',pretendToBeVisual:true});t.after(()=>dom.window.close());
 const w=dom.window,d=w.document,run=code=>vm.runInContext(code,dom.getInternalVMContext());
 w.matchMedia=()=>({matches:false,addEventListener(){}});w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.fetch=async()=>{throw Error('offline');};
 w.localStorage.setItem('rivfree-language','es');
 for(const file of ['matching.js','catalog.js','catalog-cache.js','features.js','shared-list-codec.js','shopping.js','storefront.js','product-details.js','app.js','store-directory.js','experience.js','explore-model.js','category-index.js','explore.js','nav-bar.js'])run(read(file).replace(/initStorefront\(\);\s*loadData\(\);\s*$/,''));
 run(`var prepared=prepareCatalog({productos:[{nombre:'Perfume 100ml',tienda:'Barão Free Shop',url:'https://b.test/1',precio_usd:10,categoria:'perfumes'}]});ALL_PRODUCTS=prepared.products;PRODUCT_GROUPS=prepared.groups;STORE_INFO=${JSON.stringify(stores)};populateFilters();render();`);
 return {w,d,run};
}
const go=async(w,hash)=>{w.location.hash=hash;w.dispatchEvent(new w.HashChangeEvent('hashchange'));await wait(30);};

test('store page: the first photo is the cover, the gallery loads small versions; the directory shows the facade',async t=>{
 const photos=[{url:'assets/manual/fachada-abc.webp',caption:'Fachada',attribution:'Foto: RivFree'},{url:'https://maps.test/interior.jpg',caption:'Interior'},{url:'javascript:alert(1)'}];
 const {w,d}=await site(t,{stores:{'Barão Free Shop':{nombre_completo:'Barão Free Shop',photos}}});
 await go(w,'#/tienda/'+encodeURIComponent('Barão Free Shop'));
 const cover=d.querySelector('#detailPage .rf-store-cover img');
 assert.equal(cover.getAttribute('src'),'assets/manual/fachada-abc.webp');assert.equal(cover.alt,'Fachada');
 const gallery=[...d.querySelectorAll('#detailPage .rf-photos img')].map(img=>img.getAttribute('src'));
 assert.deepEqual(gallery,['assets/manual/fachada-abc-thumb.webp','https://maps.test/interior.jpg'],'unsafe links are skipped');
 assert.equal(d.querySelector('#detailPage .rf-photos a').getAttribute('href'),'assets/manual/fachada-abc.webp');
 assert.match(d.querySelector('#detailPage .rf-photos figcaption').textContent,/Fachada · Foto: RivFree/);
 await go(w,'#/tiendas');
 const card=d.querySelector('.rf-store-card-v5.has-photo');assert.ok(card,'directory card with photo');
 assert.equal(card.querySelector('.rf-store-photo img').getAttribute('src'),'assets/manual/fachada-abc-thumb.webp');
});

async function studio(t,api){
 const dom=new JSDOM(read('tools/manual_editor/index.html'),{url:'http://127.0.0.1:8765/tools/manual_editor/',runScripts:'outside-only',pretendToBeVisual:true});t.after(()=>dom.window.close());
 const w=dom.window,d=w.document,run=code=>vm.runInContext(code,dom.getInternalVMContext());
 const calls=[],notes=[];let dirty=false;
 w.RivFreeEditor={api:async(path,payload)=>{calls.push({path,payload:JSON.parse(JSON.stringify(payload))});return api(path,payload);},notify:(...a)=>notes.push(a),
  confirmDialog:async()=>true,setDirty:v=>{dirty=v;},hasUnsaved:()=>dirty,setFieldError:(el,text)=>{el.dataset.error=text;},clearFieldErrors:()=>{},getState:()=>({mode:'owner'})};
 for(const file of ['matching.js','catalog.js'])run(read(file));
 for(const file of ['catalog-fields.js','store-photos.js','catalog-editor.js'])run(read('tools/manual_editor/'+file));
 return {w,d,run,calls,notes};
}

test('Studio → Catálogo: only searched products are listed; saving sends only what changed',async t=>{
 const item={key:'DFA|https://dfa.test/1',tienda:'DFA',url:'https://dfa.test/1',nombre:'Dior Sauvage EDT 100ml',categoria:'perfumes',precio_usd:120,precio_original_usd:null,en_oferta:false,imagen:'https://dfa.test/1.jpg',missing:false,correction:null};
 const {w,d,calls}=await studio(t,(path,payload)=>{
  if(path.endsWith('catalog-search'))return payload.q?{items:[item],total:1,stores:['DFA'],corrections_count:0,message:''}:{items:[],total:0,stores:['DFA'],corrections_count:0,message:'Escribí qué producto buscás'};
  if(path.endsWith('save-correction'))return {item:{...item,correction:{...payload.correction}},corrections_count:1,message:'Corrección guardada.'};
  throw Error('unexpected '+path);
 });
 w.RivFreeCatalogEditor.search();await wait(20);
 assert.equal(d.querySelectorAll('#catalogResults .catalog-item').length,0,'nothing listed until a search');
 assert.deepEqual([...d.getElementById('catalogStore').options].map(o=>o.value),['','DFA']);
 d.getElementById('catalogSearch').value='sauvage';await w.RivFreeCatalogEditor.search();await wait(20);
 assert.equal(calls.at(-1).payload.q,'sauvage');
 d.querySelector('#catalogResults .catalog-item').click();await wait(20);
 assert.equal(d.getElementById('catalogName').value,'Dior Sauvage EDT 100ml');assert.equal(d.getElementById('catalogCategory').value,'perfumes');
 assert.match(d.getElementById('catalogPriceOriginal').textContent,/USD 120\.00/);
 d.getElementById('catalogName').value='Dior Sauvage EDT 100 ml';d.getElementById('catalogPrice').value='99,90';
 d.getElementById('catalogForm').dispatchEvent(new w.Event('submit',{cancelable:true}));await wait(30);
 const saved=calls.find(c=>c.path.endsWith('save-correction'));
 assert.deepEqual(saved.payload,{key:item.key,correction:{nombre:'Dior Sauvage EDT 100 ml',precio_usd:'99.90',precio_original_usd:'',en_oferta:false,precio_fijo:false}});
 assert.equal(d.getElementById('catalogBadge').textContent,'Corregido');assert.equal(d.getElementById('catalogCorrectionCount').textContent,'1');
 const preview=w.RivFreeCatalogEditor.previewProduct();assert.equal(preview.nombre,'Dior Sauvage EDT 100 ml');assert.equal(preview.tienda,'DFA');
});

test('Studio → Tiendas: photos are uploaded, reordered and kept in the store data',async t=>{
 let n=0;const {w,d,calls}=await studio(t,path=>{if(path.endsWith('upload-image'))return {path:`assets/manual/foto-${++n}.webp`};throw Error(path);});
 w.RivFreeCatalogFields.fillStore({photos:[]});
 assert.match(d.getElementById('storePhotoList').textContent,/Todavía no hay fotos/);
 const input=d.getElementById('storePhotoFiles');
 Object.defineProperty(input,'files',{configurable:true,value:[new w.File(['a'],'IMG_1.HEIC',{type:'image/heic'}),new w.File(['b'],'IMG_2.HEIC',{type:'image/heic'})]});
 input.dispatchEvent(new w.Event('change'));await wait(60);
 assert.equal(calls.filter(c=>c.path.endsWith('upload-image')).length,2);assert.equal(calls[0].payload.filename,'IMG_1.HEIC');
 assert.equal(d.getElementById('storePhotos').value,'assets/manual/foto-1.webp | Fachada | Foto: RivFree\nassets/manual/foto-2.webp |  | Foto: RivFree');
 const items=d.querySelectorAll('.store-photo');assert.equal(items.length,2);assert.ok(items[0].querySelector('.store-photo-cover'));
 assert.equal(items[0].querySelector('img').getAttribute('src'),'/assets/manual/foto-1-thumb.webp');
 [...items[1].querySelectorAll('button')].find(b=>b.textContent==='Usar de portada').click();
 assert.deepEqual([...w.RivFreeCatalogFields.store().photos.map(p=>p.url)],['assets/manual/foto-2.webp','assets/manual/foto-1.webp']);
});
