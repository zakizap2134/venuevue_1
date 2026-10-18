-- Fresh installs only: run after schema.sql and before migration 003.
-- Existing installs already have these tables. CREATE IF NOT EXISTS preserves them.
CREATE TABLE IF NOT EXISTS products (
 product_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(100) NOT NULL UNIQUE,
 base_price DECIMAL(10,2) NOT NULL DEFAULT 0,
 is_active TINYINT NOT NULL DEFAULT 1
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS ingredients (
 ingredient_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(100) NOT NULL UNIQUE,
 unit VARCHAR(10) NOT NULL DEFAULT 'g',
 current_quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
 safety_stock DECIMAL(12,3) NOT NULL DEFAULT 0,
 cost_per_unit DECIMAL(10,4) NOT NULL DEFAULT 0,
 is_active TINYINT NOT NULL DEFAULT 1
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS recipe_items (
 recipe_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 product_id INT UNSIGNED NOT NULL,
 ingredient_id INT UNSIGNED NOT NULL,
 quantity_required DECIMAL(12,3) NOT NULL,
 UNIQUE KEY uq_product_ingredient(product_id,ingredient_id),
 FOREIGN KEY (product_id) REFERENCES products(product_id),
 FOREIGN KEY (ingredient_id) REFERENCES ingredients(ingredient_id)
) ENGINE=InnoDB;
