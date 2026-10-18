<?php

declare(strict_types=1);
require_once __DIR__.'/../config.php';
class BusinessError extends RuntimeException
{
    public function __construct(public int $status, string $message)
    {
        parent::__construct($message);
    }
}
function reject(int $status, string $message): never
{
    throw new BusinessError($status, $message);
}
function query(PDO $db, string $sql, array $params = []): PDOStatement
{
    $q = $db->prepare($sql);
    $q->execute($params);
    return $q;
}
function integer(mixed $v, string $name, int $max = 1000000): int
{
    if (!(is_int($v) || (is_string($v) && preg_match('/^[1-9][0-9]*$/D', $v))) || (int)$v < 1 || (int)$v > $max) {
        reject(422, "Invalid $name");
    }
    return (int)$v;
}
// Fixed point: integer centavos and milli-units, never floating-point arithmetic.
function scaled(mixed $v, int $places, string $name, bool $zero = false): int
{
    if (!is_string($v) && !is_int($v) && !is_float($v)) {
        reject(422, "Invalid $name");
    }
    $s = (string)$v;
    if (!preg_match('/^([0-9]{1,7})(?:\.([0-9]{1,'.$places.'}))?$/D', $s, $m)) {
        reject(422, "Invalid $name precision");
    }
    $n = (int)$m[1] * (10 ** $places) + (int)str_pad($m[2] ?? '', $places, '0');
    if ($n < ($zero ? 0 : 1)) {
        reject(422, "Invalid $name");
    }
    return $n;
}
function dec(int $n, int $places = 2): string
{
    return ($n < 0 ? '-' : '').intdiv(abs($n), 10 ** $places).'.'.str_pad((string)(abs($n) % (10 ** $places)), $places, '0', STR_PAD_LEFT);
}
function text_value(mixed $v, string $name, int $max = 100): string
{
    if (!is_string($v) || trim($v) === '' || strlen(trim($v)) > $max) {
        reject(422, "Invalid $name");
    }
    return trim($v);
}
function date_value(mixed $v): ?string
{
    if ($v === null || $v === '') {
        return null;
    }
    if (!is_string($v) || !preg_match('/^\d{4}-\d{2}-\d{2}$/D', $v) || !($d = DateTimeImmutable::createFromFormat('!Y-m-d', $v)) || $d->format('Y-m-d') !== $v) {
        reject(422, 'Invalid expiration date');
    }
    return $v;
}
function now_at(PDO $db): string
{
    return (string)$db->query('SELECT NOW()')->fetchColumn();
}
function lock_workflow(PDO $db): void
{
    if (!$db->query('SELECT id FROM workflow_lock WHERE id=1 FOR UPDATE')->fetch()) {
        throw new RuntimeException('Missing workflow lock; run migration');
    }
}
function workflow_session_current(PDO $db,array $session): void
{
    $row=query($db,'SELECT u.role FROM api_sessions s JOIN users u ON u.user_id=s.user_id WHERE s.session_id=? AND s.user_id=? AND s.expires_at>NOW() AND u.is_active=1',[$session['session_id'],$session['user_id']])->fetch();
    if (!$row || $row['role']!==$session['role']) reject(401,'Session changed; sign in again');
}
function audit_strict(PDO $db, int $uid, string $action, array $details = []): void
{
    query($db, 'INSERT INTO audit_logs(user_id,action,details,ip_address) VALUES(?,?,?,?)', [$uid,$action,json_encode($details, JSON_THROW_ON_ERROR),client_ip()]);
}
function movement(PDO $db, int $uid, int $ingredient, string $type, int $delta, string $reason, ?int $batch = null, ?int $container = null, ?int $order = null): void
{
    query($db, 'INSERT INTO inventory_transactions(ingredient_id,user_id,order_id,transaction_type,quantity_delta,reason,batch_id,container_id) VALUES(?,?,?,?,?,?,?,?)', [$ingredient,$uid,$order,$type,dec($delta, 3),$reason,$batch,$container]);
}
function containers(PDO $db, int $ingredient, bool $lock = false): array
{
    return query($db, 'SELECT c.*,b.expiration_date,b.quarantined FROM stock_containers c JOIN stock_batches b ON b.id=c.batch_id WHERE b.ingredient_id=? ORDER BY c.id'.($lock ? ' FOR UPDATE' : ''), [$ingredient])->fetchAll();
}
function eligible(array $c, string $at): bool
{
    return !(int)$c['quarantined'] && scaled($c['remaining_qty'], 3, 'stock', true) > 0 &&
        ($c['expiration_date'] === null || $c['expiration_date'] >= substr($at, 0, 10)) &&
        ($c['use_by'] === null || $c['use_by'] > $at);
}
// Opened stock first; FEFO within opened/sealed groups. NULL expiry sorts last.
function allocate(array $rows, int $need, string $at, string $name): array
{
    $rows = array_values(array_filter($rows, fn ($c) => eligible($c, $at)));
    usort($rows, fn ($a, $b) => [($a['opened_at'] === null ? 1 : 0),$a['expiration_date'] ?? '9999-12-31',$a['use_by'] ?? '9999-12-31',$a['id']] <=> [($b['opened_at'] === null ? 1 : 0),$b['expiration_date'] ?? '9999-12-31',$b['use_by'] ?? '9999-12-31',$b['id']]);
    $plan = [];
    foreach ($rows as $row) {
        $take = min($need, scaled($row['remaining_qty'], 3, 'stock', true));
        if ($take > 0) {
            $plan[] = ['container' => $row,'take' => $take];
        }
        $need -= $take;
        if (!$need) {
            break;
        }
    }
    if ($need) {
        reject(409, 'Insufficient stock: '.$name);
    }
    return $plan;
}
function refresh_batch(PDO $db, int $id): void
{
    query($db, 'UPDATE stock_batches SET remaining_qty=(SELECT COALESCE(SUM(remaining_qty),0) FROM stock_containers WHERE batch_id=?), qty_sealed=(SELECT COALESCE(SUM(remaining_qty),0) FROM stock_containers WHERE batch_id=? AND opened_at IS NULL), qty_opened=(SELECT COALESCE(SUM(remaining_qty),0) FROM stock_containers WHERE batch_id=? AND opened_at IS NOT NULL) WHERE id=?', [$id,$id,$id,$id]);
}
function receipt(PDO $db, array $order, bool $duplicate = false): array
{
    $items = query($db, 'SELECT variant_id,variant_label,quantity,unit_price,line_gross,line_net,line_vat FROM order_items WHERE order_id=? ORDER BY order_item_id', [$order['order_id']])->fetchAll();
    return ['success' => true,'duplicate' => $duplicate,'order_id' => (int)$order['order_id'],'sale_at' => $order['sale_at'],'total_gross' => $order['total_gross'],'total_net' => $order['total_net'],'total_vat' => $order['total_vat'],'vat_rate' => $order['vat_rate'],'cash_tendered' => $order['cash_tendered'],'change_due' => $order['change_due'],'items' => $items];
}
function sale_request(array $body): array
{
    $allowed = ['client_transaction_id','tablet_id','event_id','order','items'];
    if (array_diff(array_keys($body), $allowed)) {
        reject(422, 'Unexpected sale field');
    }
    $key = $body['client_transaction_id'] ?? '';
    if (!is_string($key) || !preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iD', $key)) {
        reject(422, 'Invalid transaction key');
    }
    $tablet = $body['tablet_id'] ?? '';
    if (!is_string($tablet) || !preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]{0,15}$/D', $tablet)) {
        reject(422, 'Invalid tablet ID');
    }
    $order = $body['order'] ?? null;
    if (!is_array($order) || array_diff(array_keys($order), ['cash_tendered','created_at'])) {
        reject(422, 'Invalid order');
    }
    $cash = scaled($order['cash_tendered'] ?? null, 2, 'cash tendered');
    $items = $body['items'] ?? null;
    if (!is_array($items) || !array_is_list($items) || !count($items) || count($items) > 100) {
        reject(422, 'Provide 1–100 sale lines');
    }
    $lines = [];
    foreach ($items as $line) {
        if (!is_array($line) || array_diff(array_keys($line), ['variant_id','quantity','expected_price'])) {
            reject(422, 'Invalid sale line');
        }
        $id = integer($line['variant_id'] ?? null, 'variant ID');
        if (isset($lines[$id])) {
            reject(422, 'Combine duplicate variants into one line');
        }
        $lines[$id] = ['variant_id' => $id,'quantity' => integer($line['quantity'] ?? null, 'quantity', 100),'expected_price' => scaled($line['expected_price'] ?? null, 2, 'displayed price')];
    }
    // Preserve basket order for last-line VAT reconciliation, including in hash.
    return ['key' => strtolower($key),'tablet' => $tablet,'event' => isset($body['event_id']) ? integer($body['event_id'], 'event ID') : null,'cash' => $cash,'lines' => array_values($lines)];
}
function commit_sale(PDO $db, array $session, array $body): array
{
    $r = sale_request($body);
    $hash = hash('sha256', json_encode($r, JSON_THROW_ON_ERROR));
    $db->beginTransaction();
    try {
        lock_workflow($db);
        workflow_session_current($db,$session);
        $old = query($db, 'SELECT * FROM orders WHERE client_transaction_id=?', [$r['key']])->fetch();
        if ($old) {
            if ((int)$old['user_id'] !== (int)$session['user_id'] || !hash_equals($old['request_hash'] ?? '', $hash)) {
                reject(409, 'Transaction key already used for a different order or user');
            }
            $result = receipt($db, $old, true);
            $db->commit();
            return $result;
        }
        // One authoritative Manila timestamp AFTER acquiring locks; use throughout.
        $at = now_at($db);
        $need = [];
        $lines = [];
        $gross = 0;
        $netSum = 0;
        foreach ($r['lines'] as $line) {
            $v = query($db, 'SELECT v.*,p.product_name,p.is_active AS product_active,p.is_vat_exempt FROM product_variants v JOIN products p ON p.product_id=v.product_id WHERE v.id=? FOR UPDATE', [$line['variant_id']])->fetch();
            if (!$v || !(int)$v['is_active'] || !(int)$v['product_active'] || (int)$v['is_vat_exempt']) {
                reject(409, 'Variant is unavailable; review this order');
            }
            $price = scaled($v['price'], 2, 'price');
            if ($price !== $line['expected_price']) {
                reject(409, 'Price changed: '.$v['product_name'].'. Review and create a new order.');
            }
            $recipes = query($db, 'SELECT * FROM recipes WHERE variant_id=? ORDER BY ingredient_id', [$v['id']])->fetchAll();
            if (!$recipes) {
                reject(409, 'Recipe missing: '.$v['product_name']);
            }
            foreach ($recipes as $recipe) {
                $id = (int)$recipe['ingredient_id'];
                $need[$id] = ($need[$id] ?? 0) + scaled($recipe['qty'], 3, 'recipe') * $line['quantity'];
            }
            $g = $price * $line['quantity'];
            $n = intdiv($g * 100 + 56, 112);
            $gross += $g;
            $netSum += $n;
            $lines[] = $line + ['product_id' => $v['product_id'],'label' => $v['product_name'].' '.$v['size'].' '.$v['temperature'],'gross' => $g,'net' => $n];
        }
        if ($gross > 9999999999) {
            reject(422, 'Sale exceeds total limit');
        }
        if ($r['cash'] < $gross) {
            reject(422, 'Cash tendered is less than total');
        }
        $net = intdiv($gross * 100 + 56, 112);
        // Reconcile to invoice-level net. Multiple lines can produce >1 cent residual.
        $lines[count($lines) - 1]['net'] += $net - $netSum;
        foreach ($lines as $line) {
            if ($line['net'] < 0 || $line['net'] > $line['gross']) {
                reject(422, 'VAT rounding cannot be allocated to the last line');
            }
        }
        if ($r['event'] !== null && !query($db, 'SELECT event_id FROM events WHERE event_id=?', [$r['event']])->fetch()) {
            reject(422, 'Unknown event');
        }
        ksort($need);
        $plans = [];
        foreach ($need as $id => $qty) {
            $ing = query($db, 'SELECT * FROM ingredients WHERE ingredient_id=? FOR UPDATE', [$id])->fetch();
            if (!$ing || !(int)$ing['is_active']) {
                reject(409, 'Ingredient is inactive');
            }
            $plans[$id] = ['ingredient' => $ing,'allocations' => allocate(containers($db, $id, true), $qty, $at, $ing['ingredient_name'])];
            if (scaled($ing['current_stock'], 3, 'stock', true) < $qty) {
                throw new RuntimeException('Stock cache mismatch');
            }
        }
        // All prices, recipes, stock and cash checked before the first write.
        query($db, 'INSERT INTO orders(client_transaction_id,request_hash,user_id,tablet_id,event_id,total_amount,cash_tendered,change_due,total_gross,total_net,total_vat,vat_rate,sale_at,created_at,committed_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [$r['key'],$hash,$session['user_id'],$r['tablet'],$r['event'],dec($gross),dec($r['cash']),dec($r['cash'] - $gross),dec($gross),dec($net),dec($gross - $net),'0.1200',$at,$at,$at]);
        $oid = (int)$db->lastInsertId();
        foreach ($lines as $line) {
            query($db, 'INSERT INTO order_items(order_id,product_id,variant_id,variant_label,quantity,unit_price,line_gross,line_net,line_vat) VALUES(?,?,?,?,?,?,?,?,?)', [$oid,$line['product_id'],$line['variant_id'],$line['label'],$line['quantity'],dec($line['expected_price']),dec($line['gross']),dec($line['net']),dec($line['gross'] - $line['net'])]);
        }
        foreach ($plans as $id => $plan) {
            foreach ($plan['allocations'] as $allocation) {
                $c = $allocation['container'];
                $take = $allocation['take'];
                if ($c['opened_at'] === null) {
                    $hours = $plan['ingredient']['opened_shelf_life_hours'];
                    $useBy = $hours === null ? null : (new DateTimeImmutable($at))->modify('+'.(int)$hours.' hours')->format('Y-m-d H:i:s');
                    query($db, 'UPDATE stock_containers SET opened_at=?,use_by=? WHERE id=?', [$at,$useBy,$c['id']]);
                    audit_strict($db, (int)$session['user_id'], 'CONTAINER_OPENED', ['container_id' => $c['id'],'opened_at' => $at,'use_by' => $useBy]);
                }
                query($db, 'UPDATE stock_containers SET remaining_qty=remaining_qty-? WHERE id=?', [dec($take, 3),$c['id']]);
                refresh_batch($db, (int)$c['batch_id']);
                movement($db, (int)$session['user_id'], $id, 'SALE', -$take, 'Sale #'.$oid, (int)$c['batch_id'], (int)$c['id'], $oid);
            }
            query($db,'UPDATE ingredients SET current_stock=current_stock-? WHERE ingredient_id=?',[dec($need[$id],3),$id]);
        }
        audit_strict($db,(int)$session['user_id'],'ORDER_COMMIT',['order_id' => $oid,'transaction_id' => $r['key']]);
        $result = receipt($db,query($db,'SELECT * FROM orders WHERE order_id=?',[$oid])->fetch());
        $db->commit();
        return $result;
    } catch (Throwable $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        } throw $e;
    }
}
