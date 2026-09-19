const {test}=require('node:test');const assert=require('node:assert/strict');
const {prepareCatalog}=require('../catalog.js');
const mk=(tienda,nombre,precio_usd=10,categoria='bebidas')=>({tienda,nombre,precio_usd,categoria,url:`https://${tienda}.example/${encodeURIComponent(nombre)}`});
const groupsOf=list=>prepareCatalog({productos:list}).groups;
const together=(a,b)=>groupsOf([a,b]).length===1;

test('Red Bull: mismo producto con nombres distintos en 6 tiendas → una sola tarjeta',()=>{
  const list=[
    mk('Yury','ENERGIZANTE RED BULL 250ML',1.15),
    mk('Sineriz','Energético Red Bull',1.2),
    mk('DFA','RED BULL LATA 0.25 LT.',1.25),
    mk('Neutral','RED BULL  ENERGIZANTE LATA 250 ML',1.25),
    mk('Barao','Energético Red Bull - 250 ml',1.35),
    mk('Mantra','Energético Red Bull tradicional 250ml',1.35),
  ];
  const g=groupsOf(list);
  assert.equal(g.length,1);assert.equal(g[0].storeCount,6);assert.equal(g[0].offers[0].precio_usd,1.15);
});
test('Red Bull: las variantes (Tropical, Sin azúcar) NO se mezclan con el clásico',()=>{
  const list=[mk('A','Energético Red Bull 250ml'),mk('B','Energético Red Bull Tropical 250ml'),mk('C','ENERGIZANTE - Red Bull S/Azucar 250ml'),mk('D','RED BULL TROPICAL EDITION 250ML')];
  const g=groupsOf(list).sort((x,y)=>y.offers.length-x.offers.length);
  assert.equal(g.length,3);assert.equal(g[0].offers.length,2); // Tropical + Tropical Edition
});
test('unidades, idiomas, apóstrofes y typos se normalizan',()=>{
  assert.ok(together(mk('A','Gim Hendrick´s 1Lt'),mk('B','GIN HENDRICKS 1000ML')));
  assert.ok(together(mk('A','Whisky Jack Daniel\'s 1,75 LT'),mk('B','JACK DANIELS 1750ML')));
  assert.ok(together(mk('A','J. WALKER BLUE LABEL 750ML'),mk('B','Johnnie Walker Blue 0,75 LT')));
  assert.ok(together(mk('A','Cerveja Heineken garrafa 330ml'),mk('B','HEINEKEN CERVEZA BOTELLA 330 ML')));
});
test('tamaños distintos NO se agrupan',()=>{
  assert.ok(!together(mk('A','Whisky Ballantines 750ml'),mk('B','WHISKY BALLANTINES 1L')));
  assert.ok(!together(mk('A','Acqua Example EDP 100ml',50,'perfumes'),mk('B','Acqua Example EDP 50ml',30,'perfumes')));
});
test('variantes distintas NO se agrupan (concentración, año, edad, número, pack)',()=>{
  assert.ok(!together(mk('A','Acqua Example EDP 100ml',50,'perfumes'),mk('B','Acqua Example EDT 100ml',50,'perfumes')));
  assert.ok(!together(mk('A','Vino Seña 2009 750ml'),mk('B','Vino Seña 2010 750ml')));
  assert.ok(!together(mk('A','Whisky Glenfiddich 12 anos 750ml'),mk('B','Whisky Glenfiddich 18 anos 750ml')));
  assert.ok(!together(mk('A','Moschino Toy Boy EDP 100ml',50,'perfumes'),mk('B','Moschino Toy 2 EDP 100ml',50,'perfumes')));
  assert.ok(!together(mk('A','Alfajor Portezuelo 6 unidades'),mk('B','Alfajor Portezuelo 12 unidades')));
});
test('un atributo faltante es comodín solo si no hay ambigüedad',()=>{
  // única variante compatible → se une
  assert.ok(together(mk('A','Vodka Finlandia 1 litro'),mk('B','Vodka Finlandia 1L')));
  // dos tamaños posibles → no adivina
  const g=groupsOf([mk('A','Vodka Finlandia'),mk('B','Vodka Finlandia 1L'),mk('C','Vodka Finlandia 750ml')]);
  assert.equal(g.length,3);
});
test('comodín de medida con precio incoherente no se une (mini vs botella)',()=>{
  assert.ok(!together(mk('A','Whisky Ballantines 50ML',2.2),mk('B','Whisky Ballantines',11)));
});
test('perfume sin tamaño no se une a uno con tamaño',()=>{
  assert.ok(!together(mk('A','DIOR Miss Dior EDT',45,'perfumes'),mk('B','PERFUME MISS DIOR EDT SPRAY 100ML',140,'perfumes')));
});
test('un código SKU que solo aparece en una tienda no impide unir',()=>{
  assert.ok(together(mk('A','WET N WILD LIP OIL HEART RATE',9,'cosmetica'),mk('B','LIP OIL WET N WILD “HEART RATE” – 1116754',9,'cosmetica')));
});
test('nunca hay dos ofertas de la misma tienda en un grupo',()=>{
  const a=mk('Barao','Energético Red Bull 250ml');const b={...a,url:'https://barao.example/otra'};
  const g=groupsOf([a,b,mk('DFA','RED BULL LATA 0.25 LT.')]);
  for(const x of g)assert.equal(new Set(x.offers.map(o=>o.tienda)).size,x.offers.length);
});
test('productos con muy poca información no se agrupan entre tiendas',()=>{
  assert.ok(!together(mk('A','Vaso para flores',5,'hogar'),mk('B','Vaso para flores',9,'hogar')));
});
test('categorías URL-encoded (Mantra) se clasifican bien',()=>{
  const {Catalog}=require('../catalog.js');
  assert.equal(Catalog.category('Energ%C3%A9ticos','Energético Red Bull'),'bebidas');
});
test('legacyKeys permite migrar favoritos guardados con claves viejas',()=>{
  const {Catalog}=require('../catalog.js');
  const p=mk('A','Acqua Example EDP 100ml Hombre',50,'perfumes');
  const r=prepareCatalog({productos:[p,mk('B','Perfume Acqua Example Eau de Parfum 0,1 L Masculino',48,'perfumes')]});
  assert.equal(r.legacyKeys[Catalog.identity(r.products[0])],r.groups[0].key);
});
