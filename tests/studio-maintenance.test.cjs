const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const read=p=>fs.readFileSync(p,'utf8');
const wait=()=>new Promise(r=>setTimeout(r,300));
async function setup(t){
 const dom=new JSDOM(read('tools/manual_editor/index.html'),{url:'http://localhost/tools/manual_editor/?token=test',runScripts:'outside-only'});
 t.after(()=>dom.window.close());const w=dom.window,d=w.document,calls=[];
 let dirty=false;
 const state={products:[{id:'manual-one',nombre:'JBL Flip 6',tienda:'DFA',historial_precios:[{fecha:'2026-09-27T12:00:00Z',precio_usd:100}]}]};
 d.getElementById('productStore').innerHTML='<option>DFA</option><option>Neutral</option>';
 w.fetch=async()=>({ok:true,json:async()=>({productos:[]})});
 w.RivFreeEditor={ready:Promise.resolve(),getState:()=>state,hasUnsaved:()=>dirty,notify(){},confirmDialog:async()=>true,api:async(path,payload)=>{calls.push({path,payload});return {review:'abc',scope:['data/site-config.json'],branch:'main',upstream:'origin/main',status:'M data/site-config.json',diff:'1 change',message:'Push completado',output:'OK'};}};
 w.eval(read('matching.js')+'\n'+read('tools/manual_editor/maintenance.js'));
 await wait();return {w,d,calls,dirty:v=>dirty=v};
}
test('publishing requires review and blocks unsaved changes',async t=>{
 const {d,calls,dirty}=await setup(t);
 dirty(true);d.getElementById('reviewPublish').click();await wait();assert.equal(calls.length,0);
 dirty(false);d.getElementById('reviewPublish').click();await wait();assert.equal(d.getElementById('confirmPublish').hidden,false);
 d.getElementById('confirmPublish').click();await wait();assert.equal(calls.at(-1).payload.review,'abc');assert.equal(calls.at(-1).payload.confirm,true);assert.equal(d.getElementById('confirmPublish').hidden,true);
});
test('duplicate hint respects store and excludes edited product; history is visible',async t=>{
 const {w,d}=await setup(t);const name=d.getElementById('productName');name.value='JBL Flip 6';name.dispatchEvent(new w.Event('input',{bubbles:true}));await wait();assert.match(d.getElementById('duplicateWarning').textContent,/JBL Flip 6/);
 d.getElementById('productStore').value='Neutral';name.dispatchEvent(new w.Event('input',{bubbles:true}));await wait();assert.equal(d.getElementById('duplicateWarning').textContent,'');
 d.getElementById('productStore').value='DFA';d.getElementById('productId').value='manual-one';name.dispatchEvent(new w.Event('input',{bubbles:true}));await wait();assert.equal(d.getElementById('duplicateWarning').textContent,'');assert.match(d.getElementById('manualPriceHistory').textContent,/100.00/);
 assert.ok(d.querySelector('input[type="color"]').getAttribute('aria-label'));assert.equal(d.getElementById('imagePreview').getAttribute('role'),'group');
});
