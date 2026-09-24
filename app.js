let LANG = 'pt-BR';
try {
 const savedLanguage = localStorage.getItem('rivfree-language');
 LANG = savedLanguage === 'es' || savedLanguage === 'pt-BR' ? savedLanguage : 'pt-BR';
} catch {}
const translations = {
 'Por descubrir':'Por descobrir','Una selección aleatoria para inspirar tu próxima compra.':'Uma seleção aleatória para inspirar sua próxima compra.',
 'Otra selección':'Outra seleção','Pausar carrusel':'Pausar carrossel',
 'Explorá y compará los free shops de Rivera y Santana do Livramento':'Explore e compare os free shops de Rivera e Santana do Livramento',

"Ofertas primero":"Ofertas primeiro",
"Ofertas":"Ofertas",
"Más consultados":"Mais consultados",
"Compará entre free shops":"Compare entre free shops",
"Guardá productos y cantidades":"Salve produtos e quantidades",
"Llevá tu lista en el celular":"Leve sua lista no celular",
"INSPIRACIÓN PARA TU RECORRIDO":"INSPIRAÇÃO PARA SEU PASSEIO",
"EXPLORÁ. COMPARÁ. ELEGÍ.":"EXPLORE. COMPARE. ESCOLHA.",
"Todo el catálogo":"Todo o catálogo",
"Explorá todas las tiendas y encontrá tu próximo favorito.":"Explore todas as lojas e encontre seu próximo favorito.",
"Antes de tu visita.":"Antes da sua visita.",
"Las ofertas primero. Tu próxima compra empieza acá.":"As ofertas primeiro. Sua próxima compra começa aqui.",
"Ofertas destacadas":"Ofertas em destaque",
"Productos anteriores":"Produtos anteriores",
"Más productos":"Mais produtos",
"Campañas destacadas":"Campanhas em destaque",
"Más campañas":"Mais campanhas",

 'Guía de free shops':'Guia de free shops',
 'Consultá las tiendas registradas en RivFree. Confirmá horarios y datos de contacto en los canales oficiales antes de tu visita.':'Consulte as lojas cadastradas no RivFree. Confirme horários e dados de contato nos canais oficiais antes da visita.',
 'Horario no informado':'Horário não informado',
 'Dirección no informada':'Endereço não informado',

 'Electrónica':'Eletrônicos',
"Tu próxima compra.":"Sua próxima compra.",
"Mejor elegida.":"Uma escolha melhor.",
"Compará los free shops, armá tu lista y salí con tu presupuesto en la mano.":"Compare os free shops, monte sua lista e saia com o orçamento na mão.",
"Explorar productos":"Explorar produtos",
"TU RECORRIDO, MÁS SIMPLE":"SEU PASSEIO, MAIS SIMPLES",
"Compará. Guardá.":"Compare. Salve.",
"Disfrutá Rivera.":"Aproveite Rivera.",
"Tu lista va con vos.":"Sua lista vai com você.",
"Del computador al celular, con un enlace.":"Do computador ao celular, com um link.",
"SIN REGISTRO · SIN COMPLICACIONES":"SEM CADASTRO · SEM COMPLICAÇÕES",
"Todas las categorías":"Todas as categorias",
"Chocolates y alimentos":"Chocolates e alimentos",
"Cuidado personal":"Cuidados pessoais",
"· Cotización":"· Cotação",
"Usar cotización automática":"Usar cotação automática",
"Compartir lista":"Compartilhar lista",
"Abrí tu lista en el celular con un enlace. No necesitás una cuenta.":"Abra sua lista no celular com um link. Você não precisa de uma conta.",
"RIVFREE · TU RECORRIDO":"RIVFREE · SEU PASSEIO",
"Enlace de la lista":"Link da lista",
"Categorías":"Categorias",

 'Detalles del catálogo':'Detalhes do catálogo','Precio, ofertas y tiendas':'Preço, ofertas e lojas','USD → BRL · Cotización':'USD → BRL · Cotação',
 'Ver en el mapa':'Ver no mapa','★ Guardado':'★ Salvo','☆ Guardar':'☆ Salvar','Mi lista':'Minha lista','Solo favoritos':'Só favoritos',
 'Explorá y compará los free shops de Rivera':'Explore e compare os free shops de Rivera',
 'Disponibilidad orientativa':'Disponibilidade indicativa',
 'La cantidad de productos publicada aquí no refleja el stock real. En las tiendas físicas suele haber más productos disponibles que los mostrados en sus catálogos web.':'A quantidade de produtos publicada aqui não reflete o estoque real. Nas lojas físicas costuma haver mais produtos disponíveis do que nos catálogos on-line.',
 'Escribí o seleccioná una categoría':'Digite ou selecione uma categoria',
 'Sin categorías coincidentes':'Nenhuma categoria correspondente',
 'Precio mínimo en dólares':'Preço mínimo em dólares',
 'Precio máximo en dólares':'Preço máximo em dólares',
 'Reintentar':'Tentar novamente',
 'No se pudo cargar el catálogo. Revisá tu conexión y reintentá.':'Não foi possível carregar o catálogo. Verifique sua conexão e tente novamente.',
 'Ingresá precios válidos, mayores o iguales a cero.':'Digite preços válidos, maiores ou iguais a zero.',
 'El precio mínimo no puede superar el máximo.':'O preço mínimo não pode superar o máximo.',
 'Resultados aproximados':'Resultados aproximados',
 'Buscar producto':'Buscar produto','Buscar':'Buscar','Categoría':'Categoria','Todas':'Todas',
 'Precio USD':'Preço em USD','Ordenar por':'Ordenar por','Precio: menor a mayor':'Preço: menor para maior',
 'Precio: mayor a menor':'Preço: maior para menor','Nombre: A-Z':'Nome: A-Z','Solo ofertas':'Somente ofertas',
 'Limpiar filtros':'Limpar filtros','Mostrar más productos':'Mostrar mais produtos',
 'Escribí tu búsqueda completa y presioná Enter.':'Digite sua busca completa e pressione Enter.',
 'Buscando productos…':'Buscando produtos…','Cargando productos...':'Carregando produtos...',
 'No se encontraron productos con esos filtros.':'Nenhum produto encontrado com esses filtros.',
 'Probá ampliar la búsqueda.':'Tente ampliar a busca.',
 'Comparar precios':'Comparar preços','Información de la tienda':'Informações da loja',
 'Datos de contacto y enlaces oficiales':'Contatos e links oficiais',
 'RivFree · Comparador independiente':'RivFree · Comparador independente',
 'No realizamos ventas ni estamos afiliados a las tiendas. Los precios y la disponibilidad son orientativos y pueden cambiar.\n  Consultá la información actualizada en la publicación oficial de cada tienda.':'Não realizamos vendas nem somos afiliados às lojas. Os preços e a disponibilidade são indicativos e podem mudar. Consulte as informações atualizadas na publicação oficial de cada loja.',
 'Imagen no disponible':'Imagem indisponível','Precio no disponible':'Preço indisponível',
 'Seleccioná para comparar las tiendas':'Selecione para comparar as lojas','Oferta':'Oferta',
 'No disponible':'Indisponível','Precio más bajo':'Menor preço','Ver en tienda ↗':'Ver na loja ↗','Sin enlace':'Sem link',
 'Dirección':'Endereço','Teléfono':'Telefone','Correo':'E-mail','Horario':'Horário','Información':'Informações',
 'Sitio oficial':'Site oficial','No hay información adicional disponible.':'Não há informações adicionais disponíveis.',
 'Modo claro':'Modo claro','Modo oscuro':'Modo escuro',
 'Cerrar':'Fechar','Cerrar aviso':'Fechar aviso','Volver al inicio y recargar':'Voltar ao início e recarregar',
 'Aviso sobre disponibilidad':'Aviso sobre disponibilidade',
 'PRIVACIDAD · RIVFREE':'PRIVACIDADE · RIVFREE',
 'Ayudanos a mejorar RivFree':'Ajude a melhorar o RivFree',
 'Con tu permiso usamos estadísticas de uso para saber qué se busca, qué filtros se usan y dónde mejorar la experiencia. Si activás Clarity, también podremos analizar mapas de calor y grabaciones de sesión con contenido sensible enmascarado.':'Com sua permissão, usamos estatísticas para entender o que é buscado, quais filtros são usados e onde melhorar a experiência. Se você ativar o Clarity, também poderemos analisar mapas de calor e gravações de sessão com conteúdo sensível mascarado.',
 'Solo esenciales':'Somente essenciais','Permitir estadísticas':'Permitir estatísticas','Privacidad y estadísticas':'Privacidade e estatísticas',
 'Disponibilidad orientativa.':'Disponibilidade indicativa.',
 'La web refleja catálogos online, no el stock físico completo de cada tienda.':'A web reflete catálogos online, não o estoque físico completo de cada loja.',
 'Filtros avanzados':'Filtros avançados','Precio, orden, ofertas y tiendas':'Preço, ordem, ofertas e lojas',
 'Ej.: perfume Dior, whisky, parlante JBL':'Ex.: perfume Dior, whisky, caixa de som JBL',
 'Sin datos':'Sem dados','Sin fecha':'Sem data','Actualización parcial':'Atualização parcial',
 'Los datos tienen más de 48 horas':'Os dados têm mais de 48 horas',
 'No se pudo cargar data/products.json. ¿Ya corriste el scraper?':'Não foi possível carregar o catálogo. Tente recarregar a página.',
 'Abriendo la publicación original en otra pestaña':'Abrindo a publicação original em outra aba',
 'Volver arriba':'Voltar ao topo','Cambiar idioma':'Alterar idioma',
};
function tr(value) {
 if(LANG==='es') return value;
 if(translations[value]) return translations[value];
 return value.replace(/^Actualizado: /,'Atualizado: ').replace(/^Datos anteriores: /,'Dados anteriores: ')
 .replace(/^Ver información de /,'Ver informações de ').replace(/^Ver en /,'Ver em ')
 .replace(/^Desde /,'A partir de ').replace(/tiendas · precios de menor a mayor/,'lojas · preços do menor para o maior')
 .replace(/\bproductos?\b/g,m=>m==='producto'?'produto':'produtos')
 .replace(/\bprecios?\b/g,m=>m==='precio'?'preço':'preços')
 .replace(/\bdisponibles?\b/g,m=>m==='disponible'?'disponível':'disponíveis')
 .replace(/\bsin precio\b/g,'sem preço').replace(/\bsin preço\b/g,'sem preço')
 .replace(/publicaciones totales/,'publicações no total').replace(/mostrando/,'exibindo');
}
const textSources = new WeakMap();
function translateUI() {
 document.documentElement.lang=LANG;
 document.title = LANG==='pt-BR' ? 'RivFree — Comparador de preços de free shops' : 'RivFree — Comparador de precios de free shops';
 const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
 while(walker.nextNode()) {
  const n=walker.currentNode;
  if(n.parentElement.closest('#grid,#resultsMeta,script,style,.card-name,.offer-name,.card-store,#dialogTitle,#storeDialogTitle,.store-detail > span:not(.store-detail-label)')) continue;
  const prev=textSources.get(n);
  const source=prev && n.nodeValue===prev.output ? prev.source : n.nodeValue;
  const trimmed=source.trim(); if(!trimmed) continue;
  const output=source.replace(trimmed,tr(trimmed)); n.nodeValue=output; textSources.set(n,{source,output});
 }
 document.querySelectorAll('[aria-label],[placeholder],[title]').forEach(el=>{
  if(el.matches('.product-target')) return;
  for(const attr of ['aria-label','placeholder','title']) {
   if(!el.hasAttribute(attr)) continue;
   const key='source'+attr.replace('-','');
   const source=el.dataset[key] || el.getAttribute(attr);
   el.dataset[key]=source;el.setAttribute(attr,tr(source));
  }
 });
 document.querySelectorAll('#categoria option').forEach(o=>{o.textContent=o.value?Catalog.categories[o.value][LANG==='pt-BR'?1:0]:tr('Todas');});
 document.getElementById('languageToggle').value=LANG;
 syncCategoryInput();
}
function storeKey(name) {
 const s=Catalog.norm(name);
 return s.includes('neutral')?'neutral':s.includes('barao')?'barao':s.includes('yury')?'yury':s.includes('dfa')?'dfa':s.includes('mantra')?'mantra':s.includes('sineriz')?'sineriz':s.includes('oprha')||s.includes('orpha')?'oprha':'other';
}
function announce(message) {
 const el=document.getElementById('actionStatus');el.textContent=message;el.hidden=false;
 clearTimeout(announce.timer);announce.timer=setTimeout(()=>{el.hidden=true;},3500);
}


