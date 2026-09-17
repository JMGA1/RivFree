
const Catalog = (() => {
const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const categories = {
 cosmetica:['Cosmética y cuidado personal','Cosméticos e cuidados pessoais'],
 perfumes:['Perfumes','Perfumes'], bebidas:['Bebidas','Bebidas'], alimentos:['Alimentos y chocolates','Alimentos e chocolates'],
 electronica:['Electrónica','Eletrônicos'], informatica:['Informática','Informática'], hogar:['Hogar y decoración','Casa e decoração'],
 electrodomesticos:['Electrodomésticos','Eletrodomésticos'], ropa:['Ropa y calzado','Roupas e calçados'],
 accesorios:['Bolsos y accesorios','Bolsas e acessórios'], juguetes:['Juguetes e infantil','Brinquedos e infantil'],
 relojes:['Relojes','Relógios'], optica:['Óptica','Óptica'], deportes:['Deportes','Esportes'], herramientas:['Herramientas','Ferramentas'], otros:['Otros','Outros']
};
function category(raw, name='') {
 const s=norm(raw).replace(/[-_]/g,' ');
 if(/cosmet|cabelo|olaplex|maquill|maquiag|cuidado|skincare/.test(s)) return 'cosmetica';
 if(/perfum/.test(s)) {
  if(/beleza/.test(s) && /crem|shampoo|champu|locion|locao|batom|labial|mascara|maqui|desodor|sabon|jabon|serum/.test(norm(name))) return 'cosmetica';
  return 'perfumes';
 }
 if(/bebida|vinho|vino|whisk|licor|espum|vodka|\bgim\b|\bgin\b|cerve|tequila|rum|pisco|energet/.test(s)) return 'bebidas';
 if(/comest|alimenta|alimento|chocol|alfajor|azeite|biscoit|gallet|doce/.test(s)) return 'alimentos';
 if(/informat|tablet|notebook|comput/.test(s)) return 'informatica';
 if(/eletrodom|electrodom|ar ?condicionado/.test(s)) return 'electrodomesticos';
 if(/eletron|eletron|electron|audio|video|camera|gps|celular|\btvs\b|\bjbl\b|samsung|apple|games/.test(s)) return 'electronica';
 if(/bazar|cozinha|cocina|decor|crista|vidro|porcelana/.test(s)) return 'hogar';
 if(/roupa|ropa|vestimenta|nike|vans|calzado|calcado/.test(s)) return 'ropa';
 if(/accesor|acessor|bolsa|mala|mochila/.test(s)) return 'accesorios';
 if(/juguet|brinquedo|infantil|bebe/.test(s)) return 'juguetes';
 if(/reloj|relog/.test(s)) return 'relojes';
 if(/optic|oculos/.test(s)) return 'optica';
 if(/deport|esport/.test(s)) return 'deportes';
 if(/herramient|ferrament/.test(s)) return 'herramientas';
 return 'otros';
}
const aliases = {
 electronicos:'electronica',eletronicos:'electronica',eletronica:'electronica',
 cosmetica:'cosmetica',cosmeticos:'cosmetica',maquillajes:'maquillaje',
 comestiveis:'alimentos',comestibles:'alimentos',alimento:'alimentos',
 decoracao:'decoracion',cozinha:'cocina',relojeria:'reloj',jugueteria:'juguete',
 ferramentas:'herramientas',esportes:'deportes',bebida:'bebidas',
 
 perfumes:'perfume',perfumaria:'perfume',perfumeria:'perfume',perfum:'perfume',
 cosmeticos:'cosmetica',cosmetico:'cosmetica',cosmeticas:'cosmetica',
 maquiagem:'maquillaje',maquiagem:'maquillaje',batom:'labial',labiales:'labial',
 shampoo:'champu',shampoos:'champu',cabelo:'cabello',cabelos:'cabello',
 hidratante:'hidratante',creme:'crema',cremes:'crema',locao:'locion',sabonete:'jabon',
 masculino:'hombre',masculinos:'hombre',masculina:'hombre',masc:'hombre',men:'hombre',man:'hombre',homme:'hombre',homem:'hombre',hombres:'hombre',
 feminino:'mujer',femininos:'mujer',feminina:'mujer',fem:'mujer',women:'mujer',woman:'mujer',femme:'mujer',mulher:'mujer',mujeres:'mujer',
 whisky:'whisky',whiskey:'whisky',uisque:'whisky',vinho:'vino',vinhos:'vino',vinos:'vino',
 cerveja:'cerveza',cervejas:'cerveza',cervezas:'cerveza',licores:'licor',gim:'gin',
 chocolates:'chocolate',biscoito:'galleta',biscoitos:'galleta',galletas:'galleta',azeite:'aceite',
 fone:'auricular',fones:'auricular',auriculares:'auricular',audifonos:'auricular',headphones:'auricular',headphone:'auricular',
 parlantes:'parlante',altavoz:'parlante',altavoces:'parlante',speaker:'parlante',speakers:'parlante',
 relogio:'reloj',relogios:'reloj',relojes:'reloj',brinquedo:'juguete',brinquedos:'juguete',juguetes:'juguete',
 roupas:'ropa',camiseta:'remera',tenis:'zapatilla',calcados:'calzado',oculos:'gafas',
 preto:'negro',preta:'negro',black:'negro',branco:'blanco',branca:'blanco',white:'blanco',azul:'azul',blue:'azul',
 vermelho:'rojo',vermelha:'rojo',red:'rojo',verde:'verde',green:'verde',rosa:'rosa',pink:'rosa',
 anos:'anos',years:'anos',year:'anos',anios:'anos',unidades:'unidad',unidade:'unidad',unidades:'unidad',pcs:'unidad'
};
function normalized(s) {
 return norm(s)
 .replace(/\beau\s+de\s+parfum\b|\be\s*\.\s*d\s*\.\s*p\s*\.?/g,' edp ')
 .replace(/\beau\s+de\s+toilette\b|\be\s*\.\s*d\s*\.\s*t\s*\.?/g,' edt ')
 .replace(/\beau\s+de\s+cologne\b/g,' edc ')
 .replace(/\bcaixa\s+de\s+som\b|\bcaixa\s+som\b/g,' parlante ')
 .replace(/\bjohnny\s+walker\b/g,' johnnie walker ')
 .replace(/\bjean\s+paul\s+gaultier\b/g,' jpg ')
 .replace(/\byves\s+saint\s+laurent\b/g,' ysl ')
 .replace(/\bdolce\s*(?:&|and|e|y)\s*gabbana\b/g,' dolce gabbana ')
 .replace(/\b(?:edp|edt|edc)(?=\d)/g, m=>m+' ')
 .replace(/(\d+)\s*[x×]\s*(?=\d)/g,' $1 pack ')
 .replace(/\b(?:pack|kit|set)\s*(?:de|com|con)?\s*(\d+)/g,' $1 pack ')
 .replace(/\bcarolina\s+herrera\b/g,' carolina herrera ')
 .replace(/\bmililitros?\b/g,'ml').replace(/\blitros?\b|\blts?\b/g,'l')
 .replace(/\bgramas?\b|\bgramos?\b|\bgr\b/g,'g')
 .replace(/(\d+(?:[.,]\d+)?)\s*(ml|cl|cc|l|kg|g)\b/g,(_,v,u)=>{
  let n=Number(v.replace(',','.')); const unit=['kg','g'].includes(u)?'g':'ml';
  n*=u==='l'||u==='kg'?1000:u==='cl'?10:1;return ' '+Number(n.toFixed(3))+unit+' ';
 }).replace(/(\d+)\s*(gb|tb|cm|mm|oz)\b/g,' $1$2 ');
}
const stop=new Set('de da do del dos das para por com con e y the and un una'.split(' '));
function tokens(s) {return (normalized(s).match(/[a-z0-9]+(?:\.[0-9]+)?/g)||[]).map(t=>aliases[t]||t).filter(t=>!stop.has(t));}
function search(s) {return tokens(s).join(' ');}
// Descriptor words may differ between stores; identity, measures and variants remain.
const descriptors=new Set('perfume spray vaporizador vaporisateur vaporizer natural importado original bebida whisky vino licor cerveza'.split(' '));
function identity(p) {
 const ts=tokens(p.nombre).filter(t=>!descriptors.has(t));
 const family=category(p.categoria,p.nombre);
 const measures=ts.filter(t=>/^\d+(?:\.\d+)?(?:ml|g|gb|tb|cm|mm|oz)$/.test(t));
 const model=ts.some(t=>/\d/.test(t)&&/[a-z]/.test(t));
 const concentration=ts.some(t=>['edp','edt','edc','parfum','extrait'].includes(t));
 const distinct=ts.filter(t=>!/^\d/.test(t)&&!['edp','edt','edc','parfum','hombre','mujer'].includes(t));
 const safe=distinct.length>=2 && (measures.length>0||model) && (family!=='perfumes'||concentration);
 // Do not merge incomplete descriptions across stores.
 return family+'|'+ts.sort().join(' ') + (safe?'':'|'+p.tienda+'|'+(p.url||p.nombre));
}
return {norm,categories,category,tokens,search,identity};
})();

