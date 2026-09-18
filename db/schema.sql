CREATE DATABASE IF NOT EXISTS producao_consciente CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE producao_consciente;

CREATE TABLE IF NOT EXISTS companies (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 cnpj VARCHAR(14) UNIQUE,
 legal_name VARCHAR(180) NOT NULL,
 trade_name VARCHAR(160) NOT NULL,
 email VARCHAR(190), phone VARCHAR(30), street VARCHAR(180), number VARCHAR(30), complement VARCHAR(100), neighborhood VARCHAR(120), city VARCHAR(120), state CHAR(2),
 status ENUM('active','suspended') NOT NULL DEFAULT 'active', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 KEY idx_companies_trade_name(trade_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS users (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(120) NOT NULL,
 company_name VARCHAR(160) NOT NULL DEFAULT 'Minha empresa',
 email VARCHAR(190) NOT NULL UNIQUE,
 password_hash VARCHAR(255) NOT NULL,
 company_id BIGINT UNSIGNED,
 role ENUM('admin','production','commercial','viewer') NOT NULL DEFAULT 'viewer',
 status ENUM('active','pending','blocked') NOT NULL DEFAULT 'active',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 KEY idx_users_company(company_id),
 CONSTRAINT fk_users_company FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS company_join_requests (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 company_id BIGINT UNSIGNED NOT NULL, user_id BIGINT UNSIGNED NOT NULL,
 requested_role ENUM('production','commercial','viewer') NOT NULL DEFAULT 'viewer',
 status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending', requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, decided_at TIMESTAMP NULL, decided_by BIGINT UNSIGNED NULL,
 UNIQUE KEY uq_join_user_company(user_id,company_id), KEY idx_join_company_status(company_id,status),
 CONSTRAINT fk_join_company FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE,
 CONSTRAINT fk_join_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS products (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL, company_id BIGINT UNSIGNED NOT NULL,
 name VARCHAR(160) NOT NULL, unit VARCHAR(20) NOT NULL DEFAULT 'un', current_production DECIMAL(15,3) DEFAULT 0, unit_cost DECIMAL(15,4) DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 KEY idx_products_user(user_id), KEY idx_products_company(company_id),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS product_ingredients (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, product_id BIGINT UNSIGNED NOT NULL, raw_material_id BIGINT UNSIGNED NULL, name VARCHAR(160) NOT NULL, unit_cost DECIMAL(15,4) DEFAULT 0, quantity_per_product DECIMAL(15,6) DEFAULT 0, waste_percent DECIMAL(8,3) DEFAULT 0,
 KEY idx_ingredients_product(product_id), KEY idx_ingredients_raw_material(raw_material_id), FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sales_histories (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL, company_id BIGINT UNSIGNED NOT NULL, product_id BIGINT UNSIGNED NOT NULL, period CHAR(7) NOT NULL, quantity DECIMAL(15,3) DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_sales_company_period(company_id,product_id,period), KEY idx_sales_company_period(company_id,period), KEY idx_sales_product_period(product_id,period),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE, FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS buyers (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL, company_id BIGINT UNSIGNED NOT NULL, name VARCHAR(160) NOT NULL, frequency VARCHAR(40) NOT NULL, average_volume DECIMAL(15,3) DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 KEY idx_buyers_company(company_id), FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cpp_reports (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL, company_id BIGINT UNSIGNED NOT NULL, product_id BIGINT UNSIGNED NOT NULL, months_n INT UNSIGNED NOT NULL, demand_forecast DECIMAL(15,3) NOT NULL, current_production DECIMAL(15,3) NOT NULL, surplus DECIMAL(15,3) NOT NULL, unit_cost DECIMAL(15,4) NOT NULL, financial_reduction DECIMAL(18,4) NOT NULL, energy_saved_kwh DECIMAL(18,4) DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 KEY idx_cpp_company_created(company_id,created_at), KEY idx_cpp_user_created(user_id,created_at), FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE, FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cpp_report_materials (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, report_id BIGINT UNSIGNED NOT NULL, name VARCHAR(160) NOT NULL, quantity_saved DECIMAL(18,6) DEFAULT 0, waste_percent DECIMAL(8,3) DEFAULT 0,
 KEY idx_cpp_material_report(report_id), FOREIGN KEY(report_id) REFERENCES cpp_reports(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS audit_logs (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, company_id BIGINT UNSIGNED, user_id BIGINT UNSIGNED, action VARCHAR(80) NOT NULL, entity VARCHAR(80) NOT NULL, entity_id BIGINT UNSIGNED, metadata JSON NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 KEY idx_audit_company_created(company_id,created_at), FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE SET NULL, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS raw_materials (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, company_id BIGINT UNSIGNED NOT NULL,
 name VARCHAR(160) NOT NULL, unit VARCHAR(20) NOT NULL DEFAULT 'kg', min_stock DECIMAL(15,3) NOT NULL DEFAULT 0,
 current_stock DECIMAL(15,3) NOT NULL DEFAULT 0, unit_cost DECIMAL(15,4) NOT NULL DEFAULT 0,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 KEY idx_rm_company(company_id), FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS stock_movements (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, company_id BIGINT UNSIGNED NOT NULL, raw_material_id BIGINT UNSIGNED NOT NULL, user_id BIGINT UNSIGNED NOT NULL,
 type ENUM('in','out','adjustment') NOT NULL, quantity DECIMAL(15,3) NOT NULL, balance_after DECIMAL(15,3) NOT NULL,
 reference VARCHAR(100), note VARCHAR(255), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 KEY idx_sm_company_created(company_id,created_at), FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE,
 FOREIGN KEY(raw_material_id) REFERENCES raw_materials(id) ON DELETE CASCADE, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS production_orders (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, company_id BIGINT UNSIGNED NOT NULL, user_id BIGINT UNSIGNED NOT NULL, product_id BIGINT UNSIGNED NOT NULL,
 order_number VARCHAR(40) NOT NULL, planned_quantity DECIMAL(15,3) NOT NULL DEFAULT 0, produced_quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
 status ENUM('planned','in_progress','completed','cancelled') NOT NULL DEFAULT 'planned', planned_date DATE NOT NULL, started_at DATETIME NULL, completed_at DATETIME NULL, note VARCHAR(255), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_po_company_number(company_id,order_number), KEY idx_po_company_date(company_id,planned_date), FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS production_plans (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, company_id BIGINT UNSIGNED NOT NULL, user_id BIGINT UNSIGNED NOT NULL, product_id BIGINT UNSIGNED NOT NULL,
 period CHAR(7) NOT NULL, planned_quantity DECIMAL(15,3) NOT NULL DEFAULT 0, target_sales DECIMAL(15,3) NOT NULL DEFAULT 0,
 priority ENUM('high','medium','low') NOT NULL DEFAULT 'medium', status ENUM('planned','in_progress','done','cancelled') NOT NULL DEFAULT 'planned', note VARCHAR(255), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_plan_company_product_period(company_id,product_id,period), KEY idx_plan_company_period(company_id,period), FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS company_goals (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, company_id BIGINT UNSIGNED NOT NULL, user_id BIGINT UNSIGNED NOT NULL, title VARCHAR(160) NOT NULL,
 metric VARCHAR(60) NOT NULL, target_value DECIMAL(18,3) NOT NULL DEFAULT 0, current_value DECIMAL(18,3) NOT NULL DEFAULT 0, period CHAR(7) NOT NULL,
 status ENUM('active','done','cancelled') NOT NULL DEFAULT 'active', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 KEY idx_goals_company_period(company_id,period), FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE product_ingredients ADD CONSTRAINT fk_ingredients_raw_material FOREIGN KEY(raw_material_id) REFERENCES raw_materials(id) ON DELETE SET NULL;
