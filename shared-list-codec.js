(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.SharedListCodec=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const OFFSET=0xcbf29ce484222325n;
 const PRIME=0x100000001b3n;
 const MASK=0xffffffffffffffffn;
 function fingerprint(value){
  value=String(value);
  let hash=OFFSET;
  for(let i=0;i<value.length;i++){
   const code=value.charCodeAt(i);
   hash^=BigInt(code&255);hash=(hash*PRIME)&MASK;
   hash^=BigInt(code>>>8);hash=(hash*PRIME)&MASK;
  }
  return hash.toString(36);
 }
 function encodeCompact(items){
  if(!Array.isArray(items)||!items.length)return 'l=';
  return 'l='+items.map(([locator,qty])=>{
   const id=fingerprint(locator),amount=Number(qty);
   return amount===1?id:`${id}.${amount}`;
  }).join('~');
 }
 function decodeCompact(hash){
  if(typeof hash!=='string'||!hash.startsWith('#l='))return null;
  const raw=hash.slice(3);
  if(!raw||raw.length>30000)throw new Error('invalid shared list');
  const incoming=new Map();
  for(const token of raw.split('~')){
   const match=/^([0-9a-z]{1,20})(?:\.([1-9]\d{0,2}))?$/.exec(token);
   if(!match)throw new Error('invalid shared item');
   const id=match[1],qty=match[2]?Number(match[2]):1;
   if(qty>999||incoming.has(id)||incoming.size>=1000)throw new Error('invalid shared item');
   incoming.set(id,qty);
  }
  return incoming;
 }
 function decodeLegacy(hash){
  if(typeof hash!=='string'||!hash.startsWith('#list='))return null;
  if(hash.length>250000)throw new Error('invalid legacy list');
  const payload=JSON.parse(decodeURIComponent(hash.slice(6)));
  if(payload.v!==1||!Array.isArray(payload.items)||!payload.items.length||payload.items.length>1000)throw new Error('invalid legacy list');
  const incoming=new Map();
  for(const entry of payload.items){
   if(!Array.isArray(entry)||entry.length!==2)throw new Error('invalid legacy item');
   const [key,qty]=entry;
   if(typeof key!=='string'||!key||key.length>2000||!Number.isInteger(qty)||qty<1||qty>999||incoming.has(key))throw new Error('invalid legacy item');
   incoming.set(key,qty);
  }
  return incoming;
 }
 return {fingerprint,encodeCompact,decodeCompact,decodeLegacy};
});
