// Migration cleanup only; the Cloudflare beacon is included once in each HTML page.
(()=>{
 try {
  for(const key of ['rivfree-analytics-consent-v1','rivfree-analytics-consent-v2']){localStorage.removeItem(key);sessionStorage.removeItem(key);}
  const names=document.cookie.split(';').map(v=>v.split('=')[0].trim()).filter(n=>/^(_ga(?:_|$)|_gid$|_gat)/.test(n));
  const parts=location.hostname.split('.'),domains=[''];
  for(let i=0;i<parts.length;i++)domains.push(parts.slice(i).join('.'),'.'+parts.slice(i).join('.'));
  const paths=new Set(['/']);let path='';for(const part of location.pathname.split('/').filter(Boolean)){path+='/'+part;paths.add(path);paths.add(path+'/');}
  for(const name of names)for(const domain of domains)for(const path of paths)document.cookie=name+'=; Max-Age=0; path='+path+(domain?'; domain='+domain:'')+'; SameSite=Lax';
 }catch{}
})();
