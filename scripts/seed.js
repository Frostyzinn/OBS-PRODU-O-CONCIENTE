require('dotenv').config();
if(process.env.NODE_ENV==='production')throw new Error('O seed de demonstração não pode rodar em produção.');
const bcrypt=require('bcryptjs');
const {initDatabase,get,run,transaction,close}=require('../db/database');
(async()=>{try{
  await initDatabase();
  const cnpj='12345678000195',email='demo@producao.com';
  let company=await get('SELECT id FROM companies WHERE cnpj=?',[cnpj]);
  if(!company){const r=await run('INSERT INTO companies(cnpj,legal_name,trade_name,email,phone,city,state) VALUES(?,?,?,?,?,?,?)',[cnpj,'Produção Consciente Demonstração Ltda.','PC Materiais','demo@producao.com','(86) 99999-0000','Teresina','PI']);company={id:r.id};}
  let u=await get('SELECT id FROM users WHERE email=?',[email]);
  if(!u){const hash=await bcrypt.hash('123456',12);const r=await run("INSERT INTO users(name,company_name,email,password_hash,company_id,role,status) VALUES(?,?,?,?,?,'admin','active')",['Administrador Demo','PC Materiais',email,hash,company.id]);u={id:r.id};}
  let p=await get('SELECT id FROM products WHERE company_id=? LIMIT 1',[company.id]);
  if(!p){p=await run('INSERT INTO products(user_id,company_id,name,unit,current_production,unit_cost) VALUES(?,?,?,?,?,?)',[u.id,company.id,'Bloco cerâmico 9×14×19','un',4200,77]);await run('INSERT INTO product_ingredients(product_id,name,unit_cost,quantity_per_product,waste_percent) VALUES(?,?,?,?,?)',[p.id,'Argila',8.5,0.055,8]);for(const [period,q] of [['2026-04',3800],['2026-05',4100],['2026-06',3750],['2026-07',3800],['2026-08',4100],['2026-09',3820]])await run('INSERT INTO sales_histories(user_id,company_id,product_id,period,quantity) VALUES(?,?,?,?,?)',[u.id,company.id,p.id,period,q]);await run('INSERT INTO buyers(user_id,company_id,name,frequency,average_volume) VALUES(?,?,?,?,?)',[u.id,company.id,'Cerâmica Piauí','Mensal',3800]);}
  let rm=await get('SELECT id FROM raw_materials WHERE company_id=? LIMIT 1',[company.id]);
  if(!rm){const r=await run('INSERT INTO raw_materials(company_id,name,unit,min_stock,current_stock,unit_cost) VALUES(?,?,?,?,?,?)',[company.id,'Argila','t',20,85,150]);rm={id:r.id};await run('INSERT INTO stock_movements(company_id,raw_material_id,user_id,type,quantity,balance_after,reference,note) VALUES(?,?,?,?,?,?,?,?)',[company.id,rm.id,u.id,'in',85,85,'SEED','Estoque inicial']);}
  if(p){const existing=await get('SELECT id FROM production_plans WHERE company_id=? AND product_id=? AND period=?',[company.id,p.id,'2026-09']);if(!existing)await run('INSERT INTO production_plans(company_id,user_id,product_id,period,planned_quantity,target_sales,priority,status,note) VALUES(?,?,?,?,?,?,?,?,?)',[company.id,u.id,p.id,'2026-09',4000,3820,'high','in_progress','Plano demo']);const op=await get('SELECT id FROM production_orders WHERE company_id=? LIMIT 1',[company.id]);if(!op)await run('INSERT INTO production_orders(company_id,user_id,product_id,order_number,planned_quantity,produced_quantity,status,planned_date,note) VALUES(?,?,?,?,?,?,?,?,?)',[company.id,u.id,p.id,'OP-SEED-0001',4000,1200,'in_progress','2026-09-14','Ordem demonstrativa']);}
  const goal=await get('SELECT id FROM company_goals WHERE company_id=? LIMIT 1',[company.id]);if(!goal)await run('INSERT INTO company_goals(company_id,user_id,title,metric,target_value,current_value,period,status) VALUES(?,?,?,?,?,?,?,?)',[company.id,u.id,'Produzir com eficiência','production',10000,7200,'2026-09','active']);
  console.log('Seed concluído.');console.log('Login demo:',email,'senha: 123456');console.log('CNPJ demo:',cnpj);
}finally{await close()}})().catch(async e=>{console.error(e);try{await close()}catch{}process.exit(1)});
