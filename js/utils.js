// Funções compartilhadas do sistema. Mantidas em um único arquivo para evitar
// erros como "fmt is not defined" em páginas que não carregam render.js.
function fmt(n){return Number(n||0).toLocaleString('pt-BR',{maximumFractionDigits:0})}
function money(n){return Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
function decimal(n,digits=2){return Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:digits})}
function escapeHtml(value){return String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]))}
function currentPeriod(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
function setMsg(id,text,error=false){const el=document.getElementById(id);if(el){el.textContent=text;el.className='form-msg '+(error?'error':'success')}}
const statusLabel={planned:'Planejada',in_progress:'Em produção',completed:'Concluída',cancelled:'Cancelada',active:'Ativo',pending:'Pendente',blocked:'Bloqueado'};
function statusText(value){return statusLabel[value]||value||'—'}
const auditActionLabel={CREATE:'Cadastro',UPDATE:'Atualização',DELETE:'Exclusão',LOGIN:'Acesso ao sistema',LOGOUT:'Saída do sistema',APPROVE:'Aprovação',REJECT:'Recusa',BLOCK:'Bloqueio'};
const auditEntityLabel={product:'Produto',products:'Produtos',stock:'Estoque',raw_material:'Matéria-prima',production_order:'Ordem de produção',planning:'Planejamento',goal:'Meta',buyer:'Comprador',sale:'Venda',cpp_report:'Relatório CPP',user:'Usuário',company:'Empresa'};
function auditActionText(value){return auditActionLabel[String(value).toUpperCase()]||value||'—'}
function auditEntityText(value){return auditEntityLabel[value]||value||'—'}
window.pcUtils={fmt,money,decimal,escapeHtml,currentPeriod,setMsg,statusText,auditActionText,auditEntityText};

// A saída revoga a sessão no servidor, inclusive se o cookie for reutilizado.
document.addEventListener('click',async event=>{
 const link=event.target.closest('[data-logout]');if(!link)return;
 event.preventDefault();if(link.dataset.busy)return;link.dataset.busy='true';
 try{
  await pcSession.logout();
 }catch(error){alert(error.message)}finally{delete link.dataset.busy}
});

document.addEventListener('click',event=>{if(event.target.closest('[data-print]'))window.print()});
document.addEventListener('click',event=>{
 if(!event.target.closest('[data-export-table]'))return;
 const table=document.querySelector('table');if(!table)return;
 const csv='\uFEFF'+[...table.rows].map(row=>[...row.cells].map(cell=>'"'+cell.textContent.trim().replace(/^[=+@\-\t\r\n]/,m=>"'"+m).replace(/"/g,'""')+'"').join(';')).join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='relatorio-cpp.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
