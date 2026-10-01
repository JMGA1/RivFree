/* Quick-access bar: today's dollar rate (with a currency picker) and the shopping list. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const t=(es,pt)=>LANG==='es'?es:pt;
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
 const button=$('navExchange'),value=$('navExchangeValue'),listButton=$('navList'),listCount=$('navListCount');
 if(!button||!value)return;

 const CURRENCIES={
  BRL:{flag:'icons/flag-br.svg',es:'Real brasileño',pt:'Real brasileiro'},
  UYU:{flag:'icons/flag-uy.svg',es:'Peso uruguayo',pt:'Peso uruguaio'},
  ARS:{flag:'icons/flag-ar.svg',es:'Peso argentino',pt:'Peso argentino'},
  USD:{flag:null,es:'Solo dólares',pt:'Só dólares'}
 };
 const locale=()=>LANG==='es'?'es-UY':'pt-BR';
 function rateFor(code){
  if(code==='USD')return {rate:1};
  const manual=typeof manualRates!=='undefined'?manualRates?.[code]:null;
  if(manual?.rate>0)return {rate:manual.rate,date:manual.actualizado,manual:true};
  const auto=typeof automaticExchange!=='undefined'?automaticExchange:null;
  const entry=auto?.rates?.[code]||(code==='BRL'&&auto?.usd_brl?{rate:auto.usd_brl,date:auto.actualizado,source:auto.fuente}:null);
  return entry?.rate>0?{rate:entry.rate,date:entry.date,source:entry.source}:null;
 }
 // Regional symbols: Intl prints "$" for both pesos, which is ambiguous on the border.
 const SYMBOLS={BRL:'R$',UYU:'$U',ARS:'AR$',USD:'US$'};
 const money=(code,amount)=>{const digits=amount>=100?0:2;return SYMBOLS[code]+'\u00a0'+new Intl.NumberFormat(locale(),{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(amount);};
 const shownCurrency=()=>{const current=typeof referenceCurrency!=='undefined'?referenceCurrency:'BRL';return current==='USD'?'BRL':current;};
 function formatDate(raw){const d=Date.parse(raw);return Number.isFinite(d)?new Date(d+43200000).toLocaleDateString(locale(),{day:'numeric',month:'short'}):'';}

 function syncButton(){
  const code=shownCurrency(),info=rateFor(code);
  value.textContent=info?money(code,info.rate):'—';
  const label=t('Cotización del día','Cotação do dia')+': USD 1 = '+(info?money(code,info.rate):t('no disponible','indisponível'));
  button.setAttribute('aria-label',label);button.title=label+(info?.date?' · '+formatDate(info.date):'');
  if(!panel.hidden)drawPanel();
 }

 // Panel with the three neighbouring currencies; choosing one changes the reference currency of the site.
 const panel=el('div',null,'rf-rate-panel');panel.id='navExchangePanel';panel.setAttribute('role','dialog');panel.hidden=true;
 button.after(panel);
 function drawPanel(){
  panel.replaceChildren();
  panel.setAttribute('aria-label',t('Cotización del día','Cotação do dia'));
  const head=el('div',null,'rf-rate-head');head.append(el('strong',t('Cotización del día','Cotação do dia')),el('span',t('1 dólar estadounidense (USD)','1 dólar americano (USD)'),'rf-rate-sub'));panel.append(head);
  panel.append(...rateBlock(code=>choose(code)));
 }
 // Currency rows plus the source note; the phone menu (mobile-shell.js) shows the same block in its drawer.
 function rateBlock(onPick){
  const list=el('div',null,'rf-rate-list');list.setAttribute('role','group');list.setAttribute('aria-label',t('Mostrar precios también en','Mostrar preços também em'));
  const current=typeof referenceCurrency!=='undefined'?referenceCurrency:'BRL';let newest='';
  for(const [code,meta] of Object.entries(CURRENCIES)){
   const info=rateFor(code);if(!info)continue;if(info.date&&info.date>newest)newest=info.date;
   const row=el('button',null,'rf-rate-row');row.type='button';row.dataset.currency=code;row.setAttribute('aria-pressed',String(code===current));
   if(meta.flag){const img=el('img',null,'rf-lang-flag');img.src=meta.flag;img.alt='';img.width=24;img.height=17;row.append(img);}
   else{const icon=el('span','$','rf-rate-usd');icon.setAttribute('aria-hidden','true');row.append(icon);}
   const text=el('span',null,'rf-rate-name');text.append(el('strong',code==='USD'?'USD':code),el('small',meta[LANG==='es'?'es':'pt']));row.append(text);
   row.append(el('span',code==='USD'?t('sin conversión','sem conversão'):money(code,info.rate)+(info.manual?' *':''),'rf-rate-value'));
   row.addEventListener('click',()=>onPick(code));list.append(row);
  }
  const note=el('p',null,'rf-rate-note');
  const source=rateFor(shownCurrency());
  note.textContent=t('Los precios de las tiendas están en dólares. Elegí una moneda para ver también el equivalente aproximado.','Os preços das lojas estão em dólares. Escolha uma moeda para ver também o equivalente aproximado.')+(newest?' '+t('Actualizada: ','Atualizada: ')+formatDate(newest)+(source?.source?' · '+source.source:''):'')+(Object.keys(CURRENCIES).some(c=>rateFor(c)?.manual)?' · * '+t('tasa manual','taxa manual'):'');
  return [list,note];
 }
 window.RivFreeRates={
  label:()=>{const code=shownCurrency(),info=rateFor(code);return info?money(code,info.rate):'—';},
  // A USD price in the three neighbouring currencies (product page). The reference currency comes first.
  convert(usd){
   const current=typeof referenceCurrency!=='undefined'?referenceCurrency:'BRL';
   return ['BRL','UYU','ARS'].map(code=>{const info=rateFor(code);return info&&Number.isFinite(usd)?{code,text:money(code,usd*info.rate),active:code===current,name:CURRENCIES[code][LANG==='es'?'es':'pt']}:null;})
    .filter(Boolean).sort((a,b)=>Number(b.active)-Number(a.active));
  },
  choose(code){const select=$('referenceCurrency');if(select&&select.value!==code){select.value=code;select.dispatchEvent(new Event('change',{bubbles:true}));}},
  render(target,after){target.replaceChildren(...rateBlock(code=>{const select=$('referenceCurrency');if(select&&select.value!==code){select.value=code;select.dispatchEvent(new Event('change',{bubbles:true}));}after?.(code);}));}
 };
 function choose(code){const select=$('referenceCurrency');if(select&&select.value!==code){select.value=code;select.dispatchEvent(new Event('change',{bubbles:true}));}close();}
 function open(){drawPanel();panel.style.left=matchMedia('(max-width:650px)').matches?'':(button.offsetLeft+button.offsetWidth/2)+'px';panel.hidden=false;button.setAttribute('aria-expanded','true');button.classList.add('open');(panel.querySelector('[aria-pressed=true]')||panel.querySelector('button'))?.focus({preventScroll:true});}
 function close(focus=false){if(panel.hidden)return;panel.hidden=true;button.setAttribute('aria-expanded','false');button.classList.remove('open');if(focus)button.focus({preventScroll:true});}
 button.addEventListener('click',()=>panel.hidden?open():close());
 panel.addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();close(true);return;}
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const rows=[...panel.querySelectorAll('.rf-rate-row')],i=rows.indexOf(document.activeElement);rows[(i+(e.key==='ArrowDown'?1:-1)+rows.length)%rows.length]?.focus();}
 });
 document.addEventListener('pointerdown',e=>{if(!panel.hidden&&!panel.contains(e.target)&&!button.contains(e.target))close();});
 panel.addEventListener('focusout',()=>setTimeout(()=>{if(!panel.contains(document.activeElement)&&document.activeElement!==button)close();},0));

 // Keep the bar in sync with the existing currency logic (features.js) and language switch.
 if(typeof updateExchangeNote==='function'){const prior=updateExchangeNote;updateExchangeNote=function(...args){const result=prior.apply(this,args);syncButton();return result;};}
 $('languageToggle')?.addEventListener('change',()=>setTimeout(syncButton,0));
 window.addEventListener('rivfree:catalog-ready',syncButton);
 syncButton();

 // "Mi lista" mirrors the counter of the planner and opens the same dialog.
 if(listButton){
  listButton.addEventListener('click',()=>$('openShoppingList')?.click());
  const source=$('listCount');
  const syncCount=()=>{const n=Number(source?.textContent)||0;listCount.textContent=String(n);listCount.hidden=!n;listButton.setAttribute('aria-label',t('Mi lista','Minha lista')+(n?' · '+n+' '+t(n===1?'producto':'productos',n===1?'produto':'produtos'):''));};
  if(source)new MutationObserver(syncCount).observe(source,{childList:true,characterData:true,subtree:true});
  $('languageToggle')?.addEventListener('change',()=>setTimeout(syncCount,0));
  syncCount();
 }

 // Studio can hide any of the quick-access items (Página → Barra de navegación).
 const ITEMS=[['stores','navStores'],['offers','navOffers'],['exchange','navExchange'],['list','navList']];
 function applyNav(config){
  const nav=config?.nav;if(!nav)return;
  for(const [key,id] of ITEMS){const item=$(id);if(item)item.hidden=nav[key]===false;}
  if(nav.exchange===false)close();
  const quick=$('navQuick');if(quick)quick.dataset.items=String(ITEMS.filter(([key])=>nav[key]!==false).length);
 }
 document.addEventListener('rivfree-site-config-applied',e=>applyNav(e.detail));
 if(window.RIVFREE_SITE_CONFIG)applyNav(window.RIVFREE_SITE_CONFIG);
})();
