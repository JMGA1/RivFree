(() => {
  'use strict';

  const E = window.RivFreeEditor;
  if (!E) return;
  const $ = id => document.getElementById(id);
  const clone = value => JSON.parse(JSON.stringify(value ?? {}));
  const sectionLabels = {
    hero: 'Carrusel principal', benefits: 'Pasos 01 · 02 · 03', discover: 'Por descubrir',
    popular: 'Más consultados', catalog: 'Catálogo y filtros'
  };
  const DRAFT_KEY = 'rivfree-studio-draft-v2';
  const STUDIO_TABS = new Set(['appearance', 'carousel', 'page']);

  let savedConfig = null;
  let workingConfig = null;
  let savedHero = [];
  let workingHero = [];
  let selectedCampaignId = '';
  let dirtySections = new Set();
  let heroDirty = false;
  let suppressStateOnce = false;
  let initialized = false;
  let lastState = null;

  const PRESETS = {
    rivfree: {
      font: 'system-modern', density: 'comfortable', shadow: 'soft', radius: 12,
      light: {background:'#F1ECDE',surface:'#FFFFFF',text:'#1B1B1B',primary:'#123C39',accent:'#F06449',highlight:'#BEEB72'},
      dark: {background:'#101716',surface:'#17211F',text:'#F2EFE7',primary:'#194F4A',accent:'#FF8068',highlight:'#C8F47E'}
    },
    clean: {
      font: 'system-modern', density: 'airy', shadow: 'soft', radius: 16,
      light: {background:'#F6F5F2',surface:'#FFFFFF',text:'#202124',primary:'#8F1D2C',accent:'#D94A5A',highlight:'#F4D7DB'},
      dark: {background:'#171719',surface:'#222226',text:'#F6F4F1',primary:'#B72A3D',accent:'#F06A79',highlight:'#F2C6CC'}
    },
    night: {
      font: 'rounded', density: 'comfortable', shadow: 'strong', radius: 20,
      light: {background:'#E9EFE9',surface:'#FFFFFF',text:'#16201D',primary:'#173C36',accent:'#607C3C',highlight:'#D8F26A'},
      dark: {background:'#0B1110',surface:'#141D1A',text:'#F3F5ED',primary:'#1C4D43',accent:'#9BCB55',highlight:'#D8F26A'}
    }
  };

  function val(id, value='') { const el=$(id); if (el) el.value = value ?? ''; }
  function chk(id, value) { const el=$(id); if (el) el.checked = !!value; }
  function ensureConfig() {
    if (workingConfig) return;
    const state = E.getState();
    savedConfig = clone(state.site_config || {});
    workingConfig = clone(savedConfig);
    savedHero = clone(state.highlights?.hero || []);
    workingHero = clone(savedHero);
  }
  function anyDirty() { return dirtySections.size > 0 || heroDirty; }
  function markDirty(section, value=true) {
    if (section === 'hero') heroDirty = value;
    else if (value) dirtySections.add(section);
    else dirtySections.delete(section);
    updateDirtyUI();
  }
  function updateDirtyUI() {
    for (const dot of document.querySelectorAll('[data-dirty-for]')) {
      const section = dot.dataset.dirtyFor;
      dot.hidden = !(section === 'carousel' ? (dirtySections.has('carousel') || heroDirty) : dirtySections.has(section));
    }
    E.setExternalDirty(anyDirty());
    if (!anyDirty()) localStorage.removeItem(DRAFT_KEY);
  }
  function getColor(id, fallback) {
    const value = $(id)?.value || '';
    return /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : fallback;
  }

  function fillAppearance() {
    ensureConfig();
    const c=workingConfig, a=c.appearance||{}, light=a.light||{}, dark=a.dark||{}, b=c.branding||{};
    val('siteName', b.site_name || 'RivFree'); val('taglineEs', b.tagline_es || ''); val('taglinePt', b.tagline_pt || '');
    val('siteFont', a.font || 'system-modern'); val('siteDensity', a.density || 'comfortable'); val('siteShadow', a.shadow || 'soft');
    val('siteRadius', a.radius ?? 12); if ($('radiusValue')) $('radiusValue').textContent = `${a.radius ?? 12}px`;
    for (const [prefix,palette] of [['light',light],['dark',dark]]) {
      const defaults = prefix === 'light'
        ? {Background:'#F1ECDE',Surface:'#FFFFFF',Text:'#1B1B1B',Primary:'#123C39',Accent:'#F06449',Highlight:'#BEEB72'}
        : {Background:'#101716',Surface:'#17211F',Text:'#F2EFE7',Primary:'#194F4A',Accent:'#FF8068',Highlight:'#C8F47E'};
      for (const key of ['Background','Surface','Text','Primary','Accent','Highlight']) {
        val(prefix+key, palette[key.toLowerCase()] || defaults[key]);
      }
      val(prefix+'BgImage', palette.background_image || '');
      val(prefix+'Overlay', Math.round((Number(palette.background_overlay)||0)*100));
      if ($(prefix+'OverlayValue')) $(prefix+'OverlayValue').textContent = `${Math.round((Number(palette.background_overlay)||0)*100)}%`;
    }
    syncAllHexInputs();
  }

  function readAppearance() {
    ensureConfig();
    workingConfig.branding = {
      site_name: $('siteName').value.trim() || 'RivFree',
      tagline_es: $('taglineEs').value.trim(), tagline_pt: $('taglinePt').value.trim()
    };
    workingConfig.appearance = workingConfig.appearance || {};
    Object.assign(workingConfig.appearance, {
      font:$('siteFont').value, density:$('siteDensity').value, shadow:$('siteShadow').value,
      radius:Number($('siteRadius').value)||0
    });
    for (const prefix of ['light','dark']) {
      workingConfig.appearance[prefix] = {
        background:getColor(prefix+'Background', prefix==='light'?'#F1ECDE':'#101716'),
        surface:getColor(prefix+'Surface', prefix==='light'?'#FFFFFF':'#17211F'),
        text:getColor(prefix+'Text', prefix==='light'?'#1B1B1B':'#F2EFE7'),
        primary:getColor(prefix+'Primary', prefix==='light'?'#123C39':'#194F4A'),
        accent:getColor(prefix+'Accent', prefix==='light'?'#F06449':'#FF8068'),
        highlight:getColor(prefix+'Highlight', prefix==='light'?'#BEEB72':'#C8F47E'),
        background_image:$(prefix+'BgImage').value.trim(),
        background_overlay:(Number($(prefix+'Overlay').value)||0)/100
      };
    }
    return workingConfig;
  }

  function fillPage() {
    ensureConfig();
    const c=workingConfig, n=c.notice||{}, seo=c.seo||{}, f=c.footer||{};
    chk('noticeEnabled', n.enabled!==false); chk('noticeDismissible', n.dismissible!==false);
    val('noticeTitleEs',n.title_es); val('noticeTitlePt',n.title_pt); val('noticeTextEs',n.text_es); val('noticeTextPt',n.text_pt);
    val('seoTitleEs',seo.title_es); val('seoTitlePt',seo.title_pt); val('seoDescriptionEs',seo.description_es); val('seoDescriptionPt',seo.description_pt); val('seoSocialImage',seo.social_image||'social-card.png');
    val('footerTitleEs',f.title_es); val('footerTitlePt',f.title_pt); val('footerTextEs',f.text_es); val('footerTextPt',f.text_pt); chk('footerPrivacy',f.show_privacy!==false);
    renderSectionOrder(); updateSeoCounters();
  }
  function readPage() {
    ensureConfig();
    workingConfig.notice = {enabled:$('noticeEnabled').checked,dismissible:$('noticeDismissible').checked,title_es:$('noticeTitleEs').value.trim(),title_pt:$('noticeTitlePt').value.trim(),text_es:$('noticeTextEs').value.trim(),text_pt:$('noticeTextPt').value.trim()};
    workingConfig.seo = {title_es:$('seoTitleEs').value.trim(),title_pt:$('seoTitlePt').value.trim(),description_es:$('seoDescriptionEs').value.trim(),description_pt:$('seoDescriptionPt').value.trim(),social_image:$('seoSocialImage').value.trim()||'social-card.png'};
    workingConfig.footer = {title_es:$('footerTitleEs').value.trim(),title_pt:$('footerTitlePt').value.trim(),text_es:$('footerTextEs').value.trim(),text_pt:$('footerTextPt').value.trim(),show_privacy:$('footerPrivacy').checked};
    return workingConfig;
  }

  function renderSectionOrder() {
    ensureConfig();
    const hp = workingConfig.homepage = workingConfig.homepage || {order:Object.keys(sectionLabels),visible:{}};
    hp.order = Array.isArray(hp.order) ? hp.order : Object.keys(sectionLabels);
    for (const key of Object.keys(sectionLabels)) if (!hp.order.includes(key)) hp.order.push(key);
    hp.visible = hp.visible || {};
    const root=$('sectionOrder'); if (!root) return; root.replaceChildren();
    hp.order.forEach((key,index)=>{
      const row=document.createElement('div'); row.className='section-order-row';
      const toggle=document.createElement('input'); toggle.type='checkbox'; toggle.checked=hp.visible[key]!==false; toggle.setAttribute('aria-label',`Mostrar ${sectionLabels[key]||key}`);
      toggle.onchange=()=>{hp.visible[key]=toggle.checked; markDirty('page'); sendPreview();};
      const label=document.createElement('strong'); label.textContent=sectionLabels[key]||key;
      const controls=document.createElement('div');
      for (const [symbol,delta,labelText] of [['↑',-1,'Subir'],['↓',1,'Bajar']]) {
        const button=document.createElement('button'); button.type='button'; button.className='mini-button'; button.textContent=symbol;
        button.setAttribute('aria-label',`${labelText} ${sectionLabels[key]||key}`);
        button.disabled=(delta<0&&index===0)||(delta>0&&index===hp.order.length-1);
        button.onclick=()=>{const target=index+delta;[hp.order[index],hp.order[target]]=[hp.order[target],hp.order[index]];markDirty('page');renderSectionOrder();sendPreview();};
        controls.append(button);
      }
      row.append(toggle,label,controls); root.append(row);
    });
  }

  function campaignDefaults() { return {id:'',poolGroup:'general',theme:'rose',layout:'split',enabled:true,sponsored:false,eyebrow:{es:'','pt-BR':''},title:{es:'Nuevo banner','pt-BR':'Novo banner'},description:{es:'','pt-BR':''},cta:{es:'Explorar','pt-BR':'Explorar'},category:'',href:'',image:'',starts_at:'',ends_at:''}; }
  function campaignById(id) { return workingHero.find(c=>c.id===id); }
  function campaignScheduleState(c, now=new Date()) {
    if (c.enabled===false) return {key:'inactive',label:'Inactivo'};
    const start=c.starts_at?new Date(c.starts_at):null, end=c.ends_at?new Date(c.ends_at):null;
    if (end && !Number.isNaN(end.getTime()) && end < now) return {key:'expired',label:'Vencido'};
    if (start && !Number.isNaN(start.getTime()) && start > now) return {key:'scheduled',label:'Programado'};
    if ((start && !Number.isNaN(start.getTime())) || (end && !Number.isNaN(end.getTime()))) return {key:'live',label:'Vigente ahora'};
    return {key:'live',label:'Activo'};
  }
  function renderCampaignList() {
    ensureConfig(); if ($('campaignCount')) $('campaignCount').textContent=workingHero.length;
    const root=$('campaignList'); if (!root) return; root.replaceChildren();
    workingHero.forEach((c,index)=>{
      const schedule=campaignScheduleState(c);
      const row=document.createElement('div'); row.className='list-item campaign-list-item'+(c.id===selectedCampaignId?' selected':''); row.dataset.id=c.id;
      const body=document.createElement('button'); body.type='button'; body.className='campaign-list-main'; body.onclick=()=>editCampaign(c.id);
      const title=document.createElement('strong'); title.textContent=c.title?.es||c.title?.['pt-BR']||c.id;
      const meta=document.createElement('small'); meta.textContent=`${c.sponsored?'Patrocinado · ':''}${c.poolGroup||'general'} · `;
      const state=document.createElement('span'); state.className=`schedule-pill ${schedule.key}`; state.textContent=schedule.label; meta.append(state);
      body.append(title,meta);
      const controls=document.createElement('span'); controls.className='campaign-reorder';
      for (const [symbol,delta,labelText] of [['↑',-1,'Subir'],['↓',1,'Bajar']]) {
        const b=document.createElement('button'); b.type='button'; b.className='mini-button'; b.textContent=symbol; b.setAttribute('aria-label',`${labelText} banner ${title.textContent}`);
        b.disabled=(delta<0&&index===0)||(delta>0&&index===workingHero.length-1);
        b.onclick=e=>{e.stopPropagation();const target=index+delta;[workingHero[index],workingHero[target]]=[workingHero[target],workingHero[index]];markDirty('hero');renderCampaignList();sendPreview();};
        controls.append(b);
      }
      row.append(body,controls); root.append(row);
    });
    if (!workingHero.length) { const d=document.createElement('div'); d.className='empty-list'; d.innerHTML='<strong>No hay banners.</strong><span>Creá el primero con “Nuevo banner”.</span>'; root.append(d); }
  }
  function toLocalDate(value) {
    if (!value) return '';
    const d=new Date(value); if (Number.isNaN(d.getTime())) return String(value).slice(0,16);
    const pad=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function editCampaign(id) {
    ensureConfig(); const c=campaignById(id)||campaignDefaults(); selectedCampaignId=c.id||'';
    val('campaignId',c.id||''); val('campaignGroup',c.poolGroup||'general'); val('campaignTheme',c.theme||'rose'); val('campaignLayout',c.layout||'split'); val('campaignSmart',c.smartType||'');
    chk('campaignEnabled',c.enabled!==false); chk('campaignSponsored',!!c.sponsored); val('campaignEyebrowEs',c.eyebrow?.es); val('campaignEyebrowPt',c.eyebrow?.['pt-BR']); val('campaignTitleEs',c.title?.es); val('campaignTitlePt',c.title?.['pt-BR']); val('campaignDescriptionEs',c.description?.es); val('campaignDescriptionPt',c.description?.['pt-BR']); val('campaignCtaEs',c.cta?.es); val('campaignCtaPt',c.cta?.['pt-BR']); val('campaignCategory',c.category); val('campaignHref',c.href); val('campaignStart',toLocalDate(c.starts_at)); val('campaignEnd',toLocalDate(c.ends_at)); val('campaignImage',c.image||c.images?.[0]?.src||'');
    if ($('campaignFormTitle')) $('campaignFormTitle').textContent=selectedCampaignId?(c.title?.es||'Editar banner'):'Nuevo banner';
    if ($('campaignSponsorBadge')) $('campaignSponsorBadge').textContent=c.sponsored?'Patrocinado':'Editorial';
    updateCampaignImagePreview(); renderCampaignList();
  }
  function slug(value) { return String(value||'banner').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70)||`banner-${Date.now()}`; }
  function campaignFromForm() {
    const existing=campaignById(selectedCampaignId)||{}; const id=selectedCampaignId||`${slug($('campaignTitleEs').value)}-${Date.now().toString(36)}`;
    const out={...existing,id,poolGroup:$('campaignGroup').value,theme:$('campaignTheme').value,layout:$('campaignLayout').value,smartType:$('campaignSmart').value||undefined,enabled:$('campaignEnabled').checked,sponsored:$('campaignSponsored').checked,eyebrow:{es:$('campaignEyebrowEs').value.trim(),'pt-BR':$('campaignEyebrowPt').value.trim()},title:{es:$('campaignTitleEs').value.trim(),'pt-BR':$('campaignTitlePt').value.trim()},description:{es:$('campaignDescriptionEs').value.trim(),'pt-BR':$('campaignDescriptionPt').value.trim()},cta:{es:$('campaignCtaEs').value.trim(),'pt-BR':$('campaignCtaPt').value.trim()},category:$('campaignCategory').value.trim(),href:$('campaignHref').value.trim(),image:$('campaignImage').value.trim(),starts_at:$('campaignStart').value||undefined,ends_at:$('campaignEnd').value||undefined};
    delete out.images; return out;
  }
  function updateCampaignImagePreview() {
    const root=$('campaignImagePreview'); if (!root) return; const src=$('campaignImage').value.trim(); root.replaceChildren();
    if (!src) { const span=document.createElement('span');span.textContent='Sin imagen';root.append(span);return; }
    const img=document.createElement('img');img.src=src;img.alt='Vista previa del banner';img.onerror=()=>{root.textContent='No se pudo cargar';};root.append(img);
  }
  function fillCarouselSettings() {
    ensureConfig(); const c=workingConfig.carousel||{}; val('campaignVisibleCount',c.visible_count??5); chk('campaignAutoplay',c.autoplay!==false); val('campaignSeconds',c.autoplay_seconds??6);
    renderCampaignList(); if (selectedCampaignId&&campaignById(selectedCampaignId)) editCampaign(selectedCampaignId); else if (workingHero[0]) editCampaign(workingHero[0].id); else editCampaign('');
  }
  function readCarouselSettings() { ensureConfig(); workingConfig.carousel={visible_count:Number($('campaignVisibleCount').value)||5,autoplay:$('campaignAutoplay').checked,autoplay_seconds:Number($('campaignSeconds').value)||6}; return workingConfig; }

  function sendPreview() {
    ensureConfig(); readAppearance(); readPage(); readCarouselSettings();
    const frame=$('studioPreview'); if (!frame) return;
    try {
      frame.contentWindow?.postMessage({type:'rivfree-studio-preview',config:workingConfig},location.origin);
      frame.contentWindow?.postMessage({type:'rivfree-studio-campaigns-preview',hero:workingHero},location.origin);
    } catch {}
  }

  async function uploadFile(inputId,targetId) {
    const input=$(inputId), file=input?.files?.[0]; if (!file) return;
    const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('No se pudo leer la imagen'));reader.readAsDataURL(file);});
    const out=await E.api('/api/manual/upload-image',{filename:file.name,data}); $(targetId).value=out.path;
    markDirty(targetId==='campaignImage'?'hero':'appearance'); if (targetId==='campaignImage') updateCampaignImagePreview(); sendPreview(); E.notify('Imagen guardada en assets/manual/.');
  }

  function mergeSection(base, source, section) {
    const next=clone(base);
    if (section==='appearance') { next.branding=clone(source.branding||{}); next.appearance=clone(source.appearance||{}); }
    if (section==='page') { next.notice=clone(source.notice||{}); next.homepage=clone(source.homepage||{}); next.seo=clone(source.seo||{}); next.footer=clone(source.footer||{}); }
    if (section==='carousel') next.carousel=clone(source.carousel||{});
    return next;
  }
  async function saveConfigSection(section, message) {
    ensureConfig();
    if (section==='appearance') readAppearance(); else if (section==='page') readPage(); else if (section==='carousel') readCarouselSettings();
    try {
      const toSave=mergeSection(savedConfig||{},workingConfig,section);
      const response=await E.api('/api/manual/save-site-config',{config:toSave});
      suppressStateOnce=true; E.applyState(response);
      savedConfig=clone(response.site_config||toSave);
      // Keep unsaved work from other sections, but adopt normalized saved values for this section.
      const normalized=mergeSection(workingConfig,savedConfig,section); workingConfig=normalized;
      markDirty(section,false); E.notify(message); saveDraftNow();
    } catch (error) { E.notify(error.message,true); }
  }

  async function saveCarousel() {
    readCarouselSettings();
    try {
      if (dirtySections.has('carousel')) await saveConfigSection('carousel','Ajustes del carrusel guardados.');
      if (heroDirty) {
        const response=await E.api('/api/manual/save-highlights',{hero:workingHero});
        suppressStateOnce=true; E.applyState(response); savedHero=clone(response.highlights?.hero||workingHero); workingHero=clone(savedHero); markDirty('hero',false);
      }
      fillCarouselSettings(); renderHealth(E.getState()); E.notify('Carrusel guardado.');
    } catch (error) { E.notify(error.message,true); }
  }

  function fillAll() { if (E.getState().mode!=='owner') return; fillAppearance(); fillPage(); fillCarouselSettings(); renderHealth(E.getState()); sendPreview(); }

  function formatDate(value) { if (!value) return 'Nunca'; const d=new Date(value); return Number.isNaN(d.getTime())?String(value):d.toLocaleString(); }
  function renderHealth(state) {
    if (!state || state.mode!=='owner' || !$('healthKpis')) return;
    lastState=state;
    const health=state.health||{}, meta=state.meta||{}, products=state.products||[], hero=workingHero?.length?workingHero:(state.highlights?.hero||[]);
    const statuses=Object.values(health); const errors=statuses.filter(x=>x?.estado==='error').length; const partial=statuses.filter(x=>x?.estado==='parcial').length;
    const inactive=products.filter(p=>p?.activo===false).length; const noImage=products.filter(p=>!p?.imagen).length; const expired=hero.filter(c=>campaignScheduleState(c).key==='expired').length; const scheduled=hero.filter(c=>campaignScheduleState(c).key==='scheduled').length;
    const alertCount=errors+partial+inactive+noImage+expired; if ($('healthAlertCount')) $('healthAlertCount').textContent=alertCount;
    const kpis=[['Scrapers con error',errors,errors?'danger':'good'],['Scrapers parciales',partial,partial?'warn':'good'],['Manuales sin imagen',noImage,noImage?'warn':'good'],['Manuales inactivos',inactive,inactive?'warn':'good'],['Campañas vencidas',expired,expired?'warn':'good'],['Programadas',scheduled,'neutral']];
    $('healthKpis').replaceChildren(...kpis.map(([label,value,tone])=>{const card=document.createElement('article');card.className=`health-kpi ${tone}`;card.innerHTML=`<strong>${value}</strong><span>${label}</span>`;return card;}));
    if ($('lastCatalogUpdate')) $('lastCatalogUpdate').textContent=meta.actualizado?`Catálogo: ${formatDate(meta.actualizado)}`:'Sin fecha de catálogo';
    const byStore=new Map((meta.resumen||[]).map(item=>[item.tienda,item])); const stores=$('healthStores'); stores.replaceChildren();
    for (const [name,info] of Object.entries(health).sort(([a],[b])=>a.localeCompare(b,'es'))) {
      const summary=byStore.get(name)||{}; const status=info.estado||'desconocido'; const row=document.createElement('div'); row.className=`health-store ${status}`;
      const head=document.createElement('div'); head.innerHTML=`<span class="health-light ${status}" aria-hidden="true"></span><strong>${name}</strong><span class="health-status">${status.toUpperCase()}</span>`;
      const details=document.createElement('div'); details.className='health-store-details'; details.innerHTML=`<span>${Number(summary.productos||0).toLocaleString()} productos</span><span>${info.fallos_consecutivos||0} fallos seguidos</span><span>Último éxito: ${formatDate(info.ultimo_exito)}</span>`;
      row.append(head,details); if (info.error) { const error=document.createElement('small'); error.textContent=info.error; row.append(error); } stores.append(row);
    }
    const manual=$('manualHealth'); manual.replaceChildren();
    const manualItems=[['Sin imagen',noImage,'products','no-image'],['Inactivos',inactive,'products','inactive'],['Total manual',products.length,'products','']];
    for (const [label,count,tab,filter] of manualItems) { const b=document.createElement('button');b.type='button';b.className='health-action';b.innerHTML=`<span>${label}</span><strong>${count}</strong>`;b.onclick=()=>{E.switchTab(tab);if(filter&&$('productQuickFilter')){$('productQuickFilter').value=filter;$('productQuickFilter').dispatchEvent(new Event('change'));}};manual.append(b); }
    const campaigns=$('campaignHealth'); campaigns.replaceChildren();
    for (const [label,count,filter] of [['Vencidas',expired,'expired'],['Programadas',scheduled,'scheduled'],['Total en pool',hero.length,'']]) { const b=document.createElement('button');b.type='button';b.className='health-action';b.innerHTML=`<span>${label}</span><strong>${count}</strong>`;b.onclick=()=>{E.switchTab('carousel');if(filter){const first=workingHero.find(c=>campaignScheduleState(c).key===filter);if(first) editCampaign(first.id);}};campaigns.append(b); }
  }

  function setupPersistentPreview() {
    const card=document.querySelector('.studio-preview-card'); if (!card) return;
    card.classList.add('studio-preview-dock'); document.body.append(card);
    const toolbar=card.querySelector('.preview-toolbar');
    if (toolbar && !$('previewDockToggle')) { const toggle=document.createElement('button'); toggle.id='previewDockToggle'; toggle.type='button'; toggle.className='preview-size'; toggle.textContent='Ocultar'; toggle.onclick=()=>{card.classList.toggle('collapsed');toggle.textContent=card.classList.contains('collapsed')?'Mostrar':'Ocultar';}; toolbar.append(toggle); }
    syncPreviewVisibility();
  }
  function activeTab() { return document.querySelector('.tab.active')?.dataset.tab || ''; }
  function syncPreviewVisibility() { const card=document.querySelector('.studio-preview-dock'); if (!card) return; card.hidden=!STUDIO_TABS.has(activeTab()) || E.getState().mode!=='owner'; }

  function setupHexInputs() {
    for (const color of document.querySelectorAll('.color-grid input[type="color"]')) {
      if (color.dataset.hexReady) continue; color.dataset.hexReady='1';
      const hex=document.createElement('input'); hex.type='text'; hex.className='hex-input'; hex.maxLength=7; hex.setAttribute('aria-label',`Código hexadecimal para ${color.previousElementSibling?.textContent||'color'}`); color.insertAdjacentElement('afterend',hex);
      color.addEventListener('input',()=>{hex.value=color.value.toUpperCase();readAppearance();markDirty('appearance');sendPreview();});
      hex.addEventListener('input',()=>{let v=hex.value.trim();if(v&&!v.startsWith('#'))v='#'+v;if(/^#[0-9a-f]{6}$/i.test(v)){color.value=v;hex.classList.remove('invalid');readAppearance();markDirty('appearance');sendPreview();}else hex.classList.add('invalid');});
    }
    syncAllHexInputs();
  }
  function syncAllHexInputs() { for (const color of document.querySelectorAll('.color-grid input[type="color"]')) { const hex=color.nextElementSibling; if (hex?.classList.contains('hex-input')) { hex.value=color.value.toUpperCase(); hex.classList.remove('invalid'); } } }
  function applyPreset(name) {
    ensureConfig(); const preset=PRESETS[name]; if(!preset)return; workingConfig.appearance=workingConfig.appearance||{};
    Object.assign(workingConfig.appearance,{font:preset.font,density:preset.density,shadow:preset.shadow,radius:preset.radius});
    for(const mode of ['light','dark']) workingConfig.appearance[mode]={...(workingConfig.appearance[mode]||{}),...preset[mode]};
    fillAppearance(); markDirty('appearance'); sendPreview(); E.notify('Plantilla aplicada al borrador. Revisala y guardá cuando quieras.');
  }

  function updateSeoCounters() {
    for (const counter of document.querySelectorAll('[data-count-for]')) { const input=$(counter.dataset.countFor); if(!input)continue; const limit=Number(input.maxLength)||0; counter.textContent=`${input.value.length}${limit?` / ${limit}`:''}`; counter.classList.toggle('near-limit',limit>0&&input.value.length>limit*.85); }
  }

  function saveDraftNow() {
    if (!anyDirty() || !workingConfig) { if(!anyDirty()) localStorage.removeItem(DRAFT_KEY); return; }
    const payload={savedAt:new Date().toISOString(),revision:E.getState().revision,config:workingConfig,hero:workingHero,dirtySections:[...dirtySections],heroDirty};
    try { localStorage.setItem(DRAFT_KEY,JSON.stringify(payload)); } catch {}
  }
  function maybeOfferDraft() {
    if (initialized) return; initialized=true;
    let draft=null; try { draft=JSON.parse(localStorage.getItem(DRAFT_KEY)||'null'); } catch {}
    if (!draft || (!draft.dirtySections?.length && !draft.heroDirty)) return;
    const bar=document.createElement('div'); bar.className='draft-recovery'; bar.innerHTML=`<div><strong>Hay un borrador local sin guardar</strong><span>${draft.savedAt?`Guardado automáticamente ${formatDate(draft.savedAt)}`:'Podés recuperarlo antes de seguir.'}</span></div>`;
    const recover=document.createElement('button');recover.type='button';recover.className='button primary';recover.textContent='Recuperar borrador';
    const discard=document.createElement('button');discard.type='button';discard.className='button';discard.textContent='Descartar';
    recover.onclick=()=>{workingConfig=clone(draft.config||workingConfig);workingHero=clone(draft.hero||workingHero);dirtySections=new Set(draft.dirtySections||[]);heroDirty=!!draft.heroDirty;fillAll();updateDirtyUI();bar.remove();E.notify('Borrador recuperado. Revisá los cambios antes de guardar.');};
    discard.onclick=()=>{localStorage.removeItem(DRAFT_KEY);bar.remove();}; bar.append(recover,discard); document.body.append(bar);
  }

  function stateEvent(event) {
    const state=event.detail||{}; if(state.mode!=='owner')return; lastState=state;
    if ($('campaignCount')) $('campaignCount').textContent=Array.isArray(state.highlights?.hero)?state.highlights.hero.length:0;
    renderHealth(state);
    if (suppressStateOnce) { suppressStateOnce=false; savedConfig=clone(state.site_config||savedConfig||{}); savedHero=clone(state.highlights?.hero||savedHero||[]); return; }
    if (!anyDirty()) {
      savedConfig=clone(state.site_config||{});workingConfig=clone(savedConfig);savedHero=clone(state.highlights?.hero||[]);workingHero=clone(savedHero);fillAll();
    }
    maybeOfferDraft(); syncPreviewVisibility();
  }

  // Main form listeners
  $('appearanceForm')?.addEventListener('input',event=>{readAppearance();if(event.target.id==='siteRadius')$('radiusValue').textContent=`${event.target.value}px`;if(event.target.id==='lightOverlay')$('lightOverlayValue').textContent=`${event.target.value}%`;if(event.target.id==='darkOverlay')$('darkOverlayValue').textContent=`${event.target.value}%`;markDirty('appearance');sendPreview();});
  $('pageForm')?.addEventListener('input',()=>{readPage();updateSeoCounters();markDirty('page');sendPreview();});
  $('saveAppearance')?.addEventListener('click',()=>saveConfigSection('appearance','Diseño guardado. Los cambios pendientes de Página/Carrusel no se guardaron.'));
  $('savePageConfig')?.addEventListener('click',()=>saveConfigSection('page','Página guardada. Los cambios pendientes de Diseño/Carrusel no se guardaron.'));
  $('saveCampaigns')?.addEventListener('click',saveCarousel);
  $('refreshHealth')?.addEventListener('click',()=>document.getElementById('reloadState')?.click());

  $('lightBgFile')?.addEventListener('change',()=>uploadFile('lightBgFile','lightBgImage').catch(e=>E.notify(e.message,true)));
  $('darkBgFile')?.addEventListener('change',()=>uploadFile('darkBgFile','darkBgImage').catch(e=>E.notify(e.message,true)));
  $('campaignImageFile')?.addEventListener('change',()=>uploadFile('campaignImageFile','campaignImage').catch(e=>E.notify(e.message,true)));
  $('campaignImage')?.addEventListener('input',updateCampaignImagePreview);
  $('campaignSponsored')?.addEventListener('change',()=>{if($('campaignSponsorBadge'))$('campaignSponsorBadge').textContent=$('campaignSponsored').checked?'Patrocinado':'Editorial';});
  $('campaignForm')?.addEventListener('input',()=>{markDirty('hero');});
  $('campaignForm')?.addEventListener('submit',event=>{event.preventDefault();E.clearFieldErrors?.($('campaignForm'));const c=campaignFromForm();if(!c.title.es&&!c.title['pt-BR']){E.setFieldError?.($('campaignTitleEs'),'Escribí al menos un título.');return E.notify('Revisá los campos marcados.',true);}if(c.href&&!/^https?:\/\//i.test(c.href)){E.setFieldError?.($('campaignHref'),'Usá una URL http:// o https://');return E.notify('El enlace del banner no es válido.',true);}const i=workingHero.findIndex(x=>x.id===c.id);if(i>=0)workingHero[i]=c;else workingHero.push(c);selectedCampaignId=c.id;markDirty('hero');renderCampaignList();editCampaign(c.id);sendPreview();E.notify('Banner aplicado al borrador. Falta guardar el carrusel.');});
  $('newCampaign')?.addEventListener('click',()=>{selectedCampaignId='';editCampaign('');$('campaignTitleEs').focus();});
  $('duplicateCampaign')?.addEventListener('click',()=>{const base=campaignById(selectedCampaignId);if(!base)return;const copy=clone(base);copy.id=`${base.id}-copia-${Date.now().toString(36)}`;copy.title=copy.title||{};copy.title.es=`${copy.title.es||'Banner'} · copia`;workingHero.push(copy);selectedCampaignId=copy.id;markDirty('hero');renderCampaignList();editCampaign(copy.id);sendPreview();});
  $('deleteCampaign')?.addEventListener('click',async()=>{if(!selectedCampaignId)return;const item=campaignById(selectedCampaignId);const ok=await (E.confirmDialog?.({title:'Eliminar banner',message:`Se eliminará “${item?.title?.es||item?.id}” del borrador del carrusel.`,confirmText:'Eliminar',danger:true}) ?? Promise.resolve(confirm('¿Eliminar este banner del borrador?')));if(!ok)return;workingHero=workingHero.filter(c=>c.id!==selectedCampaignId);selectedCampaignId=workingHero[0]?.id||'';markDirty('hero');renderCampaignList();editCampaign(selectedCampaignId);sendPreview();});
  for(const id of ['campaignVisibleCount','campaignAutoplay','campaignSeconds']) $(id)?.addEventListener('input',()=>{readCarouselSettings();markDirty('carousel');sendPreview();});
  for(const preset of document.querySelectorAll('[data-preset]')) preset.addEventListener('click',()=>applyPreset(preset.dataset.preset));
  for(const b of document.querySelectorAll('.preview-size')) b.addEventListener('click',()=>{document.querySelectorAll('.preview-size').forEach(x=>x.classList.toggle('active',x===b));$('studioPreview').style.width=b.dataset.previewWidth;});
  $('studioPreview')?.addEventListener('load',()=>setTimeout(sendPreview,400));
  document.querySelectorAll('.tab').forEach(tab=>tab.addEventListener('click',()=>setTimeout(syncPreviewVisibility,0)));

  setupHexInputs(); setupPersistentPreview(); updateSeoCounters();
  setInterval(saveDraftNow,2500);
  window.addEventListener('beforeunload',saveDraftNow);
  window.addEventListener('rivfree-editor-state',stateEvent);

  // Expose active-tab save for Ctrl/Cmd+S in editor.js.
  window.RivFreeStudio = {
    saveActive: async tab => {
      if(tab==='appearance') return saveConfigSection('appearance','Diseño guardado.');
      if(tab==='page') return saveConfigSection('page','Página guardada.');
      if(tab==='carousel') return saveCarousel();
    },
    renderHealth:()=>renderHealth(lastState||E.getState()),
    sendPreview,
    discardWorking:()=>{dirtySections.clear();heroDirty=false;workingConfig=null;workingHero=[];selectedCampaignId='';localStorage.removeItem(DRAFT_KEY);updateDirtyUI();}
  };

  setTimeout(()=>{const state=E.getState();if(state?.site_config)stateEvent({detail:state});},50);
})();
