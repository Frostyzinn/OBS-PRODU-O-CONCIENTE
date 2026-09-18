const router=require('express').Router();
const {get,all,transaction}=require('../db/database');
const {auth,requireRole}=require('../middleware/auth');
const ah=require('../utils/asyncHandler');
const {companyId,audit}=require('../utils/tenant');
router.use(auth,requireRole('admin'));
function fail(message,status=400){throw Object.assign(new Error(message),{status})}
async function lockCompany(tx,req){
 await tx.get('SELECT id FROM companies WHERE id=? FOR UPDATE',[companyId(req)]);
 const actor=await tx.get('SELECT role,status FROM users WHERE id=? AND company_id=?',[req.user.id,companyId(req)]);
 if(!actor||actor.role!=='admin'||actor.status!=='active')fail('Acesso administrativo indisponível.',403);
}
router.get('/',ah(async(req,res)=>res.json(await all("SELECT id,name,email,role,status,created_at AS createdAt FROM users WHERE company_id=? ORDER BY FIELD(role,'admin','production','commercial','viewer'),name",[companyId(req)]))));
router.get('/requests',ah(async(req,res)=>res.json(await all("SELECT r.id,r.requested_role AS requestedRole,r.requested_at AS requestedAt,u.name,u.email FROM company_join_requests r JOIN users u ON u.id=r.user_id WHERE r.company_id=? AND r.status='pending' ORDER BY r.requested_at DESC",[companyId(req)]))));
router.patch('/requests/:id',ah(async(req,res)=>{
 const action=req.body.action,cid=companyId(req);if(!['approve','reject'].includes(action))fail('Ação inválida.');
 await transaction(async tx=>{
  await lockCompany(tx,req);
  const r=await tx.get("SELECT * FROM company_join_requests WHERE id=? AND company_id=? AND status='pending' FOR UPDATE",[req.params.id,cid]);
  if(!r)fail('Solicitação não encontrada.',404);
  await tx.run('UPDATE users SET status=?,role=? WHERE id=? AND company_id=?',[action==='approve'?'active':'blocked',r.requested_role,r.user_id,cid]);
  await tx.run('DELETE FROM user_sessions WHERE user_id=?',[r.user_id]);
  await tx.run('UPDATE company_join_requests SET status=?,decided_at=NOW(),decided_by=? WHERE id=?',[action==='approve'?'approved':'rejected',req.user.id,r.id]);
 });
 await audit(req,action,'join_request',Number(req.params.id));res.json({ok:true});
}));
router.patch('/:id',ah(async(req,res)=>{
 const id=Number(req.params.id),role=req.body.role,cid=companyId(req);
 if(!['admin','production','commercial','viewer'].includes(role))fail('Perfil inválido.');
 if(id===Number(req.user.id)&&role!=='admin')fail('Você não pode remover seu próprio perfil de administrador.');
 await transaction(async tx=>{
  await lockCompany(tx,req);
  const u=await tx.get('SELECT id,role FROM users WHERE id=? AND company_id=? FOR UPDATE',[id,cid]);if(!u)fail('Usuário não encontrado.',404);
  if(role!=='admin'&&u.role==='admin'){
   const count=await tx.get("SELECT COUNT(*) total FROM users WHERE company_id=? AND role='admin' AND status='active'",[cid]);if(Number(count.total)<=1)fail('A empresa precisa manter um administrador ativo.');
  }
  await tx.run('UPDATE users SET role=? WHERE id=? AND company_id=?',[role,id,cid]);
  if(role!==u.role)await tx.run('DELETE FROM user_sessions WHERE user_id=?',[id]);
 });
 await audit(req,'update','user',id,{role});res.json({ok:true});
}));
router.delete('/:id',ah(async(req,res)=>{
 const id=Number(req.params.id),cid=companyId(req);if(id===Number(req.user.id))fail('Você não pode bloquear sua própria conta.');
 await transaction(async tx=>{
  await lockCompany(tx,req);
  const u=await tx.get('SELECT role FROM users WHERE id=? AND company_id=? FOR UPDATE',[id,cid]);if(!u)fail('Usuário não encontrado.',404);
  if(u.role==='admin'){
   const count=await tx.get("SELECT COUNT(*) total FROM users WHERE company_id=? AND role='admin' AND status='active'",[cid]);if(Number(count.total)<=1)fail('A empresa precisa manter um administrador ativo.');
  }
  await tx.run("UPDATE users SET status='blocked' WHERE id=? AND company_id=?",[id,cid]);
  await tx.run('DELETE FROM user_sessions WHERE user_id=?',[id]);
 });
 await audit(req,'block','user',id);res.status(204).end();
}));
module.exports=router;
