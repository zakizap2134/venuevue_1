<?php

/** Initial owner bootstrap only. Staff are managed by the authenticated owner UI. */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
require_once __DIR__.'/../lib/workflow.php';
if (in_array('--help', $_SERVER['argv'] ?? [], true)) {
    echo "Usage: php backend/tools/create_user.php\nCreates the initial OWNER in an empty account table. Reads username/password from stdin.\nUse Management for staff accounts; recover_owner.php plus an offline code for owner recovery.\n";
    exit;
}
fwrite(STDERR, "Initial owner username: ");
$username = trim((string)fgets(STDIN));
fwrite(STDERR, "Password, 12+ characters (visible; use a private console): ");
$password = rtrim((string)fgets(STDIN), "\r\n");
$db = get_pdo();
$db->beginTransaction();
try {
    lock_workflow($db);
    if ((int)$db->query('SELECT COUNT(*) FROM users')->fetchColumn() > 0) {
        throw new RuntimeException('Accounts already exist. Use authenticated Management or code-based owner recovery.');
    }
    text_value($username, 'username', 64);
    if (strlen($password) < 12 || strlen($password) > 200) {
        throw new RuntimeException('Password must be 12–200 characters');
    }
    query($db, "INSERT INTO users(username,password_hash,role) VALUES(?,?,'OWNER')", [$username,password_hash($password, PASSWORD_DEFAULT)]);
    $id = (int)$db->lastInsertId();
    $code = bin2hex(random_bytes(24));
    query($db, 'UPDATE users SET recovery_hash=? WHERE user_id=?', [password_hash($code, PASSWORD_DEFAULT),$id]);
    audit_strict($db, $id, 'OWNER_BOOTSTRAP');
    $db->commit();
    echo "Owner created. Store this recovery code offline now:\n$code\n";
} catch (Throwable $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }fwrite(STDERR, $e->getMessage()."\n");
    exit(1);
}
