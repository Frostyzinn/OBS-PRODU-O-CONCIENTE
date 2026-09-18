const {randomBytes,createHash}=require('node:crypto');
const {signSession,bearerSession}=require('../utils/jwt');
const {get,run,transaction}=require('../db/database');
const production=process.env.NODE_ENV==='production';
const cookieName=production?'__Host-pc_session':'pc_session';
const cookieOptions={httpOnly:true,secure:production,sameSite:'strict',path:'/'};
function sessionHash(req){
 if(req.headers.authorization!==undefined)return bearerSession(req.headers.authorization);
 const values=String(req.headers.cookie||'').split(';').map(v=>v.trim()).filter(v=>v.startsWith(cookieName+'='));
 if(values.length!==1)return null;
 const token=values[0].slice(cookieName.length+1);
 return /^[a-f0-9]{64}$/.test(token)?createHash('sha256').update(token).digest('hex'):null;
}
async function issueSession(req,res,userId,expectedHash){
 const token=randomBytes(32).toString('hex'),hash=createHash('sha256').update(token).digest('hex');
 const bearer=req.body?.authMode==='bearer'?signSession(userId,hash):null;
 await transaction(async tx=>{
  const user=await tx.get('SELECT password_hash,status FROM users WHERE id=? FOR UPDATE',[userId]);
  if(!user||user.status!=='active'||user.password_hash!==expectedHash)throw Object.assign(new Error('A conta foi alterada. Entre novamente.'),{status:401});
  const previous=sessionHash(req);if(previous)await tx.run('DELETE FROM user_sessions WHERE token_hash=?',[previous]);
  await tx.run('DELETE FROM user_sessions WHERE expires_at<=UTC_TIMESTAMP() OR last_seen_at<=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 30 MINUTE)');
  await tx.run('INSERT INTO user_sessions(token_hash,user_id,expires_at,last_seen_at) VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 8 HOUR),UTC_TIMESTAMP())',[hash,userId]);
 });
 res.cookie(cookieName,token,{...cookieOptions,maxAge:8*60*60*1000});
 return bearer;
}
function clearSession(res){res.clearCookie(cookieName,cookieOptions)}
async function logout(req,res){const hash=sessionHash(req);if(hash)await run('DELETE FROM user_sessions WHERE token_hash=?',[hash]);clearSession(res)}
async function auth(req,res,next){
 try{
  const hash=sessionHash(req);if(!hash)return res.status(401).json({error:'Entre para acessar sua empresa.'});
  const u=await get(`SELECT u.id,u.name,u.email,u.company_id AS companyId,u.role,u.status,c.trade_name AS companyName,c.status AS companyStatus FROM user_sessions s JOIN users u ON u.id=s.user_id LEFT JOIN companies c ON c.id=u.company_id WHERE s.token_hash=? AND s.expires_at>UTC_TIMESTAMP() AND s.last_seen_at>DATE_SUB(UTC_TIMESTAMP(),INTERVAL 30 MINUTE)`,[hash]);
  if(!u){clearSession(res);return res.status(401).json({error:'Sessão expirada. Entre novamente.'})}
  if(u.status!=='active'||!u.companyId||u.companyStatus!=='active'){await logout(req,res);return res.status(403).json({error:'Acesso indisponível. Procure o administrador da empresa.'})}
  await run('UPDATE user_sessions SET last_seen_at=UTC_TIMESTAMP() WHERE token_hash=?',[hash]);
  req.user=u;req.sessionHash=hash;next();
 }catch(error){next(error)}
}
function requireRole(...roles){return(req,res,next)=>{if(!req.user?.companyId||!roles.includes(req.user.role))return res.status(403).json({error:'Você não tem permissão para esta ação.'});next()}}
module.exports={auth,requireRole,issueSession,logout,clearSession};