const CARD_DATA=new WeakMap();
function handleProductClick(event){
 const target=event.target.closest('[data-action]');
 if(!target||!event.currentTarget.contains(target))return;
 if(target.dataset.action==='store'){
  // Store chips are informational controls only. They must never trigger
  // the product link / comparison action underneath them.
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  openStoreInfo(target.dataset.storeName);
  return;
 }
 const data=CARD_DATA.get(target.closest('.card'));
 if(target.dataset.action==='history'&&data){openPriceHistory(data.offers);return;}
 if(target.dataset.action==='favorite'&&data){toggleFavorite(data.key);return;}
 if(target.dataset.action==='preview'&&data){recordProductConsult(data.key);openProductPreview(data);return;}
 if(data&&['compare','external'].includes(target.dataset.action))recordProductConsult(data.key);
 if(target.dataset.action==='compare'&&data)openComparison(data.name,data.offers);
 if(target.dataset.action==='external')announce(tr('Abriendo la publicación original en otra pestaña'));
}
for(const id of ['grid','popularGrid','discoverGrid'])document.getElementById(id).addEventListener('click',handleProductClick);
document.getElementById('retryLoad').addEventListener('click',loadData);
let SEARCH_WORDS=[];
const SEARCH_CACHE=new Map();
function editDistance(a,b,limit) {
 if(Math.abs(a.length-b.length)>limit)return limit+1;
 let row=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){
  const next=[i];for(let j=1;j<=b.length;j++)next[j]=Math.min(next[j-1]+1,row[j]+1,row[j-1]+(a[i-1]!==b[j-1]));
  if(Math.min(...next)>limit)return limit+1;row=next;
 }return row[b.length];
}
function searchAlternatives(token){
 if(SEARCH_CACHE.has(token))return SEARCH_CACHE.get(token);
 const out=[token];
 // Never approximate quantities, model codes, short tokens or concentrations.
 if(token.length>=5&&!/\d/.test(token)){
  const limit=token.length>=7?2:1;
  SEARCH_WORDS.forEach(word=>{if(!/\d/.test(word)&&word[0]===token[0]&&editDistance(token,word,limit)<=limit)out.push(word);});
  if(token==='johny')out.push('johnnie');
 }
 if(SEARCH_CACHE.size>200)SEARCH_CACHE.clear();SEARCH_CACHE.set(token,out);return out;
}
function readPriceRange(){
 const read=id=>{const el=document.getElementById(id);return el.value.trim()===''?NaN:Number(el.value);};
 return {min:read('minPrice'),max:read('maxPrice')};
}
function validatePrices(){
 const {min,max}=readPriceRange();let message='';
 for(const id of ['minPrice','maxPrice']){
  const el=document.getElementById(id),value=el.valueAsNumber;
  const invalid=el.validity.badInput||(el.value!==''&&(!Number.isFinite(value)||value<0));
  el.setAttribute('aria-invalid',String(invalid));if(invalid)message='Ingresá precios válidos, mayores o iguales a cero.';
 }
 if(!message&&Number.isFinite(min)&&Number.isFinite(max)&&min>max){message='El precio mínimo no puede superar el máximo.';['minPrice','maxPrice'].forEach(id=>document.getElementById(id).setAttribute('aria-invalid','true'));}
 const error=document.getElementById('priceError');error.hidden=!message;error.textContent=tr(message);return !message;
}

