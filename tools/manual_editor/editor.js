(() => {
  'use strict';

  const BUILD = '20261001-studio7';
  window.RIVFREE_EDITOR_BUILD = BUILD;
  const params = new URLSearchParams(location.search);
  const fragment = new URLSearchParams(location.hash.slice(1));
  let token = fragment.get('token') || params.get('token') || '';
  try {if(token)sessionStorage.setItem('rivfree-studio-session',token);else token=sessionStorage.getItem('rivfree-studio-session')||'';}catch{}
  if(fragment.has('token')||params.has('token')){params.delete('token');history.replaceState(null,'',location.pathname+(params.size?'?'+params:''));}
  const $ = id => document.getElementById(id);
  const apiHeaders = {'Content-Type': 'application/json', 'X-RivFree-Editor-Token': token};
  const categories = new Set(['perfumes','bebidas','alimentos','electronica','informatica','electrodomesticos','cosmetica','hogar','ropa','accesorios','juguetes','relojes','optica','deportes','herramientas','otros']);

  let state = {revision:'', mode:'owner', stores:{}, base_stores:{}, manual_stores:{}, products:[]};
  let readyResolve;
  const ready = new Promise(resolve => { readyResolve = resolve; });
  let dirty = false;
  let externalDirty = false;
  let statusTimer;
  let contributionPreviewData = null;
  let selectedProductIds = new Set();

  function notify(message, error=false) {
    const el = $('status');
    el.textContent = message;
    el.className = 'status visible' + (error ? ' error persistent' : '');
    clearTimeout(statusTimer);
    if (error) {
      el.title = 'Hacé clic para cerrar';
      el.onclick = () => { el.className='status'; el.onclick=null; };
    } else {
      el.title = ''; el.onclick = null;
      statusTimer = setTimeout(() => el.className = 'status', 4400);
    }
  }

  function clearFieldErrors(root=document) {
    root.querySelectorAll?.('.field-error').forEach(el=>el.remove());
    root.querySelectorAll?.('.field-invalid').forEach(el=>el.classList.remove('field-invalid'));
  }
  function setFieldError(input, message) {
    if (!input) return false;
    input.classList.add('field-invalid');
    const label=input.closest('label') || input.parentElement;
    label?.querySelector('.field-error')?.remove();
    const error=document.createElement('small'); error.className='field-error'; error.textContent=message;
    label?.append(error); input.focus({preventScroll:true}); input.scrollIntoView({behavior:'smooth',block:'center'});
    return false;
  }
  function validHttpUrl(input, optional=true) {
    const value=input?.value.trim()||''; if(!value&&optional)return true;
    try { const url=new URL(value); return url.protocol==='https:'&&!url.username&&!url.password; } catch { return false; }
  }

  function confirmDialog({title='Confirmar acción',message='',items=[],confirmText='Confirmar',danger=false}={}) {
    return new Promise(resolve=>{
      const overlay=document.createElement('div'); overlay.className='confirm-overlay';
      const dialog=document.createElement('div'); dialog.className='confirm-dialog'; dialog.setAttribute('role','dialog'); dialog.setAttribute('aria-modal','true');
      const h=document.createElement('h2'); h.textContent=title; const p=document.createElement('p'); p.textContent=message; dialog.append(h,p);
      if(items?.length){const ul=document.createElement('ul'); ul.className='confirm-list'; for(const item of items.slice(0,12)){const li=document.createElement('li');li.textContent=item;ul.append(li);} if(items.length>12){const li=document.createElement('li');li.textContent=`… y ${items.length-12} más`;ul.append(li);} dialog.append(ul);}
      const actions=document.createElement('div'); actions.className='confirm-actions'; const cancel=document.createElement('button');cancel.type='button';cancel.className='button';cancel.textContent='Cancelar'; const ok=document.createElement('button');ok.type='button';ok.className='button '+(danger?'danger':'primary');ok.textContent=confirmText; actions.append(cancel,ok);dialog.append(actions);overlay.append(dialog);document.body.append(overlay);
      const done=value=>{overlay.remove();resolve(value);}; cancel.onclick=()=>done(false); ok.onclick=()=>done(true); overlay.addEventListener('click',e=>{if(e.target===overlay)done(false);}); dialog.addEventListener('keydown',e=>{if(e.key==='Escape')done(false);}); setTimeout(()=>ok.focus(),0);
    });
  }

  function refreshDirtyState() {
    const any = dirty || externalDirty;
    $('saveState').textContent = any ? 'Cambios sin guardar' : 'Sin cambios pendientes';
    $('saveState').style.color = any ? '#ffcf7a' : '';
  }
  function setDirty(value) { dirty = value; refreshDirtyState(); }
  function setExternalDirty(value) { externalDirty = value; refreshDirtyState(); }

  window.addEventListener('beforeunload', event => {
    if (!(dirty || externalDirty)) return;
    event.preventDefault();
    event.returnValue = '';
  });

  if (!token) {
    notify('Abrí el editor usando uno de los accesos .bat para iniciar una sesión segura.', true);
    document.querySelectorAll('button,input,select,textarea').forEach(el => el.disabled = true);
    return;
  }

  async function api(path, payload={}) {
    const response = await fetch(path, {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify({...payload, revision: state.revision})
    });
    const data = await response.json().catch(() => ({error:'Respuesta inválida'}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  }

  async function load() {
    const response = await fetch('/api/manual/state', {headers:{'X-RivFree-Editor-Token':token}, cache:'no-store'});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No se pudo abrir el editor');
    applyState(data);
    if(!document.querySelector('.tab.active:not([hidden])')) switchTab(data.mode==='contributor'?'products':'appearance');
    else if(data.mode==='contributor') switchTab('products');
    setDirty(false);
  }

  function applyModeUI() {
    const contributor = state.mode === 'contributor';
    document.body.classList.toggle('mode-contributor', contributor);
    document.querySelectorAll('.owner-only').forEach(el => el.hidden = contributor);
    document.querySelectorAll('.contributor-only').forEach(el => el.hidden = !contributor);

    if (contributor) {
      document.title = 'RivFree · Cargador colaborador';
      $('brandTitle').textContent = 'RivFree · Colaborador';
      $('brandSubtitle').textContent = 'Carga aislada de productos y tiendas';
      $('projectEyebrow').textContent = 'BANDEJA DE APORTE';
      $('projectDescription').textContent = 'Lo que guardes acá queda separado del catálogo oficial hasta que el administrador lo importe.';
      $('transferTabLabel').textContent = 'Enviar aporte';
      $('helpTitle').textContent = 'Sin acceso a GitHub';
      $('helpText').textContent = 'Cargá los datos, exportá el ZIP y enviáselo a quien administra RivFree. No necesitás hacer commits.';
      $('openSite').hidden = true;
    } else {
      document.title = 'RivFree Studio';
      $('brandTitle').textContent = 'RivFree Studio';
      $('brandSubtitle').textContent = 'Editor visual del sitio';
      $('projectEyebrow').textContent = 'PROYECTO LOCAL';
      $('projectDescription').textContent = 'Los cambios se guardan directamente en los archivos del repositorio.';
      $('transferTabLabel').textContent = 'Importar / exportar';
      $('helpTitle').textContent = 'Publicar en GitHub';
      $('helpText').innerHTML = 'Guardá tus cambios y abrí Publicar / copias para revisar y publicar desde el Studio.';
      $('openSite').hidden = false;
    }
  }

  function applyState(data) {
    state = data;
    applyModeUI();
    updateContextHelp(document.querySelector('.tab.active:not([hidden])')?.dataset.tab || (data.mode==='contributor'?'products':'health'));
    $('projectPath').textContent = data.project_root || '';
    $('productCount').textContent = data.products.length;
    selectedProductIds = new Set([...selectedProductIds].filter(id => data.products.some(p=>p.id===id)));
    $('storeCount').textContent = state.mode === 'contributor' ? Object.keys(data.manual_stores || {}).length : Object.keys(data.stores || {}).length;
    renderStoreOptions();
    renderProducts();
    renderStores();
    setDownloadLinks();
    window.dispatchEvent(new CustomEvent('rivfree-editor-state',{detail:state}));
    if (readyResolve) { readyResolve(state); readyResolve = null; }
  }

  for(const id of ['downloadJson','downloadZip','downloadContribution'])$(id)?.addEventListener('click',async event=>{
    event.preventDefault();const link=$(id);if(link.getAttribute('aria-disabled')==='true')return;
    try{
      const response=await fetch(link.href,{headers:{'X-RivFree-Editor-Token':token},cache:'no-store'});
      if(!response.ok)throw new Error('No se pudo descargar el archivo');
      const blob=await response.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download=id==='downloadJson'?'rivfree-manual-backup.json':id==='downloadZip'?'rivfree-manual-github.zip':'rivfree-aporte.zip';
      a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(error){notify(error.message,true);}
  });

  function setDownloadLinks() {
    $('downloadJson').href = '/api/manual/export';
    $('downloadZip').href = '/api/manual/export.zip';
    updateContributionDownloadLink();
  }

  function updateContributionDownloadLink() {
    const link = $('downloadContribution');
    if (!link) return;
    const name = $('contributorName')?.value.trim() || '';
    const note = $('contributorNote')?.value.trim() || '';
    if (!name) {
      link.href = '#';
      link.classList.add('disabled-link');
      link.setAttribute('aria-disabled','true');
      return;
    }
    link.href = `/api/manual/contribution.zip?name=${encodeURIComponent(name)}&note=${encodeURIComponent(note)}`;
    link.classList.remove('disabled-link');
    link.setAttribute('aria-disabled','false');
  }

  const HELP_BY_TAB = {
    health:['Estado general','Revisá scrapers, publicaciones manuales y campañas que necesitan atención.'],
    appearance:['Diseño','Los cambios son un borrador hasta que uses “Guardar solo Diseño”. La vista previa no publica nada.'],
    carousel:['Carrusel','Editá banners y fechas. “Guardar Carrusel” guarda únicamente sus ajustes y campañas.'],
    page:['Página y SEO','Orden, avisos, SEO y footer. “Guardar solo Página” no persiste cambios pendientes de Diseño.'],
    products:['Productos','Usá filtros y selección múltiple para administrar el catálogo manual.'],
    stores:['Tiendas','Las tiendas manuales se mezclan con las automáticas sin modificar data/stores.json.'],
    collaborations:['Colaboraciones','Revisá, buscá y seleccioná aportes antes de incorporarlos. Nada entra automáticamente.'],
    transfer:['Publicar / respaldar','Exportá respaldos o usá Publicar / copias para publicar los cambios guardados.']
  };
  function updateContextHelp(name) {
    if(state.mode==='contributor') return; const help=HELP_BY_TAB[name]||HELP_BY_TAB.transfer;
    if($('helpTitle')) $('helpTitle').textContent=help[0]; if($('helpText')) $('helpText').textContent=help[1];
  }
  function switchTab(name) {
    document.querySelectorAll('.tab').forEach(el => el.classList.toggle('active', el.dataset.tab === name));
    document.querySelectorAll('.panel').forEach(el => el.classList.toggle('active', el.dataset.panel === name));
    updateContextHelp(name);
    window.dispatchEvent(new CustomEvent('rivfree-tab-change',{detail:{tab:name}}));
  }

  window.RivFreeEditor = {
    api, load, applyState, notify, switchTab, setDirty, setExternalDirty, confirmDialog, setFieldError, clearFieldErrors,
    hasUnsaved:()=>dirty || externalDirty, productPayload,storePayload,editProduct,getState:()=>state, getToken:()=>token, ready, build:BUILD
  };

  document.querySelectorAll('.tab').forEach(el => el.addEventListener('click', () => switchTab(el.dataset.tab)));
  $('reloadState').onclick = async () => {
    if (dirty || externalDirty) { const ok=await confirmDialog({title:'Recargar Studio',message:'Hay cambios sin guardar. Si recargás, se descartarán los formularios actuales (los borradores visuales pueden recuperarse).',confirmText:'Recargar',danger:true}); if(!ok)return; }
    try { window.RivFreeStudio?.discardWorking?.(); await load(); notify('Datos recargados.'); }
    catch (e) { notify(e.message, true); }
  };

  function money(value) {
    return Number.isFinite(Number(value)) && Number(value) > 0 ? `USD ${Number(value).toFixed(2)}` : 'Sin precio';
  }

  function sourceLabel(value) {
    return {instagram:'Visto en Instagram',facebook:'Visto en Facebook',whatsapp:'Visto en WhatsApp',web:'Visto en sitio web',website:'Visto en sitio web',manual:'Manual'}[value] || 'Manual';
  }

  function productMatches(product) {
    const q = $('productSearch').value.trim().toLowerCase();
    const store = $('productStoreFilter').value;
    const quick = $('productQuickFilter')?.value || '';
    const quickOk = !quick || (quick==='no-image'&&!product.imagen) || (quick==='inactive'&&product.activo===false) || (quick==='offer'&&!!product.en_oferta);
    return quickOk && (!store || product.tienda === store) && (!q || `${product.nombre} ${product.tienda} ${product.categoria}`.toLowerCase().includes(q));
  }
  function sortProducts(products) {
    const mode=$('productSort')?.value||'updated-desc';
    return products.sort((a,b)=>{
      if(mode==='updated-asc')return (a.actualizado_manual||'').localeCompare(b.actualizado_manual||'');
      if(mode==='price-asc')return (Number(a.precio_usd)||Infinity)-(Number(b.precio_usd)||Infinity);
      if(mode==='price-desc')return (Number(b.precio_usd)||-Infinity)-(Number(a.precio_usd)||-Infinity);
      if(mode==='name')return String(a.nombre||'').localeCompare(String(b.nombre||''),'es');
      return (b.actualizado_manual||'').localeCompare(a.actualizado_manual||'');
    });
  }
  function updateBulkBar() {
    const bar=$('bulkProductBar'); if(!bar)return; const count=selectedProductIds.size; bar.hidden=count===0; $('bulkProductCount').textContent=`${count} seleccionado${count===1?'':'s'}`;
  }

  function renderProducts() {
    const list = $('productList');
    list.replaceChildren();
    const products = sortProducts([...state.products].filter(productMatches));
    if (!products.length) { list.append($('emptyTemplate').content.cloneNode(true)); updateBulkBar(); return; }
    for (const product of products) {
      const row=document.createElement('div'); row.className='product-list-row'; row.dataset.id=product.id;
      const select=document.createElement('input'); select.type='checkbox'; select.className='product-select'; select.checked=selectedProductIds.has(product.id); select.setAttribute('aria-label',`Seleccionar ${product.nombre}`);
      select.addEventListener('change',()=>{select.checked?selectedProductIds.add(product.id):selectedProductIds.delete(product.id);updateBulkBar();});
      const item = document.createElement('button'); item.type = 'button'; item.className = 'list-item'; item.dataset.id = product.id;
      const left = document.createElement('div'); const title = document.createElement('strong'); title.textContent = product.nombre;
      const meta = document.createElement('small'); meta.textContent = `${product.tienda} · ${product.categoria||'otros'}${product.activo===false?' · Oculto':''}${!product.imagen?' · Sin imagen':''}`; left.append(title, meta);
      if (product.fuente_tipo && product.fuente_tipo !== 'manual') { const source = document.createElement('span'); source.className = 'source-mini'; source.textContent = sourceLabel(product.fuente_tipo); left.append(source); }
      const price = document.createElement('span'); price.className = 'price'; price.textContent = money(product.precio_usd); item.append(left, price); item.onclick = () => editProduct(product.id);
      row.append(select,item); list.append(row);
    }
    highlightSelectedProduct(); updateBulkBar();
  }

  function highlightSelectedProduct() {
    const id = $('productId').value;
    document.querySelectorAll('#productList .list-item').forEach(el => el.classList.toggle('selected', el.dataset.id === id));
  }

  function renderStoreOptions() {
    const names = Object.keys(state.stores).sort((a,b)=>a.localeCompare(b,'es'));
    const select = $('productStore'), filter = $('productStoreFilter'), old = select.value, oldFilter = filter.value;
    select.replaceChildren(new Option('Seleccionar tienda…',''));
    filter.replaceChildren(new Option('Todas las tiendas',''));
    for (const name of names) { select.add(new Option(name,name)); filter.add(new Option(name,name)); }
    if (names.includes(old)) select.value = old;
    if (names.includes(oldFilter)) filter.value = oldFilter;
  }

  function resetProduct() {
    $('productForm').reset(); $('productId').value=''; $('productActive').checked=true; $('productCategory').value='otros'; $('productSource').value='manual';
    $('productFormEyebrow').textContent='NUEVA PUBLICACIÓN'; $('productFormTitle').textContent='Agregar producto';
    $('duplicateProduct').disabled=true; $('duplicateProductStore').disabled=true; $('deleteProduct').disabled=true;
    updateActiveBadge(); updateImagePreview(); highlightSelectedProduct(); setDirty(false); window.dispatchEvent(new Event("rivfree-editor-selection"));
  }

  function editProduct(id) {
    const p = typeof id==='object'?id:state.products.find(item => item.id === id); if (!p) return;
    window.RivFreeCatalogFields.fillProduct(p);$('productId').value=p.id; $('productName').value=p.nombre||''; $('productStore').value=p.tienda||'';
    $('productCategory').value=Catalog.category(p.categoria,p.nombre); $('productPrice').value=p.precio_usd??''; $('productOldPrice').value=p.precio_original_usd??'';
    $('productOffer').checked=!!p.en_oferta; $('productActive').checked=p.activo!==false; $('productSource').value=p.fuente_tipo||'manual'; $('productSourceUrl').value=p.fuente_url||'';
    $('productUrl').value=p.url||''; $('productImage').value=p.imagen||''; $('productNote').value=p.nota_manual||''; $('productImageFile').value='';
    $('productFormEyebrow').textContent='EDITANDO PUBLICACIÓN'; $('productFormTitle').textContent=p.nombre;
    $('duplicateProduct').disabled=false; $('duplicateProductStore').disabled=false; $('deleteProduct').disabled=false;
    updateActiveBadge(); updateImagePreview(); highlightSelectedProduct(); setDirty(false); window.dispatchEvent(new Event("rivfree-editor-selection"));
  }

  function updateActiveBadge() {
    const active=$('productActive').checked, badge=$('productActiveBadge');
    badge.textContent=active?'Visible':'Oculto'; badge.className='badge'+(active?' good':'');
  }

  function updateImagePreview() {
    const box=$('imagePreview'), url=$('productImage').value.trim(); box.replaceChildren();
    if (!url) { const span=document.createElement('span'); span.textContent='Sin imagen'; box.append(span); return; }
    const img=document.createElement('img');img.referrerPolicy='no-referrer'; img.alt='Vista previa'; img.src=(url.startsWith('assets/')||url.startsWith('contributor-assets/'))?'/'+url:url;
    img.onerror=()=>{box.replaceChildren();const span=document.createElement('span');span.textContent='No se pudo cargar la imagen';box.append(span);}; box.append(img);
  }

  async function uploadSelectedImage() {
    const file=$('productImageFile').files[0]; if(!file) return null;
    if(file.size>6*1024*1024) throw new Error('La imagen supera los 6 MB.');
    const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('No se pudo leer la imagen'));reader.readAsDataURL(file);});
    const result=await api('/api/manual/upload-image',{filename:file.name,data:base64}); $('productImage').value=result.path; return result.path;
  }

  function productPayload() {
    return {...window.RivFreeCatalogFields.product(),id:$('productId').value,tienda:$('productStore').value,nombre:$('productName').value,categoria:$('productCategory').value,precio_usd:$('productPrice').value,precio_original_usd:$('productOldPrice').value,en_oferta:$('productOffer').checked,activo:$('productActive').checked,fuente_tipo:$('productSource').value,fuente_url:$('productSourceUrl').value,url:$('productUrl').value,imagen:$('productImage').value,nota_manual:$('productNote').value};
  }

  $('productForm').addEventListener('submit', async event => {
    event.preventDefault(); clearFieldErrors($('productForm'));
    if(!$('productName').value.trim())return setFieldError($('productName'),'El nombre del producto es obligatorio.');
    if(!$('productStore').value)return setFieldError($('productStore'),'Seleccioná una tienda.');
    for(const id of ['productSourceUrl','productUrl'])if(!validHttpUrl($(id),true))return setFieldError($(id),'Usá una URL que empiece con https:// sin credenciales');
    const imageValue=$('productImage').value.trim(); if(imageValue && !imageValue.startsWith('assets/') && !imageValue.startsWith('contributor-assets/') && !validHttpUrl($('productImage'),false))return setFieldError($('productImage'),'Usá una URL HTTPS o una imagen subida desde el editor.');
    try {
      if ($('productImageFile').files[0]) await uploadSelectedImage();
      const saved=await api('/api/manual/save-product',{product:productPayload()}); applyState(saved); editProduct(saved.saved_id||$('productId').value);
      notify(state.mode==='contributor'?'Producto guardado en tu aporte.':'Publicación guardada. Ya forma parte del catálogo manual.');
    } catch(e) { notify(e.message,true); }
  });
  $('newProduct').onclick=()=>{resetProduct();$('productName').focus();};
  $('duplicateProduct').onclick=()=>{$('productId').value='';$('productFormEyebrow').textContent='COPIA NUEVA';$('productFormTitle').textContent='Duplicar publicación';$('deleteProduct').disabled=true;$('duplicateProduct').disabled=true;$('duplicateProductStore').disabled=true;highlightSelectedProduct();setDirty(true);};
  $('duplicateProductStore').onclick=()=>{const name=$('productName').value;$('productId').value='';$('productStore').value='';$('productPrice').value='';$('productOldPrice').value='';$('productOffer').checked=false;$('productFormEyebrow').textContent='MISMO PRODUCTO · OTRA TIENDA';$('productFormTitle').textContent=name||'Duplicar en otra tienda';$('deleteProduct').disabled=true;$('duplicateProduct').disabled=true;$('duplicateProductStore').disabled=true;highlightSelectedProduct();setDirty(true);$('productStore').focus();};
  $('deleteProduct').onclick=async()=>{const id=$('productId').value;if(!id)return;const product=state.products.find(p=>p.id===id);const ok=await confirmDialog({title:'Eliminar publicación',message:'Esta acción elimina la publicación manual y no se puede deshacer desde el formulario.',items:product?[`${product.nombre} · ${product.tienda}`]:[],confirmText:'Eliminar publicación',danger:true});if(!ok)return;try{const saved=await api('/api/manual/delete-product',{id});applyState(saved);resetProduct();notify('Publicación eliminada.');}catch(e){notify(e.message,true);}};
  $('productActive').onchange=()=>{updateActiveBadge();setDirty(true);};
  $('productImage').addEventListener('input',updateImagePreview);
  $('clearImage').onclick=()=>{$('productImage').value='';$('productImageFile').value='';updateImagePreview();setDirty(true);};
  $('productSearch').addEventListener('input',renderProducts); $('productStoreFilter').addEventListener('change',renderProducts); $('productQuickFilter')?.addEventListener('change',renderProducts); $('productSort')?.addEventListener('change',renderProducts);

  async function runBulkProductAction(action, extra={}) {
    const ids=[...selectedProductIds]; if(!ids.length)return;
    const names=state.products.filter(p=>ids.includes(p.id)).map(p=>`${p.nombre} · ${p.tienda}`);
    if(action==='delete'){const ok=await confirmDialog({title:`Eliminar ${ids.length} publicaciones`,message:'Se eliminarán únicamente estas publicaciones manuales.',items:names,confirmText:'Eliminar seleccionadas',danger:true});if(!ok)return;}
    try{const saved=await api('/api/manual/bulk-products',{ids,action,...extra});selectedProductIds.clear();applyState(saved);renderProducts();notify(`Acción aplicada a ${saved.bulk_summary?.count||ids.length} publicaciones.`);}catch(e){notify(e.message,true);}
  }
  $('bulkHideProducts')?.addEventListener('click',()=>runBulkProductAction('hide'));
  $('bulkDeleteProducts')?.addEventListener('click',()=>runBulkProductAction('delete'));
  $('bulkClearProducts')?.addEventListener('click',()=>{selectedProductIds.clear();renderProducts();});
  $('bulkCategory')?.addEventListener('change',()=>{const category=$('bulkCategory').value;if(!category)return;runBulkProductAction('category',{category}).finally(()=>{$('bulkCategory').value='';});});

  function storeMatches(name,info) { const q=$('storeSearch').value.trim().toLowerCase(); return !q||`${name} ${info.nombre_completo||''} ${info.direccion||''}`.toLowerCase().includes(q); }
  function renderStores() {
    const list=$('storeList'); list.replaceChildren();
    const entries=Object.entries(state.stores).sort(([a],[b])=>a.localeCompare(b,'es')).filter(([n,i])=>storeMatches(n,i));
    if(!entries.length){list.append($('emptyTemplate').content.cloneNode(true));return;}
    for(const [name,info] of entries){
      const item=document.createElement('button');item.type='button';item.className='list-item';item.dataset.name=name;
      const left=document.createElement('div');const title=document.createElement('strong');title.textContent=name;
      const meta=document.createElement('small');
      const editable=!!state.manual_stores[name];
      meta.textContent=(editable?(state.mode==='contributor'?'Incluida en tu aporte':'Configuración manual'):(state.mode==='contributor'?'Tienda disponible':'Tienda base'))+(info.ocultar_fotos===true?' · Fotos ocultas':'')+(info.direccion?` · ${info.direccion}`:'');
      left.append(title,meta);
      const color=document.createElement('span');color.className='price';const dot=document.createElement('span');dot.className='manual-dot';dot.style.background=/^#[0-9a-f]{6}$/i.test(info.color||'')?info.color:'#B42335';color.append(dot,document.createTextNode(editable?'Editable':'Referencia'));
      item.append(left,color);item.onclick=()=>editStore(name);list.append(item);
    }
    highlightSelectedStore();
  }
  function highlightSelectedStore(){const name=$('storeOriginalName').value;document.querySelectorAll('#storeList .list-item').forEach(el=>el.classList.toggle('selected',el.dataset.name===name));}
  function storeLuminance(hex){
    const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
    return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
  }
  function updateStorePreview(){
    const bg=$('storeColor').value,fg=$('storeTextColor').value;
    document.querySelectorAll('.store-preview-tag').forEach(tag=>{tag.textContent=$('storeName').value.trim()||'Nombre del free shop';tag.style.backgroundColor=bg;tag.style.color=fg;tag.style.borderColor=([1,3,5].map(i=>parseInt(bg.slice(i,i+2),16)).reduce((sum,v,i)=>sum+v*[.299,.587,.114][i],0)/255)>.64?fg:bg;});
    $('storeColorValues').textContent=`Fondo: ${bg.toUpperCase()} · Letras: ${fg.toUpperCase()}`;
    const a=storeLuminance(bg),b=storeLuminance(fg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
    $('storeContrastHint').textContent=ratio>=4.5?'✓ Buen contraste: el nombre se lee con claridad.':'Contraste bajo: probá letras más claras u oscuras para facilitar la lectura.';
    $('storeContrastHint').classList.toggle('low-contrast',ratio<4.5);
  }
  for(const id of ['storeName','storeColor','storeTextColor'])$(id).addEventListener('input',updateStorePreview);
  $('storeAutoText').onclick=()=>{const l=storeLuminance($('storeColor').value);$('storeTextColor').value=(l+.05)/.05>=1.05/(l+.05)?'#000000':'#ffffff';updateStorePreview();setDirty(true);};
  function resetStore(){$('storeForm').reset();window.RivFreeCatalogFields.fillStore({});$('storeOriginalName').value='';$('storeColor').value='#B42335';$('storeTextColor').value='#FFFFFF';$('storeFormEyebrow').textContent='NUEVA TIENDA';$('storeFormTitle').textContent='Agregar free shop';$('storeKindBadge').textContent='Manual';$('deleteStore').disabled=true;highlightSelectedStore();updateStorePreview();setDirty(false);window.dispatchEvent(new Event("rivfree-editor-selection"));}
  function editStore(name){const info=state.stores[name]||{};window.RivFreeCatalogFields.fillStore(info);$('storeOriginalName').value=name;$('storeName').value=name;$('storeFullName').value=info.nombre_completo||name;$('storeColor').value=/^#[0-9a-f]{6}$/i.test(info.color||'')?info.color:'#B42335';$('storeTextColor').value=/^#[0-9a-f]{6}$/i.test(info.color_texto||'')?info.color_texto:'#FFFFFF';$('storeAddress').value=info.direccion||'';$('storePhone').value=info.telefono||'';$('storeEmail').value=info.email||'';$('storeHours').value=info.horario||'';$('storeWebsite').value=(info.sitio_web||'').replace(/^http:/,'https:');$('storeInstagram').value=(info.redes?.instagram||'').replace(/^http:/,'https:');$('storeFacebook').value=(info.redes?.facebook||'').replace(/^http:/,'https:');$('storeWhatsapp').value=info.redes?.whatsapp||'';$('storeTelegram').value=(info.redes?.telegram||'').replace(/^http:/,'https:');$('storeCatalogOnline').checked=!!info.catalogo_online;$('storeHidePhotos').checked=info.ocultar_fotos===true;$('storeNote').value=info.nota||'';$('storeFormEyebrow').textContent=state.manual_stores[name]?'EDITANDO CONFIGURACIÓN':(state.mode==='contributor'?'COPIAR/PROPONER DATOS':'SOBRESCRIBIR TIENDA BASE');$('storeFormTitle').textContent=name;$('storeKindBadge').textContent=state.manual_stores[name]?'Manual':'Referencia';$('deleteStore').disabled=!state.manual_stores[name];highlightSelectedStore();updateStorePreview();setDirty(false);window.dispatchEvent(new Event("rivfree-editor-selection"));}
  function storePayload(){return {...window.RivFreeCatalogFields.store(),nombre:$('storeName').value,nombre_completo:$('storeFullName').value,color:$('storeColor').value,color_texto:$('storeTextColor').value,direccion:$('storeAddress').value,telefono:$('storePhone').value,email:$('storeEmail').value,horario:$('storeHours').value,sitio_web:$('storeWebsite').value,instagram:$('storeInstagram').value,facebook:$('storeFacebook').value,whatsapp:$('storeWhatsapp').value,telegram:$('storeTelegram').value,catalogo_online:$('storeCatalogOnline').checked,ocultar_fotos:$('storeHidePhotos').checked,nota:$('storeNote').value};}
  $('storeForm').addEventListener('submit',async event=>{event.preventDefault();clearFieldErrors($('storeForm'));if(!$('storeName').value.trim())return setFieldError($('storeName'),'El nombre de la tienda es obligatorio.');for(const id of ['storeWebsite','storeInstagram','storeFacebook','storeWhatsapp','storeTelegram'])if(!validHttpUrl($(id),true))return setFieldError($(id),'Usá una URL https:// sin credenciales');try{const saved=await api('/api/manual/save-store',{original_name:$('storeOriginalName').value,store:storePayload()});applyState(saved);editStore($('storeName').value.trim());notify(state.mode==='contributor'?'Tienda guardada en tu aporte.':'Tienda guardada. Ya aparecerá en filtros y tarjetas cuando tenga productos.');}catch(e){notify(e.message,true);}});
  $('newStore').onclick=()=>{resetStore();$('storeName').focus();};
  $('deleteStore').onclick=async()=>{const name=$('storeOriginalName').value;if(!name)return;const relatedProducts=state.products.filter(p=>p.tienda===name),isBase=!!state.base_stores[name];let deleteProducts=false;if(relatedProducts.length&&!isBase){const ok=await confirmDialog({title:`Eliminar ${name}`,message:`La tienda tiene ${relatedProducts.length} publicaciones manuales. Para eliminar la tienda también deben eliminarse.`,items:relatedProducts.map(p=>p.nombre),confirmText:'Eliminar tienda y publicaciones',danger:true});if(!ok)return;deleteProducts=true;}else{const ok=await confirmDialog({title:isBase?'Quitar configuración manual':'Eliminar tienda',message:isBase?'Se volverán a usar los datos de la tienda base.':'La tienda manual será eliminada.',items:[name],confirmText:isBase?'Quitar configuración':'Eliminar tienda',danger:true});if(!ok)return;}try{const saved=await api('/api/manual/delete-store',{name,delete_products:deleteProducts});applyState(saved);resetStore();notify(isBase?'Configuración eliminada; se usa nuevamente la referencia.':'Tienda eliminada.');}catch(e){notify(e.message,true);}};
  $('storeSearch').addEventListener('input',renderStores);

  const baseSearch=document.createElement('details');baseSearch.className='editor-card';
  baseSearch.innerHTML='<summary>Editar una publicación del catálogo existente</summary><p>Buscá por producto o tienda. Al guardar, una edición manual de la misma URL tiene prioridad sobre el scraper.</p><div class="list-tools"><input id="baseCatalogQuery" type="search" aria-label="Buscar en catálogo completo" placeholder="Ej.: iPhone 16"><button id="baseCatalogFind" type="button" class="button">Buscar</button></div><div id="baseCatalogResults"></div>';
  $('productList').before(baseSearch);
  $('baseCatalogFind').onclick=async()=>{try{const response=await fetch('/api/manual/catalog?q='+encodeURIComponent($('baseCatalogQuery').value),{headers:{'X-RivFree-Editor-Token':token},cache:'no-store'});const result=await response.json();if(!response.ok)throw Error(result.error||'No se pudo buscar');const box=$('baseCatalogResults');box.replaceChildren();for(const p of result.products){const button=document.createElement('button');button.type='button';button.className='list-item';button.textContent=p.nombre+' · '+p.tienda;button.onclick=()=>{const existing=state.products.find(x=>x.tienda===p.tienda&&x.url===p.url);editProduct(existing||{...p,id:'',activo:true});setDirty(true);};box.append(button);}if(!result.products.length)box.textContent='Sin resultados. Escribí al menos dos caracteres.';}catch(error){notify(error.message,true);}};
  const csvToProducts=window.RivFreeCatalogFields.csv;
  $('importButton').onclick=async()=>{const file=$('importFile').files[0];if(!file)return notify('Elegí un archivo JSON o CSV.',true);try{if(!/\.(csv|json)$/i.test(file.name))throw Error('Para Excel, guardá primero el archivo como CSV UTF-8. No se admite .xlsx ni .xls directamente.');const raw=await file.text();let data;if(file.name.toLowerCase().endsWith('.csv'))data={products:csvToProducts(raw)};else{const parsed=JSON.parse(raw);data=parsed.format==='rivfree-manual-v1'?parsed:(Array.isArray(parsed)?{products:parsed}:parsed);}const replace=$('importMode').value==='replace';if(replace){const ok=await confirmDialog({title:'Reemplazar catálogo manual',message:'Esto reemplazará todas las tiendas y publicaciones manuales actuales por el contenido del archivo.',confirmText:'Reemplazar datos',danger:true});if(!ok)return;}const saved=await api('/api/manual/import',{mode:replace?'replace':'merge',data});applyState(saved);resetProduct();resetStore();notify(`Importación completada: ${data.products?.length||data.productos?.length||0} filas procesadas.`);}catch(e){notify(e.message,true);}};

  async function fileAsBase64(file) {
    return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('No se pudo leer el archivo'));reader.readAsDataURL(file);});
  }

  function contributionCheckbox(kind, key, selected, recommended=true) {
    const box=document.createElement('input'); box.type='checkbox'; box.checked=selected; box.dataset.contributionKind=kind; box.dataset.key=key; box.dataset.recommended=recommended?'1':'0';
    box.addEventListener('change',updateSelectionSummary); return box;
  }

  function statusBadge(status, reason='') {
    const span=document.createElement('span'); span.className='review-status '+status;
    span.textContent=status==='new'?'Nuevo':'Revisar duplicado'; if(reason) span.title=reason; return span;
  }

  function renderContributionPreview(data) {
    contributionPreviewData=data;
    $('contributionPreview').hidden=false;
    $('contributionTitle').textContent=`Aporte de ${data.contributor?.name||'Colaborador'}`;
    const date=data.exported_at?new Date(data.exported_at).toLocaleString():'sin fecha';
    $('contributionMeta').textContent=`Exportado: ${date} · ${data.products.length} productos · ${data.stores.length} tiendas`;
    $('contributionAssetCount').textContent=`${data.assets_count||0} imágenes`;
    const note=$('contributionNote'); note.textContent=data.contributor?.note||''; note.hidden=!note.textContent;
    $('previewStoreCount').textContent=data.stores.length;
    $('previewProductCount').textContent=data.products.length;
    const stores=$('previewStores'); stores.replaceChildren();
    if(!data.stores.length){const empty=$('emptyTemplate').content.cloneNode(true);stores.append(empty);} else for(const item of data.stores){
      const row=document.createElement('label');row.className='review-item';row.dataset.search=String(item.name||'').toLowerCase();
      const box=contributionCheckbox('store',item.name,!!item.selected,item.status==='new');
      const body=document.createElement('span');const title=document.createElement('strong');title.textContent=item.name;const meta=document.createElement('small');meta.textContent=item.status==='existing'?'Ya existe: dejala desmarcada salvo que quieras actualizar sus datos.':'Tienda nueva';body.append(title,meta);
      row.append(box,body,statusBadge(item.status==='existing'?'possible_duplicate':'new',item.status==='existing'?'La tienda ya existe':''));stores.append(row);
    }
    const products=$('previewProducts'); products.replaceChildren();
    if(!data.products.length){products.append($('emptyTemplate').content.cloneNode(true));} else for(const item of data.products){
      const row=document.createElement('label');row.className='review-item';row.dataset.search=`${item.name||''} ${item.store||''} ${item.category||''}`.toLowerCase();
      const recommended=item.status==='new'; const box=contributionCheckbox('product',item.id,!!item.selected,recommended);
      const body=document.createElement('span');const title=document.createElement('strong');title.textContent=item.name;const meta=document.createElement('small');meta.textContent=`${item.store||'Sin tienda'} · ${item.category||'otros'} · ${money(item.price)}`;body.append(title,meta);if(item.reason){const reason=document.createElement('em');reason.textContent=item.reason;body.append(reason);}
      row.append(box,body,statusBadge(item.status,item.reason));products.append(row);
    }
    updateSelectionSummary();
    $('contributionPreview').scrollIntoView({behavior:'smooth',block:'start'});
  }

  function selectedContribution(kind) {
    return [...document.querySelectorAll(`[data-contribution-kind="${kind}"]:checked`)].map(el=>el.dataset.key);
  }
  function updateSelectionSummary() {
    const stores=selectedContribution('store').length, products=selectedContribution('product').length;
    $('selectionSummary').textContent=`${products} productos y ${stores} tiendas seleccionados`;
    $('applyContribution').disabled=(stores+products)===0;
  }

  $('previewContribution').onclick=async()=>{
    const file=$('contributionFile').files[0];
    if(!file)return notify('Elegí el ZIP que te envió el colaborador.',true);
    if(file.size>32*1024*1024)return notify('El aporte supera los 32 MB.',true);
    try{notify('Analizando aporte…');const data=await api('/api/manual/preview-contribution',{filename:file.name,data:await fileAsBase64(file)});renderContributionPreview(data);notify('Aporte listo para revisar.');}catch(e){notify(e.message,true);}
  };
  $('selectRecommended').onclick=()=>{document.querySelectorAll('[data-contribution-kind]').forEach(el=>el.checked=el.dataset.recommended==='1');updateSelectionSummary();};
  $('clearContributionSelection').onclick=()=>{document.querySelectorAll('[data-contribution-kind]').forEach(el=>el.checked=false);updateSelectionSummary();};
  $('applyContribution').onclick=async()=>{
    if(!contributionPreviewData)return;
    const stores=selectedContribution('store'),products=selectedContribution('product');
    if(!stores.length&&!products.length)return notify('Seleccioná al menos un elemento.',true);
    const ok=await confirmDialog({title:'Importar colaboración',message:`Se agregarán ${products.length} productos y ${stores.length} tiendas al catálogo manual. No se reemplazan silenciosamente publicaciones existentes.`,confirmText:'Importar seleccionados'});if(!ok)return;
    try{const saved=await api('/api/manual/apply-contribution',{preview_id:contributionPreviewData.preview_id,stores,products});const summary=saved.import_summary||{};applyState(saved);contributionPreviewData=null;$('contributionPreview').hidden=true;$('contributionFile').value='';resetProduct();resetStore();switchTab('products');notify(`Aporte importado: ${summary.products||0} productos y ${summary.stores||0} tiendas.`);}catch(e){notify(e.message,true);}
  };

  $('contributionSearch')?.addEventListener('input',()=>{const q=$('contributionSearch').value.trim().toLowerCase();document.querySelectorAll('#previewStores .review-item,#previewProducts .review-item').forEach(row=>row.hidden=!!q&&!String(row.dataset.search||'').includes(q));});

  $('contributorName').addEventListener('input',updateContributionDownloadLink);
  $('contributorNote').addEventListener('input',updateContributionDownloadLink);
  $('downloadContribution').addEventListener('click',event=>{if(!$('contributorName').value.trim()){event.preventDefault();notify('Escribí tu nombre o identificador antes de exportar.',true);}});
  $('resetContribution').onclick=async()=>{const ok=await confirmDialog({title:'Vaciar aporte local',message:'Se borrarán todos los productos, tiendas e imágenes guardados en esta bandeja de colaborador.',confirmText:'Vaciar aporte',danger:true});if(!ok)return;try{const saved=await api('/api/manual/reset-contribution',{});applyState(saved);resetProduct();resetStore();notify('Tu bandeja de colaboración quedó vacía.');}catch(e){notify(e.message,true);}};

  for(const id of ['productSourceUrl','productUrl','storeWebsite','storeInstagram','storeFacebook','storeWhatsapp','storeTelegram']) {
    $(id)?.addEventListener('blur',()=>{const el=$(id); if(el.value.trim()&&!validHttpUrl(el,true))setFieldError(el,'Usá una URL https:// sin credenciales'); else {el.classList.remove('field-invalid');el.closest('label')?.querySelector('.field-error')?.remove();}});
  }
  document.addEventListener('keydown',event=>{
    if(!(event.ctrlKey||event.metaKey)||event.key.toLowerCase()!=='s')return; event.preventDefault(); const tab=document.querySelector('.tab.active')?.dataset.tab;
    if(['appearance','carousel','page'].includes(tab))return window.RivFreeStudio?.saveActive(tab);
    if(tab==='products')return $('productForm')?.requestSubmit(); if(tab==='stores')return $('storeForm')?.requestSubmit();
  });

  const maybeClearFieldError=event=>{const el=event.target;if(!el?.classList?.contains('field-invalid'))return;let ok=!!el.value?.trim?.();if(el.type==='url')ok=validHttpUrl(el,true);if(el.id==='productImage'){const v=el.value.trim();ok=!v||v.startsWith('assets/')||v.startsWith('contributor-assets/')||validHttpUrl(el,false);}if(ok){el.classList.remove('field-invalid');el.closest('label')?.querySelector('.field-error')?.remove();}};
  document.addEventListener('input',maybeClearFieldError); document.addEventListener('change',maybeClearFieldError);

  for(const form of [$('productForm'),$('storeForm')]) form.addEventListener('input',()=>setDirty(true));
  $('productImageFile').addEventListener('change',()=>setDirty(true));

  resetProduct(); resetStore();
  load().catch(e=>notify(e.message,true));
})();
