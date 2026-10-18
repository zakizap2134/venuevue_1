<?php
declare(strict_types=1);
require_once __DIR__.'/auth_middleware.php';
require_once __DIR__.'/lib/backup.php';
bootstrap_api();require_post();
$db=get_pdo();$session=authenticate_request($db);require_role($db,$session,'OWNER');
try {
    if ((int)($_SERVER['CONTENT_LENGTH']??0)>BACKUP_MAX_BYTES*1.5) reject(413,'Backup upload is too large');
    json_response(200,backup_action($db,$session,read_json_body()));
} catch(BusinessError $e) { fail($e->status,$e->getMessage()); }
catch(Throwable $e) { error_log('[venuevue] backup: '.$e->getMessage());fail(422,'Backup could not be applied. Current data is unchanged; check file integrity and schema compatibility.'); }