let ALL_PRODUCTS = [];
let PRODUCT_GROUPS = [];
let STORE_INFO = {};
let ACTIVE_SEARCH = '';
const PAGE_SIZE = 96;
let visibleLimit = PAGE_SIZE;

function applyTheme(theme) {
  const isDark = theme === 'dark';
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  const button = document.getElementById('themeToggle');
  button.setAttribute('aria-pressed', String(isDark));
  const label=button.querySelector('.theme-mode-label');
  if(label) label.textContent = isDark ? tr('Modo claro') : tr('Modo oscuro');
  else button.textContent = isDark ? tr('Modo claro') : tr('Modo oscuro');
}

function initialTheme() {
  try {
    const saved = localStorage.getItem('comparador-theme');
    if (saved) return saved;
  } catch {}
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

applyTheme(initialTheme());

function priceLabel(value) {
  const usd='USD ' + new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
  return usd+(validExchange()?' · ≈ '+new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value*exchange.usd_brl):'');
}

let loadingCatalog=false;
async function loadData() {
  if(loadingCatalog)return;
  loadingCatalog=true;
  document.getElementById('retryLoad').disabled=true;
  document.getElementById('loadError').hidden=true;
  try {
    const [loaded, storesRes, ratesRes] = await Promise.all([
      loadCatalog(), fetch('data/stores.json',{cache:'default'}).catch(()=>null), fetch('data/exchange.json',{cache:'default'}).catch(()=>null)
    ]);
    const {data,prepared,offline}=loaded;
    if(storesRes?.ok) STORE_INFO=await storesRes.json();
    if(ratesRes?.ok) {try {const bundled=await ratesRes.json();if(isRate(bundled)&&(!automaticExchange||bundled.actualizado>automaticExchange.actualizado))automaticExchange=bundled;} catch {}}
    ALL_PRODUCTS=prepared.products;
    PRODUCT_GROUPS=prepared.groups;
    indexFavoriteOffers();
    migrateFavorites(PRODUCT_GROUPS,prepared.legacyKeys);
    SEARCH_WORDS=prepared.words;
    document.getElementById('connectionNote').hidden=!offline;
    updateExchangeNote();
    refreshAutomaticExchange();
    SEARCH_CACHE.clear();

    const updated = data.actualizado ? new Date(data.actualizado) : null;
    const badge = document.getElementById('updatedBadge');
    badge.classList.remove('stale'); badge.title='';badge.dataset.status='fresh';
    const staleStores = (Array.isArray(data.resumen) ? data.resumen : [])
      .filter(store => store.datos_anteriores || store.error).map(store => store.tienda);
    badge.textContent = updated
      ? updated.toLocaleString('es-UY', {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})
      : tr('Sin fecha');
    if(updated) badge.title='Actualizado: '+updated.toLocaleString('es-UY', {dateStyle:'medium',timeStyle:'short'});
    if (staleStores.length) {
      badge.classList.add('stale');badge.dataset.status='partial';
      badge.textContent = tr('Actualización parcial');
      badge.title = `Datos anteriores: ${staleStores.join(', ')}`;
    } else if (updated && Date.now() - updated.getTime() > 48 * 60 * 60 * 1000) {
      badge.classList.add('stale');badge.dataset.status='stale';
      badge.title = tr('Los datos tienen más de 48 horas');
    }

    populateFilters();
    renderCampaigns();
    document.querySelectorAll('[data-category-shortcut],#navOffers').forEach(b=>b.disabled=false);
    restoreFilters();
    translateUI();
    render();
  } catch (e) {
    document.getElementById('loadError').hidden=false;
    document.getElementById('loadErrorText').textContent=tr('No se pudo cargar el catálogo. Revisá tu conexión y reintentá.');
    document.getElementById('resultsMeta').textContent='';
    document.getElementById('updatedBadge').textContent = 'Sin datos';
    translateUI();
    console.error(e);
  } finally {loadingCatalog=false;document.getElementById('retryLoad').disabled=false;}
}

