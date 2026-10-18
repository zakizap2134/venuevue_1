<?php

// Run only on the local server after backing up the database. Safe to resume.
declare(strict_types=1);
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
require_once __DIR__ . '/../config.php';
$db = get_pdo();
function add_column(PDO $db, string $table, string $column, string $definition): void
{
    $q = $db->prepare('SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?');
    $q->execute([$table,$column]);
    if (!$q->fetchColumn()) {
        $db->exec("ALTER TABLE $table ADD COLUMN $column $definition");
    }
}
$db->exec("CREATE TABLE IF NOT EXISTS workflow_lock (id INT PRIMARY KEY) ENGINE=InnoDB");
$db->exec('INSERT IGNORE INTO workflow_lock VALUES (1)');
add_column($db, 'products', 'is_vat_exempt', 'TINYINT NOT NULL DEFAULT 0');
add_column($db, 'ingredients', 'opened_shelf_life_hours', 'INT UNSIGNED NULL');
add_column($db, 'users', 'recovery_hash', 'VARCHAR(255) NULL');
$db->exec("CREATE TABLE IF NOT EXISTS product_variants (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, product_id INT UNSIGNED NOT NULL,
 size ENUM('S','M','L') NOT NULL, temperature ENUM('HOT','ICED','NA') NOT NULL DEFAULT 'NA',
 sku VARCHAR(64) NOT NULL UNIQUE, price DECIMAL(10,2) NOT NULL,
 is_active TINYINT NOT NULL DEFAULT 1,
 UNIQUE KEY variant_choice(product_id,size,temperature),
 FOREIGN KEY(product_id) REFERENCES products(product_id), CHECK(price>0)
) ENGINE=InnoDB");
$db->exec("CREATE TABLE IF NOT EXISTS recipes (
 variant_id INT UNSIGNED NOT NULL, ingredient_id INT UNSIGNED NOT NULL, qty DECIMAL(12,3) NOT NULL,
 PRIMARY KEY(variant_id,ingredient_id), FOREIGN KEY(variant_id) REFERENCES product_variants(id),
 FOREIGN KEY(ingredient_id) REFERENCES ingredients(ingredient_id), CHECK(qty>0)
) ENGINE=InnoDB");
$db->exec("CREATE TABLE IF NOT EXISTS stock_batches (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, ingredient_id INT UNSIGNED NOT NULL,
 reference VARCHAR(100) NOT NULL, received_qty DECIMAL(12,3) NOT NULL,
 remaining_qty DECIMAL(12,3) NOT NULL, qty_sealed DECIMAL(12,3) NOT NULL, qty_opened DECIMAL(12,3) NOT NULL DEFAULT 0,
 expiration_date DATE NULL, quarantined TINYINT NOT NULL DEFAULT 0,
 user_id INT UNSIGNED NOT NULL, received_at DATETIME NOT NULL,
 FOREIGN KEY(ingredient_id) REFERENCES ingredients(ingredient_id), FOREIGN KEY(user_id) REFERENCES users(user_id),
 CHECK(remaining_qty>=0), CHECK(qty_sealed>=0), CHECK(qty_opened>=0),
 CHECK(remaining_qty=qty_sealed+qty_opened), INDEX(ingredient_id,expiration_date)
) ENGINE=InnoDB");
$db->exec("CREATE TABLE IF NOT EXISTS stock_containers (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, batch_id BIGINT UNSIGNED NOT NULL,
 received_qty DECIMAL(12,3) NOT NULL, remaining_qty DECIMAL(12,3) NOT NULL,
 opened_at DATETIME NULL, use_by DATETIME NULL,
 FOREIGN KEY(batch_id) REFERENCES stock_batches(id), CHECK(remaining_qty>=0),
 INDEX(batch_id,use_by)
) ENGINE=InnoDB");
foreach (['request_hash' => 'CHAR(64) NULL','total_gross' => 'DECIMAL(10,2) NULL','total_net' => 'DECIMAL(10,2) NULL','total_vat' => 'DECIMAL(10,2) NULL','vat_rate' => 'DECIMAL(5,4) NULL','sale_at' => 'DATETIME NULL'] as $col => $def) {
    add_column($db, 'orders', $col, $def);
}
foreach (['variant_id' => 'INT UNSIGNED NULL','variant_label' => 'VARCHAR(200) NULL','line_gross' => 'DECIMAL(10,2) NULL','line_net' => 'DECIMAL(10,2) NULL','line_vat' => 'DECIMAL(10,2) NULL'] as $col => $def) {
    add_column($db, 'order_items', $col, $def);
}
$db->exec("ALTER TABLE inventory_transactions MODIFY transaction_type ENUM('SALE','RESTOCK','WASTE','ADJUSTMENT') NOT NULL");
add_column($db, 'inventory_transactions', 'batch_id', 'BIGINT UNSIGNED NULL');
add_column($db, 'inventory_transactions', 'container_id', 'BIGINT UNSIGNED NULL');
foreach ([
    ['order_items','fk_phase1_item_variant','FOREIGN KEY (variant_id) REFERENCES product_variants(id)'],
    ['inventory_transactions','fk_phase1_movement_batch','FOREIGN KEY (batch_id) REFERENCES stock_batches(id)'],
    ['inventory_transactions','fk_phase1_movement_container','FOREIGN KEY (container_id) REFERENCES stock_containers(id)'],
] as [$table,$name,$definition]) {
    $q = $db->prepare('SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME=? AND CONSTRAINT_NAME=?');
    $q->execute([$table,$name]);
    if (!$q->fetchColumn()) {
        $db->exec("ALTER TABLE $table ADD CONSTRAINT $name $definition");
    }
}
// No invented sizes, expiration dates, container sizes or retrospective VAT.
// Legacy quantities remain visible as unallocated stock until owner reconciliation.
echo "Phase 1 schema ready. Existing stock requires batch reconciliation; configure explicit variant recipes.\n";
