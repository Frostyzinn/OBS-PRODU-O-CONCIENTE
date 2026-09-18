const helmet=require('helmet');
const {createHash}=require('node:crypto');
const {transaction,run}=require('../db/database');
let lastCleanup=0;
const production=process.env.NODE_ENV==='production';
const csp={defaultSrc:["'self'"],scriptSrc:["'self'"],scriptSrcAttr:["'none'"],styleSrc:["'self'","'unsafe-inline'"],imgSrc:["'self'",'data:'],fontSrc:["'self'"],connectSrc:["'self'"],objectSrc:["'none'"],frameAncestors:["'none'"],baseUri:["'none'"],formAction:["'self'"],upgradeInsecureRequests:production?[]:null};
function installSecurity(app){
 if(production&&(!process.env.APP_ORIGIN||!/^https:\/\/[^/]+$/.test(process.env.APP_ORIGIN)))throw new Error('APP_ORIGIN deve ser a origem HTTPS pública, sem barra final.');
 if(production&&process.env.MYSQL_AUTO_CREATE_DATABASE!=='false')throw new Error('Defina MYSQL_AUTO_CREATE_DATABASE=false em produção.');
 if(production&&process.env.MYSQL_SSL==='true'&&process.env.MYSQL_SSL_REJECT_UNAUTHORIZED==='false')throw new Error('A verificação do certificado MySQL é obrigatória em produção.');
 // Configure somente proxies conhecidos; não confiar indiscriminadamente em X-Forwarded-For.
 if(process.env.TRUST_PROXY)app.set('trust proxy',process.env.TRUST_PROXY.split(',').map(s=>s.trim()));
 app.use(helmet({xFrameOptions:{action:"deny"},contentSecurityPolicy:{directives:csp},strictTransportSecurity:production?{maxAge:31536000,includeSubDomains:true}:false,referrerPolicy:{policy:'no-referrer'}}));
 app.use((req,res,next)=>{res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=(), payment=()');next()});
 app.use('/api',(req,res,next)=>{
  res.setHeader('Cache-Control','no-store');
  const origin=req.headers.origin;
  const allowed=process.env.APP_ORIGIN||`${req.protocol}://${req.get('host')}`;
  if(origin&&origin!==allowed)return res.status(403).json({error:'Origem da requisição não autorizada.'});
  if(req.headers['sec-fetch-site']==='cross-site')return res.status(403).json({error:'Requisição entre sites bloqueada.'});
  if(!['GET','HEAD','OPTIONS'].includes(req.method)){
   if(req.get('X-PC-Request')!=='1')return res.status(403).json({error:'Requisição inválida. Atualize a página.'});
   if(!/^application\/json(?:;|$)/i.test(req.get('content-type')||''))return res.status(415).json({error:'Envie os dados como JSON.'});
  }
  next();
 });
}
// Contadores no MySQL: limite compartilhado por todas as instâncias do servidor.
function rateLimit(scope,limit,seconds,key=req=>req.ip){
 return async(req,res,next)=>{
  try{
   if(Date.now()-lastCleanup>60000){lastCleanup=Date.now();await run('DELETE FROM security_rate_limits WHERE expires_at<=UTC_TIMESTAMP() LIMIT 1000');}
   const bucket=createHash('sha256').update(scope+':'+key(req)).digest('hex');
   const allowed=await transaction(async tx=>{
    await tx.run('INSERT INTO security_rate_limits(bucket,hits,expires_at) VALUES(?,0,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE hits=hits',[bucket]);
    const row=await tx.get('SELECT hits,expires_at<=UTC_TIMESTAMP() AS expired FROM security_rate_limits WHERE bucket=? FOR UPDATE',[bucket]);
    if(!row.expired&&row.hits>=limit)return false;
    await tx.run('UPDATE security_rate_limits SET hits=?,expires_at=IF(?=1,DATE_ADD(UTC_TIMESTAMP(),INTERVAL ? SECOND),expires_at) WHERE bucket=?',[row.expired?1:row.hits+1,Number(row.expired),seconds,bucket]);
    return true;
   });
   if(!allowed){res.setHeader('Retry-After',String(seconds));return res.status(429).json({error:'Muitas tentativas. Aguarde alguns minutos e tente novamente.'})}
   next();
  }catch(err){next(err)}
 };
}
const numeric=new Set(['quantity','qty','unitCost','currentProduction','plannedQuantity','producedQuantity','minStock','currentStock','quantityPerProduct','wastePercent','waste','averageVolume','targetValue','currentValue','targetSales','energyPerUnit','energyCost']);
const arrayKeys=new Set(['ingredients','materials','rows','history']);
function validateBody(req,res,next){
 try{
  if(req.body===undefined)return next();
  function visit(value,key='',depth=0){
   if(depth>4)throw Error('Estrutura de dados inválida.');
   if(['__proto__','constructor','prototype'].includes(key))throw Error('Campo inválido.');
   if(numeric.has(key)&&(value===null||value===''||!['string','number'].includes(typeof value)||!Number.isFinite(Number(value))||Number(value)<0||Number(value)>1e12))throw Error('Quantidade ou custo inválido.');
   if(['productId','rawMaterialId'].includes(key)&&value!==null&&(!Number.isSafeInteger(Number(value))||Number(value)<=0))throw Error('Identificador inválido.');
   if(key==='period'&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(value))throw Error('Informe o período no formato AAAA-MM.');
   if(key==='plannedDate'&&value&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value))throw Error('Data inválida.');
   if(key==='monthsN'&&(!Number.isInteger(Number(value))||value<1||value>6))throw Error('Número de meses inválido.');
   if(key==='metric'&&!['production','sales','saving','waste'].includes(value))throw Error('Indicador inválido.');
   if(typeof value==='string'&&(value.length>255||value.includes('\0')))throw Error('Texto muito longo ou inválido.');
   if(Array.isArray(value)){
    if(!arrayKeys.has(key)||value.length>(key==='rows'?500:key==='history'?6:100))throw Error('Lista muito grande ou inválida.');
    value.forEach(v=>{if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Item inválido.');visit(v,'',depth+1)});return;
   }
   if(value&&typeof value==='object'){
    if(key)throw Error('Valor inválido para '+key+'.');
    for(const [k,v] of Object.entries(value))visit(v,k,depth+1);
   }
  }
  if(!req.body||Array.isArray(req.body)||typeof req.body!=='object')throw Error('Envie um objeto JSON.');
  visit(req.body);next();
 }catch(err){res.status(400).json({error:err.message})}
}
function validPassword(value){return typeof value==='string'&&value.length>=12&&Buffer.byteLength(value,'utf8')<=72&&!/^(.)\1+$/.test(value)}
function validEmail(value){return typeof value==='string'&&value.length<=190&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)}
module.exports={installSecurity,rateLimit,validateBody,validPassword,validEmail,csp};