function populateFilters() {
  const stores = [...new Set(ALL_PRODUCTS.map(p => p.tienda))].sort();
  const storesField = document.getElementById('storesField');
  storesField.replaceChildren();
  stores.forEach(store => {
    const label = document.createElement('label');
    label.className = 'chk store-filter-chip';
    label.dataset.store = storeKey(store);
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = store;
    checkbox.className = 'storeChk';
    checkbox.checked = true;
    const text=document.createElement('span');text.className='store-filter-name';text.textContent=store;
    // Advanced filters intentionally use store names only: no third-party logos.
    label.append(checkbox,text);
    storesField.appendChild(label);
  });
  storesField.querySelectorAll('.storeChk').forEach(el => el.addEventListener('change', () => render(true)));

  const categories = [...new Set(
    ALL_PRODUCTS.map(p => p.categoryId)
  )].sort((a, b) => a.localeCompare(b, 'es'));
  const catSelect = document.getElementById('categoria');
  catSelect.replaceChildren(new Option(tr('Todas'),''));
  categories.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = Catalog.categories[c][LANG === 'pt-BR' ? 1 : 0];
    catSelect.appendChild(opt);
  });
}

function getFiltered() {
  const query = Catalog.searchQuery(ACTIVE_SEARCH);
  const searchTokens = query.tokens;

  const cat = document.getElementById('categoria').value;
  const {min,max}=readPriceRange();
  const soloOfertas = document.getElementById('soloOfertas').checked;
  const activeStores = [...document.querySelectorAll('.storeChk:checked')].map(el => el.value);
  const orden = document.getElementById('orden').value;

  let groups = PRODUCT_GROUPS.filter(g=>!document.getElementById('favoritesOnly').checked || (favorites.has(g.key)||g.offers.some(o=>favorites.has(offerFavoriteKey(o))))).map(group => {
    const visibleOffers = group.offers.filter(product => {
      if (!activeStores.includes(product.tienda)) return false;
      if (cat && product.categoryId !== cat) return false;
      if (!isNaN(min) && (!hasPrice(product) || product.precio_usd < min)) return false;
      if (!isNaN(max) && (!hasPrice(product) || product.precio_usd > max)) return false;
      if (soloOfertas && !product.en_oferta) return false;
      return true;
    });
    return {...group, visibleOffers};
  }).filter(group => {
    if (!group.visibleOffers.length) return false;
    if (!searchTokens.length) return true;
    return true;
  });
  if(searchTokens.length){
    const exact=groups.filter(g=>g.visibleOffers.some(p=>Catalog.matchesSearch(p,query)));
    if(exact.length)groups=exact;
    else {
      const alternatives=searchTokens.map(searchAlternatives);
      groups=groups.filter(g=>g.visibleOffers.some(p=>alternatives.every(options=>options.some(t=>p.searchIndex.split(' ').includes(t)))));
      groups.forEach(g=>{g.approximate=true;});
    }
  }

  const lowestPrice = group => {
    const priced = group.visibleOffers.find(hasPrice);
    return priced ? priced.precio_usd : Number.POSITIVE_INFINITY;
  };
  if (orden === 'ofertas') groups.sort((a,b)=>Number(b.visibleOffers.some(p=>p.en_oferta&&hasPrice(p)))-Number(a.visibleOffers.some(p=>p.en_oferta&&hasPrice(p)))||lowestPrice(a)-lowestPrice(b));
  else if (orden === 'precio_asc') groups.sort((a,b) => lowestPrice(a) - lowestPrice(b));
  else if (orden === 'precio_desc') groups.sort((a,b) => {
    const aPrice = lowestPrice(a), bPrice = lowestPrice(b);
    if (!Number.isFinite(aPrice)) return 1;
    if (!Number.isFinite(bPrice)) return -1;
    return bPrice - aPrice;
  });
  else if (orden === 'nombre_asc') groups.sort((a,b) => a.name.localeCompare(b.name, 'es'));

  return groups;
}

