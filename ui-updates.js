(() => {
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
 const isEs=()=>String(document.getElementById('languageToggle')?.value||document.documentElement.lang||'').startsWith('es');

 /* Language picker: flags of Uruguay (español) and Brazil (português) in a themed menu.
    The native <select> stays in the page (hidden) because the rest of the site listens to it. */
 const select=document.getElementById('languageToggle');
 if(select){
  const LANGS={es:{flag:'icons/flag-uy.svg',code:'ES',name:'Español',region:'Uruguay'},'pt-BR':{flag:'icons/flag-br.svg',code:'PT',name:'Português',region:'Brasil'}};
  const info=value=>LANGS[String(value).startsWith('es')?'es':'pt-BR'];
  const picker=el('div',null,'rf-language rf-lang-picker');
  const button=el('button',null,'rf-lang-button');button.type='button';button.id='languagePickerButton';
  button.setAttribute('aria-haspopup','listbox');button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls','languagePickerList');
  const flag=el('img',null,'rf-lang-flag');flag.alt='';flag.width=24;flag.height=17;
  const code=el('span',null,'rf-lang-code');const chevron=el('span',null,'rf-lang-chevron');chevron.setAttribute('aria-hidden','true');
  button.append(flag,code,chevron);
  const list=el('ul',null,'rf-lang-menu');list.id='languagePickerList';list.setAttribute('role','listbox');list.tabIndex=-1;list.hidden=true;
  const items=[...select.options].map(option=>{
   const data=info(option.value),item=el('li',null,'rf-lang-option');item.setAttribute('role','option');item.id='language-option-'+data.code.toLowerCase();item.dataset.value=option.value;
   const img=el('img',null,'rf-lang-flag');img.src=data.flag;img.alt='';img.width=24;img.height=17;
   const text=el('span',null,'rf-lang-text');text.append(el('strong',data.name),el('small',data.region));
   const check=el('span','✓','rf-lang-check');check.setAttribute('aria-hidden','true');
   item.append(img,text,check);
   item.addEventListener('mousedown',e=>e.preventDefault());
   item.addEventListener('click',()=>choose(option.value));
   list.append(item);return item;
  });
  select.before(picker);picker.append(button,list,select);
  select.classList.add('rf-lang-native');select.tabIndex=-1;select.setAttribute('aria-hidden','true');
  let active=0;
  function sync(){
   const data=info(select.value);flag.src=data.flag;code.textContent=data.code;
   const label=(isEs()?'Idioma: ':'Idioma: ')+data.name+' · '+data.region;button.setAttribute('aria-label',label);button.title=label;
   list.setAttribute('aria-label',isEs()?'Elegí el idioma':'Escolha o idioma');
   items.forEach((item,i)=>{const selected=item.dataset.value===select.value;item.setAttribute('aria-selected',String(selected));if(selected&&list.hidden)active=i;});
  }
  function highlight(i){active=(i+items.length)%items.length;items.forEach((item,j)=>item.classList.toggle('active',j===active));list.setAttribute('aria-activedescendant',items[active].id);items[active].scrollIntoView?.({block:'nearest'});}
  function open(){if(!list.hidden)return;sync();list.hidden=false;button.setAttribute('aria-expanded','true');picker.classList.add('open');highlight(active);list.focus({preventScroll:true});}
  function close(focus=true){if(list.hidden)return;list.hidden=true;button.setAttribute('aria-expanded','false');picker.classList.remove('open');if(focus)button.focus({preventScroll:true});}
  function choose(value){close();if(select.value===value)return;select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));sync();}
  button.addEventListener('click',()=>list.hidden?open():close());
  button.addEventListener('keydown',e=>{if(['ArrowDown','ArrowUp','Enter',' '].includes(e.key)){e.preventDefault();open();}});
  list.addEventListener('keydown',e=>{
   if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();highlight(active+(e.key==='ArrowDown'?1:-1));}
   else if(e.key==='Home'||e.key==='End'){e.preventDefault();highlight(e.key==='Home'?0:items.length-1);}
   else if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(items[active].dataset.value);}
   else if(e.key==='Escape'){e.preventDefault();close();}
   else if(e.key==='Tab')close(false);
  });
  document.addEventListener('pointerdown',e=>{if(!picker.contains(e.target))close(false);});
  select.addEventListener('change',sync);
  new MutationObserver(sync).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  sync();
 }

 /* Top notice: RivFree compares prices only. Hidden for 30 days after it is closed; texts come from Studio. */
 const notice=document.getElementById('siteDisclaimer');
 let noticeClosed=false;
 if(notice){
  const key='rivfree-disclaimer-closed',days=30;
  let closedAt=0;try{closedAt=Number(localStorage.getItem(key))||0;}catch{}
  noticeClosed=Date.now()-closedAt<days*86400000;if(noticeClosed)notice.hidden=true;
  document.getElementById('siteDisclaimerClose')?.addEventListener('click',()=>{noticeClosed=true;notice.hidden=true;try{localStorage.setItem(key,String(Date.now()));}catch{}document.querySelector('.brand-link')?.focus({preventScroll:true});});
 }
 function applyNotice(config){
  if(!notice)return;const c=config?.top_notice;if(!c)return;
  const preview=new URLSearchParams(location.search).has('studio-preview');
  notice.hidden=c.enabled===false||(noticeClosed&&!preview);
  const lang=isEs()?'es':'pt',set=(selector,value)=>{const el=notice.querySelector(selector);if(el&&value)el.textContent=value;};
  set('strong.rf-d-long',c['title_'+lang]);set('span.rf-d-long',c['text_'+lang]);
  const short=notice.querySelector('.rf-d-short'),shortText=c['short_'+lang];
  if(short&&shortText){const cut=shortText.indexOf(':');short.replaceChildren();if(cut>0&&cut<60){short.append(el('strong',shortText.slice(0,cut+1)),' '+shortText.slice(cut+1).trim());}else short.textContent=shortText;}
 }

 /* Site social networks (header, above the search bar, and footer). Without a link the icon is shown as "coming soon". */
 const NETWORKS=[['instagram','Instagram'],['facebook','Facebook'],['tiktok','TikTok'],['whatsapp','WhatsApp'],['youtube','YouTube'],['x','X'],['telegram','Telegram']];
 function safeLink(value){try{const u=new URL(String(value||''));return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}}
 function applySocial(config){
  const social=config?.social;if(!social)return;
  for(const box of document.querySelectorAll('.rf-social')){
   box.replaceChildren();
   for(const [id,label] of NETWORKS){
    const item=social[id]||{},url=safeLink(item.url);
    if(!item.visible||(!url&&social.show_without_link===false))continue;
    const link=el(url?'a':'span',null,'rf-social-link rf-social-'+id+(url?'':' is-pending'));
    const icon=el('span',null,'rf-app-icon rf-app-'+id);icon.setAttribute('aria-hidden','true');link.append(icon);
    if(url){link.href=url;link.target='_blank';link.rel='noopener noreferrer me';link.setAttribute('aria-label','RivFree en '+label);link.title=label;}
    else{const soon=isEs()?'próximamente':'em breve';link.setAttribute('role','img');link.setAttribute('aria-label',label+' · '+soon);link.title=label+' · '+soon;}
    box.append(link);
   }
   box.hidden=!box.childElementCount;
  }
 }
 function applyExtras(event){const config=event?.detail||window.RIVFREE_SITE_CONFIG;applyNotice(config);applySocial(config);}
 document.addEventListener('rivfree-site-config-applied',applyExtras);
 select?.addEventListener('change',()=>setTimeout(applyExtras,0));
 if(window.RIVFREE_SITE_CONFIG)applyExtras();

 for(const selector of ['#searchForm','#searchSuggestions','#popularProducts','#basedOnSearches','#shoppingDialog','#historyDialog'])document.querySelector(selector)?.setAttribute('data-clarity-mask','true');
})();
