(function(){
'use strict';
const DEFAULT={
 branding:{site_name:'RivFree',tagline_es:'Explorá y compará los free shops de Rivera y Santana do Livramento',tagline_pt:'Explore e compare os free shops de Rivera e Santana do Livramento'},
 appearance:{font:'system-modern',density:'comfortable',radius:12,shadow:'soft',light:{background:'#F1ECDE',surface:'#FFFFFF',text:'#1B1B1B',primary:'#123C39',accent:'#F06449',highlight:'#BEEB72',background_image:'',background_overlay:0},dark:{background:'#101716',surface:'#17211F',text:'#F2EFE7',primary:'#194F4A',accent:'#FF8068',highlight:'#C8F47E',background_image:'',background_overlay:0}},
 notice:{enabled:true,dismissible:true,title_es:'Antes de tu visita.',title_pt:'Antes da sua visita.',text_es:'La web refleja catálogos online, no el stock físico completo de cada tienda.',text_pt:'A web reflete catálogos online, não o estoque físico completo de cada loja.'},
 homepage:{order:['hero','benefits','discover','popular','catalog'],visible:{hero:true,benefits:true,discover:true,popular:true,catalog:true}},
 carousel:{visible_count:5,autoplay:true,autoplay_seconds:6},
 seo:{title_es:'RivFree — Comparador de precios de free shops',title_pt:'RivFree — Comparador de preços de free shops',description_es:'Compará precios de free shops de Rivera y Santana do Livramento.',description_pt:'Compare preços de free shops de Rivera e Santana do Livramento.',social_image:'social-card.png'},
 footer:{title_es:'RivFree · Comparador independiente',title_pt:'RivFree · Comparador independente',text_es:'No realizamos ventas ni estamos afiliados a las tiendas. Los precios y la disponibilidad son orientativos y pueden cambiar. Consultá la información actualizada en la publicación oficial de cada tienda.',text_pt:'Não realizamos vendas nem somos afiliados às lojas. Os preços e a disponibilidade são indicativos e podem mudar. Consulte as informações atualizadas na publicação oficial de cada loja.',show_privacy:true}
};
function merge(base,value){
 if(!value||typeof value!=='object'||Array.isArray(value))return typeof structuredClone==='function'?structuredClone(base):JSON.parse(JSON.stringify(base));
 const out={...base};
 for(const [k,v] of Object.entries(value))out[k]=(v&&typeof v==='object'&&!Array.isArray(v)&&base[k]&&typeof base[k]==='object'&&!Array.isArray(base[k]))?merge(base[k],v):v;
 return out;
}
const studioPreview=new URLSearchParams(location.search).has('studio-preview')&&window.parent!==window;
let previewConfigReceived=false;
function lang(){if(studioPreview)return document.documentElement.lang==='es'?'es':'pt';try{return localStorage.getItem('rivfree-language')==='es'?'es':'pt';}catch{return document.documentElement.lang==='es'?'es':'pt';}}
function escCssUrl(value){return String(value||'').replace(/["'\\\n\r()]/g,'');}
function onColor(hex){const c=String(hex||'').replace('#','');if(!/^[0-9a-f]{6}$/i.test(c))return '#ffffff';const rgb=[0,2,4].map(i=>parseInt(c.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722>.179?'#151515':'#ffffff';}
function setMeta(selector,attr,value){const el=document.querySelector(selector);if(el&&value)el.setAttribute(attr,value);}
function apply(config){
 config=merge(DEFAULT,config||{}); window.RIVFREE_SITE_CONFIG=config;
 const a=config.appearance||DEFAULT.appearance, l=a.light||{}, d=a.dark||{};
 const fonts={
  'system-modern':'system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif',
  'rounded':'"Trebuchet MS","Segoe UI",Arial,sans-serif',
  'editorial':'Georgia,"Times New Roman",serif',
  'mono':'ui-monospace,SFMono-Regular,Consolas,"Liberation Mono",monospace'
 };
 let style=document.getElementById('rivfreeStudioTheme');if(!style){style=document.createElement('style');style.id='rivfreeStudioTheme';document.head.append(style);}
 const radius=Math.max(0,Math.min(32,Number.isFinite(Number(a.radius))?Number(a.radius):12));
 const shadow=a.shadow==='none'?'none':a.shadow==='strong'?'0 16px 40px rgba(18,60,57,.18)':'0 10px 30px rgba(18,60,57,.10)';
 const font=fonts[a.font]||fonts['system-modern'];
 const lightImg=l.background_image?`linear-gradient(rgba(255,255,255,${Math.max(0,Math.min(.9,Number(l.background_overlay)||0))}),rgba(255,255,255,${Math.max(0,Math.min(.9,Number(l.background_overlay)||0))})),url("${escCssUrl(l.background_image)}")`:'none';
 const darkImg=d.background_image?`linear-gradient(rgba(0,0,0,${Math.max(0,Math.min(.9,Number(d.background_overlay)||0))}),rgba(0,0,0,${Math.max(0,Math.min(.9,Number(d.background_overlay)||0))})),url("${escCssUrl(d.background_image)}")`:'none';
 style.textContent=`
 :root,:root:not([data-theme="dark"]){--font-sans:${font};--font-display:${font};--paper:${l.background||'#F1ECDE'};--surface:${l.surface||'#fff'};--ink:${l.text||'#1B1B1B'};--teal:${l.primary||'#123C39'};--accent:${l.accent||'#F06449'};--lime:${l.highlight||'#BEEB72'};--studio-radius:${radius}px;--studio-shadow:${shadow};--studio-bg-image:${lightImg};}
 :root[data-theme="dark"]{--paper:${d.background||'#101716'};--surface:${d.surface||'#17211F'};--ink:${d.text||'#F2EFE7'};--teal:${d.primary||'#194F4A'};--accent:${d.accent||'#FF8068'};--lime:${d.highlight||'#C8F47E'};--studio-bg-image:${darkImg};}
 body{background-color:var(--paper)!important;background-image:var(--studio-bg-image)!important;background-size:cover!important;background-position:center!important;background-attachment:fixed!important;}
 .controls-card,.card,.popular-section,.stock-notice-inner,dialog,.directory-store,.campaign-carousel{border-radius:var(--studio-radius)!important;}
 .controls-card,.card,.popular-section{box-shadow:var(--studio-shadow)!important;}
 `;
 style.textContent+=`
 :root{--on-primary:${onColor(l.primary)};--on-accent:${onColor(l.accent)};}
 :root[data-theme="dark"]{--on-primary:${onColor(d.primary)};--on-accent:${onColor(d.accent)};}
 :root,:root:not([data-theme="dark"]),:root[data-theme="dark"]{--rf-red:var(--teal);--rf-red-dark:color-mix(in srgb,var(--teal) 82%,black);--paper-dim:color-mix(in srgb,var(--paper) 90%,var(--ink));--surface-muted:color-mix(in srgb,var(--surface) 95%,var(--ink));--accent-soft:color-mix(in srgb,var(--accent) 14%,var(--surface));--muted:color-mix(in srgb,var(--ink) 70%,var(--surface));--line:color-mix(in srgb,var(--ink) 18%,var(--surface));}
 :root .controls-card,:root .card,:root .popular-section,:root .stock-notice-inner,:root dialog,:root .directory-store,:root .campaign-carousel{border-radius:var(--studio-radius)!important;}
 :root .controls-card,:root .card{background:var(--surface)!important;color:var(--ink);}
 :root .topbar{background:color-mix(in srgb,var(--teal) 40%,#101b2b);border-bottom:3px solid var(--lime);}
 :root .brand-name-free{color:var(--lime);}
 :root .brand p{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;font-size:11px;line-height:1.35;margin:4px 0 0;}
 :root .brand h1{overflow-wrap:anywhere;}
 :root .brand-mark,:root .topbar .search-button{background:var(--accent);color:var(--on-accent);}
 :root .card-action,:root .card-link.card-cta{background:var(--teal)!important;color:var(--on-primary)!important;}
 :root .card-action:hover,:root .card-link.card-cta:hover{background:var(--rf-red-dark)!important;}
 `;
 document.body.dataset.density=['compact','comfortable','airy'].includes(a.density)?a.density:'comfortable';
 const brand=config.branding||{};const name=brand.site_name||'RivFree';
 const h1=document.querySelector('.brand h1');if(h1){const split=/^(.{1,3})(.*)$/.exec(name);h1.replaceChildren(document.createTextNode(split?.[1]||name));if(split?.[2]){const span=document.createElement('span');span.className='brand-name-free';span.textContent=split[2];h1.append(span);}}
 const tagline=document.querySelector('.brand p');if(tagline){tagline.textContent=lang()==='es'?(brand.tagline_es??DEFAULT.branding.tagline_es):(brand.tagline_pt??DEFAULT.branding.tagline_pt);tagline.title=tagline.textContent;}
 const notice=document.getElementById('stockNotice');if(notice){const n=config.notice||{};let dismissed=false;try{dismissed=!location.search.includes('studio-preview')&&sessionStorage.getItem('rivfree-stock-notice-dismissed')==='true';}catch{}notice.hidden=n.enabled===false||dismissed;const strong=notice.querySelector('.stock-notice-text strong');const textNode=notice.querySelector('.stock-notice-text');if(strong)strong.textContent=lang()==='es'?(n.title_es||''):(n.title_pt||'');if(textNode){[...textNode.childNodes].filter(x=>x.nodeType===3).forEach(x=>x.remove());textNode.append(document.createTextNode(' '+(lang()==='es'?(n.text_es||''):(n.text_pt||''))));}const close=notice.querySelector('.stock-notice-close');if(close)close.hidden=n.dismissible===false;}
 const ids={hero:'heroCampaign',benefits:'shoppingBenefits',discover:'discoverProducts',popular:'popularProducts',catalog:'catalogSection'};const main=document.querySelector('main');const hp=config.homepage||{};if(main){for(const key of hp.order||DEFAULT.homepage.order){const el=document.getElementById(ids[key]);if(el)main.append(el);}for(const [key,id] of Object.entries(ids)){const el=document.getElementById(id);if(el)el.hidden=!!(hp.visible&&hp.visible[key]===false);}const discoverLink=document.querySelector('a[href="#discoverProducts"]');if(discoverLink)discoverLink.hidden=hp.visible?.discover===false;const popularLink=document.querySelector('a[href="#popularProducts"]');if(popularLink)popularLink.hidden=hp.visible?.popular===false;}
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
  if(['es','pt-BR'].includes(event.data.language))window.setRivFreePreviewLanguage?.(event.data.language);
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
