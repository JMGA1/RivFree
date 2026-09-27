(() => {
  'use strict';

  const BUILD = '20260927-studio-custom3';
  const E = window.RivFreeEditor;
  if (!E) return;
  window.RIVFREE_STUDIO_JS_BUILD = BUILD;
  if (window.RIVFREE_STUDIO_HTML_BUILD && window.RIVFREE_STUDIO_HTML_BUILD !== BUILD) {
    const u = new URL(location.href); u.searchParams.set('studio-sync', Date.now()); location.replace(u.href); return;
  }
  const $ = id => document.getElementById(id);
  const clone = value => JSON.parse(JSON.stringify(value ?? {}));
  const sectionLabels = {
    hero: 'Carrusel principal', benefits: 'Pasos 01 · 02 · 03', discover: 'Por descubrir',
    popular: 'Más consultados', catalog: 'Catálogo y filtros'
  };
  const DRAFT_KEY = 'rivfree-studio-draft-v3';
  const STUDIO_TABS = new Set(['appearance', 'carousel', 'page']);

  const NATIVE_PALETTE = {
    light:{background:'#F5F6F8',surface:'#FFFFFF',text:'#172337',primary:'#AD233C',accent:'#E94E67',highlight:'#FFB5B9'},
    dark:{background:'#101B2B',surface:'#19283C',text:'#F1F5FB',primary:'#AD233C',accent:'#E94E67',highlight:'#FFB5B9'}
  };

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
  let previewTheme = 'light';
  let previewLanguage = 'es';
  let previewWidth = 1280;
  let previewRevision = 0;
  let previewTimer;
  let previewAckTimer;
  let saving = false;

  const PRESETS = {
    rivfree: {
      font: 'system-modern', density: 'comfortable', shadow: 'soft', radius: 12,
      light: {background:'#F5F6F8',surface:'#FFFFFF',text:'#172337',primary:'#AD233C',accent:'#E94E67',highlight:'#FFB5B9'},
      dark: {background:'#101B2B',surface:'#19283C',text:'#F1F5FB',primary:'#AD233C',accent:'#E94E67',highlight:'#FFB5B9'}
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


  const CAMPAIGN_PALETTES = {
    rose:{light:{background:'#EFD4DA',text:'#30212A',accent:'#9F2942',button:'#9F2942',button_text:'#FFFFFF'},dark:{background:'#38232E',text:'#F8EDF0',accent:'#FF91A6',button:'#FF91A6',button_text:'#151515'}},
    blue:{light:{background:'#D8E5F3',text:'#192D45',accent:'#245F93',button:'#245F93',button_text:'#FFFFFF'},dark:{background:'#192C45',text:'#ECF4FF',accent:'#85BAFF',button:'#85BAFF',button_text:'#152234'}},
    sand:{light:{background:'#EADCC3',text:'#463725',accent:'#76511B',button:'#76511B',button_text:'#FFFFFF'},dark:{background:'#322B21',text:'#F8F0DE',accent:'#E8C578',button:'#E8C578',button_text:'#2A2218'}},
    mint:{light:{background:'#D7E7DD',text:'#203C30',accent:'#2E6B51',button:'#2E6B51',button_text:'#FFFFFF'},dark:{background:'#1C332C',text:'#ECFAF3',accent:'#85D4AD',button:'#85D4AD',button_text:'#183026'}},
    plum:{light:{background:'#EADCF0',text:'#392844',accent:'#74438A',button:'#74438A',button_text:'#FFFFFF'},dark:{background:'#30223A',text:'#F5ECF8',accent:'#D3A0EB',button:'#D3A0EB',button_text:'#261B2E'}},
    graphite:{light:{background:'#DFE3E8',text:'#232A32',accent:'#3F4A58',button:'#3F4A58',button_text:'#FFFFFF'},dark:{background:'#22272E',text:'#F1F4F7',accent:'#AEB9C8',button:'#AEB9C8',button_text:'#1D2329'}},
    amber:{light:{background:'#F2DFB7',text:'#4B381D',accent:'#8A5B12',button:'#8A5B12',button_text:'#FFFFFF'},dark:{background:'#342918',text:'#FFF4DC',accent:'#F0C36D',button:'#F0C36D',button_text:'#2A2115'}},
    ocean:{light:{background:'#D7E9ED',text:'#173D49',accent:'#247287',button:'#247287',button_text:'#FFFFFF'},dark:{background:'#17313A',text:'#EDFAFD',accent:'#78C8DB',button:'#78C8DB',button_text:'#142A32'}},
    forest:{light:{background:'#D8E7D7',text:'#243D27',accent:'#376B3D',button:'#376B3D',button_text:'#FFFFFF'},dark:{background:'#1C3120',text:'#EFF9F0',accent:'#8BD095',button:'#8BD095',button_text:'#18301C'}}
  };
  const modeName = mode => mode === 'dark' ? 'Modo oscuro' : 'Modo claro';
  const languageName = language => language === 'pt-BR' ? 'Português' : 'Español';
  function campaignPalette(theme, mode) { return clone((CAMPAIGN_PALETTES[theme]||CAMPAIGN_PALETTES.rose)[mode]||CAMPAIGN_PALETTES.rose[mode]); }
  function rgbLuminance(hex){const c=String(hex||'').replace('#','');if(!/^[0-9a-f]{6}$/i.test(c))return 0;const a=[0,2,4].map(i=>parseInt(c.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return a[0]*.2126+a[1]*.7152+a[2]*.0722;}
  function contrastRatio(a,b){const l1=rgbLuminance(a),l2=rgbLuminance(b);return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);}
  function paletteContrast(){
    const rows=[];
    for(const mode of ['light','dark']){
      const palette=workingConfig?.appearance?.[mode];if(!palette)continue;
      for(const [label,front,back,min,critical] of [['Texto / fondo','text','background',4.5,true],['Texto / tarjetas','text','surface',4.5,true],['Color principal / tarjetas','primary','surface',3,false],['Acento / tarjetas','accent','surface',3,false]]){
        const ratio=contrastRatio(palette[front],palette[back]);rows.push({label:modeName(mode)+' · '+label,ratio,min,critical});
      }
      for(const key of ['primary','accent'])rows.push({label:modeName(mode)+' · Texto automático de botón '+key,ratio:contrastRatio(autoTextColor(palette[key]),palette[key]),min:4.5,critical:false});
    }
    const hint=$('paletteContrast');if(hint){hint.replaceChildren();for(const row of rows){const line=document.createElement('p');line.textContent=`${row.ratio>=row.min?'✓':'⚠'} ${row.label}: ${row.ratio.toFixed(2)}:1 · ${row.ratio>=row.min?'legible':'revisar'} (objetivo ${row.min}:1)`;line.className=row.ratio<row.min?'contrast-warning':'';hint.append(line);}if(workingConfig?.appearance?.light?.background_image||workingConfig?.appearance?.dark?.background_image){const p=document.createElement('p');p.textContent='Hay una imagen de fondo: el contraste varía según la zona. Revisá también la vista previa.';hint.append(p);}}
    return rows;
  }
  function autoTextColor(background){return contrastRatio(background,'#FFFFFF')>=contrastRatio(background,'#000000')?'#FFFFFF':'#000000';}

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
    if (!anyDirty()) { try { localStorage.removeItem(DRAFT_KEY); } catch {} }
    updateSelectionFeedback();
  }
  function getColor(id, fallback) {
    const value = $(id)?.value || '';
    return /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : fallback;
  }

  function updateAppearanceModeHint() {
    const hint=$('appearanceModeHint'); if(!hint||!workingConfig)return;
    hint.textContent=workingConfig.appearance?.colors_customized===true
      ? 'Paleta personalizada activa: estos colores sobrescriben los colores nativos del sitio.'
      : 'Colores nativos de RivFree activos. El sitio conserva su diseño original hasta que edites un color o elijas una plantilla.';
  }

  function fillAppearance() {
    ensureConfig();
    const c=workingConfig, a=c.appearance||{}, light=a.light||{}, dark=a.dark||{}, b=c.branding||{};
    val('siteName', b.site_name || 'RivFree'); val('taglineEs', b.tagline_es || ''); val('taglinePt', b.tagline_pt || '');
    val('siteFont', a.font || 'system-modern'); val('siteDensity', a.density || 'comfortable'); val('siteShadow', a.shadow || 'soft');
    val('siteRadius', a.radius ?? 12); if ($('radiusValue')) $('radiusValue').textContent = `${a.radius ?? 12}px`;
    for (const [prefix,palette] of [['light',light],['dark',dark]]) {
      const defaults = prefix === 'light'
        ? {Background:'#F5F6F8',Surface:'#FFFFFF',Text:'#172337',Primary:'#AD233C',Accent:'#E94E67',Highlight:'#FFB5B9'}
        : {Background:'#101B2B',Surface:'#19283C',Text:'#F1F5FB',Primary:'#AD233C',Accent:'#E94E67',Highlight:'#FFB5B9'};
      for (const key of ['Background','Surface','Text','Primary','Accent','Highlight']) {
        val(prefix+key, palette[key.toLowerCase()] || defaults[key]);
      }
      val(prefix+'BgImage', palette.background_image || '');
      val(prefix+'Overlay', Math.round((Number(palette.background_overlay)||0)*100));
      if ($(prefix+'OverlayValue')) $(prefix+'OverlayValue').textContent = `${Math.round((Number(palette.background_overlay)||0)*100)}%`;
    }
    syncAllHexInputs();
    updateSelectionFeedback();
    updateAppearanceModeHint();
  }

  function readAppearance() {
    ensureConfig();
    workingConfig.branding = {
      site_name: $('siteName').value.trim() || 'RivFree',
      tagline_es: $('taglineEs').value.trim(), tagline_pt: $('taglinePt').value.trim()
    };
    workingConfig.appearance = workingConfig.appearance || {};
    const keepCustomized = workingConfig.appearance.colors_customized === true;
    Object.assign(workingConfig.appearance, {
      font:$('siteFont').value, density:$('siteDensity').value, shadow:$('siteShadow').value,
      radius:Number($('siteRadius').value)||0, colors_customized:keepCustomized
    });
    for (const prefix of ['light','dark']) {
      workingConfig.appearance[prefix] = {
        background:getColor(prefix+'Background', prefix==='light'?'#F5F6F8':'#101B2B'),
        surface:getColor(prefix+'Surface', prefix==='light'?'#FFFFFF':'#19283C'),
        text:getColor(prefix+'Text', prefix==='light'?'#172337':'#F1F5FB'),
        primary:getColor(prefix+'Primary', '#AD233C'),
        accent:getColor(prefix+'Accent', '#E94E67'),
        highlight:getColor(prefix+'Highlight', '#FFB5B9'),
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

  function campaignDefaults() { const theme='rose'; return {id:'',poolGroup:'general',theme,layout:'split',enabled:true,sponsored:false,eyebrow:{es:'','pt-BR':''},title:{es:'Nuevo banner','pt-BR':'Novo banner'},description:{es:'','pt-BR':''},cta:{es:'Explorar','pt-BR':'Explorar'},category:'',href:'',image:'',starts_at:'',ends_at:'',colors:{light:campaignPalette(theme,'light'),dark:campaignPalette(theme,'dark')}}; }
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
    const root=$('campaignList'); if (!root) return; const previousScroll=root.scrollTop; root.replaceChildren();
    workingHero.forEach((c,index)=>{
      const schedule=campaignScheduleState(c);
      const row=document.createElement('div'); row.className='list-item campaign-list-item'+(c.id===selectedCampaignId?' selected':''); row.dataset.id=c.id;
      const body=document.createElement('button'); body.type='button'; body.className='campaign-list-main'; body.onclick=()=>{const top=root.scrollTop;editCampaign(c.id);root.scrollTop=top;};
      const title=document.createElement('strong'); title.textContent=c.title?.[previewLanguage]||c.title?.es||c.title?.['pt-BR']||c.id;
      const meta=document.createElement('small'); meta.textContent=`#${index+1} · ${c.sponsored?'Patrocinado · ':''}${c.poolGroup||'general'} · `;
      const state=document.createElement('span'); state.className=`schedule-pill ${schedule.key}`; state.textContent=schedule.label; meta.append(state);
      body.append(title,meta);
      const controls=document.createElement('span'); controls.className='campaign-reorder';
      for (const [symbol,delta,labelText] of [['↑',-1,'Subir'],['↓',1,'Bajar']]) {
        const b=document.createElement('button'); b.type='button'; b.className='mini-button'; b.textContent=symbol; b.setAttribute('aria-label',`${labelText} banner ${title.textContent}`);
        b.disabled=(delta<0&&index===0)||(delta>0&&index===workingHero.length-1);
        b.onclick=e=>{e.stopPropagation();const top=root.scrollTop,target=index+delta;[workingHero[index],workingHero[target]]=[workingHero[target],workingHero[index]];markDirty('hero');renderCampaignList();root.scrollTop=top;sendPreview();};
        controls.append(b);
      }
      row.append(body,controls); root.append(row);
    });
    if (!workingHero.length) { const d=document.createElement('div'); d.className='empty-list'; d.innerHTML='<strong>No hay banners.</strong><span>Creá el primero con “Nuevo banner”.</span>'; root.append(d); }
    root.scrollTop=previousScroll;
  }
  function toLocalDate(value) {
    if (!value) return '';
    const d=new Date(value); if (Number.isNaN(d.getTime())) return String(value).slice(0,16);
    const pad=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function fillCampaignColors(c) {
    const theme=c.theme||'rose';
    for(const mode of ['light','dark']){
      const src={...campaignPalette(theme,mode),...(c.colors?.[mode]||{})};
      const prefix='campaign'+(mode==='light'?'Light':'Dark');
      val(prefix+'Background',src.background);val(prefix+'Text',src.text);val(prefix+'Accent',src.accent);val(prefix+'Button',src.button);val(prefix+'ButtonText',src.button_text);
    }
    syncAllHexInputs(); updateCampaignContrast();
  }
  function readCampaignColors(){
    const out={};
    for(const mode of ['light','dark']){
      const prefix='campaign'+(mode==='light'?'Light':'Dark');
      const preset=campaignPalette($('campaignTheme')?.value||'rose',mode);
      out[mode]={background:getColor(prefix+'Background',preset.background),text:getColor(prefix+'Text',preset.text),accent:getColor(prefix+'Accent',preset.accent),button:getColor(prefix+'Button',preset.button),button_text:getColor(prefix+'ButtonText',preset.button_text)};
    }
    return out;
  }
  function applyCampaignPalette(theme){
    for(const mode of ['light','dark']){
      const p=campaignPalette(theme,mode),prefix='campaign'+(mode==='light'?'Light':'Dark');
      val(prefix+'Background',p.background);val(prefix+'Text',p.text);val(prefix+'Accent',p.accent);val(prefix+'Button',p.button);val(prefix+'ButtonText',p.button_text);
    }
    syncAllHexInputs();updateCampaignContrast();
  }
  function updateCampaignContrast(){
    const mode=previewTheme==='dark'?'dark':'light',prefix='campaign'+(mode==='light'?'Light':'Dark');
    const bg=$(prefix+'Button')?.value||'#000000',text=$(prefix+'ButtonText')?.value||'#FFFFFF',ratio=contrastRatio(bg,text),hint=$('campaignContrastHint');
    if(hint){hint.textContent=`Contraste del botón: ${ratio.toFixed(1)}:1 · ${ratio>=4.5?'bueno':'conviene ajustarlo'}`;hint.classList.toggle('contrast-warning',ratio<4.5);}
  }

  function editCampaign(id) {
    ensureConfig(); const c=campaignById(id)||campaignDefaults(); selectedCampaignId=c.id||'';
    val('campaignId',c.id||''); val('campaignGroup',c.poolGroup||'general'); val('campaignTheme',c.theme||'rose'); val('campaignLayout',c.layout||'split'); val('campaignSmart',c.smartType||'');
    chk('campaignEnabled',c.enabled!==false); chk('campaignSponsored',!!c.sponsored); val('campaignEyebrowEs',c.eyebrow?.es); val('campaignEyebrowPt',c.eyebrow?.['pt-BR']); val('campaignTitleEs',c.title?.es); val('campaignTitlePt',c.title?.['pt-BR']); val('campaignDescriptionEs',c.description?.es); val('campaignDescriptionPt',c.description?.['pt-BR']); val('campaignCtaEs',c.cta?.es); val('campaignCtaPt',c.cta?.['pt-BR']); val('campaignCategory',c.category); val('campaignHref',c.href); val('campaignStart',toLocalDate(c.starts_at)); val('campaignEnd',toLocalDate(c.ends_at)); val('campaignImage',c.image||c.images?.[0]?.src||'');
    fillCampaignColors(c);
    if ($('campaignFormTitle')) $('campaignFormTitle').textContent=selectedCampaignId?(c.title?.[previewLanguage]||c.title?.es||c.title?.['pt-BR']||'Editar banner'):'Nuevo banner';
    if ($('campaignSponsorBadge')) $('campaignSponsorBadge').textContent=c.sponsored?'Patrocinado':'Editorial';
    if($('campaignEditStatus')){const index=workingHero.findIndex(x=>x.id===selectedCampaignId);$('campaignEditStatus').textContent=selectedCampaignId?`Banner ${index+1} de ${workingHero.length} · ${campaignScheduleState(c).label}`:'Nuevo banner todavía no guardado';}
    updateCampaignImagePreview(); renderCampaignList(); syncEditingContext(); sendPreview();
  }
  function slug(value) { return String(value||'banner').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70)||`banner-${Date.now()}`; }
  function campaignFromForm() {
    const existing=campaignById(selectedCampaignId)||{}; const id=selectedCampaignId||`${slug($('campaignTitleEs').value||$('campaignTitlePt').value)}-${Date.now().toString(36)}`;
    const out={...existing,id,poolGroup:$('campaignGroup').value,theme:$('campaignTheme').value,layout:$('campaignLayout').value,smartType:$('campaignSmart').value||undefined,enabled:$('campaignEnabled').checked,sponsored:$('campaignSponsored').checked,eyebrow:{es:$('campaignEyebrowEs').value.trim(),'pt-BR':$('campaignEyebrowPt').value.trim()},title:{es:$('campaignTitleEs').value.trim(),'pt-BR':$('campaignTitlePt').value.trim()},description:{es:$('campaignDescriptionEs').value.trim(),'pt-BR':$('campaignDescriptionPt').value.trim()},cta:{es:$('campaignCtaEs').value.trim(),'pt-BR':$('campaignCtaPt').value.trim()},category:$('campaignCategory').value.trim(),href:$('campaignHref').value.trim(),image:$('campaignImage').value.trim(),starts_at:$('campaignStart').value?new Date($('campaignStart').value).toISOString():undefined,ends_at:$('campaignEnd').value?new Date($('campaignEnd').value).toISOString():undefined,colors:readCampaignColors()};
    if (out.layout==='banner' && out.image || out.image !== (existing.image || existing.images?.[0]?.src || '')) delete out.images;
    else if (!existing.image && existing.images?.length) { delete out.image; out.images=clone(existing.images); }
    return out;
  }
  function updateCampaignImagePreview() {
    const root=$('campaignImagePreview'); if (!root) return; const src=$('campaignImage').value.trim(); root.replaceChildren();
    if (!src) { const span=document.createElement('span');span.textContent='Sin imagen';root.append(span);return; }
    const img=document.createElement('img');try{const url=new URL(src,location.origin+'/');if(!['http:','https:'].includes(url.protocol))throw new Error();img.src=url.href;}catch{root.textContent='URL de imagen inválida';return;}img.alt='Vista previa del banner';img.onerror=()=>{root.textContent='No se pudo cargar la imagen. Revisá su ruta o URL.';};root.append(img);
  }
  function fillCarouselSettings() {
    ensureConfig(); const c=workingConfig.carousel||{}; val('campaignVisibleCount',c.visible_count??5); chk('campaignAutoplay',c.autoplay!==false); val('campaignSeconds',c.autoplay_seconds??6); val('campaignTransition',c.transition||'smooth'); val('campaignTransitionSpeed',String(c.transition_ms??500));
    if($('campaignTransitionSpeed'))$('campaignTransitionSpeed').disabled=$('campaignTransition')?.value==='static';
    renderCampaignList(); if (selectedCampaignId&&campaignById(selectedCampaignId)) editCampaign(selectedCampaignId); else if (workingHero[0]) editCampaign(workingHero[0].id); else editCampaign('');
  }
  function readCarouselSettings() { ensureConfig(); workingConfig.carousel={visible_count:Number($('campaignVisibleCount').value)||5,autoplay:$('campaignAutoplay').checked,autoplay_seconds:Number($('campaignSeconds').value)||6,transition:$('campaignTransition')?.value==='static'?'static':'smooth',transition_ms:Number($('campaignTransitionSpeed')?.value)||500}; return workingConfig; }

  function sendPreview() {
    if (!workingConfig) return;
    updateSelectionFeedback();
    clearTimeout(previewTimer);
    previewTimer=setTimeout(deliverPreview,80);
  }
  function deliverPreview() {
    const frame=$('studioPreview'); if (!frame) return;
    // Always read the visible carousel controls at preview time. Select elements
    // may emit input/change in a different order across browsers and JSDOM;
    // the preview must reflect exactly what the user currently sees.
    if (activeTab()==='carousel' && $('campaignTransition')) readCarouselSettings();
    const revision=++previewRevision;
    val('previewTheme',previewTheme);val('previewLanguage',previewLanguage);
    let heroForPreview=workingHero;
    let previewSelectedId=activeTab()==='carousel'?selectedCampaignId:'';
    // Read the visible campaign form at send time too. This removes timing races
    // between a user's keystroke, the draft synchronizer and the preview debounce.
    if(activeTab()==='carousel' && $('campaignForm') && selectedCampaignId) {
      try {
        const current=campaignFromForm();
        heroForPreview=clone(workingHero);
        const index=heroForPreview.findIndex(x=>x.id===current.id);
        if(index<0) heroForPreview.push(current); else heroForPreview[index]=current;
        previewSelectedId=current.id;
      } catch {}
    }
    const selected=previewSelectedId?(heroForPreview.find(x=>x.id===previewSelectedId)||null):null;
    if($('previewContext'))$('previewContext').textContent=selected?`Editando: ${selected.title?.[previewLanguage]||selected.title?.es||'Sin título'} · ${campaignScheduleState(selected).label}. ${selected.smartType?'El contenido inteligente se genera desde el catálogo.':'Este banner permanece fijo mientras editás.'}`:'Página completa · la vista previa no publica cambios.';
    if ($('previewStatus')) $('previewStatus').textContent='Actualizando vista previa…';
    try {
      frame.contentWindow?.postMessage({type:'rivfree-studio-preview',config:workingConfig,theme:previewTheme,language:previewLanguage},location.origin);
      frame.contentWindow?.postMessage({type:'rivfree-studio-campaigns-preview',hero:heroForPreview,selectedId:previewSelectedId,revision},location.origin);
      clearTimeout(previewAckTimer);
      previewAckTimer=setTimeout(()=>{if($('previewStatus'))$('previewStatus').textContent='La vista previa no respondió. Usá Recargar vista.';},5000);
    } catch {}
  }

  function syncCampaignDraft() {
    if (!workingConfig) return;
    const c=campaignFromForm(), index=workingHero.findIndex(x=>x.id===c.id);
    if(index<0) workingHero.push(c); else workingHero[index]=c;
    selectedCampaignId=c.id; val('campaignId',c.id);$('campaignFormTitle').textContent=c.title.es||c.title['pt-BR']||'Banner sin título';
    markDirty('hero'); renderCampaignList(); sendPreview();
  }
  function updateSelectionFeedback() {
    paletteContrast();
    const a=workingConfig?.appearance;
    if(!a)return;
    let matched=false;
    document.querySelectorAll('[data-preset]').forEach(button=>{
      const preset=PRESETS[button.dataset.preset];
      const selected=['font','density','shadow','radius'].every(k=>a[k]===preset[k]) && ['light','dark'].every(mode=>Object.keys(preset[mode]).every(k=>String(a[mode]?.[k]).toUpperCase()===preset[mode][k].toUpperCase()));
      button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));matched ||= selected;
    });
    if($('presetStatus'))$('presetStatus').textContent=matched?'✓ Plantilla seleccionada. Podés seguir ajustándola.':'Diseño personalizado · tus ajustes siguen activos.';
    for(const section of ['appearance','page','carousel']) {
      const pending=dirtySections.has(section)||(section==='carousel'&&heroDirty);
      const status=$(`${section}Feedback`);
      if(status)status.textContent=pending?'● Cambios en el borrador · falta guardar esta sección':'✓ Esta sección está guardada en los archivos locales';
    }
  }

  async function uploadFile(inputId,targetId) {
    const input=$(inputId), file=input?.files?.[0]; if (!file) return;
    const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('No se pudo leer la imagen'));reader.readAsDataURL(file);});
    const out=await E.api('/api/manual/upload-image',{filename:file.name,data}); $(targetId).value=out.path;
    if (targetId==='campaignImage') { updateCampaignImagePreview(); syncCampaignDraft(); }
    else { readAppearance(); markDirty('appearance'); }
    sendPreview(); E.notify('Imagen cargada. Guardá la sección para conservar su uso.');
  }

  function mergeSection(base, source, section) {
    const next=clone(base);
    if (section==='appearance') { next.branding=clone(source.branding||{}); next.appearance=clone(source.appearance||{}); }
    if (section==='page') { next.notice=clone(source.notice||{}); next.homepage=clone(source.homepage||{}); next.seo=clone(source.seo||{}); next.footer=clone(source.footer||{}); }
    if (section==='carousel') next.carousel=clone(source.carousel||{});
    return next;
  }
  function discardConfigSection(section){
    ensureConfig(); workingConfig=mergeSection(workingConfig,savedConfig||{},section); markDirty(section,false);
    if(section==='appearance')fillAppearance();else if(section==='page')fillPage();
    saveDraftNow();syncEditingContext();sendPreview();E.notify(section==='appearance'?'Cambios de Diseño descartados.':'Cambios de Página descartados.');
  }
  function refreshHeroDirty(){markDirty('hero',JSON.stringify(workingHero)!==JSON.stringify(savedHero));}
  function discardSelectedCampaign(){
    ensureConfig(); if(!selectedCampaignId){editCampaign('');return;}
    const saved=savedHero.find(c=>c.id===selectedCampaignId),index=workingHero.findIndex(c=>c.id===selectedCampaignId);
    if(saved){if(index>=0)workingHero[index]=clone(saved);else workingHero.push(clone(saved));}
    else if(index>=0)workingHero.splice(index,1);
    const nextId=saved?.id||workingHero[Math.max(0,index-1)]?.id||workingHero[0]?.id||'';selectedCampaignId=nextId;refreshHeroDirty();renderCampaignList();editCampaign(nextId);saveDraftNow();E.notify('Cambios de este banner descartados.');
  }
  function discardCarouselChanges(){
    ensureConfig();workingConfig=mergeSection(workingConfig,savedConfig||{},'carousel');workingHero=clone(savedHero);dirtySections.delete('carousel');heroDirty=false;selectedCampaignId=workingHero[0]?.id||'';fillCarouselSettings();updateDirtyUI();saveDraftNow();sendPreview();E.notify('Cambios pendientes del carrusel descartados.');
  }

  async function saveConfigSection(section, message) {
    ensureConfig();
    if(section==='appearance' && document.querySelector('.hex-input.invalid')) { E.notify('Corregí el color hexadecimal marcado antes de guardar.',true); return false; }
    if (section==='appearance') readAppearance(); else if (section==='page') readPage(); else if (section==='carousel') readCarouselSettings();
    if(section==='appearance'&&workingConfig.appearance?.colors_customized&&paletteContrast().some(row=>row.critical&&row.ratio<row.min)){E.notify('El texto no alcanza contraste 4.5:1 en ambos modos. Ajustá los colores o usá Corregir texto antes de guardar.',true);return false;}
    try {
      const toSave=mergeSection(savedConfig||{},workingConfig,section);
      const response=await E.api('/api/manual/save-site-config',{config:toSave});
      suppressStateOnce=true; E.applyState(response);
      savedConfig=clone(response.site_config||toSave);
      // Keep unsaved work from other sections, but adopt normalized saved values for this section.
      const normalized=mergeSection(workingConfig,savedConfig,section); workingConfig=normalized;
      markDirty(section,false); E.notify(message); saveDraftNow(); sendPreview(); return true;
    } catch (error) { E.notify(error.message,true); return false; }
  }

  async function saveCarousel() {
    if(saving)return;
    readCarouselSettings();
    // Capture the form synchronously before validating/saving so Ctrl+S or a
    // fast click on Guardar cannot miss the last typed character.
    if(selectedCampaignId && $('campaignForm')) syncCampaignDraft();
    if (!validateCampaigns()) return;
    saving=true; $('saveCampaigns').disabled=true;
    try {
      if (dirtySections.has('carousel') && !await saveConfigSection('carousel','Ajustes del carrusel guardados.')) return;
      if (heroDirty) {
        const response=await E.api('/api/manual/save-highlights',{hero:workingHero});
        suppressStateOnce=true; E.applyState(response); savedHero=clone(response.highlights?.hero||workingHero); workingHero=clone(savedHero); markDirty('hero',false);
      }
      fillCarouselSettings(); renderHealth(E.getState()); E.notify('Carrusel guardado.');
      saveDraftNow(); sendPreview();
    } catch (error) { E.notify(error.message,true); }
    finally { saving=false; $('saveCampaigns').disabled=false; }
  }

  function validateCampaigns() {
    E.clearFieldErrors?.($('campaignForm'));
    const invalidHex=$('campaignForm')?.querySelector('.hex-input.invalid');if(invalidHex){invalidHex.focus();E.notify('Corregí el color hexadecimal marcado antes de guardar el carrusel.',true);return false;}
    for(const c of workingHero) {
      let field='', message='';
      if(!c.title?.es && !c.title?.['pt-BR']) {field='campaignTitleEs';message='Escribí al menos un título.';}
      else if(c.href && !/^https?:\/\//i.test(c.href)) {field='campaignHref';message='Usá una URL http:// o https://';}
      else if(c.starts_at && c.ends_at && new Date(c.ends_at)<=new Date(c.starts_at)) {field='campaignEnd';message='El fin debe ser posterior al inicio.';}
      if(field) {editCampaign(c.id);E.setFieldError?.($(field),message);$(field).focus();E.notify(message,true);return false;}
    }
    return true;
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

  function syncEditingContext() {
    const theme=previewTheme==='dark'?'dark':'light',language=previewLanguage==='pt-BR'?'pt-BR':'es';
    for(const id of ['previewTheme','appearanceEditTheme','campaignEditTheme'])val(id,theme);
    for(const id of ['previewLanguage','appearanceEditLanguage','campaignEditLanguage'])val(id,language);
    document.querySelectorAll('[data-studio-theme]').forEach(el=>el.hidden=el.dataset.studioTheme!==theme);
    document.querySelectorAll('[data-studio-lang]').forEach(el=>el.hidden=el.dataset.studioLang!==language);
    const label=`${modeName(theme)} · ${languageName(language)}`;
    if($('appearanceContextText'))$('appearanceContextText').textContent=label;
    if($('campaignContextText'))$('campaignContextText').textContent=label;
    const selected=selectedCampaignId?campaignById(selectedCampaignId):null;if(selected&&$('campaignFormTitle'))$('campaignFormTitle').textContent=selected.title?.[language]||selected.title?.es||selected.title?.['pt-BR']||'Editar banner';
    if($('activeEditHint'))$('activeEditHint').textContent=`Editando: Diseño · ${label}`;
    updateCampaignContrast();
  }
  function setEditingTheme(value){previewTheme=value==='dark'?'dark':'light';syncEditingContext();sendPreview();}
  function setEditingLanguage(value){previewLanguage=value==='pt-BR'?'pt-BR':'es';syncEditingContext();renderCampaignList();sendPreview();}

  function setupPersistentPreview() {
    const card=document.querySelector('.studio-preview-card'); if (!card) return;
    card.classList.add('studio-preview-dock'); document.body.append(card);
    const toolbar=card.querySelector('.preview-toolbar');
    toolbar.innerHTML=`<strong>Vista previa en vivo</strong><div class="preview-actions"><button type="button" id="previewExpand" class="preview-size" aria-pressed="false">Ampliar vista</button><button type="button" id="previewReload" class="preview-size">Recargar vista</button><button type="button" id="previewDockToggle" class="preview-size" aria-expanded="true">Ocultar</button></div>`;
    const controls=document.createElement('div');controls.className='preview-controls';
    controls.innerHTML=`<label>Dispositivo<select id="previewDevice"><option value="1280">Escritorio · 1280 px</option><option value="768">Tablet · 768 px</option><option value="390">Celular · 390 px</option></select></label><label>Tema<select id="previewTheme"><option value="light">Claro</option><option value="dark">Oscuro</option></select></label><label>Idioma<select id="previewLanguage"><option value="es">Español</option><option value="pt-BR">Português</option></select></label><label>Ir a<select id="previewTarget"><option value="top">Inicio</option><option value="heroCampaign">Banner</option><option value="catalogSection">Catálogo</option><option value="footer">Pie de página</option></select></label>`;
    toolbar.after(controls);
    const status=document.createElement('p');status.id='previewStatus';status.className='preview-status';status.setAttribute('role','status');status.textContent='Cargando vista previa…';controls.after(status);
    const context=document.createElement('p');context.id='previewContext';context.className='preview-context';status.after(context);
    const stage=card.querySelector('.preview-stage'), canvas=document.createElement('div');canvas.className='preview-canvas';stage.append(canvas);canvas.append($('studioPreview'));
    $('previewDevice').onchange=()=>{previewWidth=Number($('previewDevice').value);resizePreview();};
    $('previewTheme').onchange=()=>setEditingTheme($('previewTheme').value);
    $('previewLanguage').onchange=()=>setEditingLanguage($('previewLanguage').value);
    $('previewTarget').onchange=()=>navigatePreview($('previewTarget').value);
    $('previewReload').onclick=()=>{$('studioPreview').src='/?studio-preview=1&reload='+Date.now();};
    $('previewDockToggle').onclick=()=>{if(card.classList.contains('expanded'))setPreviewExpanded(false);const collapsed=card.classList.toggle('collapsed');document.body.classList.toggle('preview-collapsed',collapsed);$('previewDockToggle').textContent=collapsed?'Mostrar vista':'Ocultar';$('previewDockToggle').setAttribute('aria-expanded',String(!collapsed));resizePreview();};
    $('previewExpand').onclick=()=>setPreviewExpanded(!card.classList.contains('expanded'));
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&card.classList.contains('expanded'))$('previewExpand').click();});
    if(window.ResizeObserver)new ResizeObserver(resizePreview).observe(stage);
    window.addEventListener('resize',resizePreview);
    syncPreviewVisibility();
  }
  function setPreviewExpanded(expanded) {
    const card=document.querySelector('.studio-preview-dock');
    card.classList.toggle('expanded',expanded);card.classList.remove('collapsed');document.body.classList.remove('preview-collapsed');
    document.querySelectorAll('body > .shell, body > .topbar').forEach(el=>el.inert=expanded);
    $('previewDockToggle').textContent='Ocultar';$('previewDockToggle').setAttribute('aria-expanded','true');
    $('previewExpand').textContent=expanded?'Volver al editor':'Ampliar vista';$('previewExpand').setAttribute('aria-pressed',String(expanded));
    resizePreview();
  }
  function resizePreview() {
    const stage=document.querySelector('.preview-stage'),frame=$('studioPreview');if(!stage||!frame)return;
    const width=Math.max(280,stage.clientWidth-24), height=Math.max(400,stage.clientHeight-24),scale=Math.min(1,width/previewWidth);
    frame.style.width=`${previewWidth}px`;frame.style.height=`${height/scale}px`;frame.style.transform=`scale(${scale})`;
    const canvas=stage.querySelector('.preview-canvas');if(canvas){canvas.style.width=`${previewWidth*scale}px`;canvas.style.height=`${height}px`;}
  }
  function navigatePreview(target) { $('studioPreview')?.contentWindow?.postMessage({type:'rivfree-studio-navigate',target},location.origin); }
  function activeTab() { return document.querySelector('.tab.active')?.dataset.tab || ''; }
  function syncPreviewVisibility() { const card=document.querySelector('.studio-preview-dock'); if (!card) return; card.hidden=!STUDIO_TABS.has(activeTab()) || E.getState().mode!=='owner';document.body.classList.toggle('studio-active',!card.hidden);if(card.hidden&&card.classList.contains('expanded'))setPreviewExpanded(false);resizePreview();sendPreview(); }

  function setupHexInputs() {
    for (const color of document.querySelectorAll('.color-grid input[type="color"]')) {
      if (color.dataset.hexReady) continue; color.dataset.hexReady='1';
      const hex=document.createElement('input'); hex.type='text'; hex.className='hex-input'; hex.maxLength=7; hex.setAttribute('aria-label',`Código hexadecimal para ${color.previousElementSibling?.textContent||'color'}`); color.insertAdjacentElement('afterend',hex);
      const error=document.createElement('small');error.className='field-error';error.id=`${color.id}Error`;error.hidden=true;error.textContent='Usá 6 dígitos: #12AB34. Se conserva el último color válido.';hex.after(error);hex.setAttribute('aria-describedby',error.id);
      color.addEventListener('input',()=>{hex.value=color.value.toUpperCase();hex.classList.remove('invalid');hex.setAttribute('aria-invalid','false');error.hidden=true;});
      hex.addEventListener('input',event=>{event.stopPropagation();let v=hex.value.trim();if(v&&!v.startsWith('#'))v='#'+v;const valid=/^#[0-9a-f]{6}$/i.test(v);hex.classList.toggle('invalid',!valid);hex.setAttribute('aria-invalid',String(!valid));error.hidden=valid;if(valid){color.value=v;color.dispatchEvent(new Event('input',{bubbles:true}));}});
    }
    syncAllHexInputs();
  }
  function syncAllHexInputs() { for (const color of document.querySelectorAll('.color-grid input[type="color"]')) { const hex=color.nextElementSibling; if (hex?.classList.contains('hex-input')) { hex.value=color.value.toUpperCase(); hex.classList.remove('invalid'); } } }
  function applyPreset(name) {
    ensureConfig(); const preset=PRESETS[name]; if(!preset)return; workingConfig.appearance=workingConfig.appearance||{};
    Object.assign(workingConfig.appearance,{font:preset.font,density:preset.density,shadow:preset.shadow,radius:preset.radius,colors_customized:true});
    for(const mode of ['light','dark']) workingConfig.appearance[mode]={...(workingConfig.appearance[mode]||{}),...preset[mode]};
    fillAppearance(); markDirty('appearance'); sendPreview(); E.notify('Plantilla aplicada al borrador. Revisala y guardá cuando quieras.');
  }

  function setupGuidance() {
    const help={siteFont:'Cambia la letra de títulos, textos y botones de todo el sitio.',siteDensity:'Ajusta el espacio interior de tarjetas y secciones: compacto muestra más contenido; amplio deja más aire.',siteShadow:'Cambia la profundidad de las tarjetas y del buscador.',siteRadius:'0 px crea esquinas rectas; 32 px las hace muy redondeadas.',lightBgImage:'Fondo general del modo claro. Podés pegar una URL o subir una imagen.',darkBgImage:'Fondo general del modo oscuro, independiente del modo claro.',lightOverlay:'Agrega blanco sobre la imagen para aclararla. Solo tiene efecto si hay imagen de fondo.',darkOverlay:'Agrega negro sobre la imagen para oscurecerla. Solo tiene efecto si hay imagen de fondo.',campaignGroup:'Agrupa campañas para que la selección pública incluya temas variados; no cambia su diseño.',campaignTheme:'Elegí una paleta sugerida. Después podés personalizar Fondo, Texto, Acento y Botón con cualquier HEX.',campaignLayout:'Texto + producto separa el contenido. Imagen completa muestra solo la imagen, oculta los textos y hace clicable todo el banner; sin imagen conserva el diseño dividido.',campaignSmart:'Las opciones inteligentes reemplazan título, descripción y botón con datos del catálogo. Elegí Ninguna para usar tus textos.',campaignEnabled:'Permite mostrar el banner al público si también está dentro de sus fechas. Aquí podés previsualizarlo aunque esté inactivo.',campaignSponsored:'Muestra la etiqueta Publicidad y marca el enlace externo como patrocinado.',campaignVisibleCount:'Cantidad máxima de campañas elegidas en cada carga pública. El editor fija el banner que estás editando.',campaignAutoplay:'Avanza automáticamente en el sitio. Se pausa en el editor para que puedas revisar cada cambio.',campaignSeconds:'Tiempo entre avances cuando la reproducción automática está activa.',campaignTransition:'Animado suave hace una entrada progresiva entre banners. Estático cambia inmediatamente.',campaignTransitionSpeed:'Velocidad de la animación cuando el cambio suave está activo.',campaignCategory:'Categoría a abrir al pulsar el botón, salvo que indiques un enlace externo.',campaignHref:'Si lo completás, el botón abre este enlace en lugar de filtrar por categoría.',campaignStart:'Fecha y hora de esta computadora. Vacío: disponible desde ahora.',campaignEnd:'Fecha y hora de esta computadora. Vacío: sin vencimiento.',seoTitleEs:'Título de la pestaña y de los buscadores; no cambia el encabezado visible.',seoTitlePt:'Título de la pestaña y de los buscadores en portugués.',seoDescriptionEs:'Descripción para buscadores y redes; no aparece como texto de la página.',seoDescriptionPt:'Descripción para buscadores y redes en portugués.',seoSocialImage:'Imagen para compartir el enlace en redes. No cambia los banners.',noticeDismissible:'Permite que el visitante cierre el aviso de disponibilidad.',footerPrivacy:'Muestra u oculta el enlace a la política de privacidad en el pie.'};
    const colors={Background:'Fondo general de la página.',Surface:'Fondo de tarjetas y buscador.',Text:'Texto principal del sitio.',Primary:'Color principal de controles, enlaces y botones de producto.',Accent:'Color de acento de la marca y elementos destacados.',Highlight:'Color de énfasis en detalles de la cabecera.'};
    for(const mode of ['light','dark'])for(const [key,description] of Object.entries(colors))help[mode+key]=description+' La vista cambia a este modo al editar.';
    for(const [id,description] of Object.entries(help)){const input=$(id);if(!input)continue;const note=document.createElement('small');note.className='option-help';note.id=id+'Help';note.textContent=description;input.closest('label')?.append(note);input.setAttribute('aria-describedby',note.id);}
    const presetStatus=document.createElement('p');presetStatus.id='presetStatus';presetStatus.className='selection-feedback';$('stylePresets').after(presetStatus);
    for(const section of ['appearance','carousel','page']){const heading=document.querySelector(`[data-panel="${section}"] .panel-heading`);const row=document.createElement('div');row.className='section-feedback';const status=document.createElement('span');status.id=section+'Feedback';status.setAttribute('role','status');const jump=document.createElement('button');jump.type='button';jump.className='preview-size';jump.textContent='Ver cambios en grande';jump.onclick=()=>{const card=document.querySelector('.studio-preview-dock');if(!card.classList.contains('expanded'))$('previewExpand').click();$('previewExpand').focus();};row.append(status,jump);heading.after(row);}
    $('campaignForm').querySelector('[type="submit"]').textContent='Revisar banner';
    $('campaignForm').querySelector('.form-actions').insertAdjacentHTML('beforebegin','<p class="form-help">Los cambios se aplican al borrador mientras editás. Guardar Carrusel los escribe en los archivos locales.</p>');
    $('appearanceForm').addEventListener('submit',event=>event.preventDefault());$('pageForm').addEventListener('submit',event=>event.preventDefault());
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
  $('appearanceForm')?.addEventListener('input',event=>{ensureConfig();const colorIds=/^(light|dark)(Background|Surface|Text|Primary|Accent|Highlight)$/;if(colorIds.test(event.target.id))workingConfig.appearance.colors_customized=true;readAppearance();if(event.target.id==='siteRadius')$('radiusValue').textContent=`${event.target.value}px`;if(event.target.id==='lightOverlay')$('lightOverlayValue').textContent=`${event.target.value}%`;if(event.target.id==='darkOverlay')$('darkOverlayValue').textContent=`${event.target.value}%`;markDirty('appearance');sendPreview();});
  $('pageForm')?.addEventListener('input',event=>{readPage();updateSeoCounters();markDirty('page');sendPreview();});
  $('saveAppearance')?.addEventListener('click',()=>saveConfigSection('appearance','Diseño guardado. Los cambios pendientes de Página/Carrusel no se guardaron.'));
  $('savePageConfig')?.addEventListener('click',()=>saveConfigSection('page','Página guardada. Los cambios pendientes de Diseño/Carrusel no se guardaron.'));
  $('saveCampaigns')?.addEventListener('click',saveCarousel);
  $('refreshHealth')?.addEventListener('click',()=>document.getElementById('reloadState')?.click());

  $('lightBgFile')?.addEventListener('change',()=>uploadFile('lightBgFile','lightBgImage').catch(e=>E.notify(e.message,true)));
  $('darkBgFile')?.addEventListener('change',()=>uploadFile('darkBgFile','darkBgImage').catch(e=>E.notify(e.message,true)));
  $('campaignImageFile')?.addEventListener('change',()=>uploadFile('campaignImageFile','campaignImage').catch(e=>E.notify(e.message,true)));
  $('campaignImage')?.addEventListener('input',updateCampaignImagePreview);
  $('campaignSponsored')?.addEventListener('change',()=>{if($('campaignSponsorBadge'))$('campaignSponsorBadge').textContent=$('campaignSponsored').checked?'Patrocinado':'Editorial';});
  $('campaignForm')?.addEventListener('input',event=>{if(event.target.type==='file'||event.target.classList?.contains('hex-input'))return;syncCampaignDraft();updateCampaignContrast();});
  $('campaignForm')?.addEventListener('submit',event=>{event.preventDefault();if(!selectedCampaignId)syncCampaignDraft();if(validateCampaigns()){sendPreview();navigatePreview('heroCampaign');E.notify('Banner revisado. Guardar Carrusel conserva todos los cambios.');}});
  $('newCampaign')?.addEventListener('click',()=>{selectedCampaignId='';editCampaign('');$('campaignTitleEs').focus();});
  $('duplicateCampaign')?.addEventListener('click',()=>{const base=campaignById(selectedCampaignId);if(!base)return;const copy=clone(base);copy.id=`${base.id}-copia-${Date.now().toString(36)}`;copy.title=copy.title||{};copy.title.es=`${copy.title.es||'Banner'} · copia`;workingHero.push(copy);selectedCampaignId=copy.id;markDirty('hero');renderCampaignList();editCampaign(copy.id);sendPreview();});
  $('deleteCampaign')?.addEventListener('click',async()=>{if(!selectedCampaignId)return;const item=campaignById(selectedCampaignId);const ok=await (E.confirmDialog?.({title:'Eliminar banner',message:`Se eliminará “${item?.title?.es||item?.id}” del borrador del carrusel.`,confirmText:'Eliminar',danger:true}) ?? Promise.resolve(confirm('¿Eliminar este banner del borrador?')));if(!ok)return;workingHero=workingHero.filter(c=>c.id!==selectedCampaignId);selectedCampaignId=workingHero[0]?.id||'';markDirty('hero');renderCampaignList();editCampaign(selectedCampaignId);sendPreview();});
  for(const id of ['campaignVisibleCount','campaignAutoplay','campaignSeconds','campaignTransition','campaignTransitionSpeed']) $(id)?.addEventListener('input',()=>{readCarouselSettings();markDirty('carousel');sendPreview();});
  $('appearanceEditTheme')?.addEventListener('change',()=>setEditingTheme($('appearanceEditTheme').value));
  $('appearanceEditLanguage')?.addEventListener('change',()=>setEditingLanguage($('appearanceEditLanguage').value));
  $('campaignEditTheme')?.addEventListener('change',()=>setEditingTheme($('campaignEditTheme').value));
  $('campaignEditLanguage')?.addEventListener('change',()=>setEditingLanguage($('campaignEditLanguage').value));
  $('campaignTheme')?.addEventListener('change',()=>{applyCampaignPalette($('campaignTheme').value);syncCampaignDraft();});
  $('campaignTransition')?.addEventListener('change',()=>{
    if($('campaignTransitionSpeed'))$('campaignTransitionSpeed').disabled=$('campaignTransition').value==='static';
    readCarouselSettings(); markDirty('carousel'); sendPreview();
  });
  $('campaignAutoContrast')?.addEventListener('click',()=>{const mode=previewTheme==='dark'?'dark':'light',prefix='campaign'+(mode==='light'?'Light':'Dark');const button=$(prefix+'Button'),text=$(prefix+'ButtonText');if(!button||!text)return;text.value=autoTextColor(button.value);text.dispatchEvent(new Event('input',{bubbles:true}));syncAllHexInputs();updateCampaignContrast();});
  $('discardAppearance')?.addEventListener('click',()=>discardConfigSection('appearance'));
  $('discardPage')?.addEventListener('click',()=>discardConfigSection('page'));
  $('discardCarousel')?.addEventListener('click',()=>discardCarouselChanges());
  $('discardCampaign')?.addEventListener('click',()=>discardSelectedCampaign());
  $('restoreNativeTheme')?.addEventListener('click',()=>{
    ensureConfig();
    workingConfig.appearance=workingConfig.appearance||{};
    workingConfig.appearance.colors_customized=false;
    for(const mode of ['light','dark']) workingConfig.appearance[mode]={...(workingConfig.appearance[mode]||{}),...clone(NATIVE_PALETTE[mode])};
    fillAppearance(); markDirty('appearance'); sendPreview();
    E.notify('Colores nativos restaurados en el borrador. Guardá Diseño para conservarlos.');
  });
  for(const preset of document.querySelectorAll('[data-preset]')) preset.addEventListener('click',()=>applyPreset(preset.dataset.preset));
  $('studioPreview')?.addEventListener('load',()=>{resizePreview();sendPreview();});
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin || event.source!==$('studioPreview')?.contentWindow)return;
    if(event.data?.type==='rivfree-studio-ready')sendPreview();
    if(event.data?.type==='rivfree-studio-applied' && event.data.revision===previewRevision){clearTimeout(previewAckTimer);$('previewStatus').textContent='✓ Vista actualizada · '+(anyDirty()?'borrador sin guardar':'archivos guardados');}
  });

  function setupEditingFeedback(){
    syncEditingContext();
    document.addEventListener('focusin',event=>{document.querySelectorAll('.editing-now').forEach(el=>el.classList.remove('editing-now'));const label=event.target.closest?.('label');if(label)label.classList.add('editing-now');const panel=event.target.closest?.('[data-panel]')?.dataset.panel;if(!panel)return;const field=label?.querySelector('span')?.textContent?.trim()||event.target.id||'campo';const text=`Editando: ${panel==='carousel'?'Carrusel':panel==='appearance'?'Diseño':'Página'} · ${modeName(previewTheme)} · ${languageName(previewLanguage)} · ${field}`;if(panel==='appearance'&&$('activeEditHint'))$('activeEditHint').textContent=text;if(panel==='carousel'&&$('campaignEditStatus')&&selectedCampaignId)$('campaignEditStatus').textContent=text;});
  }

  const paletteHelp=document.createElement('details');paletteHelp.className='palette-contrast';const paletteSummary=document.createElement('summary');paletteSummary.textContent='Legibilidad de la paleta general';const paletteReport=document.createElement('div');paletteReport.id='paletteContrast';paletteReport.setAttribute('aria-live','polite');const fixText=document.createElement('button');fixText.type='button';fixText.className='button';fixText.textContent='Corregir texto de ambos modos';fixText.onclick=()=>{readAppearance();for(const mode of ['light','dark']){const p=workingConfig.appearance[mode];const score=c=>Math.min(contrastRatio(c,p.background),contrastRatio(c,p.surface));p.text=score('#000000')>=score('#FFFFFF')?'#000000':'#FFFFFF';}workingConfig.appearance.colors_customized=true;fillAppearance();markDirty('appearance');sendPreview();paletteHelp.open=true;};paletteHelp.append(paletteSummary,paletteReport,fixText);$('appearanceForm').append(paletteHelp);
  $('appearanceForm').addEventListener('input',()=>{readAppearance();const rows=paletteContrast();paletteHelp.open=rows.some(r=>r.critical&&r.ratio<r.min);});
  setupHexInputs(); setupPersistentPreview(); setupGuidance(); setupEditingFeedback(); updateSeoCounters();
  setInterval(saveDraftNow,2500);
  window.addEventListener('beforeunload',saveDraftNow);
  window.addEventListener('rivfree-editor-state',stateEvent);
  window.addEventListener('rivfree-tab-change',syncPreviewVisibility);

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

  try { localStorage.removeItem('rivfree-studio-draft-v2'); } catch {}
  E.ready?.then(state=>stateEvent({detail:state})).catch?.(()=>{});
  // Fallback initialization only. Do not replay the initial server state after
  // Studio has already initialized: that late replay could overwrite controls
  // the user changed during the first quarter-second (for example changing the
  // carousel transition to Static and seeing it jump back to Smooth).
  setTimeout(()=>{
    if (initialized) return;
    const state=E.getState();
    if(state?.site_config) stateEvent({detail:state});
  },250);
})();
