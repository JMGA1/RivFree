// One issue per store after 3 completed failures. Recovered stores close theirs.
module.exports=async({github,context})=>{
 const fs=require('node:fs');
 const health=JSON.parse(fs.readFileSync('data/health.json','utf8'));
 const issues=await github.paginate(github.rest.issues.listForRepo,{...context.repo,state:'open',per_page:100});
 for(const [store,status] of Object.entries(health)){
  const title=`[scraper] ${store}: fallas repetidas`;
  const issue=issues.find(i=>i.title===title&&!i.pull_request&&i.user?.login==='github-actions[bot]');
  if(status.fallos_consecutivos>=3&&!issue){
   await github.rest.issues.create({...context.repo,title,body:`La tienda lleva ${status.fallos_consecutivos} corridas fallando.\nÚltimo intento: ${status.ultimo_intento}\nÚltimo éxito: ${status.ultimo_exito||'sin registro'}\nError: ${status.error}\n\nRevisar el scraper; el catálogo conserva datos anteriores.`});
  }else if(status.fallos_consecutivos===0&&issue){
   await github.rest.issues.update({...context.repo,issue_number:issue.number,state:'closed'});
  }
 }
};
