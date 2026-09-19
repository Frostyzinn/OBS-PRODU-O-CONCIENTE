const API_BASE='/api/v1';
function authHeaders(extra={}){return {...extra,"X-PC-Request":"1"};}
async function api(path,options={}){
 if(window.pcSession&&document.documentElement.hasAttribute('data-private'))await pcSession.ready;
 const headers=authHeaders({'Content-Type':'application/json',...(options.headers||{})});
 const res=await fetch(API_BASE+path,{...options,headers,credentials:'same-origin'});
 let data={};try{data=await res.json()}catch{}
 if(!res.ok){
  if(res.status===401||(res.status===403&&(path==='/auth/me'||data.error?.startsWith('Acesso indisponível'))))pcSession.redirect();
  throw Object.assign(new Error(data.error||('Erro na API (HTTP '+res.status+').')),{status:res.status,code:data.code});
 }
 return data;
}
async function getMe(){return window.pcSession?pcSession.ready:api('/auth/me')}
async function getCompany(){return api('/companies/me')}
async function updateCompany(data){return api('/companies/me',{method:'PUT',body:JSON.stringify(data)})}
async function lookupCompany(cnpj){return api(`/companies/lookup/${encodeURIComponent(cnpj)}`)}
async function getTeam(){return api('/team')}
async function getJoinRequests(){return api('/team/requests')}
async function decideJoinRequest(id,action){return api(`/team/requests/${id}`,{method:'PATCH',body:JSON.stringify({action})})}
async function updateTeamMember(id,role){return api(`/team/${id}`,{method:'PATCH',body:JSON.stringify({role})})}
async function blockTeamMember(id){return api(`/team/${id}`,{method:'DELETE'})}
async function getProducts(){return api('/products')}
async function createProduct(data){return api('/products',{method:'POST',body:JSON.stringify(data)})}
async function updateProduct(id,data){return api(`/products/${id}`,{method:'PUT',body:JSON.stringify(data)})}
async function deleteProduct(id){return api(`/products/${id}`,{method:'DELETE'})}
async function getSalesHistories(){return api('/sales-histories')}
async function saveSale(data){return api('/sales-histories',{method:'POST',body:JSON.stringify(data)})}
async function updateSale(id,data){return api(`/sales-histories/${id}`,{method:'PUT',body:JSON.stringify(data)})}
async function deleteSale(id){return api(`/sales-histories/${id}`,{method:'DELETE'})}
async function importSales(rows){return api('/sales-histories/import',{method:'POST',body:JSON.stringify({rows})})}
async function getBuyers(){return api('/buyers')}
async function createBuyer(data){return api('/buyers',{method:'POST',body:JSON.stringify(data)})}
async function updateBuyer(id,data){return api(`/buyers/${id}`,{method:'PUT',body:JSON.stringify(data)})}
async function deleteBuyer(id){return api(`/buyers/${id}`,{method:'DELETE'})}
async function getCppReports(){return api('/cpp/reports')}
async function calculateCpp(data){return api('/cpp/calculate',{method:'POST',body:JSON.stringify(data)})}
async function getDashboardData(){const [products,sales]=await Promise.all([getProducts(),getSalesHistories()]);return products.map(p=>{const rows=sales.filter(s=>Number(s.productId)===Number(p.id)).sort((a,b)=>a.period.localeCompare(b.period));const recent=rows.slice(-6);const forecast=recent.length?recent.reduce((s,r)=>s+Number(r.quantity||0),0)/recent.length:0;const surplus=Math.max(0,Number(p.currentProduction)-forecast);return {...p,rows,forecast,surplus,saving:surplus*Number(p.unitCost||0)}})}
async function getStock(){return api('/stock')}
async function createStockItem(data){return api('/stock',{method:'POST',body:JSON.stringify(data)})}
async function updateStockItem(id,data){return api(`/stock/${id}`,{method:'PUT',body:JSON.stringify(data)})}
async function deleteStockItem(id){return api(`/stock/${id}`,{method:'DELETE'})}
async function stockMovement(id,data){return api(`/stock/${id}/movements`,{method:'POST',body:JSON.stringify(data)})}
async function getStockMovements(){return api('/stock/movements')}
async function getProductionOrders(){return api('/production/orders')}
async function createProductionOrder(data){return api('/production/orders',{method:'POST',body:JSON.stringify(data)})}
async function updateProductionOrder(id,data){return api(`/production/orders/${id}`,{method:'PATCH',body:JSON.stringify(data)})}
async function deleteProductionOrder(id){return api(`/production/orders/${id}`,{method:'DELETE'})}
async function getProductionSummary(){return api('/production/summary')}
async function getPlanning(){return api('/planning')}
async function createPlanning(data){return api('/planning',{method:'POST',body:JSON.stringify(data)})}
async function updatePlanning(id,data){return api(`/planning/${id}`,{method:'PATCH',body:JSON.stringify(data)})}
async function deletePlanning(id){return api(`/planning/${id}`,{method:'DELETE'})}
async function getGoals(){return api('/goals')}
async function createGoal(data){return api('/goals',{method:'POST',body:JSON.stringify(data)})}
async function updateGoal(id,data){return api(`/goals/${id}`,{method:'PATCH',body:JSON.stringify(data)})}
async function deleteGoal(id){return api(`/goals/${id}`,{method:'DELETE'})}
async function getManagementReport(){return api('/reports/management')}
async function getAuditLogs(){return api('/reports/audit')}
