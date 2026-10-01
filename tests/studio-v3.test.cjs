const test=require('node:test'),assert=require('node:assert/strict');
const M=require('../explore-model.js'),F=require('../tools/manual_editor/catalog-fields.js');
const {prepareCatalog}=require('../catalog.js');
const group=(key,name,categoryId,marca)=>({key,name,offers:[{nombre:name,categoryId,marca}]});
test('related products enforce categories before brand and prefer Apple devices',()=>{
 const phone=group('phone','Apple iPhone 16','electronica');
 const drink=group('drink','Jim Beam Apple','bebidas','Apple');
 const perfume=group('perfume','Apple Blossom EDP','perfumes');
 const mac=group('mac','Apple MacBook','informatica');
 const samsung=group('samsung','Samsung Galaxy','electronica');
 assert.deepEqual(M.related(phone,[drink,perfume,samsung,mac,phone]).map(g=>g.key),['mac','samsung']);
 assert.deepEqual(M.related(perfume,[phone,drink,perfume]),[]);
 assert.equal(M.taxonomy.find(f=>f.id==='apple').match(drink.offers[0]),false);
});
test('unknown and mixed incompatible categories are excluded from related products',()=>{
 const phone=group('p','iPhone','electronica');const mixed=group('mixed','Apple','electronica');mixed.offers.push({categoryId:'bebidas'});
 assert.deepEqual(M.related(phone,[mixed,group('unknown','Apple','otros')]),[]);
});
test('canonical categories including hogar survive Studio and catalog preparation',()=>{
 const {products}=prepareCatalog({productos:[{nombre:'Mesa',tienda:'Local',categoria:'hogar',precio_usd:3}]});assert.equal(products[0].categoryId,'hogar');
});
test('Excel-exported CSV handles BOM, semicolon, decimal commas and quoted multiline specs',()=>{
 const p=F.csv('\uFEFFtienda;nombre;precio_usd;especificaciones\r\nTienda;Teléfono;"12,50";"Pantalla: 6 pulgadas\nMemoria: 256 GB"')[0];
 assert.equal(p.precio_usd,12.5);assert.equal(p.especificaciones.Memoria,'256 GB');
 assert.throws(()=>F.csv('tienda,nombre\nTienda,'),/Fila 2/);
 assert.throws(()=>F.csv('tienda,nombre,precio_usd\nTienda,Teléfono,no'),/precio inválido/);
});
test('CSV does not silently discard invalid rows or accept unbalanced quotes',()=>{
 assert.throws(()=>F.csv('tienda,nombre\nLocal,"Teléfono'),/comillas/);
 assert.throws(()=>F.csv('tienda,nombre\nLocal,Teléfono,extra'),/columnas/);
 assert.deepEqual(F.spans('09:00-12:00, 13:00-18:00'),[['09:00','12:00'],['13:00','18:00']]);
 assert.throws(()=>F.spans('25:00-26:00'),/Horario/);
});