function render(resetLimit = false) {
  if (resetLimit === true) visibleLimit = PAGE_SIZE;
  if(!validatePrices())return;
  syncFiltersURL();
  document.body.classList.toggle('search-results-mode',Boolean(ACTIVE_SEARCH.trim()));
  if(!ACTIVE_SEARCH.trim())renderPopularProducts();
  const items = getFiltered();
  const grid = document.getElementById('grid');
  const empty = document.getElementById('emptyState');
  const meta = document.getElementById('resultsMeta');
  const loadMoreWrap = document.getElementById('loadMoreWrap');
  const visibleItems = items.slice(0, visibleLimit);

  const offersShown = items.reduce((total, group) => total + group.visibleOffers.length, 0);
  const pricedShown = items.reduce((total, group) =>
    total + group.visibleOffers.filter(hasPrice).length, 0);
  const unavailable = offersShown - pricedShown;
  const shownText = items.length > visibleItems.length ? ` · mostrando ${visibleItems.length}` : '';
  meta.textContent = tr(`${items.length.toLocaleString(LANG)} producto${items.length === 1 ? '' : 's'}${shownText}`);
  document.getElementById('resultsDetails').textContent = tr(`${pricedShown} precios disponibles · ${unavailable} sin precio · ${ALL_PRODUCTS.length} publicaciones totales`);

  if (items.length === 0) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    loadMoreWrap.hidden = true;
    return;
  }
  empty.style.display = 'none';
  loadMoreWrap.hidden = visibleItems.length >= items.length;

  if(items.some(g=>g.approximate))meta.textContent+=' · '+tr('Resultados aproximados');
  const cards = visibleItems.map(createProductCard);
  grid.replaceChildren(...cards);
}

function waitForPaint() {
  return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

async function runSearch() {
  const status = document.getElementById('searchStatus');
  const button = document.getElementById('searchButton');
  const meta = document.getElementById('resultsMeta');
  status.classList.add('visible');
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  await waitForPaint();

  ACTIVE_SEARCH = document.getElementById('search').value.trim();
  render(true);

  status.classList.remove('visible');
  button.disabled = false;
  button.removeAttribute('aria-busy');
  meta.classList.remove('search-complete');
  void meta.offsetWidth;
  meta.classList.add('search-complete');

  // A submitted search should take the user directly to the catalog results.
  // Keep this tied to form submission only, so changing a filter does not move the page.
  await waitForPaint();
  const grid = document.getElementById('grid');
  const emptyState = document.getElementById('emptyState');
  const resultsAnchor = grid?.children?.length
    ? grid
    : (emptyState && getComputedStyle(emptyState).display !== 'none' ? emptyState : meta);
  if (resultsAnchor && typeof resultsAnchor.scrollIntoView === 'function') {
    const reduceMotion = typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    resultsAnchor.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'start'
    });
  }
}

function addImagePlaceholder(container) {
  container.replaceChildren();
  const noImage = document.createElement('span');
  noImage.className = 'noimg';
  noImage.textContent = tr('Imagen no disponible');
  container.appendChild(noImage);
}

function createStoreTag(storeName) {
  const button = document.createElement('button');
  button.className = 'card-store';
  button.dataset.store = storeKey(storeName);
  button.type = 'button';
  const label=document.createElement('span');label.className='card-store-label';label.textContent=storeName;
  button.appendChild(label);
  button.setAttribute('aria-label', tr(`Ver información de ${storeName}`));
  button.dataset.action='store';button.dataset.storeName=storeName;
  // Handle the store chip at the control itself so the click cannot bubble
  // into a product link/card action in any browser.
  button.addEventListener('click',event=>{
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openStoreInfo(storeName);
  });
  return button;
}

function appendCardPrice(container,value,multiple=false){
  if(!Number.isFinite(value)||value<=0){container.className='price-unavailable';container.textContent=tr('Precio no disponible');return;}
  container.className='card-price';
  if(multiple){const prefix=document.createElement('span');prefix.className='card-price-prefix';prefix.textContent=tr('Desde');container.appendChild(prefix);}
  const main=document.createElement('span');main.className='card-price-main';
  const currency=document.createElement('span');currency.className='card-price-currency';currency.textContent='USD';
  const amount=document.createElement('strong');amount.className='card-price-amount';amount.textContent=new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
  main.append(currency,amount);container.appendChild(main);
  if(validExchange()){const secondary=document.createElement('span');secondary.className='card-price-secondary';secondary.textContent='≈ '+new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value*exchange.usd_brl);container.appendChild(secondary);}
}

function readableProductName(value) {
  // Only soften all-uppercase catalog names. Preserve acronyms and model codes.
  if(value !== value.toLocaleUpperCase())return value;
  const acronyms=new Set(['JBL','LG','HP','USB','LED','TV','EDP','EDT','EDC','USA','UV','SPF','DFA']);
  return value.replace(/[\p{L}\p{N}]+/gu, word=>acronyms.has(word)||/\d/.test(word)
    ? word : word[0]+word.slice(1).toLocaleLowerCase());
}

