const state={step:1,product:null,n:3,history:[],production:0,unitCost:0,energyPerUnit:0,energyCost:0,materials:[],lastResult:null};
const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
const productBox=$('#cppProducts');
const pageMsg=document.createElement('div');
pageMsg.className='cpp-status hidden';
if(productBox?.parentElement) productBox.parentElement.insertBefore(pageMsg,productBox);

function showStatus(text,type='info'){
  pageMsg.textContent=text;
  pageMsg.className=`cpp-status ${type}`;
}
function clearStatus(){pageMsg.textContent='';pageMsg.className='cpp-status hidden'}

function setStep(step){
  state.step=step;
  $$('[data-panel]').forEach(p=>p.classList.toggle('hidden',Number(p.dataset.panel)!==step));
  $$('.step').forEach(s=>{const n=Number(s.dataset.step);s.classList.toggle('active',n===step);s.classList.toggle('done',n<step)});
  const back=$('#backBtn'),next=$('#nextBtn');
  if(back) back.style.visibility=step===1?'hidden':'visible';
  if(next){next.textContent=step===4?'Nova simulação':'Continuar  ›';next.disabled=false}
  if(step===2) renderHistory();
  if(step===3) renderMaterials();
  if(step===4) calculateResult();
  window.scrollTo({top:0,behavior:'smooth'});
}

async function loadProducts(){
  if(!productBox)return;
  showStatus('Carregando produtos cadastrados…','loading');
  try{
    const products=await getProducts();
    if(!products.length){
      productBox.innerHTML='<div class="empty cpp-empty">Nenhum produto cadastrado. Cadastre um produto antes de iniciar a simulação.</div>';
      state.product=null;
      showStatus('Cadastre pelo menos um produto para usar a Calculadora CPP.','warning');
      return;
    }
    productBox.innerHTML=products.map((p,i)=>`<button type="button" class="choice ${i===0?'selected':''}" data-id="${p.id}"><span class="radio"></span><span>${escapeHtml(p.name)}</span></button>`).join('');
    state.product=products[0];
    state.materials=[];
    clearStatus();
    $$('.choice').forEach(b=>b.onclick=()=>{
      $$('.choice').forEach(x=>x.classList.remove('selected'));
      b.classList.add('selected');
      state.product=products.find(p=>Number(p.id)===Number(b.dataset.id))||null;
      state.materials=[];
    });
  }catch(err){
    productBox.innerHTML='<div class="empty cpp-empty">Não foi possível carregar os produtos.</div>';
    showStatus(err.message||'Erro ao carregar produtos.','error');
  }
}

function renderHistory(){
  $('#monthsText').textContent=state.n;
  const existing=state.history.length?state.history.slice(-state.n):Array.from({length:state.n},(_,i)=>({period:monthLabel(i-state.n+1),quantity:''}));
  while(existing.length<state.n) existing.unshift({period:monthLabel(existing.length-state.n),quantity:''});
  state.history=existing.slice(-state.n);
  $('#historyFields').innerHTML=state.history.map((r,i)=>`<label><span>${escapeHtml(r.period)}</span><div class="unit-input"><input data-h="${i}" type="number" min="0" step="1" value="${r.quantity}" placeholder="0"><em>un</em></div></label>`).join('');
  $$('[data-h]').forEach(x=>x.oninput=()=>state.history[Number(x.dataset.h)].quantity=x.value);
}
function monthLabel(offset){const d=new Date();d.setDate(1);d.setMonth(d.getMonth()+offset);return d.toLocaleDateString('pt-BR',{month:'long',year:'numeric'}).replace(/^./,c=>c.toUpperCase())}

function renderMaterials(){
  const p=state.product;
  if(!state.materials.length&&p?.ingredients?.length) state.materials=p.ingredients.map(x=>({...x,qty:x.quantityPerProduct,waste:x.wastePercent}));
  $('#materials').innerHTML=state.materials.map((m,i)=>`<div class="material-row"><input data-m="${i}" data-k="name" value="${escapeHtml(m.name||'')}" placeholder="Matéria-prima"><input data-m="${i}" data-k="qty" type="number" min="0" step="0.01" value="${m.quantityPerProduct??m.qty??''}" placeholder="Qtd/un"><input data-m="${i}" data-k="waste" type="number" min="0" step="0.1" value="${m.wastePercent??m.waste??0}" placeholder="% perda"><button type="button" class="btn" data-remove="${i}" title="Remover matéria-prima">×</button></div>`).join('');
  $$('[data-m]').forEach(x=>x.oninput=()=>state.materials[Number(x.dataset.m)][x.dataset.k]=Number(x.value)||x.value);
  $$('[data-remove]').forEach(x=>x.onclick=()=>{state.materials.splice(Number(x.dataset.remove),1);renderMaterials()});
}
$('#addMaterial')?.addEventListener('click',()=>{state.materials.push({name:'',qty:0,waste:0});renderMaterials()});

