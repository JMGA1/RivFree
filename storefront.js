// Editable campaign inventory and honest popularity: aggregate feed or this browser only.
let campaigns={hero:[]}, popularFeed=null;
const campaignPositions={hero:0};
const CAMPAIGN_COUNT=5;
const LAST_CAMPAIGNS_KEY='rivfree-last-campaign-selection';
const smartCampaignCache=new Map(),campaignImageCache=new Map();
const consultations=new Map();

function shuffled(items){
 const copy=[...items];
 for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];}
 return copy;
}
function previousCampaignIds(){
 try{const value=JSON.parse(sessionStorage.getItem(LAST_CAMPAIGNS_KEY)||'[]');return new Set(Array.isArray(value)?value.filter(v=>typeof v==='string'):[]);}catch{return new Set();}
}
function chooseBalancedCampaigns(entries,amount=CAMPAIGN_COUNT){
 const valid=Array.isArray(entries)?entries.filter(c=>c&&typeof c.id==='string'&&localized(c.title)&&c.enabled!==false):[];
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
 try{const url=new URL(raw,location.href);return ['https:','http:'].includes(url.protocol)?url.href:null;}catch{return null;}
}
async function storefrontJSON(path){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
 try{const response=await fetch(path,{cache:'no-cache',signal:controller.signal});if(!response.ok)throw new Error();return await response.json();}finally{clearTimeout(timer);}
}
async function initStorefront(){
 const [banners,ranking]=await Promise.allSettled([storefrontJSON('data/campaigns.json'),storefrontJSON('data/popular.json')]);
 if(banners.status==='fulfilled')for(const slot of ['hero']){
  const entries=banners.value?.[slot];
  campaigns[slot]=chooseBalancedCampaigns(entries,CAMPAIGN_COUNT);
  campaignPositions[slot]=0;smartCampaignCache.clear();campaignImageCache.clear();
 }
 if(ranking.status==='fulfilled'&&Array.isArray(ranking.value?.items)&&Number.isFinite(Date.parse(ranking.value.updatedAt))){
  popularFeed={updatedAt:ranking.value.updatedAt,items:ranking.value.items.filter(i=>typeof i.url==='string'&&Number.isInteger(i.views)&&i.views>0).slice(0,1000)};
 }
 renderCampaigns();renderPopularProducts();
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
function resolveSmartCampaign(base){
 if(!base?.smartType||typeof PRODUCT_GROUPS==='undefined'||!PRODUCT_GROUPS.length)return base;
 if(smartCampaignCache.has(base.id))return smartCampaignCache.get(base.id);
 const pricedGroups=PRODUCT_GROUPS.filter(g=>pricedOffers(g).length);
 let resolved={...base,smartResolved:true};
 if(base.smartType==='compare'){
  const candidates=pricedGroups.map(g=>{const offers=pricedOffers(g),stores=new Set(offers.map(o=>o.tienda)).size;if(stores<2)return null;const prices=offers.map(o=>o.precio_usd);return {g,stores,spread:Math.max(...prices)-Math.min(...prices)};}).filter(Boolean).sort((a,b)=>b.spread-a.spread).slice(0,30);
  const picked=shuffled(candidates)[0];
  if(picked){const name=shortCampaignName(picked.g.name);resolved={...resolved,title:{es:`Compará ${name}`, 'pt-BR':`Compare ${name}`},description:{es:`Encontramos precios distintos en ${picked.stores} tiendas. Miralos lado a lado antes de elegir.`, 'pt-BR':`Encontramos preços diferentes em ${picked.stores} lojas. Compare lado a lado antes de escolher.`},cta:{es:'Comparar precios','pt-BR':'Comparar preços'},category:picked.g.offers[0]?.categoryId||base.category,action:'compare',groupKey:picked.g.key};}
 }
 if(base.smartType==='multistore'){
  const candidates=pricedGroups.map(g=>({g,stores:uniqueStores(g)})).filter(x=>x.stores>=2).sort((a,b)=>b.stores-a.stores).slice(0,40);
  const picked=shuffled(candidates)[0];
  if(picked){const name=shortCampaignName(picked.g.name);resolved={...resolved,title:{es:`${name}, en ${picked.stores} tiendas`,'pt-BR':`${name}, em ${picked.stores} lojas`},description:{es:'Varias publicaciones del mismo producto para comparar sin abrir tienda por tienda.','pt-BR':'Vários anúncios do mesmo produto para comparar sem abrir loja por loja.'},cta:{es:'Ver comparación','pt-BR':'Ver comparação'},category:picked.g.offers[0]?.categoryId||base.category,action:'compare',groupKey:picked.g.key};}
 }
 if(base.smartType==='offer'){
  const candidates=pricedGroups.filter(g=>g.offers.some(o=>o.en_oferta&&hasPrice(o)));
  const picked=shuffled(candidates)[0];
  if(picked){const category=picked.offers.find(o=>o.en_oferta)?.categoryId||picked.offers[0]?.categoryId||base.category;resolved={...resolved,title:{es:`Ofertas para mirar en ${campaignCategoryLabel(category,'es')}`,'pt-BR':`Ofertas para conferir em ${campaignCategoryLabel(category,'pt-BR')}`},description:{es:'Hay publicaciones marcadas como oferta en el catálogo actual. Compará precio y disponibilidad antes de comprar.','pt-BR':'Há anúncios marcados como oferta no catálogo atual. Compare preço e disponibilidade antes de comprar.'},cta:{es:'Ver ofertas','pt-BR':'Ver ofertas'},category,action:'offers',groupKey:picked.key};}
 }
 if(base.smartType==='category'){
  const counts=new Map();for(const g of pricedGroups){const category=g.offers[0]?.categoryId;if(category)counts.set(category,(counts.get(category)||0)+1);}
  const top=[...counts].sort((a,b)=>b[1]-a[1]).slice(0,5);const picked=shuffled(top)[0];
  if(picked){const [category,count]=picked;resolved={...resolved,title:{es:`Mucho para descubrir en ${campaignCategoryLabel(category,'es')}`,'pt-BR':`Muito para descobrir em ${campaignCategoryLabel(category,'pt-BR')}`},description:{es:`Esta categoría reúne ${count.toLocaleString('es-UY')} productos agrupados para explorar y comparar.`, 'pt-BR':`Esta categoria reúne ${count.toLocaleString('pt-BR')} produtos agrupados para explorar e comparar.`},cta:{es:'Explorar categoría','pt-BR':'Explorar categoria'},category,action:'category'};}
 }
 smartCampaignCache.set(base.id,resolved);return resolved;
}
function campaignVisualItems(c){
 if(campaignImageCache.has(c.id))return campaignImageCache.get(c.id);
 let dynamic=[];
 if(typeof PRODUCT_GROUPS!=='undefined'&&PRODUCT_GROUPS.length){
  const groups=c.groupKey?PRODUCT_GROUPS.filter(g=>g.key===c.groupKey):PRODUCT_GROUPS.filter(g=>g.offers?.some(o=>o.categoryId===c.category));
  const candidates=[];
  for(const g of shuffled(groups).slice(0,80))for(const o of shuffled(g.offers||[])){if(o.imagen&&campaignURL(o.imagen)){candidates.push({src:o.imagen,alt:o.nombre||g.name});break;}}
  if(candidates.length)dynamic=[shuffled(candidates)[0]];
 }
 if(dynamic.length){campaignImageCache.set(c.id,dynamic);return dynamic;}
 return Array.isArray(c.images)?c.images:[];
}
function activateCampaign(c){
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
 document.getElementById('orden').value='ofertas';
 syncCategoryInput();render(true);document.getElementById('catalogStart').scrollIntoView?.({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
}
function renderCampaigns(){
 renderCampaign('hero');
}
function renderCampaign(slot,automatic=false){
 const root=document.getElementById('heroCampaign'),items=campaigns[slot];
 root.hidden=!items.length;if(!items.length)return;
 const index=campaignPositions[slot]%items.length,c=resolveSmartCampaign(items[index]);
 const activeControl=root.contains(document.activeElement)?document.activeElement.dataset.control:null;
 root.replaceChildren();root.dataset.layout=c.layout==='banner'&&c.image?'banner':'split';root.dataset.theme=['rose','blue','sand','mint'].includes(c.theme)?c.theme:'rose';root.dataset.campaignId=c.id||'';root.dataset.campaignGroup=c.poolGroup||'';root.dataset.campaignType=c.smartType||'editorial';
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
  const src=campaignURL(c.image);if(src){const image=document.createElement('img');image.src=src;image.alt=localized(c.imageAlt)||'';image.className='campaign-custom-image';image.onerror=()=>image.remove();
   const mobile=campaignURL(c.mobileImage);
   if(mobile){const picture=document.createElement('picture'),source=document.createElement('source');source.media='(max-width: 650px)';source.srcset=mobile;picture.append(source,image);visual.append(picture);}else visual.append(image);}
 }else{
  for(const item of campaignVisualItems(c).slice(0,3)){
   const src=campaignURL(item.src);if(!src)continue;
   const pedestal=document.createElement('div');pedestal.className='product-pedestal';const image=document.createElement('img');image.src=src;image.alt=localized(item.alt)||'';image.decoding='async';image.onerror=()=>{image.remove();pedestal.textContent='RivFree';};pedestal.append(image);visual.append(pedestal);
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
 let touchStart=null;root.ontouchstart=event=>{touchStart=event.changedTouches[0]?.clientX;};root.ontouchend=event=>{const end=event.changedTouches[0]?.clientX;if(touchStart===null||!Number.isFinite(end)||Math.abs(end-touchStart)<55)return;campaignPositions[slot]=(index+(end<touchStart?1:-1)+items.length)%items.length;renderCampaign(slot);};
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
function renderPopularProducts(){
 renderDiscoverProducts();
 const grid=document.getElementById('popularGrid');if(!grid||typeof PRODUCT_GROUPS==='undefined')return;
 const groups=PRODUCT_GROUPS.filter(g=>g.offers.some(hasPrice));
 let ranked=[],source='editorial';
 if(popularFeed?.items.length){
  const totals=new Map(popularFeed.items.map(i=>[i.url,i.views]));
  ranked=groups.map(g=>({g,count:g.offers.reduce((sum,o)=>sum+(totals.get(o.url)||0),0)})).filter(x=>x.count>0).sort((a,b)=>b.count-a.count).map(x=>x.g);if(ranked.length)source='global';
 }
 if(!ranked.length){ranked=groups.filter(g=>consultations.has(g.key)).sort((a,b)=>consultations.get(b.key).count-consultations.get(a.key).count||consultations.get(b.key).last-consultations.get(a.key).last);if(ranked.length)source='local';}
 document.getElementById('popularProducts').hidden=!ranked.length;
 document.querySelector('a[href="#popularProducts"]').hidden=!ranked.length;
 if(!ranked.length)source='none';
 document.getElementById('popularTitle').textContent=source==='global'?words('Mais consultados','Más consultados'):source==='local'?words('Mais consultados por você','Más consultados por vos'):words('Para descobrir','Para descubrir');
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

let discoveryCatalog=null,discoveryKeys=[];
function renderDiscoverProducts(shuffle=false){
 const grid=document.getElementById('discoverGrid');if(!grid||typeof PRODUCT_GROUPS==='undefined')return;
 if(shuffle||discoveryCatalog!==PRODUCT_GROUPS){
  const eligible=PRODUCT_GROUPS.filter(g=>g.offers.some(hasPrice));
  // Partial Fisher–Yates: five distinct products, stable until refresh or shuffle.
  for(let i=0;i<Math.min(5,eligible.length);i++){const j=i+Math.floor(Math.random()*(eligible.length-i));[eligible[i],eligible[j]]=[eligible[j],eligible[i]];}
  discoveryKeys=eligible.slice(0,5).map(g=>g.key);discoveryCatalog=PRODUCT_GROUPS;
 }
 const byKey=new Map(PRODUCT_GROUPS.map(g=>[g.key,g]));
 const chosen=discoveryKeys.map(key=>byKey.get(key)).filter(Boolean),left=shuffle?0:grid.scrollLeft;
 grid.replaceChildren(...chosen.map(g=>createProductCard({...g,visibleOffers:g.offers})));grid.scrollLeft=left;
 document.getElementById('discoverPrevious').disabled=chosen.length<2;document.getElementById('discoverNext').disabled=chosen.length<2;
}
const autoplayPaused=new Map(),nextAdvance=new Map();
function reduceMotion(){return window.matchMedia('(prefers-reduced-motion: reduce)').matches;}
function updateAutoplayButton(button,id){
 const paused=autoplayPaused.get(id)||reduceMotion();button.textContent=paused?'▶':'Ⅱ';button.setAttribute('aria-pressed',String(paused));button.setAttribute('aria-label',paused?words('Retomar carrossel','Reanudar carrusel'):words('Pausar carrossel','Pausar carrusel'));
}
function toggleAutoplay(id){autoplayPaused.set(id,!autoplayPaused.get(id));nextAdvance.set(id,Date.now()+6000);}
function scrollProductRail(id,direction=1){
 const rail=document.getElementById(id),card=rail.querySelector('.card');if(!card)return;
 const step=card.getBoundingClientRect().width+(parseFloat(getComputedStyle(rail).gap)||0),max=rail.scrollWidth-rail.clientWidth;
 if(max<=1)return;
 const target=direction>0?(rail.scrollLeft>=max-2?0:Math.min(max,rail.scrollLeft+step)):(rail.scrollLeft<=2?max:Math.max(0,rail.scrollLeft-step));
 rail.scrollTo?.({left:target,behavior:reduceMotion()?'instant':'smooth'});nextAdvance.set(id,Date.now()+6000);
}
function canAutoplay(root){
 if(!root||root.hidden||root.closest('[hidden]')||document.hidden||reduceMotion()||autoplayPaused.get(root.id)||root.matches(':hover')||root.contains(document.activeElement))return false;
 const rect=root.getBoundingClientRect();return rect.bottom>0&&rect.top<window.innerHeight;
}
function advanceCarousels(now=Date.now()){
 for(const [id,slot] of [['heroCampaign','hero'],['discoverGrid',null],['popularGrid',null]]){
  const root=document.getElementById(id);
  // Pauses also reset the countdown, so leaving a control never causes a jump.
  if(!canAutoplay(root)){nextAdvance.set(id,now+6000);continue;}
  const scheduled=nextAdvance.get(id);
  // If the clock moved backwards (or a test uses a synthetic clock), restart the
  // countdown instead of leaving autoplay blocked by a timestamp far in the future.
  if(!Number.isFinite(scheduled)||scheduled-now>60000){nextAdvance.set(id,now+6000);continue;}
  if(now<scheduled)continue;
  if(slot){if(campaigns[slot].length>1){campaignPositions[slot]=(campaignPositions[slot]+1)%campaigns[slot].length;renderCampaign(slot,true);}}
  else scrollProductRail(id);
  nextAdvance.set(id,now+6000);
 }
}
for(const [prefix,id] of [['popular','popularGrid'],['discover','discoverGrid']]){
 for(const [suffix,direction] of [['Previous',-1],['Next',1]])document.getElementById(prefix+suffix).onclick=()=>scrollProductRail(id,direction);
 const pause=document.getElementById(prefix+'Pause');pause.onclick=()=>{toggleAutoplay(id);updateAutoplayButton(pause,id);};
 const rail=document.getElementById(id);rail.addEventListener('pointerdown',()=>nextAdvance.set(id,Date.now()+6000));rail.addEventListener('keydown',()=>nextAdvance.set(id,Date.now()+6000));
}
document.getElementById('shuffleDiscover').onclick=()=>{renderDiscoverProducts(true);nextAdvance.set('discoverGrid',Date.now()+6000);};
window.addEventListener('DOMContentLoaded',()=>{for(const [prefix,id] of [['popular','popularGrid'],['discover','discoverGrid']])updateAutoplayButton(document.getElementById(prefix+'Pause'),id);});
setInterval(advanceCarousels,1000);
