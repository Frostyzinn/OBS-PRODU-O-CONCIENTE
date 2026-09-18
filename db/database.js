require('dotenv').config();
const mysql = require('mysql2/promise');

const DB_NAME = process.env.MYSQL_DATABASE || 'producao_consciente';
const baseConfig = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  waitForConnections: true,
  connectionLimit: Number(process.env.MYSQL_POOL_SIZE || 10),
  queueLimit: 0,
  charset: 'utf8mb4',
  ...(process.env.MYSQL_SSL === 'true' ? {ssl:{rejectUnauthorized:process.env.MYSQL_SSL_REJECT_UNAUTHORIZED !== 'false'}} : {})
};
let pool;
function qi(name){ if(!/^[A-Za-z0-9_]+$/.test(name)) throw new Error('Identificador MySQL inválido.'); return `\`${name}\``; }
async function columnExists(table,column){ const [r]=await pool.query('SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=?',[DB_NAME,table,column]); return r.length>0; }
async function indexExists(table,index){ const [r]=await pool.query('SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND INDEX_NAME=?',[DB_NAME,table,index]); return r.length>0; }
async function addColumn(table,column,definition,after=''){ if(!(await columnExists(table,column))) await pool.query(`ALTER TABLE ${qi(table)} ADD COLUMN ${qi(column)} ${definition}${after?` AFTER ${qi(after)}`:''}`); }
async function addIndex(table,index,definition){ if(!(await indexExists(table,index))) await pool.query(`ALTER TABLE ${qi(table)} ADD INDEX ${qi(index)} ${definition}`); }