function canonicalProductUrl(value) {
  const safe = safeHttpUrl(value);
  if (!safe) return null;
  try {
    const url = new URL(safe);
    let path = url.pathname || '/';
    try { path = decodeURIComponent(path); } catch {}
    path = path.normalize('NFC');
    if (path !== '/') path = path.replace(/\/+$/, '');
    const host = url.hostname.toLowerCase().replace(/^www\./, '') +
      ((url.port && !((url.protocol === 'http:' && url.port === '80') || (url.protocol === 'https:' && url.port === '443'))) ? `:${url.port}` : '');
    const params = [...url.searchParams.entries()]
      .filter(([key]) => !key.toLowerCase().startsWith('utm_') && !['fbclid','gclid','dclid','msclkid','mc_cid','mc_eid'].includes(key.toLowerCase()))
      .sort(([a,av],[b,bv]) => a.localeCompare(b) || av.localeCompare(bv));
    const query = new URLSearchParams(params).toString();
    return `${host}${path}${query ? `?${query}` : ''}`;
  } catch {
    return safe;
  }
}

function mergeDuplicateProduct(oldProduct, newProduct) {
  if (!oldProduct) return {...newProduct};
  const oldHasPrice = hasPrice(oldProduct);
  const newHasPrice = hasPrice(newProduct);
  const preferred = newHasPrice && !oldHasPrice ? newProduct : oldProduct;
  const secondary = preferred === oldProduct ? newProduct : oldProduct;
  const merged = {...preferred};
  for (const [key, value] of Object.entries(secondary)) {
    if ((merged[key] === null || merged[key] === undefined || merged[key] === '') && value !== null && value !== undefined && value !== '') {
      merged[key] = value;
    }
  }
  if (!preferred.datos_anteriores || !secondary.datos_anteriores) delete merged.datos_anteriores;
  return merged;
}

