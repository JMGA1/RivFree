// Portable shopping list: quantities are local; a shared URL is an explicit snapshot.
const quantityByKey = new Map();
const purchasedKeys=new Set();
try{const saved=JSON.parse(localStorage.getItem('rivfree-purchased')||'[]');if(Array.isArray(saved))for(const key of saved)if(typeof key==='string')purchasedKeys.add(key);}catch{}
try {
 const entries=JSON.parse(localStorage.getItem('rivfree-quantities')||'[]');
 if(Array.isArray(entries))for(const [key,qty] of entries)if(typeof key==='string'&&Number.isInteger(qty)&&qty>0&&qty<=999)quantityByKey.set(key,qty);
} catch {}
const words=(pt,es)=>LANG==='es'?es:pt;
const quantityFor=key=>quantityByKey.get(key)||1;
function persistShopping(){
 const link=document.getElementById('sharedListLink');
 if(link&&!link.hidden){link.hidden=true;link.value='';document.getElementById('shareHint').textContent=words('Lista alterada. Compartilhe novamente para gerar um link atualizado.','Lista modificada. Compartí nuevamente para generar un enlace actualizado.');}

 try {
  localStorage.setItem('rivfree-favorites',JSON.stringify([...favorites]));
  localStorage.setItem('rivfree-quantities',JSON.stringify([...quantityByKey]));
  localStorage.setItem('rivfree-purchased',JSON.stringify([...purchasedKeys]));
 } catch {announce(words('Não foi possível salvar neste navegador. Compartilhe o link para guardar a lista.','No se pudo guardar. Compartí el enlace para conservar la lista.'));}
 updateShoppingBadge();
}
function updateShoppingBadge(){
 const count=[...favorites].reduce((sum,key)=>sum+quantityFor(key),0);
 document.getElementById('listCount').textContent=String(count);
}
function quantityControl(key,onChange){
 const box=document.createElement('div');box.className='quantity-control';box.dataset.quantityKey=key;
 const minus=document.createElement('button'),input=document.createElement('input'),plus=document.createElement('button');
 minus.type=plus.type='button';minus.textContent='−';plus.textContent='+';
 minus.setAttribute('aria-label',words('Diminuir quantidade','Reducir cantidad'));
 plus.setAttribute('aria-label',words('Aumentar quantidade','Aumentar cantidad'));
 input.type='number';input.min='1';input.max='999';input.step='1';input.inputMode='numeric';input.value=quantityFor(key);
 input.setAttribute('aria-label',words('Quantidade','Cantidad'));
 function refresh(){input.value=quantityFor(key);minus.disabled=quantityFor(key)<=1;plus.disabled=quantityFor(key)>=999;}
 function set(value){
  if(!Number.isInteger(value)||value<1||value>999){refresh();return;}
  quantityByKey.set(key,value);persistShopping();refresh();onChange();
 }
 minus.onclick=()=>set(quantityFor(key)-1);plus.onclick=()=>set(quantityFor(key)+1);
 input.onchange=()=>set(Number(input.value));refresh();box.append(minus,input,plus);return box;
}
function renderShoppingList(){
 const container=document.getElementById('shoppingList');
 const focused=document.activeElement,control=focused?.closest('.quantity-control');
 const focusKey=container.contains(control)?control.dataset.quantityKey:null;
 const focusIndex=control?[...control.children].indexOf(focused):-1;
 container.replaceChildren();
 const groups=new Map(PRODUCT_GROUPS.map(g=>[g.key,g]));
 const byStore=new Map();let totalCents=0,missing=0,units=0,pendingCents=0,pendingUnits=0;
 for(const key of favorites){
  const selected=offerByFavoriteKey.get(key);
  const group=groups.get(key)||(selected?{name:selected.nombre}:null);
  const offer=selected||group?.offers?.filter(hasPrice).reduce((best,o)=>!best||o.precio_usd<best.precio_usd?o:best,null)||group?.offers?.[0];
  const store=offer?.tienda||words('Sem preço disponível','Sin precio disponible');
  const qty=quantityFor(key),cents=hasPrice(offer||{})?Math.round(offer.precio_usd*100)*qty:0;
  if(!hasPrice(offer||{}))missing+=qty;units+=qty;totalCents+=cents;if(!purchasedKeys.has(key)){pendingCents+=cents;pendingUnits+=qty;}
  if(!byStore.has(store))byStore.set(store,[]);byStore.get(store).push({key,group,offer,qty,cents});
 }
 if(!favorites.size){const empty=document.createElement('p');empty.className='list-empty';empty.textContent=words('Sua próxima viagem começa aqui. Toque no ♡ de um produto para montar sua lista.','Tu próximo paseo empieza aquí. Tocá ♡ en un producto para armar tu lista.');container.append(empty);}
 renderShoppingRoute([...byStore.keys()]);
 for(const [store,items] of byStore){
  const section=document.createElement('section');section.className='shopping-store';
  const h=document.createElement('h3');h.textContent=store;section.append(h);
  if(STORE_INFO[store]?.direccion){const a=document.createElement('a');a.href=mapUrl(store,STORE_INFO[store].direccion);a.target='_blank';a.rel='noopener noreferrer';a.textContent=tr('Ver en el mapa');section.append(a);}
  for(const {key,group,offer,qty,cents} of items){
   const row=document.createElement('div');row.className='shopping-row'+(purchasedKeys.has(key)?' purchased':'');
   const description=document.createElement('div'),name=document.createElement('strong'),unit=document.createElement('small');
   name.textContent=group?.name||key;unit.textContent=hasPrice(offer||{})?`${priceLabel(offer.precio_usd)} / ${words('unidade','unidad')}`:words('Fora do catálogo atual; não incluído no total.','Fuera del catálogo actual; no incluido en el total.');description.append(name,unit);
   const amount=document.createElement('strong');amount.className='line-total';amount.textContent=hasPrice(offer||{})?priceLabel(cents/100):'—';
   const remove=document.createElement('button');remove.type='button';remove.className='remove-item';remove.textContent=words('Remover','Quitar');remove.setAttribute('aria-label',`${remove.textContent}: ${name.textContent}`);
   remove.onclick=()=>{toggleFavorite(key);renderShoppingList();};
   const checkLabel=document.createElement('label');checkLabel.className='purchased-control';const check=document.createElement('input');check.type='checkbox';check.checked=purchasedKeys.has(key);check.dataset.purchasedKey=key;check.setAttribute('aria-label',words('Comprado','Comprado')+': '+name.textContent);const checkText=document.createElement('span');checkText.textContent=words('Comprado','Comprado');checkLabel.append(check,checkText);
   check.onchange=()=>{if(check.checked)purchasedKeys.add(key);else purchasedKeys.delete(key);persistShopping();renderShoppingList();for(const next of container.querySelectorAll('[data-purchased-key]'))if(next.dataset.purchasedKey===key)next.focus({preventScroll:true});};
   row.append(description,quantityControl(key,()=>{renderShoppingList();render();}),amount,checkLabel,remove);section.append(row);
  }
  const subtotal=document.createElement('p');subtotal.className='store-subtotal';subtotal.textContent=`Subtotal · ${priceLabel(items.reduce((s,i)=>s+i.cents,0)/100)}`;section.append(subtotal);container.append(section);
 }
 if(favorites.size){
  const total=document.createElement('div');total.className='shopping-total';
  const label=document.createElement('span'),amount=document.createElement('strong');label.textContent=words(`Subtotal estimado · ${units} unidades`,`Subtotal estimado · ${units} unidades`);amount.textContent=priceLabel(totalCents/100);total.append(label,amount);container.append(total);const pending=document.createElement('p');pending.className='shopping-pending';pending.textContent=words(`Falta comprar: ${pendingUnits} unidades · ${priceLabel(pendingCents/100)}`,`Pendiente: ${pendingUnits} unidades · ${priceLabel(pendingCents/100)}`);container.append(pending);
  const note=document.createElement('p');note.className='shopping-note';note.textContent=words('Estimativa com as lojas escolhidas; favoritos gerais usam o menor preço. Quantidade se refere à unidade anunciada; uma caixa deve ser selecionada como caixa.','Estimación con las tiendas elegidas; los favoritos generales usan el menor precio. La cantidad corresponde a la unidad publicada; una caja debe seleccionarse como caja.');if(missing)note.textContent+=words(` ${missing} unidades sem preço ficam fora do total.`,` ${missing} unidades sin precio no están incluidas.`);container.append(note);
 }
 if(focusKey)for(const control of container.querySelectorAll('.quantity-control'))if(control.dataset.quantityKey===focusKey){const next=control.children[focusIndex];(next?.disabled?control.querySelector('input'):next)?.focus({preventScroll:true});}
 document.getElementById('shareShoppingList').disabled=!favorites.size;
 updateShoppingBadge();
}
// Shared lists use short deterministic fingerprints instead of embedding full product keys.
// The codec is isolated so the format can be regression-tested without a browser.
function sharedLocatorForFavorite(key){
 if(key.startsWith('offer:'))return 'o:'+key;
 const group=PRODUCT_GROUPS.find(item=>item.key===key);
 if(group?.offers?.length){
  // Catalog.identity is intentionally the same compatibility identity used to migrate favorites.
  const identities=group.offers.map(offer=>Catalog.identity(offer)).filter(Boolean).sort((a,b)=>a.length-b.length||a.localeCompare(b));
  if(identities.length)return 'g:'+identities[0];
 }
 return 'k:'+key;
}
function shoppingURL(keys=[...favorites],single=false){
 const url=new URL(location.href);url.search='';
 const items=keys.map(key=>[sharedLocatorForFavorite(key),single?1:quantityFor(key)]);
 url.hash=SharedListCodec.encodeCompact(items);
 return url.href;
}
document.getElementById('shareShoppingList').onclick=async()=>{
 const url=shoppingURL();const field=document.getElementById('sharedListLink');field.value=url;field.hidden=false;
 document.getElementById('shareHint').textContent=words('Link compacto pronto. Ele leva uma cópia da lista e pode ser aberto em outro celular.','Enlace compacto listo. Lleva una copia de la lista y puede abrirse en otro celular.');
 try {
  if(navigator.share)await navigator.share({title:'RivFree',url});
  else if(navigator.clipboard){await navigator.clipboard.writeText(url);document.getElementById('shareHint').textContent+=' '+words('Link copiado!','¡Enlace copiado!');}
  else {field.focus();field.select();}
 }catch(error){if(error.name!=='AbortError'){field.focus();field.select();}}
};
let pendingShopping=null;
let pendingImportRequested=false;
function importDialog(){return document.getElementById('importListDialog');}
function showImportDialog(){
 const dialog=importDialog();
 if(dialog&&!dialog.open){try{dialog.showModal();}catch{dialog.setAttribute('open','');}}
}
function hideImportDialog(){
 const dialog=importDialog();
 if(dialog?.open){try{dialog.close();}catch{dialog.removeAttribute('open');}}
}
function buildSharedFavoriteIndex(){
 const index=new Map();
 const register=(locator,key)=>{
  const id=SharedListCodec.fingerprint(locator);
  if(!index.has(id))index.set(id,key);
  else if(index.get(id)!==key)index.set(id,null); // fail closed on the extraordinarily unlikely hash collision
 };
 for(const group of PRODUCT_GROUPS){
  register('k:'+group.key,group.key);
  for(const offer of group.offers){
   register('g:'+Catalog.identity(offer),group.key);
   const offerKey=offerFavoriteKey(offer);register('o:'+offerKey,offerKey);
  }
 }
 return index;
}
function resolveCompactSharedList(){
 if(!pendingShopping||pendingShopping.version!==2||!PRODUCT_GROUPS.length)return false;
 const index=buildSharedFavoriteIndex(),resolved=new Map();let missing=0;
 for(const [id,qty] of pendingShopping.items){const key=index.get(id);if(key)resolved.set(key,qty);else missing++;}
 pendingShopping.resolved=resolved;pendingShopping.missing=missing;
 const status=document.getElementById('importResolveStatus');
 if(missing){status.hidden=false;status.textContent=words(`${resolved.size} itens encontrados; ${missing} não estão mais no catálogo atual.`,`${resolved.size} productos encontrados; ${missing} ya no están en el catálogo actual.`);}
 else status.hidden=true;
 const button=document.getElementById('importShoppingList');button.disabled=!resolved.size;button.textContent=words('Importar lista','Importar lista');
 if(pendingImportRequested){pendingImportRequested=false;importPendingShopping();}
 return true;
}
function decodeLegacySharedList(){
 const incoming=SharedListCodec.decodeLegacy(location.hash);
 return incoming?{version:1,resolved:incoming,count:incoming.size,missing:0}:null;
}
function decodeCompactSharedList(){
 const incoming=SharedListCodec.decodeCompact(location.hash);
 return incoming?{version:2,items:incoming,resolved:null,count:incoming.size,missing:0}:null;
}
function inspectSharedList(){
 pendingShopping=null;pendingImportRequested=false;hideImportDialog();
 if(!location.hash.startsWith('#l=')&&!location.hash.startsWith('#list='))return;
 try{
  pendingShopping=decodeCompactSharedList()||decodeLegacySharedList();
  const count=pendingShopping.count;
  document.getElementById('importMessage').textContent=words(`Você recebeu uma lista RivFree com ${count} produtos. Quer adicioná-la à sua lista neste dispositivo? Seus favoritos atuais serão preservados.`,`Recibiste una lista de RivFree con ${count} productos. ¿Querés agregarla a tu lista en este dispositivo? Tus favoritos actuales se conservarán.`);
  document.getElementById('importResolveStatus').hidden=true;
  const button=document.getElementById('importShoppingList');button.disabled=false;button.textContent=words('Importar lista','Importar lista');
  showImportDialog();
  resolveCompactSharedList();
 }catch{pendingShopping=null;announce(words('O link da lista é inválido. Sua lista foi preservada.','El enlace no es válido. Tu lista se conservó.'));}
}
function importPendingShopping(){
 if(!pendingShopping)return;
 if(pendingShopping.version===2&&!pendingShopping.resolved){
  if(!resolveCompactSharedList()){
   pendingImportRequested=true;
   const button=document.getElementById('importShoppingList');button.disabled=true;button.textContent=words('Preparando catálogo…','Preparando catálogo…');
   document.getElementById('importResolveStatus').hidden=false;
   document.getElementById('importResolveStatus').textContent=words('A lista será importada assim que o catálogo terminar de carregar.','La lista se importará apenas termine de cargar el catálogo.');
  }
  return;
 }
 const incoming=pendingShopping.resolved;
 if(!incoming?.size)return;
 for(const [key,qty] of incoming){favorites.add(key);quantityByKey.set(key,qty);}
 persistShopping();dismissImport();render();document.getElementById('openShoppingList').click();
}
document.getElementById('importShoppingList').onclick=importPendingShopping;
function dismissImport(){
 pendingShopping=null;pendingImportRequested=false;hideImportDialog();
 history.replaceState(null,'',location.pathname+location.search);
}
document.getElementById('dismissImport').onclick=dismissImport;
importDialog()?.addEventListener('cancel',event=>{event.preventDefault();dismissImport();});
window.addEventListener('hashchange',inspectSharedList);
window.addEventListener('rivfree:catalog-ready',()=>resolveCompactSharedList());
window.addEventListener('DOMContentLoaded',()=>{inspectSharedList();updateShoppingBadge();});
window.addEventListener('storage',event=>{
 if(!['rivfree-favorites','rivfree-quantities','rivfree-purchased'].includes(event.key))return;
 try{purchasedKeys.clear();for(const key of JSON.parse(localStorage.getItem('rivfree-purchased')||'[]'))if(typeof key==='string')purchasedKeys.add(key);favorites=new Set(JSON.parse(localStorage.getItem('rivfree-favorites')||'[]'));quantityByKey.clear();for(const [k,q] of JSON.parse(localStorage.getItem('rivfree-quantities')||'[]'))if(Number.isInteger(q)&&q>0&&q<=999)quantityByKey.set(k,q);updateShoppingBadge();render();if(document.getElementById('shoppingDialog').open)renderShoppingList();}catch{}
});
let automaticExchange=null,exchangeRequest=null,exchangeFailed=false;
function validRateEntry(entry){return entry&&Number.isFinite(entry.rate)&&entry.rate>0&&entry.rate<1000000&&Number.isFinite(Date.parse(entry.date));}
function isRate(value){return !!value&&((Number.isFinite(value.usd_brl)&&value.usd_brl>0&&value.usd_brl<1000000&&Number.isFinite(Date.parse(value.actualizado)))||['BRL','UYU','ARS'].some(c=>validRateEntry(value.rates?.[c])));}
function mergeExchange(previous,next){const result={...(previous||{}),...next,rates:{...(previous?.rates||{})}};for(const c of ['BRL','UYU','ARS']){const entry=next.rates?.[c]||(c==='BRL'&&next.usd_brl?{rate:next.usd_brl,date:next.actualizado,source:next.fuente||'Frankfurter'}:null);if(validRateEntry(entry)&&(!validRateEntry(result.rates[c])||entry.date>=result.rates[c].date))result.rates[c]=entry;}return result;}
try{const saved=JSON.parse(localStorage.getItem('rivfree-auto-exchange'));if(isRate(saved))automaticExchange=saved;}catch{}
async function refreshAutomaticExchange(){
 if(exchangeRequest)return exchangeRequest;
 exchangeRequest=(async()=>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6000);
  try{
   const response=await fetch('data/exchange.json?refresh='+Date.now(),{signal:controller.signal,cache:'no-store'});
   if(!response.ok)throw new Error();const data=await response.json();
   const next=data;
   if(!isRate(next))throw new Error();
   automaticExchange=mergeExchange(automaticExchange,next);exchangeFailed=false;
   try{localStorage.setItem('rivfree-auto-exchange',JSON.stringify(automaticExchange));}catch{}
  }catch{exchangeFailed=true;}finally{clearTimeout(timer);updateExchangeNote();render();if(document.getElementById('shoppingDialog').open)renderShoppingList();}
 })();
 await exchangeRequest;exchangeRequest=null;
}
document.getElementById('automaticExchange').onclick=()=>{delete manualRates[referenceCurrency];manualExchange=null;try{localStorage.setItem('rivfree-manual-rates',JSON.stringify(manualRates));localStorage.removeItem('rivfree-exchange');}catch{}updateExchangeNote();render();refreshAutomaticExchange();};
document.querySelectorAll('[data-category-shortcut]').forEach(button=>button.onclick=()=>{
 document.getElementById('categoria').value=button.dataset.categoryShortcut;syncCategoryInput();render(true);document.getElementById('grid').scrollIntoView({behavior:'smooth',block:'start'});
});

