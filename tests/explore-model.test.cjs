const {test}=require('node:test'),assert=require('node:assert/strict');
const M=require('../explore-model.js');
test('history deduplicates accent/case, preserves recency and caps entries',()=>{
 let entries=M.history([], ' Café ',1);entries=M.history(entries,'CAFE',2);
 assert.equal(entries.length,1);assert.equal(entries[0].query,'CAFE');
 for(let i=3;i<30;i++)entries=M.history(entries,'query '+i,i);
 assert.equal(entries.length,20);assert.equal(entries[0].query,'query 29');
 assert.deepEqual(M.history([{query:'',last:1},{query:4,last:2},null]),[]);
 assert.equal(M.history([], 'x'.repeat(500),1)[0].query.length,120);
});
test('WhatsApp only accepts explicit store contacts on trusted hosts',()=>{
 assert.equal(M.whatsapp({telefono:'+59895302277'}),null);
 assert.equal(M.whatsapp({redes:{whatsapp:'javascript:alert(1)'}}),null);
 assert.equal(M.whatsapp({redes:{whatsapp:'https://wa.me.evil.test/123456789'}}),null);
 assert.equal(M.whatsapp({redes:{whatsapp:'https://wa.me/555591261678'}}).hostname,'wa.me');
});
test('phone facets separate accessories and use exact brand/capacity matches',()=>{
 const phone=M.taxonomy.find(x=>x.id==='phones');
 assert(phone.match({nombre:'Apple iPhone 16 Pro 256GB'}));
 assert(!phone.match({nombre:'Capa iPhone 16 Pro'}));
 assert(!phone.match({nombre:'Apple MacBook 256GB'}));
 assert(phone.types.find(x=>x.label==='256 GB').match({nombre:'iPhone 16 256GB'}));
 assert(phone.types.find(x=>x.label==='256 GB').match({nombre:'iPhone 16 256 GB'}));
 assert(!phone.types.find(x=>x.label==='256 GB').match({nombre:'iPhone 16 128GB'}));
});
test('brand facets are constrained to parent families and all facet IDs are unique',()=>{
 const perfume=M.taxonomy.find(x=>x.id==='perfumes');
 const dior=perfume.brands.find(x=>x.label==='Dior');
 assert(dior.match({nombre:'Dior Sauvage 100ml',categoryId:'perfumes'}));
 assert(!dior.match({nombre:'Dior crema',categoryId:'cosmetica'}));
 const ids=M.taxonomy.flatMap(f=>[f,...f.brands,...f.types]).map(f=>f.id);
 assert.equal(ids.length,new Set(ids).size);
});
test('word boundaries and spaces in device/brand facet patterns remain regular expressions',()=>{
 const tv=M.taxonomy.find(x=>x.id==='tech').types.find(x=>x.label==='TV y Smart TV');
 assert(tv.match({nombre:'Samsung TV Smart 50',categoryId:'electronica'}));
 assert(!tv.match({nombre:'JBL speaker',categoryId:'electronica'}));
 const hp=M.taxonomy.find(x=>x.id==='computers').brands.find(x=>x.label==='HP');
 assert(hp.match({nombre:'Notebook HP 15',categoryId:'informatica'}));
 const edp=M.taxonomy.find(x=>x.id==='perfumes').types.find(x=>x.label==='Eau de parfum');
 assert(edp.match({nombre:'Dior Sauvage EDP 100ml',categoryId:'perfumes'}));
});
