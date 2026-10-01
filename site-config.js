(function(){
'use strict';
const DEFAULT={
 branding:{site_name:'RivFree',tagline_es:'Explorá y compará los free shops de Rivera y Santana do Livramento',tagline_pt:'Explore e compare os free shops de Rivera e Santana do Livramento'},
 appearance:{font:'system-modern',density:'comfortable',radius:12,shadow:'soft',colors_customized:false,light:{background:'#F5F6F8',surface:'#FFFFFF',text:'#172337',primary:'#AD233C',accent:'#E94E67',highlight:'#FFB5B9',background_image:'',background_overlay:0},dark:{background:'#101B2B',surface:'#19283C',text:'#F1F5FB',primary:'#AD233C',accent:'#E94E67',highlight:'#FFB5B9',background_image:'',background_overlay:0}},
 notice:{enabled:true,dismissible:true,title_es:'Antes de tu visita.',title_pt:'Antes da sua visita.',text_es:'La web refleja catálogos online, no el stock físico completo de cada tienda.',text_pt:'A web reflete catálogos online, não o estoque físico completo de cada loja.'},
 homepage:{order:['hero','benefits','discover','popular','recommended','most'],visible:{hero:true,benefits:true,discover:true,popular:true,recommended:true,most:true}},
 carousel:{visible_count:5,autoplay:true,autoplay_seconds:6,transition:'smooth',transition_ms:500},
 seo:{title_es:'RivFree — Comparador de precios de free shops',title_pt:'RivFree — Comparador de preços de free shops',description_es:'Compará precios de free shops de Rivera y Santana do Livramento.',description_pt:'Compare preços de free shops de Rivera e Santana do Livramento.',social_image:'social-card.png'},
 top_notice:{enabled:true,title_es:'RivFree es un comparador de precios.',title_pt:'O RivFree é um comparador de preços.',text_es:'No vendemos productos ni estamos afiliados a las tiendas: cada compra se hace directamente con el free shop.',text_pt:'Não vendemos produtos nem somos afiliados às lojas: cada compra é feita diretamente com o free shop.',short_es:'Solo comparamos precios: no vendemos ni estamos afiliados a las tiendas.',short_pt:'Só comparamos preços: não vendemos nem somos afiliados às lojas.'},
 social:{show_without_link:true,instagram:{url:'',visible:true},facebook:{url:'',visible:true},tiktok:{url:'',visible:true},whatsapp:{url:'',visible:true},youtube:{url:'',visible:false},x:{url:'',visible:false},telegram:{url:'',visible:false}},
 nav:{stores:true,offers:true,exchange:true,list:true},
 offers:{tiers:[20,40,60]},
 footer:{title_es:'RivFree · Comparador independiente',title_pt:'RivFree · Comparador independente',text_es:'No realizamos ventas ni estamos afiliados a las tiendas. Los precios y la disponibilidad son orientativos y pueden cambiar. Consultá la información actualizada en la publicación oficial de cada tienda.',text_pt:'Não realizamos vendas nem somos afiliados às lojas. Os preços e a disponibilidade são indicativos e podem mudar. Consulte as informações atualizadas na publicação oficial de cada loja.',show_privacy:true}
};
function merge(base,value){
 if(!value||typeof value!=='object'||Array.isArray(value))return typeof structuredClone==='function'?structuredClone(base):JSON.parse(JSON.stringify(base));
 const out={...base};
 for(const [k,v] of Object.entries(value)){if(!Object.hasOwn(base,k)||['__proto__','constructor','prototype'].includes(k))continue;if(v===null||typeof v!==typeof base[k]||Array.isArray(v)!==Array.isArray(base[k]))continue;out[k]=(v&&typeof v==='object'&&!Array.isArray(v)&&base[k]&&typeof base[k]==='object'&&!Array.isArray(base[k]))?merge(base[k],v):v;}
 return out;
}
const studioPreview=new URLSearchParams(location.search).has('studio-preview')&&window.parent!==window;
let previewConfigReceived=false;
function lang(){const pageLanguage=document.documentElement.dataset.seoHome;if(!studioPreview&&['es','pt-BR'].includes(pageLanguage))return pageLanguage==='es'?'es':'pt';if(studioPreview)return document.documentElement.lang==='es'?'es':'pt';try{return localStorage.getItem('rivfree-language')==='es'?'es':'pt';}catch{return document.documentElement.lang==='es'?'es':'pt';}}
function escCssUrl(value){
 try{
  const url=new URL(String(value||''),location.href);
  if(url.username||url.password||(url.protocol!=='https:'&&url.origin!==location.origin))return '';
  if(!['https:','http:'].includes(url.protocol))return '';
  return url.href.replace(/[\u0000-\u0020"'\\()<>{}]/g,c=>'%'+c.charCodeAt(0).toString(16).padStart(2,'0'));
 }catch{return '';}
}
function hex(value,fallback){return /^#[0-9a-f]{6}$/i.test(String(value))?value:fallback;}
function onColor(hex){const c=String(hex||'').replace('#','');if(!/^[0-9a-f]{6}$/i.test(c))return '#ffffff';const rgb=[0,2,4].map(i=>parseInt(c.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722>.179?'#000000':'#ffffff';}
function setMeta(selector,attr,value){const el=document.querySelector(selector);if(el&&value)el.setAttribute(attr,value);}
function apply(config){
 config=merge(DEFAULT,config||{}); window.RIVFREE_SITE_CONFIG=config;
 const a=config.appearance||DEFAULT.appearance, l=a.light||{}, d=a.dark||{};
 const fonts={
  'system-modern':'system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif',
  'inter-ui':'Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif',
  'geometric':'Avenir Next,Avenir,Montserrat,"Segoe UI",Arial,sans-serif',
  'humanist':'"Segoe UI",Candara,Calibri,Optima,Arial,sans-serif',
  'rounded':'"Trebuchet MS","Arial Rounded MT Bold","Segoe UI",Arial,sans-serif',
  'compact':'Arial Narrow,"Roboto Condensed","Segoe UI",Arial,sans-serif',
  'classic-ui':'Tahoma,Verdana,"Segoe UI",Arial,sans-serif',
  'editorial':'Georgia,"Times New Roman",serif',
  'slab':'Rockwell,"Roboto Slab",Georgia,serif',
  'mono':'ui-monospace,SFMono-Regular,Consolas,"Liberation Mono",monospace'
 };
 let style=document.getElementById('rivfreeStudioTheme');if(!style){style=document.createElement('style');style.id='rivfreeStudioTheme';document.head.append(style);}
 const radius=Math.max(0,Math.min(32,Number.isFinite(Number(a.radius))?Number(a.radius):12));
 const shadow=a.shadow==='none'?'none':a.shadow==='strong'?'0 16px 40px rgba(18,60,57,.18)':'0 10px 30px rgba(18,60,57,.10)';
 const font=fonts[a.font]||fonts['system-modern'];
 const lightImg=l.background_image?`linear-gradient(rgba(255,255,255,${Math.max(0,Math.min(.9,Number(l.background_overlay)||0))}),rgba(255,255,255,${Math.max(0,Math.min(.9,Number(l.background_overlay)||0))})),url("${escCssUrl(l.background_image)}")`:'none';
 const darkImg=d.background_image?`linear-gradient(rgba(0,0,0,${Math.max(0,Math.min(.9,Number(d.background_overlay)||0))}),rgba(0,0,0,${Math.max(0,Math.min(.9,Number(d.background_overlay)||0))})),url("${escCssUrl(d.background_image)}")`:'none';
 const customized=a.colors_customized===true;
 const structural=`
 :root{--font-sans:${font};--font-display:${font};--studio-radius:${radius}px;--studio-shadow:${shadow};--studio-bg-image:${lightImg};}
 :root[data-theme="dark"]{--studio-bg-image:${darkImg};}
 body{background-image:var(--studio-bg-image)!important;background-size:cover!important;background-position:center!important;background-attachment:fixed!important;}
 .controls-card,.card,.popular-section,.stock-notice-inner,dialog,.directory-store,.campaign-carousel{border-radius:var(--studio-radius)!important;}
 .controls-card,.card,.popular-section{box-shadow:var(--studio-shadow)!important;}
 `;
 const colorOverrides=customized?`
 :root,:root:not([data-theme="dark"]){--paper:${hex(l.background,'#F5F6F8')};--surface:${hex(l.surface,'#fff')};--ink:${hex(l.text,'#172337')};--teal:${hex(l.primary,'#AD233C')};--accent:${hex(l.accent,'#E94E67')};--lime:${hex(l.highlight,'#FFB5B9')};--on-primary:${onColor(l.primary)};--on-accent:${onColor(l.accent)};}
 :root[data-theme="dark"]{--paper:${hex(d.background,'#101B2B')};--surface:${hex(d.surface,'#19283C')};--ink:${hex(d.text,'#F1F5FB')};--teal:${hex(d.primary,'#AD233C')};--accent:${hex(d.accent,'#E94E67')};--lime:${hex(d.highlight,'#FFB5B9')};--on-primary:${onColor(d.primary)};--on-accent:${onColor(d.accent)};}
 :root,:root:not([data-theme="dark"]),:root[data-theme="dark"]{--rf-red:var(--teal);--rf-red-dark:color-mix(in srgb,var(--teal) 82%,black);--paper-dim:color-mix(in srgb,var(--paper) 90%,var(--ink));--surface-muted:color-mix(in srgb,var(--surface) 95%,var(--ink));--accent-soft:color-mix(in srgb,var(--accent) 14%,var(--surface));--muted:color-mix(in srgb,var(--ink) 70%,var(--surface));--line:color-mix(in srgb,var(--ink) 18%,var(--surface));}
 :root .controls-card,:root .card{background:var(--surface)!important;color:var(--ink);}
 :root .brand-name-free{color:var(--lime);}
 :root .brand-mark,:root .topbar .search-button{background:var(--accent);color:var(--on-accent);}
 :root .card-action,:root .card-link.card-cta{background:var(--teal)!important;color:var(--on-primary)!important;}
 :root .card-action:hover,:root .card-link.card-cta:hover{background:var(--rf-red-dark)!important;}
 `:'';
 style.textContent=structural+colorOverrides;
 document.body.dataset.density=['compact','comfortable','airy'].includes(a.density)?a.density:'comfortable';
 const brand=config.branding||{};const name=brand.site_name||'RivFree';
 const h1=document.querySelector('.brand h1, .brand .seo-brand-title');if(h1){const split=/^(.{1,3})(.*)$/.exec(name);h1.replaceChildren(document.createTextNode(split?.[1]||name));if(split?.[2]){const span=document.createElement('span');span.className='brand-name-free';span.textContent=split[2];h1.append(span);}}
 const tagline=document.querySelector('.brand p');if(tagline){tagline.textContent=lang()==='es'?(brand.tagline_es??DEFAULT.branding.tagline_es):(brand.tagline_pt??DEFAULT.branding.tagline_pt);tagline.title=tagline.textContent;}
 const notice=document.getElementById('stockNotice');if(notice){const n=config.notice||{};let dismissed=false;try{dismissed=!location.search.includes('studio-preview')&&sessionStorage.getItem('rivfree-stock-notice-dismissed')==='true';}catch{}notice.hidden=n.enabled===false||dismissed;const strong=notice.querySelector('.stock-notice-text strong');const textNode=notice.querySelector('.stock-notice-text');if(strong)strong.textContent=lang()==='es'?(n.title_es||''):(n.title_pt||'');if(textNode){[...textNode.childNodes].filter(x=>x.nodeType===3).forEach(x=>x.remove());textNode.append(document.createTextNode(' '+(lang()==='es'?(n.text_es||''):(n.text_pt||''))));}const close=notice.querySelector('.stock-notice-close');if(close)close.hidden=n.dismissible===false;}
 const ids={hero:'heroCampaign',benefits:'shoppingBenefits',discover:'discoverProducts',popular:'popularProducts',recommended:'basedOnSearches',most:'mostSearched'};const main=document.querySelector('main');const hp=config.homepage||{};if(main){for(const key of [...new Set([...(hp.order||DEFAULT.homepage.order),...DEFAULT.homepage.order])]){const el=document.getElementById(ids[key]);if(el)main.append(el);}for(const [key,id] of Object.entries(ids)){const el=document.getElementById(id);if(el)el.hidden=!!(hp.visible&&hp.visible[key]===false);}const discoverLink=document.querySelector('a[href="#discoverProducts"]');if(discoverLink)discoverLink.hidden=hp.visible?.discover===false;const popularLink=document.querySelector('a[href="#popularProducts"]');if(popularLink)popularLink.hidden=hp.visible?.popular===false;}
 const seo=config.seo||{};const es=lang()==='es';document.title=es?(seo.title_es||DEFAULT.seo.title_es):(seo.title_pt||DEFAULT.seo.title_pt);setMeta('meta[name="description"]','content',es?(seo.description_es||''):(seo.description_pt||''));setMeta('meta[property="og:title"]','content',document.title);setMeta('meta[name="twitter:title"]','content',document.title);setMeta('meta[property="og:description"]','content',es?(seo.description_es||''):(seo.description_pt||''));setMeta('meta[name="twitter:description"]','content',es?(seo.description_es||''):(seo.description_pt||''));if(seo.social_image){try{const absolute=new URL(seo.social_image,location.href).href;setMeta('meta[property="og:image"]','content',absolute);setMeta('meta[name="twitter:image"]','content',absolute);}catch{}}
 const footer=document.querySelector('footer');if(footer){const f=config.footer||{};let strong=footer.querySelector('strong');if(strong)strong.textContent=es?(f.title_es||''):(f.title_pt||'');let text=footer.querySelector('.studio-footer-text');if(!text){text=document.createElement('span');text.className='studio-footer-text';const actions=footer.querySelector('.footer-actions');footer.insertBefore(text,actions||null);}text.textContent=' '+(es?(f.text_es||''):(f.text_pt||''));const privacy=footer.querySelector('.privacy-policy-link');if(privacy)privacy.hidden=f.show_privacy===false;}
 document.dispatchEvent(new CustomEvent('rivfree-site-config-applied',{detail:config}));
}
async function load(){let value={};try{const r=await fetch('data/site-config.json',{cache:'no-store'});if(r.ok)value=await r.json();}catch{}if(!previewConfigReceived)apply(value);return window.RIVFREE_SITE_CONFIG;}
window.applyRivFreeSiteConfig=apply;
window.addEventListener('message',event=>{
 if(!studioPreview||event.origin!==location.origin||event.source!==window.parent)return;
 if(event.data?.type==='rivfree-studio-preview'&&event.data.config){
  previewConfigReceived=true;
  if(['light','dark'].includes(event.data.theme))document.documentElement.dataset.theme=event.data.theme;
  if(['es','pt-BR'].includes(event.data.language)){document.documentElement.lang=event.data.language;window.setRivFreePreviewLanguage?.(event.data.language);}
  apply(event.data.config);
 }
 if(event.data?.type==='rivfree-studio-navigate'){
  const target=event.data.target;
  if(target==='top')window.scrollTo({top:0,behavior:'instant'});
  else (target==='footer'?document.querySelector('footer'):document.getElementById(target))?.scrollIntoView({block:'start',behavior:'instant'});
 }
});
window.RIVFREE_SITE_READY=load();
if(studioPreview)window.RIVFREE_SITE_READY.then(()=>window.parent.postMessage({type:'rivfree-studio-ready'},location.origin));
})();
