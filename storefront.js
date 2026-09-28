// Editable campaign inventory and honest popularity: aggregate feed or this browser only.
let campaigns={hero:[]}, popularFeed=null;
const campaignPositions={hero:0};
const isStudioPreview=new URLSearchParams(location.search).has('studio-preview')&&window.parent!==window;
let studioCampaignState=null;
function campaignCount(){const n=Number(window.RIVFREE_SITE_CONFIG?.carousel?.visible_count);return Number.isInteger(n)?Math.max(1,Math.min(10,n)):5;}
function carouselDelay(){const n=Number(window.RIVFREE_SITE_CONFIG?.carousel?.autoplay_seconds);return Math.max(3,Math.min(30,Number.isFinite(n)?n:6))*1000;}
function carouselTransition(){const c=window.RIVFREE_SITE_CONFIG?.carousel||{};return {mode:c.transition==='static'?'static':'smooth',ms:Math.max(200,Math.min(1200,Number(c.transition_ms)||500))};}
function campaignColors(c){const mode=document.documentElement.dataset.theme==='dark'?'dark':'light';const colors=c?.colors?.[mode];return colors&&typeof colors==='object'?colors:null;}
function campaignIsActive(c){const now=Date.now(),start=c?.starts_at?Date.parse(c.starts_at):NaN,end=c?.ends_at?Date.parse(c.ends_at):NaN;return c?.enabled!==false&&(!Number.isFinite(start)||now>=start)&&(!Number.isFinite(end)||now<=end);}
const LAST_CAMPAIGNS_KEY='rivfree-last-campaign-selection';
const smartCampaignCache=new Map(),campaignImageCache=new Map();
const consultations=new Map();

// Keep the hero available even if a browser extension, stale service worker or
// temporary request error blocks the editable JSON inventory. The main pool is
// still loaded from data/highlights.json; this is only a resilient fallback.
const FALLBACK_HIGHLIGHTS=[
 {id:'fallback-perfumes',poolGroup:'beauty',theme:'rose',eyebrow:{es:'PERFUMES PARA DESCUBRIR','pt-BR':'PERFUMES PARA DESCOBRIR'},title:{es:'Una fragancia.\nVarias opciones.','pt-BR':'Uma fragrância.\nVárias opções.'},description:{es:'Explorá perfumes de distintas tiendas y compará antes de elegir.','pt-BR':'Explore perfumes de diferentes lojas e compare antes de escolher.'},cta:{es:'Explorar perfumes','pt-BR':'Explorar perfumes'},category:'perfumes'},
 {id:'fallback-care',poolGroup:'beauty',theme:'mint',eyebrow:{es:'CUIDADO PERSONAL','pt-BR':'CUIDADO PESSOAL'},title:{es:'Tu rutina,\ncon más opciones.','pt-BR':'Sua rotina,\ncom mais opções.'},description:{es:'Cosmética y cuidado personal reunidos en un solo catálogo.','pt-BR':'Cosméticos e cuidados pessoais reunidos em um só catálogo.'},cta:{es:'Ver cuidado personal','pt-BR':'Ver cuidados pessoais'},category:'cosmetica'},
 {id:'fallback-whisky',poolGroup:'drinks',theme:'sand',eyebrow:{es:'BEBIDAS','pt-BR':'BEBIDAS'},title:{es:'Whisky, vinos y más.\nCompará primero.','pt-BR':'Whisky, vinhos e mais.\nCompare primeiro.'},description:{es:'Revisá precios entre free shops antes de decidir dónde comprar.','pt-BR':'Confira preços entre free shops antes de decidir onde comprar.'},cta:{es:'Explorar bebidas','pt-BR':'Explorar bebidas'},category:'bebidas'},
 {id:'fallback-wine',poolGroup:'drinks',theme:'rose',eyebrow:{es:'PARA TU RECORRIDO','pt-BR':'PARA SEU PASSEIO'},title:{es:'Vinos para mirar\ncon calma.','pt-BR':'Vinhos para conferir\ncom calma.'},description:{es:'Encontrá alternativas del catálogo y compará publicaciones.','pt-BR':'Encontre alternativas no catálogo e compare anúncios.'},cta:{es:'Ver bebidas','pt-BR':'Ver bebidas'},category:'bebidas'},
 {id:'fallback-tech',poolGroup:'tech',theme:'blue',eyebrow:{es:'TECNOLOGÍA','pt-BR':'TECNOLOGIA'},title:{es:'Tecnología para comparar.\nSin abrir diez pestañas.','pt-BR':'Tecnologia para comparar.\nSem abrir dez abas.'},description:{es:'Celulares, audio, informática y accesorios reunidos para explorar.','pt-BR':'Celulares, áudio, informática e acessórios reunidos para explorar.'},cta:{es:'Explorar tecnología','pt-BR':'Explorar tecnologia'},category:'electronica'},
 {id:'fallback-audio',poolGroup:'tech',theme:'blue',eyebrow:{es:'AUDIO Y ACCESORIOS','pt-BR':'ÁUDIO E ACESSÓRIOS'},title:{es:'Encontrá ese gadget\nque estabas buscando.','pt-BR':'Encontre aquele gadget\nque você procurava.'},description:{es:'Usá RivFree para revisar opciones y precios disponibles.','pt-BR':'Use o RivFree para conferir opções e preços disponíveis.'},cta:{es:'Ver electrónicos','pt-BR':'Ver eletrônicos'},category:'electronica'},
 {id:'fallback-food',poolGroup:'food',theme:'sand',eyebrow:{es:'CHOCOLATES Y ALIMENTOS','pt-BR':'CHOCOLATES E ALIMENTOS'},title:{es:'Algo rico para llevar.\nMás fácil de encontrar.','pt-BR':'Algo gostoso para levar.\nMais fácil de encontrar.'},description:{es:'Explorá chocolates, dulces y alimentos de diferentes tiendas.','pt-BR':'Explore chocolates, doces e alimentos de diferentes lojas.'},cta:{es:'Explorar alimentos','pt-BR':'Explorar alimentos'},category:'alimentos'},
 {id:'fallback-pantry',poolGroup:'food',theme:'mint',eyebrow:{es:'PARA LLEVAR','pt-BR':'PARA LEVAR'},title:{es:'Descubrí productos\nfuera de lo de siempre.','pt-BR':'Descubra produtos\nalém do de sempre.'},description:{es:'Una selección para recorrer el catálogo de otra forma.','pt-BR':'Uma seleção para explorar o catálogo de outro jeito.'},cta:{es:'Ver alimentos','pt-BR':'Ver alimentos'},category:'alimentos'},
 {id:'fallback-smart-compare',poolGroup:'smart',theme:'rose',smartType:'compare',eyebrow:{es:'COMPARACIÓN REAL','pt-BR':'COMPARAÇÃO REAL'},title:{es:'El mismo producto.\nDistintos precios.','pt-BR':'O mesmo produto.\nPreços diferentes.'},description:{es:'Cuando hay equivalencias, RivFree te ayuda a verlas lado a lado.','pt-BR':'Quando há equivalências, o RivFree ajuda você a vê-las lado a lado.'},cta:{es:'Comparar','pt-BR':'Comparar'},category:''},
 {id:'fallback-smart-offer',poolGroup:'smart',theme:'sand',smartType:'offer',eyebrow:{es:'OFERTAS DEL CATÁLOGO','pt-BR':'OFERTAS DO CATÁLOGO'},title:{es:'Hay ofertas para mirar.','pt-BR':'Há ofertas para conferir.'},description:{es:'Explorá publicaciones marcadas como oferta y compará antes de comprar.','pt-BR':'Explore anúncios marcados como oferta e compare antes de comprar.'},cta:{es:'Ver ofertas','pt-BR':'Ver ofertas'},category:'',action:'offers'}
];

