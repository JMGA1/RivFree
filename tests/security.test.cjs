const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const {JSDOM}=require('jsdom');
const read=p=>fs.readFileSync(p,'utf8');
test('untrusted site colors cannot inject CSS and prototype keys are ignored',async t=>{
 const dom=new JSDOM(read('index.html'),{url:'https://example.test/',runScripts:'outside-only'});t.after(()=>dom.window.close());const w=dom.window;w.fetch=async()=>({ok:false});
 w.eval(read('site-config.js'));await w.RIVFREE_SITE_READY;
 w.applyRivFreeSiteConfig(JSON.parse('{"__proto__":{"polluted":true},"appearance":{"colors_customized":true,"light":{"background":"red;} body{display:none} /*","primary":"#123456"}}}'));
 const css=w.document.getElementById('rivfreeStudioTheme').textContent;
 assert.ok(!css.includes('display:none'));assert.ok(css.includes('#123456'));assert.equal(w.RIVFREE_SITE_CONFIG.polluted,undefined);
});
test('Studio renders malicious health fields only as text',t=>{
 const dom=new JSDOM(read('tools/manual_editor/index.html'),{url:'http://localhost:8765/',runScripts:'outside-only'});t.after(()=>dom.window.close());const w=dom.window;
 const payload='<img src=x onerror="window.pwned=1">';const state={mode:'owner',site_config:{},highlights:{hero:[]},products:[],health:{[payload]:{estado:payload,fallos_consecutivos:payload}},meta:{},revision:'x'};
 w.RivFreeEditor={getState:()=>state,setExternalDirty(){},notify(){},clearFieldErrors(){}};w.HTMLElement.prototype.scrollIntoView=()=>{};
 w.eval(read('tools/manual_editor/studio-editor.js'));w.dispatchEvent(new w.CustomEvent('rivfree-editor-state',{detail:state}));
 const root=w.document.getElementById('healthStores');assert.equal(root.querySelector('img'),null);assert.ok(root.textContent.includes(payload));assert.equal(w.pwned,undefined);
});
test('external URLs reject embedded credentials and HTTP',()=>{
 const vm=require('node:vm'),ctx=vm.createContext({URL,Matching:require('../matching.js').Matching});vm.runInContext(read('catalog.js'),ctx);const safeHttpUrl=ctx.safeHttpUrl;assert.equal(safeHttpUrl('https://u:secret@example.com'),null);assert.equal(safeHttpUrl('http://example.com'),null);assert.equal(safeHttpUrl('https://example.com'),'https://example.com/');
});
test('issue errors neutralize mentions, fences and credential URLs',async()=>{
 const run=require('../.github/scraper-alerts.cjs');const original=fs.readFileSync;let body;
 fs.readFileSync=(file,...args)=>file==='data/stores.json'?JSON.stringify({Shop:{}}):file==='data/health.json'?JSON.stringify({Shop:{fallos_consecutivos:3,error:'```\n@everyone https://u:secret@example.com'}}):original(file,...args);
 try{await run({context:{repo:{owner:'x',repo:'x'}},github:{paginate:async()=>[],rest:{issues:{listForRepo(){},create:async data=>{body=data.body;}}}}});}finally{fs.readFileSync=original;}
 assert.ok(!body.includes('@everyone'));assert.ok(!body.includes('secret'));assert.equal((body.match(/```/g)||[]).length,2);
});
