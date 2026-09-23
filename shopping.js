// Portable shopping list: quantities are local; a shared URL is an explicit snapshot.
const quantityByKey = new Map();
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
 const byStore=new Map();let totalCents=0,missing=0,units=0;
 for(const key of favorites){
  const group=groups.get(key);
  const offer=group?.offers.filter(hasPrice).reduce((best,o)=>!best||o.precio_usd<best.precio_usd?o:best,null);
  const store=offer?.tienda||words('Sem preço disponível','Sin precio disponible');
  const qty=quantityFor(key),cents=offer?Math.round(offer.precio_usd*100)*qty:0;
  if(!offer)missing+=qty;units+=qty;totalCents+=cents;
  if(!byStore.has(store))byStore.set(store,[]);byStore.get(store).push({key,group,offer,qty,cents});
 }
 if(!favorites.size){const empty=document.createElement('p');empty.className='list-empty';empty.textContent=words('Sua próxima viagem começa aqui. Toque no ♡ de um produto para montar sua lista.','Tu próximo paseo empieza aquí. Tocá ♡ en un producto para armar tu lista.');container.append(empty);}
 for(const [store,items] of byStore){
  const section=document.createElement('section');section.className='shopping-store';
  const h=document.createElement('h3');h.textContent=store;section.append(h);
  if(STORE_INFO[store]?.direccion){const a=document.createElement('a');a.href=mapUrl(store,STORE_INFO[store].direccion);a.target='_blank';a.rel='noopener noreferrer';a.textContent=tr('Ver en el mapa');section.append(a);}
  for(const {key,group,offer,qty,cents} of items){
   const row=document.createElement('div');row.className='shopping-row';
   const description=document.createElement('div'),name=document.createElement('strong'),unit=document.createElement('small');
   name.textContent=group?.name||key;unit.textContent=offer?`${priceLabel(offer.precio_usd)} / ${words('unidade','unidad')}`:words('Fora do catálogo atual; não incluído no total.','Fuera del catálogo actual; no incluido en el total.');description.append(name,unit);
   const amount=document.createElement('strong');amount.className='line-total';amount.textContent=offer?priceLabel(cents/100):'—';
   const remove=document.createElement('button');remove.type='button';remove.className='remove-item';remove.textContent=words('Remover','Quitar');remove.setAttribute('aria-label',`${remove.textContent}: ${name.textContent}`);
   remove.onclick=()=>{toggleFavorite(key);renderShoppingList();};
   row.append(description,quantityControl(key,()=>{renderShoppingList();render();}),amount,remove);section.append(row);
  }
  const subtotal=document.createElement('p');subtotal.className='store-subtotal';subtotal.textContent=`Subtotal · ${priceLabel(items.reduce((s,i)=>s+i.cents,0)/100)}`;section.append(subtotal);container.append(section);
 }
 if(favorites.size){
  const total=document.createElement('div');total.className='shopping-total';
  const label=document.createElement('span'),amount=document.createElement('strong');label.textContent=words(`Subtotal estimado · ${units} unidades`,`Subtotal estimado · ${units} unidades`);amount.textContent=priceLabel(totalCents/100);total.append(label,amount);container.append(total);
  const note=document.createElement('p');note.className='shopping-note';note.textContent=words('Estimativa pelos menores preços do catálogo, distribuídos entre as lojas. Quantidade se refere à unidade anunciada; uma caixa deve ser selecionada como caixa.','Estimación con los menores precios del catálogo, repartidos entre tiendas. La cantidad corresponde a la unidad publicada; una caja debe seleccionarse como caja.');if(missing)note.textContent+=words(` ${missing} unidades sem preço ficam fora do total.`,` ${missing} unidades sin precio no están incluidas.`);container.append(note);
 }
 if(focusKey)for(const control of container.querySelectorAll('.quantity-control'))if(control.dataset.quantityKey===focusKey){const next=control.children[focusIndex];(next?.disabled?control.querySelector('input'):next)?.focus({preventScroll:true});}
 document.getElementById('shareShoppingList').disabled=!favorites.size;
 updateShoppingBadge();
}
function shoppingURL(){
 const url=new URL(location.href);url.search='';
 url.hash='list='+encodeURIComponent(JSON.stringify({v:1,items:[...favorites].map(key=>[key,quantityFor(key)])}));
 return url.href;
}
document.getElementById('shareShoppingList').onclick=async()=>{
 const url=shoppingURL();const field=document.getElementById('sharedListLink');field.value=url;field.hidden=false;
 document.getElementById('shareHint').textContent=words('Este link leva uma cópia da lista. Abra no celular e importe. Mudanças posteriores precisam de um novo link.','Este enlace lleva una copia de la lista. Abrilo en el celular e importá. Los cambios posteriores necesitan un enlace nuevo.');
 try {
  if(navigator.share)await navigator.share({title:'RivFree',url});
  else if(navigator.clipboard){await navigator.clipboard.writeText(url);document.getElementById('shareHint').textContent+=' '+words('Link copiado!','¡Enlace copiado!');}
  else {field.focus();field.select();}
 }catch(error){if(error.name!=='AbortError'){field.focus();field.select();}}
};
let pendingShopping=null;
function inspectSharedList(){
 pendingShopping=null;document.getElementById('importBanner').hidden=true;
 if(!location.hash.startsWith('#list='))return;
 try{
  if(location.hash.length>250000)throw new Error();
  const payload=JSON.parse(decodeURIComponent(location.hash.slice(6)));
  if(payload.v!==1||!Array.isArray(payload.items)||!payload.items.length||payload.items.length>1000)throw new Error();
  const incoming=new Map();
  for(const entry of payload.items){
   if(!Array.isArray(entry)||entry.length!==2)throw new Error();
   const [key,qty]=entry;
   if(typeof key!=='string'||!key||key.length>2000||!Number.isInteger(qty)||qty<1||qty>999||incoming.has(key))throw new Error();incoming.set(key,qty);
  }
  pendingShopping=incoming;document.getElementById('importBanner').hidden=false;
  document.getElementById('importMessage').textContent=words(`Lista recebida: ${incoming.size} produtos. Importar preserva seus outros produtos e usa as quantidades recebidas nos repetidos.`,`Lista recibida: ${incoming.size} productos. Importar conserva tus otros productos y usa las cantidades recibidas en los repetidos.`);
 }catch{announce(words('O link da lista é inválido. Sua lista foi preservada.','El enlace no es válido. Tu lista se conservó.'));}
}
document.getElementById('importShoppingList').onclick=()=>{
 if(!pendingShopping)return;
 for(const [key,qty] of pendingShopping){favorites.add(key);quantityByKey.set(key,qty);}
 persistShopping();dismissImport();render();document.getElementById('openShoppingList').click();
};
function dismissImport(){pendingShopping=null;document.getElementById('importBanner').hidden=true;history.replaceState(null,'',location.pathname+location.search);}
document.getElementById('dismissImport').onclick=dismissImport;
window.addEventListener('hashchange',inspectSharedList);
window.addEventListener('DOMContentLoaded',()=>{inspectSharedList();updateShoppingBadge();});
window.addEventListener('storage',event=>{
 if(!['rivfree-favorites','rivfree-quantities'].includes(event.key))return;
 try{favorites=new Set(JSON.parse(localStorage.getItem('rivfree-favorites')||'[]'));quantityByKey.clear();for(const [k,q] of JSON.parse(localStorage.getItem('rivfree-quantities')||'[]'))if(Number.isInteger(q)&&q>0&&q<=999)quantityByKey.set(k,q);updateShoppingBadge();render();if(document.getElementById('shoppingDialog').open)renderShoppingList();}catch{}
});
let automaticExchange=null,exchangeRequest=null,exchangeFailed=false;
function isRate(value){return value&&Number.isFinite(value.usd_brl)&&value.usd_brl>0&&value.usd_brl<1000&&Number.isFinite(Date.parse(value.actualizado));}
try{const saved=JSON.parse(localStorage.getItem('rivfree-auto-exchange'));if(isRate(saved))automaticExchange=saved;}catch{}
async function refreshAutomaticExchange(){
 if(exchangeRequest)return exchangeRequest;
 exchangeRequest=(async()=>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6000);
  try{
   const response=await fetch('https://api.frankfurter.dev/v2/rate/USD/BRL',{signal:controller.signal,cache:'no-cache'});
   if(!response.ok)throw new Error();const data=await response.json();
   const next={usd_brl:data.rate,actualizado:data.date,source:'Frankfurter'};
   if(!isRate(next)||data.base!=='USD'||data.quote!=='BRL')throw new Error();
   automaticExchange=next;exchangeFailed=false;
   try{localStorage.setItem('rivfree-auto-exchange',JSON.stringify(next));}catch{}
  }catch{exchangeFailed=true;}finally{clearTimeout(timer);updateExchangeNote();render();if(document.getElementById('shoppingDialog').open)renderShoppingList();}
 })();
 await exchangeRequest;exchangeRequest=null;
}
document.getElementById('automaticExchange').onclick=()=>{manualExchange=null;try{localStorage.removeItem('rivfree-exchange');}catch{}updateExchangeNote();render();refreshAutomaticExchange();};
document.querySelectorAll('[data-category-shortcut]').forEach(button=>button.onclick=()=>{
 document.getElementById('categoria').value=button.dataset.categoryShortcut;syncCategoryInput();render(true);document.getElementById('grid').scrollIntoView({behavior:'smooth',block:'start'});
});