function createProductCard(group) {
  const offers = group.visibleOffers;
  const product = offers[0];
  const displayName = [...offers].sort((a, b) => b.nombre.length - a.nombre.length)[0].nombre;
  const stores=[...new Set(offers.map(offer => offer.tienda))];
  const storeCount = stores.length;
  const card = document.createElement('article');
  CARD_DATA.set(card,{name:displayName,offers,key:group.key});
  card.className = storeCount > 1 ? 'card comparison-card' : 'card';

  const targetUrl = safeHttpUrl(product.url);
  const interactive = storeCount > 1 || targetUrl;
  const imageBox = document.createElement('button');
  imageBox.className = 'card-img';
  const imageStage=document.createElement('span');imageStage.className='card-image-stage';
  const imageUrl = safeHttpUrl(offers.find(offer => safeHttpUrl(offer.imagen))?.imagen || group.image);
  if (imageUrl) {
    const img = document.createElement('img');
    img.src = imageUrl;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.alt = displayName;
    img.addEventListener('error', () => addImagePlaceholder(imageStage), {once:true});
    imageStage.appendChild(img);
  } else {
    addImagePlaceholder(imageStage);
  }
  imageBox.appendChild(imageStage);

  // Keep store controls OUTSIDE the product anchor/button. Nesting a button
  // inside a link is invalid interactive HTML and can fire both actions in
  // some browsers. Below the photo, each store only opens its own information.
  const overlay=document.createElement('div');overlay.className='store-tags card-stores';
  if(storeCount>1){const count=document.createElement('span');count.className='store-count';count.textContent=LANG==='pt-BR'?`Em ${storeCount} lojas`:`En ${storeCount} tiendas`;overlay.appendChild(count);}
  stores.forEach(storeName=>overlay.appendChild(createStoreTag(storeName)));

  const body = document.createElement('div');
  body.className = 'card-body';

  const utilityRow=document.createElement('div');utilityRow.className='card-utility-row';
  const favorite=document.createElement('button');favorite.type='button';favorite.className='favorite-button';
  favorite.dataset.action='favorite';favorite.setAttribute('aria-pressed',String(favorites.has(group.key)));
  favorite.textContent=favorites.has(group.key)?'♥':'♡';
  favorite.classList.add('heart-button');
  favorite.setAttribute('aria-label',tr(favorites.has(group.key)?'★ Guardado':'☆ Guardar')+': '+displayName);
  favorite.title=tr(favorites.has(group.key)?'★ Guardado':'☆ Guardar');
  const historyButton=document.createElement('button');historyButton.type='button';historyButton.className='favorite-button';historyButton.dataset.action='history';historyButton.textContent=LANG==='pt-BR'?'Histórico':'Historial';
  utilityRow.append(historyButton);
  if(favorites.has(group.key))utilityRow.append(quantityControl(group.key,()=>{}));

  const badges = document.createElement('div');
  badges.className = 'badge-row';
  if (product.en_oferta) {
    const offer = document.createElement('span');
    offer.className = 'badge-oferta';
    offer.textContent = tr('Oferta');
    badges.appendChild(offer);
  }
  if (storeCount > 1) {
    const comparison = document.createElement('span');
    comparison.className = 'badge-best';
    comparison.textContent = tr(`${offers.length} precios`);
    badges.appendChild(comparison);
  }
  if(badges.childElementCount)body.appendChild(badges);

  const name = document.createElement(targetUrl ? 'a' : 'div');
  name.className = 'card-name';
  name.textContent = readableProductName(displayName);
  body.appendChild(name);

  const priceRow = document.createElement('div');
  priceRow.className = 'card-price-row';
  const price = document.createElement('div');
  appendCardPrice(price,hasPrice(product)?product.precio_usd:null,storeCount>1);
  priceRow.appendChild(price);
  if (product.en_oferta && Number.isFinite(product.precio_original_usd) && product.precio_original_usd > 0) {
    const oldPrice = document.createElement('span');
    oldPrice.className = 'card-price-old';
    oldPrice.textContent = priceLabel(product.precio_original_usd).split(' · ')[0];
    priceRow.appendChild(oldPrice);
  }
  body.appendChild(priceRow);
  imageBox.type='button';imageBox.dataset.action='preview';imageBox.classList.add('product-target');
  imageBox.setAttribute('aria-haspopup','dialog');
  imageBox.setAttribute('aria-label',words('Ampliar produto','Ampliar producto')+': '+displayName);
  if(targetUrl){name.href=targetUrl;name.target='_blank';name.rel='noopener noreferrer';name.dataset.action='external';name.classList.add('product-target');}
  body.appendChild(utilityRow);
  card.append(imageBox, favorite, overlay, body);

  if (storeCount > 1) {
    const button = document.createElement('button');
    button.className = 'card-action';
    button.type = 'button';
    button.textContent = tr('Comparar precios');
    button.dataset.action='compare';
    card.appendChild(button);
  } else {
    const productUrl = safeHttpUrl(product.url);
    if (!productUrl) return card;
    const link = document.createElement('a');
    link.className = 'card-link card-cta';
    link.dataset.action='external';
    link.href = productUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = tr(`Ver en ${product.tienda} ↗`);
    link.setAttribute('aria-label', `Ver ${product.nombre} en ${product.tienda}`);
    card.appendChild(link);
  }
  return card;
}

