// A store offer is distinct from a general favorite (which uses the lowest price).
const offerByFavoriteKey=new Map();
function offerFavoriteKey(offer){return 'offer:'+JSON.stringify([offer.tienda,canonicalProductUrl(offer.url)||offer.nombre]);}
function indexFavoriteOffers(){offerByFavoriteKey.clear();for(const group of PRODUCT_GROUPS)for(const offer of group.offers)offerByFavoriteKey.set(offerFavoriteKey(offer),offer);}
function offerFavoriteControls(offer){
 const key=offerFavoriteKey(offer),box=document.createElement('div');box.className='offer-favorite-controls';
 const heart=document.createElement('button');heart.type='button';heart.className='favorite-button heart-button';
 const quantity=quantityControl(key,()=>{if(!favorites.has(key)){favorites.add(key);persistShopping();render();}refresh();});
 function refresh(){const saved=favorites.has(key);heart.textContent=saved?'♥':'♡';heart.setAttribute('aria-pressed',String(saved));heart.setAttribute('aria-label',words(saved?'Remover dos favoritos':'Salvar nos favoritos',saved?'Quitar de favoritos':'Guardar en favoritos')+': '+offer.tienda+' · '+offer.nombre);quantity.querySelector('input').value=quantityFor(key);quantity.querySelector('button').disabled=quantityFor(key)<=1;quantity.lastElementChild.disabled=quantityFor(key)>=999;}
 heart.onclick=()=>{toggleFavorite(key);refresh();};refresh();box.append(heart,quantity);return box;
}
function openProductPreview(data){
 const dialog=document.getElementById('productDialog'),content=document.getElementById('productPreviewContent');
 document.getElementById('productPreviewTitle').textContent=readableProductName(data.name);content.replaceChildren();
 const imageUrl=safeHttpUrl(data.offers.find(o=>safeHttpUrl(o.imagen))?.imagen);
 if(imageUrl){const img=document.createElement('img');img.className='product-preview-image';img.src=imageUrl;img.alt=data.name;img.onerror=()=>addImagePlaceholder(img.parentElement);content.append(img);}
 for(const offer of [...data.offers].sort(compareOfferPrices)){
  const row=document.createElement('div');row.className='preview-offer';
  const title=document.createElement('strong');title.textContent=offer.tienda;
  const price=document.createElement('p');price.textContent=hasPrice(offer)?priceLabel(offer.precio_usd):tr('No disponible');
  row.append(title,price,offerFavoriteControls(offer));
  const url=safeHttpUrl(offer.url);if(url){const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.textContent=tr(`Ver en ${offer.tienda} ↗`);row.append(link);}
  content.append(row);
 }
 if(!dialog.open)dialog.showModal();
}
document.getElementById('productPreviewClose').onclick=()=>document.getElementById('productDialog').close();
document.getElementById('productDialog').addEventListener('click',event=>{if(event.target===event.currentTarget){const r=event.currentTarget.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)event.currentTarget.close();}});
