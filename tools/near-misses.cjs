// Herramienta de diagnóstico: lista pares de productos de distintas tiendas que casi coinciden y NO se agruparon.
// Uso: node tools/near-misses.cjs [cantidad]  →  te dice qué palabras conviene agregar a NOISE / ALIAS / GENERIC en matching.js
const {Matching}=require('../matching.js');
const d=require('../data/products.json');
const prods=d.productos.filter(p=>p&&p.nombre&&p.tienda);
const g=Matching.buildGroups(prods);
const gid=new Map();g.forEach((x,i)=>x.offers.forEach(o=>gid.set(o,i)));
// fingerprint per product (sin typo map, aprox)
const fp=prods.map(p=>Matching.fingerprint(Matching.rawTokens(p.nombre)));
const inv=new Map();
fp.forEach((f,i)=>{for(const t of f.core){if(t.length<4)continue;(inv.get(t)||inv.set(t,[]).get(t)).push(i)}});
const seen=new Set(),out=[];
for(const [t,ids] of inv){ if(ids.length>60||ids.length<2)continue;
 for(let a=0;a<ids.length;a++)for(let b=a+1;b<ids.length;b++){
  const i=ids[a],j=ids[b];if(prods[i].tienda===prods[j].tienda||gid.get(prods[i])===gid.get(prods[j]))continue;
  const k=i<j?i+'-'+j:j+'-'+i;if(seen.has(k))continue;seen.add(k);
  const A=fp[i],B=fp[j];
  if(A.measure&&B.measure&&A.measure!==B.measure)continue;
  if(A.conc&&B.conc&&A.conc!==B.conc)continue;
  const sa=new Set(A.core),sb=new Set(B.core);const inter=[...sa].filter(x=>sb.has(x)).length;
  const jac=inter/(new Set([...sa,...sb]).size);
  if(jac>=0.6&&jac<1&&inter>=2)out.push({jac,i,j,onlyA:[...sa].filter(x=>!sb.has(x)),onlyB:[...sb].filter(x=>!sa.has(x))});
 }}
out.sort((a,b)=>b.jac-a.jac);
console.log('near-miss pairs',out.length);
const diffCount={};out.forEach(o=>[...o.onlyA,...o.onlyB].forEach(t=>diffCount[t]=(diffCount[t]||0)+1));
console.log('tokens que más impiden unir:',Object.entries(diffCount).sort((a,b)=>b[1]-a[1]).slice(0,40).map(x=>x.join(':')).join('  '));
out.slice(0,int=parseInt(process.argv[2]||'25')).forEach(o=>console.log('\n'+o.jac.toFixed(2)+'  '+prods[o.i].tienda.slice(0,5)+': '+prods[o.i].nombre.slice(0,70)+'\n      '+prods[o.j].tienda.slice(0,5)+': '+prods[o.j].nombre.slice(0,70)+'   diff='+JSON.stringify([o.onlyA,o.onlyB])));
