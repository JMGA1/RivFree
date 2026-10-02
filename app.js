let LANG = 'pt-BR';
try {
 const savedLanguage = localStorage.getItem('rivfree-language');
 LANG = savedLanguage === 'es' || savedLanguage === 'pt-BR' ? savedLanguage : 'pt-BR';
} catch {}
if(document.documentElement.dataset.seoHome) LANG=document.documentElement.dataset.seoHome;
const translations = {
 'Favoritos y conversión':'Favoritos e conversão',
 'Cotización':'Cotação',
 'Reales por dólar':'Reais por dólar',
 'Cerrar / Fechar':'Fechar / Cerrar',
 'Productos siguientes':'Próximos produtos',
 'Compará precios de free shops en Rivera y Livramento':'Compare preços de free shops em Rivera e Livramento',
 'cargando...':'carregando...',
 '¿Importar esta lista?':'Importar esta lista?',
 'Ahora no':'Agora não',
 'No realizamos ventas ni estamos afiliados a las tiendas. Los precios y la disponibilidad son orientativos y pueden cambiar. Consultá la información actualizada en la publicación oficial de cada tienda.':'Não realizamos vendas nem somos afiliados às lojas. Os preços e a disponibilidade são indicativos e podem mudar. Consulte as informações atualizadas na publicação oficial de cada loja.',

 'Solo con precio':'Só com preço',
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
"Mayor caída de precio":"Maior queda de preço","Más relevantes":"Mais relevantes","Recién agregados":"Recém-adicionados","Compartir":"Compartilhar","Moneda de referencia":"Moeda de referência","Quitar categoría":"Remover categoria","Instalar RivFree":"Instalar RivFree","Sugerencias de productos":"Sugestões de produtos","Categorías seleccionadas":"Categorias selecionadas","UYU · Peso uruguayo":"UYU · Peso uruguaio",
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
 'Buscá una categoría':'Busque uma categoria',
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
 'No disponible':'Indisponível','Desde':'A partir de','Precio más bajo':'Menor preço','Ver en tienda ↗':'Ver na loja ↗','Sin enlace':'Sem link',
 'Dirección':'Endereço','Teléfono':'Telefone','Correo':'E-mail','Horario':'Horário','Información':'Informações',
 'Sitio oficial':'Site oficial','No hay información adicional disponible.':'Não há informações adicionais disponíveis.',
 'Modo claro':'Modo claro','Modo oscuro':'Modo escuro',
 'RivFree es un comparador de precios.':'O RivFree é um comparador de preços.',
 'No vendemos productos ni estamos afiliados a las tiendas: cada compra se hace directamente con el free shop.':'Não vendemos produtos nem somos afiliados às lojas: cada compra é feita diretamente com o free shop.',
 'Solo comparamos precios:':'Só comparamos preços:','no vendemos ni estamos afiliados a las tiendas.':'não vendemos nem somos afiliados às lojas.',
 'Abrila en otro celular con un enlace, sin crear cuenta.':'Abra em outro celular com um link, sem criar conta.','Compartir lista':'Compartilhar lista',
 'Ordenar':'Ordenar','Favoritos':'Favoritos','Detalles del catálogo':'Detalhes do catálogo','Mostrar solo favoritos':'Mostrar só favoritos',
 'Tiendas':'Lojas','Dólar hoy':'Dólar hoje','Cotización del día':'Cotação do dia',
 'Aviso importante':'Aviso importante','Redes sociales de RivFree':'Redes sociais do RivFree','Tocá una o varias para ver solo sus productos. Sin elegir, se muestran todas.':'Toque em uma ou mais para ver só os produtos delas. Sem escolher, aparecem todas.','Mostrar solo favoritos':'Mostrar só favoritos','Filtrar ofertas por descuento':'Filtrar ofertas por desconto','Descuento':'Desconto','Todas las ofertas':'Todas as ofertas','o más':'ou mais','Mayor descuento':'Maior desconto',
 'Cerrar':'Fechar','Cerrar aviso':'Fechar aviso','Volver al inicio y recargar':'Voltar ao início e recarregar',
 'Aviso sobre disponibilidad':'Aviso sobre disponibilidade',
 'PRIVACIDAD · RIVFREE':'PRIVACIDADE · RIVFREE',
 'Ayudanos a mejorar RivFree':'Ajude a melhorar o RivFree',
 'Solo esenciales':'Somente essenciais','Permitir estadísticas':'Permitir estatísticas','Privacidad y estadísticas':'Privacidade e estatísticas',
 'Disponibilidad orientativa.':'Disponibilidade indicativa.',
 'La web refleja catálogos online, no el stock físico completo de cada tienda.':'A web reflete catálogos online, não o estoque físico completo de cada loja.',
 'Filtros avanzados':'Filtros avançados','Precio, orden, ofertas y tiendas':'Preço, ordem, ofertas e lojas',
 'Ej.: perfume Dior, whisky, parlante JBL':'Ex.: perfume Dior, whisky, caixa de som JBL',
 'Sin datos':'Sem dados','Sin fecha':'Sem data','Actualización parcial':'Atualização parcial',
 'Los datos tienen más de 48 horas':'Os dados têm mais de 48 horas',
 'No se pudo cargar data/products.json. ¿Ya corriste el scraper?':'Não foi possível carregar o catálogo. Tente recarregar a página.',
 'Abriendo la publicación original en otra pestaña':'Abrindo a publicação original em outra aba',
 'Limpiar':'Limpar','Limpiar categoría':'Limpar categoria',
 'Leer Política de Privacidad y Cookies':'Ler Política de Privacidade e Cookies',
 'Política de Privacidad y Cookies':'Política de Privacidade e Cookies',
 'Gestionar preferencias de cookies':'Gerenciar preferências de cookies',
 'Volver arriba':'Voltar ao topo','Cambiar idioma':'Alterar idioma',
 'Visto en Instagram':'Visto no Instagram','Visto en Facebook':'Visto no Facebook',
 'Visto en WhatsApp':'Visto no WhatsApp','Visto en sitio web':'Visto no site',
 'Agregado manualmente':'Adicionado manualmente','Ver publicación ↗':'Ver publicação ↗',
};
function tr(value) {
 value=seoSpanishSources[value] || value;
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
const seoSpanishSources = Object.fromEntries(Object.entries(translations).map(([es,pt])=>[pt,es]));
const textSources = new WeakMap();
function translateUI() {
 document.documentElement.lang=LANG;
 document.title = LANG==='pt-BR' ? 'RivFree | Compare preços de free shops em Rivera e Livramento' : 'RivFree | Compará precios de free shops en Rivera y Livramento';
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
 document.querySelectorAll('.privacy-policy-link').forEach(a=>a.href='privacy.html?lang='+LANG);
}
function storeKey(name) {
 const s=Catalog.norm(name);
 return s.includes('neutral')?'neutral':s.includes('barao')?'barao':s.includes('yury')?'yury':s.includes('dfa')?'dfa':s.includes('mantra')?'mantra':s.includes('sineriz')?'sineriz':s.includes('oprha')||s.includes('orpha')?'oprha':'other';
}
function validHexColor(value){return typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value.trim());}
function contrastingText(hex){
 if(!validHexColor(hex))return '#ffffff';
 const [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
 const luminance=(.299*r+.587*g+.114*b)/255;
 return luminance>.64?'#171419':'#ffffff';
}
function applyStoreVisual(element,storeName){
 const info=STORE_INFO[storeName]||{};
 const color=validHexColor(info.color)?info.color:null;
 if(!color)return;
 element.style.setProperty('--store-bg',color);
 element.style.setProperty('--store-border',contrastingText(color)==='#171419'&&validHexColor(info.color_texto)?info.color_texto:color);
 element.style.setProperty('--store-fg',validHexColor(info.color_texto)?info.color_texto:contrastingText(color));
}
// Studio → Tiendas → Logo: a store can show its logo next to its name wherever its tag appears.
function storeLogo(storeName){
 const info=STORE_INFO[storeName]||{};
 return info.etiqueta==='logo'?imageThumbUrl(info.logo)||null:null;
}
function decorateStoreChip(element,storeName,before=null){
 element.querySelector(':scope > .store-logo')?.remove();
 const src=storeLogo(storeName);element.classList.toggle('has-logo',!!src);
 if(!src)return element;
 const img=document.createElement('img');img.className='store-logo';img.src=src;img.alt='';img.decoding='async';img.referrerPolicy='no-referrer';
 img.onerror=()=>{img.remove();element.classList.remove('has-logo');};
 if(before)before.before(img);else element.prepend(img);return element;
}
async function loadStoreInfoFiles(){
 const [baseValue,manualValue]=await Promise.all([
  fetchWithTimeout('data/stores.json',{cache:'no-store'},8000).catch(()=>null),
  fetchWithTimeout('data/manual-stores.json',{cache:'no-store'},8000).catch(()=>null)
 ]);
 const base=baseValue&&!Array.isArray(baseValue)&&typeof baseValue==='object'?baseValue:{};
 const manual=manualValue?.tiendas&&!Array.isArray(manualValue.tiendas)&&typeof manualValue.tiendas==='object'?manualValue.tiendas:{};
 return {...base,...manual};
}
// Studio → Tiendas → "Ocultar las fotos de los productos". The photo is kept aside (not deleted), so the Studio
// preview can switch it back; a product sold elsewhere uses the other store's photo.
function applyHiddenPhotos(){
 const hidden=new Set(Object.entries(STORE_INFO||{}).filter(([,info])=>info?.ocultar_fotos===true).map(([name])=>name));
 const signature=[...hidden].sort().join('|');
 if(applyHiddenPhotos.signature===signature&&applyHiddenPhotos.catalog===PRODUCT_GROUPS)return false;
 const first=applyHiddenPhotos.catalog!==PRODUCT_GROUPS;applyHiddenPhotos.signature=signature;applyHiddenPhotos.catalog=PRODUCT_GROUPS;
 if(first&&!hidden.size)return false;
 const fix=offer=>{
  if(!offer)return;
  if(hidden.has(offer.tienda)){if(offer.imagen){offer.imagen_oculta=offer.imagen;offer.imagen='';}}
  else if(offer.imagen_oculta){offer.imagen=offer.imagen_oculta;delete offer.imagen_oculta;}
 };
 for(const product of ALL_PRODUCTS)fix(product);
 for(const group of PRODUCT_GROUPS){group.offers.forEach(fix);group.image=group.offers.find(o=>safeImageUrl(o.imagen))?.imagen||null;}
 // Cards reuse cached views: start them again so no hidden photo survives.
 getFiltered.catalog=null;getFiltered.viewCatalog=null;
 return true;
}
window.RivFreeApplyHiddenPhotos=()=>{if(applyHiddenPhotos()&&ALL_PRODUCTS.length){if(typeof campaignCatalog!=='undefined')campaignCatalog=null;render(true);if(typeof renderPopularProducts==='function'){railSignature='';renderPopularProducts();}}};
function announce(message) {
 const el=document.getElementById('actionStatus');el.textContent=message;el.hidden=false;
 clearTimeout(announce.timer);announce.timer=setTimeout(()=>{el.hidden=true;},3500);
}


function observedDrop(offer){const value=offer?.caida_precio;return hasPrice(offer)&&Number.isFinite(value?.porcentaje)&&value.porcentaje>0&&Date.now()-Date.parse(value.hasta)<=7*86400000?value.porcentaje:0;}
function groupDrop(group){return Math.max(0,...group.visibleOffers.map(observedDrop));}
function groupAdded(group){return Math.max(0,...group.visibleOffers.map(o=>Date.parse(o.creado||o.primera_deteccion)||0));}
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
 if(target.dataset.action==='share'&&data){shareProduct(data);return;}
 if(target.dataset.action==='history'&&data){openPriceHistory(data.offers);return;}
 if(target.dataset.action==='favorite'&&data){toggleFavorite(data.key);return;}
 if(target.dataset.action==='preview'&&data){event.preventDefault();recordProductConsult(data.key);openProductPreview(data);return;}
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
let MIN_DISCOUNT = 0;
// Percentage saved against the store's previous price (0 when the store did not publish one).
function discountOf(product){
  if(!product?.en_oferta||!hasPrice(product)||!Number.isFinite(product.precio_original_usd)||product.precio_original_usd<=product.precio_usd)return 0;
  return Math.round((1-product.precio_usd/product.precio_original_usd)*100);
}
function groupDiscount(group){return Math.max(0,...(group.visibleOffers||group.offers).map(discountOf));}
const PAGE_SIZE = window.matchMedia('(max-width: 650px)').matches ? 24 : 48;
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
  return usd+(validExchange()?' · ≈ '+referencePrice(value):'');
}

