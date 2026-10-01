/* Optional trackers are never requested until the visitor explicitly accepts. */
(() => {
 'use strict';
 const config=window.RIVFREE_TRACKING||{},base=new URL('.',document.currentScript.src);
 const key='rivfree-cookie-choice-v4',version=config.consentVersion||1;
 const ga=/^G-[A-Z0-9]+$/.test(config.ga4Id||'')?config.ga4Id:'',clarity=/^[a-z0-9]+$/i.test(config.clarityId||'')?config.clarityId:'';
 const cf=/^[a-f0-9]{32}$/i.test(config.cloudflareToken||'')?config.cloudflareToken:'';
 const providers=[ga,clarity,cf].join('|');
 const preview=new URLSearchParams(location.search).has('studio-preview')||location.pathname.includes('/tools/manual_editor/');
 if(preview)return;
 const noTracking=['localhost','127.0.0.1','[::1]','::1'].includes(location.hostname)||document.documentElement.hasAttribute('data-no-tracking');
 let started=false,banner,nav;
 function read(raw){try{const v=JSON.parse(raw);return v.version===version&&v.providers===providers&&v.expires>Date.now()&&['accepted','rejected'].includes(v.choice)?v.choice:null;}catch{return null;}}
 let decision;try{decision=read(localStorage.getItem(key));}catch{decision=null;}
 function script(src,attrs={}){const s=document.createElement('script');s.async=true;s.src=src;for(const [k,v]of Object.entries(attrs))s.setAttribute(k,v);document.head.append(s);}
 function pageview(){if(started&&decision==='accepted'&&ga)window.gtag('event','page_view',{page_location:location.origin+location.pathname+location.hash,page_title:document.title,send_to:ga});}
 function start(){
  if(started||decision!=='accepted'||noTracking)return;started=true;
  if(ga){window['ga-disable-'+ga]=false;window.dataLayer=window.dataLayer||[];window.gtag=function(){window.dataLayer.push(arguments);};
   window.gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
   window.gtag('consent','update',{analytics_storage:'granted'});window.gtag('js',new Date());
   window.gtag('config',ga,{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false});
   script('https://www.googletagmanager.com/gtag/js?id='+ga);setTimeout(pageview,0);
  }
  if(clarity){window.clarity=window.clarity||function(){(window.clarity.q=window.clarity.q||[]).push(arguments);};window.clarity('consentv2',{analytics_Storage:'granted',ad_Storage:'denied'});script('https://www.clarity.ms/tag/'+clarity);}
  if(cf)script('https://static.cloudflareinsights.com/beacon.min.js',{'data-cf-beacon':JSON.stringify({token:cf})});
 }
 function clearCookies(){
  const names=document.cookie.split(';').map(v=>v.split('=')[0].trim()).filter(n=>/^(_ga(?:_|$)|_gid$|_gat|_clck$|_clsk$)/.test(n));
  const pieces=location.hostname.split('.'),domains=[''];for(let i=0;i<pieces.length;i++)domains.push(pieces.slice(i).join('.'),'.'+pieces.slice(i).join('.'));
  const paths=new Set(['/']);let path='';for(const part of location.pathname.split('/').filter(Boolean)){path+='/'+part;paths.add(path);paths.add(path+'/');}
  for(const name of names)for(const domain of domains)for(const path of paths)document.cookie=name+'=; Max-Age=0; path='+path+(domain?'; domain='+domain:'')+'; SameSite=Lax';
 }
 function stop(){if(ga)window['ga-disable-'+ga]=true;window.gtag?.('consent','update',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});window.clarity?.('consentv2',{analytics_Storage:'denied',ad_Storage:'denied'});clearCookies();if(started)location.reload();}
 function choose(choice){decision=choice;try{localStorage.setItem(key,JSON.stringify({choice,version,providers,expires:Date.now()+Math.min(365,Math.max(1,config.consentDays||180))*86400000}));}catch{}banner.hidden=true;if(choice==='accepted')start();else stop();window.dispatchEvent(new Event('rivfree-consent-change'));}
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
 const isEs=()=> (document.getElementById('languageToggle')?.value||document.documentElement.lang).startsWith('es');
 function legalLinks(parent){for(const [file,es,pt]of [['privacy.html','Privacidad','Privacidade'],['cookies.html','Cookies','Cookies'],['terms.html','Términos de uso','Termos de uso']]){const a=node('a',isEs()?es:pt);a.href=new URL(file,base).href;parent.append(a);}}
 function render(){
  banner.replaceChildren();const copy=node('div',null,'rf-cookie-copy');copy.append(node('strong',isEs()?'Tu privacidad en RivFree':'Sua privacidade no RivFree'),node('p',isEs()?'Guardamos tus preferencias e historial en este dispositivo. Con tu permiso, usamos cookies de análisis para mejorar RivFree. Podés aceptar o rechazar.':'Salvamos suas preferências e histórico neste dispositivo. Com sua permissão, usamos cookies de análise para melhorar o RivFree. Você pode aceitar ou recusar.'));
  const links=node('div',null,'rf-legal-links');legalLinks(links);copy.append(links);const actions=node('div',null,'rf-cookie-actions');
  for(const [choice,es,pt]of [['rejected','Rechazar','Recusar'],['accepted','Aceptar análisis','Aceitar análise']]){const b=node('button',isEs()?es:pt,choice==='accepted'?'primary':'');b.type='button';b.onclick=()=>choose(choice);actions.append(b);}
  banner.append(copy,actions);nav.replaceChildren();legalLinks(nav);const settings=node('button',isEs()?'Preferencias de cookies':'Preferências de cookies','rf-cookie-settings');settings.type='button';settings.onclick=()=>{banner.hidden=false;};nav.append(settings);
 }
 function init(){banner=node('aside',null,'rf-cookie-banner');banner.id='cookieBanner';banner.setAttribute('aria-label','Cookies');banner.hidden=decision!==null;nav=node('nav',null,'rf-legal-links');nav.setAttribute('aria-label','Legal');(document.querySelector('footer')||document.body).append(nav);document.body.append(banner);render();document.getElementById('languageToggle')?.addEventListener('change',render);if(typeof MutationObserver!=='undefined')new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});if(decision==='accepted')start();else clearCookies();}
 window.addEventListener('hashchange',()=>setTimeout(pageview,0));
 window.addEventListener('storage',e=>{if(e.key!==key&&e.key!==null)return;decision=e.key===null?null:read(e.newValue);if(banner)banner.hidden=decision!==null;if(decision==='accepted')start();else stop();});
 window.RivFreeConsent={allowed:()=>decision==='accepted',open:()=>{if(banner)banner.hidden=false;}};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