async function initDatabase(options={}){
  // Em provedores gerenciados (Vercel + MySQL externo), normalmente o usuário
  // não tem permissão para CREATE DATABASE. Por padrão mantemos a criação para
  // desenvolvimento local; defina MYSQL_AUTO_CREATE_DATABASE=false na Vercel.
  if(process.env.MYSQL_AUTO_CREATE_DATABASE !== 'false'){
    const bootstrap=await mysql.createConnection({
      host:baseConfig.host, port:baseConfig.port, user:baseConfig.user,
      password:baseConfig.password, charset:'utf8mb4',
      ...(process.env.MYSQL_SSL === 'true' ? {
        ssl:{rejectUnauthorized:process.env.MYSQL_SSL_REJECT_UNAUTHORIZED !== 'false'}
      } : {})
    });
    await bootstrap.query(`CREATE DATABASE IF NOT EXISTS ${qi(DB_NAME)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await bootstrap.end();
  }
  pool=mysql.createPool({...baseConfig,database:DB_NAME});
  await pool.query('SELECT 1');
  const migrate=options.migrate??(process.env.MYSQL_MIGRATE_ON_START==='true'||process.env.NODE_ENV!=='production');
  if(migrate)await createTables();
  else{await pool.query('SELECT token_hash FROM user_sessions LIMIT 0');await pool.query('SELECT bucket FROM security_rate_limits LIMIT 0');}
  console.log(`MySQL conectado: ${baseConfig.host}:${baseConfig.port}/${DB_NAME}`);
}

async function createTables(){
  const statements=[
`CREATE TABLE IF NOT EXISTS companies (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, cnpj VARCHAR(14) NULL, legal_name VARCHAR(180) NOT NULL, trade_name VARCHAR(160) NOT NULL, email VARCHAR(190) NULL, phone VARCHAR(30) NULL, street VARCHAR(180) NULL, number VARCHAR(30) NULL, complement VARCHAR(100) NULL, neighborhood VARCHAR(120) NULL, city VARCHAR(120) NULL, state CHAR(2) NULL, status ENUM('active','suspended') NOT NULL DEFAULT 'active', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY(id), UNIQUE KEY uq_companies_cnpj(cnpj), KEY idx_companies_trade_name(trade_name)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
`CREATE TABLE IF NOT EXISTS users (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, name VARCHAR(120) NOT NULL, company_name VARCHAR(160) NOT NULL DEFAULT 'Minha empresa', email VARCHAR(190) NOT NULL, password_hash VARCHAR(255) NOT NULL, company_id BIGINT UNSIGNED NULL, role ENUM('admin','production','commercial','viewer') NOT NULL DEFAULT 'viewer', status ENUM('active','pending','blocked') NOT NULL DEFAULT 'active', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(id), UNIQUE KEY uq_users_email(email), KEY idx_users_company(company_id), CONSTRAINT fk_users_company FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE SET NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
`CREATE TABLE IF NOT EXISTS company_join_requests (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, company_id BIGINT UNSIGNED NOT NULL, user_id BIGINT UNSIGNED NOT NULL, requested_role ENUM('production','commercial','viewer') NOT NULL DEFAULT 'viewer', status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending', requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, decided_at TIMESTAMP NULL, decided_by BIGINT UNSIGNED NULL, PRIMARY KEY(id), UNIQUE KEY uq_join_user_company(user_id,company_id), KEY idx_join_company_status(company_id,status), CONSTRAINT fk_join_company FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE, CONSTRAINT fk_join_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
`CREATE TABLE IF NOT EXISTS products (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, user_id BIGINT UNSIGNED NOT NULL, company_id BIGINT UNSIGNED NULL, name VARCHAR(160) NOT NULL, unit VARCHAR(20) NOT NULL DEFAULT 'un', current_production DECIMAL(15,3) NOT NULL DEFAULT 0, unit_cost DECIMAL(15,4) NOT NULL DEFAULT 0, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(id), KEY idx_products_user(user_id), KEY idx_products_company(company_id), CONSTRAINT fk_products_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE, CONSTRAINT fk_products_company FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
`CREATE TABLE IF NOT EXISTS product_ingredients (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, product_id BIGINT UNSIGNED NOT NULL, name VARCHAR(160) NOT NULL, unit_cost DECIMAL(15,4) NOT NULL DEFAULT 0, quantity_per_product DECIMAL(15,6) NOT NULL DEFAULT 0, waste_percent DECIMAL(8,3) NOT NULL DEFAULT 0, PRIMARY KEY(id), KEY idx_ingredients_product(product_id), CONSTRAINT fk_ingredients_product FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
`CREATE TABLE IF NOT EXISTS sales_histories (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, user_id BIGINT UNSIGNED NOT NULL, company_id BIGINT UNSIGNED NULL, product_id BIGINT UNSIGNED NOT NULL, period CHAR(7) NOT NULL, quantity DECIMAL(15,3) NOT NULL DEFAULT 0, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(id), UNIQUE KEY uq_sales_company_period(company_id,product_id,period), KEY idx_sales_company_period(company_id,period), KEY idx_sales_product_period(product_id,period), CONSTRAINT fk_sales_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE, CONSTRAINT fk_sales_company FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE, CONSTRAINT fk_sales_product FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
`CREATE TABLE IF NOT EXISTS buyers (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, user_id BIGINT UNSIGNED NOT NULL, company_id BIGINT UNSIGNED NULL, name VARCHAR(160) NOT NULL, frequency VARCHAR(40) NOT NULL, average_volume DECIMAL(15,3) NOT NULL DEFAULT 0, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(id), KEY idx_buyers_company(company_id), CONSTRAINT fk_buyers_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE, CONSTRAINT fk_buyers_company FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
`CREATE TABLE IF NOT EXISTS cpp_reports (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, user_id BIGINT UNSIGNED NOT NULL, company_id BIGINT UNSIGNED NULL, product_id BIGINT UNSIGNED NOT NULL, months_n INT UNSIGNED NOT NULL, demand_forecast DECIMAL(15,3) NOT NULL, current_production DECIMAL(15,3) NOT NULL, surplus DECIMAL(15,3) NOT NULL, unit_cost DECIMAL(15,4) NOT NULL, financial_reduction DECIMAL(18,4) NOT NULL, energy_saved_kwh DECIMAL(18,4) NOT NULL DEFAULT 0, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(id), KEY idx_cpp_company_created(company_id,created_at), KEY idx_cpp_user_created(user_id,created_at), CONSTRAINT fk_cpp_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE, CONSTRAINT fk_cpp_company FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE, CONSTRAINT fk_cpp_product FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
`CREATE TABLE IF NOT EXISTS cpp_report_materials (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, report_id BIGINT UNSIGNED NOT NULL, name VARCHAR(160) NOT NULL, quantity_saved DECIMAL(18,6) NOT NULL DEFAULT 0, waste_percent DECIMAL(8,3) NOT NULL DEFAULT 0, PRIMARY KEY(id), KEY idx_cpp_material_report(report_id), CONSTRAINT fk_cpp_material_report FOREIGN KEY(report_id) REFERENCES cpp_reports(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
`CREATE TABLE IF NOT EXISTS audit_logs (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, company_id BIGINT UNSIGNED NULL, user_id BIGINT UNSIGNED NULL, action VARCHAR(80) NOT NULL, entity VARCHAR(80) NOT NULL, entity_id BIGINT UNSIGNED NULL, metadata JSON NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(id), KEY idx_audit_company_created(company_id,created_at), CONSTRAINT fk_audit_company FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE SET NULL, CONSTRAINT fk_audit_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  ];
  for(const sql of statements) await pool.query(sql);

  await addColumn('product_ingredients','raw_material_id','BIGINT UNSIGNED NULL','id');
  await pool.query(`CREATE TABLE IF NOT EXISTS raw_materials (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, company_id BIGINT UNSIGNED NOT NULL, name VARCHAR(160) NOT NULL, unit VARCHAR(20) NOT NULL DEFAULT 'kg', min_stock DECIMAL(15,3) NOT NULL DEFAULT 0, current_stock DECIMAL(15,3) NOT NULL DEFAULT 0, unit_cost DECIMAL(15,4) NOT NULL DEFAULT 0, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY(id), KEY idx_rm_company(company_id), FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await pool.query(`CREATE TABLE IF NOT EXISTS stock_movements (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, company_id BIGINT UNSIGNED NOT NULL, raw_material_id BIGINT UNSIGNED NOT NULL, user_id BIGINT UNSIGNED NOT NULL, type ENUM('in','out','adjustment') NOT NULL, quantity DECIMAL(15,3) NOT NULL, balance_after DECIMAL(15,3) NOT NULL, reference VARCHAR(100) NULL, note VARCHAR(255) NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(id), KEY idx_sm_company_created(company_id,created_at), FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE, FOREIGN KEY(raw_material_id) REFERENCES raw_materials(id) ON DELETE CASCADE, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await pool.query(`CREATE TABLE IF NOT EXISTS production_orders (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, company_id BIGINT UNSIGNED NOT NULL, user_id BIGINT UNSIGNED NOT NULL, product_id BIGINT UNSIGNED NOT NULL, order_number VARCHAR(40) NOT NULL, planned_quantity DECIMAL(15,3) NOT NULL DEFAULT 0, produced_quantity DECIMAL(15,3) NOT NULL DEFAULT 0, status ENUM('planned','in_progress','completed','cancelled') NOT NULL DEFAULT 'planned', planned_date DATE NOT NULL, started_at DATETIME NULL, completed_at DATETIME NULL, note VARCHAR(255) NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(id), UNIQUE KEY uq_po_company_number(company_id,order_number), KEY idx_po_company_date(company_id,planned_date), FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE RESTRICT) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await pool.query(`CREATE TABLE IF NOT EXISTS production_plans (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, company_id BIGINT UNSIGNED NOT NULL, user_id BIGINT UNSIGNED NOT NULL, product_id BIGINT UNSIGNED NOT NULL, period CHAR(7) NOT NULL, planned_quantity DECIMAL(15,3) NOT NULL DEFAULT 0, target_sales DECIMAL(15,3) NOT NULL DEFAULT 0, priority ENUM('high','medium','low') NOT NULL DEFAULT 'medium', status ENUM('planned','in_progress','done','cancelled') NOT NULL DEFAULT 'planned', note VARCHAR(255) NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(id), UNIQUE KEY uq_plan_company_product_period(company_id,product_id,period), KEY idx_plan_company_period(company_id,period), FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE RESTRICT) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await pool.query(`CREATE TABLE IF NOT EXISTS company_goals (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, company_id BIGINT UNSIGNED NOT NULL, user_id BIGINT UNSIGNED NOT NULL, title VARCHAR(160) NOT NULL, metric VARCHAR(60) NOT NULL, target_value DECIMAL(18,3) NOT NULL DEFAULT 0, current_value DECIMAL(18,3) NOT NULL DEFAULT 0, period CHAR(7) NOT NULL, status ENUM('active','done','cancelled') NOT NULL DEFAULT 'active', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(id), KEY idx_goals_company_period(company_id,period), FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await pool.query("CREATE TABLE IF NOT EXISTS user_sessions (token_hash CHAR(64) NOT NULL PRIMARY KEY,user_id BIGINT UNSIGNED NOT NULL,expires_at DATETIME NOT NULL,last_seen_at DATETIME NOT NULL,KEY idx_session_user(user_id),KEY idx_session_expiry(expires_at),KEY idx_session_idle(last_seen_at),CONSTRAINT fk_session_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB");
  await pool.query("CREATE TABLE IF NOT EXISTS security_rate_limits (bucket CHAR(64) NOT NULL PRIMARY KEY,hits INT UNSIGNED NOT NULL DEFAULT 0,expires_at DATETIME NOT NULL,KEY idx_limit_expiry(expires_at)) ENGINE=InnoDB");
  await pool.query('DELETE FROM security_rate_limits WHERE expires_at<=UTC_TIMESTAMP()');
  // Migração de instalações antigas para multiempresa, preservando os dados existentes.
  await addColumn('users','company_name',"VARCHAR(160) NOT NULL DEFAULT 'Minha empresa'",'name');
  await addColumn('users','company_id','BIGINT UNSIGNED NULL','password_hash');
  await addColumn('users','role',"ENUM('admin','production','commercial','viewer') NOT NULL DEFAULT 'viewer'",'company_id');
  await addColumn('users','status',"ENUM('active','pending','blocked') NOT NULL DEFAULT 'active'",'role');
  await addIndex('users','idx_users_company','(company_id)');
  await addColumn('products','company_id','BIGINT UNSIGNED NULL','user_id');
  await addColumn('sales_histories','company_id','BIGINT UNSIGNED NULL','user_id');
  await addColumn('buyers','company_id','BIGINT UNSIGNED NULL','user_id');
  await addColumn('cpp_reports','company_id','BIGINT UNSIGNED NULL','user_id');
  await addIndex('products','idx_products_company','(company_id)');
  await addIndex('sales_histories','idx_sales_company_period','(company_id,period)');
  await addIndex('buyers','idx_buyers_company','(company_id)');
  await addIndex('cpp_reports','idx_cpp_company_created','(company_id,created_at)');

  const [legacy]=await pool.query('SELECT id,name,company_name,email FROM users WHERE company_id IS NULL ORDER BY id');
  for(const u of legacy){
    const cnpj=`LEGACY${String(u.id).padStart(8,'0')}`;
    const [existing]=await pool.query('SELECT id FROM companies WHERE cnpj=?',[cnpj]);
    let companyId=existing[0]?.id;
    if(!companyId){ const [r]=await pool.query('INSERT INTO companies(cnpj,legal_name,trade_name,email) VALUES(?,?,?,?)',[cnpj,u.company_name||'Minha empresa',u.company_name||'Minha empresa',u.email]); companyId=r.insertId; }
    await pool.query("UPDATE users SET company_id=?,role='admin',status='active' WHERE id=?",[companyId,u.id]);
  }
  await pool.query('UPDATE products p JOIN users u ON u.id=p.user_id SET p.company_id=u.company_id WHERE p.company_id IS NULL');
  await pool.query('UPDATE sales_histories s JOIN users u ON u.id=s.user_id SET s.company_id=u.company_id WHERE s.company_id IS NULL');
  await pool.query('UPDATE buyers b JOIN users u ON u.id=b.user_id SET b.company_id=u.company_id WHERE b.company_id IS NULL');
  await pool.query('UPDATE cpp_reports c JOIN users u ON u.id=c.user_id SET c.company_id=u.company_id WHERE c.company_id IS NULL');
  if(await indexExists('sales_histories','uq_sales_period') && !(await indexExists('sales_histories','uq_sales_company_period'))){ await pool.query('ALTER TABLE sales_histories DROP INDEX uq_sales_period'); await pool.query('ALTER TABLE sales_histories ADD UNIQUE INDEX uq_sales_company_period(company_id,product_id,period)'); }

  // FKs adicionados apenas quando ainda não existem.
  const fkChecks=[
    ['users','fk_users_company','ALTER TABLE users ADD CONSTRAINT fk_users_company FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE SET NULL'],
    ['products','fk_products_company','ALTER TABLE products ADD CONSTRAINT fk_products_company FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE'],
    ['sales_histories','fk_sales_company','ALTER TABLE sales_histories ADD CONSTRAINT fk_sales_company FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE'],
    ['buyers','fk_buyers_company','ALTER TABLE buyers ADD CONSTRAINT fk_buyers_company FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE'],
    ['cpp_reports','fk_cpp_company','ALTER TABLE cpp_reports ADD CONSTRAINT fk_cpp_company FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE']
  ];
  for(const [table,name,sql] of fkChecks){ const [r]=await pool.query('SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=? AND CONSTRAINT_NAME=?',[DB_NAME,name]); if(!r.length) await pool.query(sql); }
  const [ingFk]=await pool.query('SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=? AND CONSTRAINT_NAME=?',[DB_NAME,'fk_ingredients_raw_material']); if(!ingFk.length) await pool.query('ALTER TABLE product_ingredients ADD CONSTRAINT fk_ingredients_raw_material FOREIGN KEY(raw_material_id) REFERENCES raw_materials(id) ON DELETE SET NULL');
}
function ensurePool(){if(!pool)throw new Error('Banco MySQL ainda não foi inicializado.');return pool;}
async function run(sql,params=[]){const [r]=await ensurePool().execute(sql,params);return{id:r.insertId,changes:r.affectedRows};}
async function get(sql,params=[]){const [r]=await ensurePool().execute(sql,params);return r[0];}
async function all(sql,params=[]){const [r]=await ensurePool().execute(sql,params);return r;}
async function transaction(fn){const conn=await ensurePool().getConnection();try{await conn.beginTransaction();const tx={run:(s,p=[])=>conn.execute(s,p).then(([r])=>({id:r.insertId,changes:r.affectedRows})),get:(s,p=[])=>conn.execute(s,p).then(([r])=>r[0]),all:(s,p=[])=>conn.execute(s,p).then(([r])=>r)};const result=await fn(tx);await conn.commit();return result;}catch(e){await conn.rollback();throw e;}finally{conn.release();}}
async function close(){if(pool)await pool.end();}
module.exports={initDatabase,run,get,all,transaction,close,DB_NAME,baseConfig};
