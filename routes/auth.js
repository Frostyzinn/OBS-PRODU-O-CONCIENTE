const router=require('express').Router();
const bcrypt=require('bcryptjs');
const {get,run,transaction}=require('../db/database');
const {auth,issueSession,logout,clearSession}=require('../middleware/auth');
const {rateLimit,validPassword,validEmail}=require('../middleware/security');
const ah=require('../utils/asyncHandler');
const {audit}=require('../utils/tenant');
const dummyHash=bcrypt.hashSync('invalid-account-comparison-only',12);
function publicUser(u){return{id:u.id,name:u.name,companyName:u.companyName,email:u.email,companyId:u.companyId??u.company_id,role:u.role,status:u.status}}
const sensitive=rateLimit('account-actions',12,900,req=>String(req.user.id));
router.post('/login',rateLimit('login-ip',30,900),rateLimit('login-account',10,900,req=>String(req.body.email||'').trim().toLowerCase()),ah(async(req,res)=>{
 const email=String(req.body.email||'').trim().toLowerCase(),password=req.body.password;
 if(!validEmail(email)||typeof password!=='string'||Buffer.byteLength(password)>72)return res.status(401).json({error:'E-mail ou senha inválidos.'});
 const u=await get('SELECT u.*,c.trade_name AS companyName,c.status AS companyStatus FROM users u LEFT JOIN companies c ON c.id=u.company_id WHERE u.email=?',[email]);
 const matches=await bcrypt.compare(password,u?.password_hash||dummyHash);
 if(!u||!matches)return res.status(401).json({error:'E-mail ou senha inválidos.'});
 if(u.status!=='active'||!u.company_id||u.companyStatus!=='active')return res.status(403).json({error:'Acesso indisponível. Procure o administrador da empresa.'});
 const token=await issueSession(req,res,u.id,u.password_hash);req.user=publicUser(u);await audit(req,'login','user',u.id);
 res.json({user:publicUser(u),...(token?{token}: {})});
}));
router.post('/logout',ah(async(req,res)=>{await logout(req,res);res.status(204).end()}));
router.get('/me',auth,ah(async(req,res)=>{
 const u=await get('SELECT u.id,u.name,u.email,u.company_id AS companyId,u.role,u.status,c.trade_name AS companyName,c.cnpj,c.legal_name AS legalName FROM users u JOIN companies c ON c.id=u.company_id WHERE u.id=?',[req.user.id]);
 res.json({user:publicUser(u),company:{id:u.companyId,cnpj:u.cnpj,legalName:u.legalName,tradeName:u.companyName}});
}));
router.put('/password',auth,sensitive,ah(async(req,res)=>{
 const current=req.body.currentPassword,nextPassword=req.body.newPassword;
 if(!validPassword(nextPassword))return res.status(400).json({error:'Use uma senha com pelo menos 12 caracteres e no máximo 72 bytes.'});
 const u=await get('SELECT password_hash FROM users WHERE id=?',[req.user.id]);
 if(typeof current!=='string'||Buffer.byteLength(current)>72||!await bcrypt.compare(current,u.password_hash))return res.status(400).json({error:'Senha atual incorreta.'});
 const hash=await bcrypt.hash(nextPassword,12);
 await transaction(async tx=>{
  const fresh=await tx.get('SELECT password_hash FROM users WHERE id=? FOR UPDATE',[req.user.id]);
  if(fresh.password_hash!==u.password_hash)throw Object.assign(new Error('A conta foi alterada. Entre novamente.'),{status:409});
  await tx.run('UPDATE users SET password_hash=? WHERE id=?',[hash,req.user.id]);
  await tx.run('DELETE FROM user_sessions WHERE user_id=?',[req.user.id]);
 });
 clearSession(res);await audit(req,'password_change','user',req.user.id);res.json({ok:true,message:'Senha alterada. Entre novamente em seus dispositivos.'});
}));
router.put('/me',auth,sensitive,ah(async(req,res)=>{
 const name=String(req.body.name||'').trim(),email=String(req.body.email||'').trim().toLowerCase();
 if(!name||name.length>120||!validEmail(email))return res.status(400).json({error:'Informe nome e e-mail válidos.'});
 const u=await get('SELECT password_hash,email FROM users WHERE id=?',[req.user.id]);
 if(email!==u.email&&(typeof req.body.currentPassword!=='string'||Buffer.byteLength(req.body.currentPassword)>72||!await bcrypt.compare(req.body.currentPassword,u.password_hash)))return res.status(400).json({error:'Confirme a senha atual para alterar seu e-mail.'});
 if(await get('SELECT id FROM users WHERE email=? AND id<>?',[email,req.user.id]))return res.status(409).json({error:'Não foi possível usar este e-mail.'});
 await transaction(async tx=>{
  const fresh=await tx.get('SELECT password_hash FROM users WHERE id=? FOR UPDATE',[req.user.id]);
  if(fresh.password_hash!==u.password_hash)throw Object.assign(new Error('A conta foi alterada. Entre novamente.'),{status:409});
  await tx.run('UPDATE users SET name=?,email=? WHERE id=?',[name,email,req.user.id]);
  if(email!==u.email)await tx.run('DELETE FROM user_sessions WHERE user_id=? AND token_hash<>?',[req.user.id,req.sessionHash]);
 });
 await audit(req,'update','user',req.user.id);res.json({user:publicUser({...req.user,name,email})});
}));
module.exports={router,publicUser};
