/* RivFree routes: static hosting compatible, no server rewrite required. */
(() => {
 const $=id=>document.getElementById(id);
 const txt=(es,pt)=>words(pt||es,es);
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
 const link=(label,url)=>{const a=el('a',label);a.href=safeHttpUrl(url)||'#';a.target='_blank';a.rel='noopener noreferrer';return a;};
 const button=(label,fn)=>{const b=el('button',label,'rf-button');b.type='button';b.onclick=fn;return b;};
 const routeURL=(type,id='')=>'#/'+type+(id?'/'+encodeURIComponent(id):'');
 const navigate=(type,id)=>{location.hash=routeURL(type,id);};
 const main=document.querySelector('main');
 main.prepend($('loadError'));
 const page=el('section',null,'rf-page');page.id='detailPage';page.hidden=true;main.prepend(page);
 const nav=document.querySelector('.category-shortcuts');
 const menu=el('details',null,'rf-category-menu');const summary=el('summary');summary.innerHTML='<svg class="rf-nav-icon rf-icon-categories" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>';const summaryLabel=el('span',txt('Categorías','Categorias'),'rf-nav-label');summary.append(summaryLabel);menu.append(summary);
 const options=el('div',null,'rf-category-options');
 nav.querySelectorAll('[data-category-shortcut]').forEach(b=>options.append(b));
 for(const [key,labels] of Object.entries(Catalog.categories))if(!options.querySelector(`[data-category-shortcut="${key}"]`)){
  const b=button(labels[LANG==='es'?0:1],()=>selectCampaignCategory(key));b.dataset.categoryShortcut=key;options.append(b);
 }
 menu.append(options);nav.prepend(menu);
 // Tiendas lives in the centred quick-access group (#navQuick); older markup still gets a plain link.
 let stores=$('navStores');if(!stores){stores=el('a');stores.append(el('span',txt('Tiendas','Lojas'),'rf-nav-label'));stores.href=routeURL('tiendas');nav.insertBefore(stores,menu.nextSibling);}
 const storesLabel=stores.querySelector('.rf-nav-label')||stores;
 options.addEventListener('click',e=>{if(e.target.closest('button')){menu.open=false;history.replaceState(null,'',location.pathname+location.search+'#/buscar');render();}});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu.open){menu.open=false;summary.focus();}});
 document.addEventListener('click',e=>{if(!e.composedPath().includes(menu))menu.open=false;});
 $('openStoreDirectory').hidden=true;
 $('catalogStart').querySelector('h2').textContent=txt('Resultados de búsqueda','Resultados da busca');
 $('catalogStart').querySelector('p').textContent=txt('Compará productos y precios entre tiendas.','Compare produtos e preços entre lojas.');
 const oldRender=render;
 render=function(...args){oldRender(...args);syncView();};
 const oldSearch=runSearch;
 runSearch=async function(){history.replaceState(null,'',location.pathname+location.search+'#/buscar');await oldSearch();syncView();};
 const oldCategory=selectCampaignCategory;
 selectCampaignCategory=function(category,options){history.replaceState(null,'',location.pathname+location.search+'#/buscar');oldCategory(category,options);syncView();};
 const oldCard=createProductCard;
 createProductCard=function(g){const card=oldCard(g);for(const n of card.querySelectorAll('.card-img,.card-name,.card-action,.card-cta')){
  n.dataset.action='preview';n.removeAttribute('aria-haspopup');n.removeAttribute('target');
  if(n.tagName==='A')n.href=routeURL('producto',g.key);
  if(n.matches('.card-action,.card-cta'))n.textContent=txt('Ver producto y precios →','Ver produto e preços →');
 }if(new Set(g.offers.map(o=>o.tienda)).size>1)card.querySelector('.card-utility-row .quantity-control')?.remove();return card;};
 openProductPreview=data=>{navigate('producto',data.key);};
 openStoreInfo=name=>navigate('tienda',name);
 $('searchForm').addEventListener('submit',()=>{history.replaceState(null,'',location.pathname+location.search+'#/buscar');syncView();});
 const oldDiscovery=renderDiscoverProducts;
 renderDiscoverProducts=function(){
  oldDiscovery();
  $('discoverTitle').textContent=txt('Por descubrir','Para descobrir');
  $('discoverTitle').nextElementSibling.textContent=txt('Una selección aleatoria para explorar el catálogo.','Uma seleção aleatória para explorar o catálogo.');
  $('discoverPrevious').hidden=$('discoverNext').hidden=false;
 };
 function catalogVisible(){const type=location.hash.split('/')[1];if(['producto','tiendas','tienda'].includes(type))return false;return type==='buscar'||!!ACTIVE_SEARCH.trim()||selectedCategories().length>0||$('soloOfertas').checked||$('favoritesOnly').checked;}
 window.RivFreeCatalogVisible=catalogVisible;
 function syncView(){
  const type=location.hash.split('/')[1];const detail=['producto','tiendas','tienda'].includes(type);
  if(['tiendas','tienda'].includes(type))stores.setAttribute('aria-current','page');else stores.removeAttribute('aria-current');
  document.body.classList.toggle('rf-detail-mode',detail);page.hidden=!detail;
  const results=!detail&&(type==='buscar'||!!ACTIVE_SEARCH.trim()||selectedCategories().length>0||$('soloOfertas').checked||$('favoritesOnly').checked);
  $('catalogSection').hidden=!results;
  const [title,subtitle]=resultsHeading();
  $('catalogStart').querySelector('h2').textContent=title;
  $('catalogStart').querySelector('p').textContent=subtitle;
  if(results)document.title=txt('Buscar productos','Buscar produtos')+' | RivFree';
  $('popularProducts').hidden=detail||results||window.RIVFREE_SITE_CONFIG?.homepage?.visible?.popular===false;
  window.RivFreeExplore?.syncVisibility(detail,results);
  for(const id of ['heroCampaign','shoppingBenefits','discoverProducts'])$(id).classList.toggle('rf-hidden',detail||results);
 }
 // Store page: jump to that store's products or offers in the regular results.
 function storeShortcuts(name){
  let products=0,offers=0;for(const p of ALL_PRODUCTS)if(p.tienda===name){products++;if(p.en_oferta)offers++;}
  const box=el('div',null,'rf-store-shortcuts');if(!products)return box;
  const count=n=>n.toLocaleString(LANG==='es'?'es-UY':'pt-BR');
  const all=el('button',txt(`Ver sus ${count(products)} productos`,`Ver os ${count(products)} produtos`),'rf-store-go');all.type='button';all.onclick=()=>showStoreProducts(name,false);box.append(all);
  if(offers){const sale=el('button',txt(`Ver ofertas (${count(offers)})`,`Ver ofertas (${count(offers)})`),'rf-store-go rf-store-go-offers');sale.type='button';sale.onclick=()=>showStoreProducts(name,true);box.append(sale);}
  return box;
 }
 function showStoreProducts(name,offers){
  ACTIVE_SEARCH='';$('search').value='';$('categoria').value='';syncCategoryInput();
  document.querySelectorAll('.storeChk').forEach(box=>{box.checked=box.value===name;});
  $('soloOfertas').checked=offers;MIN_DISCOUNT=0;$('favoritesOnly').checked=false;$('minPrice').value=$('maxPrice').value='';
  $('orden').value=offers?'descuento':'nombre_asc';
  // A new history entry (Back returns to the store); render() then writes the filters into it.
  const url=new URL(location.href);url.searchParams.delete('facet');url.hash='/buscar';history.pushState(null,'',url);
  route();
 }
 function chosenStore(){const boxes=[...document.querySelectorAll('.storeChk:checked')];return boxes.length===1?boxes[0].value:'';}
 // The results title says what is on screen: a search, the offers or the saved favorites.
 function resultsHeading(){
  const query=ACTIVE_SEARCH.trim();
  if(query)return [txt(`Resultados para “${query}”`,`Resultados para “${query}”`),txt('Compará productos y precios entre tiendas.','Compare produtos e preços entre lojas.')];
  const store=chosenStore();
  if(store)return $('soloOfertas').checked?[txt(`Ofertas de ${store}`,`Ofertas da ${store}`),txt('Productos con descuento publicado por la tienda.','Produtos com desconto publicado pela loja.')]:[txt(`Productos de ${store}`,`Produtos da ${store}`),txt('Todo lo que publica esta tienda en RivFree.','Tudo o que esta loja publica no RivFree.')];
  if($('soloOfertas').checked)return [txt('Ofertas','Ofertas'),txt('Productos con descuento publicado por las tiendas.','Produtos com desconto publicado pelas lojas.')];
  if($('favoritesOnly').checked)return [txt('Tus favoritos','Seus favoritos'),txt('Los productos que guardaste con ♡.','Os produtos que você salvou com ♡.')];
  return [txt('Resultados de búsqueda','Resultados da busca'),txt('Compará productos y precios entre tiendas.','Compare produtos e preços entre lojas.')];
 }
 function heading(title,subtitle){page.replaceChildren();const back=el('a',txt('← Volver a explorar','← Voltar a explorar'));back.href='#/';page.append(back,el('p','RIVFREE · RIVERA / LIVRAMENTO','eyebrow'),el('h1',title));if(subtitle)page.append(el('p',subtitle,'rf-muted'));document.title=title+' | RivFree';}
 function status(info,now=new Date()){
  if(!info.weekly_hours)return {text:txt('Horario por confirmar','Horário a confirmar'),open:false};
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:info.timezone||'America/Montevideo',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));
  const days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],day=days.indexOf(parts.weekday),minute=+parts.hour*60 + +parts.minute;
  const mins=s=>{const [h,m]=s.split(':').map(Number);return h*60+m;};
  const spans=info.hours_exceptions?.[new Intl.DateTimeFormat('en-CA',{timeZone:info.timezone||'America/Montevideo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)]??info.weekly_hours[day]??[];
  const open=spans.some(([a,b])=>minute>=mins(a)&&minute<mins(b));
  return {text:open?txt('● Abierto · según horario','● Aberto · conforme horário'):txt('Cerrado · según horario','Fechado · conforme horário'),open};
 }
 window.RivFreeHours=status;
 function storeExtras(info,box){
  const s=status(info);const badge=el('span',s.text,s.open?'rf-open':'rf-muted');badge.dataset.hoursStore=Object.keys(STORE_INFO).find(k=>STORE_INFO[k]===info)||'';box.append(badge);
  if(info.weekly_hours){
   const details=el('details',null,'rf-hours');details.open=box.classList.contains('rf-panel');details.append(el('summary',txt('Horarios de atención','Horários de atendimento')));
   const list=el('dl',null,'rf-hours-list'),days=LANG==='es'?['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']:['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
   for(const day of [1,2,3,4,5,6,0]){const spans=info.weekly_hours[day]||[];list.append(el('dt',days[day]),el('dd',spans.length?spans.map(pair=>pair.join('–')).join(' · '):txt('Cerrado','Fechado')));}
   details.append(list);for(const [date,spans]of Object.entries(info.hours_exceptions||{}).sort(([a],[b])=>a.localeCompare(b)))details.append(el('p',date+': '+(spans.length?spans.map(pair=>pair.join('–')).join(' · '):txt('Cerrado','Fechado'))));box.append(details);
  }else box.append(el('p',info.horario||txt('Consultá horarios en sus canales oficiales.','Consulte os horários nos canais oficiais.')));
  if(info.google?.rating!=null&&info.google?.url){const review=link(Number(info.google.rating).toLocaleString(LANG==='es'?'es-UY':'pt-BR')+' / 5'+(info.google.count!=null?' · '+Number(info.google.count).toLocaleString(LANG==='es'?'es-UY':'pt-BR')+' '+txt('evaluaciones en Google','avaliações no Google'):' · Google'),info.google.url);review.className='rf-review';const star=el('span','★','rf-review-star');star.setAttribute('aria-hidden','true');review.prepend(star);box.append(review);}
  else box.append(el('p',txt('Google: evaluaciones aún no disponibles.','Google: avaliações ainda não disponíveis.'),'rf-muted'));
 }
 // Category counts per store, computed once per catalog (the directory asked for them on every keystroke).
 function storeCategoryCounts(name){if(storeCategoryCounts.catalog!==ALL_PRODUCTS){storeCategoryCounts.catalog=ALL_PRODUCTS;storeCategoryCounts.value=new Map();for(const p of ALL_PRODUCTS){let m=storeCategoryCounts.value.get(p.tienda);if(!m)storeCategoryCounts.value.set(p.tienda,m=new Map());m.set(p.categoryId,(m.get(p.categoryId)||0)+1);}}return storeCategoryCounts.value.get(name)||new Map();}
 function specialities(name){const info=STORE_INFO[name]||{};if(info.specialties?.length)return info.specialties.join(' · ');const counts=storeCategoryCounts(name);return [...counts].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([id])=>Catalog.categories[id]?.[LANG==='es'?0:1]).filter(Boolean).join(' · ')||txt('Catálogo variado','Catálogo variado');}
 function contacts(info,name){const box=el('div',null,'rf-links');if(info.sitio_web)box.append(link(txt('Web oficial','Site oficial'),info.sitio_web));for(const [label,url]of Object.entries(info.redes||{}))if(safeHttpUrl(url))box.append(link(label,url));if(info.direccion)box.append(link('Google Maps ↗',info.google?.url||mapUrl(name,info.direccion)));return box;}
 function directory(){
  heading(txt('Tiendas para tu próximo recorrido','Lojas para sua próxima visita'),txt('Conocé los free shops, sus horarios y cómo contactarlos.','Conheça os free shops, seus horários e contatos.'));
  if(window.RivFreeStores){window.RivFreeStores.renderDirectory(page,{storeExtras,specialities,navigate});return;}
  const list=el('div',null,'rf-store-list');page.append(list);
  for(const name of [...new Set([...Object.keys(STORE_INFO),...ALL_PRODUCTS.map(p=>p.tienda)])].filter(Boolean).sort((a,b)=>a.localeCompare(b))){const info=STORE_INFO[name]||{},card=el('article',null,'rf-store-card'),body=el('div');body.append(el('h2',info.nombre_completo||name),el('p',specialities(name),'rf-specialty'),el('p',info.direccion||txt('Dirección por confirmar','Endereço a confirmar')));storeExtras(info,body);body.append(contacts(info,name));card.append(body,button(txt('Más detalles →','Mais detalhes →'),()=>navigate('tienda',name)));list.append(card);}
 }
 function storePage(name){const info=STORE_INFO[name];if(!info){heading(txt('Tienda no encontrada','Loja não encontrada'));return;}
  heading(info.nombre_completo||name,specialities(name));
  // Studio → Tiendas → Fotos del local: the first photo is the cover (usually the facade).
  const photos=(Array.isArray(info.photos)?info.photos:[]).filter(photo=>photo&&safeImageUrl(photo.url));
  if(photos.length){const cover=el('figure',null,'rf-store-cover'),img=el('img');img.src=safeImageUrl(photos[0].url);img.alt=photos[0].caption||txt(`Fachada de ${name}`,`Fachada da ${name}`);img.decoding='async';img.referrerPolicy='no-referrer';cover.append(img);page.append(cover);}
  page.append(storeShortcuts(name));const panel=el('article',null,'rf-panel');panel.append(el('h2',txt('Conocé la tienda','Conheça a loja')),el('p',info.description?.[LANG]||info.nota||txt('La trayectoria de esta tienda todavía no está documentada en RivFree.','A história desta loja ainda não está documentada no RivFree.')));storeExtras(info,panel);panel.append(el('p',info.direccion,'rf-store-address-line'));
  if(window.RivFreeStores){panel.append(window.RivFreeStores.contactLinks(info,name));const mapWrap=el('div',null,'rf-store-page-map');if(window.RivFreeStores.storeMap(mapWrap,name))panel.append(mapWrap);}
  else{if(info.telefono){const a=el('a',info.telefono);a.href='tel:'+info.telefono.replace(/[^+0-9]/g,'');panel.append(a);}if(/^[^\s@?&#/]+@[^\s@?&#/]+\.[^\s@?&#/]+$/.test(info.email||'')){const a=el('a',info.email);a.href='mailto:'+info.email;panel.append(a);}panel.append(contacts(info,name));}
  panel.append(el('h2',txt('Fotos del local','Fotos da loja')));
  if(photos.length){const gallery=el('div',null,'rf-photos');for(const photo of photos){const figure=el('figure'),open=el('a'),img=el('img');open.href=photo.url;open.target='_blank';open.rel='noopener noreferrer';open.setAttribute('aria-label',txt('Ver foto completa','Ver foto completa')+': '+(photo.caption||name));img.src=imageThumbUrl(photo.url);img.alt=photo.caption||name;img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';open.append(img);figure.append(open);const credit=[photo.caption,photo.attribution].filter(Boolean).join(' · ');if(credit)figure.append(el('figcaption',credit));gallery.append(figure);}panel.append(gallery);}else{panel.append(el('p',txt('Todavía no hay fotos disponibles en RivFree. Podés ver las publicadas en Google Maps.','Ainda não há fotos disponíveis no RivFree. Veja as publicadas no Google Maps.')),link(txt('Ver local en Google Maps','Ver loja no Google Maps'),info.google?.url||mapUrl(name,info.direccion||'')));}
  if(info.source)panel.append(link(txt('Fuente de horarios e información','Fonte de horários e informações'),info.source));page.append(panel);
 }
 // "Desde USD 99.00 en DFA · 3 tiendas": the best price and where, before the list.
 function productSummary(group){
  const priced=group.offers.filter(hasPrice).sort((a,b)=>a.precio_usd-b.precio_usd),count=new Set(group.offers.map(o=>o.tienda)).size;
  if(!priced.length)return txt('Compará el mismo producto entre free shops.','Compare o mesmo produto entre free shops.');
  const usd='USD '+new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}).format(priced[0].precio_usd);
  if(count<2)return txt(`${usd} en ${priced[0].tienda}`,`${usd} na ${priced[0].tienda}`);
  return txt(`Desde ${usd} en ${priced[0].tienda} · ${count} tiendas`,`A partir de ${usd} na ${priced[0].tienda} · ${count} lojas`);
 }
 function productPage(key){
  const group=PRODUCT_GROUPS.find(g=>g.key===key);if(!group){heading(loadingCatalog?txt('Cargando producto…','Carregando produto…'):txt('Producto no encontrado','Produto não encontrado'));return;}
  if(!new URLSearchParams(location.search).has('studio-preview'))recordProductConsult(group.key);heading(readableProductName(group.name),productSummary(group));
  if(!new URLSearchParams(location.search).has('studio-preview')&&ACTIVE_SEARCH.trim()){const token=group.key+'|'+ACTIVE_SEARCH.trim();if(productPage.lastSearch!==token){productPage.lastSearch=token;if(window.RIVFREE_SEARCH_API)fetch(window.RIVFREE_SEARCH_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:group.offers[0].url})}).catch(()=>{});}}
  const layout=el('div',null,'rf-product-layout'),visual=el('div',null,'rf-product-visual'),src=safeImageUrl(group.offers.find(o=>safeImageUrl(o.imagen))?.imagen);
  if(src){const img=el('img');img.src=src;img.alt=group.name;img.onerror=()=>addImagePlaceholder(visual);visual.append(img);}else addImagePlaceholder(visual);
  const offersBox=el('div'),toolbar=el('div',null,'rf-offer-toolbar'),select=el('select'),filter=el('select');
  for(const [value,label]of [['asc',txt('Menor precio','Menor preço')],['desc',txt('Mayor precio','Maior preço')],['alpha',txt('Tiendas A–Z','Lojas A–Z')],['new',txt('Más nuevos','Mais recentes')]]){const o=el('option',label);o.value=value;select.append(o);}select.setAttribute('aria-label',txt('Ordenar ofertas','Ordenar ofertas'));
  filter.append(el('option',txt('Todas las tiendas','Todas as lojas')));filter.firstChild.value='';for(const s of new Set(group.offers.map(o=>o.tienda))){const option=el('option',s);option.value=s;filter.append(option);}filter.setAttribute('aria-label',txt('Filtrar por tienda','Filtrar por loja'));
  toolbar.append(filter,select);const list=el('div',null,'rf-offers');offersBox.append(toolbar,list);layout.append(visual,offersBox);page.append(layout);
  function draw(){let offers=group.offers.filter(o=>!filter.value||o.tienda===filter.value);offers.sort((a,b)=>{if(select.value==='alpha')return a.tienda.localeCompare(b.tienda);if(select.value==='new')return (Date.parse(b.creado||b.primera_deteccion)||0)-(Date.parse(a.creado||a.primera_deteccion)||0);if(!hasPrice(a)||!hasPrice(b))return Number(hasPrice(b))-Number(hasPrice(a));return (select.value==='desc'?-1:1)*(a.precio_usd-b.precio_usd);});list.replaceChildren();
   const priced=group.offers.filter(hasPrice),best=priced.length>1?Math.min(...priced.map(o=>o.precio_usd)):null;
   for(const offer of offers)list.append(offerCard(offer,best));}
  // One store offer: store chip, price (with the neighbouring currencies), list controls and the two actions.
  function offerCard(offer,best){
   const row=el('article',null,'rf-offer');const isBest=best!==null&&hasPrice(offer)&&offer.precio_usd===best;row.classList.toggle('is-best',isBest);
   const head=el('div',null,'rf-offer-head');
   const store=el('button',null,'card-store rf-offer-store');store.type='button';store.dataset.store=storeKey(offer.tienda);applyStoreVisual(store,offer.tienda);
   store.append(el('span',offer.tienda));store.title=txt('Ver la tienda','Ver a loja')+': '+offer.tienda;store.onclick=()=>navigate('tienda',offer.tienda);head.append(store);
   if(isBest)head.append(el('span',txt('Mejor precio','Melhor preço'),'rf-offer-best'));
   const price=el('div',null,'rf-offer-price');
   if(hasPrice(offer)){
    const main=el('div',null,'rf-offer-main');
    main.append(el('span','USD','rf-offer-cur'),el('strong',new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}).format(offer.precio_usd),'rf-offer-amount'));
    const off=typeof discountOf==='function'?discountOf(offer):0;
    if(off){main.append(el('s','USD '+new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}).format(offer.precio_original_usd),'rf-offer-old'),el('span','−'+off+'%','rf-offer-off'));}
    price.append(main);
    // How much more than the cheapest store.
    if(best!==null&&offer.precio_usd>best){const gap=offer.precio_usd-best;price.append(el('span',txt(`USD ${gap.toFixed(2)} más que el mejor precio (+${Math.round(gap/best*100)}%)`,`USD ${gap.toFixed(2)} a mais que o melhor preço (+${Math.round(gap/best*100)}%)`),'rf-offer-gap'));}
    const converted=window.RivFreeRates?.convert(offer.precio_usd)||[];
    if(converted.length){
     const box=el('div',null,'rf-offer-conv');box.setAttribute('role','group');box.setAttribute('aria-label',txt('Precio aproximado en otras monedas','Preço aproximado em outras moedas'));
     for(const item of converted){const chip=el('button',null,'rf-offer-conv-chip');chip.type='button';chip.append(el('span','≈ '+item.text));chip.title=item.name+' · '+txt('mostrar los precios en esta moneda','mostrar os preços nesta moeda');chip.setAttribute('aria-pressed',String(item.active));chip.onclick=()=>{window.RivFreeRates.choose(item.code);draw();list.querySelector(`.rf-offer-conv-chip[aria-pressed=true]`)?.focus({preventScroll:true});};box.append(chip);}
     price.append(box);
    }
   }else price.append(el('strong',txt('Sin precio publicado','Sem preço publicado'),'rf-offer-amount rf-offer-noprice'));
   row.append(head,price);appendSourceNotes(row,[offer],false);
   const foot=el('div',null,'rf-offer-foot');foot.append(offerFavoriteControls(offer));
   const actions=el('div',null,'rf-offer-actions');
   const url=safeHttpUrl(offer.url);
   if(url){const shop=el('a',null,'rf-offer-shop');shop.href=url;shop.target='_blank';shop.rel='noopener noreferrer';shop.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>';shop.prepend(el('span',txt('Ver en la tienda','Ver na loja')));shop.setAttribute('aria-label',txt('Ver en la tienda','Ver na loja')+': '+offer.tienda);actions.append(shop);}
   window.RivFreeExplore?.appendWhatsApp(actions,offer);
   // Stores without a confirmed WhatsApp: no grey button, the store link uses the space.
   actions.querySelector('button.rf-whatsapp:disabled')?.remove();
   if(actions.childElementCount)foot.append(actions);
   row.append(foot);return row;
  }
  select.onchange=filter.onchange=draw;draw();
  const detail=el('section',null,'rf-panel');detail.append(el('h2',txt('Descripción y especificaciones','Descrição e especificações')));
  const offer=group.offers.find(o=>o.descripcion)||group.offers[0],editorial=(window.RIVFREE_PRODUCT_CONTENT||[]).find(x=>x.matches(group.name));
  detail.append(el('p',offer.descripcion||editorial?.description[LANG]||txt('Consultá la publicación oficial para confirmar las características y la variante exacta de este producto.','Consulte a publicação oficial para confirmar as características e a variante exata deste produto.')));
  const parsed={};const capacity=group.name.match(/\b\d+(?:[.,]\d+)?\s*(?:ml|gb|tb|litros?|kg)\b/i);if(capacity)parsed[txt('Contenido / capacidad indicada','Conteúdo / capacidade indicada')]=capacity[0];const concentration=group.name.match(/\b(EDP|EDT|parfum|elixir)\b/i);if(concentration&&offer.categoryId==='perfumes')parsed[txt('Tipo indicado','Tipo indicado')]=concentration[0];
  const specs=el('dl',null,'rf-specs');for(const [label,value]of [[txt('Producto','Produto'),group.name],[txt('Categoría','Categoria'),Catalog.categories[offer.categoryId]?.[LANG==='es'?0:1]],...Object.entries({...parsed,...(offer.especificaciones||editorial?.specs||{})})])if(value){specs.append(el('dt',label),el('dd',String(value)));}detail.append(specs);if(editorial?.source)detail.append(link(txt('Especificaciones oficiales','Especificações oficiais'),editorial.source));page.append(detail);
  const related=window.RivFreeExploreModel?.related(group,PRODUCT_GROUPS)||[];
  page.append(el('h2',txt('Productos relacionados','Produtos relacionados')));const grid=el('div',null,'rf-related grid');grid.addEventListener('click',handleProductClick);grid.append(...related.map(g=>createProductCard({...g,visibleOffers:g.offers})));page.append(grid);
 }
 async function route(){syncView();let type,id;try{[,type,id]=location.hash.split('/');id=decodeURIComponent(id||'');}catch{heading(txt('Enlace inválido','Link inválido'));return;}
  if(type==='tiendas'||type==='tienda'){if(!Object.keys(STORE_INFO).length){heading(txt('Cargando tiendas…','Carregando lojas…'));try{STORE_INFO=await loadStoreInfoFiles();}catch{}}type==='tiendas'?directory():storePage(id);}
  else if(type==='producto')productPage(id);
  else if(type==='buscar')render();
  window.scrollTo(0,0);
 }
 window.addEventListener('hashchange',route);window.addEventListener('rivfree:catalog-ready',route);
 $('languageToggle').addEventListener('change',()=>{summaryLabel.textContent=txt('Categorías','Categorias');storesLabel.textContent=txt('Tiendas','Lojas');route();});
 setInterval(()=>{page.querySelectorAll('[data-hours-store]').forEach(b=>{const s=status(STORE_INFO[b.dataset.hoursStore]||{});b.textContent=s.text;b.className=s.open?'rf-open':'rf-muted';});},60000);

 let previewEntity=null,previewBaseStores=null;
 function showStudioEntity(data){
  if(loadingCatalog)return;
  if(!previewBaseStores)previewBaseStores={...STORE_INFO};
  STORE_INFO={...previewBaseStores,...(data.stores||{})};window.RivFreeApplyHiddenPhotos?.();
  const previousDraft=PRODUCT_GROUPS.findIndex(g=>g.key==='studio-draft');if(previousDraft>=0)PRODUCT_GROUPS.splice(previousDraft,1);
  const entity=data.entity;
  if(!entity){if(previewEntity){previewEntity=null;history.replaceState(null,'',location.pathname+location.search);route();}return;}
  previewEntity=entity;const value=entity.value||{};
  if(entity.kind==='product'){
   const draft={...value,id:value.id||'manual-preview',nombre:value.nombre||'Producto sin nombre',tienda:value.tienda||'Tienda por seleccionar',precio_usd:value.precio_usd===''?null:Number(value.precio_usd),manual:true};
   const prepared=prepareCatalog({productos:[draft]});const group=prepared.groups[0];if(!group)return;group.key='studio-draft';PRODUCT_GROUPS.push(group);
   history.replaceState(null,'',location.pathname+location.search+'#/producto/studio-draft');syncView();productPage('studio-draft');
  }else if(entity.kind==='store'){
   const name=value.nombre||'Tienda sin nombre';STORE_INFO[name]={...value,redes:{instagram:value.instagram,facebook:value.facebook,whatsapp:value.whatsapp,telegram:value.telegram}};
   window.RivFreeApplyHiddenPhotos?.();
   history.replaceState(null,'',location.pathname+location.search+'#/tienda/'+encodeURIComponent(name));syncView();storePage(name);
  }
  const badge=el('p',entity.kind==='product'?'Vista previa de la publicación que estás editando'+(value.activo===false?' · Oculta al público':''):'Vista previa de la tienda que estás editando','rf-preview-label');page.prepend(badge);
  const selector=data.field==='productSpecs'?'.rf-specs':data.field==='productDescription'?'.rf-panel':data.field==='productImage'?'.rf-product-visual':data.field?.startsWith('productPrice')?'.rf-offers':/^store(Day|HoursKnown|Exceptions)/.test(data.field||'')?'.rf-hours':data.field?.startsWith('store')?'.rf-panel':'h1';
  const editing=page.querySelector(selector);editing?.classList.add('rf-editing-target');
  if(data.field)requestAnimationFrame(()=>editing?.scrollIntoView({block:'nearest',behavior:'instant'}));
 }
 if(new URLSearchParams(location.search).has('studio-preview')&&parent!==window){
  let pending=null;
  window.addEventListener('message',event=>{
   if(event.origin!==location.origin||event.source!==parent)return;
   if(event.data?.type==='rivfree-studio-entity'){pending=event.data;showStudioEntity(pending);}
   if(event.data?.type==='rivfree-studio-navigate'){
    const target=event.data.target;
    if(target==='stores'){navigate('tiendas');return;}
    if(location.hash.startsWith('#/')){history.replaceState(null,'',location.pathname+location.search);ACTIVE_SEARCH='';$('search').value='';route();}
    requestAnimationFrame(()=> (target==='top'?window:target==='footer'?document.querySelector('footer'):$(target))?.[target==='top'?'scrollTo':'scrollIntoView']({top:0,block:'start',behavior:'instant'}));
   }
  });
  window.addEventListener('rivfree:catalog-ready',()=>{if(pending)showStudioEntity(pending);});
 }
 route();
})();
