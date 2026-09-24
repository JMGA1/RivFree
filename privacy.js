(()=>{
 const config=window.RIVFREE_PRIVACY||{};const picker=document.getElementById('policyLanguage');
 let lang=new URL(location.href).searchParams.get('lang');
 if(!['es','pt-BR'].includes(lang)){try{lang=localStorage.getItem('rivfree-language');}catch{}}
 function render(){
  const es=lang==='es';document.documentElement.lang=lang;picker.value=lang;
  document.title=es?'RivFree · Privacidad y Cookies':'RivFree · Privacidade e Cookies';
  document.querySelectorAll('[data-lang]').forEach(el=>el.hidden=el.dataset.lang!==lang);
  document.getElementById('backToCatalog').textContent=es?'← Volver a RivFree':'← Voltar ao RivFree';
 }
 for(const section of document.querySelectorAll('[data-lang]')){
  const es=section.dataset.lang==='es';
  if(config.controllerName)section.querySelector('[data-controller]').textContent=config.controllerName;
  if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.contactEmail||'')){const a=document.createElement('a');a.href='mailto:'+config.contactEmail;a.textContent=config.contactEmail;section.querySelector('[data-contact]').replaceChildren(a);}
  if(config.controllerName && config.contactEmail)section.querySelector('.draft-note').hidden=true;
 }
 lang=lang==='es'?'es':'pt-BR';render();
 picker.onchange=()=>{lang=picker.value;try{localStorage.setItem('rivfree-language',lang);}catch{}const url=new URL(location.href);url.searchParams.set('lang',lang);history.replaceState(null,'',url);render();};
})();
