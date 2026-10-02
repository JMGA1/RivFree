let favorites=new Set();
try {const saved=JSON.parse(localStorage.getItem('rivfree-favorites')||'[]');if(Array.isArray(saved))favorites=new Set(saved.filter(x=>typeof x==='string'));}catch{}
let referenceCurrency='BRL';
try{const saved=localStorage.getItem('rivfree-currency');if(['USD','BRL','UYU','ARS'].includes(saved))referenceCurrency=saved;}catch{}
let exchange={rate:null,actualizado:null},manualExchange=null,manualRates={};
try{manualRates=JSON.parse(localStorage.getItem('rivfree-manual-rates')||'{}');if(!manualRates||typeof manualRates!=='object')manualRates={};const legacy=JSON.parse(localStorage.getItem('rivfree-exchange'));if(!manualRates.BRL&&legacy?.usd_brl>0)manualRates.BRL={rate:legacy.usd_brl,actualizado:legacy.actualizado};}catch{}
function validExchange(){return referenceCurrency!=='USD'&&Number.isFinite(exchange.rate)&&exchange.rate>0&&exchange.rate<1000000;}
function referencePrice(value){return new Intl.NumberFormat(LANG,{style:'currency',currency:referenceCurrency,currencyDisplay:'code'}).format(value*exchange.rate);}
function updateExchangeNote(){
 const automatic=automaticExchange?.rates?.[referenceCurrency]||(referenceCurrency==='BRL'&&automaticExchange?.usd_brl?{rate:automaticExchange.usd_brl,date:automaticExchange.actualizado,source:automaticExchange.fuente}:null);
 manualExchange=manualRates[referenceCurrency]||null;
 exchange=manualExchange||{rate:automatic?.rate,actualizado:automatic?.date,source:automatic?.source};
 document.getElementById('referenceCurrency').value=referenceCurrency;
 const input=document.getElementById('exchangeRate');input.value=validExchange()?exchange.rate:'';input.disabled=referenceCurrency==='USD';input.setAttribute('aria-label',referenceCurrency+' / USD');
 document.getElementById('exchangePair').textContent='USD → '+referenceCurrency;
 document.getElementById('automaticExchange').disabled=referenceCurrency==='USD';
 const stale=validExchange()&&(!Number.isFinite(Date.parse(exchange.actualizado))||Date.now()-Date.parse(exchange.actualizado)>4*86400000);
 document.getElementById('exchangePreview').textContent=referenceCurrency==='USD'?'USD':validExchange()?`USD 1 ≈ ${referencePrice(1)}`:words('Cotação indisponível','Cotización no disponible');
 document.getElementById('exchangeNote').textContent=referenceCurrency==='USD'?words('Preços originais em dólares.','Precios originales en dólares.'):validExchange()
 ?`${manualExchange?words('Taxa manual','Tasa manual'):(exchange.source||'Frankfurter')+' · '+words('Taxa de referência','Tasa de referencia')} · ${exchange.actualizado||''}${stale?' · '+words('Cotação antiga','Cotización antigua'):''}${exchangeFailed&&!manualExchange?' · '+words('Sem atualização; usando taxa salva','Sin actualización; usando tasa guardada'):''}. `+words('Conversão aproximada. A loja pode aplicar outra cotação.','Conversión aproximada. La tienda puede aplicar otra cotización.')+(referenceCurrency==='ARS'?words(' Não representa dólar blue ou cartão.',' No representa dólar blue ni tarjeta.'):'')
 :words('Cotação indisponível para esta moeda. Informe uma taxa ou tente atualizar.','Cotización no disponible para esta moneda. Ingresá una tasa o intentá actualizar.');
}
function refreshCurrencyUI(){updateExchangeNote();render();if(document.getElementById('shoppingDialog').open)renderShoppingList();}
document.getElementById('referenceCurrency').addEventListener('change',event=>{referenceCurrency=event.target.value;try{localStorage.setItem('rivfree-currency',referenceCurrency);}catch{}refreshCurrencyUI();});
function mapUrl(name,address){return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(name+' '+address);}
// El motor de agrupación cambió las claves de grupo: convierte favoritos viejos a las claves nuevas.
function migrateFavorites(groups,legacyKeys){
 if(!favorites.size||!legacyKeys)return;
 const current=new Set(groups.map(g=>g.key));let changed=false;
 for(const key of [...favorites]){
  if(current.has(key))continue;
  const next=legacyKeys[key];
  if(next&&current.has(next)){favorites.delete(key);favorites.add(next);quantityByKey.set(next,Math.max(quantityFor(next),quantityFor(key)));quantityByKey.delete(key);if(purchasedKeys.has(key)){purchasedKeys.delete(key);purchasedKeys.add(next);}changed=true;}
 }
 if(changed)persistShopping();
}
function toggleFavorite(key){
 if(favorites.has(key)){favorites.delete(key);quantityByKey.delete(key);purchasedKeys.delete(key);}else favorites.add(key);
 persistShopping();
 render();
}
function syncFiltersURL(){
 const url=new URL(location.href),p=url.searchParams;
 const fields={q:ACTIVE_SEARCH,min:document.getElementById('minPrice').value,max:document.getElementById('maxPrice').value,sort:document.getElementById('orden').value};
 p.delete('category');for(const category of selectedCategories())p.append('category',category);
 const defaultSort=ACTIVE_SEARCH?'relevancia':'nombre_asc';
 for(const [key,value] of Object.entries(fields)){if(value && !(key==='sort'&&value===defaultSort))p.set(key,value);else p.delete(key);}
 for(const [key,id] of [['sale','soloOfertas'],['favorites','favoritesOnly'],['priced','hideUnavailable']]){if(document.getElementById(id).checked)p.set(key,'1');else p.delete(key);}
 if(document.getElementById('soloOfertas').checked&&MIN_DISCOUNT)p.set('discount',String(MIN_DISCOUNT));else p.delete('discount');
 const stores=[...document.querySelectorAll('.storeChk')];p.delete('store');p.delete('stores');
 // Only the chosen stores go in the link; none chosen means every store.
 if(stores.some(el=>el.checked)){p.set('stores','selected');stores.filter(el=>el.checked).forEach(el=>p.append('store',el.value));}
 if(url.href!==location.href)history.replaceState(null,'',url);
}
function restoreFilters(){
 const p=new URL(location.href).searchParams;
 for(const option of document.getElementById('categoria').options)option.selected=!!option.value&&p.getAll('category').includes(option.value);
 ACTIVE_SEARCH=p.get('q')||'';document.getElementById('search').value=ACTIVE_SEARCH;
 for(const [key,id,fallback] of [['sort','orden',ACTIVE_SEARCH?'relevancia':'nombre_asc'],['min','minPrice',''],['max','maxPrice','']]){
  const el=document.getElementById(id),value=p.get(key)||fallback;
  if(el.tagName==='SELECT')el.value=[...el.options].some(o=>o.value===value)?value:fallback;
  else el.value=value!==''&&Number.isFinite(Number(value))&&Number(value)>=0?value:'';
 }
 for(const [key,id] of [['sale','soloOfertas'],['favorites','favoritesOnly'],['priced','hideUnavailable']])document.getElementById(id).checked=p.get(key)==='1';
 {const discount=Number(p.get('discount'));MIN_DISCOUNT=Number.isInteger(discount)&&discount>=5&&discount<=95?discount:0;}
 {const chosen=p.has('stores')?p.getAll('store'):[];const boxes=[...document.querySelectorAll('.storeChk')];
  boxes.forEach(el=>{el.checked=chosen.includes(el.value);});
  if(boxes.length&&boxes.every(el=>el.checked))boxes.forEach(el=>{el.checked=false;});}
}
window.addEventListener('popstate',()=>{restoreFilters();render(true);syncCategoryInput();});
document.getElementById('favoritesOnly').addEventListener('change',()=>render(true));
document.getElementById('exchangeRate').addEventListener('change',event=>{
 const rate=Number(event.target.value);
 if(Number.isFinite(rate)&&rate>0&&rate<1000000)manualRates[referenceCurrency]={rate,actualizado:new Date().toISOString().slice(0,10)};
 else delete manualRates[referenceCurrency];
 try{localStorage.setItem('rivfree-manual-rates',JSON.stringify(manualRates));localStorage.removeItem('rivfree-exchange');}catch{}
 refreshCurrencyUI();
});
document.getElementById('closeShoppingList').addEventListener('click',()=>document.getElementById('shoppingDialog').close());
document.getElementById('openShoppingList').addEventListener('click',()=>{
 renderShoppingList();
 const dialog=document.getElementById('shoppingDialog');if(!dialog.open)dialog.showModal();
});
const _rfLocalHost=['127.0.0.1','localhost'].includes(location.hostname);
const _rfStudioPreview=new URLSearchParams(location.search).has('studio-preview');
if('serviceWorker' in navigator&&!_rfLocalHost&&!_rfStudioPreview)window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).then(reg=>reg.update()).catch(console.warn));
let priceHistoryPromise,historyTicket=0;
const historyChunks=new Map();
async function historyForOffers(offers){
 if(!priceHistoryPromise)priceHistoryPromise=fetchWithTimeout('data/price-history/index.json').catch(error=>{priceHistoryPromise=null;throw error;});
 const index=await priceHistoryPromise;
 if(index.algorithm!=='sha256-2'||!index.shards)throw new Error('Invalid history index');
 const keys=await Promise.all(offers.map(async offer=>{
  const bytes=new TextEncoder().encode(offer.url);
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
  return digest[0].toString(16).padStart(2,'0');
 }));
 const chunks=await Promise.all([...new Set(keys)].map(key=>{
  const version=index.shards[key];if(!version)return {};
  if(!historyChunks.has(key)){
   const request=fetchWithTimeout(`data/price-history/${key}.json?v=${encodeURIComponent(version)}`).catch(error=>{historyChunks.delete(key);throw error;});
   historyChunks.set(key,request);
   if(historyChunks.size>16)historyChunks.delete(historyChunks.keys().next().value);
  }
  return historyChunks.get(key);
 }));
 return Object.assign({},...chunks);
}
async function openPriceHistory(offers){
 const ticket=++historyTicket;
 const dialog=document.getElementById('historyDialog'),container=document.getElementById('historyContent');
 container.textContent='Cargando / Carregando…';if(!dialog.open)dialog.showModal();
 try {
  const history=await historyForOffers(offers);if(ticket!==historyTicket)return;container.replaceChildren();
  let count=0;
  for(const offer of offers){
   const points=history[offer.url];if(!Array.isArray(points)||!points.length)continue;count++;
   const title=document.createElement('h3');title.textContent=offer.tienda;container.append(title);
   const valid=points.filter(p=>Array.isArray(p)&&Number.isFinite(p[1])&&p[1]>0&&Number.isFinite(Date.parse(p[0])));
   if(valid.length>1){
    const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 600 160');svg.setAttribute('role','img');svg.setAttribute('aria-label','Evolución del precio USD / Evolução do preço USD');
    const values=valid.map(p=>p[1]),min=Math.min(...values),max=Math.max(...values);const times=valid.map(p=>Date.parse(p[0])),first=times[0],last=times.at(-1);
    const line=document.createElementNS(ns,'polyline');line.setAttribute('points',valid.map((p,i)=>`${20+(times[i]-first)/(last-first||1)*560},${130-(p[1]-min)/(max-min||1)*100}`).join(' '));line.setAttribute('fill','none');line.setAttribute('stroke','#b42335');line.setAttribute('stroke-width','3');svg.append(line);
    for(const [text,y] of [[`USD ${max.toFixed(2)}`,20],[`USD ${min.toFixed(2)}`,155]]){const label=document.createElementNS(ns,'text');label.setAttribute('x','20');label.setAttribute('y',y);label.setAttribute('fill','currentColor');label.textContent=text;svg.append(label);}container.append(svg);
   }
   const table=document.createElement('table');const caption=document.createElement('caption');caption.textContent='Fecha / Data · USD';table.append(caption);
   for(const [date,price] of valid.slice(-10)){const row=document.createElement('tr');for(const text of [new Date(date).toLocaleDateString(LANG),price.toFixed(2)]){const cell=document.createElement('td');cell.textContent=text;row.append(cell);}table.append(row);}container.append(table);
  }
  if(!count)container.textContent='El historial empieza con las próximas actualizaciones; no hay precios anteriores registrados. / O histórico começa nas próximas atualizações.';
 }catch{if(ticket!==historyTicket)return;container.textContent='No se pudo cargar el historial / Não foi possível carregar o histórico.';}
}
