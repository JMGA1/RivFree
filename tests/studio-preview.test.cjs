const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const read=file=>fs.readFileSync(file,'utf8');
const copy=value=>JSON.parse(JSON.stringify(value));
const settle=()=>new Promise(resolve=>setTimeout(resolve,130));

async function editor(t,draft=null){
 const dom=new JSDOM(read('tools/manual_editor/index.html'),{url:'http://localhost/tools/manual_editor/?token=test',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,d=w.document,calls=[],messages=[],notifications=[];
 if(draft)w.localStorage.setItem('rivfree-studio-draft-v3',draft);
 let state={mode:'owner',site_config:JSON.parse(read('data/site-config.json')),highlights:JSON.parse(read('data/highlights.json')),products:[],health:{},meta:{},revision:'test'};
 w.HTMLElement.prototype.scrollIntoView=()=>{};
 const E=w.RivFreeEditor={getState:()=>state,setExternalDirty(){},notify:(...args)=>notifications.push(args),clearFieldErrors(){},setFieldError(el,text){el.dataset.error=text;},
  applyState(next){state=next;w.dispatchEvent(new w.CustomEvent('rivfree-editor-state',{detail:next}));},
  async api(path,payload){calls.push({path,payload:copy(payload)});return {...state,...(path.endsWith('save-site-config')?{site_config:copy(payload.config)}:{highlights:{hero:copy(payload.hero)}})};}
 };
 w.eval(read('tools/manual_editor/studio-editor.js'));
 d.getElementById('studioPreview').contentWindow.postMessage=data=>messages.push(copy(data));
 w.dispatchEvent(new w.CustomEvent('rivfree-editor-state',{detail:state}));
 const input=(id,value)=>{const el=d.getElementById(id);if(el.type==='checkbox')el.checked=value;else el.value=value;el.dispatchEvent(new w.Event('input',{bubbles:true}));};
 const tab=name=>{d.querySelectorAll('.tab').forEach(el=>el.classList.toggle('active',el.dataset.tab===name));w.dispatchEvent(new w.CustomEvent('rivfree-tab-change',{detail:{tab:name}}));};
 t.after(()=>w.close());await settle();
 return {w,d,E,calls,messages,notifications,input,tab};
}

test('preset selection, custom palette, preview mode and zero radius stay synchronized',async t=>{
 const {d,input,messages,tab}=await editor(t);tab('appearance');
 d.querySelector('[data-preset="clean"]').click();
 assert.equal(d.querySelector('[data-preset="clean"]').getAttribute('aria-pressed'),'true');
 input('darkBackground','#223344');input('siteRadius','0');await settle();
 let message=messages.filter(x=>x.type==='rivfree-studio-preview').at(-1);
 assert.equal(message.theme,'light');assert.equal(message.config.appearance.dark.background,'#223344');assert.equal(message.config.appearance.radius,0);
 const mode=d.getElementById('appearanceEditTheme');mode.value='dark';mode.dispatchEvent(new d.defaultView.Event('change',{bubbles:true}));await settle();
 message=messages.filter(x=>x.type==='rivfree-studio-preview').at(-1);assert.equal(message.theme,'dark');
 assert.equal(d.querySelector('[data-preset="clean"]').getAttribute('aria-pressed'),'false');
 assert.match(d.getElementById('appearanceFeedback').textContent,/falta guardar/);
});

test('campaign typing previews immediately and direct Save includes the current form',async t=>{
 const {w,d,calls,input,messages,tab}=await editor(t);tab('carousel');
 const originalImages=JSON.parse(read('data/highlights.json')).hero[0].images;
 input('campaignTitleEs','Cambio sin aplicar');input('campaignTheme','mint');input('campaignEnabled',false);await settle();
 const preview=messages.filter(x=>x.type==='rivfree-studio-campaigns-preview').at(-1);
 const edited=preview.hero.find(x=>x.id===preview.selectedId);
 assert.equal(edited.title.es,'Cambio sin aplicar');assert.equal(edited.theme,'mint');assert.equal(edited.enabled,false);
 if(originalImages)assert.deepEqual(edited.images,originalImages);
 await w.RivFreeStudio.saveActive('carousel');
 assert.equal(calls.find(x=>x.path.endsWith('save-highlights')).payload.hero[0].title.es,'Cambio sin aplicar');
 assert.match(d.getElementById('carouselFeedback').textContent,/guardada/);
});

test('new campaigns keep a stable identity and editing another banner preserves them',async t=>{
 const {w,d,calls,input}=await editor(t);
 const count=d.querySelectorAll('.campaign-list-item').length;
 d.getElementById('newCampaign').click();input('campaignTitleEs','Nuevo');const id=d.getElementById('campaignId').value;
 input('campaignDescriptionEs','Descripción');assert.equal(d.getElementById('campaignId').value,id);
 assert.equal(d.querySelectorAll('.campaign-list-item').length,count+1);
 d.querySelector('.campaign-list-main').click();await w.RivFreeStudio.saveActive('carousel');
 const saved=calls.find(x=>x.path.endsWith('save-highlights')).payload.hero.find(x=>x.id===id);
 assert.equal(saved.description.es,'Descripción');
});

test('full-image layout uses the current local campaign image',async t=>{
 const {w,d,input,calls}=await editor(t);const image=d.getElementById('campaignImage').value;
 input('campaignLayout','banner');await w.RivFreeStudio.saveActive('carousel');
 const saved=calls.find(x=>x.path.endsWith('save-highlights')).payload.hero[0];
 assert.equal(saved.layout,'banner');assert.equal(saved.image,image);assert.equal(saved.images,undefined);
});

test('saving Design leaves Page edits pending and out of the saved payload',async t=>{
 const {w,d,input,calls}=await editor(t);
 input('noticeTitleEs','Página pendiente');input('siteName','Marca guardada');await w.RivFreeStudio.saveActive('appearance');
 const saved=calls.at(-1).payload.config;
 assert.equal(saved.branding.site_name,'Marca guardada');assert.notEqual(saved.notice.title_es,'Página pendiente');
 assert.equal(d.querySelector('[data-dirty-for="page"]').hidden,false);
 assert.equal(d.querySelector('[data-dirty-for="appearance"]').hidden,true);
});

test('invalid hex values and reversed schedules block saving with feedback',async t=>{
 const {w,d,input,calls}=await editor(t);
 const hex=d.querySelector('#lightBackground + .hex-input');hex.value='wrong';hex.dispatchEvent(new w.Event('input',{bubbles:true}));
 await w.RivFreeStudio.saveActive('appearance');assert.equal(calls.length,0);assert.equal(hex.getAttribute('aria-invalid'),'true');
 input('campaignStart','2026-12-10T12:00');input('campaignEnd','2026-12-01T12:00');
 await w.RivFreeStudio.saveActive('carousel');assert.equal(calls.length,0);assert.match(d.getElementById('campaignEnd').dataset.error,/posterior/);
});

test('failed carousel settings save does not produce a false success or clear dirty data',async t=>{
 const {w,E,input,notifications,d}=await editor(t);
 input('campaignSeconds','8');input('campaignTitleEs','Conservar');E.api=async()=>{throw new Error('Fallo simulado');};
 await w.RivFreeStudio.saveActive('carousel');
 assert.equal(notifications.at(-1)[0],'Fallo simulado');assert.equal(notifications.at(-1)[1],true);
 assert.equal(d.querySelector('[data-dirty-for="carousel"]').hidden,false);
 assert.equal(d.getElementById('saveCampaigns').disabled,false);
});

test('local banner image paths resolve at the site root',async t=>{
 const {d,input}=await editor(t);input('campaignImage','assets/manual/banner.webp');
 assert.equal(d.querySelector('#campaignImagePreview img').src,'http://localhost/assets/manual/banner.webp');
});

test('expanded preview returns control to the editor when closed or hidden',async t=>{
 const {d,tab}=await editor(t);tab('appearance');
 d.getElementById('previewExpand').click();assert.equal(d.querySelector('.shell').inert,true);
 assert.equal(d.getElementById('previewExpand').getAttribute('aria-pressed'),'true');
 d.getElementById('previewDockToggle').click();assert.equal(d.querySelector('.shell').inert,false);
 assert.equal(d.querySelector('.studio-preview-dock').classList.contains('expanded'),false);
 assert.equal(d.getElementById('previewDockToggle').getAttribute('aria-expanded'),'false');
});

test('automatic draft recovery includes banner edits without an Apply step',async t=>{
 const first=await editor(t);first.input('campaignTitleEs','Borrador recuperable');
 first.w.dispatchEvent(new first.w.Event('beforeunload'));
 const draft=first.w.localStorage.getItem('rivfree-studio-draft-v3');assert.ok(draft);
 const next=await editor(t,draft);next.d.querySelector('.draft-recovery button').click();
 assert.equal(next.d.getElementById('campaignTitleEs').value,'Borrador recuperable');
 assert.equal(next.d.querySelector('[data-dirty-for="carousel"]').hidden,false);
});

test('preview acknowledgment is accepted only from the preview frame',async t=>{
 const {w,d,messages,tab}=await editor(t);tab('appearance');await settle();
 const revision=messages.filter(x=>x.type==='rivfree-studio-campaigns-preview').at(-1).revision;
 const ack={type:'rivfree-studio-applied',revision};
 w.dispatchEvent(new w.MessageEvent('message',{origin:w.location.origin,source:w,data:ack}));
 assert.match(d.getElementById('previewStatus').textContent,/Actualizando/);
 w.dispatchEvent(new w.MessageEvent('message',{origin:w.location.origin,source:d.getElementById('studioPreview').contentWindow,data:ack}));
 assert.match(d.getElementById('previewStatus').textContent,/Vista actualizada/);
});

test('carousel keeps selected list scroll, custom colors and discard restores saved banner',async t=>{
 const {d,input,tab}=await editor(t);tab('carousel');const list=d.getElementById('campaignList');list.scrollTop=260;
 const buttons=d.querySelectorAll('.campaign-list-main');buttons[Math.min(5,buttons.length-1)].click();assert.equal(list.scrollTop,260);
 input('campaignLightButton','#123456');input('campaignLightButtonText','#ffffff');assert.equal(d.getElementById('campaignLightButton').value.toLowerCase(),'#123456');
 const original=JSON.parse(read('data/highlights.json')).hero.find(x=>x.id===d.getElementById('campaignId').value);input('campaignTitleEs','Temporal');d.getElementById('discardCampaign').click();await settle();
 if(original)assert.equal(d.getElementById('campaignTitleEs').value,original.title.es);
});

test('carousel transition setting is included in preview config',async t=>{
 const {d,input,messages,tab}=await editor(t);tab('carousel');input('campaignTransition','static');await settle();
 const preview=messages.filter(x=>x.type==='rivfree-studio-preview').at(-1);assert.equal(preview.config.carousel.transition,'static');
});

test('late fallback initialization does not overwrite an early carousel edit',async t=>{
 const {d,input,messages,tab}=await editor(t);tab('carousel');input('campaignTransition','static');
 await new Promise(resolve=>setTimeout(resolve,320));
 assert.equal(d.getElementById('campaignTransition').value,'static');
 const preview=messages.filter(x=>x.type==='rivfree-studio-preview').at(-1);assert.equal(preview.config.carousel.transition,'static');
});

test('storefront preview pins inactive campaigns, respects page visibility and rejects other senders',async t=>{
 const dom=new JSDOM(read('index.html'),{url:'http://localhost/?studio-preview=1',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;const parent={postMessage(){}};Object.defineProperty(w,'parent',{value:parent});t.after(()=>w.close());
 w.matchMedia=()=>({matches:false,addEventListener(){}});w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.fetch=async()=>{throw Error('offline fixture');};
 for(const file of ['matching.js','catalog.js','catalog-cache.js','features.js','shopping.js','storefront.js','product-details.js','app.js']){
  let code=read(file);if(file==='app.js')code=code.replace(/initStorefront\(\);\s*loadData\(\);\s*$/,'');require('node:vm').runInContext(code,dom.getInternalVMContext());
 }
 // Scripts above use global lexical state, so evaluate in the shared VM context.
 w.RIVFREE_SITE_CONFIG={homepage:{visible:{hero:false,popular:false}}};
 const hero=[{id:'inactive',enabled:false,theme:'mint',title:{es:'Visible en Studio','pt-BR':'Visível'},description:{},cta:{}}];
 const send=(data,source=parent)=>w.dispatchEvent(new w.MessageEvent('message',{origin:w.location.origin,source,data:{type:'rivfree-studio-campaigns-preview',hero,...data}}));
 send({selectedId:'inactive'});assert.equal(w.document.getElementById('heroCampaign').hidden,false);assert.equal(w.document.getElementById('heroCampaign').dataset.campaignId,'inactive');
 send({selectedId:''},w);assert.equal(w.document.getElementById('heroCampaign').hidden,false);
 send({selectedId:''});assert.equal(w.document.getElementById('heroCampaign').hidden,true);
 require('node:vm').runInContext('renderPopularProducts()',dom.getInternalVMContext());
 assert.equal(w.document.getElementById('popularProducts').hidden,true);
});

test('site config preserves zero radius and late network responses cannot overwrite a preview',async t=>{
 const dom=new JSDOM(read('index.html'),{url:'http://localhost/?studio-preview=1',runScripts:'outside-only'});const w=dom.window;
 t.after(()=>w.close());const parent={postMessage(){}};Object.defineProperty(w,'parent',{value:parent});
 let finish;w.fetch=()=>new Promise(resolve=>finish=resolve);w.eval(read('site-config.js'));
 const config=JSON.parse(read('data/site-config.json'));config.appearance.radius=0;config.appearance.dark.background='#223344';config.branding.tagline_es='Subtítulo en vivo';
 w.dispatchEvent(new w.MessageEvent('message',{origin:w.location.origin,source:parent,data:{type:'rivfree-studio-preview',config,theme:'dark',language:'es'}}));
 finish({ok:true,json:async()=>({})});await w.RIVFREE_SITE_READY;
 assert.equal(w.RIVFREE_SITE_CONFIG.appearance.radius,0);assert.equal(w.RIVFREE_SITE_CONFIG.appearance.dark.background,'#223344');
 assert.match(w.document.getElementById('rivfreeStudioTheme').textContent,/--studio-radius:0px/);
 assert.equal(w.document.documentElement.dataset.theme,'dark');
 assert.equal(w.document.documentElement.lang,'es');
 assert.equal(w.document.querySelector('.brand p').textContent,'Subtítulo en vivo');
});

test('general palette blocks unreadable text and automatic correction allows saving',async t=>{
 const {w,d,input,calls,notifications}=await editor(t);
 input('lightBackground','#FFFFFF');input('lightSurface','#FFFFFF');input('lightText','#FFFFFF');
 await w.RivFreeStudio.saveActive('appearance');assert.equal(calls.length,0);assert.ok(notifications.some(args=>args[0].includes('contraste')));assert.match(d.getElementById('paletteContrast').textContent,/1.00:1/);
 d.querySelector('.palette-contrast button').click();await w.RivFreeStudio.saveActive('appearance');assert.equal(calls.length,1);assert.equal(calls[0].payload.config.appearance.light.text,'#000000');
});
