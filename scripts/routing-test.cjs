// Executa o entrypoint serverless real em HTTP, com banco local isolado.
process.env.MYSQL_DATABASE='pc_revisao_20260918';
process.env.JWT_SECRET=require('node:crypto').randomBytes(48).toString('hex');
const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const express=require('express');const bcrypt=require('bcryptjs');const jwt=require('jsonwebtoken');
const db=require('../db/database');
const init=db.initDatabase;let initializations=0;
db.initDatabase=async(...args)=>{initializations++;return init(...args)};
const handler=require('../api/index');
const config=require('../vercel.json');
let server,origin,company,user,count=0;
(async()=>{
 assert.notEqual(process.env.NODE_ENV,'production');assert.equal(db.DB_NAME,'pc_revisao_20260918');
 assert.deepEqual(config.rewrites,[{source:'/api/:path*',destination:'/api/index'}]);
 assert.deepEqual(Object.keys(config.functions),['api/index.js']);
 assert.equal(typeof handler,'function');
 const edge=express();
 // Simula a seleção do destino pela regra da Vercel, preservando a URL original.
 edge.use((req,res,next)=>/^\/api(?:\/|$)/.test(req.url)?handler(req,res):next());
 edge.use(express.static(path.join(__dirname,'../public')));
 server=edge.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));origin='http://127.0.0.1:'+server.address().port;
 async function request(url,status,options={}){
  const response=await fetch(origin+url,options);assert.equal(response.status,status,url);count++;
  if(url.startsWith('/api/')&&status!==204)assert.match(response.headers.get('content-type'),/application\/json/);
  return response;
 }
 await request('/api/health',200);assert.equal(initializations,0,'Liveness não depende do MySQL');
 await request('/api/v1/auth/me',401);assert.equal(initializations,0);
 await request('/api/v1/auth/me',401,{headers:{Authorization:'Bearer invalido'}});
 await request('/api/v1/nao-existe',404);
 await request('/api/v1/nao-existe',404,{method:'POST',headers:{'Content-Type':'application/json','X-PC-Request':'1'},body:'{}'});
 for(const url of ['/index.html','/login.html','/css/professional.css','/js/data.js','/assets/logo-producao-consciente.png'])await request(url,200);
 const email='routing-'+Date.now()+'@example.test',password=require('node:crypto').randomBytes(20).toString('hex');
 company=(await db.run('INSERT INTO companies(legal_name,trade_name) VALUES(?,?)',['Teste de roteamento','Teste API'])).id;
 user=(await db.run("INSERT INTO users(name,email,password_hash,company_id,role,status) VALUES(?,?,?,?,?,'active')",['Teste API',email,await bcrypt.hash(password,12),company,'admin'])).id;
 const login=await request('/api/v1/auth/login',200,{method:'POST',headers:{'Content-Type':'application/json','X-PC-Request':'1'},body:JSON.stringify({email,password,authMode:'bearer'})});
 const cookie=login.headers.get('set-cookie').split(';')[0],{token}=await login.json();assert.equal(typeof token,'string');
 const result=await request('/api/v1/auth/me?teste=1',200,{headers:{Authorization:'Bearer '+token}});
 assert.equal((await result.json()).user.id,user);
 await request('/api/v1/auth/me',200,{headers:{Cookie:cookie}});
 const claims=jwt.decode(token);delete claims.iat;delete claims.exp;
 const expired=jwt.sign(claims,process.env.JWT_SECRET,{expiresIn:-1});
 await request('/api/v1/auth/me',401,{headers:{Authorization:'Bearer '+expired}});
 const forged=jwt.sign(claims,require('node:crypto').randomBytes(48).toString('hex'),{expiresIn:900});
 await request('/api/v1/auth/me',401,{headers:{Authorization:'Bearer '+forged,Cookie:cookie}});
 await request('/api/v1/auth/logout',204,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','X-PC-Request':'1'},body:'{}'});
 await request('/api/v1/auth/me',401,{headers:{Authorization:'Bearer '+token}});
 await request('/api/v1/auth/me',401,{headers:{Cookie:cookie}});
 assert.equal(initializations,1,'Reutiliza a inicialização serverless');
 console.log(count+' requisições passaram pelo entrypoint serverless: health 200, me sem token/inválido 401, JWT e cookie válidos 200, logout revogado, estáticos 200.');
})().catch(err=>{console.error(err);process.exitCode=1}).finally(async()=>{
 if(user)await db.run('DELETE FROM users WHERE id=?',[user]);if(company)await db.run('DELETE FROM companies WHERE id=?',[company]);
 if(server)await new Promise(resolve=>server.close(resolve));await db.close();
});
