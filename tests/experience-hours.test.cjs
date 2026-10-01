const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync(require('node:path').join(__dirname,'../experience.js'),'utf8');
const start=code.indexOf(' function status('),end=code.indexOf(' window.RivFreeHours=status;');
const status=vm.runInNewContext(code.slice(start,end)+';status',{Intl,Date,txt:es=>es});
const info={timezone:'America/Montevideo',weekly_hours:{3:[['09:00','12:00'],['14:00','18:00']]}};
test('opening hours use shop timezone and exact open/close boundaries',()=>{
 assert.equal(status(info,new Date('2026-09-30T11:59:00Z')).open,false);
 assert.equal(status(info,new Date('2026-09-30T12:00:00Z')).open,true);
 assert.equal(status(info,new Date('2026-09-30T15:00:00Z')).open,false);
 assert.equal(status(info,new Date('2026-09-30T17:00:00Z')).open,true);
 assert.equal(status(info,new Date('2026-09-30T21:00:00Z')).open,false);
});
test('missing schedule never claims open; holiday exception overrides weekly schedule',()=>{
 assert.equal(status({}).open,false);
 assert.equal(status({...info,hours_exceptions:{'2026-09-30':[]}},new Date('2026-09-30T12:00:00Z')).open,false);
});