function dedupeProductsPreferComplete(products) {
  const byKey = new Map();
  const order = [];
  products.forEach((product, index) => {
    const urlKey = canonicalProductUrl(product.url);
    const key = urlKey ? `url:${urlKey}` : `fallback:${product.tienda}|${product.nombre}|${product.categoria || ''}|${index}`;
    if (!byKey.has(key)) order.push(key);
    byKey.set(key, mergeDuplicateProduct(byKey.get(key), product));
  });
  return order.map(key => byKey.get(key));
}

function groupProducts(products) {
  const groups = new Map();
  products.forEach((product, index) => {
    const url = safeHttpUrl(product.url);

    const canonical = Catalog.identity(product);
    const conservativeKey = canonical;
    const baseKey = conservativeKey || `product-${index}`;
    let key = baseKey;

    // Nunca colapsar dos publicaciones distintas de la MISMA tienda.
    // La agrupación sirve para comparar el mismo producto entre tiendas, no para
    // ocultar SKUs/variantes diferentes de Barão/Yury/etc. con nombres parecidos.
    const existing = groups.get(baseKey);
    if (existing && existing.offers.some(offer => {
      if (offer.tienda !== product.tienda) return false;
      const previousUrl = safeHttpUrl(offer.url);
      return !url || !previousUrl || previousUrl !== url;
    })) {
      key = `${baseKey}|same-store|${product.tienda}|${url || index}`;
    }

    if (!groups.has(key)) groups.set(key, {key, offers:[]});
    groups.get(key).offers.push(product);
  });

  return [...groups.values()].map(group => {
    group.offers.sort(compareOfferPrices);
    const named = [...group.offers].sort((a, b) =>
      b.nombre.length - a.nombre.length || a.nombre.localeCompare(b.nombre, 'es')
    );
    group.name = named[0].nombre;
    group.category = named[0].categoria;
    group.image = group.offers.find(offer => safeHttpUrl(offer.imagen))?.imagen || null;
    group.storeCount = new Set(group.offers.map(offer => offer.tienda)).size;
    return group;
  });
}

function safeHttpUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function hasPrice(product) {
  return Number.isFinite(product.precio_usd) && product.precio_usd > 0;
}

function compareOfferPrices(a, b) {
  if (hasPrice(a) && hasPrice(b)) return a.precio_usd - b.precio_usd;
  if (hasPrice(a)) return -1;
  if (hasPrice(b)) return 1;
  return a.tienda.localeCompare(b.tienda, 'es');
}


function prepareCatalog(data) {
 if(!data || !Array.isArray(data.productos)) throw new Error('Invalid catalog');
 const mapped=data.productos.filter(p=>p && typeof p.nombre==='string' && typeof p.tienda==='string').map(p=>{
  const product={...p};
  if(!hasPrice(product)) {product.precio_usd=null;product.precio_original_usd=null;product.en_oferta=false;}
  product.categoryId=Catalog.category(product.categoria,product.nombre);
  product.searchIndex=Catalog.search(`${product.nombre} ${product.categoria} ${Catalog.categories[product.categoryId].join(' ')} ${product.tienda}`);
  return product;
 });
 const products=dedupeProductsPreferComplete(mapped);
 return {products,groups:groupProducts(products),words:[...new Set(products.flatMap(p=>p.searchIndex.split(' ')))]};
}
if(typeof module!=='undefined') module.exports={Catalog,groupProducts,prepareCatalog,hasPrice,canonicalProductUrl,dedupeProductsPreferComplete};