let loadingCatalog=false;
async function loadData() {
  if(loadingCatalog)return;
  loadingCatalog=true;
  document.getElementById('retryLoad').disabled=true;
  document.getElementById('loadError').hidden=true;
  try {
    const [loaded, storeInfo, ratesRes] = await Promise.all([
      loadCatalog(), loadStoreInfoFiles(),
      // The rate is shown in the navigation bar as soon as it arrives, without waiting for the catalog.
      fetchWithTimeout('data/exchange.json',{cache:'default'},8000).then(value=>{if(isRate(value)){automaticExchange=mergeExchange(automaticExchange,value);updateExchangeNote();}return value;}).catch(()=>null)
    ]);
    const {data,prepared,offline}=loaded;
    STORE_INFO=storeInfo;
    if(isRate(ratesRes))automaticExchange=mergeExchange(automaticExchange,ratesRes);
    ALL_PRODUCTS=prepared.products;
    PRODUCT_GROUPS=prepared.groups;
    applyHiddenPhotos();
    indexFavoriteOffers();
    migrateFavorites(PRODUCT_GROUPS,prepared.legacyKeys);
    SEARCH_WORDS=prepared.words;
    document.getElementById('connectionNote').hidden=!offline;
    updateExchangeNote();
    refreshLiveRates();
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
    // Let the browser paint before the rest of the page reacts to the new catalog.
    await new Promise(resolve=>setTimeout(resolve,0));
    window.dispatchEvent(new CustomEvent('rivfree:catalog-ready'));
    // Warm up the alphabetical order while the visitor is reading the home page.
    const warm=()=>nameRank(PRODUCT_GROUPS[0]||{});if('requestIdleCallback' in window)requestIdleCallback(warm,{timeout:8000});else setTimeout(warm,3000);
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
  const stores = [...new Set([...Object.keys(STORE_INFO),...ALL_PRODUCTS.map(p => p.tienda)])].filter(Boolean).sort((a,b)=>a.localeCompare(b,LANG));
  const storesField = document.getElementById('storesField');
  storesField.replaceChildren();
  // Nothing selected = every store. Choosing stores shows only their products; «Todas» clears the choice.
  const all=document.createElement('button');all.type='button';all.id='storeFilterAll';all.className='store-filter-chip store-filter-all';
  all.textContent=tr('Todas');all.setAttribute('aria-pressed','true');
  all.addEventListener('click',()=>{storesField.querySelectorAll('.storeChk').forEach(el=>{el.checked=false;});render(true);});
  storesField.appendChild(all);
  stores.forEach(store => {
    const label = document.createElement('label');
    label.className = 'chk store-filter-chip';
    label.dataset.store = storeKey(store);
    applyStoreVisual(label,store);
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = store;
    checkbox.className = 'storeChk';
    checkbox.checked = false;
    const text=document.createElement('span');text.className='store-filter-name';text.textContent=store;
    // Logos only when the owner uploads one in Studio and turns it on for that store.
    label.append(checkbox,text);decorateStoreChip(label,store,text);
    storesField.appendChild(label);
  });
  storesField.querySelectorAll('.storeChk').forEach(el => el.addEventListener('change', () => {
    // Choosing every store is the same as choosing none: go back to «Todas».
    const boxes=[...storesField.querySelectorAll('.storeChk')];
    if(boxes.length>1&&boxes.every(box=>box.checked))boxes.forEach(box=>{box.checked=false;});
    render(true);
  }));

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

  const cat = selectedCategories();
  const {min,max}=readPriceRange();
  const soloOfertas = document.getElementById('soloOfertas').checked;
  const activeStores = [...document.querySelectorAll('.storeChk:checked')].map(el => el.value);
  const orden = document.getElementById('orden').value;
  const pricedOnly = document.getElementById('hideUnavailable')?.checked;
  const favoritesOnly = document.getElementById('favoritesOnly').checked;

  const minDiscount=soloOfertas?MIN_DISCOUNT:0;
  const facet=typeof RivFreeFacet==='function'?RivFreeFacet():null;
  const cacheKey=JSON.stringify([ACTIVE_SEARCH,facet?.id||'',cat,String(min),String(max),soloOfertas,minDiscount,pricedOnly,favoritesOnly,favoritesOnly?[...favorites]:[],activeStores,orden]);
  if(getFiltered.catalog!==PRODUCT_GROUPS){getFiltered.catalog=PRODUCT_GROUPS;getFiltered.cache=new Map();}
  if(getFiltered.cache.has(cacheKey))return getFiltered.cache.get(cacheKey);
  let candidates=PRODUCT_GROUPS;
  if(facet){
    if(getFiltered.keyCatalog!==PRODUCT_GROUPS){getFiltered.keyCatalog=PRODUCT_GROUPS;getFiltered.byKey=new Map(PRODUCT_GROUPS.map(g=>[g.key,g]));}
    candidates=[...facet.keys].map(key=>getFiltered.byKey.get(key)).filter(Boolean);
  }
  if(cat.length){
    if(getFiltered.categoryCatalog!==PRODUCT_GROUPS){
      getFiltered.categoryCatalog=PRODUCT_GROUPS;getFiltered.categories=new Map();
      for(const group of PRODUCT_GROUPS)for(const category of new Set(group.offers.map(o=>o.categoryId))){
        if(!getFiltered.categories.has(category))getFiltered.categories.set(category,[]);
        getFiltered.categories.get(category).push(group);
      }
    }
    const inCategories=cat.length===1?(getFiltered.categories.get(cat[0])||[]):[...new Set(cat.flatMap(c=>getFiltered.categories.get(c)||[]))];
    candidates=facet?candidates.filter(g=>g.offers.some(o=>cat.includes(o.categoryId))):inCategories;
  }
  if(soloOfertas){
    // Only a few hundred groups have offers: skip the rest of the catalog.
    if(getFiltered.offerCatalog!==PRODUCT_GROUPS){getFiltered.offerCatalog=PRODUCT_GROUPS;getFiltered.offerGroups=new Set(PRODUCT_GROUPS.filter(g=>g.offers.some(o=>o.en_oferta)));}
    candidates=candidates===PRODUCT_GROUPS?[...getFiltered.offerGroups]:candidates.filter(g=>getFiltered.offerGroups.has(g));
  }
  if(getFiltered.storeCatalog!==PRODUCT_GROUPS){getFiltered.storeCatalog=PRODUCT_GROUPS;getFiltered.storeNames=new Set(PRODUCT_GROUPS.flatMap(g=>g.offers.map(o=>o.tienda)));}
  const storeSet=new Set(activeStores),allStores=!activeStores.length||[...getFiltered.storeNames].every(name=>storeSet.has(name));
  const offerFilter=cat.length||!isNaN(min)||!isNaN(max)||soloOfertas||pricedOnly||!allStores;
  if(getFiltered.viewCatalog!==PRODUCT_GROUPS){getFiltered.viewCatalog=PRODUCT_GROUPS;getFiltered.views=new WeakMap();}
  // Without offer-level filters, narrow a text search on the raw groups first (typo fallback still sees everything).
  if(searchTokens.length&&!offerFilter){const exact=candidates.filter(g=>g.offers.some(p=>Catalog.matchesSearch(p,query)));if(exact.length)candidates=exact;}
  let groups=[];
  for(const group of candidates){
    if(favoritesOnly&&!(favorites.has(group.key)||group.offers.some(o=>favorites.has(offerFavoriteKey(o)))))continue;
    if(!offerFilter){
      // Unfiltered views are reused between renders instead of copying every group again.
      let view=getFiltered.views.get(group);
      if(!view){view={...group,visibleOffers:group.offers,lowestVisiblePrice:group.offers.find(hasPrice)?.precio_usd ?? Infinity};getFiltered.views.set(group,view);}
      if(view.visibleOffers.length)groups.push(view);
      continue;
    }
    const visibleOffers = group.offers.filter(product => {
      if (!allStores && !storeSet.has(product.tienda)) return false;
      if (pricedOnly && !hasPrice(product)) return false;
      if (cat.length && !cat.includes(product.categoryId)) return false;
      if (!isNaN(min) && (!hasPrice(product) || product.precio_usd < min)) return false;
      if (!isNaN(max) && (!hasPrice(product) || product.precio_usd > max)) return false;
      if (soloOfertas && !product.en_oferta) return false;
      if (minDiscount && discountOf(product) < minDiscount) return false;
      return true;
    });
    if(visibleOffers.length)groups.push({...group, visibleOffers, lowestVisiblePrice:visibleOffers.find(hasPrice)?.precio_usd ?? Infinity});
  }
  if(searchTokens.length){
    const exact=groups.filter(g=>g.visibleOffers.some(p=>Catalog.matchesSearch(p,query)));
    if(exact.length)groups=exact;
    else {
      const alternatives=searchTokens.map(searchAlternatives);
      groups=groups.filter(g=>g.visibleOffers.some(p=>alternatives.every(options=>options.some(t=>p.searchIndex.split(' ').includes(t))))).map(g=>({...g,approximate:true}));
    }
  }

  const lowestPrice = group => group.lowestVisiblePrice;
  if (orden === 'ofertas') groups.sort((a,b)=>Number(b.visibleOffers.some(p=>p.en_oferta&&hasPrice(p)))-Number(a.visibleOffers.some(p=>p.en_oferta&&hasPrice(p)))||lowestPrice(a)-lowestPrice(b));
  else if (orden === 'descuento') groups.sort((a,b)=>groupDiscount(b)-groupDiscount(a)||lowestPrice(a)-lowestPrice(b));
  else if (orden === 'caida') groups.sort((a,b)=>groupDrop(b)-groupDrop(a)||lowestPrice(a)-lowestPrice(b));
  else if (orden === 'nuevos') groups.sort((a,b)=>groupAdded(b)-groupAdded(a)||nameRank(a)-nameRank(b));
  else if (orden === 'precio_asc') groups.sort((a,b) => lowestPrice(a) - lowestPrice(b));
  else if (orden === 'precio_desc') groups.sort((a,b) => {
    const aPrice = lowestPrice(a), bPrice = lowestPrice(b);
    if (!Number.isFinite(aPrice)) return 1;
    if (!Number.isFinite(bPrice)) return -1;
    return bPrice - aPrice;
  });
  else if (orden === 'relevancia' && searchTokens.length) groups=byRelevance(groups);
  else if (orden === 'nombre_asc' || orden === 'relevancia') {
    groups.sort((a,b)=>nameRank(a)-nameRank(b));
    const priced=[],unavailable=[];
    for(const group of groups)(Number.isFinite(lowestPrice(group))?priced:unavailable).push(group);
    groups=priced.concat(unavailable);
  }

  if(getFiltered.cache.size>=8)getFiltered.cache.delete(getFiltered.cache.keys().next().value);
  getFiltered.cache.set(cacheKey,groups);
  return groups;
}

// Search results: names that start with or contain the typed words first, then items sold
// in more stores; items without a price and approximate matches go last.
function byRelevance(groups){
  const terms=Catalog.norm(ACTIVE_SEARCH).replace(/[^a-z0-9]+/g,' ').trim().split(' ').filter(Boolean);
  const phrase=' '+terms.join(' ');
  const score=new Map();
  for(const group of groups){
    const name=' '+Catalog.norm(group.name).replace(/[^a-z0-9]+/g,' ').trim()+' ';
    let value=name.startsWith(phrase+' ')||name.startsWith(phrase)?60:name.includes(phrase)?35:0;
    for(const word of terms)value+=name.includes(' '+word+' ')?12:name.includes(' '+word)?8:name.includes(word)?3:0;
    value+=Math.min(new Set(group.visibleOffers.map(o=>o.tienda)).size,4)*3;
    if(!Number.isFinite(group.lowestVisiblePrice))value-=40;
    if(group.approximate)value-=20;
    score.set(group,value);
  }
  return groups.sort((a,b)=>score.get(b)-score.get(a)||nameRank(a)-nameRank(b));
}

// Alphabetical position of every group, computed once per catalog (sorting 30k names
// with Intl.Collator on every filter change was the slowest part of filtering).
function nameRank(group){
  if(nameRank.catalog!==PRODUCT_GROUPS){
    nameRank.catalog=PRODUCT_GROUPS;nameRank.ranks=new Map();
    // Accent- and case-insensitive keys compared as plain strings: same order as a Spanish collator for catalog names, ~10× faster.
    const keyed=PRODUCT_GROUPS.map(g=>[Catalog.norm(g.name).replace(/[^a-z0-9ñ ]+/g,' ').trim(),g.key]);
    keyed.sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0).forEach(([,key],i)=>nameRank.ranks.set(key,i));
  }
  return nameRank.ranks.get(group.key)??Number.MAX_SAFE_INTEGER;
}
function render(resetLimit = false, appendOnly = false) {
  if (resetLimit === true) visibleLimit = PAGE_SIZE;
  if(!validatePrices())return;
  syncFiltersURL();
  document.body.classList.toggle('search-results-mode',Boolean(ACTIVE_SEARCH.trim()));
  if(!ACTIVE_SEARCH.trim())renderPopularProducts();
  updateAdvancedCount();
  const grid = document.getElementById('grid');
  // On the home page the results grid is hidden: skip filtering and card building until it is shown.
  if(window.RivFreeCatalogVisible&&!window.RivFreeCatalogVisible()){
    updateOfferTiers();if(render.lastItems){grid.replaceChildren();render.lastItems=null;}return;
  }
  keepDiscountWithResults();
  const items = getFiltered();
  updateOfferTiers();
  const empty = document.getElementById('emptyState');
  const meta = document.getElementById('resultsMeta');
  const loadMoreWrap = document.getElementById('loadMoreWrap');
  const visibleItems = items.slice(0, visibleLimit);

  const offersShown = items.reduce((total, group) => total + group.visibleOffers.length, 0);
  const pricedShown = items.reduce((total, group) =>
    total + group.visibleOffers.filter(hasPrice).length, 0);
  const unavailable = offersShown - pricedShown;
  const shownText = items.length > visibleItems.length ? ` · mostrando ${visibleItems.length}` : '';
  // Thousands always grouped ("4.665", like "34.497"); Spanish would otherwise skip 4-digit numbers.
  const count = n => n.toLocaleString(LANG, {useGrouping: 'always'});
  meta.textContent = tr(`${count(items.length)} producto${items.length === 1 ? '' : 's'}`)
    + (document.getElementById('soloOfertas').checked && MIN_DISCOUNT ? words(` · ${MIN_DISCOUNT}% ou mais`, ` · ${MIN_DISCOUNT}% o más`) : '');
  meta.title = shownText ? tr(shownText.replace(/^ · /,'')) : '';
  document.getElementById('resultsDetails').textContent = tr(`${count(pricedShown)} precios disponibles · ${count(unavailable)} sin precio · ${count(ALL_PRODUCTS.length)} publicaciones totales`) + (shownText ? ' ·' + tr(shownText.replace(/^ ·/,'')) : '');

  if (items.length === 0) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    loadMoreWrap.hidden = true;
    return;
  }
  empty.style.display = 'none';
  loadMoreWrap.hidden = visibleItems.length >= items.length;

  if(items.some(g=>g.approximate))meta.textContent+=' · '+tr('Resultados aproximados');
  const append=appendOnly&&render.lastItems===items;
  // Paint the first cards right away and add the rest in small batches, so taps stay responsive.
  const ticket=render.ticket=(render.ticket||0)+1;
  const start=append?grid.children.length:0,first=Math.min(visibleItems.length,start+12);
  const cards = visibleItems.slice(start,first).map(createProductCard);
  if(append)grid.append(...cards);else grid.replaceChildren(...cards);
  render.lastItems=items;
  if(first<visibleItems.length){
    const more=()=>{
      if(render.ticket!==ticket||render.lastItems!==items)return;
      const from=grid.children.length,to=Math.min(visibleItems.length,from+12);
      grid.append(...visibleItems.slice(from,to).map(createProductCard));
      if(to<visibleItems.length)setTimeout(more,0);
    };
    setTimeout(more,0);
  }
}