// Directions preserve the list order; Maps chooses the origin on the user's device.
function shoppingRouteSegments(stops,limit=4){
 const result=[];let current=[],origin=null;
 function urlFor(items,start){const url=new URL('https://www.google.com/maps/dir/');url.searchParams.set('api','1');if(start)url.searchParams.set('origin',start);url.searchParams.set('destination',items.at(-1));if(items.length>1)url.searchParams.set('waypoints',items.slice(0,-1).join('|'));url.searchParams.set('travelmode','walking');return url.href;}
 for(const stop of stops){
  if(current.length&&(current.length>=limit||urlFor([...current,stop],origin).length>2048)){result.push({url:urlFor(current,origin),stops:current});origin=current.at(-1);current=[];}
  if(urlFor([stop],origin).length>2048){origin=null;if(urlFor([stop],null).length>2048)throw new Error(words('Endereço muito longo para o Google Maps.','Dirección demasiado larga para Google Maps.'));}
  current.push(stop);
 }
 if(current.length)result.push({url:urlFor(current,origin),stops:current});return result;
}
function renderShoppingRoute(stores){
 const container=document.getElementById('shoppingRoute');container.replaceChildren();if(!stores.length)return;
 const addressed=stores.filter(store=>STORE_INFO[store]?.direccion),missing=stores.filter(store=>!STORE_INFO[store]?.direccion);
 const mobile=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 try{
  const segments=shoppingRouteSegments(addressed.map(store=>store+' '+STORE_INFO[store].direccion),mobile?4:10);
  for(const [index,segment] of segments.entries()){const a=document.createElement('a');a.className='shopping-route-link';a.target='_blank';a.rel='noopener noreferrer';a.href=segment.url;a.textContent=segments.length===1?words('Abrir rota com todas as paradas','Abrir ruta con todas las paradas'):words(`Abrir trecho ${index+1} de ${segments.length}`,`Abrir tramo ${index+1} de ${segments.length}`);container.append(a);}
  if(segments.length){const p=document.createElement('p');p.textContent=words('Ordem da lista: ','Orden de la lista: ')+addressed.join(' → ')+(segments.length>1?words('. Dividida para respeitar os limites do Google Maps.','. Dividida para respetar los límites de Google Maps.'):'');container.append(p);}
 }catch(error){const p=document.createElement('p');p.textContent=error.message;container.append(p);}
 if(missing.length){const p=document.createElement('p');p.textContent=words('Sem endereço; fora da rota: ','Sin dirección; fuera de la ruta: ')+missing.join(', ');container.append(p);}
}
async function shareProduct(data){
 const url=shoppingURL([data.key],true);
 try{if(navigator.share){await navigator.share({title:data.name||'RivFree',url});return;}if(navigator.clipboard){await navigator.clipboard.writeText(url);announce(words('Link do produto copiado.','Enlace del producto copiado.'));return;}}
 catch(error){if(error.name==='AbortError')return;}
 const dialog=document.createElement('dialog');dialog.className='single-share-dialog';dialog.setAttribute('aria-label',words('Compartilhar produto','Compartir producto'));const label=document.createElement('label');label.textContent=words('Copie o link:','Copiá el enlace:');const field=document.createElement('input');field.readOnly=true;field.value=url;label.append(field);const close=document.createElement('button');close.type='button';close.textContent=words('Fechar','Cerrar');close.onclick=()=>dialog.close();dialog.append(label,close);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();field.select();
}
