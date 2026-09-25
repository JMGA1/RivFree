(() => {
  'use strict';

  const params = new URLSearchParams(location.search);
  const token = params.get('token') || '';
  const $ = id => document.getElementById(id);
  const apiHeaders = {'Content-Type': 'application/json', 'X-RivFree-Editor-Token': token};
  const categories = new Set(['perfumes','bebidas','alimentos','electronica','informatica','cosmetica','hogar','ropa','accesorios','juguetes','relojes','optica','deportes','herramientas','otros']);

  let state = {revision:'', mode:'owner', stores:{}, base_stores:{}, manual_stores:{}, products:[]};
  let dirty = false;
  let statusTimer;
  let contributionPreviewData = null;

  function notify(message, error=false) {
    const el = $('status');
    el.textContent = message;
    el.className = 'status visible' + (error ? ' error' : '');
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => el.className = 'status', 4400);
  }

  function setDirty(value) {
    dirty = value;
    $('saveState').textContent = value ? 'Cambios del formulario sin guardar' : 'Sin cambios pendientes';
    $('saveState').style.color = value ? '#ffcf7a' : '';
  }

  window.addEventListener('beforeunload', event => {
    if (!dirty) return;
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
      document.title = 'RivFree · Editor manual';
      $('brandTitle').textContent = 'RivFree';
      $('brandSubtitle').textContent = 'Editor local de catálogo';
      $('projectEyebrow').textContent = 'PROYECTO LOCAL';
      $('projectDescription').textContent = 'Los cambios se guardan directamente en los archivos del repositorio.';
      $('transferTabLabel').textContent = 'Importar / exportar';
      $('helpTitle').textContent = 'Publicar en GitHub';
      $('helpText').innerHTML = 'Después de guardar, hacé <code>git add .</code>, commit y push. El scraper no borra estos datos manuales.';
      $('openSite').hidden = false;
    }
  }

  function applyState(data) {
    state = data;
    applyModeUI();
    $('projectPath').textContent = data.project_root || '';
    $('productCount').textContent = data.products.length;
    $('storeCount').textContent = state.mode === 'contributor' ? Object.keys(data.manual_stores || {}).length : Object.keys(data.stores || {}).length;
    renderStoreOptions();
    renderProducts();
    renderStores();
    setDownloadLinks();
  }

  function setDownloadLinks() {
    const q = encodeURIComponent(token);
    $('downloadJson').href = `/api/manual/export?token=${q}`;
    $('downloadZip').href = `/api/manual/export.zip?token=${q}`;
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
    link.href = `/api/manual/contribution.zip?token=${encodeURIComponent(token)}&name=${encodeURIComponent(name)}&note=${encodeURIComponent(note)}`;
    link.classList.remove('disabled-link');
    link.setAttribute('aria-disabled','false');
  }

  function switchTab(name) {
    document.querySelectorAll('.tab').forEach(el => el.classList.toggle('active', el.dataset.tab === name));
    document.querySelectorAll('.panel').forEach(el => el.classList.toggle('active', el.dataset.panel === name));
  }

  document.querySelectorAll('.tab').forEach(el => el.addEventListener('click', () => switchTab(el.dataset.tab)));
  $('reloadState').onclick = async () => {
    if (dirty && !confirm('Hay cambios sin guardar. ¿Recargar igual?')) return;
    try { await load(); notify('Datos recargados.'); }
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
    return (!store || product.tienda === store) && (!q || `${product.nombre} ${product.tienda} ${product.categoria}`.toLowerCase().includes(q));
  }

  function renderProducts() {
    const list = $('productList');
    list.replaceChildren();
    const products = [...state.products].sort((a,b)=>(b.actualizado_manual||'').localeCompare(a.actualizado_manual||'')).filter(productMatches);
    if (!products.length) { list.append($('emptyTemplate').content.cloneNode(true)); return; }
    for (const product of products) {
      const item = document.createElement('button');
      item.type = 'button'; item.className = 'list-item'; item.dataset.id = product.id;
      const left = document.createElement('div');
      const title = document.createElement('strong'); title.textContent = product.nombre;
      const meta = document.createElement('small'); meta.textContent = `${product.tienda} · ${product.categoria||'otros'}${product.activo===false?' · Oculto':''}`;
      left.append(title, meta);
      if (product.fuente_tipo && product.fuente_tipo !== 'manual') {
        const source = document.createElement('span'); source.className = 'source-mini'; source.textContent = sourceLabel(product.fuente_tipo); left.append(source);
      }
      const price = document.createElement('span'); price.className = 'price'; price.textContent = money(product.precio_usd);
      item.append(left, price); item.onclick = () => editProduct(product.id); list.append(item);
    }
    highlightSelectedProduct();
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
    $('duplicateProduct').disabled=true; $('deleteProduct').disabled=true;
    updateActiveBadge(); updateImagePreview(); highlightSelectedProduct(); setDirty(false);
  }

  function editProduct(id) {
    const p = state.products.find(item => item.id === id); if (!p) return;
    $('productId').value=p.id; $('productName').value=p.nombre||''; $('productStore').value=p.tienda||'';
    $('productCategory').value=categories.has(p.categoria)?p.categoria:'otros'; $('productPrice').value=p.precio_usd??''; $('productOldPrice').value=p.precio_original_usd??'';
    $('productOffer').checked=!!p.en_oferta; $('productActive').checked=p.activo!==false; $('productSource').value=p.fuente_tipo||'manual'; $('productSourceUrl').value=p.fuente_url||'';
    $('productUrl').value=p.url||''; $('productImage').value=p.imagen||''; $('productNote').value=p.nota_manual||''; $('productImageFile').value='';
    $('productFormEyebrow').textContent='EDITANDO PUBLICACIÓN'; $('productFormTitle').textContent=p.nombre;
    $('duplicateProduct').disabled=false; $('deleteProduct').disabled=false;
    updateActiveBadge(); updateImagePreview(); highlightSelectedProduct(); setDirty(false);
  }

  function updateActiveBadge() {
    const active=$('productActive').checked, badge=$('productActiveBadge');
    badge.textContent=active?'Visible':'Oculto'; badge.className='badge'+(active?' good':'');
  }

  function updateImagePreview() {
    const box=$('imagePreview'), url=$('productImage').value.trim(); box.replaceChildren();
    if (!url) { const span=document.createElement('span'); span.textContent='Sin imagen'; box.append(span); return; }
    const img=document.createElement('img'); img.alt='Vista previa'; img.src=(url.startsWith('assets/')||url.startsWith('.contributor-work/'))?'/'+url:url;
    img.onerror=()=>{box.replaceChildren();const span=document.createElement('span');span.textContent='No se pudo cargar la imagen';box.append(span);}; box.append(img);
  }

  async function uploadSelectedImage() {
    const file=$('productImageFile').files[0]; if(!file) return null;
    if(file.size>6*1024*1024) throw new Error('La imagen supera los 6 MB.');
    const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('No se pudo leer la imagen'));reader.readAsDataURL(file);});
    const result=await api('/api/manual/upload-image',{filename:file.name,data:base64}); $('productImage').value=result.path; return result.path;
  }

  function productPayload() {
    return {id:$('productId').value,tienda:$('productStore').value,nombre:$('productName').value,categoria:$('productCategory').value,precio_usd:$('productPrice').value,precio_original_usd:$('productOldPrice').value,en_oferta:$('productOffer').checked,activo:$('productActive').checked,fuente_tipo:$('productSource').value,fuente_url:$('productSourceUrl').value,url:$('productUrl').value,imagen:$('productImage').value,nota_manual:$('productNote').value};
  }

  $('productForm').addEventListener('submit', async event => {
    event.preventDefault();
    try {
      if ($('productImageFile').files[0]) await uploadSelectedImage();
      const saved=await api('/api/manual/save-product',{product:productPayload()}); applyState(saved); editProduct(saved.saved_id||$('productId').value);
      notify(state.mode==='contributor'?'Producto guardado en tu aporte.':'Publicación guardada. Ya forma parte del catálogo manual.');
    } catch(e) { notify(e.message,true); }
  });
  $('newProduct').onclick=()=>{resetProduct();$('productName').focus();};
  $('duplicateProduct').onclick=()=>{$('productId').value='';$('productFormEyebrow').textContent='COPIA NUEVA';$('productFormTitle').textContent='Duplicar publicación';$('deleteProduct').disabled=true;$('duplicateProduct').disabled=true;highlightSelectedProduct();setDirty(true);};
  $('deleteProduct').onclick=async()=>{const id=$('productId').value;if(!id||!confirm('¿Eliminar esta publicación?'))return;try{const saved=await api('/api/manual/delete-product',{id});applyState(saved);resetProduct();notify('Publicación eliminada.');}catch(e){notify(e.message,true);}};
  $('productActive').onchange=()=>{updateActiveBadge();setDirty(true);};
  $('productImage').addEventListener('input',updateImagePreview);
  $('clearImage').onclick=()=>{$('productImage').value='';$('productImageFile').value='';updateImagePreview();setDirty(true);};
  $('productSearch').addEventListener('input',renderProducts); $('productStoreFilter').addEventListener('change',renderProducts);

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
      meta.textContent=(editable?(state.mode==='contributor'?'Incluida en tu aporte':'Configuración manual'):(state.mode==='contributor'?'Tienda disponible':'Tienda base'))+(info.direccion?` · ${info.direccion}`:'');
      left.append(title,meta);
      const color=document.createElement('span');color.className='price';color.innerHTML=`<span class="manual-dot" style="background:${info.color||'#B42335'}"></span>${editable?'Editable':'Referencia'}`;
      item.append(left,color);item.onclick=()=>editStore(name);list.append(item);
    }
    highlightSelectedStore();
  }
  function highlightSelectedStore(){const name=$('storeOriginalName').value;document.querySelectorAll('#storeList .list-item').forEach(el=>el.classList.toggle('selected',el.dataset.name===name));}
  function resetStore(){$('storeForm').reset();$('storeOriginalName').value='';$('storeColor').value='#B42335';$('storeTextColor').value='#FFFFFF';$('storeFormEyebrow').textContent='NUEVA TIENDA';$('storeFormTitle').textContent='Agregar free shop';$('storeKindBadge').textContent='Manual';$('deleteStore').disabled=true;highlightSelectedStore();setDirty(false);}
  function editStore(name){const info=state.stores[name]||{};$('storeOriginalName').value=name;$('storeName').value=name;$('storeFullName').value=info.nombre_completo||name;$('storeColor').value=/^#[0-9a-f]{6}$/i.test(info.color||'')?info.color:'#B42335';$('storeTextColor').value=/^#[0-9a-f]{6}$/i.test(info.color_texto||'')?info.color_texto:'#FFFFFF';$('storeAddress').value=info.direccion||'';$('storePhone').value=info.telefono||'';$('storeEmail').value=info.email||'';$('storeHours').value=info.horario||'';$('storeWebsite').value=info.sitio_web||'';$('storeInstagram').value=info.redes?.instagram||'';$('storeFacebook').value=info.redes?.facebook||'';$('storeWhatsapp').value=info.redes?.whatsapp||'';$('storeCatalogOnline').checked=!!info.catalogo_online;$('storeNote').value=info.nota||'';$('storeFormEyebrow').textContent=state.manual_stores[name]?'EDITANDO CONFIGURACIÓN':(state.mode==='contributor'?'COPIAR/PROPONER DATOS':'SOBRESCRIBIR TIENDA BASE');$('storeFormTitle').textContent=name;$('storeKindBadge').textContent=state.manual_stores[name]?'Manual':'Referencia';$('deleteStore').disabled=!state.manual_stores[name];highlightSelectedStore();setDirty(false);}
  function storePayload(){return {nombre:$('storeName').value,nombre_completo:$('storeFullName').value,color:$('storeColor').value,color_texto:$('storeTextColor').value,direccion:$('storeAddress').value,telefono:$('storePhone').value,email:$('storeEmail').value,horario:$('storeHours').value,sitio_web:$('storeWebsite').value,instagram:$('storeInstagram').value,facebook:$('storeFacebook').value,whatsapp:$('storeWhatsapp').value,catalogo_online:$('storeCatalogOnline').checked,nota:$('storeNote').value};}
  $('storeForm').addEventListener('submit',async event=>{event.preventDefault();try{const saved=await api('/api/manual/save-store',{original_name:$('storeOriginalName').value,store:storePayload()});applyState(saved);editStore($('storeName').value.trim());notify(state.mode==='contributor'?'Tienda guardada en tu aporte.':'Tienda guardada. Ya aparecerá en filtros y tarjetas cuando tenga productos.');}catch(e){notify(e.message,true);}});
  $('newStore').onclick=()=>{resetStore();$('storeName').focus();};
  $('deleteStore').onclick=async()=>{const name=$('storeOriginalName').value;if(!name)return;let deleteProducts=false;const related=state.products.filter(p=>p.tienda===name).length,isBase=!!state.base_stores[name];if(related&&!isBase){deleteProducts=confirm(`Esta tienda tiene ${related} publicaciones. Aceptar elimina también esas publicaciones; Cancelar no borra nada.`);if(!deleteProducts)return;}else if(!confirm(isBase?'¿Quitar esta propuesta/configuración y volver a la tienda de referencia?':'¿Eliminar esta tienda?'))return;try{const saved=await api('/api/manual/delete-store',{name,delete_products:deleteProducts});applyState(saved);resetStore();notify(isBase?'Configuración eliminada; se usa nuevamente la referencia.':'Tienda eliminada.');}catch(e){notify(e.message,true);}};
  $('storeSearch').addEventListener('input',renderStores);

  function csvRows(text){const rows=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];if(c==='"'){if(quoted&&n==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&n==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell='';}else cell+=c;}row.push(cell);if(row.some(v=>v.trim()))rows.push(row);return rows;}
  function csvToProducts(raw){const rows=csvRows(raw);if(rows.length<2)return[];const headers=rows[0].map(h=>h.trim().toLowerCase());return rows.slice(1).map(row=>{const p={};headers.forEach((h,i)=>p[h]=(row[i]||'').trim());for(const k of ['precio_usd','precio_original_usd'])if(p[k]!==''&&p[k]!=null)p[k]=Number(String(p[k]).replace(',','.'));for(const k of ['activo','en_oferta'])if(k in p)p[k]=!['false','0','no','não'].includes(String(p[k]).toLowerCase());return p;}).filter(p=>p.tienda&&p.nombre);}
  $('importButton').onclick=async()=>{const file=$('importFile').files[0];if(!file)return notify('Elegí un archivo JSON o CSV.',true);try{const raw=await file.text();let data;if(file.name.toLowerCase().endsWith('.csv'))data={products:csvToProducts(raw)};else{const parsed=JSON.parse(raw);data=parsed.format==='rivfree-manual-v1'?parsed:(Array.isArray(parsed)?{products:parsed}:parsed);}const replace=$('importMode').value==='replace';if(replace&&!confirm('Esto reemplazará todas las tiendas y publicaciones manuales actuales. ¿Continuar?'))return;const saved=await api('/api/manual/import',{mode:replace?'replace':'merge',data});applyState(saved);resetProduct();resetStore();notify('Importación completada.');}catch(e){notify(e.message,true);}};

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
      const row=document.createElement('label');row.className='review-item';
      const box=contributionCheckbox('store',item.name,!!item.selected,item.status==='new');
      const body=document.createElement('span');const title=document.createElement('strong');title.textContent=item.name;const meta=document.createElement('small');meta.textContent=item.status==='existing'?'Ya existe: dejala desmarcada salvo que quieras actualizar sus datos.':'Tienda nueva';body.append(title,meta);
      row.append(box,body,statusBadge(item.status==='existing'?'possible_duplicate':'new',item.status==='existing'?'La tienda ya existe':''));stores.append(row);
    }
    const products=$('previewProducts'); products.replaceChildren();
    if(!data.products.length){products.append($('emptyTemplate').content.cloneNode(true));} else for(const item of data.products){
      const row=document.createElement('label');row.className='review-item';
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
    if(!confirm(`¿Importar ${products.length} productos y ${stores.length} tiendas seleccionados?`))return;
    try{const saved=await api('/api/manual/apply-contribution',{preview_id:contributionPreviewData.preview_id,stores,products});const summary=saved.import_summary||{};applyState(saved);contributionPreviewData=null;$('contributionPreview').hidden=true;$('contributionFile').value='';resetProduct();resetStore();switchTab('products');notify(`Aporte importado: ${summary.products||0} productos y ${summary.stores||0} tiendas.`);}catch(e){notify(e.message,true);}
  };

  $('contributorName').addEventListener('input',updateContributionDownloadLink);
  $('contributorNote').addEventListener('input',updateContributionDownloadLink);
  $('downloadContribution').addEventListener('click',event=>{if(!$('contributorName').value.trim()){event.preventDefault();notify('Escribí tu nombre o identificador antes de exportar.',true);}});
  $('resetContribution').onclick=async()=>{if(!confirm('¿Vaciar todos los productos, tiendas e imágenes de este aporte local?'))return;try{const saved=await api('/api/manual/reset-contribution',{});applyState(saved);resetProduct();resetStore();notify('Tu bandeja de colaboración quedó vacía.');}catch(e){notify(e.message,true);}};

  for(const form of [$('productForm'),$('storeForm')]) form.addEventListener('input',()=>setDirty(true));
  $('productImageFile').addEventListener('change',()=>setDirty(true));

  resetProduct(); resetStore();
  load().catch(e=>notify(e.message,true));
})();
