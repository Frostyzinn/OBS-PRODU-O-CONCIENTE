const assert=require('node:assert/strict');
const base=process.env.TEST_URL||'http://127.0.0.1:3001';
let cookie;let checks=0;
async function request(path,method='GET',body,status=200){const res=await fetch(base+path,{method,headers:{'Content-Type':'application/json','X-PC-Request':'1',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});if(res.headers.get('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];const text=await res.text();assert.equal(res.status,status,method+' '+path+': '+text);checks++;try{return JSON.parse(text)}catch{return text}}
(async()=>{
 const health=await request('/api/v1/health');assert.equal(health.databaseName,'pc_revisao_20260918','Testes só podem alterar o banco isolado pc_revisao_20260918.');
 for(const path of ['/server.js','/db/database.js','/package.json','/.env','/scripts/seed.js','/node_modules/express/package.json'])await request(path,'GET',null,404);
 for(const path of ['/login.html','/css/professional.css','/js/main.js','/assets/logo-producao-consciente.png'])await request(path);
 await request('/api/v1/products','GET',null,401);
 const login=await request('/api/v1/auth/login','POST',{email:'demo@producao.com',password:'123456'});assert.equal(login.token,undefined);assert.ok(login.user.companyId);
 for(const route of ['auth/me','products','stock','stock/movements','production/orders','planning','buyers','sales-histories','goals','reports/management','reports/audit','team','team/requests'])await request('/api/v1/'+route);
 const material=await request('/api/v1/stock','POST',{name:'Insumo teste '+Date.now(),currentStock:100,minStock:5,unitCost:2},201);
 const product=await request('/api/v1/products','POST',{name:'Produto teste '+Date.now(),unitCost:5,ingredients:[{name:'Insumo de teste',rawMaterialId:material.id,quantityPerProduct:2}]},201);
 await request('/api/v1/products','POST',{name:'Insumo inválido',ingredients:[{name:'Não existe',rawMaterialId:99999999}]},400);
 await request('/api/v1/stock','POST',{name:'Negativo',currentStock:-1},400);
 const order=await request('/api/v1/production/orders','POST',{productId:product.id,plannedQuantity:10},201);
 await request('/api/v1/production/orders/'+order.id,'PATCH',{status:'in_progress'});
 const results=await Promise.all([fetch(base+'/api/v1/production/orders/'+order.id,{method:'PATCH',headers:{'Content-Type':'application/json','X-PC-Request':'1',Cookie:cookie},body:JSON.stringify({status:'completed',producedQuantity:10})}),fetch(base+'/api/v1/production/orders/'+order.id,{method:'PATCH',headers:{'Content-Type':'application/json','X-PC-Request':'1',Cookie:cookie},body:JSON.stringify({status:'completed',producedQuantity:10})})]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);checks++;
 let stock=await request('/api/v1/stock');assert.equal(stock.find(r=>r.id===material.id).currentStock,80);
 const p=await request('/api/v1/products/'+product.id);assert.equal(p.currentProduction,10);
 await request('/api/v1/production/orders/'+order.id,'PATCH',{status:'planned'},409);
 const second=await request('/api/v1/production/orders','POST',{productId:product.id,plannedQuantity:100},201);
 await request('/api/v1/production/orders/'+second.id,'PATCH',{status:'completed',producedQuantity:100},400);
 stock=await request('/api/v1/stock');assert.equal(stock.find(r=>r.id===material.id).currentStock,80);
 await Promise.all([request('/api/v1/stock/'+material.id+'/movements','POST',{type:'in',quantity:5},201),request('/api/v1/stock/'+material.id+'/movements','POST',{type:'in',quantity:7},201)]);
 stock=await request('/api/v1/stock');assert.equal(stock.find(r=>r.id===material.id).currentStock,92);
 const movements=await request('/api/v1/stock/movements');assert.ok(movements.some(m=>m.rawMaterialId===material.id&&m.reference===order.orderNumber));
 // Remover somente registros criados nesta execução, no banco explicitamente isolado.
 await request('/api/v1/production/orders/'+second.id,'DELETE');await request('/api/v1/production/orders/'+order.id,'DELETE');await request('/api/v1/products/'+product.id,'DELETE',null,204);await request('/api/v1/stock/'+material.id,'DELETE');
 console.log(checks+' verificações passaram: arquivos privados, autenticação, módulos, estoque concorrente, conclusão única e rollback.');
})().catch(e=>{console.error(e);process.exitCode=1});
