<?php

declare(strict_types=1);
require_once __DIR__.'/auth_middleware.php';
require_once __DIR__.'/lib/management.php';
require_once __DIR__.'/lib/reports.php';
bootstrap_api();
$db = get_pdo();
$session = authenticate_request($db);
try {
    $method = $_SERVER['REQUEST_METHOD'];
    $action = $_GET['action'] ?? '';
    if ($method === 'GET' && $action === 'catalogue') {
        $db->beginTransaction();
        $result = catalogue($db);
        $db->commit();
        json_response(200, $result);
    }
    if ($method === 'POST') {
        $body = read_json_body();
        if (($body['action'] ?? '') === 'logout') {
            revoke_session($db, $session);
            json_response(200, ['success' => true]);
        }
        require_role($db, $session, 'OWNER');
        json_response(200, save_management($db, $session, $body));
    }
    if ($method !== 'GET') {
        fail(405, 'Use GET or POST');
    }
    require_role($db, $session, 'OWNER');
    $db->beginTransaction();
    if ($action==='dashboard') {$result=dashboard($db);$db->commit();json_response(200,$result);}
    if ($action==='history') {$result=history_page($db,$_GET);$db->commit();json_response(200,$result);}
    if ($action==='safety_backups') {$result=$db->query('SELECT id,created_at FROM safety_backups ORDER BY id DESC LIMIT 20')->fetchAll();$db->commit();json_response(200,['success'=>true,'backups'=>$result]);}
    if ($action === 'management') {
        $result = management_snapshot($db);
        $db->commit();
        json_response(200, $result);
    }
    if (in_array($action, ['sales','export'], true)) {
        $today = substr(now_at($db), 0, 10);
        $r = sales_report($db, $_GET['from'] ?? $today, $_GET['to'] ?? $today);
        $db->commit();
        if ($action === 'sales') {
            json_response(200, $r);
        }
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="venuevue-sales.csv"');
        header('Cache-Control: no-store');
        $out = fopen('php://output', 'w');
        fputcsv($out, ['sale_id','sale_at','variant','qty','unit_price','gross','net','vat','vat_rate'], ',', '"', '');
        foreach ($r['sales'] as $sale) {
            foreach ($sale['items'] as $i) {
                $label = $i['variant_label'];
                if (preg_match('/^[=+@\-\t\r\n]/', $label)) {
                    $label = "'".$label;
                }
                fputcsv($out, [$sale['order_id'],$sale['sale_at'],$label,$i['quantity'],$i['unit_price'],$i['line_gross'],$i['line_net'],$i['line_vat'],$sale['vat_rate']], ',', '"', '');
            }
        }
        fputcsv($out, ['TOTAL','','','','',$r['totals']['gross'],$r['totals']['net'],$r['totals']['vat'],''], ',', '"', '');
        exit;
    }
    $db->rollBack();
    fail(404, 'Unknown action');
} catch (BusinessError $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    fail($e->status, $e->getMessage());
} catch (PDOException $e) {
    if ($db->inTransaction()) $db->rollBack();
    if (($e->errorInfo[1]??0)===1062) fail(409,'Name, SKU or size/temperature combination already exists. Choose a unique value.');
    if (in_array($e->errorInfo[1]??0,[1451,1452],true)) fail(409,'This record has related data or a referenced record no longer exists. Refresh and try again.');
    error_log((string)$e);fail(500,'Database operation failed. No changes committed.');
} catch (Throwable $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    error_log((string)$e);
    fail(500,'Operation failed; no changes committed. Check duplicate names/SKUs or contact the owner.');
}
