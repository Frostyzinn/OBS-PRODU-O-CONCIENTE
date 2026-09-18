const router=require('express').Router();
const {run,all,get,transaction}=require('../db/database');
const {auth,requireRole}=require('../middleware/auth');
const ah=require('../utils/asyncHandler');
const {companyId,audit}=require('../utils/tenant');

router.get('/',auth,ah(async(req,res)=>{
 const rows=await all(`SELECT id,name,unit,min_stock AS minStock,current_stock AS currentStock,unit_cost AS unitCost,updated_at AS updatedAt,
 CASE WHEN current_stock<=min_stock THEN 'low' ELSE 'ok' END AS stockStatus FROM raw_materials WHERE company_id=? ORDER BY name`,[companyId(req)]);
 res.json(rows.map(r=>({...r,id:Number(r.id),minStock:Number(r.minStock),currentStock:Number(r.currentStock),unitCost:Number(r.unitCost)})));
}));
router.post('/',auth,requireRole('admin','production'),ah(async(req,res)=>{
 const b=req.body||{}, name=String(b.name||'').trim(), unit=String(b.unit||'kg').trim();
 if(!name)return res.status(400).json({error:'Informe o nome da matéria-prima.'});
 const r=await run('INSERT INTO raw_materials(company_id,name,unit,min_stock,current_stock,unit_cost) VALUES(?,?,?,?,?,?)',[companyId(req),name,unit,Number(b.minStock)||0,Number(b.currentStock)||0,Number(b.unitCost)||0]);
 await audit(req,'create','raw_material',r.id,{name}); res.status(201).json({id:r.id});
}));
router.put('/:id',auth,requireRole('admin','production'),ah(async(req,res)=>{
 const id=Number(req.params.id), b=req.body||{}; const row=await get('SELECT id FROM raw_materials WHERE id=? AND company_id=?',[id,companyId(req)]); if(!row)return res.status(404).json({error:'Matéria-prima não encontrada'});
 await run('UPDATE raw_materials SET name=?,unit=?,min_stock=?,unit_cost=? WHERE id=? AND company_id=?',[String(b.name||'').trim(),String(b.unit||'kg').trim(),Number(b.minStock)||0,Number(b.unitCost)||0,id,companyId(req)]);
 await audit(req,'update','raw_material',id,{name:b.name});res.json({ok:true});
}));
router.delete('/:id',auth,requireRole('admin','production'),ah(async(req,res)=>{const id=Number(req.params.id);const r=await run('DELETE FROM raw_materials WHERE id=? AND company_id=?',[id,companyId(req)]);if(!r.changes)return res.status(404).json({error:'Matéria-prima não encontrada'});await audit(req,'delete','raw_material',id);res.json({ok:true})}));
router.post('/:id/movements',auth,requireRole('admin','production'),ah(async(req,res)=>{
 const id=Number(req.params.id), type=['in','out','adjustment'].includes(req.body?.type)?req.body.type:'in', qty=Number(req.body?.quantity);
 if(!Number.isFinite(qty)||qty<=0)return res.status(400).json({error:'Quantidade inválida.'});
 const mtype=type==='adjustment'?'adjustment':type; const cid=companyId(req);
 const rm=await get('SELECT id,current_stock FROM raw_materials WHERE id=? AND company_id=?',[id,cid]);if(!rm)return res.status(404).json({error:'Matéria-prima não encontrada'});
 const delta=mtype==='out'?-qty:qty; const next=Number(rm.current_stock)+delta; if(next<0)return res.status(400).json({error:'Estoque insuficiente.'});
 await transaction(async tx=>{await tx.run('INSERT INTO stock_movements(company_id,raw_material_id,user_id,type,quantity,balance_after,reference,note) VALUES(?,?,?,?,?,?,?,?)',[cid,id,req.user.id,mtype,qty,next,String(req.body?.reference||''),String(req.body?.note||'')]);await tx.run('UPDATE raw_materials SET current_stock=? WHERE id=? AND company_id=?',[next,id,cid])});
 await audit(req,'movement','stock',id,{type:mtype,quantity:qty,balanceAfter:next});res.status(201).json({ok:true,balanceAfter:next});
}));
router.get('/movements',auth,ah(async(req,res)=>{const rows=await all(`SELECT sm.id,sm.raw_material_id AS rawMaterialId,rm.name,sm.type,sm.quantity,sm.balance_after AS balanceAfter,sm.reference,sm.note,sm.created_at AS createdAt,u.name AS userName FROM stock_movements sm JOIN raw_materials rm ON rm.id=sm.raw_material_id JOIN users u ON u.id=sm.user_id WHERE sm.company_id=? ORDER BY sm.created_at DESC LIMIT 300`,[companyId(req)]);res.json(rows.map(r=>({...r,id:Number(r.id),quantity:Number(r.quantity),balanceAfter:Number(r.balanceAfter)})))}));
module.exports=router;