function validateStep(){
  if(state.step===1&&!state.product){showStatus('Selecione um produto para continuar.','warning');return false}
  if(state.step===2){
    const rows=state.history.slice(-state.n);
    const valid=rows.length===state.n&&rows.every(x=>x.quantity!==''&&Number.isFinite(Number(x.quantity))&&Number(x.quantity)>=0);
    if(!valid){showStatus('Preencha todos os meses do histórico com valores iguais ou maiores que zero.','warning');return false}
  }
  if(state.step===3){
    state.production=Number($('#currentProduction').value);
    state.unitCost=Number($('#unitCost').value);
    state.energyPerUnit=Number($('#energyPerUnit').value)||0;
    state.energyCost=Number($('#energyCost').value)||0;
    if(!Number.isFinite(state.production)||state.production<0){showStatus('Informe uma produção atual válida.','warning');return false}
    if(!Number.isFinite(state.unitCost)||state.unitCost<0){showStatus('Informe um custo por unidade válido.','warning');return false}
  }
  clearStatus();
  return true;
}

async function calculateResult(){
  if(!state.product)return;
  const vals=state.history.slice(-state.n).map(x=>({period:x.period,quantity:Number(x.quantity)||0}));
  const next=$('#nextBtn');
  try{
    if(next)next.disabled=true;
    showStatus('Calculando a simulação e salvando o relatório…','loading');
    const result=await calculateCpp({productId:state.product.id,monthsN:state.n,history:vals,currentProduction:state.production,unitCost:state.unitCost,energyPerUnit:state.energyPerUnit,energyCost:state.energyCost,materials:state.materials.map(m=>({name:m.name,quantityPerProduct:Number(m.qty??m.quantityPerProduct??0),wastePercent:Number(m.waste??m.wastePercent??0)})).filter(m=>m.name)});
    $('#rDemand').textContent=fmt(result.demandForecast);
    $('#rProduction').textContent=fmt(result.currentProduction);
    $('#rSurplus').textContent=fmt(result.surplus);
    $('#rSaving').textContent=money(result.financialReduction);
    $('#financialTotal').textContent=money(result.financialReduction)+'/mês';
    $('#financialFormula').textContent=`${fmt(result.surplus)} un × ${money(result.unitCost)}`;
    let materialHtml=result.materials.map(m=>`<div class="breakdown-row"><div><b>${escapeHtml(m.name)}</b><small>Perda média de ${Number(m.wastePercent).toLocaleString('pt-BR',{maximumFractionDigits:1})}% sobre insumo</small></div><strong>${Number(m.quantitySaved).toLocaleString('pt-BR',{maximumFractionDigits:2})} kg</strong></div>`).join('');
    if(Number(result.energySavedKwh)>0)materialHtml+=`<div class="breakdown-row"><div><b>Energia elétrica</b><small>Consumo estimado evitado</small></div><strong>${Number(result.energySavedKwh).toLocaleString('pt-BR',{maximumFractionDigits:2})} kWh</strong></div>`;
    $('#materialResult').innerHTML=materialHtml||'<div class="empty">Nenhum detalhamento de matéria-prima foi informado.</div>';
    state.lastResult=result;
    showStatus('Simulação concluída. O resultado também foi salvo no histórico CPP.','success');
  }catch(err){
    showStatus(err.message||'Não foi possível calcular a simulação.','error');
    $('#materialResult').innerHTML='<div class="empty">Corrija os dados e tente novamente.</div>';
  }finally{if(next)next.disabled=false}
}

function resetSimulation(){
  state.step=1;state.product=null;state.n=3;state.history=[];state.production=0;state.unitCost=0;state.energyPerUnit=0;state.energyCost=0;state.materials=[];state.lastResult=null;
  $('#currentProduction').value='';$('#unitCost').value='';$('#energyPerUnit').value='';$('#energyCost').value='';
  $$('#mmsOptions button').forEach(b=>b.classList.toggle('selected',b.dataset.n==='3'));
  setStep(1);loadProducts();
}

$('#mmsOptions')?.addEventListener('click',e=>{const b=e.target.closest('button[data-n]');if(!b)return;state.n=Number(b.dataset.n);$$('#mmsOptions button').forEach(x=>x.classList.toggle('selected',x===b));state.history=[];showStatus(`A simulação usará os últimos ${state.n} períodos.`,'info')});
$('#nextBtn')?.addEventListener('click',async()=>{if(state.step===4){resetSimulation();return}if(!validateStep())return;setStep(state.step+1)});
$('#backBtn')?.addEventListener('click',()=>{if(state.step>1)setStep(state.step-1)});
$('#printResult')?.addEventListener('click',()=>window.print());
$('#exportResult')?.addEventListener('click',()=>window.print());
$('#exportCsv')?.addEventListener('click',()=>{
  if(!state.lastResult)return showStatus('Conclua uma simulação antes de exportar.','warning');
  const r=state.lastResult;
  const rows=[['indicador','valor'],['produto',r.product?.name||''],['demanda prevista',r.demandForecast],['produção atual',r.currentProduction],['excedente',r.surplus],['economia estimada',r.financialReduction],['energia evitada kWh',r.energySavedKwh||0]];
  const csv='\uFEFF'+rows.map(row=>row.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(';')).join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');const url=URL.createObjectURL(blob);a.href=url;a.download='resultado-cpp.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
});

loadProducts();
setStep(1);
