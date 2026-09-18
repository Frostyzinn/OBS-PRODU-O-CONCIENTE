-- Produção Consciente — migração profissional
-- Se você já está usando a versão SaaS anterior, o server.js/database.js cria automaticamente as novas tabelas.
-- Este arquivo é opcional para quem prefere executar a estrutura pelo DBeaver.
USE producao_consciente;

CREATE TABLE IF NOT EXISTS raw_materials (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, company_id BIGINT UNSIGNED NOT NULL,
 name VARCHAR(160) NOT NULL, unit VARCHAR(20) NOT NULL DEFAULT 'kg', min_stock DECIMAL(15,3) NOT NULL DEFAULT 0,
 current_stock DECIMAL(15,3) NOT NULL DEFAULT 0, unit_cost DECIMAL(15,4) NOT NULL DEFAULT 0,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 KEY idx_rm_company(company_id), FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS stock_movements (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, company_id BIGINT UNSIGNED NOT NULL, raw_material_id BIGINT UNSIGNED NOT NULL, user_id BIGINT UNSIGNED NOT NULL,
 type ENUM('in','out','adjustment') NOT NULL, quantity DECIMAL(15,3) NOT NULL, balance_after DECIMAL(15,3) NOT NULL,
 reference VARCHAR(100), note VARCHAR(255), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 KEY idx_sm_company_created(company_id,created_at), FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE,
 FOREIGN KEY(raw_material_id) REFERENCES raw_materials(id) ON DELETE CASCADE, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS production_orders (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, company_id BIGINT UNSIGNED NOT NULL, user_id BIGINT UNSIGNED NOT NULL, product_id BIGINT UNSIGNED NOT NULL,
 order_number VARCHAR(40) NOT NULL, planned_quantity DECIMAL(15,3) NOT NULL DEFAULT 0, produced_quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
 status ENUM('planned','in_progress','completed','cancelled') NOT NULL DEFAULT 'planned', planned_date DATE NOT NULL, started_at DATETIME NULL, completed_at DATETIME NULL, note VARCHAR(255), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_po_company_number(company_id,order_number), KEY idx_po_company_date(company_id,planned_date), FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS production_plans (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, company_id BIGINT UNSIGNED NOT NULL, user_id BIGINT UNSIGNED NOT NULL, product_id BIGINT UNSIGNED NOT NULL,
 period CHAR(7) NOT NULL, planned_quantity DECIMAL(15,3) NOT NULL DEFAULT 0, target_sales DECIMAL(15,3) NOT NULL DEFAULT 0,
 priority ENUM('high','medium','low') NOT NULL DEFAULT 'medium', status ENUM('planned','in_progress','done','cancelled') NOT NULL DEFAULT 'planned', note VARCHAR(255), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_plan_company_product_period(company_id,product_id,period), KEY idx_plan_company_period(company_id,period), FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS company_goals (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, company_id BIGINT UNSIGNED NOT NULL, user_id BIGINT UNSIGNED NOT NULL, title VARCHAR(160) NOT NULL,
 metric VARCHAR(60) NOT NULL, target_value DECIMAL(18,3) NOT NULL DEFAULT 0, current_value DECIMAL(18,3) NOT NULL DEFAULT 0, period CHAR(7) NOT NULL,
 status ENUM('active','done','cancelled') NOT NULL DEFAULT 'active', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 KEY idx_goals_company_period(company_id,period), FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Vincula a composição do produto ao insumo físico do estoque.
ALTER TABLE product_ingredients ADD COLUMN raw_material_id BIGINT UNSIGNED NULL AFTER id;
ALTER TABLE product_ingredients ADD INDEX idx_ingredients_raw_material(raw_material_id);
ALTER TABLE product_ingredients ADD CONSTRAINT fk_ingredients_raw_material FOREIGN KEY(raw_material_id) REFERENCES raw_materials(id) ON DELETE SET NULL;
