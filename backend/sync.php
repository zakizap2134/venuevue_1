<?php

/** Authenticated, idempotent cash checkout. Rules live in lib/workflow.php. */
declare(strict_types=1);
require_once __DIR__.'/auth_middleware.php';
require_once __DIR__.'/lib/workflow.php';
bootstrap_api();
require_post();
$db = get_pdo();
$session = authenticate_request($db);
require_role($db, $session, VENUEVUE_ALLOWED_ROLES);
try {
    $result = commit_sale($db, $session, read_json_body());
    json_response($result['duplicate'] ? 200 : 201, $result);
} catch (BusinessError $e) {
    fail($e->status, $e->getMessage());
} catch (Throwable $e) {
    error_log('[venuevue] sale failed: '.$e->getMessage());
    fail(500, 'Confirmation unavailable. Retry the same transaction key.');
}
