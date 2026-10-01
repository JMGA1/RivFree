const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
// Use a real DOM and the complete production site-config script, including async apply.
for(const lang of ['es','pt-BR'])for(const preference of [null,'es','pt-BR'])test(`metadata respects ${lang} page with preference ${preference}`,async()=>{
 const html=read('index.html').replace('<html lang="pt-BR">',`<html lang="${lang}" data-seo-home="${lang}">`).replace('<footer>','<section class="seo-home-heading"><h1>SEO heading</h1></section><footer>');
 const dom=new JSDOM(html,{url:'https://example.test/'+(lang==='es'?'index-es.html':''),runScripts:'outside-only'}),w=dom.window;
 try{
  if(preference)w.localStorage.setItem('rivfree-language',preference);
  const config=JSON.parse(read('data/site-config.json'));
  w.fetch=async()=>({ok:true,json:async()=>config});w.eval(read('site-config.js'));await w.RIVFREE_SITE_READY;
  const suffix=lang==='es'?'es':'pt';
  assert.equal(w.document.querySelector('meta[name="description"]').content,config.seo['description_'+suffix]);
  assert.equal(w.document.querySelector('meta[property="og:title"]').content,config.seo['title_'+suffix]);
  assert.equal(w.document.querySelector('meta[name="twitter:title"]').content,config.seo['title_'+suffix]);
  // The SEO text sits right above the footer; reordering the home sections must not move it.
  assert.equal(w.document.querySelector('footer').previousElementSibling.className,'seo-home-heading');
 }finally{w.close();}
});
test('privacy draft is noindex',()=>assert.match(read('privacy.html'),/name="robots" content="noindex,follow"/));
test('service worker precaches Spanish and chooses Spanish fallback offline',async()=>{
 const handlers={},stored=new Map();let precached=[];
 const cache={addAll:async list=>{precached=[...list];for(const name of list)stored.set(name,{language:name==='index-es.html'?'es':'pt'});},match:async key=>typeof key==='string'?stored.get(key):undefined};
 const ctx={URL,Response,location:{origin:'https://example.test'},fetch:async()=>{throw Error('offline')},caches:{open:async()=>cache},self:{registration:{scope:'https://example.test/RivFree/'},skipWaiting:async()=>{},addEventListener:(name,fn)=>handlers[name]=fn}};
 vm.runInNewContext(read('sw.js'),ctx);let install;handlers.install({waitUntil:p=>install=p});await install;
 assert.ok(precached.includes('index-es.html'));assert.ok(precached.includes('icons/favicon.svg'));
 for(const relative of ['index-es.html','index-es.html?q=perfume','es/produtos/example/']){let response;handlers.fetch({request:{method:'GET',mode:'navigate',url:'https://example.test/RivFree/'+relative},respondWith:p=>response=p});assert.equal((await response).language,'es');}
});
