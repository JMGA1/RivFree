const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Catalog,prepareCatalog}=require('../catalog.js');
function product(nombre, tienda='Neutral') {
 return prepareCatalog({productos:[{nombre,tienda,categoria:'bebidas',precio_usd:3,
   url:'https://example.com/product'}]}).products[0];
}
const matches=(p,q)=>Catalog.matchesSearch(p,Catalog.searchQuery(q));
test('joined, spaced, accented and hyphenated brand queries work in both directions',()=>{
 for(const name of ['Red Bull 250ml','RedBull 250ml','Red-Bull 250ml']) {
  for(const query of ['RedBull','red bull','RED-BULL','réd búll','bull red','redbull 250 ml','redbull 0,25 l']) {
   assert.ok(matches(product(name),query),`${name} / ${query}`);
  }
 }
});
test('generic joined brands, categories, stores and bilingual aliases combine',()=>{
 assert.ok(matches(product('Johnnie Walker Black Label 1L'),'johnniewalker'));
 assert.ok(matches(product('Coca-Cola 330ml'),'cocacola'));
 assert.ok(matches(product('Red Bull 250ml','Barão Free Shop'),'redbull barao bebidas'));
 assert.ok(matches(product('Red Bull 250ml'),'redbull bebida'));
 assert.ok(matches(product('Whiskey Example 1L'),'whisky 1000ml'));
});
test('all search terms are required and independent fields are not concatenated',()=>{
 const p=product('Red Bull 250ml');
 for(const q of ['redbull monster','redbull 500ml','bullneutral','xyznotfound'])assert.equal(matches(p,q),false,q);
 assert.equal(matches(p,''),true);
});
test('search changes leave product identities and variants separate',()=>{
 assert.notEqual(Catalog.identity(product('Red Bull 250ml')),Catalog.identity(product('Red Bull 500ml')));
});
