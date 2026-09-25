const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const {Catalog,prepareCatalog,hasPrice}=require('../catalog.js');
const source=fs.readFileSync(require.resolve('../app.js'),'utf8');
function app() {
 const prepared=prepareCatalog({productos:[
  {nombre:'Red Bull 250ml',tienda:'A',categoria:'bebidas',precio_usd:2,url:'https://a.example/1'},
  {nombre:'RedBull 250ml',tienda:'B',categoria:'bebidas',precio_usd:3,url:'https://b.example/1'},
  {nombre:'Agua sin precio',tienda:'A',categoria:'bebidas',precio_usd:null,url:'https://a.example/3'},
  {nombre:'Red Bull 250ml',tienda:'C',categoria:'bebidas',precio_usd:null,url:'https://c.example/1'},
  {nombre:'Chocolate Milka 100g',tienda:'A',categoria:'alimentos',precio_usd:4,url:'https://a.example/2'}
 ]});
 const fields={hideUnavailable:{checked:false},categoria:{value:''},soloOfertas:{checked:false},orden:{value:'precio_asc'},favoritesOnly:{checked:false}};
 const ctx=vm.createContext({Catalog,hasPrice,PRODUCT_GROUPS:prepared.groups,ACTIVE_SEARCH:'',favorites:new Set(),
  readPriceRange:()=>({min:NaN,max:NaN}),document:{getElementById:id=>fields[id],querySelectorAll:()=>[{value:'A'},{value:'B'}]}});
 vm.runInContext(source.slice(source.indexOf('let SEARCH_WORDS='),source.indexOf('function readPriceRange')),ctx);
 ctx.words=prepared.words;
 vm.runInContext('SEARCH_WORDS=words;',ctx);
 vm.runInContext(source.slice(source.indexOf('function getFiltered()'),source.indexOf('function render(')),ctx);
 return {ctx,fields};
}
test('application filter finds joined names, preserves filters, and keeps typo fallback',()=>{
 const {ctx,fields}=app();
 for(const q of ['RedBull','Red Bull','red-bull']) {
  ctx.ACTIVE_SEARCH=q;
  const results=ctx.getFiltered();
  assert.equal(results.length,1);
  assert.equal(results[0].visibleOffers.length,2);
  assert.ok(!results[0].approximate);
 }
 fields.categoria.value='alimentos';
 assert.equal(ctx.getFiltered().length,0);
 fields.categoria.value='';
 ctx.document.querySelectorAll=()=>[{value:'B'}];
 assert.equal(ctx.getFiltered()[0].visibleOffers.length,1);
 ctx.document.querySelectorAll=()=>[{value:'A'}];
 ctx.ACTIVE_SEARCH='chocolat';
 assert.equal(ctx.getFiltered().length,1);
 ctx.ACTIVE_SEARCH='chocolote';
 assert.equal(ctx.getFiltered()[0].approximate,true);
 ctx.ACTIVE_SEARCH='redbull inexistente';
 assert.equal(ctx.getFiltered().length,0);
});

test('price availability respects the selected store and sorts unknown prices last',()=>{
 const {ctx,fields}=app();fields.orden.value='nombre_asc';
 const initial=ctx.getFiltered();assert.match(initial.at(-1).name,/Agua/);
 fields.hideUnavailable.checked=true;
 assert(ctx.getFiltered().every(g=>g.visibleOffers.every(hasPrice)));
 ctx.document.querySelectorAll=()=>[{value:'C'}];
 assert.equal(ctx.getFiltered().length,0);
 fields.hideUnavailable.checked=false;
 assert.equal(ctx.getFiltered().length,1);
});
