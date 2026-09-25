const test=require('node:test');
const assert=require('node:assert/strict');
const {mergeCatalogData,prepareCatalog,safeImageUrl}=require('../catalog.js');

test('manual catalog entries are merged and hidden ones stay out',()=>{
  const base={actualizado:'2026-09-24',resumen:[],productos:[{tienda:'DFA',nombre:'Base Item 100ml',categoria:'perfumes',precio_usd:10,url:'https://example.com/base'}]};
  const manual={actualizado:'2026-09-24',productos:[
    {id:'manual-a',tienda:'Nueva Loja',nombre:'Manual Item 200ml EDP',categoria:'perfumes',precio_usd:20,url:'https://example.com/manual',activo:true},
    {id:'manual-b',tienda:'Nueva Loja',nombre:'Hidden Item',categoria:'otros',precio_usd:2,activo:false},
  ]};
  const merged=mergeCatalogData(base,manual);
  assert.equal(merged.productos.length,2);
  assert.equal(merged.productos[1].manual,true);
  assert.equal(merged.productos[1].nombre,'Manual Item 200ml EDP');
});

test('manual observation wins when it uses the same canonical URL',()=>{
  const merged=mergeCatalogData({productos:[{tienda:'DFA',nombre:'Producto Test 500ml',categoria:'bebidas',precio_usd:19,url:'https://example.com/p?utm_source=x'}]},
    {version:'1',productos:[{id:'manual-x',tienda:'DFA',nombre:'Producto Test 500ml',categoria:'bebidas',precio_usd:17,url:'https://example.com/p',manual:true,fuente_tipo:'instagram'}]});
  const prepared=prepareCatalog(merged);
  assert.equal(prepared.products.length,1);
  assert.equal(prepared.products[0].precio_usd,17);
  assert.equal(prepared.products[0].fuente_tipo,'instagram');
});

test('manual local image paths are allowed without allowing traversal',()=>{
  assert.equal(safeImageUrl('assets/manual/foto-123.webp'),'assets/manual/foto-123.webp');
  assert.equal(safeImageUrl('assets/manual/../secret.webp'),null);
  assert.equal(safeImageUrl('javascript:alert(1)'),null);
  assert.equal(safeImageUrl('https://example.com/image.jpg'),'https://example.com/image.jpg');
});
