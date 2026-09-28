// One issue per store after 3 completed failures. Recovered stores close theirs.
module.exports=async({github,context})=>{
 const fs=require('node:fs');
 const safe=value=>String(value??'sin registro').replace(/:\/\/[^/@\s]+@/g,'://***@').replace(/@/g,'＠').replace(/`/g,"'").replace(/[\r\n\x00-\x1f]/g,' ').slice(0,300);
 const health=JSON.parse(fs.readFileSync('data/health.json','utf8'));
 const allowed=new Set(Object.keys(JSON.parse(fs.readFileSync('data/stores.json','utf8'))));
 const issues=await github.paginate(github.rest.issues.listForRepo,{...context.repo,state:'open',per_page:100});
 for(const [store,status] of Object.entries(health)){
  if(!allowed.has(store)||!status||typeof status!=='object')continue;
  const title=`[scraper] ${safe(store)}: fallas repetidas`;
  const issue=issues.find(i=>i.title===title&&!i.pull_request&&i.user?.login==='github-actions[bot]');
  if(status.fallos_consecutivos>=3&&!issue){
   await github.rest.issues.create({...context.repo,title,body:`La tienda lleva ${Number(status.fallos_consecutivos)||0} corridas fallando.\nÚltimo intento: ${safe(status.ultimo_intento)}\nÚltimo éxito: ${safe(status.ultimo_exito)}\nError: \n\`\`\`text\n${safe(status.error)}\n\`\`\`\n\nRevisar el scraper; el catálogo conserva datos anteriores.`});
  }else if(status.fallos_consecutivos===0&&issue){
   await github.rest.issues.update({...context.repo,issue_number:issue.number,state:'closed'});
  }
 }
};
