// Integração de segurança em banco isolado; não executa contra a base da empresa.
process.env.MYSQL_DATABASE='pc_revisao_20260918';
const assert=require('node:assert/strict');
const bcrypt=require('bcryptjs');
const {randomBytes,createHash}=require('node:crypto');
const db=require('../db/database');
const app=require('../server');
let server,origin,checks=0;const companies=[];
const password='Teste-seguro-'+randomBytes(12).toString('hex');
function client(){return{cookie:''}}
async function call(c,path,method='GET',body,expected=200,extra={}){
 const response=await fetch(origin+'/api/v1'+path,{method,headers:{'Content-Type':'application/json','X-PC-Request':'1',...(c.cookie?{Cookie:c.cookie}:{}),...extra},...(body!==undefined?{body:typeof body==='string'?body:JSON.stringify(body)}:{})});
 const cookie=response.headers.get('set-cookie');if(cookie)c.cookie=cookie.split(';')[0];
 const text=await response.text();assert.equal(response.status,expected,method+' '+path+': '+text);checks++;
 let data;try{data=JSON.parse(text)}catch{data=text}return{response,data,cookie};
}
async function fixture(role,company){
 const email='security-'+randomBytes(8).toString('hex')+'@example.test';
 if(!company){company=(await db.run('INSERT INTO companies(legal_name,trade_name) VALUES(?,?)',['Teste isolado','Teste isolado'])).id;companies.push(company)}
 const hash=await bcrypt.hash(password,12);
 const user=await db.run("INSERT INTO users(name,email,password_hash,company_id,role,status) VALUES(?,?,?,?,?,'active')",['Usuário teste',email,hash,company,role]);
 const c=client();const login=await call(c,'/auth/login','POST',{email,password});
 assert.equal(login.data.token,undefined);assert.match(login.cookie,/HttpOnly/i);assert.match(login.cookie,/SameSite=Strict/i);assert.match(login.cookie,/Path=\//i);checks+=4;
 return{...c,userId:user.id,email,company};
}
(async()=>{
 assert.notEqual(process.env.NODE_ENV,'production');assert.equal(db.DB_NAME,'pc_revisao_20260918');await db.initDatabase();
 server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));origin='http://127.0.0.1:'+server.address().port;
 const admin=await fixture('admin'),other=await fixture('admin'),viewer=await fixture('viewer',admin.company);
 const {response:headers}=await call(admin,'/auth/me');assert.equal(headers.headers.get('cache-control'),'no-store');assert.equal(headers.headers.get('x-frame-options'),'DENY');assert.match(headers.headers.get('content-security-policy'),/script-src 'self'/);assert.equal(headers.headers.get('x-content-type-options'),'nosniff');checks+=4;
 await call(client(),'/products','GET',undefined,401);
 await call(admin,'/products','POST',{name:'csrf'},403,{'X-PC-Request':''});
 await call(admin,'/products','POST',{name:'csrf'},403,{Origin:'https://hostile.example'});
 await call(admin,'/products','POST',{name:'csrf'},403,{'Sec-Fetch-Site':'cross-site'});
 await call(admin,'/products','POST',{name:'wrong type'},415,{'Content-Type':'text/plain'});
 await call(admin,'/products','POST','{invalid',400);
 await call(admin,'/products','POST',{name:{injection:true}},400);
 await call(admin,'/products','POST',JSON.stringify({name:'x',prototype:{polluted:true}}),400);
 await call(admin,'/products','POST',{name:'negative',unitCost:-1},400);
 await call(admin,'/planning','POST',{productId:1,period:'2026-99'},400);
 await call(admin,'/goals','POST',{title:'XSS',metric:'<img src=x onerror=alert(1)>',period:'2026-09'},400);
 const material=(await call(admin,'/stock','POST',{name:'Insumo isolado',currentStock:100},201)).data;
 const product=(await call(admin,'/products','POST',{name:'Produto isolado',ingredients:[{rawMaterialId:material.id,name:'Insumo',quantityPerProduct:1}]},201)).data;
 await call(other,'/products/'+product.id,'GET',undefined,404);
 await call(other,'/products/'+product.id,'PUT',{name:'Ataque'},404);
 await call(other,'/products','POST',{name:'Ataque',ingredients:[{rawMaterialId:material.id,name:'Insumo'}]},400);
 await call(other,'/stock/'+material.id+'/movements','POST',{type:'out',quantity:5},404);
 await call(viewer,'/products','POST',{name:'Ataque'},403);await call(viewer,'/team','GET',undefined,403);
 await call(other,'/team/'+viewer.userId,'PATCH',{role:'admin'},404);
 // Revogação na mudança de perfil e no bloqueio.
 const stolenViewer={cookie:viewer.cookie};await call(admin,'/team/'+viewer.userId,'PATCH',{role:'production'});await call(stolenViewer,'/auth/me','GET',undefined,401);
 await call(viewer,'/auth/login','POST',{email:viewer.email,password});const blocked={cookie:viewer.cookie};await call(admin,'/team/'+viewer.userId,'DELETE',undefined,204);await call(blocked,'/auth/me','GET',undefined,401);
 // Logout invalida o cookie, não apenas o apaga no navegador.
 const oldOther={cookie:other.cookie};await call(other,'/auth/logout','POST',{} ,204);await call(oldOther,'/auth/me','GET',undefined,401);
 await call(other,'/auth/login','POST',{email:other.email,password});
 await call(other,'/auth/me','PUT',{name:'Alterado',email:'changed@example.test'},400);
 await call(other,'/auth/password','PUT',{currentPassword:password,newPassword:'123456'},400);
 const second=client();await call(second,'/auth/login','POST',{email:other.email,password});const first={cookie:other.cookie};
 await call(other,'/auth/password','PUT',{currentPassword:password,newPassword:password+'-nova'});await call(first,'/auth/me','GET',undefined,401);await call(second,'/auth/me','GET',undefined,401);
 await call(other,'/auth/login','POST',{email:other.email,password},401);await call(other,'/auth/login','POST',{email:other.email,password:password+'-nova'});
 // Expiração inativa e absoluta impostas no servidor.
 await db.run('UPDATE user_sessions SET last_seen_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 31 MINUTE) WHERE user_id=?',[other.userId]);await call(other,'/auth/me','GET',undefined,401);
 await call(other,'/auth/login','POST',{email:other.email,password:password+'-nova'});
 await db.run('UPDATE user_sessions SET expires_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 SECOND) WHERE user_id=?',[other.userId]);await call(other,'/auth/me','GET',undefined,401);
 // Tentativas por conta são compartilhadas no banco, inclusive em várias instâncias.
 const bad=client(),email='missing-'+randomBytes(4).toString('hex')+'@example.test';
 for(let i=0;i<10;i++)await call(bad,'/auth/login','POST',{email,password:'senha-incorreta'},401);
 const limited=await call(bad,'/auth/login','POST',{email,password:'senha-incorreta'},429);assert.ok(limited.response.headers.get('retry-after'));checks++;
 console.log(checks+' verificações de segurança passaram: cookies, CSRF, isolamento, permissões, revogação, expiração, senha e limites.');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{
 // Somente os dados sintéticos criados por este script, identificados pelos IDs acima.
 for(const cid of companies){await db.run('DELETE FROM products WHERE company_id=?',[cid]);await db.run('DELETE FROM users WHERE company_id=?',[cid]);await db.run('DELETE FROM companies WHERE id=?',[cid]);}
 for(const value of ['login-ip:127.0.0.1','api-ip:127.0.0.1'])await db.run('DELETE FROM security_rate_limits WHERE bucket=?',[createHash('sha256').update(value).digest('hex')]);
 if(server)await new Promise(resolve=>server.close(resolve));await db.close();
});
