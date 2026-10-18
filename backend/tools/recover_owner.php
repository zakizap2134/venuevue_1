<?php

declare(strict_types=1);
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
require_once __DIR__.'/../lib/workflow.php';
// Secrets are read from stdin, never command arguments, process lists or logs.
fwrite(STDERR, "Owner username: ");
$username = trim((string)fgets(STDIN));
fwrite(STDERR, "Offline recovery code (input is visible; use a private server console): ");
$code = trim((string)fgets(STDIN));
fwrite(STDERR, "New password (12+ characters): ");
$password = rtrim((string)fgets(STDIN), "\r\n");
$db = get_pdo();
$db->beginTransaction();
try {
    lock_workflow($db);
    $user = query($db, "SELECT * FROM users WHERE username=? AND role='OWNER' AND is_active=1 FOR UPDATE", [$username])->fetch();
    if (!$user || !$user['recovery_hash'] || !password_verify($code, $user['recovery_hash']) || strlen($password) < 12 || strlen($password) > 200) {
        throw new RuntimeException('Recovery rejected');
    }
    $replacement = bin2hex(random_bytes(24));
    query($db, 'UPDATE users SET password_hash=?,recovery_hash=? WHERE user_id=?', [password_hash($password, PASSWORD_DEFAULT),password_hash($replacement, PASSWORD_DEFAULT),$user['user_id']]);
    query($db, 'DELETE FROM api_sessions WHERE user_id=?', [$user['user_id']]);
    audit_strict($db, (int)$user['user_id'], 'OWNER_RECOVERED');
    $db->commit();
    echo "Recovery complete. Old code consumed; all owner sessions revoked. Store this NEW code offline:\n$replacement\n";
} catch (Throwable $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }fwrite(STDERR,"Recovery failed; no changes made.\n");
    exit(1);
}
