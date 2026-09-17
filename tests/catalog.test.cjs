const {test}=require('node:test');const assert=require('node:assert/strict');
const {Catalog,prepareCatalog}=require('../catalog.js');
const p=(nombre,tienda='A',precio_usd=20)=>({nombre,tienda,precio_usd,categoria:'perfumes',url:`https://${tienda}.example/${encodeURIComponent(nombre)}`});
test('aliases, accents and unit equivalence merge complete identities',()=>{
 assert.equal(Catalog.identity(p('Perfume Acqua Example Eau de Parfum 0,1 L Masculino')),Catalog.identity(p('Acqua Example EDP 100ml Hombre','B')));
});
test('concentration, volume, color and pack variants stay separate',()=>{
 for(const pair of [['Acqua Example EDP 100ml','Acqua Example EDT 100ml'],['Acqua Example EDP 100ml','Acqua Example EDP 50ml'],['JBL Flip 6 Preto','JBL Flip 6 Azul'],['Acqua Example EDP 100ml','Kit 2 Acqua Example EDP 100ml']])assert.notEqual(Catalog.identity(p(pair[0])),Catalog.identity(p(pair[1],'B')));
});
test('incomplete perfume descriptions remain store specific',()=>assert.notEqual(Catalog.identity(p('Acqua Example 100ml')),Catalog.identity(p('Acqua Example 100ml','B'))));
test('invalid prices do not remove entries and observed Oprha prices are preserved',()=>{
 const result=prepareCatalog({productos:[p('Acqua Example EDP 100ml','Oprha Free Shop',999),p('Acqua Example EDP 100ml','B',0),p('Acqua Example EDP 100ml','C',10)]});
 assert.equal(result.products.length,3);assert.equal(result.groups.length,1);assert.equal(result.groups[0].offers[0].precio_usd,10);assert.equal(result.products[0].precio_usd,999);assert.equal(result.products[1].precio_usd,null);
});
test('duplicate URLs are removed from groups',()=>{const product=p('Acqua Example EDP 100ml');assert.equal(prepareCatalog({productos:[product,product]}).groups[0].offers.length,1);});

test('different URLs from the same store never collapse into one group',()=>{
 const a=p('JBL Flip 6 20W Preto','Barão Free Shop',100);
 const b={...a,url:'https://barao.example/jbl-flip-6-preto-variant-2'};
 const result=prepareCatalog({productos:[a,b]});
 assert.equal(result.products.length,2);
 assert.equal(result.groups.length,2);
});
