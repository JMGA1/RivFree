/* Structured controls serialize to the existing weekly_hours format. */
(() => {
 const M=window.RivFreeCatalogFields,$=id=>document.getElementById(id);
 const days=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
 function serialize(day){
  const box=$('hoursDay'+day),closed=$('hoursClosed'+day).checked;
  $('storeDay'+day).value=closed?'':Array.from(box.querySelectorAll('.hours-turn')).map(row=>Array.from(row.querySelectorAll('input')).map(i=>i.value).join('-')).join(', ');
  box.querySelector('.hours-turns').hidden=closed;box.querySelector('.hours-add').disabled=closed;
  $('storeDay'+day).dispatchEvent(new Event('input',{bubbles:true}));
 }
 function turn(day,values=['09:00','18:00']){
  const row=document.createElement('div');row.className='hours-turn';
  for(const [index,label] of ['Abre','Cierra'].entries()){
   const wrap=document.createElement('label'),caption=document.createElement('span'),input=document.createElement('input');
   caption.textContent=label;input.type='time';input.step=60;input.value=values[index]||'';input.setAttribute('aria-label',days[day]+' · '+label);input.oninput=()=>serialize(day);wrap.append(caption,input);row.append(wrap);
  }
  const remove=document.createElement('button');remove.type='button';remove.className='button';remove.textContent='Quitar turno';remove.onclick=()=>{row.remove();if(!$('hoursDay'+day).querySelector('.hours-turn'))$('hoursClosed'+day).checked=true;serialize(day);};row.append(remove);$('hoursDay'+day).querySelector('.hours-turns').append(row);
 }
 for(let day=0;day<7;day++){
  const old=$('storeDay'+day),label=old.closest('label');old.type='hidden';
  const box=document.createElement('fieldset');box.id='hoursDay'+day;box.className='hours-day';
  box.innerHTML=`<legend>${days[day]}</legend><label class="check"><input id="hoursClosed${day}" type="checkbox"><span>Cerrado este día</span></label><div class="hours-turns"></div><button type="button" class="button hours-add">+ Agregar turno</button>`;
  label.replaceWith(box);box.append(old);$('hoursClosed'+day).onchange=()=>{if(!$('hoursClosed'+day).checked&&!box.querySelector('.hours-turn'))turn(day);serialize(day);};
  box.querySelector('.hours-add').onclick=()=>{turn(day,nextTurn(day));serialize(day);};
  const copy=document.createElement('button');copy.type='button';copy.className='button hours-copy-toggle';copy.textContent='Copiar a otros días';
  copy.setAttribute('aria-expanded','false');const panel=copyPanel(day);
  copy.onclick=()=>{panel.hidden=!panel.hidden;copy.setAttribute('aria-expanded',String(!panel.hidden));};
  box.querySelector('.hours-add').after(copy,panel);
 }
 // The week reads Monday → Sunday, like the public store page.
 $('hoursDay6').after($('hoursDay0'));
 const minutes=value=>{const [h,m]=String(value||'').split(':').map(Number);return Number.isFinite(h)&&Number.isFinite(m)?h*60+m:null;};
 const clock=total=>String(Math.floor(total/60)).padStart(2,'0')+':'+String(total%60).padStart(2,'0');
 // A new shift starts one hour after the previous one closes (14:00–18:00 when the day is empty).
 function nextTurn(day){
  const closes=[...$('hoursDay'+day).querySelectorAll('.hours-turn')].map(row=>minutes(row.querySelectorAll('input')[1]?.value)).filter(v=>v!==null);
  if(!closes.length)return ['14:00','18:00'];
  const start=Math.min(Math.max(...closes)+60,22*60);return [clock(start),clock(Math.min(start+240,23*60+59))];
 }
 function dayValues(day){return $('hoursClosed'+day).checked?[]:[...$('hoursDay'+day).querySelectorAll('.hours-turn')].map(row=>[...row.querySelectorAll('input')].map(input=>input.value));}
 function setDay(day,values){
  const box=$('hoursDay'+day);box.querySelector('.hours-turns').replaceChildren();
  $('hoursClosed'+day).checked=!values.length;for(const pair of values)turn(day,pair);serialize(day);
 }
 // Copy one day's shifts (or "closed") to the days ticked in the small panel.
 function copyPanel(day){
  const panel=document.createElement('div');panel.className='hours-copy';panel.hidden=true;
  const short=['Do','Lu','Ma','Mi','Ju','Vi','Sá'];
  for(const other of [1,2,3,4,5,6,0]){if(other===day)continue;
   const label=document.createElement('label');label.className='check';const box=document.createElement('input');box.type='checkbox';box.value=String(other);box.checked=box.defaultChecked=other!==0;
   const caption=document.createElement('span');caption.textContent=short[other];label.title=days[other];label.append(box,caption);panel.append(label);}
  const apply=document.createElement('button');apply.type='button';apply.className='button primary';apply.textContent='Copiar';
  apply.onclick=()=>{const values=dayValues(day),chosen=[...panel.querySelectorAll('input:checked')].map(box=>Number(box.value));
   for(const other of chosen)setDay(other,values);panel.hidden=true;panel.previousElementSibling?.setAttribute('aria-expanded','false');
   window.RivFreeEditor?.notify?.(chosen.length?`Horario de ${days[day]} copiado a ${chosen.length} día${chosen.length===1?'':'s'}.`:'Elegí al menos un día.',!chosen.length);};
  panel.append(apply);return panel;
 }
 const fill=M.fillStore;
 M.fillStore=info=>{fill(info);for(let day=0;day<7;day++){
  const box=$('hoursDay'+day),values=info.weekly_hours?.[day]||[];box.querySelector('.hours-turns').replaceChildren();
  $('hoursClosed'+day).checked=!values.length;for(const pair of values)turn(day,pair);
  box.querySelector('.hours-turns').hidden=!values.length;box.querySelector('.hours-add').disabled=!values.length;
 }};
 const read=M.store;
 M.store=()=>{const info=read();if(info.weekly_hours)for(let day=0;day<7;day++){
  const spans=info.weekly_hours[day];for(let i=1;i<spans.length;i++)if(spans[i][0]<spans[i-1][1])throw Error(days[day]+': los turnos se superponen o están desordenados.');
 }return info;};
 $('storeHoursKnown').addEventListener('change',()=>{document.querySelectorAll('.hours-day').forEach(box=>box.disabled=!$('storeHoursKnown').checked);});
 const fillControls=M.fillStore;M.fillStore=info=>{fillControls(info);document.querySelectorAll('.hours-day').forEach(box=>box.disabled=!$('storeHoursKnown').checked);};
 const note=document.createElement('p');note.className='form-help';note.textContent='La ficha pública usa esta tabla. Podés agregar varios turnos y marcar días cerrados. Los horarios no confirmados no indican abierto/cerrado.';$('storeHoursKnown').closest('label').after(note);
 $('storeHours').closest('label').querySelector('span').textContent='Horario en texto (solo si no hay horarios confirmados)';
})();
