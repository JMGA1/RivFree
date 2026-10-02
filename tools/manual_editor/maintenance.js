(() => {
  'use strict';
  const E=window.RivFreeEditor;
  if(!E)return;
  const $=id=>document.getElementById(id);
  let review=null, orphanFiles=[], publicProducts=[], indexed=[];
  async function action(button, fn){button.disabled=true;try{await fn();}catch(e){E.notify(e.message,true);$('publishOutput').textContent=e.message;}finally{button.disabled=false;}}
  function requireSaved(){if(E.hasUnsaved())throw new Error('Guardá o descartá los cambios del formulario antes de continuar.');}
  $('reviewPublish').onclick=()=>action($('reviewPublish'),async()=>{
    requireSaved();review=null;$('confirmPublish').hidden=true;
    $('publishOutput').textContent='Revisando Git…';
    review=await E.api('/api/manual/publish',{action:'review',include_update:$('publishIncludeUpdate').checked});
    $('publishReview').textContent=`Rama: ${review.branch} → ${review.upstream}\n${review.note}\n\nArchivos que Studio puede agregar:\n${review.scope.join('\n')}\n\nEstado completo:\n${review.status||'Sin cambios'}\nResumen de cambios guardados:\n${review.diff||'Sin diferencias en archivos ya versionados'}\nCommits pendientes:\n${review.outgoing||'Ninguno'}`;
    $('publishOutput').textContent='Revisión lista.';$('confirmPublish').hidden=false;
  });
  $('publishIncludeUpdate').onchange=()=>{review=null;$('confirmPublish').hidden=true;};
  $('confirmPublish').onclick=()=>action($('confirmPublish'),async()=>{
    requireSaved();if(!review)throw new Error('Revisá primero la publicación.');
    $('publishOutput').textContent='Publicando… esperá la respuesta antes de cerrar.';
    try{const r=await E.api('/api/manual/publish',{action:'publish',include_update:$('publishIncludeUpdate').checked,confirm:true,review:review.review,message:$('publishMessage').value});$('publishOutput').textContent=r.message+'\n'+r.output;}
    finally{review=null;$('confirmPublish').hidden=true;}
  });
  // "20261001-123301-000123" → "1 oct 2026, 12:33:01" and file names in plain words.
  const FILE_LABELS={'manual-products.json':'Productos','manual-stores.json':'Tiendas','site-config.json':'Diseño y página','highlights.json':'Carrusel','product-corrections.json':'Correcciones del catálogo'};
  function fileLabel(name){return FILE_LABELS[name]||name;}
  function backupLabel(copy){
    const m=/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/.exec(copy.id||'');
    const when=m?new Date(+m[1],m[2]-1,+m[3],+m[4],+m[5],+m[6]).toLocaleString('es-UY',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}):copy.id;
    return when+' · '+(copy.files||[]).map(fileLabel).join(', ');
  }
  async function listBackups(){
    const data=await E.api('/api/manual/backups',{});$('backupList').replaceChildren();
    if(!data.backups.length)$('backupList').textContent='Todavía no hay copias.';
    for(const copy of data.backups){const row=document.createElement('p'),b=document.createElement('button');b.className='button';const label=backupLabel(copy);b.textContent='Restaurar';row.append(Object.assign(document.createElement('span'),{className:'backup-label',textContent:label}));b.setAttribute('aria-label','Restaurar copia del '+label);b.onclick=()=>action(b,async()=>{
      requireSaved();if(!await E.confirmDialog({title:'Restaurar copia',message:`Copia del ${label}. Reemplaza los datos locales guardados. Se crea una copia del estado actual antes de continuar. Después deberás publicar.`,items:copy.files.map(fileLabel),confirmText:'Restaurar',danger:true}))return;
      const state=await E.api('/api/manual/backups',{action:'restore',id:copy.id});window.RivFreeStudio?.discardWorking?.();E.applyState(state);await E.load();await listBackups();E.notify('Copia restaurada. Revisá el sitio antes de publicar.');
    });row.append(b);$('backupList').append(row);}
  }
  $('listBackups').onclick=()=>action($('listBackups'),listBackups);
  $('scanOrphans').onclick=()=>action($('scanOrphans'),async()=>{
    requireSaved();orphanFiles=(await E.api('/api/manual/orphans',{})).files;
    $('orphanList').replaceChildren();for(const item of orphanFiles){const p=document.createElement('p');p.textContent=`${item.path} · ${Math.ceil(item.bytes/1024)} KB`;$('orphanList').append(p);}
    if(!orphanFiles.length)$('orphanList').textContent='No hay imágenes sin usar.';
    $('deleteOrphans').hidden=!orphanFiles.length;
  });
  $('deleteOrphans').onclick=()=>action($('deleteOrphans'),async()=>{
    requireSaved();if(!await E.confirmDialog({title:'Eliminar imágenes sin usar',message:'Se vuelven a comprobar las referencias antes de borrar. Esta eliminación es permanente.',items:orphanFiles.map(p=>p.path),confirmText:'Eliminar',danger:true}))return;
    const r=await E.api('/api/manual/orphans',{action:'delete',paths:orphanFiles.map(p=>p.path)});$('orphanList').textContent=`${r.deleted} imágenes eliminadas.`;$('deleteOrphans').hidden=true;
  });
  function rebuild(){indexed=[...E.getState().products,...publicProducts].map(p=>({p,fp:Matching.fingerprint(Matching.rawTokens(p.nombre||''))}));}
  function updateProductInfo(){
    const id=$('productId').value, name=$('productName').value.trim(), store=$('productStore').value;
    const fp=Matching.fingerprint(Matching.rawTokens(name)), a=new Set(fp.core);
    const candidates=indexed.filter(({p,fp:b})=>{
      if(p.id===id||p.tienda!==store||name.length<4||!a.size)return false;
      if(['measure','conc','gender','code','pack'].some(k=>fp[k]&&b[k]&&fp[k]!==b[k]))return false;
      const common=b.core.filter(t=>a.has(t)).length, union=new Set([...a,...b.core]).size;
      return union>0&&common/union>=.8;
    }).slice(0,4);
    $('duplicateWarning').textContent=candidates.length?'⚠ Ya existe algo parecido en esta tienda: '+candidates.map(x=>x.p.nombre).join(' · '):'';
    const p=E.getState().products.find(p=>p.id===id);$('manualPriceHistory').replaceChildren();
    for(const item of p?.historial_precios||[]){const row=document.createElement('p');row.textContent=`${new Date(item.fecha).toLocaleString()} · ${item.precio_usd==null?'Sin precio':'USD '+Number(item.precio_usd).toFixed(2)}`;$('manualPriceHistory').append(row);}
    if(!p?.historial_precios?.length)$('manualPriceHistory').textContent='El historial se registra desde el primer guardado con esta versión.';
  }
  let timer;function schedule(){clearTimeout(timer);timer=setTimeout(updateProductInfo,220);}
  $('productForm').addEventListener('input',schedule);$('productForm').addEventListener('change',schedule);
  document.addEventListener('click',schedule);
  window.addEventListener('rivfree-editor-state',()=>{rebuild();schedule();});
  function labelControls(){
    document.querySelectorAll('input:not([type="hidden"]),select,textarea').forEach(el=>{
      if(el.hasAttribute('aria-label'))return;
      const label=el.closest('label')?.querySelector('span')?.textContent;
      el.setAttribute('aria-label',label||el.getAttribute('placeholder')||({productStoreFilter:'Filtrar por tienda',importMode:'Modo de importación',importFile:'Archivo para importar'}[el.id])||el.id);
    });
    document.querySelectorAll('.image-preview').forEach(el=>{el.setAttribute('role','group');el.setAttribute('aria-label','Vista previa de imagen');el.querySelectorAll('img').forEach(img=>{if(!img.hasAttribute('alt'))img.alt='Imagen seleccionada';});});
    $('status').setAttribute('role','status');$('status').setAttribute('aria-live','polite');
  }
  labelControls();
  const observer=new MutationObserver(()=>labelControls());observer.observe(document.body,{childList:true,subtree:true});
  E.ready.then(async()=>{rebuild();updateProductInfo();try{const response=await fetch('/data/products.json',{cache:'no-store'});if(response.ok){publicProducts=(await response.json()).productos||[];rebuild();schedule();}}catch{E.notify('No se pudo revisar el catálogo automático para detectar duplicados.',true);}});
})();
