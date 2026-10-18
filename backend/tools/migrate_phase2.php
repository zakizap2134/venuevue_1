<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__.'/../config.php';
$db = get_pdo();
foreach (['supplier'=>'VARCHAR(100) NULL','lot_reference'=>'VARCHAR(100) NULL'] as $name=>$type) {
    $q=$db->prepare('SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?');
    $q->execute(['stock_batches',$name]);
    if (!$q->fetchColumn()) $db->exec("ALTER TABLE stock_batches ADD COLUMN $name $type");
}
// Operational backups/jobs deliberately sit outside the restored table set.
$db->exec("CREATE TABLE IF NOT EXISTS restore_jobs (
 token_hash CHAR(64) PRIMARY KEY, session_id CHAR(36) NOT NULL,
 user_id INT UNSIGNED NOT NULL, envelope LONGTEXT NOT NULL, expires_at DATETIME NOT NULL,
 INDEX(expires_at)
) ENGINE=InnoDB");
$db->exec("CREATE TABLE IF NOT EXISTS safety_backups (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_id INT UNSIGNED NOT NULL,
 envelope LONGTEXT NOT NULL, created_at DATETIME NOT NULL
) ENGINE=InnoDB");
echo "Phase 2 schema ready.\n";
