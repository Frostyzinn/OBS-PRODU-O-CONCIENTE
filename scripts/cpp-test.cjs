// Exercita o JavaScript real da calculadora contra o Express e o banco local de testes.
process.env.MYSQL_DATABASE='pc_revisao_20260918';
process.env.MYSQL_AUTO_CREATE_DATABASE='false';
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const db=require('../db/database');
let server,product,cookie,base;
async function request(path,body,method='POST'){
  const res=await fetch(base+'/api/v1'+path,{method,headers:{'Content-Type':'application/json','X-PC-Request':'1',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
  if(res.headers.get('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];
  const data=await res.json().catch(()=>({}));if(!res.ok)throw Object.assign(new Error(data.error),{status:res.status});return data;
}
(async()=>{
  assert.notEqual(process.env.NODE_ENV,'production');
  await db.initDatabase({migrate:false});
  server=require('../server').listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base='http://127.0.0.1:'+server.address().port;
  await request('/auth/login',{email:'demo@producao.com',password:'123456'});
  product=await request('/products',{name:'CPP regressão '+Date.now(),unitCost:5,currentProduction:200});
  const elements=new Map();
  function element(key){if(!elements.has(key))elements.set(key,{textContent:'',innerHTML:'',style:{},classList:{toggle(){}},setAttribute(){},addEventListener(){},prepend(child){this.child=child;}});return elements.get(key);}
  const context={document:{querySelector:s=>s==='#cppProducts'?null:element(s),querySelectorAll:()=>[],createElement:()=>element('status')},window:{scrollTo(){}},escapeHtml:String,fmt:String,money:String,
    calculateCpp:body=>request('/cpp/calculate',body)};
  vm.createContext(context);vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../js/cpp.js'),'utf8'),context);
  context.product=product;
  vm.runInContext('state.product=product; renderHistory(); state.history.forEach((r,i)=>r.quantity=[90,120,150][i]); state.production=200; state.unitCost=5; state.energyPerUnit=2;',context);
  assert.match(element('#historyFields').innerHTML,/de \d{4}/,'Exibe mês por extenso');
  const history=vm.runInContext('state.history',context);
  for(const row of history)assert.match(row.period,/^\d{4}-\d{2}$/);
  const invalid={productId:product.id,history:[{period:'Setembro de 2026',quantity:10}]};
  await assert.rejects(request('/cpp/calculate',invalid),e=>e.status===400&&/AAAA-MM/.test(e.message));
  await vm.runInContext('calculateResult()',context);
  const result=vm.runInContext('state.lastResult',context);
  assert.ok(result?.id,'Calcula e salva relatório');assert.equal(result.demandForecast,120);assert.equal(result.surplus,80);assert.equal(result.financialReduction,400);assert.equal(result.energySavedKwh,160);
  const saved=await request('/cpp/reports/'+result.id,null,'GET');assert.equal(saved.financialReduction,400);
  assert.equal(element('#exportResult').disabled,false);
  assert.equal(element('.cpp-card').child,element('status'),'Mensagem fora das etapas ocultas');
  context.calculateCpp=async()=>{throw new Error('Falha de teste visível');};
  await vm.runInContext('calculateResult()',context);
  assert.equal(vm.runInContext('state.lastResult',context),null);assert.equal(element('#exportResult').disabled,true);assert.equal(element('#rSaving').textContent,'—');assert.equal(element('status').textContent,'Falha de teste visível');
  console.log('CPP passou: erro original 400 reproduzido; histórico do frontend aceito; média 120, excedente 80, economia 400; persistência e falha sem resultado antigo.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
  if(product)await request('/products/'+product.id,null,'DELETE');
  if(cookie)await request('/auth/logout',{});
  if(server)await new Promise(r=>server.close(r));await db.close();
});
