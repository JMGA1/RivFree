/*
 * matching.js — agrupación de productos entre tiendas (RivFree)
 *
 * Idea central: en vez de exigir que dos nombres tengan EXACTAMENTE las mismas
 * palabras, cada nombre se convierte en una "ficha" estructurada:
 *
 *   core     → palabras que identifican al producto (marca, línea, variante)
 *   measure  → volumen/peso normalizado (0,25 LT == 250 ML)
 *   conc     → concentración de perfume (EDP/EDT…)
 *   gender   → hombre / mujer / unisex
 *   pack     → cantidad de unidades
 *
 * Dos productos son "el mismo" si tienen el mismo core y sus atributos son
 * compatibles. Un atributo que falta en una tienda (p. ej. Sineriz no pone los
 * 250 ml) funciona como comodín, pero SOLO si no hay ambigüedad.
 *
 * Todo lo que es vocabulario (sinónimos, ruido, variantes) está en las tablas
 * de arriba del archivo para poder ampliarlo sin tocar la lógica.
 */
const Matching = (() => {

// ───────────────────────── Vocabulario (editable) ─────────────────────────

// Palabras que describen el envase/tipo de producto pero no lo distinguen.
const NOISE = new Set((
  'lata botella botellin garrafa frasco caja unidad pieza pack un uno '
  + 'bebida energizante energetico energy drink refrigerante gaseosa '
  + 'perfume perfumaria colonia vaporizador vaporisateur vaporizer vapo spray natural importado importada '
  + 'original tradicional regular normal nuevo nueva novo '
  + 'whisky whiskey licor cerveza vino gin vodka tequila ron rum cognac champagne espumante espumoso '
  + 'tinto rosado '
  + 'producto marca oferta promo promocion edicion edition limitada label wifi np '
  + 'ml g kg l'
).split(/\s+/).filter(Boolean));
// Cuidado al agregar palabras: si una palabra distingue variantes reales (tropical, zero,
// intense, clásico) NO va en NOISE, porque juntaría productos distintos.

const STOP = new Set('de da do del dos das para por com con e y o the and of a an en em el la los las s c sin sem'.split(' '));

// Sinónimos / traducciones PT→ES / abreviaturas → forma canónica.
const ALIAS = {
  // idioma
  cerveja:'cerveza', cervejas:'cerveza', vinho:'vino', vinhos:'vino', licores:'licor', gim:'gin',
  uisque:'whisky', whiskey:'whisky', bebidas:'bebida', energeticos:'energetico', energetica:'energetico',
  energizantes:'energizante',
  cabelo:'cabello', cabelos:'cabello', creme:'crema', cremes:'crema', condicionador:'acondicionador',
  sabonete:'jabon', sabao:'jabon', locao:'locion', batom:'labial', hidratante:'hidratante',
  protetor:'protector', desodorante:'desodorante', esmalte:'esmalte', maquiagem:'maquillaje',
  copo:'vaso', caneca:'taza', garrafa:'botella', mochilas:'mochila', bolsa:'bolso',
  relogio:'reloj', relogios:'reloj', oculos:'gafas', anteojos:'gafas', lentes:'gafas',
  fone:'auricular', fones:'auricular', auriculares:'auricular', audifonos:'auricular', headphones:'auricular', headphone:'auricular',
  parlantes:'parlante', altavoz:'parlante', altavoces:'parlante', speaker:'parlante', speakers:'parlante',
  celular:'celular', telefono:'celular', smartphone:'celular',
  chocolates:'chocolate', biscoito:'galleta', biscoitos:'galleta', galletas:'galleta', galletitas:'galleta', azeite:'aceite',
  molho:'salsa', geleia:'mermelada', mermelada:'mermelada', cafe:'cafe', cafes:'cafe',
  // colores
  preto:'negro', preta:'negro', black:'negro', negra:'negro', branco:'blanco', branca:'blanco', white:'blanco', blanca:'blanco',
  azul:'azul', blue:'azul', vermelho:'rojo', vermelha:'rojo', red:'rojo', roja:'rojo', verde:'verde', green:'verde',
  rosa:'rosa', pink:'rosa', cinza:'gris', gray:'gris', grey:'gris', dourado:'dorado', gold:'dorado', prata:'plata', silver:'plata',
  amarelo:'amarillo', yellow:'amarillo', laranja:'naranja', orange:'naranja', marrom:'marron', brown:'marron', roxo:'violeta', purple:'violeta',
  // género
  masculino:'hombre', masculinos:'hombre', masculina:'hombre', masc:'hombre', men:'hombre', man:'hombre', homme:'hombre', homem:'hombre',
  hombres:'hombre', him:'hombre', uomo:'hombre', pour_homme:'hombre', male:'hombre',
  feminino:'mujer', femininos:'mujer', feminina:'mujer', fem:'mujer', women:'mujer', woman:'mujer', femme:'mujer', mulher:'mujer',
  mujeres:'mujer', her:'mujer', donna:'mujer', female:'mujer', dama:'mujer',
  // variantes sin azúcar
  zero:'sinazucar', sugarfree:'sinazucar', azucar:'azucar', acucar:'azucar', light:'sinazucar', diet:'sinazucar',
  // marcas escritas de varias formas
  jpg:'jpg', ysl:'ysl', cocacola:'coca', pepsi:'pepsi',
  // otras
  anos:'anos', years:'anos', year:'anos', anios:'anos', yo:'anos', unidades:'unidad', unidade:'unidad', pcs:'pz', pzs:'pz', pecas:'pz', piezas:'pz', pz:'pz',
};
const CONC = new Set(['edp','edt','edc','parfum','extrait']);
const GENDER = new Set(['hombre','mujer','unisex']);

// ───────────────────────── Normalización ─────────────────────────

const strip = s => {
  s = String(s || '');
  try { if (/%[0-9a-f]{2}/i.test(s)) s = decodeURIComponent(s); } catch {}
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
};

function normalizeText(raw) {
  let s = strip(raw);
  s = s.replace(/['’´`‘]/g, '');                                       // Daniel's → daniels
  s = s.replace(/\bs\s*\/\s*(?:azucar|acucar)\b/g, ' sinazucar ')      // S/Azucar
       .replace(/\bsin\s+(?:azucar|acucar)\b|\bsem\s+(?:azucar|acucar)\b|\bsugar\s*free\b/g, ' sinazucar ');
  s = s.replace(/\beau\s+de\s+parfum\b|\be\s*\.\s*d\s*\.\s*p\b\.?/g, ' edp ')
       .replace(/\beau\s+de\s+toilette\b|\be\s*\.\s*d\s*\.\s*t\b\.?/g, ' edt ')
       .replace(/\beau\s+de\s+cologne\b|\bcolonia\b/g, ' edc ')
       .replace(/\bpour\s+homme\b/g, ' hombre ').replace(/\bpour\s+femme\b/g, ' mujer ')
       .replace(/\bcaixa\s+de\s+som\b|\bcaixa\s+som\b/g, ' parlante ')
       .replace(/\bjohnn?y\s+walker\b|\bj\.?\s+walker\b/g, ' johnnie walker ')
       .replace(/\bjean\s+paul\s+gaultier\b/g, ' jpg ')
       .replace(/\byves\s+saint\s+laurent\b|\bs\.?\s*laurent\b/g, ' ysl ')
       .replace(/\bdolce\s*(?:&|and|e|y)\s*gabbana\b/g, ' dolce gabbana ')
       .replace(/\bcoca[\s-]*cola\b/g, ' coca cola ')
       .replace(/\bred\s*bull\b/g, ' redbull ');
  // pegados: EDT50ML → EDT 50ML ; 12year → 12 year
  s = s.replace(/\b(edp|edt|edc)(?=\d)/g, '$1 ')
       .replace(/([a-z]{3,})(\d+(?:[.,]\d+)?(?:ml|cl|cc|kg|gr|g|lts?|l)\b)/g, '$1 $2')
       .replace(/(\d+)\s*(years?|anos?|anios?)\b/g, ' $1 anos ');
  // packs: 6 x 250ml, x6, kit 3, pack de 2, 3pz
  s = s.replace(/(\d+)\s*[x×]\s*(?=\d)/g, ' $1pk ')
       .replace(/\b[x×]\s*(\d{1,3})\b(?!\s*(?:ml|cl|cc|g|gr|kg|l|lts?))/g, ' $1pk ')
       .replace(/\b(?:pack|kit|set|conjunto|combo)\s*(?:de|com|con)?\s*(\d+)(?:pk\b)?/g, ' $1pk ')
       .replace(/(\d+)\s*(?:pz|pzs|pcs|pecas|piezas|un|unid|unidades?)\b/g, ' $1pk ');
  // unidades de medida → ml / g
  s = s.replace(/(\d+(?:[.,]\d+)?)\s*(ml|mls|mililitros?|cl|cc|lts?|litros?|l|kg|kgs|gr|grs|g|gramos?|gramas?|mg|oz|gb|tb|cm|mm)\b\.?/g, (_, v, u) => {
    let n = Number(v.replace(',', '.'));
    if (Number.isNaN(n)) return ' ';
    if (/^(?:ml|mls|mililitros?)$/.test(u)) return ' ' + Number(n.toFixed(3)) + 'ml ';
    if (u === 'cl') return ' ' + Number((n * 10).toFixed(3)) + 'ml ';
    if (u === 'cc') return ' ' + Number(n.toFixed(3)) + 'ml ';
    if (/^(?:lts?|litros?|l)$/.test(u)) return ' ' + Number((n * 1000).toFixed(3)) + 'ml ';
    if (/^(?:kg|kgs)$/.test(u)) return ' ' + Number((n * 1000).toFixed(3)) + 'g ';
    if (/^(?:gr|grs|g|gramos?|gramas?)$/.test(u)) return ' ' + Number(n.toFixed(3)) + 'g ';
    return ' ' + Number(n.toFixed(3)) + u + ' ';
  });
  return s;
}

function singular(t) {
  if (t.length >= 6 && t.endsWith('s') && !/(?:ss|us|is|os)$/.test(t)) return t.slice(0, -1);
  return t;
}

function rawTokens(name) {
  const out = [];
  for (const t of normalizeText(name).match(/[a-z0-9]+(?:\.[0-9]+)?/g) || []) {
    let u = ALIAS[t] || t;
    if (!ALIAS[t] && !/\d/.test(u)) u = singular(u);
    u = ALIAS[u] || u;
    if (STOP.has(u) || (u.length === 1 && /[a-z]/.test(u))) continue;
    out.push(u);
  }
  return out;
}

const isMeasure = t => /^\d+(?:\.\d+)?(?:ml|g|gb|tb|cm|mm|oz|mg)$/.test(t);
const isPack = t => /^\d+pk$/.test(t);
const isCode = t => /^\d{4,}$/.test(t) && !/^(?:19|20)\d\d$/.test(t);
const hasDigitAndLetter = t => /\d/.test(t) && /[a-z]/.test(t) && !isMeasure(t) && !isPack(t);

// ───────────────────────── Corrección de typos por vocabulario ─────────────────────────

function oneEdit(a, b) {
  if (a === b) return false;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0;
  while (i < la && i < lb && a[i] === b[i]) i++;
  if (la === lb) {
    if (a.slice(i + 1) === b.slice(i + 1)) return true;                      // sustitución
    return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2); // transposición
  }
  return la > lb ? a.slice(i + 1) === b.slice(i) : b.slice(i + 1) === a.slice(i);       // inserción/borrado
}

function buildTypoMap(freq) {
  const words = [...freq.keys()].filter(t => t.length >= 5 && !/\d/.test(t));
  const byKey = new Map();
  for (const w of words) { const k = w[0]; (byKey.get(k) || byKey.set(k, []).get(k)).push(w); }
  const map = new Map();
  for (const w of words) {
    const f = freq.get(w);
    if (f > 3) continue;                       // solo se corrigen palabras raras
    let best = null, bestF = 0;
    for (const c of byKey.get(w[0])) {
      const cf = freq.get(c);
      if (cf >= f * 4 && cf >= 4 && cf > bestF && oneEdit(w, c)) { best = c; bestF = cf; }
    }
    if (best) map.set(w, best);
  }
  return map;
}

// ───────────────────────── Ficha de producto ─────────────────────────

function fingerprint(tokens) {
  const core = [], measures = [], packs = [];
  let conc = null, gender = null, code = null;
  for (const t of tokens) {
    if (isMeasure(t)) measures.push(t);
    else if (isCode(t)) code = code || t;
    else if (isPack(t)) packs.push(t);
    else if (CONC.has(t)) conc = conc || t;
    else if (GENDER.has(t)) gender = gender || t;
    else if (NOISE.has(t)) continue;
    else core.push(t);
  }
  const uniq = [...new Set(core)].sort();
  return {
    core: uniq,
    coreKey: uniq.join(' '),
    measure: measures.length ? [...new Set(measures)].sort().join('+') : null,
    conc,
    gender,
    code,
    pack: packs.length ? [...new Set(packs)].sort().join('+') : '1',
    model: uniq.some(hasDigitAndLetter),
  };
}

// Sustantivos comunes: un producto descrito SOLO con estas palabras ("Vaso para
// flores") no se agrupa entre tiendas porque puede ser cualquier cosa.
// Amplialo libremente si ves falsos positivos con productos sin marca.
const GENERIC = new Set((
  'vaso jogo cesta cesto mesa silla cadeira caja bolso mochila toalla sabana cuchillo gorra remera '
  + 'flore planta maceta juguete peluche muneco figura adorno decoracion cable cargador funda estuche '
  + 'lampara luz reloj gafas cinturon billetera camiseta short pantalon calca campera abrigo zapatilla chinela '
  + 'cachorro natalino kit set combo regalo cofre'
).split(/\s+/).filter(Boolean));
const VERY_COMMON_DF = 90;

// Un producto con muy poca información no se agrupa entre tiendas.
//  - con medida / modelo / código / concentración basta con 1-2 palabras;
//  - "solo palabras" y ≤2 palabras: no puede contener sustantivos genéricos.
function isSpecific(f, df) {
  const hasAttr = !!(f.measure || f.model || f.code || f.conc);
  if (f.core.length >= 3) return true;
  if (f.core.length === 0) return false;
  if (hasAttr) return f.core.length >= 2 || f.core[0].length >= 4;
  if (f.core.some(t => GENERIC.has(t) || (df.get(t) || 0) >= VERY_COMMON_DF)) return false;
  return f.core.length >= 2 || f.core[0].length >= 6;
}

const ATTRS = ['measure', 'conc', 'gender', 'code'];
const tupleKey = f => ATTRS.map(a => f[a] || '?').join('|') + '|' + f.pack;
const compatible = (a, b) => ATTRS.every(k => !a[k] || !b[k] || a[k] === b[k]) && a.pack === b.pack;

// ───────────────────────── Agrupación ─────────────────────────

/**
 * products → [{ key, offers:[...], confidence }]
 * Regla fija heredada: un grupo nunca contiene dos ofertas de la misma tienda.
 */
function buildGroups(products, options = {}) {
  const tokenLists = products.map(p => rawTokens(p.nombre));
  const freq = new Map();
  for (const ts of tokenLists) for (const t of new Set(ts)) freq.set(t, (freq.get(t) || 0) + 1);
  const typo = options.typoCorrection === false ? new Map() : buildTypoMap(freq);
  const fps = tokenLists.map(ts => fingerprint(ts.map(t => typo.get(t) || t)));

  // 1) cubetas por core
  const df = new Map();
  for (const f of fps) for (const t of f.core) df.set(t, (df.get(t) || 0) + 1);
  const buckets = new Map();
  const solos = [];
  products.forEach((p, i) => {
    if (!isSpecific(fps[i], df)) { solos.push(i); return; }
    (buckets.get(fps[i].coreKey) || buckets.set(fps[i].coreKey, []).get(fps[i].coreKey)).push(i);
  });

  const clusters = [];           // {key, members:[idx], exact:boolean}
  for (const [coreKey, idxs] of buckets) {
    // 2) sub-cubetas por atributos exactos
    const byTuple = new Map();
    for (const i of idxs) {
      const k = tupleKey(fps[i]);
      (byTuple.get(k) || byTuple.set(k, []).get(k)).push(i);
    }
    const tuples = [...byTuple.keys()];
    const nulls = k => (k.match(/\?/g) || []).length;
    tuples.sort((a, b) => nulls(a) - nulls(b));
    const rep = k => fps[byTuple.get(k)[0]];
    const merged = new Map();     // tuple parcial → tuple destino
    // 3) comodines: un producto al que le falta un atributo se une a la
    //    única variante compatible; si hay varias, queda aparte (ambiguo)
    for (const k of tuples) {
      if (nulls(k) === 0) continue;
      const cands = tuples.filter(o => o !== k && compatible(rep(k), rep(o)) && ATTRS.some(a => !rep(k)[a] && rep(o)[a])
        // en perfumes hay muchos tamaños: sin medida NO se une con uno que la tiene
        && !(!rep(k).measure && rep(o).measure && (rep(k).conc || rep(o).conc)));
      if (cands.length === 1) merged.set(k, cands[0]);
    }
    const resolve = k => { let g = 0; while (merged.has(k) && g++ < 5) k = merged.get(k); return k; };
    const final = new Map();
    const priceOf = i => (Number.isFinite(products[i].precio_usd) && products[i].precio_usd > 0 ? products[i].precio_usd : null);
    const median = a => { const v = a.filter(x => x != null).sort((x, y) => x - y); return v.length ? v[Math.floor(v.length / 2)] : null; };
    const add = (t, list) => (final.get(t) || final.set(t, []).get(t)).push(...list);
    for (const k of tuples) { if (!merged.has(k)) add(k, byTuple.get(k)); }
    for (const k of tuples) {
      if (!merged.has(k)) continue;
      const target = resolve(k);
      const ref = median((final.get(target) || []).map(priceOf));
      // Una oferta sin medida solo se une a una variante con medida si su precio es
      // coherente (evita juntar un mini de 50 ml con la botella completa).
      const ok = [], rejected = [];
      for (const i of byTuple.get(k)) {
        const pr = priceOf(i);
        (pr && ref && Math.max(pr, ref) / Math.min(pr, ref) > 2.5 ? rejected : ok).push(i);
      }
      add(target, ok);
      if (rejected.length) add(k, rejected);
    }
    for (const [t, members] of final) {
      clusters.push({ key: coreKey + '#' + t, members, exact: !t.includes('?') });
    }
  }

  // 4) un grupo = una oferta por tienda; las repetidas de la misma tienda se separan
  const groups = [];
  const seenUrl = u => u || null;
  for (const c of clusters) {
    const perStore = new Map();
    const extra = [];
    for (const i of c.members) {
      const p = products[i];
      if (!perStore.has(p.tienda)) perStore.set(p.tienda, i);
      else {
        const prev = products[perStore.get(p.tienda)];
        if (seenUrl(prev.url) && seenUrl(prev.url) === seenUrl(p.url)) continue; // duplicado real
        extra.push(i);
      }
    }
    groups.push({ key: c.key, offers: [...perStore.values()].map(i => products[i]), confidence: c.exact ? 'alta' : 'media' });
    extra.forEach(i => groups.push({ key: c.key + '|dup|' + products[i].tienda + '|' + (products[i].url || i), offers: [products[i]], confidence: 'alta' }));
  }
  for (const i of solos) {
    const p = products[i];
    groups.push({ key: 'solo|' + p.tienda + '|' + (p.url || p.nombre + '|' + i), offers: [p], confidence: 'alta' });
  }
  return groups;
}

return { buildGroups, rawTokens, fingerprint, normalizeText, buildTypoMap, NOISE, ALIAS };
})();
if (typeof module !== 'undefined') module.exports = { Matching };
if (typeof self !== 'undefined') self.Matching = Matching;