// Discount shortcuts shown above the catalog while browsing offers. Studio sets the tiers (Página → Ofertas).
function offerTierValues(){
  const raw=window.RIVFREE_SITE_CONFIG?.offers?.tiers;
  const list=Array.isArray(raw)?[...new Set(raw.map(Number).filter(n=>Number.isInteger(n)&&n>=5&&n<=95))].sort((a,b)=>a-b).slice(0,4):[];
  return list.length?list:[20,40,60];
}
function syncOfferTierButtons(){
  const box=document.getElementById('offerTiers');if(!box)return false;
  const tiers=offerTierValues(),current=[...box.querySelectorAll('[data-discount]')].map(b=>Number(b.dataset.discount)).filter(Boolean);
  if(current.join()===tiers.join())return false;
  box.querySelectorAll('[data-discount]:not([data-discount="0"])').forEach(button=>button.remove());
  const shades={1:[3],2:[1,3],3:[1,2,3],4:[1,2,2,3]}[tiers.length];
  tiers.forEach((tier,i)=>{
    const button=document.createElement('button');button.type='button';button.className='offer-tier tier-'+shades[i];button.dataset.discount=String(tier);button.setAttribute('aria-pressed','false');
    const main=document.createElement('span');main.className='offer-tier-main';const value=document.createElement('b');value.textContent=tier+'%';const more=document.createElement('span');more.textContent=tr('o más');main.append(value,' ',more);
    const count=document.createElement('span');count.className='offer-tier-count';button.append(main,count);box.append(button);
  });
  if(MIN_DISCOUNT&&!tiers.includes(MIN_DISCOUNT))MIN_DISCOUNT=0;
  return true;
}
document.addEventListener('rivfree-site-config-applied',()=>{if(syncOfferTierButtons()&&document.getElementById('soloOfertas')?.checked&&PRODUCT_GROUPS.length)render(true);});
// Searching inside the offers: when the chosen discount has nothing for that search, show every offer
// instead of an empty page (and say so).
function keepDiscountWithResults(){
  if(!document.getElementById('soloOfertas').checked||!MIN_DISCOUNT||!ACTIVE_SEARCH.trim())return;
  const tier=MIN_DISCOUNT;MIN_DISCOUNT=0;let base;try{base=getFiltered();}finally{MIN_DISCOUNT=tier;}
  if(base.length&&!base.some(g=>g.visibleOffers.some(o=>discountOf(o)>=tier))){
    MIN_DISCOUNT=0;
    announce(words(`Não há ofertas de ${tier}% ou mais para essa busca: mostramos todas as ofertas.`,`No hay ofertas de ${tier}% o más para esa búsqueda: mostramos todas las ofertas.`));
  }
}
// The discount levels belong to the offers view only (never to a regular search).
function updateOfferTiers(){
  const box=document.getElementById('offerTiers');if(!box)return;
  const active=document.getElementById('soloOfertas').checked;box.hidden=!active;
  document.body.classList.toggle('offers-mode',active);
  const search=document.getElementById('search');
  if(search){search.dataset.placeholderEs??=search.getAttribute('placeholder')||'';search.placeholder=active?words('Buscar nas ofertas…','Buscar en ofertas…'):tr(search.dataset.placeholderEs);}
  const chip=document.getElementById('offersModeChip');
  if(chip){chip.hidden=!active;chip.querySelector('span').textContent=words('Ofertas','Ofertas');chip.setAttribute('aria-label',words('Sair das ofertas','Salir de ofertas'));}
  if(!active)return;
  const saved=MIN_DISCOUNT;MIN_DISCOUNT=0;let base;try{base=getFiltered();}finally{MIN_DISCOUNT=saved;}
  for(const button of box.querySelectorAll('[data-discount]')){
    const tier=Number(button.dataset.discount);
    const count=tier?base.filter(g=>g.visibleOffers.some(o=>discountOf(o)>=tier)).length:base.length;
    button.querySelector('.offer-tier-count').textContent=count.toLocaleString(LANG);
    button.setAttribute('aria-pressed',String(tier===MIN_DISCOUNT));
    button.disabled=!count&&tier!==MIN_DISCOUNT;
    button.title=tier?(LANG==='es'?`Ofertas con ${tier}% de descuento o más`:`Ofertas com ${tier}% de desconto ou mais`):'';
  }
}
document.getElementById('offerTiers')?.addEventListener('click',event=>{
  const button=event.target.closest('[data-discount]');if(!button||button.disabled)return;
  MIN_DISCOUNT=Number(button.dataset.discount)||0;
  if(MIN_DISCOUNT&&document.getElementById('orden').value==='nombre_asc')document.getElementById('orden').value='descuento';
  render(true);
  // Clear feedback: the chosen level stays highlighted and the count is announced.
  button.classList.remove('just-picked');void button.offsetWidth;button.classList.add('just-picked');
  const found=document.getElementById('resultsMeta').textContent.split(' · ')[0];
  announce(MIN_DISCOUNT?words(`Ofertas de ${MIN_DISCOUNT}% ou mais: ${found}`,`Ofertas de ${MIN_DISCOUNT}% o más: ${found}`):words(`Todas as ofertas: ${found}`,`Todas las ofertas: ${found}`));
});
document.getElementById('offersModeChip')?.addEventListener('click',()=>{
  document.getElementById('soloOfertas').checked=false;MIN_DISCOUNT=0;
  const sort=document.getElementById('orden');if(sort.value==='descuento')sort.value=ACTIVE_SEARCH.trim()?'relevancia':'nombre_asc';
  render(true);
});

