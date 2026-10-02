/* Store directory: contact apps always visible, sorting and an OpenStreetMap view (Leaflet, loaded on demand). */
(() => {
 'use strict';
 const t=(es,pt)=>LANG==='es'?es:(pt||es);
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null&&text!=='')n.textContent=text;if(cls)n.className=cls;return n;};
 const number=n=>Number(n).toLocaleString(LANG==='es'?'es-UY':'pt-BR');
 const httpUrl=value=>typeof safeHttpUrl==='function'?safeHttpUrl(value):null;
 const external=(a,url)=>{a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;};

 // App links in the order visitors usually look for them. Icons are the official
 // glyphs distributed by Simple Icons (CC0) and are only used to link to each service.
 const APPS=[
  {id:'whatsapp',label:()=>'WhatsApp',url:info=>info.redes?.whatsapp},
  {id:'instagram',label:()=>'Instagram',url:info=>info.redes?.instagram},
  {id:'facebook',label:()=>'Facebook',url:info=>info.redes?.facebook},
  {id:'telegram',label:()=>'Telegram',url:info=>info.redes?.telegram},
  {id:'maps',label:()=>'Google Maps',url:(info,name)=>info.google?.url||(info.direccion&&typeof mapUrl==='function'?mapUrl(name,info.direccion):null)},
  {id:'web',label:()=>t('Web oficial','Site oficial'),url:info=>info.sitio_web}
 ];
 function appIcon(id,info){
  const icon=el('span',null,'rf-app-icon rf-app-'+id);icon.setAttribute('aria-hidden','true');
  if(id==='web'&&typeof validHexColor==='function'&&validHexColor(info?.color)){
   icon.style.setProperty('--app-bg',info.color);
   icon.style.setProperty('--app-fg',validHexColor(info.color_texto)?info.color_texto:contrastingText(info.color));
  }
  return icon;
 }
 function contactLinks(info,name,{contact=true}={}){
  info=info||{};const box=el('div',null,'rf-contact-links');box.setAttribute('role','list');
  for(const app of APPS){
   const url=httpUrl(app.url(info,name));if(!url)continue;
   const a=external(el('a',null,'rf-contact rf-contact-'+app.id),url);a.setAttribute('role','listitem');
   a.append(appIcon(app.id,info),el('span',app.label(),'rf-contact-label'));
   a.title=app.label()+' · '+(info.nombre_completo||name);a.setAttribute('aria-label',a.title);
   box.append(a);
  }
  if(contact&&info.telefono){const a=el('a',null,'rf-contact rf-contact-phone');a.href='tel:'+String(info.telefono).replace(/[^+0-9]/g,'');a.setAttribute('role','listitem');a.append(appIcon('phone'),el('span',info.telefono,'rf-contact-label'));a.setAttribute('aria-label',t('Llamar','Ligar')+' · '+info.telefono);box.append(a);}
  if(contact&&/^[^\s@?&#/]+@[^\s@?&#/]+\.[^\s@?&#/]+$/.test(info.email||'')){const a=el('a',null,'rf-contact rf-contact-mail');a.href='mailto:'+info.email;a.setAttribute('role','listitem');a.append(appIcon('mail'),el('span',info.email,'rf-contact-label'));a.setAttribute('aria-label','Email · '+info.email);box.append(a);}
  if(!box.childElementCount)box.append(el('p',t('Esta tienda todavía no tiene canales confirmados en RivFree.','Esta loja ainda não tem canais confirmados no RivFree.'),'rf-muted'));
  return box;
 }

 // Coordinates come from Studio ("ubicacion") or from a full Google Maps link.
 function coordinates(info){
  const valid=(lat,lng)=>Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180&&!(lat===0&&lng===0)?{lat,lng}:null;
  const u=info?.ubicacion;if(u){const p=valid(Number(u.lat),Number(u.lng));if(p)return p;}
  const url=String(info?.google?.url||'');
  const exact=url.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/)||url.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  return exact?valid(Number(exact[1]),Number(exact[2])):null;
 }
 function productCounts(){
  if(productCounts.catalog===ALL_PRODUCTS)return productCounts.value;
  const counts=new Map();for(const p of ALL_PRODUCTS)counts.set(p.tienda,(counts.get(p.tienda)||0)+1);
  productCounts.catalog=ALL_PRODUCTS;productCounts.value=counts;return counts;
 }

 let leafletPromise=null;
 function loadLeaflet(){
  if(window.L?.map)return Promise.resolve(window.L);
  return leafletPromise||=new Promise((resolve,reject)=>{
   if(!document.querySelector('link[data-leaflet]')){const css=el('link');css.rel='stylesheet';css.href='leaflet.css?v=1.9.4';css.dataset.leaflet='';document.head.append(css);}
   const script=el('script');script.src='leaflet.js?v=1.9.4';script.async=true;
   script.onload=()=>window.L?.map?resolve(window.L):reject(new Error('Leaflet'));
   script.onerror=()=>{leafletPromise=null;script.remove();reject(new Error('Leaflet'));};
   document.head.append(script);
  });
 }
 function directionsUrl(point){return `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}`;}
 function storePopup(name,info,point,onOpen){
  const box=el('div',null,'rf-map-popup');
  box.append(el('strong',info.nombre_completo||name));
  if(info.google?.rating!=null){const r=el('p',null,'rf-map-rating');const star=el('span','★','rf-review-star');star.setAttribute('aria-hidden','true');r.append(star,' '+Number(info.google.rating).toLocaleString(LANG==='es'?'es-UY':'pt-BR')+(info.google.count!=null?' · '+number(info.google.count)+' '+t('evaluaciones','avaliações'):''));box.append(r);}
  const status=window.RivFreeHours?.(info);if(status)box.append(el('p',status.text,status.open?'rf-open':'rf-muted'));
  if(info.direccion)box.append(el('p',info.direccion,'rf-map-address'));
  const actions=el('div',null,'rf-map-actions');
  const go=external(el('a',t('Cómo llegar','Como chegar'),'rf-map-action primary'),directionsUrl(point));
  const more=el('button',t('Ver tienda','Ver loja'),'rf-map-action');more.type='button';more.onclick=()=>onOpen(name);
  actions.append(go,more);box.append(actions);return box;
 }
 // Renders every located store; returns {focus(name)} or null when the map cannot load.
 async function renderMap(container,names,{onOpen,single=false}={}){
  container.replaceChildren(el('p',t('Cargando mapa…','Carregando mapa…'),'rf-map-status'));container.classList.add('rf-map');
  let L;try{L=await loadLeaflet();}catch{container.replaceChildren(el('p',t('No se pudo cargar el mapa. Revisá tu conexión y volvé a intentar.','Não foi possível carregar o mapa. Verifique sua conexão e tente novamente.'),'rf-map-status'));return null;}
  if(!container.isConnected)return null;
  container.replaceChildren();
  const map=L.map(container,{scrollWheelZoom:false,zoomSnap:.5,tap:true});
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,referrerPolicy:'strict-origin-when-cross-origin',attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'}).addTo(map);
  map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
  const markers=new Map(),points=[];
  for(const name of names){
   const info=STORE_INFO[name]||{},point=coordinates(info);if(!point)continue;
   const pin=el('span',null,'rf-map-pin');pin.dataset.store=typeof storeKey==='function'?storeKey(name):'';
   if(typeof applyStoreVisual==='function')applyStoreVisual(pin,name);
   const short=name.length<=4?name:name.trim()[0].toUpperCase();
   const drop=el('span',null,'rf-map-drop');drop.append(el('span',short,'rf-map-initial'));
   pin.append(drop,el('span',name,'rf-map-pin-label'));
   const icon=L.divIcon({className:'rf-map-marker',html:pin,iconSize:[0,0],iconAnchor:[0,0],popupAnchor:[0,-40]});
   const marker=L.marker([point.lat,point.lng],{icon,title:info.nombre_completo||name,keyboard:true,riseOnHover:true}).addTo(map);
   marker.bindPopup(()=>storePopup(name,info,point,onOpen||(()=>{})),{maxWidth:260,minWidth:200,autoPanPadding:[24,24]});
   markers.set(name,marker);points.push([point.lat,point.lng]);
  }
  if(!points.length){map.setView([-30.9006,-55.5408],15);}
  else if(points.length===1||single)map.setView(points[0],17);
  else map.fitBounds(L.latLngBounds(points).pad(.18),{maxZoom:17});
  const labels=()=>container.classList.toggle('rf-map-labels',map.getZoom()>=16.5||markers.size===1);map.on('zoomend',labels);labels();
  map.on('click',()=>map.scrollWheelZoom.enable());container.addEventListener('mouseleave',()=>map.scrollWheelZoom.disable());
  requestAnimationFrame(()=>map.invalidateSize());
  return {map,focus(name){const m=markers.get(name);if(!m)return false;map.setView(m.getLatLng(),Math.max(map.getZoom(),17),{animate:false});m.openPopup();return true;},markers};
 }

 const SORTS=[
  ['alpha',()=>t('A–Z','A–Z')],
  ['rating',()=>t('Mejor evaluadas','Melhor avaliadas')],
  ['items',()=>t('Más productos','Mais produtos')],
  ['reviews',()=>t('Más evaluaciones','Mais avaliações')]
 ];
 function savedSort(){try{const v=localStorage.getItem('rivfree-store-sort');return SORTS.some(([id])=>id===v)?v:'alpha';}catch{return 'alpha';}}
 function sortNames(names,mode){
  const counts=productCounts(),g=n=>STORE_INFO[n]?.google||{},collator=new Intl.Collator(LANG,{sensitivity:'base'});
  const label=n=>STORE_INFO[n]?.nombre_completo||n;
  return [...names].sort((a,b)=>{
   if(mode==='rating')return (g(b).rating??-1)-(g(a).rating??-1)||(g(b).count??-1)-(g(a).count??-1)||collator.compare(label(a),label(b));
   if(mode==='items')return (counts.get(b)||0)-(counts.get(a)||0)||collator.compare(label(a),label(b));
   if(mode==='reviews')return (g(b).count??-1)-(g(a).count??-1)||collator.compare(label(a),label(b));
   return collator.compare(label(a),label(b));
  });
 }

 // helpers: {storeExtras(info,box), specialities(name), navigate(type,id)}
 function renderDirectory(page,helpers){
  const allNames=[...new Set([...Object.keys(STORE_INFO),...ALL_PRODUCTS.map(p=>p.tienda)])].filter(Boolean);
  const located=allNames.filter(n=>coordinates(STORE_INFO[n]));
  const tools=el('div',null,'rf-store-tools');
  const search=el('input');search.type='search';search.placeholder=t('Buscar tienda o especialidad','Buscar loja ou especialidade');search.setAttribute('aria-label',search.placeholder);search.className='rf-store-search';
  const sortGroup=el('div',null,'rf-store-sort');sortGroup.setAttribute('role','group');sortGroup.setAttribute('aria-label',t('Ordenar tiendas','Ordenar lojas'));
  sortGroup.append(el('span',t('Ordenar:','Ordenar:'),'rf-store-sort-label'));
  let mode=savedSort();
  for(const [id,label] of SORTS){const b=el('button',label(),'rf-sort-chip');b.type='button';b.dataset.sort=id;b.setAttribute('aria-pressed',String(id===mode));b.onclick=()=>{mode=id;try{localStorage.setItem('rivfree-store-sort',id);}catch{}sortGroup.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.sort===id)));draw();};sortGroup.append(b);}
  const mapButton=el('button',null,'rf-map-toggle');mapButton.type='button';mapButton.setAttribute('aria-expanded','false');mapButton.setAttribute('aria-controls','storeMapPanel');
  const mapIcon=el('span',null,'rf-ui-icon rf-ui-map');mapIcon.setAttribute('aria-hidden','true');
  const mapLabel=el('span',t('Ver todas en el mapa','Ver todas no mapa'));mapButton.append(mapIcon,mapLabel);
  const top=el('div',null,'rf-store-tools-row');top.append(search,mapButton);tools.append(top,sortGroup);
  const mapPanel=el('section',null,'rf-store-map-panel');mapPanel.id='storeMapPanel';mapPanel.hidden=true;mapPanel.setAttribute('aria-label',t('Mapa de tiendas','Mapa de lojas'));
  const mapBox=el('div',null,'rf-map-canvas');const mapLegend=el('div',null,'rf-map-legend');mapLegend.setAttribute('aria-label',t('Tiendas en el mapa','Lojas no mapa'));const mapNote=el('p',null,'rf-map-note');mapPanel.append(mapBox,mapLegend,mapNote);
  const count=el('p',null,'rf-muted rf-store-count'),list=el('div',null,'rf-store-list');
  page.append(tools,mapPanel,count,list);
  let mapView=null,mapLoading=null;
  async function openMap(focus){
   mapPanel.hidden=false;mapButton.setAttribute('aria-expanded','true');mapLabel.textContent=t('Ocultar mapa','Ocultar mapa');
   const missing=allNames.filter(n=>!located.includes(n));
   mapNote.replaceChildren();
   if(missing.length){mapNote.append(t('Ubicación por confirmar: ','Localização a confirmar: '));missing.forEach((n,i)=>{const info=STORE_INFO[n]||{};const url=httpUrl(info.google?.url||(info.direccion&&typeof mapUrl==='function'?mapUrl(n,info.direccion):null));const a=url?external(el('a',info.nombre_completo||n),url):el('span',info.nombre_completo||n);mapNote.append(a);if(i<missing.length-1)mapNote.append(' · ');});}
   else mapNote.textContent=t('Tocá un marcador para ver horarios y cómo llegar.','Toque em um marcador para ver horários e como chegar.');
   if(!mapView){mapLoading||=renderMap(mapBox,allNames,{onOpen:name=>helpers.navigate('tienda',name)});mapView=await mapLoading;mapLoading=null;
    mapLegend.replaceChildren();if(mapView)for(const n of sortNames(located,'alpha')){const chip=el('button',null,'rf-map-chip card-store');chip.type='button';chip.dataset.store=typeof storeKey==='function'?storeKey(n):'';if(typeof applyStoreVisual==='function')applyStoreVisual(chip,n);chip.append(el('span',n,'card-store-label'));if(typeof decorateStoreChip==='function')decorateStoreChip(chip,n);chip.onclick=()=>{mapView.focus(n);};mapLegend.append(chip);}}
   else mapView.map.invalidateSize();
   mapPanel.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
   if(focus&&mapView)mapView.focus(focus);
  }
  function closeMap(){mapPanel.hidden=true;mapButton.setAttribute('aria-expanded','false');mapLabel.textContent=t('Ver todas en el mapa','Ver todas no mapa');}
  mapButton.onclick=()=>mapPanel.hidden?openMap():closeMap();
  function card(name){
   const info=STORE_INFO[name]||{},spec=helpers.specialities(name),counts=productCounts();
   const article=el('article',null,'rf-store-card rf-store-card-v5');if(typeof applyStoreVisual==='function')applyStoreVisual(article,name);article.dataset.store=typeof storeKey==='function'?storeKey(name):'';
   const head=el('header',null,'rf-store-head');const titles=el('div',null,'rf-store-titles');
   const title=el('h2');const titleLink=el('a',info.nombre_completo||name);titleLink.href='#/tienda/'+encodeURIComponent(name);title.append(titleLink);
   const logo=typeof storeLogo==='function'?storeLogo(name):null;if(logo){const img=el('img',null,'rf-store-title-logo');img.src=logo;img.alt='';img.decoding='async';img.referrerPolicy='no-referrer';img.onerror=()=>img.remove();titleLink.prepend(img);}
   titles.append(title,el('p',spec,'rf-specialty'));head.append(titles);
   const extras=el('div');helpers.storeExtras(info,extras);
   const review=extras.querySelector('.rf-review');
   if(review){review.classList.add('rf-store-rating');head.append(review);}
   const meta=el('div',null,'rf-store-meta');
   const status=extras.querySelector('[data-hours-store]');if(status)meta.append(status);
   const items=counts.get(name)||0;meta.append(el('span',number(items)+' '+(items===1?t('producto','produto'):t('productos','produtos')),'rf-store-items'));
   const address=el('p',null,'rf-store-address');const pin=el('span',null,'rf-ui-icon rf-ui-pin');pin.setAttribute('aria-hidden','true');address.append(pin,info.direccion||t('Dirección por confirmar','Endereço a confirmar'));
   const body=el('div',null,'rf-store-body');body.append(head,address,meta);
   const hours=extras.querySelector('.rf-hours');if(hours)body.append(hours);else{const text=[...extras.children].find(n=>n.tagName==='P'&&!n.classList.contains('rf-muted'));if(text)body.append(text);}
   body.append(contactLinks(info,name,{contact:false}));
   const actions=el('div',null,'rf-store-actions');
   const more=el('button',t('Más detalles →','Mais detalhes →'),'rf-button');more.type='button';more.onclick=()=>helpers.navigate('tienda',name);actions.append(more);
   if(coordinates(info)){const onMap=el('button',null,'rf-button rf-button-ghost');onMap.type='button';const icon=el('span',null,'rf-ui-icon rf-ui-pin');icon.setAttribute('aria-hidden','true');onMap.append(icon,t('Ver en el mapa','Ver no mapa'));onMap.onclick=()=>openMap(name);actions.append(onMap);}
   article.append(body,actions);
   // Facade photo from Studio, small version, at the start of the card.
   const cover=(Array.isArray(info.photos)?info.photos:[]).find(photo=>photo&&safeImageUrl(photo.url));
   if(cover){const link=el('a',null,'rf-store-photo');link.href='#/tienda/'+encodeURIComponent(name);link.tabIndex=-1;link.setAttribute('aria-hidden','true');
    const img=el('img');img.src=imageThumbUrl(cover.url);img.alt='';img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';link.append(img);article.prepend(link);article.classList.add('has-photo');}
   return article;
  }
  function draw(){
   list.replaceChildren();let found=0;const query=Catalog.norm(search.value.trim());
   for(const name of sortNames(allNames,mode)){
    const info=STORE_INFO[name]||{};if(query&&!Catalog.norm(name+' '+(info.nombre_completo||'')+' '+helpers.specialities(name)+' '+(info.direccion||'')).includes(query))continue;
    found++;list.append(card(name));
   }
   count.textContent=found+' '+t(found===1?'tienda encontrada':'tiendas encontradas',found===1?'loja encontrada':'lojas encontradas');
   if(!found)list.append(el('p',t('No encontramos tiendas con esa búsqueda.','Nenhuma loja encontrada.')));
  }
  search.oninput=draw;draw();
 }
 // Small map for a single store page.
 function storeMap(container,name){
  const info=STORE_INFO[name]||{},point=coordinates(info);if(!point)return null;
  const box=el('div',null,'rf-map-canvas rf-map-single');container.append(box);
  const io=('IntersectionObserver' in window)?new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){io.disconnect();renderMap(box,[name],{single:true,onOpen:()=>{}});}},{rootMargin:'200px'}):null;
  if(io)io.observe(box);else renderMap(box,[name],{single:true});
  const route=external(el('a',null,'rf-button rf-button-ghost rf-route-link'),directionsUrl(point));const icon=el('span',null,'rf-ui-icon rf-ui-route');icon.setAttribute('aria-hidden','true');route.append(icon,t('Cómo llegar','Como chegar'));container.append(route);
  return box;
 }
 window.RivFreeStores={contactLinks,coordinates,renderDirectory,storeMap,loadLeaflet,sortNames,productCounts};
})();
