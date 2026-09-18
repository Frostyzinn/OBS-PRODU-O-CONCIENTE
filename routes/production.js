const router=require('express').Router();
const {run,all,get,transaction}=require('../db/database');
const {auth,requireRole}=require('../middleware/auth');
const ah=require('../utils/asyncHandler');
const {companyId,audit}=require('../utils/tenant');
const cid=req=>companyId(req);
router.get('/orders',auth,ah(async(req,res)=>{const rows=await all(`SELECT o.id,o.order_number AS orderNumber,o.product_id AS productId,p.name AS productName,o.planned_quantity AS plannedQuantity,o.produced_quantity AS producedQuantity,o.status,o.planned_date AS plannedDate,o.started_at AS startedAt,o.completed_at AS completedAt,o.note,o.created_at AS createdAt FROM production_orders o JOIN products p ON p.id=o.product_id WHERE o.company_id=? ORDER BY o.planned_date DESC,o.id DESC LIMIT 200`,[cid(req)]);res.json(rows.map(r=>({...r,id:Number(r.id),productId:Number(r.productId),plannedQuantity:Number(r.plannedQuantity),producedQuantity:Number(r.producedQuantity)})))}));
router.post('/orders',auth,requireRole('admin','production'),ah(async(req,res)=>{const b=req.body||{}, productId=Number(b.productId), planned=Number(b.plannedQuantity);if(!productId||!Number.isFinite(planned)||planned<=0)return res.status(400).json({error:'Produto e quantidade planejada são obrigatórios.'});const p=await get('SELECT id FROM products WHERE id=? AND company_id=?',[productId,cid(req)]);if(!p)return res.status(404).json({error:'Produto não encontrado'});const orderNumber=`OP-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(Math.random()*9000+1000)}`;const r=await run(`INSERT INTO production_orders(company_id,user_id,product_id,order_number,planned_quantity,planned_date,note) VALUES(?,?,?,?,?,?,?)`,[cid(req),req.user.id,productId,orderNumber,planned,b.plannedDate||new Date().toISOString().slice(0,10),String(b.note||'')]);await audit(req,'create','production_order',r.id,{orderNumber});res.status(201).json({id:r.id,orderNumber})}));
router.patch('/orders/:id',auth,requireRole('admin','production'),ah(async(req,res)=>{
 const id=Number(req.params.id),b=req.body||{},c=cid(req);
 const allowed=['planned','in_progress','completed','cancelled'];
 if(b.status!==undefined&&!allowed.includes(b.status))return res.status(400).json({error:'Status inválido.'});
 const produced=b.producedQuantity===undefined?null:Number(b.producedQuantity);
 if(produced!==null&&(!Number.isFinite(produced)||produced<0))return res.status(400).json({error:'Quantidade produzida inválida.'});
 const status=await transaction(async tx=>{
  const o=await tx.get('SELECT * FROM production_orders WHERE id=? AND company_id=? FOR UPDATE',[id,c]);
  if(!o)throw Object.assign(new Error('Ordem não encontrada'),{status:404});
  if(['completed','cancelled'].includes(o.status))throw Object.assign(new Error('Uma ordem finalizada não pode ser alterada.'),{status:409});
  const next=b.status||o.status;
  if(next==='completed'){
   if(!produced)throw Object.assign(new Error('Informe a quantidade efetivamente produzida para concluir a OP.'),{status:400});
   const ingredients=await tx.all('SELECT raw_material_id AS rawMaterialId,name,quantity_per_product AS quantityPerProduct,waste_percent AS wastePercent FROM product_ingredients WHERE product_id=? ORDER BY raw_material_id',[o.product_id]);
   for(const i of ingredients){
    if(!i.rawMaterialId)continue;
    const required=Number(i.quantityPerProduct)*produced*(1+Number(i.wastePercent)/100);
    if(required<=0)continue;
    const rm=await tx.get('SELECT id,current_stock FROM raw_materials WHERE id=? AND company_id=? FOR UPDATE',[i.rawMaterialId,c]);
    if(!rm)throw Object.assign(new Error('Matéria-prima vinculada indisponível.'),{status:400});
    if(Number(rm.current_stock)<required)throw Object.assign(new Error('Estoque insuficiente para '+i.name+'. Necessário '+required.toFixed(3)+'.'),{status:400});
    const balance=Number(rm.current_stock)-required;
    await tx.run('UPDATE raw_materials SET current_stock=? WHERE id=? AND company_id=?',[balance,rm.id,c]);
    await tx.run('INSERT INTO stock_movements(company_id,raw_material_id,user_id,type,quantity,balance_after,reference,note) VALUES(?,?,?,?,?,?,?,?)',[c,rm.id,req.user.id,'out',required,balance,o.order_number,'Consumo automático da OP concluída']);
   }
   await tx.run('UPDATE products SET current_production=current_production+? WHERE id=? AND company_id=?',[produced,o.product_id,c]);
  }
  await tx.run("UPDATE production_orders SET status=?,produced_quantity=COALESCE(?,produced_quantity),started_at=CASE WHEN ?='in_progress' AND started_at IS NULL THEN CURRENT_TIMESTAMP ELSE started_at END,completed_at=CASE WHEN ?='completed' THEN CURRENT_TIMESTAMP ELSE completed_at END WHERE id=? AND company_id=?",[next,produced,next,next,id,c]);
  return next;
 });
 await audit(req,'update','production_order',id,{status,producedQuantity:produced});res.json({ok:true});
}));
router.delete('/orders/:id',auth,requireRole('admin'),ah(async(req,res)=>{const id=Number(req.params.id);const r=await run('DELETE FROM production_orders WHERE id=? AND company_id=?',[id,cid(req)]);if(!r.changes)return res.status(404).json({error:'Ordem não encontrada'});await audit(req,'delete','production_order',id);res.json({ok:true})}));
router.get('/summary',auth,ah(async(req,res)=>{const c=cid(req);const [orders,low]=await Promise.all([all(`SELECT status,COUNT(*) count,SUM(planned_quantity) planned,SUM(produced_quantity) produced FROM production_orders WHERE company_id=? AND planned_date>=DATE_SUB(CURDATE(),INTERVAL 30 DAY) GROUP BY status`,[c]),all(`SELECT id,name,current_stock,min_stock,unit FROM raw_materials WHERE company_id=? AND current_stock<=min_stock ORDER BY current_stock ASC`,[c])]);res.json({orders,lowStock:low})}));
module.exports=router;