function waitForPaint() {
  return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

async function runSearch() {
  closeSearchSuggestions();
  const status = document.getElementById('searchStatus');
  const button = document.getElementById('searchButton');
  const meta = document.getElementById('resultsMeta');
  status.classList.add('visible');
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  await waitForPaint();

  ACTIVE_SEARCH = document.getElementById('search').value.trim();
  // The default order follows the search: best matches while searching, A-Z otherwise.
  const sort = document.getElementById('orden');
  if (ACTIVE_SEARCH && sort.value === 'nombre_asc') sort.value = 'relevancia';
  else if (!ACTIVE_SEARCH && sort.value === 'relevancia') sort.value = 'nombre_asc';
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
  // Land on the results bar (count and order), just below the sticky header.
  const anchor = resultsAnchor === grid ? (document.querySelector('.rf-results-bar') || grid) : resultsAnchor;
  if (anchor && typeof anchor.scrollIntoView === 'function') {
    const reduceMotion = typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const header = document.querySelector('.topbar');
    const covered = header && /sticky|fixed/.test(getComputedStyle(header).position) ? header.getBoundingClientRect().height : 0;
    anchor.style.scrollMarginTop = Math.round(covered + 8) + 'px';
    anchor.scrollIntoView({
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
  applyStoreVisual(button,storeName);
  button.type = 'button';
  const label=document.createElement('span');label.className='card-store-label';label.textContent=storeName;
  button.appendChild(label);decorateStoreChip(button,storeName);
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
  if(validExchange()){const secondary=document.createElement('span');secondary.className='card-price-secondary';secondary.textContent='≈ '+referencePrice(value);container.appendChild(secondary);}
}

function readableProductName(value) {
  // Only soften all-uppercase catalog names. Preserve acronyms and model codes.
  if(value !== value.toLocaleUpperCase())return value;
  const acronyms=new Set(['JBL','LG','HP','USB','LED','TV','EDP','EDT','EDC','USA','UV','SPF','DFA']);
  return value.replace(/[\p{L}\p{N}]+/gu, word=>acronyms.has(word)||/\d/.test(word)
    ? word : word[0]+word.slice(1).toLocaleLowerCase());
}

function sourcePresentation(offer){
 const type=String(offer?.fuente_tipo||'').trim().toLowerCase();
 if(!type||type==='manual')return null;
 const labels={instagram:'Visto en Instagram',facebook:'Visto en Facebook',whatsapp:'Visto en WhatsApp',web:'Visto en sitio web',website:'Visto en sitio web',manual:'Agregado manualmente'};
 const label=labels[type]||'Agregado manualmente';
 const url=safeHttpUrl(offer.fuente_url)||(type!=='manual'?safeHttpUrl(offer.url):null);
 return {type,label:tr(label),url};
}
function appendSourceNotes(container,offers,multiStore=false){
 const seen=new Set(),notes=[];
 for(const offer of offers){
  const source=sourcePresentation(offer);if(!source)continue;
  const key=`${source.type}|${offer.tienda}|${source.url||''}`;if(seen.has(key))continue;seen.add(key);notes.push({offer,source});
 }
 if(!notes.length)return;
 const row=document.createElement('div');row.className='card-source-row';
 for(const {offer,source} of notes.slice(0,3)){
  const item=document.createElement(source.url?'a':'span');item.className=`source-chip source-${source.type}`;
  item.textContent=source.label+(multiStore?` · ${offer.tienda}`:'');
  if(source.url){item.href=source.url;item.target='_blank';item.rel='noopener noreferrer';item.dataset.action='source';}
  row.appendChild(item);
 }
 if(notes.length>3){const more=document.createElement('span');more.className='source-chip source-more';more.textContent=`+${notes.length-3}`;row.appendChild(more);}
 container.appendChild(row);
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
  const imageUrl = safeImageUrl(offers.find(offer => safeImageUrl(offer.imagen))?.imagen || group.image);
  if (imageUrl) {
    const img = document.createElement('img');img.referrerPolicy='no-referrer';
    img.src = imageUrl;
    img.loading = 'lazy';
    img.width = 240; img.height = 240;
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
  favorite.title=favorites.has(group.key)?words('Remover da Minha lista','Quitar de Mi lista'):words('Salvar na Minha lista','Guardar en Mi lista');
  favorite.setAttribute('aria-label',favorite.title+': '+displayName);
  const historyButton=document.createElement('button');historyButton.type='button';historyButton.className='favorite-button';historyButton.dataset.action='history';historyButton.textContent=LANG==='pt-BR'?'Histórico':'Historial';
  const shareButton=document.createElement('button');shareButton.type='button';shareButton.className='favorite-button';shareButton.dataset.action='share';shareButton.textContent=tr('Compartir');utilityRow.append(historyButton,shareButton);
  if(favorites.has(group.key))utilityRow.append(quantityControl(group.key,()=>{}));

  const badges = document.createElement('div');
  badges.className = 'badge-row';
  const falling=offers.filter(o=>observedDrop(o)>0).sort((a,b)=>observedDrop(b)-observedDrop(a))[0];
  if(falling){const badge=document.createElement('span');badge.className='badge-price-drop';badge.textContent=`↓ ${observedDrop(falling).toLocaleString(LANG)}% · ${Math.max(1,Math.round((Date.parse(falling.caida_precio.hasta)-Date.parse(falling.caida_precio.desde))/86400000))} ${LANG==='es'?'días':'dias'} · ${falling.tienda}`;badge.title=`USD ${falling.caida_precio.precio_anterior} → USD ${falling.precio_usd} · ${falling.caida_precio.desde.slice(0,10)} / ${falling.caida_precio.hasta.slice(0,10)}`;badges.append(badge);}
  if (product.en_oferta) {
    const offer = document.createElement('span');
    offer.className = 'badge-oferta';
    const discount = Math.max(0,...offers.map(discountOf));
    offer.textContent = tr('Oferta') + (discount >= 5 ? ` · −${discount}%` : '');
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
  appendSourceNotes(body,offers,storeCount>1);

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
    link.textContent = product.fuente_tipo==='instagram' && safeHttpUrl(product.fuente_url)===productUrl
      ? tr('Ver publicación ↗') : words(`Ver na ${product.tienda} ↗`,`Ver en ${product.tienda} ↗`);
    link.setAttribute('aria-label', words(`Ver ${product.nombre} na ${product.tienda}`,`Ver ${product.nombre} en ${product.tienda}`));
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
    applyStoreVisual(store,offer.tienda);
    store.type = 'button';
    store.textContent = offer.tienda;decorateStoreChip(store,offer.tienda);
    store.addEventListener('click', () => openStoreInfo(offer.tienda));
    const offerName = document.createElement('div');
    offerName.className = 'offer-name';
    offerName.textContent = offer.nombre;
    info.append(store, offerName);
    appendSourceNotes(info,[offer],false);

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

  if (window.RivFreeStores) { container.appendChild(window.RivFreeStores.contactLinks(info, storeName, {contact:false})); return; }
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
   STORE_INFO=await loadStoreInfoFiles();if(!Object.keys(STORE_INFO).length)throw new Error();
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

['categoria','orden','soloOfertas','hideUnavailable'].forEach(id => {
  document.getElementById(id).addEventListener('change', () => {if(id==='categoria')syncCategoryInput();render(true);});
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
  render(false,true);
});

const stockNotice = document.getElementById('stockNotice');
try {
  if (sessionStorage.getItem('rivfree-stock-notice-dismissed') === 'true') stockNotice.hidden = true;
} catch {}

document.getElementById('stockNoticeClose').addEventListener('click', () => {
  stockNotice.hidden = true;
  try { sessionStorage.setItem('rivfree-stock-notice-dismissed', 'true'); } catch {}
});

// "Filtros avanzados" opens from a compact button in the filter row; the panel spans the full card below.
(()=>{
  const toggle=document.getElementById('advancedToggle'),details=document.getElementById('advancedFilters');
  if(!toggle||!details)return;
  toggle.addEventListener('click',()=>{details.open=!details.open;if(details.open)details.querySelector('input,button')?.focus({preventScroll:true});});
  details.addEventListener('toggle',()=>{toggle.setAttribute('aria-expanded',String(details.open));toggle.classList.toggle('open',details.open);});
})();
function updateAdvancedCount(){
  const badge=document.getElementById('advancedCount');if(!badge)return;
  const {min,max}=readPriceRange();
  const stores=[...document.querySelectorAll('.storeChk')];
  const chosen=stores.filter(el=>el.checked).length;
  const count=(Number.isFinite(min)||Number.isFinite(max)?1:0)+(document.getElementById('soloOfertas').checked?1:0)+(chosen?1:0);
  badge.textContent=String(count);badge.hidden=!count;
  document.getElementById('storeFilterAll')?.setAttribute('aria-pressed',String(!chosen));
}
document.getElementById('clearFilters').addEventListener('click', () => {
  document.getElementById('hideUnavailable').checked=false;
  document.getElementById('search').value = '';
  ACTIVE_SEARCH = '';
  document.getElementById('categoria').value = '';syncCategoryInput();
  document.getElementById('minPrice').value = '';
  document.getElementById('maxPrice').value = '';
  document.getElementById('orden').value = 'nombre_asc';
  document.getElementById('soloOfertas').checked = false;MIN_DISCOUNT=0;
  document.getElementById('favoritesOnly').checked = false;
  document.querySelectorAll('.storeChk').forEach(el => { el.checked = false; });
  render(true);
});


let categoryActive = -1;
function selectedCategories(){return [...document.getElementById('categoria').selectedOptions].map(o=>o.value).filter(Boolean);}
function syncCategoryInput() {
 const input=document.getElementById('categorySearch');input.value='';
 const chips=document.getElementById('categoryChips');chips.replaceChildren();
 for(const id of selectedCategories()){const button=document.createElement('button');button.type='button';button.className='category-chip';button.textContent=(Catalog.categories[id]?.[LANG==='pt-BR'?1:0]||id)+' ×';button.setAttribute('aria-label',tr('Quitar categoría')+': '+button.textContent.slice(0,-2));button.onclick=()=>chooseCategory(id);chips.append(button);}
 document.getElementById('clearCategory').hidden=!selectedCategories().length;closeCategoryOptions();
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
  item.setAttribute('aria-selected',String(selectedCategories().includes(o.value)||(!o.value&&!selectedCategories().length)));
  item.addEventListener('mousedown',e=>e.preventDefault());
  item.addEventListener('click',()=>chooseCategory(o.value));list.appendChild(item);
 });
 if(!options.length){const empty=document.createElement('div');empty.className='category-empty';empty.textContent=tr('Sin categorías coincidentes');list.appendChild(empty);}
 list.hidden=false;input.setAttribute('aria-expanded','true');
}
let categoryRenderTicket=0;
function scheduleCategoryRender(){
 const ticket=++categoryRenderTicket;
 requestAnimationFrame(()=>setTimeout(()=>{if(ticket===categoryRenderTicket)render(true);},0));
}
function chooseCategory(value) {
 const select=document.getElementById('categoria');if(!value)select.value='';else{const option=[...select.options].find(o=>o.value===value);if(option)option.selected=!option.selected;select.options[0].selected=false;}
 syncCategoryInput();document.getElementById('categorySearch').focus({preventScroll:true});closeCategoryOptions();scheduleCategoryRender();
}
const categorySearch=document.getElementById('categorySearch');
categorySearch.addEventListener('focus',showCategoryOptions);
categorySearch.addEventListener('click',showCategoryOptions);
categorySearch.addEventListener('input',()=>{
 document.getElementById('clearCategory').hidden=!categorySearch.value&&!selectedCategories().length;
 showCategoryOptions();
});
categorySearch.addEventListener('blur',event=>{if(event.relatedTarget?.id!=='clearCategory')syncCategoryInput();});
const clearCategory=document.getElementById('clearCategory');
clearCategory.addEventListener('pointerdown',event=>event.preventDefault());
clearCategory.addEventListener('click',()=>{
 document.getElementById('categoria').value='';categorySearch.value='';syncCategoryInput();scheduleCategoryRender();
 categorySearch.focus({preventScroll:true});showCategoryOptions();clearCategory.hidden=true;
});
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

let suggestionTicket=0,suggestionTimer,suggestionActive=-1,suggestionCatalog=null,suggestionEntries=[];
function closeSearchSuggestions(){suggestionTicket++;clearTimeout(suggestionTimer);const list=document.getElementById('searchSuggestions');list.hidden=true;const input=document.getElementById('search');input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');suggestionActive=-1;}
function chooseSearchSuggestion(name){document.getElementById('search').value=name;closeSearchSuggestions();runSearch();}
function suggestProducts(){
 const input=document.getElementById('search'),list=document.getElementById('searchSuggestions');closeSearchSuggestions();
 const query=Catalog.search(input.value).split(/\s+/).filter(Boolean);if(input.value.trim().length<2||!query.length)return;
 const ticket=suggestionTicket;
 suggestionTimer=setTimeout(()=>{
  if(suggestionCatalog!==PRODUCT_GROUPS){suggestionCatalog=PRODUCT_GROUPS;suggestionEntries=new Array(PRODUCT_GROUPS.length);}
  let cursor=0;const found=[],seen=new Set();
  function chunk(){if(ticket!==suggestionTicket)return;const until=Math.min(cursor+600,suggestionEntries.length);
   while(cursor<until&&found.length<5){const i=cursor++;const entry=suggestionEntries[i]||(suggestionEntries[i]={name:PRODUCT_GROUPS[i].name,text:Catalog.search(PRODUCT_GROUPS[i].name)});if(query.every(t=>entry.text.includes(t))&&!seen.has(entry.text)){seen.add(entry.text);found.push(entry.name);}}
   if(found.length<5&&cursor<suggestionEntries.length){setTimeout(chunk,0);return;}
   list.replaceChildren();found.forEach((name,i)=>{const item=document.createElement('div');item.role='option';item.id='product-suggestion-'+i;item.textContent=name;item.setAttribute('aria-selected','false');item.addEventListener('mousedown',e=>e.preventDefault());item.onclick=()=>chooseSearchSuggestion(name);list.append(item);});list.hidden=!found.length;input.setAttribute('aria-expanded',String(!!found.length));
  }chunk();
 },160);
}
const suggestionInput=document.getElementById('search');
suggestionInput.addEventListener('input',suggestProducts);
suggestionInput.addEventListener('keydown',event=>{
 const list=document.getElementById('searchSuggestions');if(event.key==='Escape'){closeSearchSuggestions();return;}if(list.hidden||!['ArrowDown','ArrowUp','Enter'].includes(event.key))return;
 const items=[...list.children];if(!items.length)return;
 if(event.key==='Enter'){if(suggestionActive<0)return;event.preventDefault();chooseSearchSuggestion(items[suggestionActive].textContent);return;}
 event.preventDefault();suggestionActive=(suggestionActive+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;
 items.forEach((item,i)=>item.setAttribute('aria-selected',String(i===suggestionActive)));suggestionInput.setAttribute('aria-activedescendant',items[suggestionActive].id);
});
suggestionInput.addEventListener('blur',()=>closeSearchSuggestions());

function renderIOSInstallHint(){
 document.getElementById('iosInstallHint')?.remove();
 const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 const safari=/Safari/.test(navigator.userAgent)&&!/(CriOS|FxiOS|EdgiOS|OPiOS)/.test(navigator.userAgent);
 if(!ios||!safari||navigator.standalone||window.matchMedia?.('(display-mode: standalone)').matches||new URLSearchParams(location.search).has('studio-preview'))return;
 try{if(localStorage.getItem('rivfree-ios-install-dismissed'))return;}catch{}
 const banner=document.createElement('aside');banner.id='iosInstallHint';banner.className='ios-install-hint';banner.setAttribute('aria-label',tr('Instalar RivFree'));
 const text=document.createElement('p');text.textContent=LANG==='es'?'Llevá RivFree en tu pantalla de inicio: Compartir → Agregar a inicio. Abrí antes el catálogo con conexión para poder consultarlo durante el viaje.':'Leve o RivFree na tela de início: Compartilhar → Adicionar à Tela de Início. Abra antes o catálogo com conexão para consultá-lo durante a viagem.';
 const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label',tr('Cerrar aviso'));close.onclick=()=>{try{localStorage.setItem('rivfree-ios-install-dismissed','1');}catch{}banner.remove();};banner.append(text,close);document.body.append(banner);
}
window.addEventListener('DOMContentLoaded',renderIOSInstallHint);
document.getElementById('languageToggle').addEventListener('change',()=>setTimeout(renderIOSInstallHint,0));

window.setRivFreePreviewLanguage = language => {
 if(!new URLSearchParams(location.search).has('studio-preview') || window.parent===window)return;
 document.documentElement.lang=language;
 if(LANG!==language){LANG=language;render();translateUI();}
};
document.getElementById('languageToggle').addEventListener('change', event => {
 if(document.documentElement.dataset.seoHome && !new URLSearchParams(location.search).has('studio-preview')){
  const target=new URL(event.target.value==='es'?'index-es.html':'./',location.href);target.search=location.search;target.hash=location.hash;location.assign(target.href);return;
 }
 LANG=event.target.value;
 try {localStorage.setItem('rivfree-language',LANG);} catch {}
 document.querySelectorAll('dialog[open]').forEach(d=>d.close());
 render(); translateUI(); window.applyRivFreeSiteConfig?.(window.RIVFREE_SITE_CONFIG); renderCampaigns(); updateExchangeNote(); if(document.getElementById('shoppingDialog').open)renderShoppingList();
});
const backToTop=document.getElementById('backToTop');
window.addEventListener('scroll',()=>{backToTop.hidden=window.scrollY<600;},{passive:true});
backToTop.addEventListener('click',()=>{
 window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 document.querySelector('.brand-link').focus({preventScroll:true});
});
document.getElementById('closeHistory').addEventListener('click',()=>document.getElementById('historyDialog').close());
translateUI();
window.RIVFREE_SITE_READY?.then(()=>window.applyRivFreeSiteConfig?.(window.RIVFREE_SITE_CONFIG));
initStorefront();
loadData();