function shuffled(items){
 const copy=[...items];
 for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];}
 return copy;
}
function previousCampaignIds(){
 try{const value=JSON.parse(sessionStorage.getItem(LAST_CAMPAIGNS_KEY)||'[]');return new Set(Array.isArray(value)?value.filter(v=>typeof v==='string'):[]);}catch{return new Set();}
}
function chooseBalancedCampaigns(entries,amount=null){
 amount=amount||campaignCount();
 const valid=Array.isArray(entries)?entries.filter(c=>c&&typeof c.id==='string'&&localized(c.title)&&campaignIsActive(c)):[];
 if(valid.length<=amount){try{sessionStorage.setItem(LAST_CAMPAIGNS_KEY,JSON.stringify(valid.map(c=>c.id)));}catch{}return shuffled(valid);}
 const previous=previousCampaignIds(),selected=[],used=new Set();
 const groups=[...new Set(valid.map(c=>c.poolGroup||'general'))];
 for(const group of shuffled(groups)){
  if(selected.length>=amount)break;
  const options=valid.filter(c=>(c.poolGroup||'general')===group&&!used.has(c.id));
  const fresh=options.filter(c=>!previous.has(c.id));
  const pick=shuffled(fresh.length?fresh:options)[0];
  if(pick){selected.push(pick);used.add(pick.id);}
 }
 const remaining=valid.filter(c=>!used.has(c.id));
 const freshRemaining=remaining.filter(c=>!previous.has(c.id));
 for(const c of [...shuffled(freshRemaining),...shuffled(remaining.filter(c=>previous.has(c.id)))]){
  if(selected.length>=amount)break;if(used.has(c.id))continue;selected.push(c);used.add(c.id);
 }
 const result=shuffled(selected.slice(0,amount));
 try{sessionStorage.setItem(LAST_CAMPAIGNS_KEY,JSON.stringify(result.map(c=>c.id)));}catch{}
 return result;
}
try{
 const saved=JSON.parse(localStorage.getItem('rivfree-consultations')||'[]');
 if(Array.isArray(saved))for(const [key,value] of saved.slice(0,200)){
  if(typeof key==='string'&&Number.isInteger(value?.count)&&value.count>0&&Number.isFinite(value?.last))consultations.set(key,value);
 }
}catch{}
function localized(value){return typeof value==='string'?value:value?.[LANG]||value?.es||'';}
function campaignURL(raw){
 if(typeof raw!=='string'||!raw.trim())return null;
 try{const url=new URL(raw,location.href);return (url.protocol==='https:'||(url.origin===location.origin&&url.protocol==='http:'))&&!url.username&&!url.password?url.href:null;}catch{return null;}
}
async function storefrontJSON(path){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
 try{const response=await fetch(path,{cache:'default',signal:controller.signal});if(!response.ok)throw new Error();return await response.json();}finally{clearTimeout(timer);}
}
async function initStorefront(){
 await (window.RIVFREE_SITE_READY||Promise.resolve());
 const rankingPromise=storefrontJSON('data/popular.json').then(value=>({status:'fulfilled',value}),()=>({status:'rejected'}));
 const banners=await storefrontJSON('data/highlights.json').then(value=>({status:'fulfilled',value}),()=>({status:'rejected'}));
 const remoteEntries=banners.status==='fulfilled'&&Array.isArray(banners.value?.hero)?banners.value.hero:[];
 campaigns.hero=chooseBalancedCampaigns(remoteEntries.length?remoteEntries:FALLBACK_HIGHLIGHTS,campaignCount());
 if(campaigns.hero[0]?.smartType){const editorial=campaigns.hero.findIndex(c=>!c.smartType);if(editorial>0)[campaigns.hero[0],campaigns.hero[editorial]]=[campaigns.hero[editorial],campaigns.hero[0]];}
 campaignPositions.hero=0;smartCampaignCache.clear();campaignImageCache.clear();
 renderCampaigns();
 const ranking=await rankingPromise;
 if(ranking.status==='fulfilled'&&Array.isArray(ranking.value?.items)&&Number.isFinite(Date.parse(ranking.value.updatedAt))){
  popularFeed={updatedAt:ranking.value.updatedAt,items:ranking.value.items.filter(i=>typeof i.url==='string'&&Number.isInteger(i.views)&&i.views>0).slice(0,1000)};
 }
 renderPopularProducts();
 if(isStudioPreview){if(studioCampaignState)applyStudioCampaigns(studioCampaignState);window.parent.postMessage({type:'rivfree-studio-ready'},location.origin);}
}
function campaignCategoryLabel(category,lang=LANG){
 const pair=typeof Catalog!=='undefined'?Catalog.categories?.[category]:null;
 return pair?.[lang==='pt-BR'?1:0]||category||'catálogo';
}
function shortCampaignName(name,max=48){
 const clean=String(name||'').replace(/\s+/g,' ').trim();return clean.length<=max?clean:clean.slice(0,max-1).trimEnd()+'…';
}
function pricedOffers(group){return (group?.offers||[]).filter(hasPrice);}
function uniqueStores(group){return new Set((group?.offers||[]).map(o=>o.tienda).filter(Boolean)).size;}
// Build once per catalog, yielding between small batches on mobile.
let campaignCatalog=null,campaignIndex=null,campaignBuild=0;
function getCampaignIndex(){
 if(campaignCatalog===PRODUCT_GROUPS)return campaignIndex;
 campaignCatalog=PRODUCT_GROUPS;campaignIndex=null;smartCampaignCache.clear();campaignImageCache.clear();
 const ticket=++campaignBuild,groups=PRODUCT_GROUPS;
 const index={priced:[],compare:[],multistore:[],offers:[],counts:new Map(),images:new Map(),byKey:new Map()};
 let cursor=0;
 function batch(){
  if(ticket!==campaignBuild)return;
  const end=Math.min(cursor+300,groups.length);
  for(;cursor<end;cursor++){
   const g=groups[cursor],offers=pricedOffers(g);index.byKey.set(g.key,g);
   for(const o of g.offers||[]){if(o.imagen&&campaignURL(o.imagen)){
    const images=index.images.get(o.categoryId)||[];
    if(images.length<24)images.push({src:o.imagen,alt:o.nombre||g.name});
    index.images.set(o.categoryId,images);
   }}
   if(!offers.length)continue;
   index.priced.push(g);const category=g.offers[0]?.categoryId;
   if(category)index.counts.set(category,(index.counts.get(category)||0)+1);
   if(offers.some(o=>o.en_oferta))index.offers.push(g);
   const stores=new Set(offers.map(o=>o.tienda)).size;
   if(stores>=2){const prices=offers.map(o=>o.precio_usd);index.compare.push({g,stores,spread:Math.max(...prices)-Math.min(...prices)});}
   const allStores=uniqueStores(g);if(allStores>=2)index.multistore.push({g,stores:allStores});
  }
  if(cursor<groups.length){setTimeout(batch,0);return;}
  index.compare.sort((a,b)=>b.spread-a.spread);index.compare.length=Math.min(30,index.compare.length);
  index.multistore.sort((a,b)=>b.stores-a.stores);index.multistore.length=Math.min(40,index.multistore.length);
  campaignIndex=index;
  if(groups.length>300&&!document.hidden)renderCampaigns();
 }
 batch();return campaignIndex;
}
function resolveSmartCampaign(base){
 if(!base?.smartType||typeof PRODUCT_GROUPS==='undefined'||!PRODUCT_GROUPS.length)return base;
 const index=getCampaignIndex();if(!index)return base;
 if(smartCampaignCache.has(base.id))return smartCampaignCache.get(base.id);
 const pricedGroups=index.priced;
 let resolved={...base,smartResolved:true};
 if(base.smartType==='compare'){
  const candidates=index.compare;
  const picked=candidates[Math.floor(Math.random()*candidates.length)];
  if(picked){const name=shortCampaignName(picked.g.name);resolved={...resolved,title:{es:`Compará ${name}`, 'pt-BR':`Compare ${name}`},description:{es:`Encontramos precios distintos en ${picked.stores} tiendas. Miralos lado a lado antes de elegir.`, 'pt-BR':`Encontramos preços diferentes em ${picked.stores} lojas. Compare lado a lado antes de escolher.`},cta:{es:'Comparar precios','pt-BR':'Comparar preços'},category:picked.g.offers[0]?.categoryId||base.category,action:'compare',groupKey:picked.g.key};}
 }
 if(base.smartType==='multistore'){
  const candidates=index.multistore;
  const picked=candidates[Math.floor(Math.random()*candidates.length)];
  if(picked){const name=shortCampaignName(picked.g.name);resolved={...resolved,title:{es:`${name}, en ${picked.stores} tiendas`,'pt-BR':`${name}, em ${picked.stores} lojas`},description:{es:'Varias publicaciones del mismo producto para comparar sin abrir tienda por tienda.','pt-BR':'Vários anúncios do mesmo produto para comparar sem abrir loja por loja.'},cta:{es:'Ver comparación','pt-BR':'Ver comparação'},category:picked.g.offers[0]?.categoryId||base.category,action:'compare',groupKey:picked.g.key};}
 }
 if(base.smartType==='offer'){
  const candidates=index.offers;
  const picked=candidates[Math.floor(Math.random()*candidates.length)];
  if(picked){const category=picked.offers.find(o=>o.en_oferta)?.categoryId||picked.offers[0]?.categoryId||base.category;resolved={...resolved,title:{es:`Ofertas para mirar en ${campaignCategoryLabel(category,'es')}`,'pt-BR':`Ofertas para conferir em ${campaignCategoryLabel(category,'pt-BR')}`},description:{es:'Hay publicaciones marcadas como oferta en el catálogo actual. Compará precio y disponibilidad antes de comprar.','pt-BR':'Há anúncios marcados como oferta no catálogo atual. Compare preço e disponibilidade antes de comprar.'},cta:{es:'Ver ofertas','pt-BR':'Ver ofertas'},category,action:'offers',groupKey:picked.key};}
 }
 if(base.smartType==='category'){
  const counts=index.counts;
  const top=[...counts].sort((a,b)=>b[1]-a[1]).slice(0,5);const picked=shuffled(top)[0];
  if(picked){const [category,count]=picked;resolved={...resolved,title:{es:`Mucho para descubrir en ${campaignCategoryLabel(category,'es')}`,'pt-BR':`Muito para descobrir em ${campaignCategoryLabel(category,'pt-BR')}`},description:{es:`Esta categoría reúne ${count.toLocaleString('es-UY')} productos agrupados para explorar y comparar.`, 'pt-BR':`Esta categoria reúne ${count.toLocaleString('pt-BR')} produtos agrupados para explorar e comparar.`},cta:{es:'Explorar categoría','pt-BR':'Explorar categoria'},category,action:'category'};}
 }
 smartCampaignCache.set(base.id,resolved);return resolved;
}
function campaignVisualItems(c){
 if(!c.smartResolved&&Array.isArray(c.images)&&c.images.length)return c.images;
 if(campaignImageCache.has(c.id))return campaignImageCache.get(c.id);
 let dynamic=[];
 if(typeof PRODUCT_GROUPS!=='undefined'&&PRODUCT_GROUPS.length){
  const index=getCampaignIndex();
  const group=index?.byKey.get(c.groupKey);
  const candidates=group?(group.offers||[]).filter(o=>o.imagen&&campaignURL(o.imagen)).map(o=>({src:o.imagen,alt:o.nombre||group.name})):(index?.images.get(c.category)||[]);
  if(candidates.length)dynamic=[candidates[Math.floor(Math.random()*candidates.length)]];
 }
 if(dynamic.length){campaignImageCache.set(c.id,dynamic);return dynamic;}
 return Array.isArray(c.images)?c.images:[];
}
async function activateCampaign(c){
 await waitForPaint();
 if(c.action==='compare'&&c.groupKey){const group=PRODUCT_GROUPS.find(g=>g.key===c.groupKey);if(group){openComparison(group.name,group.offers);return;}}
 selectCampaignCategory(c.category||'');
 if(c.action==='offers'){document.getElementById('soloOfertas').checked=true;render(true);}
}
function selectCampaignCategory(category){
 ACTIVE_SEARCH='';document.getElementById('search').value='';
 document.getElementById('categoria').value=category||'';
 document.getElementById('favoritesOnly').checked=false;
 document.getElementById('soloOfertas').checked=false;
 document.getElementById('minPrice').value='';document.getElementById('maxPrice').value='';
 document.querySelectorAll('.storeChk').forEach(c=>c.checked=true);
 document.getElementById('orden').value='nombre_asc';
 syncCategoryInput();render(true);document.getElementById('catalogStart').scrollIntoView?.({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
}
function renderCampaigns(){
 renderCampaign('hero');
}
function renderCampaign(slot,automatic=false){
 const root=document.getElementById('heroCampaign'),items=campaigns[slot];
 root.hidden=!items.length || (window.RIVFREE_SITE_CONFIG?.homepage?.visible?.hero===false && !(isStudioPreview&&studioCampaignState?.selectedId));if(!items.length)return;
 const index=campaignPositions[slot]%items.length,c=resolveSmartCampaign(items[index]);
 const activeControl=root.contains(document.activeElement)?document.activeElement.dataset.control:null;
 root.replaceChildren();root.dataset.layout=c.layout==='banner'&&c.image?'banner':'split';root.dataset.theme=['rose','blue','sand','mint','plum','graphite','amber','ocean','forest'].includes(c.theme)?c.theme:'rose';root.dataset.campaignId=c.id||'';root.dataset.campaignGroup=c.poolGroup||'';root.dataset.campaignType=c.smartType||'editorial';
 const transition=carouselTransition();root.dataset.transition=transition.mode;root.style.setProperty('--campaign-transition-ms',`${transition.ms}ms`);
 const customColors=campaignColors(c);
 for(const prop of ['--campaign-bg','--campaign-accent','--campaign-text','--campaign-button-bg','--campaign-button-text'])root.style.removeProperty(prop);
 if(customColors){root.style.setProperty('--campaign-bg',customColors.background||'');root.style.setProperty('--campaign-accent',customColors.accent||'');root.style.setProperty('--campaign-text',customColors.text||'');root.style.setProperty('--campaign-button-bg',customColors.button||customColors.accent||'');root.style.setProperty('--campaign-button-text',customColors.button_text||'#fff');}
 root.style.color=customColors?.text||'';
 const slide=document.createElement('div');slide.className='campaign-slide';slide.setAttribute('role','group');slide.setAttribute('aria-roledescription','slide');slide.setAttribute('aria-label',`${index+1} / ${items.length}`);
 const copy=document.createElement('div');copy.className='campaign-copy';
 const eyebrow=document.createElement('span');eyebrow.className='eyebrow';eyebrow.textContent=localized(c.eyebrow);
 const heading=document.createElement('h2');heading.textContent=localized(c.title);
 const description=document.createElement('p');description.textContent=localized(c.description);
 copy.append(eyebrow,heading,description);
 const destination=c.href?campaignURL(c.href):null;
 const cta=document.createElement(destination?'a':'button');cta.className='campaign-cta';cta.setAttribute('aria-label',localized(c.cta)||localized(c.title));cta.textContent=localized(c.cta)||words('Explorar','Explorar');
 if(destination){cta.href=destination;cta.target='_blank';cta.rel=c.sponsored?'sponsored noopener noreferrer':'noopener noreferrer';}
 else{cta.type='button';cta.disabled=!PRODUCT_GROUPS.length;cta.onclick=()=>activateCampaign(c);}
 copy.append(cta);
 const visual=document.createElement('div');visual.className='campaign-visual';
 if(c.image){
  const src=campaignURL(c.image);if(src){const image=document.createElement('img');image.referrerPolicy='no-referrer';image.src=src;image.alt=localized(c.imageAlt)||'';image.className='campaign-custom-image';image.decoding='async';image.fetchPriority=automatic?'low':'auto';image.onerror=()=>image.remove();
   const mobile=campaignURL(c.mobileImage);
   if(mobile){const picture=document.createElement('picture'),source=document.createElement('source');source.media='(max-width: 650px)';source.srcset=mobile;picture.append(source,image);visual.append(picture);}else visual.append(image);}
 }else{
  for(const item of campaignVisualItems(c).slice(0,3)){
   const src=campaignURL(item.src);if(!src)continue;
   const pedestal=document.createElement('div');pedestal.className='product-pedestal';const image=document.createElement('img');image.referrerPolicy='no-referrer';image.src=src;image.alt=localized(item.alt)||'';image.decoding='async';image.width=256;image.height=256;image.fetchPriority=automatic?'low':'auto';image.onerror=()=>{image.remove();pedestal.textContent='RivFree';};pedestal.append(image);visual.append(pedestal);
  }
 }
 const label=document.createElement('span');label.className='campaign-label';label.textContent=c.sponsored?words('Publicidade','Publicidad'):c.smartResolved?words('Destaque do catálogo','Destacado del catálogo'):words('Seleção RivFree','Selección RivFree');
 slide.append(copy,visual,label);root.append(slide);
 if(items.length>1){
  const previous=document.createElement('button'),next=document.createElement('button');
  for(const [button,delta,key] of [[previous,-1,'previous'],[next,1,'next']]){
   button.type='button';button.dataset.control=key;button.className='campaign-arrow '+key;button.textContent=delta<0?'‹':'›';button.setAttribute('aria-label',delta<0?words('Campanha anterior','Campaña anterior'):words('Próxima campanha','Próxima campaña'));
   button.onclick=()=>{campaignPositions[slot]=(index+delta+items.length)%items.length;renderCampaign(slot);};root.append(button);
  }
  const pagination=document.createElement('div');pagination.className='campaign-pagination';
  items.forEach((item,i)=>{const dot=document.createElement('button');dot.type='button';dot.dataset.control='dot'+i;dot.className='campaign-dot';dot.setAttribute('aria-label',localized(item.title).replace(/\n/g,' '));dot.setAttribute('aria-current',String(i===index));dot.onclick=()=>{campaignPositions[slot]=i;renderCampaign(slot);};pagination.append(dot);});root.append(pagination);
 }
 if(items.length>1){const pause=document.createElement('button');pause.type='button';pause.className='campaign-pause autoplay-toggle';pause.dataset.control='pause';updateAutoplayButton(pause,root.id);pause.onclick=()=>{toggleAutoplay(root.id);updateAutoplayButton(pause,root.id);};root.append(pause);}
 const status=document.createElement('span');status.className='visually-hidden';status.setAttribute('aria-live',automatic?'off':'polite');status.textContent=`${index+1} / ${items.length} · ${localized(c.title)}`;root.append(status);
 root.onkeydown=event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key)||items.length<2)return;event.preventDefault();campaignPositions[slot]=(index+(event.key==='ArrowLeft'?-1:1)+items.length)%items.length;renderCampaign(slot);};
 let touchStart=null;root.ontouchstart=event=>{const t=event.changedTouches[0];touchStart=t?{x:t.clientX,y:t.clientY}:null;};root.ontouchend=event=>{const t=event.changedTouches[0],start=touchStart;touchStart=null;if(!start||!t||Math.abs(t.clientX-start.x)<55||Math.abs(t.clientY-start.y)>=Math.abs(t.clientX-start.x))return;campaignPositions[slot]=(index+(t.clientX<start.x?1:-1)+items.length)%items.length;renderCampaign(slot);};
 if(activeControl)[...root.querySelectorAll('[data-control]')].find(el=>el.dataset.control===activeControl)?.focus({preventScroll:true});
}
function recordProductConsult(key){
 const now=Date.now(),existing=consultations.get(key);
 // Repeated clicks on image/name/CTA within a minute count as one consultation.
 if(existing&&now-existing.last<60000)return;
 consultations.set(key,{count:(existing?.count||0)+1,last:now});
 const newest=[...consultations].sort((a,b)=>b[1].last-a[1].last).slice(0,200);
 consultations.clear();newest.forEach(([k,v])=>consultations.set(k,v));
 try{localStorage.setItem('rivfree-consultations',JSON.stringify(newest));}catch{}
 setTimeout(renderPopularProducts,0);
}
let railCatalog=null,railSignature='',railGroups=[];
function renderPopularProducts(){
 const popularHidden=window.RIVFREE_SITE_CONFIG?.homepage?.visible?.popular===false;
 document.getElementById('popularProducts').hidden=popularHidden;
 document.querySelector('a[href="#popularProducts"]').hidden=popularHidden;
 if(typeof PRODUCT_GROUPS==='undefined'||!PRODUCT_GROUPS.length)return;
 const signature=JSON.stringify([LANG,referenceCurrency,exchange.rate,[...favorites], [...consultations],popularFeed]);
 if(railCatalog===PRODUCT_GROUPS&&railSignature===signature)return;
 if(railCatalog!==PRODUCT_GROUPS)railGroups=PRODUCT_GROUPS.filter(g=>g.offers.some(hasPrice));
 railCatalog=PRODUCT_GROUPS;railSignature=signature;
 renderDiscoverProducts();
 const grid=document.getElementById('popularGrid');if(!grid||typeof PRODUCT_GROUPS==='undefined')return;
 const groups=railGroups;
 let ranked=[],source='editorial';
 if(popularFeed?.items.length){
  const totals=new Map(popularFeed.items.map(i=>[i.url,i.views]));
  ranked=groups.map(g=>({g,count:g.offers.reduce((sum,o)=>sum+(totals.get(o.url)||0),0)})).filter(x=>x.count>0).sort((a,b)=>b.count-a.count).map(x=>x.g);if(ranked.length)source='global';
 }
 if(!ranked.length){ranked=groups.filter(g=>consultations.has(g.key)).sort((a,b)=>consultations.get(b.key).count-consultations.get(a.key).count||consultations.get(b.key).last-consultations.get(a.key).last);if(ranked.length)source='local';}
 if(!ranked.length){ranked=groups.slice(0,5);source='editorial';}
 grid.classList.toggle('few-products',ranked.length<4);
 document.getElementById('popularTitle').textContent=source==='global'?words('Mais consultados','Más consultados'):source==='local'?words('Mais consultados por você','Más consultados por vos'):words('Complete sua lista','Completá tu lista');
 document.getElementById('popularNote').textContent=source==='global'?words('Consultas do site · atualização: ','Consultas del sitio · actualización: ')+new Date(popularFeed.updatedAt).toLocaleDateString(LANG):source==='local'?words('Baseado nas suas consultas neste navegador.','Basado en tus consultas en este navegador.'):words('Uma seleção para começar. Seu ranking aparece conforme você consulta produtos.','Una selección para empezar. Tu ranking aparece a medida que consultás productos.');
 grid.dataset.source=source;
 const savedScroll=grid.scrollLeft;
 grid.replaceChildren(...ranked.slice(0,5).map(g=>createProductCard({...g,visibleOffers:g.offers})));
 grid.scrollLeft=savedScroll;
 document.getElementById('popularPrevious').disabled=ranked.length<2;document.getElementById('popularNext').disabled=ranked.length<2;
}
document.querySelectorAll('[data-category-shortcut],#navOffers').forEach(b=>b.disabled=true);
document.getElementById('headerShoppingList').onclick=()=>document.getElementById('openShoppingList').click();
document.getElementById('navOffers').onclick=()=>{selectCampaignCategory('');document.getElementById('soloOfertas').checked=true;render(true);};