function openComparison(name, offers) {
  const dialog = document.getElementById('comparisonDialog');
  const list = document.getElementById('comparisonList');
  const sorted = [...offers].sort(compareOfferPrices);
  document.getElementById('dialogTitle').textContent = name;
  document.getElementById('dialogSubtitle').textContent =
    tr(`${new Set(sorted.map(offer => offer.tienda)).size} tiendas · precios de menor a mayor`);

  const rows = sorted.map((offer, index) => {
    const row = document.createElement('div');
    row.className = index === 0 && hasPrice(offer) ? 'offer-row cheapest' : 'offer-row';

    const info = document.createElement('div');
    const store = document.createElement('button');
    store.className = 'offer-store store-link-plain card-store';
    store.dataset.store = storeKey(offer.tienda);
    store.type = 'button';
    store.textContent = offer.tienda;
    store.addEventListener('click', () => openStoreInfo(offer.tienda));
    const offerName = document.createElement('div');
    offerName.className = 'offer-name';
    offerName.textContent = offer.nombre;
    info.append(store, offerName);

    const price = document.createElement('div');
    price.className = 'offer-price';
    price.textContent = tr(hasPrice(offer) ? priceLabel(offer.precio_usd) : 'No disponible');
    if (index === 0 && hasPrice(offer)) {
      const cheapest = document.createElement('span');
      cheapest.className = 'cheapest-label';
      cheapest.textContent = tr('Precio más bajo');
      price.appendChild(cheapest);
    }

    const productUrl = safeHttpUrl(offer.url);
    const link = document.createElement(productUrl ? 'a' : 'span');
    link.className = 'offer-link';
    link.textContent = tr(productUrl ? 'Ver en tienda ↗' : 'Sin enlace');
    if (productUrl) {
      link.href = productUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
    row.append(info, price, link, offerFavoriteControls(offer));
    return row;
  });
  list.replaceChildren(...rows);
  if (!dialog.open) dialog.showModal();
}

function appendStoreDetail(container, label, value) {
  if (!value) return;
  const item = document.createElement('div');
  item.className = 'store-detail';
  const title = document.createElement('span');
  title.className = 'store-detail-label';
  title.textContent = label;
  const text = document.createElement('span');
  text.textContent = value;
  item.append(title, text);
  container.appendChild(item);
}

function fillStoreInfo(container,storeName) {
  const info = STORE_INFO[storeName] || {};
  container.replaceChildren();
  appendStoreDetail(container, 'Dirección', info.direccion || tr('Dirección no informada'));
  appendStoreDetail(container, 'Teléfono', info.telefono);
  appendStoreDetail(container, 'Correo', info.email);
  appendStoreDetail(container, 'Horario', info.horario || tr('Horario no informado'));
  appendStoreDetail(container, 'Información', info.nota);

  const links = document.createElement('div');
  links.className = 'store-links';
  const destinations = {mapa:tr('Ver en el mapa'),sitio_web:'Sitio oficial', instagram:'Instagram', facebook:'Facebook', telegram:'Telegram', whatsapp:'WhatsApp'};
  const urls = {mapa:info.direccion?mapUrl(storeName,info.direccion):null,sitio_web:info.sitio_web, ...(info.redes || {})};
  Object.entries(destinations).forEach(([key, label]) => {
    const url = safeHttpUrl(urls[key]);
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = label;
    links.appendChild(link);
  });
  if (links.childElementCount) container.appendChild(links);
  if (!container.childElementCount) appendStoreDetail(container, 'Información', 'No hay información adicional disponible.');
}
function openStoreInfo(storeName) {
 const dialog=document.getElementById('storeDialog');
 document.getElementById('storeDialogTitle').textContent=STORE_INFO[storeName]?.nombre_completo||storeName;
 fillStoreInfo(document.getElementById('storeInfo'),storeName);
 translateUI();if(!dialog.open)dialog.showModal();
}
let directoryLoading=false;
async function openStoreDirectory(){
 const dialog=document.getElementById('storeDirectoryDialog'),list=document.getElementById('storeDirectoryList'),status=document.getElementById('storeDirectoryStatus'),retry=document.getElementById('retryStoreDirectory');
 if(!dialog.open)dialog.showModal();
 if(directoryLoading)return;
 directoryLoading=true;retry.hidden=true;status.textContent=words('Carregando lojas…','Cargando tiendas…');
 try{
  if(!Object.keys(STORE_INFO).length){
   const response=await fetch('data/stores.json',{cache:'default'});if(!response.ok)throw new Error();
   const data=await response.json();if(!data||Array.isArray(data)||typeof data!=='object'||!Object.keys(data).length)throw new Error();STORE_INFO=data;
  }
  const names=[...new Set([...Object.keys(STORE_INFO),...ALL_PRODUCTS.map(p=>p.tienda)])].filter(Boolean).sort((a,b)=>a.localeCompare(b,LANG));
  list.replaceChildren();
  for(const name of names){
   const card=document.createElement('article');card.className='directory-store';
   const title=document.createElement('h3');title.textContent=STORE_INFO[name]?.nombre_completo||name;
   const details=document.createElement('div');details.className='store-info';fillStoreInfo(details,name);card.append(title,details);list.append(card);
  }
  status.textContent=words(`${names.length} free shops cadastrados`,`${names.length} free shops registrados`);translateUI();
 }catch{status.textContent=words('Não foi possível carregar as lojas. Tente novamente.','No se pudieron cargar las tiendas. Reintentá.');retry.hidden=false;}
 finally{directoryLoading=false;}
}
document.getElementById('openStoreDirectory').addEventListener('click',openStoreDirectory);
document.getElementById('retryStoreDirectory').addEventListener('click',openStoreDirectory);
document.getElementById('closeStoreDirectory').addEventListener('click',()=>document.getElementById('storeDirectoryDialog').close());
document.getElementById('storeDirectoryDialog').addEventListener('click',event=>{if(event.target===event.currentTarget)event.currentTarget.close();});

document.getElementById('dialogClose').addEventListener('click', () => {
  document.getElementById('comparisonDialog').close();
});

document.getElementById('comparisonDialog').addEventListener('click', event => {
  if (event.target === event.currentTarget) event.currentTarget.close();
});

document.getElementById('storeDialogClose').addEventListener('click', () => {
  document.getElementById('storeDialog').close();
});

document.getElementById('storeDialog').addEventListener('click', event => {
  if (event.target === event.currentTarget) event.currentTarget.close();
});

document.getElementById('themeToggle').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  translateUI();
  try { localStorage.setItem('comparador-theme', next); } catch {}
});

