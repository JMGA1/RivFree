const test=require('node:test');
const assert=require('node:assert/strict');
const {fingerprint,encodeCompact,decodeCompact,decodeLegacy}=require('../shared-list-codec.js');

test('compact shared-list fingerprints are deterministic and URL-safe',()=>{
 const value='g:perfumes|dior sauvage edp 100ml';
 assert.equal(fingerprint(value),fingerprint(value));
 assert.match(fingerprint(value),/^[0-9a-z]+$/);
 assert.notEqual(fingerprint(value),fingerprint(value+'x'));
});

test('compact shared-list format round-trips quantities and stays much shorter than legacy JSON',()=>{
 const items=Array.from({length:12},(_,i)=>[`g:perfumes|produto exemplo ${i}|DFA|https://example.com/catalogo/produto/${i}?ref=instagram`,i%3===0?2:1]);
 const fragment=encodeCompact(items);
 const decoded=decodeCompact('#'+fragment);
 assert.equal(decoded.size,12);
 assert.deepEqual([...decoded.values()],[2,1,1,2,1,1,2,1,1,2,1,1]);
 const legacy='#list='+encodeURIComponent(JSON.stringify({v:1,items:items.map(([key,qty])=>[key,qty])}));
 assert.ok(fragment.length<legacy.length/2,`compact=${fragment.length}, legacy=${legacy.length}`);
});

test('legacy shared-list links remain importable',()=>{
 const source=new Map([['old-key',3],['offer:["DFA","https://example.com/p"]',1]]);
 const hash='#list='+encodeURIComponent(JSON.stringify({v:1,items:[...source]}));
 assert.deepEqual([...decodeLegacy(hash)], [...source]);
});

test('compact decoder rejects malformed or duplicated entries',()=>{
 assert.throws(()=>decodeCompact('#l=abc~abc'));
 assert.throws(()=>decodeCompact('#l=abc.0'));
 assert.throws(()=>decodeCompact('#l=abc.1000'));
});
