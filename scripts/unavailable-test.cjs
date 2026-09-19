const assert=require('node:assert/strict');
const db=require('../db/database');let attempts=0;
db.initDatabase=async()=>{attempts++;throw Object.assign(new Error('Simulated outage'),{code:'ECONNREFUSED'});};
const handler=require('../api/index');
const server=require('node:http').createServer(handler);
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  for(const [url,headers,status] of [
    ['/api/health',{},200],
    ['/api/v1/auth/me',{},401],
    ['/api/v1/auth/me',{Authorization:'Bearer invalido'},401],
    ['/api/v1/auth/me',{Cookie:'pc_session='+'a'.repeat(64)},503]
  ]){
    const res=await fetch(origin+url,{headers});assert.equal(res.status,status);assert.match(res.headers.get('content-type'),/application\/json/);
    const body=await res.json();if(status===503)assert.equal(body.code,'DATABASE_UNAVAILABLE');else assert.equal(attempts,0);
  }
  console.log('4 verificações com MySQL indisponível passaram: health 200, credenciais ausentes/inválidas 401, consulta de sessão 503 JSON.');
})().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>server.close());
