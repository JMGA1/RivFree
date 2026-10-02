/* Studio → Catálogo: search any product that comes from the stores' websites and correct it.
   Only the search results are loaded (never the ~35k products); changes are saved as corrections. */
(() => {
 const E=window.RivFreeEditor,$=id=>document.getElementById(id);
 if(!E||!$('catalogForm'))return;
 const C=typeof Catalog!=='undefined'?Catalog:null,CATEGORIES=C?.categories||{};
 let results=[],selected=null,searchTimer=0,searchSeq=0,storesLoaded=false;

 const usd=value=>Number.isFinite(value)?'USD '+Number(value).toFixed(2):'sin precio';
 const local=url=>typeof url==='string'&&(url.startsWith('assets/')||url.startsWith('contributor-assets/'));
 const categoryOf=product=>C?.category?C.category(product.categoria||'',product.nombre||''):(product.categoria||'otros');
 const categoryLabel=id=>CATEGORIES[id]?.[0]||id;
 // Same rules as the price fields of the product form: "29,90", "1.299,90", "USD 29,90".
 function decimalValue(raw){
  let value=String(raw??'').trim().replace(/[\s ]/g,'').replace(/^(?:US\$|U\$S|USD|\$)/i,'');
  if(!value)return '';
  if(value.includes(',')&&value.includes('.')){const decimal=value.lastIndexOf(',')>value.lastIndexOf('.')?',':'.';value=value.split(decimal===','?'.':',').join('').replace(decimal,'.');}
  else if(value.includes(','))value=(value.match(/,/g).length===1)?value.replace(',','.'):value.replace(/,/g,'');
  return /^\d+(?:\.\d+)?$/.test(value)?value:null;
 }
 const asNumber=value=>value===''||value===null?null:Number(value);
 // What visitors see for an item: the store data with its correction on top.
 function effective(item){
  const fix=item.correction||{},out={...item};
  for(const key of ['nombre','categoria','imagen'])if(fix[key])out[key]=fix[key];
  const priceActive=Object.hasOwn(fix,'precio_usd')&&(fix.precio_fijo===true||(fix.precio_base??null)===(item.precio_usd??null));
  if(priceActive){out.precio_usd=fix.precio_usd;out.precio_original_usd=fix.precio_original_usd??null;out.en_oferta=!!fix.en_oferta;}
  out.priceActive=priceActive;out.hidden=fix.oculto===true;return out;
 }

 // Category list: the same categories the site uses.
 $('catalogCategory').replaceChildren(...Object.entries(CATEGORIES).map(([id,labels])=>new Option(labels[0],id)));

 function setMessage(text){$('catalogMessage').textContent=text||'';}
 function updateCount(count){const badge=$('catalogCorrectionCount');if(!badge)return;badge.textContent=String(count||0);badge.hidden=!count;}

 async function search(){
  clearTimeout(searchTimer);
  const seq=++searchSeq,q=$('catalogSearch').value.trim(),store=$('catalogStore').value,only=$('catalogOnlyCorrected').checked;
  if(q||store||only)setMessage('Buscando…');
  try{
   const data=await E.api('/api/manual/catalog-search',{q,store,only_corrected:only});
   if(seq!==searchSeq)return;
   if(!storesLoaded&&Array.isArray(data.stores)){storesLoaded=true;const current=$('catalogStore').value;$('catalogStore').replaceChildren(new Option('Todas las tiendas',''),...data.stores.map(name=>new Option(name,name)));$('catalogStore').value=current;}
   updateCount(data.corrections_count);
   results=data.items||[];setMessage(data.message||(data.total===1?'1 producto.':`${data.total} productos.`));renderResults();
  }catch(error){if(seq===searchSeq){setMessage(error.message);results=[];renderResults();}}
 }
 function scheduleSearch(){clearTimeout(searchTimer);searchTimer=setTimeout(search,250);}

 function renderResults(){
  const list=$('catalogResults');list.replaceChildren();
  for(const item of results){
   const view=effective(item),button=document.createElement('button');button.type='button';button.className='list-item catalog-item';button.dataset.key=item.key;
   button.classList.toggle('selected',selected?.key===item.key);
   const thumb=document.createElement('span');thumb.className='catalog-thumb';
   if(view.imagen){const img=document.createElement('img');img.alt='';img.loading='lazy';img.referrerPolicy='no-referrer';img.src=local(view.imagen)?'/'+view.imagen:view.imagen;img.onerror=()=>img.remove();thumb.append(img);}
   const info=document.createElement('span');info.className='catalog-item-info';
   const name=document.createElement('strong');name.textContent=view.nombre||'(sin nombre)';
   const meta=document.createElement('small');meta.textContent=`${item.tienda} · ${usd(view.precio_usd)}`;
   info.append(name,meta);
   const flags=document.createElement('span');flags.className='catalog-flags';
   if(item.missing)flags.append(flag('Ya no está','warn'));else if(view.hidden)flags.append(flag('Oculto','muted'));else if(item.correction)flags.append(flag('Corregido','good'));
   button.append(thumb,info,flags);button.onclick=()=>choose(item.key);list.append(button);
  }
 }
 function flag(text,kind){const span=document.createElement('span');span.className='catalog-flag '+kind;span.textContent=text;return span;}

 function updateImagePreview(){
  const box=$('catalogImagePreview'),url=$('catalogImage').value.trim();box.replaceChildren();
  if(!url){const span=document.createElement('span');span.textContent='Sin imagen';box.append(span);return;}
  const img=document.createElement('img');img.alt='Vista previa';img.referrerPolicy='no-referrer';img.src=local(url)?'/'+url:url;
  img.onerror=()=>{box.replaceChildren();const span=document.createElement('span');span.textContent='No se pudo cargar la imagen';box.append(span);};box.append(img);
 }

 async function choose(key){
  if(selected&&selected.key!==key&&E.hasUnsaved?.()){
   const ok=await E.confirmDialog({title:'Cambiar de producto',message:'Hay cambios sin guardar en este producto. Si cambiás, se pierden.',confirmText:'Cambiar sin guardar',danger:true});
   if(!ok)return;
  }
  const item=results.find(x=>x.key===key);if(!item)return;fill(item);
 }
 function fill(item){
  selected=item;const view=effective(item),fix=item.correction||{};
  $('catalogEmpty').hidden=true;$('catalogFields').hidden=false;
  $('catalogFormTitle').textContent=view.nombre||'(sin nombre)';
  const badge=$('catalogBadge');badge.hidden=false;badge.textContent=item.missing?'Ya no está en la tienda':item.correction?'Corregido':'Original';badge.className='badge'+(item.correction?' good':'');
  $('catalogStoreName').textContent=item.tienda;$('catalogLink').href=/^https:\/\//.test(item.url)?item.url:'#';
  $('catalogName').value=view.nombre||'';$('catalogNameOriginal').textContent=fix.nombre?'Original de la tienda: '+item.nombre:'';
  const original=categoryOf(item);$('catalogCategory').value=fix.categoria&&CATEGORIES[fix.categoria]?fix.categoria:original;
  $('catalogCategoryOriginal').textContent=fix.categoria?'Según la tienda: '+categoryLabel(original):'';
  $('catalogHidden').checked=fix.oculto===true;
  $('catalogPrice').value=view.precio_usd??'';$('catalogOldPrice').value=view.precio_original_usd??'';$('catalogOffer').checked=!!view.en_oferta;$('catalogPriceFixed').checked=fix.precio_fijo===true;
  const stale=Object.hasOwn(fix,'precio_usd')&&!view.priceActive;
  $('catalogPriceOriginal').textContent=`Precio de la tienda hoy: ${usd(item.precio_usd)}`+(item.en_oferta&&Number.isFinite(item.precio_original_usd)?` (antes ${usd(item.precio_original_usd)})`:'')+
   (view.priceActive&&!fix.precio_fijo?` · tu precio (${usd(fix.precio_usd)}) se usa mientras la tienda no lo cambie.`:'')+
   (stale?` · la tienda cambió su precio, así que tu precio anterior (${usd(fix.precio_usd)}) ya no se usa.`:'');
  $('catalogImage').value=view.imagen||'';$('catalogImageFile').value='';updateImagePreview();
  $('catalogRevert').disabled=!item.correction;
  for(const field of $('catalogForm').querySelectorAll('input,select,button'))if(field.id!=='catalogRevert')field.disabled=!!item.missing&&field.type!=='button';
  E.clearFieldErrors?.($('catalogForm'));E.setDirty(false);renderResults();
  window.dispatchEvent(new Event('rivfree-catalog-selected'));$('catalogForm').dispatchEvent(new Event('change'));
 }

 // Only what differs from the store data is sent; the server stores the rest as "no correction".
 function correctionFromForm(){
  const item=selected,correction={};
  const name=$('catalogName').value.trim();if(name&&name!==item.nombre)correction.nombre=name;
  const category=$('catalogCategory').value;if(category&&category!==categoryOf(item))correction.categoria=category;
  const image=$('catalogImage').value.trim();if(image&&image!==item.imagen)correction.imagen=image;
  if($('catalogHidden').checked)correction.oculto=true;
  const price=decimalValue($('catalogPrice').value),old=decimalValue($('catalogOldPrice').value);
  if(price===null){E.setFieldError($('catalogPrice'),'Escribí solo el número, por ejemplo 29,90.');return null;}
  if(old===null){E.setFieldError($('catalogOldPrice'),'Escribí solo el número, por ejemplo 39,90.');return null;}
  const offer=$('catalogOffer').checked,fixed=$('catalogPriceFixed').checked;
  if(offer&&(price===''||old===''||Number(old)<=Number(price))){E.setFieldError($('catalogOldPrice'),'Para mostrar la oferta, el precio anterior tiene que ser mayor que el precio actual.');return null;}
  const samePrice=asNumber(price)===(item.precio_usd??null)&&asNumber(old)===(item.precio_original_usd??null)&&offer===!!item.en_oferta;
  if(!samePrice||fixed)Object.assign(correction,{precio_usd:price,precio_original_usd:old,en_oferta:offer,precio_fijo:fixed});
  return correction;
 }

 $('catalogForm').addEventListener('submit',async event=>{
  event.preventDefault();if(!selected||selected.missing)return;
  E.clearFieldErrors?.($('catalogForm'));
  const image=$('catalogImage').value.trim();
  if(image&&!local(image)&&!/^https:\/\/[^\s]+$/i.test(image))return E.setFieldError($('catalogImage'),'Usá una URL https:// o una foto subida desde Studio.');
  const correction=correctionFromForm();if(!correction)return;
  const price=Number(correction.precio_usd),before=selected.precio_usd;
  if(Object.hasOwn(correction,'precio_usd')&&correction.precio_usd!==''&&Number(before)>0&&Math.abs(price-before)/before>0.5){
   const change=Math.round((price-before)/before*100);
   const ok=await E.confirmDialog({title:'¿El precio es correcto?',message:`La tienda publica USD ${Number(before).toFixed(2)} y vas a mostrar USD ${price.toFixed(2)} (${change>0?'+':''}${change}%). Revisá que no falte o sobre un número.`,confirmText:'Sí, guardar'});
   if(!ok)return $('catalogPrice').focus();
  }
  if(correction.oculto&&!selected.correction?.oculto){
   const ok=await E.confirmDialog({title:'Ocultar producto',message:'Deja de verse en el sitio después de publicar. Podés volver a mostrarlo desde acá con «Solo los que corregí».',items:[`${selected.nombre} · ${selected.tienda}`],confirmText:'Ocultar'});
   if(!ok)return;
  }
  try{
   const saved=await E.api('/api/manual/save-correction',{key:selected.key,correction});
   results=results.map(item=>item.key===saved.item.key?saved.item:item);updateCount(saved.corrections_count);
   fill(saved.item);E.notify(saved.message+' Publicá para que se vea en el sitio.');
  }catch(error){E.notify(error.message,true);}
 });
 $('catalogRevert').addEventListener('click',async()=>{
  if(!selected?.correction)return;
  const ok=await E.confirmDialog({title:'Volver a los datos de la tienda',message:'Se borra tu corrección de este producto: vuelven el nombre, la categoría, el precio y la foto que publica la tienda.',items:[`${selected.correction.nombre||selected.nombre||selected.key} · ${selected.tienda}`],confirmText:'Volver al original',danger:true});
  if(!ok)return;
  try{
   const saved=await E.api('/api/manual/delete-correction',{key:selected.key});
   if(saved.item.missing&&$('catalogOnlyCorrected').checked){results=results.filter(item=>item.key!==saved.item.key);selected=null;$('catalogFields').hidden=true;$('catalogEmpty').hidden=false;$('catalogBadge').hidden=true;$('catalogFormTitle').textContent='Elegí un producto';renderResults();}
   else{results=results.map(item=>item.key===saved.item.key?saved.item:item);fill(saved.item);}
   updateCount(saved.corrections_count);E.notify(saved.message);
  }catch(error){E.notify(error.message,true);}
 });
 $('catalogImage').addEventListener('input',updateImagePreview);
 $('catalogImageReset').addEventListener('click',()=>{if(!selected)return;$('catalogImage').value=selected.imagen||'';updateImagePreview();E.setDirty(true);$('catalogForm').dispatchEvent(new Event('input'));});
 $('catalogImageFile').addEventListener('change',async()=>{
  const file=$('catalogImageFile').files[0];if(!file)return;
  try{
   if(file.size>15*1024*1024)throw new Error('La imagen supera los 15 MB.');
   const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('No se pudo leer la imagen'));reader.readAsDataURL(file);});
   const result=await E.api('/api/manual/upload-image',{filename:file.name,data});
   $('catalogImage').value=result.path;updateImagePreview();E.setDirty(true);$('catalogForm').dispatchEvent(new Event('input'));E.notify('Foto lista. Guardá la corrección para usarla.');
  }catch(error){E.notify(error.message,true);}finally{$('catalogImageFile').value='';}
 });
 $('catalogForm').addEventListener('input',()=>{if(selected)E.setDirty(true);});
 $('catalogSearch').addEventListener('input',scheduleSearch);
 $('catalogSearch').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();search();}});
 $('catalogStore').addEventListener('change',search);$('catalogOnlyCorrected').addEventListener('change',search);
 window.addEventListener('rivfree-tab-change',event=>{if(event.detail?.tab==='catalog'){if(!storesLoaded)search();setTimeout(()=>$('catalogSearch').focus(),0);}});
 window.addEventListener('rivfree-editor-state',event=>updateCount(event.detail?.corrections_count));

 window.RivFreeCatalogEditor={
  search,
  // The live preview shows the product as visitors would see it with the correction.
  previewProduct(){
   if(!selected||$('catalogFields').hidden)return null;
   const price=decimalValue($('catalogPrice').value),old=decimalValue($('catalogOldPrice').value);
   return {id:'catalog-preview',tienda:selected.tienda,url:selected.url,nombre:$('catalogName').value.trim()||selected.nombre,categoria:$('catalogCategory').value,
    precio_usd:price===null?selected.precio_usd:price,precio_original_usd:old===null||old===''?null:old,en_oferta:$('catalogOffer').checked,
    imagen:$('catalogImage').value.trim(),activo:!$('catalogHidden').checked,fuente_tipo:'web',fuente_url:selected.url};
  },
  selected:()=>selected
 };
})();
