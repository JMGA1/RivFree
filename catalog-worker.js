/* Phone layout: one compact bar (menu · RivFree · search · Mi lista) and a side menu with everything else:
   categories (families, brands and types), offers, stores, today's dollar, language, theme and social links.
   Icons: Lucide (ISC, see LICENSE-lucide.txt). Desktop keeps its own header; these controls only show on phones. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const topbar=document.querySelector('.topbar-inner');
 if(!topbar||$('mobileMenu'))return;
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
 const isEs=()=>String($('languageToggle')?.value||document.documentElement.lang||'').startsWith('es');
 const t=(es,pt)=>isEs()?es:pt;
 const reduced=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 const ICONS={
  settings:'<path d="M12.22 2h-.44a2 2 0 0 0-2 1.72l-.12.89a2 2 0 0 1-1.18 1.52l-.2.09a2 2 0 0 1-1.9-.18l-.73-.54a2 2 0 0 0-2.63.38l-.22.38a2 2 0 0 0 .63 2.5l.71.55a2 2 0 0 1 .72 1.76v.22a2 2 0 0 1-.72 1.76l-.71.55a2 2 0 0 0-.63 2.5l.22.38a2 2 0 0 0 2.63.38l.73-.54a2 2 0 0 1 1.9-.18l.2.09a2 2 0 0 1 1.18 1.52l.12.89a2 2 0 0 0 2 1.72h.44a2 2 0 0 0 2-1.72l.12-.89a2 2 0 0 1 1.18-1.52l.2-.09a2 2 0 0 1 1.9.18l.73.54a2 2 0 0 0 2.63-.38l.22-.38a2 2 0 0 0-.63-2.5l-.71-.55a2 2 0 0 1-.72-1.76v-.22a2 2 0 0 1 .72-1.76l.71-.55a2 2 0 0 0 .63-2.5l-.22-.38a2 2 0 0 0-2.63-.38l-.73.54a2 2 0 0 1-1.9.18l-.2-.09a2 2 0 0 1-1.18-1.52l-.12-.89A2 2 0 0 0 12.22 2Z"/><circle cx="12" cy="11" r="3"/>',
  menu:'<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>',
  search:'<circle cx="11" cy="11" r="7.5"/><path d="m20.5 20.5-4.2-4.2"/>',
  close:'<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  back:'<path d="m15 18-6-6 6-6"/>',
  next:'<path d="m9 18 6-6-6-6"/>',
  heart:'<path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/>',
  offers:'<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m15 9-6 6"/><path d="M9 9h.01"/><path d="M15 15h.01"/>',
  store:'<path d="M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5"/><path d="M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244"/><path d="M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05"/>',
  dollar:'<circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/>',
  grid:'<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  moon:'<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>'
 };
 function icon(name,cls='rf-m-svg'){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');svg.setAttribute('class',cls);svg.innerHTML=ICONS[name];return svg;}
 function iconButton(name,cls){const b=el('button',null,'rf-m-icon rf-m-only '+cls);b.type='button';b.append(icon(name));return b;}

 // ── Compact bar ──────────────────────────────────────────────────────────
 const menuButton=iconButton('menu','rf-m-menu');menuButton.id='mobileMenuButton';
 menuButton.setAttribute('aria-controls','mobileMenu');menuButton.setAttribute('aria-expanded','false');
 const searchButton=iconButton('search','rf-m-search');searchButton.id='mobileSearchButton';searchButton.setAttribute('aria-controls','searchForm');
 const listButton=iconButton('heart','rf-m-list');listButton.id='mobileListButton';
 const listBadge=el('span',null,'rf-m-count');listBadge.hidden=true;listButton.append(listBadge);
 const settingsButton=iconButton('settings','rf-m-settings');settingsButton.id='mobileSettingsButton';settingsButton.setAttribute('aria-controls','mobileMenu');settingsButton.setAttribute('aria-expanded','false');
 const actions=el('div',null,'rf-m-actions');actions.append(searchButton,listButton);
 topbar.prepend(menuButton);topbar.append(settingsButton,actions);

 // Search opens under the bar. While search results are shown it stays open so the search can be refined;
 // the button closes it in any case.
 let searchMode='auto';
 const searching=()=>typeof ACTIVE_SEARCH!=='undefined'&&!!String(ACTIVE_SEARCH).trim()&&location.hash.startsWith('#/buscar');
 function syncSearch(focus=false){
  const open=searchMode==='open'||(searchMode==='auto'&&searching());
  document.body.classList.toggle('rf-m-search-open',open);
  searchButton.replaceChildren(icon(open?'close':'search'));
  searchButton.setAttribute('aria-expanded',String(open));
  searchButton.setAttribute('aria-label',open?t('Cerrar búsqueda','Fechar busca'):t('Buscar productos','Buscar produtos'));
  if(open&&focus)$('search')?.focus({preventScroll:true});
 }
 searchButton.addEventListener('click',()=>{
  const open=document.body.classList.contains('rf-m-search-open');
  searchMode=open?'closed':'open';syncSearch(!open);
 });
 $('searchForm')?.addEventListener('submit',()=>{searchMode='auto';$('search')?.blur();setTimeout(()=>syncSearch(),0);});
 window.addEventListener('hashchange',()=>{searchMode='auto';syncSearch();});
 // A search runs asynchronously: show the bar again once its results are on screen.
 if(typeof runSearch==='function'){const prior=runSearch;runSearch=async function(...args){const result=await prior.apply(this,args);syncSearch();return result;};}

 listButton.addEventListener('click',()=>$('openShoppingList')?.click());
 const listSource=$('listCount');
 function syncList(){
  const n=Number(listSource?.textContent)||0;listBadge.textContent=String(n);listBadge.hidden=!n;
  listButton.setAttribute('aria-label',t('Mi lista','Minha lista')+(n?' · '+n:''));
  const tile=drawer.querySelector('[data-m="list"] .rf-m-tile-count');if(tile){tile.textContent=String(n);tile.hidden=!n;}
 }
 menuButton.setAttribute('aria-label',t('Abrir menú','Abrir menu'));

 // ── Side menu ────────────────────────────────────────────────────────────
 const overlay=el('div',null,'rf-m-overlay');overlay.hidden=true;
 const drawer=el('aside',null,'rf-m-drawer');drawer.id='mobileMenu';drawer.hidden=true;drawer.tabIndex=-1;
 drawer.setAttribute('role','dialog');drawer.setAttribute('aria-modal','true');
 document.body.append(overlay,drawer);
 let view='main',lastFocus=null,closeTimer=0,pollTimer=0;

 function open(nextView='main'){
  clearTimeout(closeTimer);clearTimeout(pollTimer);view=nextView;render();
  lastFocus=document.activeElement;drawer.hidden=false;overlay.hidden=false;
  requestAnimationFrame(()=>document.body.classList.add('rf-m-drawer-open'));
  menuButton.setAttribute('aria-expanded',String(view!=='settings'));settingsButton.setAttribute('aria-expanded',String(view==='settings'));
  drawer.querySelector('.rf-m-close')?.focus({preventScroll:true});
 }
 function close(restore=true){
  if(drawer.hidden)return;
  document.body.classList.remove('rf-m-drawer-open');menuButton.setAttribute('aria-expanded','false');settingsButton.setAttribute('aria-expanded','false');
  clearTimeout(pollTimer);
  closeTimer=setTimeout(()=>{drawer.hidden=true;overlay.hidden=true;},reduced()?0:220);
  if(restore)lastFocus?.focus?.({preventScroll:true});
 }
 function go(action){close(false);setTimeout(action,0);}
 menuButton.addEventListener('click',()=>drawer.hidden?open():close());
 settingsButton.addEventListener('click',()=>open('settings'));
 overlay.addEventListener('click',()=>close());
 drawer.addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();close();return;}
  if(e.key!=='Tab')return;
  const items=[...drawer.querySelectorAll('button,a[href],input,select')].filter(n=>!n.disabled&&n.offsetParent!==null);
  if(!items.length)return;const first=items[0],last=items.at(-1);
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
 });

 function row(label,{iconName,count,next,onClick,pressed}={}){
  const b=el('button',null,'rf-m-row');b.type='button';
  if(iconName)b.append(icon(iconName,'rf-m-row-icon'));
  b.append(el('span',label,'rf-m-row-label'));
  if(count)b.append(el('span',Number(count).toLocaleString(isEs()?'es-UY':'pt-BR'),'rf-m-row-count'));
  if(next)b.append(icon('next','rf-m-row-next'));
  if(pressed!==undefined)b.setAttribute('aria-pressed',String(pressed));
  b.addEventListener('click',onClick);return b;
 }
 function section(title){const box=el('section',null,'rf-m-section');if(title)box.append(el('h3',title,'rf-m-section-title'));return box;}
 function head(title,back){
  const bar=el('div',null,'rf-m-head');
  if(back){const b=el('button',null,'rf-m-back');b.type='button';b.append(icon('back'),el('span',t('Categorías','Categorias')));b.addEventListener('click',()=>{view='main';render();drawer.querySelector('.rf-m-back,.rf-m-close')?.focus();});bar.append(b);}
  else{const brand=el('span',null,'rf-m-brand');brand.append('Riv',el('span','Free','brand-name-free'));bar.append(brand);if(view!=='settings'){const social=$('footerSocial');if(social&&!social.hidden){const links=el('nav',null,'rf-m-head-social');links.setAttribute('aria-label',t('Redes sociales','Redes sociais'));links.append(...[...social.children].map(n=>n.cloneNode(true)));bar.append(links);}}}
  const x=el('button',null,'rf-m-close');x.type='button';x.setAttribute('aria-label',t('Cerrar menú','Fechar menu'));x.append(icon('close'));x.addEventListener('click',()=>close());
  bar.append(x);if(title)drawer.setAttribute('aria-label',title);return bar;
 }
 const explore=()=>window.RivFreeExplore;
 const counts=()=>explore()?.ready?.()?explore().facetCounts():null;
 const label=f=>explore()?.label?explore().label(f):(isEs()?f.es:f.pt);

 function renderMain(){
  drawer.append(head(t('Menú','Menu')));
  const tiles=el('div',null,'rf-m-tiles');
  const offersReady=!$('navOffers')?.disabled;
  for(const [key,name,text,action,disabled] of [
   ['offers','offers',t('Ofertas','Ofertas'),()=>go(()=>$('navOffers')?.click()),!offersReady],
   ['stores','store',t('Tiendas','Lojas'),()=>go(()=>{location.hash='#/tiendas';}),false],
   ['list','heart',t('Mi lista','Minha lista'),()=>go(()=>$('openShoppingList')?.click()),false]]){
   const b=el('button',null,'rf-m-tile');b.type='button';b.dataset.m=key;b.disabled=disabled;b.append(icon(name,'rf-m-tile-icon'),el('span',text));
   if(key==='list'){const c=el('span',null,'rf-m-tile-count');c.hidden=true;b.append(c);}
   b.addEventListener('click',action);tiles.append(b);
  }
  drawer.append(tiles);

  const categories=section(t('Categorías','Categorias'));
  categories.append(row(t('Todas las categorías','Todas as categorias'),{iconName:'grid',onClick:()=>go(()=>selectCampaignCategory(''))}));
  const families=explore()?.families?.()||[];const c=counts();
  if(families.length){
   for(const f of families){const n=c?c.get(f.id)||0:0;if(c&&!n)continue;categories.append(row(label(f),{count:n,next:true,onClick:()=>{view=f.id;render();drawer.querySelector('.rf-m-back')?.focus();}}));}
  }else if(typeof Catalog!=='undefined'){
   for(const [id,names] of Object.entries(Catalog.categories))categories.append(row(names[isEs()?0:1],{onClick:()=>go(()=>selectCampaignCategory(id))}));
  }
  drawer.append(categories);

 }

 function renderSettings(){
  drawer.append(head(t('Configuración','Configurações')));
  const heading=section();heading.append(el('h2',t('Configuración','Configurações'),'rf-m-family-title'));drawer.append(heading);
  if(window.RivFreeRates){
   const rates=section(t('Dólar hoy','Dólar hoje'));rates.classList.add('rf-m-rates');
   const box=el('div');window.RivFreeRates.render(box,()=>{render();drawer.querySelector('.rf-rate-row[aria-pressed=true]')?.focus();});rates.append(box);drawer.append(rates);
  }

  const prefs=section(t('Preferencias','Preferências'));
  const lang=el('div',null,'rf-m-segment');lang.setAttribute('role','group');lang.setAttribute('aria-label',t('Idioma','Idioma'));
  for(const [value,flag,name] of [['es','icons/flag-uy.svg','Español'],['pt-BR','icons/flag-br.svg','Português']]){
   const b=el('button',null,'rf-m-choice');b.type='button';b.setAttribute('aria-pressed',String((value==='es')===isEs()));
   const img=el('img',null,'rf-lang-flag');img.src=flag;img.alt='';img.width=22;img.height=16;b.append(img,el('span',name));
   b.addEventListener('click',()=>{const select=$('languageToggle');if(!select||select.value===value)return;select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));setTimeout(()=>{render();drawer.querySelector('.rf-m-segment [aria-pressed=true]')?.focus();},0);});
   lang.append(b);
  }
  const dark=document.documentElement.dataset.theme==='dark';
  const theme=el('div',null,'rf-m-segment');theme.setAttribute('role','group');theme.setAttribute('aria-label',t('Tema','Tema'));
  for(const [mode,iconName,name] of [['light','sun',t('Claro','Claro')],['dark','moon',t('Oscuro','Escuro')]]){
   const b=el('button',null,'rf-m-choice');b.type='button';b.setAttribute('aria-pressed',String((mode==='dark')===dark));b.append(icon(iconName,'rf-m-choice-icon'),el('span',name));
   b.addEventListener('click',()=>{if((document.documentElement.dataset.theme==='dark')!==(mode==='dark'))$('themeToggle')?.click();setTimeout(()=>{render();drawer.querySelector('[aria-label="Tema"] [aria-pressed=true]')?.focus();},0);});
   theme.append(b);
  }
  prefs.append(lang,theme);drawer.append(prefs);

 }

 function renderFamily(id){
  const families=explore()?.families?.()||[];const f=families.find(x=>x.id===id);
  if(!f){view='main';renderMain();return;}
  drawer.append(head(label(f),true));
  const box=section();box.append(el('h2',label(f),'rf-m-family-title'));
  const c=counts();
  const all=el('button',null,'rf-m-primary');all.type='button';all.textContent=t('Ver todo','Ver tudo')+(c?' · '+(c.get(f.id)||0).toLocaleString(isEs()?'es-UY':'pt-BR'):'');
  all.addEventListener('click',()=>go(()=>explore().activateFacet(f)));box.append(all);
  drawer.append(box);
  if(!c){
   box.append(el('p',t('Cargando marcas y tipos…','Carregando marcas e tipos…'),'rf-m-muted'));
   if(typeof PRODUCT_GROUPS!=='undefined'&&PRODUCT_GROUPS.length)explore()?.build?.();
   clearTimeout(pollTimer);pollTimer=setTimeout(function wait(){if(view!==id||drawer.hidden)return;if(counts()){render();return;}pollTimer=setTimeout(wait,300);},300);
   return;
  }
  for(const [title,items,limit] of [[t('Marcas','Marcas'),[...(f.brands||[]),...(f.dynamicBrands||[])],14],[t('Tipos','Tipos'),[...(f.types||[]),...(f.dynamicTypes||[])],10]]){
   const shown=items.filter(x=>(c.get(x.id)||0)>0).sort((a,b)=>c.get(b.id)-c.get(a.id)).slice(0,limit);
   if(!shown.length)continue;
   const group=section(title);const chips=el('div',null,'rf-m-chips');
   for(const item of shown){const b=el('button',null,'rf-m-chip');b.type='button';b.append(el('span',label(item)),el('small',(c.get(item.id)||0).toLocaleString(isEs()?'es-UY':'pt-BR')));b.addEventListener('click',()=>go(()=>explore().activateFacet(item)));chips.append(b);}
   group.append(chips);drawer.append(group);
  }
 }

 function render(){
  drawer.replaceChildren();
  if(view==='settings')renderSettings();else if(view==='main')renderMain();else renderFamily(view);
  drawer.scrollTop=0;syncList();
 }

 // Keep labels, counter and search state in sync with the rest of the site.
 if(listSource)new MutationObserver(syncList).observe(listSource,{childList:true,characterData:true,subtree:true});
 function syncSettingsLabel(){settingsButton.setAttribute('aria-label',t('Configuración','Configurações'));settingsButton.title=t('Configuración','Configurações');}
 $('languageToggle')?.addEventListener('change',()=>setTimeout(()=>{syncSettingsLabel();syncSearch();syncList();menuButton.setAttribute('aria-label',t('Abrir menú','Abrir menu'));if(!drawer.hidden)render();},0));
 window.addEventListener('rivfree:catalog-ready',()=>{syncSearch();if(!drawer.hidden)render();});
 const socialSource=$('footerSocial');if(socialSource)new MutationObserver(()=>{if(!drawer.hidden&&view==='main')render();}).observe(socialSource,{childList:true,subtree:true,attributes:true});
 // Leaving the phone width closes the menu so it never stays open behind the desktop header.
 window.matchMedia?.('(max-width: 650px)').addEventListener?.('change',e=>{if(!e.matches){close(false);searchMode='auto';syncSearch();}});
 syncSearch();syncList();syncSettingsLabel();
 window.RivFreeMobileMenu={open,close,render};
})();
