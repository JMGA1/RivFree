const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
function fixture(fn){const temp=fs.mkdtempSync(path.join(os.tmpdir(),'rivfree-seo-'));try{
 for(const folder of ['tools','data','_site'])fs.mkdirSync(path.join(temp,folder));
 for(const f of ['tools/build_seo.cjs','catalog.js','matching.js','app.js','seo-config.json'])fs.copyFileSync(path.join(root,f),path.join(temp,f));
 fs.copyFileSync(path.join(root,'index.html'),path.join(temp,'_site/index.html'));
 const p={nombre:'Dior Sauvage EDT 100 ml',tienda:'Test Shop',url:'https://example.com/p',categoria:'perfumes',imagen:'https://example.com/p.png',precio_usd:20};
 const data={actualizado:'2026-09-20',productos:[p,{...p,tienda:'Second Shop',url:'https://example.org/p',precio_usd:25},{...p,nombre:'<img src=x onerror=alert(1)>',url:'https://example.com/escaped',precio_usd:null},{...p,nombre:'Unsafe',url:'javascript:alert(1)'},...Array.from({length:11},(_,i)=>({...p,nombre:'Distinct item '+i,tienda:'Shop '+i,url:'https://example.com/'+i}))]};
 for(const [f,d] of Object.entries({'products.json':data,'manual-products.json':{productos:[{...p,nombre:'Manual Produto',url:'https://example.com/manual',precio_usd:45},{...p,nombre:'Hidden',activo:false,url:'https://example.com/hidden'}]},'stores.json':{},'manual-stores.json':{tiendas:{}}}))fs.writeFileSync(path.join(temp,'data',f),JSON.stringify(d));
 fn(temp);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}}
test('SEO renders visible escaped content, pagination, language pairs, safe prices and manual products',()=>fixture(temp=>{
 const cfg=JSON.parse(fs.readFileSync(path.join(temp,'seo-config.json')));cfg.page_size=10;fs.writeFileSync(path.join(temp,'seo-config.json'),JSON.stringify(cfg));
 execFileSync(process.execPath,[path.join(temp,'tools/build_seo.cjs'),path.join(temp,'_site')]);
 const html=fs.readdirSync(path.join(temp,'_site/pt/produtos')).map(d=>fs.readFileSync(path.join(temp,'_site/pt/produtos',d,'index.html'),'utf8')).join('\n');
 assert.ok(html.includes('Manual Produto'));assert.ok(!html.includes('javascript:'));assert.ok(!html.includes('>Hidden<'));assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));assert.ok(!html.includes('<img src=x'));
 const sitemap=fs.readFileSync(path.join(temp,'_site/sitemaps/pages-1.xml'),'utf8');
 for(const folder of fs.readdirSync(path.join(temp,'_site/pt/produtos'))){const page=fs.readFileSync(path.join(temp,'_site/pt/produtos',folder,'index.html'),'utf8');const canonical=page.match(/rel="canonical" href="([^"]+)"/)[1];if(page.includes('content="noindex,follow"')){assert.ok(!sitemap.includes(canonical));assert.ok(!page.includes('hreflang='));}else{assert.ok(sitemap.includes(canonical));assert.ok(page.includes('Second Shop'));}}
 const home=fs.readFileSync(path.join(temp,'_site/index.html'),'utf8'),es=fs.readFileSync(path.join(temp,'_site/index-es.html'),'utf8');
 assert.ok(home.includes('hreflang="x-default"'));assert.ok(es.includes('data-seo-home="es"'));assert.ok(home.includes('href="icons/favicon.svg"'));assert.ok(!home.includes('href="data:'));assert.ok(home.includes('aria-label="Alterar idioma"'));assert.ok(home.includes('placeholder="Ex.:'));assert.equal((home.match(/<h1\b[^>]*>/g)||[]).length,1);assert.ok(home.includes('<main><section class="seo-home-heading" aria-labelledby="homeIntroTitle"><h1 id="homeIntroTitle">Compare preços'));assert.ok(!sitemap.includes('/privacy.html'));
 const first=fs.readFileSync(path.join(temp,'_site/pt/categorias/perfumes/index.html'),'utf8');const second=fs.readFileSync(path.join(temp,'_site/pt/categorias/perfumes/pagina/2/index.html'),'utf8');const description=h=>h.match(/name="description" content="([^"]+)"/)[1];assert.notEqual(description(first),description(second));assert.ok(description(second).includes('Página 2/'));assert.ok(description(second).includes('11–'));
 assert.ok(home.includes('<h1 id="homeIntroTitle">Compare preços'));assert.ok(es.includes('<h1 id="homeIntroTitle">Compará precios'));
 assert.ok(!html.includes('1 lojas'));assert.ok(html.includes('1 loja.'));assert.ok(html.includes('A partir de USD'));assert.ok(html.includes('· Perfumes.'));assert.ok(html.includes('application/ld+json'));assert.ok(!html.includes('InStock'));assert.ok(!html.includes('USD 0.00'));assert.ok(html.includes('hreflang="es"'));assert.ok(fs.existsSync(path.join(temp,'_site/pt/categorias/perfumes/pagina/2/index.html')));
 assert.ok(fs.readFileSync(path.join(temp,'_site/sitemap.xml'),'utf8').includes('<sitemapindex'));
}));
test('Custom domain updates canonical, sitemap, social URLs and verification; keys remain stable',()=>fixture(temp=>{
 const runner=`const {build}=require('./tools/build_seo.cjs');build('_site',JSON.parse(process.argv[1]));`;
 execFileSync(process.execPath,['-e',runner,JSON.stringify({site_url:'https://www.rivfree.com/',google_site_verification:'test-token'})],{cwd:temp});
 const home=fs.readFileSync(path.join(temp,'_site/index.html'),'utf8');assert.ok(home.includes('content="test-token"'));assert.ok(!home.includes('jmga1.github.io'));assert.ok(home.includes('href="https://www.rivfree.com/"'));
 const sitemap=fs.readFileSync(path.join(temp,'_site/sitemaps/pages-1.xml'),'utf8');assert.ok(!sitemap.includes('jmga1.github.io'));assert.ok(sitemap.includes('https://www.rivfree.com/pt/'));
 const names=fs.readdirSync(path.join(temp,'_site/pt/produtos'));
 const products=JSON.parse(fs.readFileSync(path.join(temp,'data/products.json')));products.productos[0].precio_usd=23;fs.writeFileSync(path.join(temp,'data/products.json'),JSON.stringify(products));
 fs.copyFileSync(path.join(root,'index.html'),path.join(temp,'_site/index.html'));
 execFileSync(process.execPath,['-e',runner,JSON.stringify({site_url:'https://www.rivfree.com/'})],{cwd:temp});assert.deepEqual(fs.readdirSync(path.join(temp,'_site/pt/produtos')),names);
}));
