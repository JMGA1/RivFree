let favorites=new Set();
try {const saved=JSON.parse(localStorage.getItem('rivfree-favorites')||'[]');if(Array.isArray(saved))favorites=new Set(saved.filter(x=>typeof x==='string'));}catch{}
let exchange={usd_brl:null,actualizado:null};
let manualExchange=null;
try {manualExchange=JSON.parse(localStorage.getItem('rivfree-exchange'));}catch{}
function validExchange(){return Number.isFinite(exchange.usd_brl)&&exchange.usd_brl>0;}
function updateExchangeNote(){
 if(manualExchange?.usd_brl>0)exchange=manualExchange;
 document.getElementById('exchangeRate').value=validExchange()?exchange.usd_brl:'';
 document.getElementById('exchangeNote').textContent=validExchange()
 ?`Conversión aproximada / Conversão aproximada · 1 USD = R$ ${exchange.usd_brl} · ${exchange.actualizado || ''}. La tienda puede aplicar otra cotización / A loja pode aplicar outra cotação.`
 :'Ingresá una cotización para ver reales / Informe uma cotação para ver reais.';
}
function mapUrl(name,address){return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(name+' '+address);}
// El motor de agrupación cambió las claves de grupo: convierte favoritos viejos a las claves nuevas.
function migrateFavorites(groups,legacyKeys){
 if(!favorites.size||!legacyKeys)return;
 const current=new Set(groups.map(g=>g.key));let changed=false;
 for(const key of [...favorites]){
  if(current.has(key))continue;
  const next=legacyKeys[key];
  if(next&&current.has(next)){favorites.delete(key);favorites.add(next);changed=true;}
 }
 if(changed)try{localStorage.setItem('rivfree-favorites',JSON.stringify([...favorites]));}catch{}
}
function toggleFavorite(key){
 if(favorites.has(key))favorites.delete(key);else favorites.add(key);
 try{localStorage.setItem('rivfree-favorites',JSON.stringify([...favorites]));}catch{announce('No se pudo guardar la lista / Não foi possível salvar a lista');}
 render();
}
function syncFiltersURL(){
 const url=new URL(location.href),p=url.searchParams;
 const fields={q:ACTIVE_SEARCH,category:document.getElementById('categoria').value,min:document.getElementById('minPrice').value,max:document.getElementById('maxPrice').value,sort:document.getElementById('orden').value};
 for(const [key,value] of Object.entries(fields)){if(value && !(key==='sort'&&value==='precio_asc'))p.set(key,value);else p.delete(key);}
 for(const [key,id] of [['sale','soloOfertas'],['favorites','favoritesOnly']]){if(document.getElementById(id).checked)p.set(key,'1');else p.delete(key);}
 const stores=[...document.querySelectorAll('.storeChk')];p.delete('store');p.delete('stores');
 if(stores.some(el=>!el.checked)){p.set('stores','selected');stores.filter(el=>el.checked).forEach(el=>p.append('store',el.value));}
 if(url.href!==location.href)history.replaceState(null,'',url);
}
function restoreFilters(){
 const p=new URL(location.href).searchParams;
 ACTIVE_SEARCH=p.get('q')||'';document.getElementById('search').value=ACTIVE_SEARCH;
 for(const [key,id,fallback] of [['category','categoria',''],['sort','orden','precio_asc'],['min','minPrice',''],['max','maxPrice','']]){
  const el=document.getElementById(id),value=p.get(key)||fallback;
  if(el.tagName==='SELECT')el.value=[...el.options].some(o=>o.value===value)?value:fallback;
  else el.value=value!==''&&Number.isFinite(Number(value))&&Number(value)>=0?value:'';
 }
 for(const [key,id] of [['sale','soloOfertas'],['favorites','favoritesOnly']])document.getElementById(id).checked=p.get(key)==='1';
 document.querySelectorAll('.storeChk').forEach(el=>{el.checked=!p.has('stores')||p.getAll('store').includes(el.value);});
}
window.addEventListener('popstate',()=>{restoreFilters();render(true);syncCategoryInput();});
document.getElementById('favoritesOnly').addEventListener('change',()=>render(true));
document.getElementById('exchangeRate').addEventListener('change',event=>{
 const rate=Number(event.target.value);manualExchange=rate>0&&Number.isFinite(rate)?{usd_brl:rate,actualizado:new Date().toISOString().slice(0,10)}:null;
 exchange=manualExchange||{usd_brl:null};try{localStorage.setItem('rivfree-exchange',JSON.stringify(manualExchange));}catch{}
 updateExchangeNote();render();
});
document.getElementById('closeShoppingList').addEventListener('click',()=>document.getElementById('shoppingDialog').close());
document.getElementById('openShoppingList').addEventListener('click',()=>{
 const container=document.getElementById('shoppingList');container.replaceChildren();
 const byStore=new Map();let total=0;
 for(const key of favorites){
  const group=PRODUCT_GROUPS.find(g=>g.key===key);const offer=group?.offers.find(hasPrice);
  const store=offer?.tienda||'Sin precio disponible / Sem preço disponível';
  if(!byStore.has(store))byStore.set(store,[]);byStore.get(store).push({key,group,offer});if(offer)total+=offer.precio_usd;
 }
 if(!favorites.size)container.textContent='Guardá productos con ♡ / Salve produtos com ♡.';
 for(const [store,items] of byStore){
  const h=document.createElement('h3');h.textContent=store;container.append(h);
  if(STORE_INFO[store]?.direccion){const a=document.createElement('a');a.href=mapUrl(store,STORE_INFO[store].direccion);a.target='_blank';a.rel='noopener noreferrer';a.textContent=tr('Ver en el mapa');container.append(a);}
  const list=document.createElement('ul');for(const {key,group,offer} of items){const li=document.createElement('li');li.textContent=(group?.name||key.split('|')[1]||key)+' — '+(offer?priceLabel(offer.precio_usd):'No disponible / Indisponível');const remove=document.createElement('button');remove.textContent='✕';remove.setAttribute('aria-label','Quitar / Remover');remove.onclick=()=>{toggleFavorite(key);document.getElementById('openShoppingList').click();};li.append(' ',remove);list.append(li);}container.append(list);
 }
 if(favorites.size){const totalNode=document.createElement('p');totalNode.textContent='Subtotal orientativo (1 unidad por producto con precio) / Subtotal estimado: '+priceLabel(total);container.append(totalNode);}
 const dialog=document.getElementById('shoppingDialog');if(!dialog.open)dialog.showModal();
});
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).then(reg=>reg.update()).catch(console.warn));
let priceHistoryPromise;
async function openPriceHistory(offers){
 const dialog=document.getElementById('historyDialog'),container=document.getElementById('historyContent');
 container.textContent='Cargando / Carregando…';if(!dialog.open)dialog.showModal();
 try {
  if(!priceHistoryPromise)priceHistoryPromise=fetch('data/price-history.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error();return r.json();}).catch(e=>{priceHistoryPromise=null;throw e;});
  const history=await priceHistoryPromise;container.replaceChildren();
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
 }catch{container.textContent='No se pudo cargar el historial / Não foi possível carregar o histórico.';}
}
