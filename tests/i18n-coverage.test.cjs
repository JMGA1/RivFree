const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

function read(file){return fs.readFileSync(path.join(__dirname,'..',file),'utf8');}
function translationsFromApp(){
 const src=read('app.js');
 const match=src.match(/const translations\s*=\s*(\{[\s\S]*?\n\});\s*function tr\(/);
 assert.ok(match,'No se pudo localizar translations en app.js');
 return vm.runInNewContext('('+match[1]+')');
}
function directTrStrings(src){
 const values=[];
 for(const match of src.matchAll(/\btr\(\s*(['"])((?:\\.|(?!\1).)*)\1\s*\)/g)){
  const quote=match[1];
  values.push(vm.runInNewContext(quote+match[2]+quote));
 }
 return values;
}

test('every direct tr literal has an explicit Portuguese translation',()=>{
 const translations=translationsFromApp();
 const files=['app.js','shopping.js','product-details.js','storefront.js','features.js'];
 const used=new Set(files.flatMap(file=>directTrStrings(read(file))));
 const missing=[...used].filter(value=>!Object.prototype.hasOwnProperty.call(translations,value)).sort();
 assert.deepEqual(missing,[],`Faltan traducciones PT explícitas: ${missing.join(', ')}`);
});
