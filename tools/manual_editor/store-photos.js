/* Store photos (facade first): upload from the computer — iPhone HEIC included —, caption, order and remove.
   The list is still saved through the "URL | descripción | atribución" text field, so older data keeps working. */
(() => {
 const E=window.RivFreeEditor,M=window.RivFreeCatalogFields,$=id=>document.getElementById(id);
 const area=$('storePhotos');if(!E||!M||!area)return;
 const MAX_BYTES=15*1024*1024,DEFAULT_CREDIT='Foto: RivFree';
 const label=area.closest('label');
 const box=document.createElement('section');box.className='store-photos';box.id='storePhotoManager';
 box.innerHTML=`<div class="store-photos-head"><div><h3>Fotos del local</h3><p class="form-help">La primera es la <strong>portada</strong> de la ficha de la tienda. Podés subir JPG, PNG, WebP o <strong>HEIC del iPhone</strong>, hasta 15 MB cada una: se guardan optimizadas y sin datos de ubicación.</p></div>
  <label class="button primary store-photos-upload"><input id="storePhotoFiles" type="file" multiple accept="image/*,.heic,.heif"><span>+ Subir fotos</span></label></div>
  <p id="storePhotoStatus" class="form-help" role="status"></p><ol id="storePhotoList" class="store-photo-list"></ol>`;
 const details=document.createElement('details');details.className='store-photos-text';
 const summary=document.createElement('summary');summary.textContent='Agregar o editar como texto (enlaces)';details.append(summary);
 label.replaceWith(box);box.after(details);details.append(label);
 const list=$('storePhotoList'),status=$('storePhotoStatus'),files=$('storePhotoFiles');

 const parse=()=>area.value.split('\n').map(line=>line.trim()).filter(Boolean).map(line=>{const [url,caption='',attribution='']=line.split('|').map(s=>s.trim());return {url,caption,attribution};});
 function write(photos){
  area.value=photos.map(p=>[p.url,p.caption,p.attribution].map(v=>String(v||'').replace(/[|\n]/g,' ').trim()).join(' | ')).join('\n');
  area.dispatchEvent(new Event('input',{bubbles:true}));render();
 }
 const local=url=>url.startsWith('assets/')||url.startsWith('contributor-assets/');
 // Uploaded photos have a small "-thumb.webp" twin: the list loads that one.
 const thumbOf=url=>local(url)&&/\.webp$/i.test(url)&&!/-thumb\.webp$/i.test(url)?url.replace(/\.webp$/i,'-thumb.webp'):url;
 function render(){
  const photos=parse();list.replaceChildren();
  if(!photos.length){const empty=document.createElement('li');empty.className='store-photo-empty';empty.textContent='Todavía no hay fotos. Subí una de la fachada para que aparezca arriba en la ficha de la tienda.';list.append(empty);return;}
  photos.forEach((photo,index)=>{
   const item=document.createElement('li');item.className='store-photo';
   const figure=document.createElement('div');figure.className='store-photo-image';
   const img=document.createElement('img');img.alt=photo.caption||'Foto '+(index+1);img.referrerPolicy='no-referrer';img.loading='lazy';
   const src=thumbOf(photo.url);img.src=local(src)?'/'+src:src;img.onerror=()=>{if(img.src.endsWith('-thumb.webp')&&local(photo.url)){img.src='/'+photo.url;return;}figure.classList.add('broken');figure.textContent='No se pudo cargar';};
   figure.append(img);if(index===0){const badge=document.createElement('span');badge.className='store-photo-cover';badge.textContent='Portada';figure.append(badge);}
   const fields=document.createElement('div');fields.className='store-photo-fields';
   const caption=document.createElement('input');caption.type='text';caption.maxLength=300;caption.value=photo.caption;caption.placeholder=index===0?'Fachada':'Descripción (opcional)';caption.setAttribute('aria-label','Descripción de la foto '+(index+1));
   const credit=document.createElement('input');credit.type='text';credit.maxLength=200;credit.value=photo.attribution;credit.placeholder=DEFAULT_CREDIT;credit.setAttribute('aria-label','Atribución de la foto '+(index+1));
   for(const [input,key] of [[caption,'caption'],[credit,'attribution']])input.addEventListener('change',()=>{const next=parse();next[index][key]=input.value.trim();write(next);});
   const actions=document.createElement('div');actions.className='store-photo-actions';
   const move=(delta,text,title)=>{const b=document.createElement('button');b.type='button';b.className='button';b.textContent=text;b.title=title;b.disabled=index+delta<0||index+delta>=photos.length;
    b.onclick=()=>{const next=parse();[next[index],next[index+delta]]=[next[index+delta],next[index]];write(next);list.children[index+delta]?.querySelector(`button[title="${title}"]`)?.focus();};return b;};
   const first=document.createElement('button');first.type='button';first.className='button';first.textContent='Usar de portada';first.hidden=index===0;
   first.onclick=()=>{const next=parse();next.unshift(next.splice(index,1)[0]);write(next);};
   const remove=document.createElement('button');remove.type='button';remove.className='button danger';remove.textContent='Quitar';
   remove.onclick=()=>{const next=parse();next.splice(index,1);write(next);E.notify('Foto quitada. Guardá la tienda para aplicar el cambio.');};
   actions.append(move(-1,'↑','Subir'),move(1,'↓','Bajar'),first,remove);
   fields.append(caption,credit,actions);item.append(figure,fields);list.append(item);
  });
 }
 const read=file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('No se pudo leer '+file.name));reader.readAsDataURL(file);});
 files.addEventListener('change',async()=>{
  const chosen=[...files.files];files.value='';if(!chosen.length)return;
  const added=[],problems=[];
  for(const [i,file] of chosen.entries()){
   status.textContent=`Subiendo ${i+1} de ${chosen.length}: ${file.name}…`;
   try{
    if(file.size>MAX_BYTES)throw new Error(`${file.name} pesa más de 15 MB.`);
    const result=await E.api('/api/manual/upload-image',{filename:file.name,data:await read(file)});
    const existing=parse().length+added.length;
    added.push({url:result.path,caption:existing===0?'Fachada':'',attribution:DEFAULT_CREDIT});
   }catch(error){problems.push(error.message);}
  }
  if(added.length)write([...parse(),...added]);
  status.textContent=added.length?`${added.length} foto${added.length===1?' subida':'s subidas'}. Guardá la tienda para publicarlas.`:'';
  if(problems.length)E.notify(problems.join(' '),true);else if(added.length)E.notify('Fotos listas. Guardá la tienda para aplicar el cambio.');
 });
 area.addEventListener('change',render);
 const fill=M.fillStore;M.fillStore=info=>{fill(info);status.textContent='';render();};
 render();
 window.RivFreeStorePhotos={render,parse};
})();
