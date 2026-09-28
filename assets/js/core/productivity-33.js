
/* Versão 3.3: Biblioteca de Ferramentas e Histórico Global. */
(function(){
const HISTORY_SOURCES=[
 {id:'arquivo',name:'Nome de arquivo',key:FILE_HISTORY_KEY,icon:'file'},
 {id:'inscricao',name:'Inscrição imobiliária',key:REGISTRATION_HISTORY_KEY,icon:'building'},
 {id:'lote',name:'Número de lote',key:LOT_HISTORY_KEY,icon:'grid'},
 {id:'uvrm',name:'Calculadora UVRM',key:UVRM_HISTORY_KEY,icon:'coins'},
 {id:'percentual',name:'Percentual',key:PERCENTAGE_HISTORY_KEY,icon:'percent'},
 {id:'datas',name:'Datas',key:DATES_HISTORY_KEY,icon:'calendar'},
 {id:'cpf-cnpj',name:'CPF / CNPJ',key:DOCUMENT_FISCAL_HISTORY_KEY,icon:'idcard'}
];
function norm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()}
const GLOBAL_HISTORY_TECHNICAL_FIELDS=new Set(['id','client_id','clientId','device_id','deviceId','schema_version','schemaVersion','sync_status','created_at','updated_at']);
function readableHistoryValues(item){
 if(!item||typeof item!=='object')return[];
 return Object.entries(item)
   .filter(([key,value])=>!GLOBAL_HISTORY_TECHNICAL_FIELDS.has(key)&&['string','number'].includes(typeof value))
   .map(([,value])=>value)
   .filter(value=>String(value).trim());
}
function itemText(item){
 if(typeof item==='string')return item;
 if(item&&typeof item==='object'){
   const preferred=['description','descricao','result','resultado','detail','detalhe','value','valor','normalized','text','label','name','operation','action'];
   const picked=[];
   preferred.forEach(key=>{
     if(Object.prototype.hasOwnProperty.call(item,key)&&['string','number'].includes(typeof item[key])&&String(item[key]).trim()){
       picked.push(item[key]);
     }
   });
   readableHistoryValues(item).forEach(value=>{
     if(!picked.some(existing=>String(existing)===String(value)))picked.push(value);
   });
   return picked.slice(0,4).join(' • ');
 }
 if(typeof dashboardRecentText==='function')return dashboardRecentText(item);
 return '';
}
function itemDate(item){if(!item||typeof item!=='object')return null;const raw=item.occurred_at||item.createdAt||item.copiedAt||item.timestamp||item.date||item.savedAt||item.finishedAt||item.created_at;const d=raw?new Date(raw):null;return d&&!Number.isNaN(d.getTime())?d:null}
function globalHistoryStableId(row){return String(row?.item?.id||row?.item?.client_id||row?.item?.clientId||`${row?.source?.id||''}:${row?.text||''}`)}
function collectGlobalHistory(){return HISTORY_SOURCES.flatMap(source=>(getJson(source.key,[])||[]).map((item,index)=>({source,item,index,text:itemText(item),date:itemDate(item)}))).filter(x=>x.text).sort((a,b)=>{const dateDiff=(b.date?.getTime()||0)-(a.date?.getTime()||0);if(dateDiff)return dateDiff;const moduleDiff=String(a.source.id).localeCompare(String(b.source.id));if(moduleDiff)return moduleDiff;const idDiff=globalHistoryStableId(a).localeCompare(globalHistoryStableId(b));return idDiff||a.index-b.index;});}
function populateSelect(select,items){if(!select)return;items.forEach(x=>{if([...select.options].some(o=>o.value===x.value))return;const o=document.createElement('option');o.value=x.value;o.textContent=x.label;select.appendChild(o);});}
function renderLibrary(){const box=document.getElementById('libraryTools');if(!box)return;const q=norm(document.getElementById('librarySearch')?.value),cat=document.getElementById('libraryCategory')?.value||'todos',view=document.getElementById('libraryView')?.value||'grid';let tools=getRegisteredTools();tools=tools.filter(t=>(cat==='todos'||t.category===cat)&&(!q||norm([t.name,t.description,t.category,...t.keywords].join(' ')).includes(q)));box.classList.toggle('is-list',view==='list');box.innerHTML=tools.length?tools.map(t=>`<article class="library-tool-card">${toolIconMarkup(t.icon)}<div><h4>${t.name}</h4><p>${t.description}</p><small>${t.category}</small></div><button class="library-tool-open" type="button" data-open-tab="${t.id}" aria-label="Abrir ${t.name}"></button><button class="library-favorite${isFavorite(t.id)?' active':''}" type="button" data-library-favorite="${t.id}" title="Favorito">★</button></article>`).join(''):'<p class="global-history-empty">Nenhuma ferramenta encontrada.</p>';document.getElementById('libraryToolCount').textContent=String(tools.length);document.getElementById('libraryFavoriteCount').textContent=String(getFavorites().length);renderLibraryModels();}
function renderLibraryModels(){const box=document.getElementById('libraryModels');if(!box)return;const models=getJson(FILE_MODELS_KEY,[]);document.getElementById('libraryModelCount').textContent=String(models.length);box.innerHTML=models.length?models.map((m,i)=>`<button type="button" class="library-model-chip" data-library-model="${i}">${m.name||m.label||`Modelo ${i+1}`}</button>`).join(''):'<p class="empty-state">Nenhum modelo salvo. Use o Montador de nome de arquivo para criar modelos.</p>';}
function filteredHistory(){const q=norm(document.getElementById('globalHistorySearch')?.value),mod=document.getElementById('globalHistoryModule')?.value||'todos',period=document.getElementById('globalHistoryPeriod')?.value||'todos',now=new Date();return collectGlobalHistory().filter(x=>{if(mod!=='todos'&&x.source.id!==mod)return false;if(q&&!norm(x.text).includes(q))return false;if(period==='hoje'){if(!x.date||x.date.toDateString()!==now.toDateString())return false}else if(period!=='todos'){const days=Number(period);if(!x.date||now-x.date>days*86400000)return false}return true})}
function renderGlobalHistory(){const box=document.getElementById('globalHistoryList');if(!box)return;const syncState=window.HistoryService?.getSyncState?.()||{};const pending=window.HistoryService?.listPending?.().length||0;const pendingEl=document.getElementById('globalHistoryPending');if(pendingEl)pendingEl.textContent=String(pending);const lastSyncEl=document.getElementById('globalHistoryLastSync');if(lastSyncEl)lastSyncEl.textContent=syncState.lastSuccessAt?new Date(syncState.lastSuccessAt).toLocaleString('pt-BR'):'Nunca';const rows=filteredHistory();document.getElementById('globalHistoryCount').textContent=String(rows.length);document.getElementById('globalHistoryModuleCount').textContent=String(new Set(rows.map(x=>x.source.id)).size);document.getElementById('globalHistoryLast').textContent=rows[0]?.date?rows[0].date.toLocaleString('pt-BR'):'Nenhum';box.innerHTML=rows.length?rows.map((x,i)=>`<article class="global-history-item">${toolIconMarkup(x.source.icon)}<div class="global-history-content"><strong>${x.source.name}</strong><p title="${String(x.text).replace(/"/g,'&quot;')}">${x.text}</p><small>${x.date?x.date.toLocaleString('pt-BR'):'Data não registrada'}</small></div><div class="global-history-actions"><button class="small-button" type="button" data-global-copy="${i}">Copiar</button><button class="small-button secondary" type="button" data-open-tab="${x.source.id}">Abrir</button></div></article>`).join(''):'<div class="global-history-empty">Nenhum registro corresponde aos filtros.</div>';box._rows=rows;}
function download(name,type,text){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}
function exportHistory(format){const rows=filteredHistory().map(x=>({modulo:x.source.name,conteudo:x.text,data:x.date?x.date.toISOString():''}));if(format==='json')download('historico-global.json','application/json',JSON.stringify(rows,null,2));else{const esc=v=>`"${String(v).replace(/"/g,'""')}"`;download('historico-global.csv','text/csv;charset=utf-8','Módulo;Conteúdo;Data\n'+rows.map(r=>[r.modulo,r.conteudo,r.data].map(esc).join(';')).join('\n'));}if(typeof trackToolAction==='function')trackToolAction('historico-global','exportar');}
async function syncGlobalHistory(){
 const button=document.getElementById('globalHistorySync');
 const status=document.getElementById('globalHistorySyncStatus');
 if(button)button.disabled=true;
 if(status)status.textContent='Sincronizando...';
 try{
   const result=await window.HistoryService?.syncAll?.({silent:false});
   renderGlobalHistory();
   if(status){
     const pending=window.HistoryService?.listPending?.().length||0;
     if(pending){
       const reason=result?.reason==='offline'?' Sem internet.':result?.reason==='not_authenticated'?' Faça login para enviar.':' Nova tentativa será automática.';
       status.textContent=`${pending} registro(s) pendente(s).${reason}`;
     }else{
       const uploaded=Number(result?.uploaded||0), downloaded=Number(result?.downloaded||0);
       status.textContent=`Histórico sincronizado. Enviados: ${uploaded} • Recebidos: ${downloaded}`;
     }
   }
 }catch(error){
   if(status)status.textContent='Não foi possível sincronizar o histórico.';
   console.error(error);
 }finally{if(button)button.disabled=false}
}
function init(){const period=document.getElementById('globalHistoryPeriod');if(period)period.value='hoje';populateSelect(document.getElementById('libraryCategory'),TOOL_CATEGORIES.filter(x=>x.id!=='todos').map(x=>({value:x.id,label:x.name})));populateSelect(document.getElementById('globalHistoryModule'),HISTORY_SOURCES.map(x=>({value:x.id,label:x.name})));['librarySearch','libraryCategory','libraryView'].forEach(id=>document.getElementById(id)?.addEventListener(id==='librarySearch'?'input':'change',renderLibrary));['globalHistorySearch','globalHistoryModule','globalHistoryPeriod'].forEach(id=>document.getElementById(id)?.addEventListener(id==='globalHistorySearch'?'input':'change',renderGlobalHistory));document.getElementById('globalHistoryExportCsv')?.addEventListener('click',()=>exportHistory('csv'));document.getElementById('globalHistoryExportJson')?.addEventListener('click',()=>exportHistory('json'));document.getElementById('globalHistorySync')?.addEventListener('click',syncGlobalHistory);document.addEventListener('click',e=>{const fav=e.target.closest('[data-library-favorite]');if(fav){e.preventDefault();e.stopPropagation();toggleFavorite(fav.dataset.libraryFavorite);renderLibrary();}const model=e.target.closest('[data-library-model]');if(model){activateTab('arquivo');NotificationService?.info?.('Modelo disponível no Montador de nome de arquivo.');}const copy=e.target.closest('[data-global-copy]');if(copy){const rows=document.getElementById('globalHistoryList')._rows||[];const row=rows[Number(copy.dataset.globalCopy)];if(row)copyText(row.text);}});renderLibrary();renderGlobalHistory();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.addEventListener('history-sync-state',()=>renderGlobalHistory());
window.renderProductivity33=()=>{renderLibrary();renderGlobalHistory()};
})();