let discoveryCatalog=null,discoveryKeys=[],discoveryPool=[],discoveryStart=0,discoveryEnd=0;
const DISCOVERY_BATCH=5,DISCOVERY_WINDOW=30;
function generateDiscovery(){
 const end=Math.min(discoveryKeys.length+DISCOVERY_BATCH,discoveryPool.length);
 for(let i=discoveryKeys.length;i<end;i++){
  const j=i+Math.floor(Math.random()*(discoveryPool.length-i));
  [discoveryPool[i],discoveryPool[j]]=[discoveryPool[j],discoveryPool[i]];
  discoveryKeys.push(discoveryPool[i].key);
 }
}
function updateDiscoveryArrows(){
 const grid=document.getElementById('discoverGrid');
 document.getElementById('discoverPrevious').disabled=discoveryStart===0&&grid.scrollLeft<=2;
 document.getElementById('discoverNext').disabled=discoveryEnd>=discoveryPool.length&&grid.scrollLeft>=grid.scrollWidth-grid.clientWidth-2;
}
function discoveryCards(from,to){return discoveryKeys.slice(from,to).map(key=>{
 const g=renderDiscoverProducts.byKey.get(key);return createProductCard({...g,visibleOffers:g.offers});
});}
function renderDiscoverProducts(){
 const grid=document.getElementById('discoverGrid');if(!grid||typeof PRODUCT_GROUPS==='undefined')return;
 if(discoveryCatalog!==PRODUCT_GROUPS){
  discoveryPool=PRODUCT_GROUPS.filter(g=>g.offers.some(hasPrice));discoveryKeys=[];discoveryStart=0;
  renderDiscoverProducts.byKey=new Map(discoveryPool.map(g=>[g.key,g]));
  generateDiscovery();discoveryEnd=discoveryKeys.length;discoveryCatalog=PRODUCT_GROUPS;
 }
 const left=grid.scrollLeft;
 grid.replaceChildren(...discoveryCards(discoveryStart,discoveryEnd));grid.scrollLeft=left;
 updateDiscoveryArrows();
}
function extendDiscovery(direction){
 const grid=document.getElementById('discoverGrid'),left=grid.scrollLeft;
 if(direction>0){
  if(discoveryEnd>=discoveryPool.length)return;
  if(discoveryEnd>=discoveryKeys.length)generateDiscovery();
  const end=Math.min(discoveryEnd+DISCOVERY_BATCH,discoveryKeys.length);
  grid.append(...discoveryCards(discoveryEnd,end));discoveryEnd=end;
  if(discoveryEnd-discoveryStart>DISCOVERY_WINDOW){
   const count=discoveryEnd-discoveryStart-DISCOVERY_WINDOW;
   const anchor=grid.children[count],before=anchor.offsetLeft;
   for(let i=0;i<count;i++)grid.firstElementChild.remove();
   discoveryStart+=count;grid.scrollLeft=left-(before-anchor.offsetLeft);
  }
 }else if(discoveryStart>0){
  const start=Math.max(0,discoveryStart-DISCOVERY_BATCH),anchor=grid.firstElementChild,before=anchor.offsetLeft;
  grid.prepend(...discoveryCards(start,discoveryStart));discoveryStart=start;
  grid.scrollLeft=left+anchor.offsetLeft-before;
  while(discoveryEnd-discoveryStart>DISCOVERY_WINDOW){grid.lastElementChild.remove();discoveryEnd--;}
 }
 updateDiscoveryArrows();
}
function moveDiscovery(direction){
 const grid=document.getElementById('discoverGrid');
 if(direction>0&&grid.scrollLeft>=grid.scrollWidth-grid.clientWidth-2)extendDiscovery(1);
 if(direction<0&&grid.scrollLeft<=2)extendDiscovery(-1);
 const card=grid.querySelector('.card');if(!card)return;
 const step=card.getBoundingClientRect().width+(parseFloat(getComputedStyle(grid).gap)||0);
 grid.scrollTo?.({left:Math.max(0,Math.min(grid.scrollWidth-grid.clientWidth,grid.scrollLeft+direction*step)),behavior:reduceMotion()?'instant':'smooth'});
 updateDiscoveryArrows();
}
document.getElementById('discoverPrevious').onclick=()=>moveDiscovery(-1);
document.getElementById('discoverNext').onclick=()=>moveDiscovery(1);
let discoveryScrollFrame=0;
document.getElementById('discoverGrid').addEventListener('scroll',()=>{
 if(discoveryScrollFrame)return;
 discoveryScrollFrame=requestAnimationFrame(()=>{
  discoveryScrollFrame=0;const grid=document.getElementById('discoverGrid');
  if(grid.scrollWidth>grid.clientWidth&&grid.scrollLeft>=grid.scrollWidth-grid.clientWidth-100)extendDiscovery(1);
  else if(grid.scrollLeft<=2&&discoveryStart>0)extendDiscovery(-1);
  updateDiscoveryArrows();
 });
},{passive:true});
document.getElementById('discoverGrid').addEventListener('keydown',event=>{
 if(event.target!==event.currentTarget||!['ArrowLeft','ArrowRight'].includes(event.key))return;
 event.preventDefault();moveDiscovery(event.key==='ArrowLeft'?-1:1);
});
const autoplayPaused=new Map(),nextAdvance=new Map();
function reduceMotion(){return window.matchMedia('(prefers-reduced-motion: reduce)').matches;}
function updateAutoplayButton(button,id){
 const paused=autoplayPaused.get(id)||reduceMotion();button.textContent=paused?'▶':'Ⅱ';button.setAttribute('aria-pressed',String(paused));button.setAttribute('aria-label',paused?words('Retomar carrossel','Reanudar carrusel'):words('Pausar carrossel','Pausar carrusel'));
}
function toggleAutoplay(id){autoplayPaused.set(id,!autoplayPaused.get(id));nextAdvance.set(id,Date.now()+carouselDelay());}
function scrollProductRail(id,direction=1){
 const rail=document.getElementById(id),card=rail.querySelector('.card');if(!card)return;
 const step=card.getBoundingClientRect().width+(parseFloat(getComputedStyle(rail).gap)||0),max=rail.scrollWidth-rail.clientWidth;
 if(max<=1)return;
 const target=direction>0?(rail.scrollLeft>=max-2?0:Math.min(max,rail.scrollLeft+step)):(rail.scrollLeft<=2?max:Math.max(0,rail.scrollLeft-step));
 rail.scrollTo?.({left:target,behavior:reduceMotion()?'instant':'smooth'});nextAdvance.set(id,Date.now()+carouselDelay());
}
let carouselInteractionUntil=0;
window.addEventListener('scroll',()=>{carouselInteractionUntil=Date.now()+1200;},{passive:true});
window.addEventListener('pointerdown',()=>{carouselInteractionUntil=Date.now()+carouselDelay();},{passive:true});
function canAutoplay(root){
 if(Date.now()<carouselInteractionUntil)return false;
 if(isStudioPreview)return false;
 if(window.RIVFREE_SITE_CONFIG?.carousel?.autoplay===false)return false;
 if(!root||root.hidden||root.closest('[hidden]')||document.hidden||reduceMotion()||autoplayPaused.get(root.id)||root.matches(':hover')||root.contains(document.activeElement))return false;
 const rect=root.getBoundingClientRect();return rect.bottom>0&&rect.top<window.innerHeight;
}
function advanceCarousels(now=Date.now()){
 for(const [id,slot] of [['heroCampaign','hero'],['popularGrid',null]]){
  const root=document.getElementById(id);
  // Pauses also reset the countdown, so leaving a control never causes a jump.
  if(!canAutoplay(root)){nextAdvance.set(id,now+carouselDelay());continue;}
  const scheduled=nextAdvance.get(id);
  // If the clock moved backwards (or a test uses a synthetic clock), restart the
  // countdown instead of leaving autoplay blocked by a timestamp far in the future.
  if(!Number.isFinite(scheduled)||scheduled-now>Math.max(60000,carouselDelay()*5)){nextAdvance.set(id,now+carouselDelay());continue;}
  if(now<scheduled)continue;
  if(slot){if(campaigns[slot].length>1){campaignPositions[slot]=(campaignPositions[slot]+1)%campaigns[slot].length;renderCampaign(slot,true);}}
  else scrollProductRail(id);
  nextAdvance.set(id,now+carouselDelay());
 }
}
for(const [prefix,id] of [['popular','popularGrid']]){
 for(const [suffix,direction] of [['Previous',-1],['Next',1]])document.getElementById(prefix+suffix).onclick=()=>scrollProductRail(id,direction);
 const pause=document.getElementById(prefix+'Pause');pause.onclick=()=>{toggleAutoplay(id);updateAutoplayButton(pause,id);};
 const rail=document.getElementById(id);rail.addEventListener('pointerdown',()=>nextAdvance.set(id,Date.now()+6000));rail.addEventListener('keydown',()=>nextAdvance.set(id,Date.now()+6000));
}
window.addEventListener('DOMContentLoaded',()=>{for(const [prefix,id] of [['popular','popularGrid']])updateAutoplayButton(document.getElementById(prefix+'Pause'),id);});
function applyStudioCampaigns(data){
 const previous=studioCampaignState;
 studioCampaignState=data;
 const selected=data.hero.find(c=>c.id===data.selectedId);
 // Editing always shows the chosen campaign, including inactive/scheduled ones.
 // The complete page uses a stable eligible selection; public randomization is unchanged.
 campaigns.hero=selected?[selected]:data.hero.filter(c=>campaignIsActive(c)).slice(0,campaignCount());
 campaignPositions.hero=0;
 if(JSON.stringify(previous?.hero)!==JSON.stringify(data.hero)){smartCampaignCache.clear();campaignImageCache.clear();}
 renderCampaigns();
 if(selected&&previous?.selectedId!==data.selectedId)document.getElementById('heroCampaign')?.scrollIntoView?.({block:'start',behavior:'instant'});
 window.parent.postMessage({type:'rivfree-studio-applied',revision:data.revision},location.origin);
}
window.addEventListener('message',event=>{if(!isStudioPreview||event.source!==window.parent||event.origin!==location.origin||event.data?.type!=='rivfree-studio-campaigns-preview'||!Array.isArray(event.data.hero))return;applyStudioCampaigns(event.data);});
setInterval(advanceCarousels,1000);
