const jwt = require('jsonwebtoken');
const issuer = 'producao-consciente';
const audience = 'producao-consciente-api';
function secret(){
 const value=process.env.JWT_SECRET;
 return typeof value==='string'&&Buffer.byteLength(value)>=32&&!value.startsWith('troque-')?value:null;
}
function signSession(userId,hash){
 const key=secret();
 if(!key)throw Object.assign(new Error('Autenticação Bearer indisponível: configure JWT_SECRET com pelo menos 32 bytes.'),{status:503});
 return jwt.sign({sid:hash},key,{algorithm:'HS256',subject:String(userId),issuer,audience,expiresIn:'15m'});
}
function bearerSession(header){
 if(typeof header!=='string'||header.length>4096||!/^Bearer [^\s]+$/i.test(header)||!secret())return null;
 try{
  const value=jwt.verify(header.slice(7),secret(),{algorithms:['HS256'],issuer,audience,maxAge:'15m'});
  if(typeof value!=='object'||!/^\d+$/.test(value.sub)||!/^[a-f0-9]{64}$/.test(value.sid)||!Number.isInteger(value.exp))return null;
  return value.sid;
 }catch{return null}
}
module.exports={signSession,bearerSession};