document.getElementById('searchForm').addEventListener('submit', event => {
  event.preventDefault();
  runSearch();
});

['categoria','orden','soloOfertas'].forEach(id => {
  document.getElementById(id).addEventListener('change', () => render(true));
});

['minPrice','maxPrice'].forEach(id => {
  const input = document.getElementById(id);
  input.addEventListener('wheel', event => { if (document.activeElement === input) event.preventDefault(); }, {passive:false});
  input.addEventListener('change', () => render(true));
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') render(true);
  });
});

document.getElementById('loadMore').addEventListener('click', () => {
  visibleLimit += PAGE_SIZE;
  render(false);
});

const stockNotice = document.getElementById('stockNotice');
try {
  if (sessionStorage.getItem('rivfree-stock-notice-dismissed') === 'true') stockNotice.hidden = true;
} catch {}

document.getElementById('stockNoticeClose').addEventListener('click', () => {
  stockNotice.hidden = true;
  try { sessionStorage.setItem('rivfree-stock-notice-dismissed', 'true'); } catch {}
});

document.getElementById('clearFilters').addEventListener('click', () => {
  document.getElementById('search').value = '';
  ACTIVE_SEARCH = '';
  document.getElementById('categoria').value = '';
  document.getElementById('minPrice').value = '';
  document.getElementById('maxPrice').value = '';
  document.getElementById('orden').value = 'nombre_asc';
  document.getElementById('soloOfertas').checked = false;
  document.getElementById('favoritesOnly').checked = false;
  document.querySelectorAll('.storeChk').forEach(el => { el.checked = true; });
  render(true);
});


let categoryActive = -1;
function syncCategoryInput() {
 const input=document.getElementById('categorySearch');
 const select=document.getElementById('categoria');
 input.value=select.value ? Catalog.categories[select.value][LANG==='pt-BR'?1:0] : '';
 closeCategoryOptions();
}
function closeCategoryOptions() {
 document.getElementById('categoryOptions').hidden=true;
 const input=document.getElementById('categorySearch');
 input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');
 categoryActive=-1;
}
function showCategoryOptions() {
 const input=document.getElementById('categorySearch');
 const list=document.getElementById('categoryOptions');
 const terms=Catalog.search(input.value).split(/\s+/).filter(Boolean);
 const options=[...document.getElementById('categoria').options].filter(o=>{
  const text=o.value ? Catalog.search(Catalog.categories[o.value].join(' ')) : Catalog.search('Todas Todos');
  return !terms.length || terms.every(t=>text.includes(t));
 });
 list.replaceChildren();categoryActive=-1;input.removeAttribute('aria-activedescendant');
 options.forEach((o,i)=>{
  const item=document.createElement('div');item.role='option';item.id='category-option-'+i;
  item.dataset.value=o.value;item.textContent=o.textContent;
  item.setAttribute('aria-selected',String(o.value===document.getElementById('categoria').value));
  item.addEventListener('mousedown',e=>e.preventDefault());
  item.addEventListener('click',()=>chooseCategory(o.value));list.appendChild(item);
 });
 if(!options.length){const empty=document.createElement('div');empty.className='category-empty';empty.textContent=tr('Sin categorías coincidentes');list.appendChild(empty);}
 list.hidden=false;input.setAttribute('aria-expanded','true');
}
function chooseCategory(value) {
 document.getElementById('categoria').value=value;
 render(true);syncCategoryInput();document.getElementById('categorySearch').focus();closeCategoryOptions();
}
const categorySearch=document.getElementById('categorySearch');
categorySearch.addEventListener('focus',showCategoryOptions);
categorySearch.addEventListener('click',showCategoryOptions);
categorySearch.addEventListener('input',()=>{
 if(!categorySearch.value){document.getElementById('categoria').value='';render(true);}
 showCategoryOptions();
});
categorySearch.addEventListener('blur',syncCategoryInput);
categorySearch.addEventListener('keydown',event=>{
 if(event.key==='Escape'){event.preventDefault();syncCategoryInput();return;}
 if(!['ArrowDown','ArrowUp','Enter'].includes(event.key))return;
 event.preventDefault();
 if(document.getElementById('categoryOptions').hidden)showCategoryOptions();
 const items=[...document.querySelectorAll('#categoryOptions [role="option"]')];
 if(!items.length)return;
 if(event.key==='Enter'){chooseCategory(items[Math.max(0,categoryActive)].dataset.value);return;}
 categoryActive=(categoryActive+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;
 items.forEach((item,i)=>item.classList.toggle('active',i===categoryActive));
 categorySearch.setAttribute('aria-activedescendant',items[categoryActive].id);
 items[categoryActive].scrollIntoView?.({block:'nearest'});
});

document.getElementById('languageToggle').addEventListener('change', event => {
 LANG=event.target.value;
 try {localStorage.setItem('rivfree-language',LANG);} catch {}
 document.querySelectorAll('dialog[open]').forEach(d=>d.close());
 render(); translateUI(); renderCampaigns(); updateExchangeNote(); if(document.getElementById('shoppingDialog').open)renderShoppingList();
});
const backToTop=document.getElementById('backToTop');
window.addEventListener('scroll',()=>{backToTop.hidden=window.scrollY<600;},{passive:true});
backToTop.addEventListener('click',()=>{
 window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 document.querySelector('.brand-link').focus({preventScroll:true});
});
document.getElementById('closeHistory').addEventListener('click',()=>document.getElementById('historyDialog').close());
translateUI();
initStorefront();
loadData();
