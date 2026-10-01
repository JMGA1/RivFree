/* Personal history stays in this browser; global popularity comes from the feed. */
(() => {
 const $=id=>document.getElementById(id),M=window.RivFreeExploreModel;
 const text=(es,pt)=>LANG==='es'?es:(pt||es);
 const node=(tag,label,cls)=>{const n=document.createElement(tag);if(label)n.textContent=label;if(cls)n.className=cls;return n;};
 const btn=(label,fn,cls)=>{const b=node('button',label,cls);b.type='button';b.onclick=fn;return b;};
 const historyKey='rivfree-search-history';let searches=[];
 try{searches=M.history(JSON.parse(localStorage.getItem(historyKey)||'[]'));}catch{}
 function saveHistory(){try{localStorage.setItem(historyKey,JSON.stringify(searches));}catch{}}
 const main=document.querySelector('main'),input=$('search');
 function section(id,title){const s=node('section',null,'popular-section rf-personal-section');s.id=id;const heading=node('div',null,'section-heading'),wrap=node('div');wrap.append(node('span','RIVFREE','eyebrow'),node('h2',title),node('p'));heading.append(wrap);const grid=node('div',null,'popular-rail');grid.tabIndex=0;grid.setAttribute('role','region');grid.setAttribute('aria-label',title);grid.addEventListener('click',handleProductClick);s.append(heading,grid);return s;}
 const recommended=section('basedOnSearches',text('Inspirado en tus búsquedas','Inspirado nas suas buscas'));
 const recent=node('div',null,'rf-history-chips');recommended.insertBefore(recent,recommended.lastChild);
 const most=section('mostSearched',text('Más buscados','Mais buscados'));main.append(recommended,most);
 const clearPersonal=btn(text('Borrar consultas','Limpar consultas'),()=>{consultations.clear();try{localStorage.removeItem('rivfree-consultations');}catch{}renderPopularProducts();},'rf-text-button');$('popularProducts').querySelector('.section-heading').append(clearPersonal);
 const homePanel=node('section',null,'rf-search-home');homePanel.id='searchHome';homePanel.hidden=true;homePanel.setAttribute('aria-label',text('Historial y descubrimiento','Histórico e descobertas'));homePanel.setAttribute('role','dialog');$('searchForm').append(homePanel);
 let cachedCatalog=null,cachedSignature='',randomGroups=[],rankedGroups=[],facetCounts=new Map(),facetMatches=new Map(),activeFamily='phones';
 function runQuery(query){input.value=query;hidePanel();runSearch();}
 function chips(container){container.replaceChildren();for(const item of searches){const chip=node('span',null,'rf-history-chip');chip.append(btn('⌕ '+item.query,()=>runQuery(item.query)));const remove=btn('×',()=>{const inside=homePanel.contains(remove);searches=searches.filter(x=>x!==item);saveHistory();drawPanel();renderPopularProducts();if(inside)homePanel.querySelector('button')?.focus();},'rf-history-remove');remove.setAttribute('aria-label',text('Eliminar búsqueda: ','Excluir busca: ')+item.query);chip.append(remove);container.append(chip);}}
 function drawPanel(){homePanel.replaceChildren();const top=node('div',null,'rf-panel-heading');top.append(node('strong',text('Historial de búsqueda','Histórico de busca')),btn(text('Borrar todo','Limpar tudo'),()=>{searches=[];saveHistory();drawPanel();renderPopularProducts();homePanel.querySelector('button')?.focus();},'rf-text-button'));homePanel.append(top);const historyBox=node('div',null,'rf-history-chips');chips(historyBox);homePanel.append(historyBox);
  if(!searches.length)homePanel.append(node('p',text('Tus próximas búsquedas aparecerán aquí.','Suas próximas buscas aparecerão aqui.'),'rf-muted'));
  homePanel.append(node('strong',rankedGroups.length?text('Más buscados','Mais buscados'):text('Para descubrir','Para descobrir')));const mini=node('div',null,'rf-search-mini');
  for(const g of (rankedGroups.length?rankedGroups:randomGroups).slice(0,6)){const a=node('a');a.href='#/producto/'+encodeURIComponent(g.key);const src=safeImageUrl(g.offers.find(o=>safeImageUrl(o.imagen))?.imagen);if(src){const img=node('img');img.src=src;img.alt='';img.loading='lazy';img.onerror=()=>img.remove();a.append(img);}a.append(node('span',readableProductName(g.name)));a.onclick=()=>{hidePanel();recordProductConsult(g.key);};mini.append(a);}homePanel.append(mini);
 }
 function showPanel(){closeSearchSuggestions();drawPanel();homePanel.hidden=false;input.setAttribute('aria-expanded','true');input.setAttribute('aria-controls','searchHome');input.setAttribute('aria-haspopup','dialog');}
 function hidePanel(){homePanel.hidden=true;input.setAttribute('aria-controls','searchSuggestions');input.setAttribute('aria-haspopup','listbox');input.setAttribute('aria-expanded',String(!$('searchSuggestions').hidden));}
 input.addEventListener('focus',showPanel);input.addEventListener('click',showPanel);
 input.addEventListener('input',()=>{if(input.value.trim())hidePanel();else showPanel();});
 input.addEventListener('keydown',e=>{if(!homePanel.hidden&&e.key==='ArrowDown'){e.preventDefault();homePanel.querySelector('button,a')?.focus();}if(e.key==='Escape')hidePanel();});
 homePanel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();input.focus();hidePanel();}});
 document.addEventListener('pointerdown',e=>{if(!$('searchForm').contains(e.target))hidePanel();});
 $('searchForm').addEventListener('focusout',()=>setTimeout(()=>{if(!$('searchForm').contains(document.activeElement))hidePanel();},0));
 const priorSearch=runSearch;
 runSearch=async function(){const query=input.value.trim();if(query){searches=M.history(searches,query);saveHistory();}clearFacet();hidePanel();await priorSearch();railsStale=true;cachedSignature='';};
 function clearFacet(){const u=new URL(location.href);u.searchParams.delete('facet');history.replaceState(null,'',u);}
 const priorCategory=selectCampaignCategory;
 let facetActivating=false;
 selectCampaignCategory=function(category,options){if(!facetActivating)clearFacet();return priorCategory(category,options);};
 // Facet filter used by getFiltered() to narrow the candidates before any other work.
 window.RivFreeFacet=()=>{const id=new URL(location.href).searchParams.get('facet');if(!id)return null;if(!facetsReady())buildFacetsNow();const keys=facetMatches.get(id);return keys?{id,keys}:null;};
 $('clearFilters').addEventListener('click',()=>{clearFacet();render(true);});
 function fill(grid,groups){const scroll=grid.scrollLeft;grid.classList.toggle('few-products',groups.length<5);grid.replaceChildren(...groups.map(g=>createProductCard({...g,visibleOffers:g.offers})));grid.scrollLeft=scroll;}
 function syncVisibility(detail,results){const visible=window.RIVFREE_SITE_CONFIG?.homepage?.visible||{};recommended.hidden=detail||results||visible.recommended===false;most.hidden=detail||visible.most===false;const facet=facets.find(f=>f.id===new URL(location.href).searchParams.get('facet'));if(results&&facet)$('catalogStart').querySelector('h2').textContent=facetLabel(facet);}
 function renderPersonal(){
  if(!PRODUCT_GROUPS.length)return;
  const signature=JSON.stringify([LANG,searches,[...consultations],[...favorites],referenceCurrency,exchange.rate,popularFeed]);
  if(cachedCatalog===PRODUCT_GROUPS&&cachedSignature===signature)return;
  if(cachedCatalog!==PRODUCT_GROUPS){randomGroups=shuffled(PRODUCT_GROUPS.filter(g=>g.offers.some(hasPrice))).slice(0,8);scheduleFacets();cachedCatalog=PRODUCT_GROUPS;}
  cachedSignature=signature;
  const totals=new Map((popularFeed?.items||[]).filter(i=>Number.isInteger(i.searches)&&i.searches>0).map(i=>[i.url,i.searches]));
  rankedGroups=PRODUCT_GROUPS.map(g=>({g,n:g.offers.reduce((a,o)=>a+(totals.get(o.url)||0),0)})).filter(x=>x.n>0).sort((a,b)=>b.n-a.n).slice(0,12).map(x=>x.g);
  const personal=PRODUCT_GROUPS.filter(g=>consultations.has(g.key)).sort((a,b)=>consultations.get(b.key).count-consultations.get(a.key).count||consultations.get(b.key).last-consultations.get(a.key).last).slice(0,12);
  $('popularTitle').textContent=text('Más consultados por ti','Mais consultados por você');$('popularNote').textContent=personal.length?text('Los productos que más abriste, guardados solo en este navegador.','Os produtos que você mais abriu, salvos apenas neste navegador.'):text('Abrí un producto para empezar tu selección personal.','Abra um produto para começar sua seleção pessoal.');
  $('popularProducts').querySelector('.eyebrow').textContent=text('TU ACTIVIDAD','SUA ATIVIDADE');clearPersonal.textContent=text('Borrar consultas','Limpar consultas');clearPersonal.hidden=!personal.length;fill($('popularGrid'),personal);updatePopularArrows();
  recommended.querySelector('h2').textContent=text('Inspirado en tus búsquedas','Inspirado nas suas buscas');recommended.querySelector('.section-heading p').textContent=searches.length?text('Productos relacionados con tus búsquedas recientes.','Produtos relacionados às suas buscas recentes.'):text('Cuando busques, te mostraremos opciones relacionadas aquí.','Ao buscar, mostraremos opções relacionadas aqui.');chips(recent);
  const queries=searches.slice(0,6).map(s=>Catalog.searchQuery(s.query));const suggestions=PRODUCT_GROUPS.map(g=>({g,score:queries.reduce((n,q,i)=>n+(g.offers.some(o=>Catalog.matchesSearch(o,q))?6-i:0),0)})).filter(x=>x.score>0&&x.g.offers.some(hasPrice)).sort((a,b)=>b.score-a.score).slice(0,8).map(x=>x.g);fill(recommended.lastChild,suggestions);
  if(searches.length&&!suggestions.length)recommended.lastChild.append(node('p',text('No encontramos productos para esas búsquedas. Probá con otro término.','Não encontramos produtos para essas buscas. Tente outro termo.')));
  most.querySelector('h2').textContent=text('Más buscados','Mais buscados');most.querySelector('.section-heading p').textContent=rankedGroups.length?text('Selecciones desde búsquedas de los últimos 30 días.','Seleções a partir de buscas nos últimos 30 dias.'):text('Todavía no hay suficientes datos: por ahora mostramos una selección aleatoria.','Ainda não há dados suficientes: por enquanto mostramos uma seleção aleatória.');fill(most.lastChild,rankedGroups.length?rankedGroups:randomGroups);
  const ids={hero:'heroCampaign',benefits:'shoppingBenefits',discover:'discoverProducts',popular:'popularProducts',recommended:'basedOnSearches',most:'mostSearched'};for(const key of [...new Set([...(window.RIVFREE_SITE_CONFIG?.homepage?.order||[]),...Object.keys(ids)])]){if(ids[key])main.append($(ids[key]));}drawCategories();if(!homePanel.hidden)drawPanel();
 }
 // Below-the-fold rails run in their own task so the first screen paints sooner.
 let personalQueued=false;
 function queuePersonal(){if(personalQueued)return;personalQueued=true;setTimeout(()=>{personalQueued=false;renderPersonal();},0);}
 // The home rails are rebuilt only while they are visible; results and detail pages skip that work.
 let railsStale=true;
 renderPopularProducts=function(){const type=location.hash.split('/')[1],detail=['producto','tienda','tiendas'].includes(type),results=type==='buscar'||!!ACTIVE_SEARCH.trim()||selectedCategories().length>0||$('soloOfertas').checked||$('favoritesOnly').checked;
  if(detail||results){railsStale=true;if(PRODUCT_GROUPS.length&&cachedCatalog!==PRODUCT_GROUPS)scheduleFacets();}else{renderDiscoverProducts();queuePersonal();railsStale=false;}
  $('popularProducts').hidden=detail||results||window.RIVFREE_SITE_CONFIG?.homepage?.visible?.popular===false;const link=document.querySelector('a[href="#popularProducts"]');if(link)link.hidden=$('popularProducts').hidden;syncVisibility(detail,results);};
 const categoryMenu=document.querySelector('.rf-category-menu');
 const oldOptions=categoryMenu.querySelector('.rf-category-options');oldOptions.hidden=true;oldOptions.classList.remove('rf-category-options');
 const mega=node('div',null,'rf-mega-menu');categoryMenu.append(mega);
 // Each family lists curated shortcuts plus brands and product types found in the live catalog.
 const familyCategories={tech:['electronica'],computers:['informatica'],perfumes:['perfumes'],drinks:['bebidas'],beauty:['cosmetica'],food:['alimentos'],home:['hogar','electrodomesticos']};
 const covered=['perfumes','bebidas','alimentos','cosmetica','electronica','informatica','electrodomesticos','hogar'];
 const families=[...M.taxonomy,...Object.entries(Catalog.categories).filter(([id])=>!covered.includes(id)).map(([id,labels])=>({id,es:labels[0],pt:labels[1],match:p=>p.categoryId===id,brands:[],types:[]}))];
 for(const f of families){f.categories=familyCategories[f.id]||(Catalog.categories[f.id]?[f.id]:[]);f.dynamicBrands=[];f.dynamicTypes=[];f.dynamic=!['phones','gaming','apple'].includes(f.id);}
 let facets=families.flatMap(f=>[f,...f.brands,...f.types]);
 const facetSlug=s=>M.normalize(s).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
 let brandIndex=null,facetCatalog=null,facetJob=null,facetSteps=null;
 const facetsReady=()=>facetCatalog===PRODUCT_GROUPS&&!facetSteps;
 // Generator so the same work can run in 10 ms slices (background) or all at once (facet in the URL).
 function* facetIndexSteps(){
  const CI=window.RivFreeCategoryIndex,groups=PRODUCT_GROUPS;
  // Brands normally come precomputed from the catalog worker; older cached data falls back here.
  if(CI&&ALL_PRODUCTS.length&&!ALL_PRODUCTS.some(p=>p.brandKey)){brandIndex=CI.build(ALL_PRODUCTS);yield;}else brandIndex=null;
  const brandOf=p=>p.brandKey?{key:p.brandKey,label:p.brandLabel}:(brandIndex?brandIndex.brandOf(p):null);
  const matches=new Map(families.flatMap(f=>[f,...f.brands,...f.types]).map(f=>[f.id,new Set()]));
  const brandSets=new Map(families.map(f=>[f.id,new Map()]));
  const typeDefs=new Map(families.map(f=>[f.id,f.dynamic&&CI?f.categories.flatMap(c=>CI.types(c)):[]]));
  const typeSets=new Map(families.map(f=>[f.id,typeDefs.get(f.id).map(()=>new Set())]));
  for(let index=0;index<groups.length;index++){
   const g=groups[index];
   for(const family of families){
    const offers=g.offers.filter(family.match);if(!offers.length)continue;
    matches.get(family.id).add(g.key);
    for(const f of family.brands)if(offers.some(f.match))matches.get(f.id).add(g.key);
    for(const f of family.types)if(offers.some(f.match))matches.get(f.id).add(g.key);
    if(!family.dynamic)continue;
    const brands=brandSets.get(family.id);
    for(const o of offers){const b=brandOf(o);if(!b)continue;let entry=brands.get(b.key);if(!entry)brands.set(b.key,entry={brand:b,keys:new Set()});entry.keys.add(g.key);}
    const defs=typeDefs.get(family.id);
    if(defs.length){const sets=typeSets.get(family.id),names=offers.map(o=>M.normalize(o.nombre));for(let i=0;i<defs.length;i++)if(names.some(n=>defs[i].regex.test(n)))sets[i].add(g.key);}
   }
   if(index%60===59)yield;
  }
  for(const family of families){
   const curatedKeys=family.brands.map(b=>M.normalize(b.label).replace(/[^a-z0-9]/g,''));
   family.dynamicBrands=[...brandSets.get(family.id).values()].filter(x=>x.keys.size>=2&&!curatedKeys.some(k=>k.includes(x.brand.key)||x.brand.key.includes(k))).sort((a,b)=>b.keys.size-a.keys.size||a.brand.label.localeCompare(b.brand.label)).slice(0,60).map(x=>{const id=family.id+'-b-'+x.brand.key;matches.set(id,x.keys);return {id,label:x.brand.label,kind:'brand'};});
   const curatedTypes=family.types.map(t=>M.normalize(t.label));
   family.dynamicTypes=typeDefs.get(family.id).map((t,i)=>({t,keys:typeSets.get(family.id)[i]})).filter(x=>x.keys.size&&!curatedTypes.includes(M.normalize(x.t.es))&&!curatedTypes.includes(M.normalize(x.t.pt))).map(x=>{const id=family.id+'-t-'+facetSlug(x.t.es);matches.set(id,x.keys);return {id,es:x.t.es,pt:x.t.pt,kind:'type'};});
  }
  facetMatches=matches;
  facets=families.flatMap(f=>[f,...f.brands,...f.types,...f.dynamicBrands,...f.dynamicTypes]);
  facetCounts=new Map([...facetMatches].map(([id,set])=>[id,set.size]));
 }
 function startFacets(){if(facetCatalog!==PRODUCT_GROUPS){facetCatalog=PRODUCT_GROUPS;facetSteps=facetIndexSteps();}}
 function finishFacets(){facetSteps=null;facetJob=null;if(categoryMenu.open)drawCategories();window.dispatchEvent(new CustomEvent('rivfree:facets-ready'));}
 function buildFacetsNow(){if(!PRODUCT_GROUPS.length)return;startFacets();if(!facetSteps)return;while(!facetSteps.next().done);finishFacets();}
 function buildFacets(){
  if(!PRODUCT_GROUPS.length)return Promise.resolve();
  startFacets();if(!facetSteps)return Promise.resolve();
  return facetJob||=new Promise(resolve=>{
   const catalog=PRODUCT_GROUPS;
   const slice=()=>{
    if(facetCatalog!==catalog||!facetSteps){resolve();return;}
    const until=performance.now()+10;
    while(performance.now()<until){if(facetSteps.next().done){finishFacets();resolve();return;}}
    setTimeout(slice,0);
   };
   slice();
  });
 }
 // Started when the browser is idle after the catalog loads, or immediately when the menu opens.
 function scheduleFacets(){if(facetsReady()||facetJob)return;const run=()=>buildFacets();if('requestIdleCallback' in window)requestIdleCallback(run,{timeout:5000});else setTimeout(run,1500);}
 function facetLabel(f){return f.label||f[LANG==='es'?'es':'pt'];}
 function activateFacet(f){const u=new URL(location.href);u.searchParams.set('facet',f.id);u.hash='/buscar';history.replaceState(null,'',u);categoryMenu.open=false;facetActivating=true;try{selectCampaignCategory('');}finally{facetActivating=false;}$('catalogStart').scrollIntoView({block:'start'});}
 const expanded=new Set();
 categoryMenu.addEventListener('toggle',()=>{if(categoryMenu.open&&!facetsReady()){drawCategories();buildFacets();}});
 function drawCategories(){mega.replaceChildren();const tabs=node('div',null,'rf-mega-families'),panel=node('div',null,'rf-mega-panel');tabs.append(btn(text('Todas las categorías','Todas as categorias'),()=>{categoryMenu.open=false;selectCampaignCategory('');}));
  const ready=facetsReady();
  for(const f of families){if(ready&&!(facetCounts.get(f.id)>0))continue;const b=btn(f[LANG==='es'?'es':'pt'],()=>{activeFamily=f.id;drawCategories();mega.querySelector(`[data-family="${f.id}"]`)?.focus();});b.dataset.family=f.id;b.setAttribute('aria-expanded',String(f.id===activeFamily));b.setAttribute('aria-controls','categoryDetailPanel');const n=ready?facetCounts.get(f.id):0;if(n)b.append(node('span',n.toLocaleString(LANG),'rf-mega-count'));tabs.append(b);}
  const family=families.find(f=>f.id===activeFamily)||families[0];panel.id='categoryDetailPanel';panel.append(node('h2',family[LANG==='es'?'es':'pt']));
  if(!ready){panel.append(node('p',PRODUCT_GROUPS.length?text('Cargando marcas y tipos…','Carregando marcas e tipos…'):text('Cargando categorías…','Carregando categorias…'),'rf-muted rf-mega-loading'));mega.append(tabs,panel);if(PRODUCT_GROUPS.length&&categoryMenu.open)buildFacets();return;}
  panel.append(btn(text('Ver todos','Ver todos')+' · '+(facetCounts.get(family.id)||0).toLocaleString(LANG),()=>activateFacet(family),'rf-text-button'));
  const brandItems=[...family.brands,...family.dynamicBrands].filter(f=>(facetCounts.get(f.id)||0)>0).sort((a,b)=>facetCounts.get(b.id)-facetCounts.get(a.id));
  const typeItems=[...family.types,...family.dynamicTypes].filter(f=>(facetCounts.get(f.id)||0)>0).sort((a,b)=>facetCounts.get(b.id)-facetCounts.get(a.id));
  for(let [key,title,items,limit] of [['brands',text('Marcas destacadas','Marcas em destaque'),brandItems,14],['types',text('Tipos y características','Tipos e características'),typeItems,12]])if(items.length){
   if(items.length<=limit+3)limit=items.length;
   const box=node('section');box.append(node('h3',title));const links=node('div',null,'rf-mega-links'+(key==='brands'?' rf-mega-brands':''));const open=expanded.has(family.id+key);
   for(const f of items.slice(0,open?items.length:limit)){const count=facetCounts.get(f.id)||0;const b=btn('',()=>activateFacet(f));b.append(node('span',facetLabel(f),'rf-mega-label'),node('span',count.toLocaleString(LANG),'rf-mega-count'));b.setAttribute('aria-label',facetLabel(f)+' · '+count);links.append(b);}
   box.append(links);
   if(items.length>limit){const more=btn(open?text('Ver menos','Ver menos'):text(`Ver ${items.length-limit} más`,`Ver mais ${items.length-limit}`),()=>{if(open)expanded.delete(family.id+key);else expanded.add(family.id+key);drawCategories();mega.querySelector(`.rf-mega-more[data-more="${key}"]`)?.focus();},'rf-text-button rf-mega-more');more.dataset.more=key;more.setAttribute('aria-expanded',String(open));box.append(more);}
   panel.append(box);
  }
  if(PRODUCT_GROUPS.length&&!brandItems.length&&!typeItems.length)panel.append(node('p',text('Explorá los productos disponibles de esta categoría.','Explore os produtos disponíveis nesta categoria.')));mega.append(tabs,panel);
 }
 function appendWhatsApp(actions,offer){const url=M.whatsapp(STORE_INFO[offer.tienda]);const label='WhatsApp · '+offer.tienda;let a;
  if(url){url.searchParams.set('text',text('Hola, quisiera consultar por ','Olá, gostaria de consultar sobre ')+offer.nombre+(safeHttpUrl(offer.url)?' '+offer.url:''));a=node('a');a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';}else{a=node('button');a.type='button';a.disabled=true;}
  a.className='rf-whatsapp';a.setAttribute('aria-label',url?label:text('WhatsApp no informado: ','WhatsApp não informado: ')+offer.tienda);a.title=url?label:text('Esta tienda aún no tiene WhatsApp confirmado','Esta loja ainda não tem WhatsApp confirmado');
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');const p=document.createElementNS(svg.namespaceURI,'path');p.setAttribute('d','M20.5 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.6-4.7a8.5 8.5 0 1 1 15.9-4.3Z M8 7.5c.5 4 2.5 6 6.5 7l1.5-2-2.5-1-1 1c-1.5-.7-2.3-1.5-3-3l1-1L9 6.5Z');svg.append(p);a.append(svg,node('span','WhatsApp'));actions.append(a);
 }
 // families/ready/build are used by the phone menu (mobile-shell.js) to list categories, brands and types.
 window.RivFreeExplore={syncVisibility,appendWhatsApp,facets:()=>facets,facetCounts:()=>facetCounts,activateFacet,brandIndex:()=>brandIndex,families:()=>families,ready:()=>facetsReady(),build:()=>buildFacets(),label:f=>facetLabel(f)};
 window.addEventListener('rivfree:catalog-ready',()=>{renderPopularProducts();if(new URL(location.href).searchParams.has('facet'))render();});
 window.addEventListener('hashchange',()=>{hidePanel();renderPopularProducts();});
 $('languageToggle').addEventListener('change',()=>{drawCategories();renderPopularProducts();});
 document.addEventListener('rivfree-site-config-applied',()=>{renderPopularProducts();});
 window.addEventListener('storage',e=>{if(e.key===historyKey){try{searches=M.history(JSON.parse(e.newValue||'[]'));}catch{searches=[];}renderPopularProducts();}});
 drawCategories();renderPopularProducts();
})();
