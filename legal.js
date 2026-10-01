(() => {
 const select=document.getElementById('languageToggle'),policy=document.documentElement.dataset.policy;
 const names={privacidad:['Política de privacidad','Política de privacidade'],cookies:['Política de cookies','Política de cookies'],terminos:['Términos de uso','Termos de uso']};
 let contents='';try{select.value=new URLSearchParams(location.search).get('lang')||localStorage.getItem('rivfree-language')||'pt-BR';}catch{}
 if(!select.value)select.value='pt-BR';
 function render(){const es=select.value==='es';document.documentElement.lang=es?'es':'pt-BR';const title=names[policy][es?0:1];document.title=title+' | RivFree';document.getElementById('legalTitle').textContent=title;document.getElementById('legalBack').textContent=es?'← Volver a RivFree':'← Voltar ao RivFree';const parts=contents.split(/^=== (?:ES|PT) ===\s*$/m);document.getElementById('legalContent').textContent=parts.length>=3?parts[es?1:2].trim():contents;}
 select.addEventListener('change',render);
 fetch('politicas/'+policy+'.txt',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.text();}).then(text=>{contents=text;render();}).catch(()=>{contents='No se pudo cargar el documento. Recargá la página. / Não foi possível carregar o documento. Atualize a página.';render();});render();
})();
