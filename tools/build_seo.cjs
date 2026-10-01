/* Static, crawlable catalog. Reuses the storefront's grouping and price rules. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const {Catalog,prepareCatalog,mergeCatalogData,hasPrice,safeImageUrl}=require('../catalog.js');
const ROOT=path.resolve(__dirname,'..');
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const digest=x=>crypto.createHash('sha256').update(String(x)).digest('hex').slice(0,20);
function http(value){try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}}
const slug=x=>String(x).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70)||'item';
function build(dest,overrides={}){
 const cfg={...JSON.parse(fs.readFileSync(path.join(ROOT,'seo-config.json'),'utf8')),...overrides};
 const raw=cfg.site_url,u=new URL(raw);
 if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||!raw.endsWith('/'))throw Error('site_url must be an absolute HTTPS URL ending in /, without query or fragment');
 const base=u.href, pageSize=Number(cfg.page_size);
 if(!Number.isInteger(pageSize)||pageSize<10||pageSize>200)throw Error('page_size must be 10–200');
 const url=p=>base+p;
 const read=f=>JSON.parse(fs.readFileSync(path.join(ROOT,'data',f),'utf8'));
 const data=mergeCatalogData(read('products.json'),read('manual-products.json'));
 const stores={...read('stores.json'),...(read('manual-stores.json').tiendas||{})};
 // Studio → Tiendas → "Ocultar las fotos": those photos are not published in the static pages either.
 const hiddenPhotos=new Set(Object.entries(stores).filter(([,info])=>info&&info.ocultar_fotos===true).map(([name])=>name));
 for(const product of data.productos||[])if(hiddenPhotos.has(product.tienda))product.imagen='';
 const {groups}=prepareCatalog(data);
 const urls=[];let count=0;
 const write=(p,s)=>{const f=path.join(dest,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s);};
 const strings={pt:{lang:'pt-BR',catalog:'Catálogo por categorias e lojas',categories:'Categorias',stores:'Lojas',product:'Produtos',compare:'Comparar preços',open:'Abrir catálogo interativo',source:'Ver publicação original',missing:'Preço indisponível',notice:'RivFree é um comparador independente. Não vendemos produtos nem somos afiliados às lojas. Os preços são indicativos e os catálogos online não garantem estoque físico. Confirme preço e disponibilidade na publicação original.',updated:'Data do catálogo',previous:'Anterior',next:'Próxima',page:'Página',home:'Início'},es:{lang:'es',catalog:'Catálogo por categorías y tiendas',categories:'Categorías',stores:'Tiendas',product:'Productos',compare:'Comparar precios',open:'Abrir catálogo interactivo',source:'Ver publicación original',missing:'Precio no disponible',notice:'RivFree es un comparador independiente. No vendemos productos ni estamos afiliados a las tiendas. Los precios son orientativos y los catálogos online no garantizan stock físico. Confirmá precio y disponibilidad en la publicación original.',updated:'Fecha del catálogo',previous:'Anterior',next:'Siguiente',page:'Página',home:'Inicio'}};
 const productPath=(g,l)=>`${l}/produtos/${digest(g.key)}/`; // Stable across name and price changes.
 const storePath=(s,l)=>`${l}/lojas/${slug(s)}-${digest(s).slice(0,8)}/`;
 const catPath=(c,l)=>`${l}/categorias/${c}/`;
 const image=g=>{const candidate=safeImageUrl(g.image);return candidate?(http(candidate)||url(candidate)):null;};
 function page(p,l,title,description,body,alt,schema,indexable=true){
  const t=strings[l],canonical=url(p),homeUrl=l==='es'?url('index-es.html'):base;
  const alternate=alt&&indexable?`<link rel="alternate" hreflang="pt-BR" href="${esc(url(alt('pt')))}"><link rel="alternate" hreflang="es" href="${esc(url(alt('es')))}"><link rel="alternate" hreflang="x-default" href="${esc(url(alt('pt')))}">`:'';
  const structured=schema?`<script type="application/ld+json">${JSON.stringify(schema).replace(/</g,'\\u003c')}</script>`:'';
  write(p+'index.html',`<!doctype html><html lang="${t.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>${esc(title)} | RivFree</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${esc(canonical)}">${alternate}${indexable?'':'<meta name="robots" content="noindex,follow">'}<link rel="icon" href="${esc(url('icons/favicon.svg'))}" type="image/svg+xml"><meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(canonical)}"><meta property="og:image" content="${esc(url('social-card.png'))}"><link rel="stylesheet" href="${esc(url('seo.css'))}"><link rel="stylesheet" href="${esc(url('consent.css'))}"><script src="${esc(url('tracking-config.js'))}" defer></script><script src="${esc(url('consent.js'))}" defer></script>${structured}</head><body><header><a class="brand" href="${esc(homeUrl)}">RivFree</a><nav><a href="${esc(url(l+'/'))}">${t.catalog}</a><a href="${esc(homeUrl)}#catalogSection">${t.open}</a>${alt?`<a lang="${l==='pt'?'es':'pt-BR'}" href="${esc(url(alt(l==='pt'?'es':'pt')))}">${l==='pt'?'Español':'Português'}</a>`:''}</nav></header><main><h1>${esc(title)}</h1><p>${esc(description)}</p>${body}</main><footer><p>${t.notice}</p><a href="${esc(url('privacy.html'))}">Privacidade / Privacidad</a></footer></body></html>`);
  if(indexable)urls.push(canonical);count++;
 }
 const valid=groups.filter(g=>g.name&&g.offers.some(o=>http(o.url)));
 valid.sort((a,b)=>a.key.localeCompare(b.key));
 function cards(gs,l){const t=strings[l];return '<ul class="cards">'+gs.map(g=>{const img=image(g),prices=g.offers.filter(hasPrice).map(o=>o.precio_usd);return `<li><a href="${esc(url(productPath(g,l)))}">${img?`<img src="${esc(img)}" alt="${esc(g.name)}" loading="lazy" width="180" height="180">`:''}<h2>${esc(g.name)}</h2></a><p>${prices.length?'USD '+Math.min(...prices).toFixed(2):t.missing}</p><p>${esc([...new Set(g.offers.map(o=>o.tienda))].join(' · '))}</p></li>`;}).join('')+'</ul>';}
 function listing(stem,l,title,description,gs,alt,extra=''){
  const total=Math.ceil(gs.length/pageSize)||1,t=strings[l];
  for(let n=1;n<=total;n++){
   const suffix=n===1?'':`pagina/${n}/`,p=stem+suffix;
   const pager=`<nav aria-label="${t.page}">${n>1?`<a href="${esc(url(stem+(n===2?'':`pagina/${n-1}/`)))}">← ${t.previous}</a>`:''}<span>${t.page} ${n} / ${total}</span>${n<total?`<a href="${esc(url(stem+`pagina/${n+1}/`))}">${t.next} →</a>`:''}</nav>`;
   const batch=gs.slice((n-1)*pageSize,n*pageSize),first=(n-1)*pageSize+1,last=Math.min(n*pageSize,gs.length);
   const examples=batch.slice(0,2).map(g=>g.name).join(' · ');
   const pageDescription=`${title}. ${t.page} ${n}/${total}: ${t.product.toLowerCase()} ${first}–${last} ${l==='pt'?'de':'de'} ${gs.length}. ${l==='pt'?'Nesta página':'En esta página'}: ${examples}.`;
   page(p,l,title+(n>1?` · ${t.page} ${n}`:''),pageDescription,extra+pager+cards(batch,l)+pager,x=>alt(x)+suffix);
  }
 }
 for(const l of ['pt','es']){
  const t=strings[l],categories=[...new Set(valid.flatMap(g=>g.offers.map(o=>o.categoryId)))].sort(),names=[...new Set(valid.flatMap(g=>g.offers.map(o=>o.tienda)))].sort();
  const links=(items,fn,label)=>'<ul class="directory-grid">'+items.map(x=>`<li><a href="${esc(url(fn(x,l)))}">${esc(label(x))}</a></li>`).join('')+'</ul>';
  page(l+'/',l,t.catalog, l==='pt'?'Explore produtos dos free shops de Rivera e Santana do Livramento. Compare lojas e consulte as publicações originais.':'Explorá productos de free shops de Rivera y Santana do Livramento. Compará tiendas y consultá las publicaciones originales.',`<h2>${t.categories}</h2>${links(categories,catPath,c=>Catalog.categories[c][l==='pt'?1:0])}<h2>${t.stores}</h2>${links(names,storePath,x=>x)}`,x=>x+'/');
  for(const c of categories)listing(catPath(c,l),l,Catalog.categories[c][l==='pt'?1:0]+' · Free shops',`${t.compare}: ${Catalog.categories[c][l==='pt'?1:0]}. Rivera · Santana do Livramento.`,valid.filter(g=>g.offers.some(o=>o.categoryId===c)),x=>catPath(c,x));
  for(const s of names){const info=stores[s]||{};listing(storePath(s,l),l,s,`${t.product}: ${s}. ${t.compare} · RivFree.`,valid.filter(g=>g.offers.some(o=>o.tienda===s)),x=>storePath(s,x),info.direccion?`<p>${esc(info.direccion)}</p>`:'');}
  for(const g of valid){
   const p=productPath(g,l),img=image(g),offers=g.offers.filter(o=>http(o.url));
   const priced=offers.filter(hasPrice),schema={'@context':'https://schema.org','@type':'Product',name:g.name,url:url(p),...(img?{image:img}:{})};
   if(priced.length)schema.offers={'@type':'AggregateOffer',priceCurrency:'USD',lowPrice:Math.min(...priced.map(o=>o.precio_usd)),highPrice:Math.max(...priced.map(o=>o.precio_usd)),offerCount:priced.length,offers:priced.map(o=>({'@type':'Offer',priceCurrency:'USD',price:o.precio_usd,url:http(o.url),seller:{'@type':'Organization',name:o.tienda}}))};
   const rows=offers.map(o=>`<tr><td><a href="${esc(url(storePath(o.tienda,l)))}">${esc(o.tienda)}</a></td><td>${hasPrice(o)?'USD '+o.precio_usd.toFixed(2):t.missing}</td><td><a rel="noopener noreferrer" href="${esc(http(o.url))}">${t.source}</a></td></tr>`).join('');
   const cat=[...new Set(g.offers.map(o=>o.categoryId))];
   const storeCount=new Set(offers.map(o=>o.tienda)).size,indexable=storeCount>=2;
   const categoryName=cat.map(c=>Catalog.categories[c][l==='pt'?1:0]).join(' / ');
   const priceText=priced.length?(l==='pt'?'A partir de':'Desde')+' USD '+Math.min(...priced.map(o=>o.precio_usd)).toFixed(2):t.missing;
   const storeText=storeCount+' '+(l==='pt'?(storeCount===1?'loja':'lojas'):(storeCount===1?'tienda':'tiendas'));
   const description=`${g.name} · ${categoryName}. ${priceText} · ${storeText}. ${l==='pt'?'Consulte os preços e as publicações originais.':'Consultá los precios y las publicaciones originales.'}`;
   page(p,l,g.name,description,`${img?`<img class="product-image" src="${esc(img)}" alt="${esc(g.name)}" width="320" height="320">`:''}<h2>${t.compare}</h2><div class="table-wrap"><table><thead><tr><th>${t.stores}</th><th>USD</th><th>${t.source}</th></tr></thead><tbody>${rows}</tbody></table></div><p>${t.updated}: ${esc(data.actualizado||'—')}. ${l==='pt'?'Algumas lojas podem conservar dados anteriores.':'Algunas tiendas pueden conservar datos anteriores.'}</p><h2>${t.categories}</h2>${links(cat,catPath,c=>Catalog.categories[c][l==='pt'?1:0])}`,x=>productPath(g,x),indexable&&priced.length?schema:null,indexable);
  }
 }
 // Enhance the interactive entry page without changing its relative asset paths.
 const homeFile=path.join(dest,'index.html');let home=fs.readFileSync(homeFile,'utf8');
 const originalHome=home;
 const app=fs.readFileSync(path.join(ROOT,'app.js'),'utf8'),start=app.indexOf('const translations = '),end=app.indexOf('\nfunction tr(',start);
 const translations=vm.runInNewContext(app.slice(start,end)+'; translations;',{}, {timeout:1000});
 home=home.replace(/(aria-label|placeholder|title)="([^"]*)"/g,(all,attr,value)=>translations[value]?`${attr}="${esc(translations[value])}"`:all);
 home=home.replace(/>([^<>]+)</g,(all,text)=>{const s=text.trim();return translations[s]?'>'+text.replace(s,esc(translations[s]))+'<':all;});
 const title='RivFree | Compare preços de free shops em Rivera e Livramento',desc='Compare preços de perfumes, bebidas, eletrônicos e mais nos free shops de Rivera e Santana do Livramento. Consulte as publicações originais das lojas.';
 home=home.replace(/<title>.*?<\/title>/s,`<title>${title}</title>`).replace(/<meta name="description"[^>]*>/,`<meta name="description" content="${desc}">`);
 home=home.replace(/https:\/\/jmga1.github.io\/RivFree\//g,base);
 home=home.replace(/<meta property="og:title"[^>]*>/,`<meta property="og:title" content="${title}">`).replace(/<meta property="og:description"[^>]*>/,`<meta property="og:description" content="${desc}">`);
 home=home.replace(/<meta name="twitter:title"[^>]*>/,`<meta name="twitter:title" content="${title}">`).replace(/<meta name="twitter:description"[^>]*>/,`<meta name="twitter:description" content="${desc}">`);
 home=home.replace('</head>',`<link rel="canonical" href="${esc(base)}"><meta property="og:url" content="${esc(base)}">${cfg.google_site_verification?`<meta name="google-site-verification" content="${esc(cfg.google_site_verification)}">`:''}</head>`);
 const alternates=`<link rel="alternate" hreflang="pt-BR" href="${esc(base)}"><link rel="alternate" hreflang="es" href="${esc(url('index-es.html'))}"><link rel="alternate" hreflang="x-default" href="${esc(base)}">`;
 function finishHome(html,lang){
  const pt=lang==='pt-BR', heading=pt?'Compare preços de free shops em Rivera e Livramento':'Compará precios de free shops en Rivera y Livramento';
  html=html.replace(/<html lang="[^"]+">/,`<html lang="${lang}" data-seo-home="${lang}">`);
  html=html.replace(/<link rel="icon"[^>]*>/,`<link rel="icon" type="image/svg+xml" href="icons/favicon.svg">`);
  html=html.replace('<h1>Riv<span class="brand-name-free">Free</span></h1>',`<div class="seo-brand-title">Riv<span class="brand-name-free">Free</span></div>`);
  // Visible SEO text goes above the footer (not at the top): Google still reads the H1, visitors see the shop first.
  html=html.replace('<footer>',`<section class="seo-home-heading" aria-labelledby="homeIntroTitle"><h1 id="homeIntroTitle">${heading}</h1><p>${pt?'Compare lojas e consulte as publicações originais antes de planejar sua visita.':'Compará tiendas y consultá las publicaciones originales antes de planificar tu visita.'}</p><nav class="seo-home-links" aria-label="${pt?'Idioma e catálogo':'Idioma y catálogo'}"><a href="${esc(pt?url('index-es.html'):base)}" lang="${pt?'es':'pt-BR'}">${pt?'Español':'Português'}</a><span aria-hidden="true">·</span><a href="#catalogSection">Explorar catálogo</a></nav></section><footer>`);
  return html.replace('</head>',alternates+'</head>');
 }
 // The Spanish entry lives next to index.html so existing relative resources remain valid.
 const esTitle='RivFree | Compará precios de free shops en Rivera y Livramento';
 const esDesc='Compará precios de perfumes, bebidas, electrónica y más en los free shops de Rivera y Santana do Livramento. Consultá las publicaciones originales.';
 let esHome=originalHome.replace(/https:\/\/jmga1.github.io\/RivFree\//g,base).replace(/<title>.*?<\/title>/s,`<title>${esTitle}</title>`).replace(/<meta name="description"[^>]*>/,`<meta name="description" content="${esDesc}">`);
 esHome=esHome.replace(/<meta (?:property="og:|name="twitter:)title"[^>]*>/g,m=>m.replace(/content="[^"]*"/,`content="${esTitle}"`)).replace(/<meta (?:property="og:|name="twitter:)description"[^>]*>/g,m=>m.replace(/content="[^"]*"/,`content="${esDesc}"`));
 esHome=esHome.replace('</head>',`<link rel="canonical" href="${esc(url('index-es.html'))}"><meta property="og:url" content="${esc(url('index-es.html'))}"></head>`).replace('<option value="es">ES</option><option value="pt-BR" selected>PT</option>','<option value="es" selected>ES</option><option value="pt-BR">PT</option>');
 write('index.html',finishHome(home,'pt-BR'));write('index-es.html',finishHome(esHome,'es'));urls.unshift(base,url('index-es.html'));
 const chunks=[];for(let i=0;i<urls.length;i+=10000){const name=`sitemaps/pages-${chunks.length+1}.xml`;write(name,'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls.slice(i,i+10000).map(x=>`<url><loc>${esc(x)}</loc></url>`).join('')+'</urlset>');chunks.push(name);}
 write('sitemap.xml','<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+chunks.map(x=>`<sitemap><loc>${esc(url(x))}</loc></sitemap>`).join('')+'</sitemapindex>');
 write('robots.txt',`User-agent: *\nAllow: /\nSitemap: ${url('sitemap.xml')}\n`);
 write('404.html',`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Página não encontrada | RivFree</title></head><body><h1>Página não encontrada / Página no encontrada</h1><a href="${esc(base)}">RivFree</a></body></html>`);
 write('seo-report.json',JSON.stringify({site_url:base,products:valid.length,pages:count+3,indexable_pages:urls.length,indexable_products:valid.filter(g=>new Set(g.offers.filter(o=>http(o.url)).map(o=>o.tienda)).size>=2).length,sitemaps:chunks.length},null,2));
 return {products:valid.length,pages:count+3,indexable_pages:urls.length,indexable_products:valid.filter(g=>new Set(g.offers.filter(o=>http(o.url)).map(o=>o.tienda)).size>=2).length,sitemaps:chunks.length};
}
if(require.main===module)console.log(JSON.stringify(build(path.resolve(process.argv[2]||path.join(ROOT,'_site')))));
module.exports={build,esc,http};
