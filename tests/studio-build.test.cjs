const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const read=name=>fs.readFileSync('tools/manual_editor/'+name,'utf8');
test('all editor entry points ship one consistent build',()=>{
 const context={window:{},navigator:{}};vm.runInNewContext(read('bootstrap.js'),context);
 const build=context.window.RIVFREE_STUDIO_HTML_BUILD;
 for(const file of ['editor.js','studio-editor.js','server.py'])assert.ok(read(file).includes(`BUILD = '${build}'`),file);
 for(const file of ['editor.js','studio-editor.js','editor.css','maintenance.js'])assert.ok(read('index.html').includes(`${file}?v=${build}`),file);
});
test('mixed editor versions show a warning without navigating or reloading',()=>{
 const warnings=[];const context={window:{RIVFREE_STUDIO_HTML_BUILD:'old-version',RivFreeEditor:{notify:(...args)=>warnings.push(args)}},location:{replace(){assert.fail('Must not navigate');},reload(){assert.fail('Must not reload');}}};
 vm.runInNewContext(read('studio-editor.js'),context);
 assert.equal(warnings.length,1);assert.equal(warnings[0][1],true);assert.match(warnings[0][0],/versiones distintas/);
});
