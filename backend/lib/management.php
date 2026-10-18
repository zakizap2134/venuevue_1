<?php

declare(strict_types=1);
require_once __DIR__.'/workflow.php';
function catalogue(PDO $db): array
{
    $at = now_at($db);
    $available = [];
    $ingredients = $db->query('SELECT * FROM ingredients ORDER BY ingredient_id')->fetchAll();
    foreach ($ingredients as $i) {
        $total = 0;
        foreach (containers($db, (int)$i['ingredient_id']) as $c) {
            if (eligible($c, $at)) {
                $total += scaled($c['remaining_qty'], 3, 'stock', true);
            }
        }
        $available[$i['ingredient_id']] = (int)$i['is_active'] ? $total : 0;
    }
    $variants = $db->query('SELECT v.*,p.product_name,p.category FROM product_variants v JOIN products p ON p.product_id=v.product_id WHERE v.is_active=1 AND p.is_active=1 AND p.is_vat_exempt=0 ORDER BY p.product_name,FIELD(v.size,"S","M","L"),v.temperature')->fetchAll();
    foreach ($variants as &$v) {
        $rows = query($db, 'SELECT * FROM recipes WHERE variant_id=?', [$v['id']])->fetchAll();
        $count = $rows ? PHP_INT_MAX : 0;
        foreach ($rows as $r) {
            $count = min($count, intdiv($available[$r['ingredient_id']] ?? 0, scaled($r['qty'], 3, 'recipe')));
        }
        $v['available_count'] = $count;
    }
    return ['success' => true,'variants' => $variants,'server_time' => $at];
}
function management_snapshot(PDO $db): array
{
    $at = now_at($db);
    $ings = $db->query('SELECT * FROM ingredients ORDER BY ingredient_name')->fetchAll();
    foreach ($ings as &$i) {
        $eligible = 0;
        $waste = 0;
        $allocated = 0;
        foreach (containers($db, (int)$i['ingredient_id']) as $c) {
            $q = scaled($c['remaining_qty'], 3, 'stock', true);
            $allocated += $q;
            if (eligible($c, $at)) {
                $eligible += $q;
            } elseif (!(int)$c['quarantined']) {
                $waste += $q;
            }
        }
        $i['eligible_stock'] = dec($eligible, 3);
        $i['waste_due'] = dec($waste, 3);
        $i['unallocated_stock'] = dec(scaled($i['current_stock'], 3, 'stock', true) - $allocated, 3);
    }
    $cs = $db->query('SELECT c.*,b.ingredient_id,b.reference,b.expiration_date,b.quarantined FROM stock_containers c JOIN stock_batches b ON b.id=c.batch_id WHERE c.remaining_qty>0 ORDER BY b.id,c.id')->fetchAll();
    foreach ($cs as &$c) {
        $c['eligible'] = eligible($c, $at);
    }
    return ['success' => true,'ingredients' => $ings,'products' => $db->query('SELECT * FROM products ORDER BY product_name')->fetchAll(),'variants' => $db->query('SELECT * FROM product_variants ORDER BY product_id,id')->fetchAll(),'recipes' => $db->query('SELECT * FROM recipes ORDER BY variant_id,ingredient_id')->fetchAll(),'batches' => $db->query('SELECT * FROM stock_batches ORDER BY id DESC')->fetchAll(),'containers' => $cs,'staff' => $db->query("SELECT user_id,username,is_active FROM users WHERE role='BARISTA' ORDER BY username")->fetchAll(),'movements' => $db->query('SELECT * FROM inventory_transactions ORDER BY inventory_transaction_id DESC LIMIT 100')->fetchAll(),'audit' => $db->query('SELECT audit_log_id,user_id,action,details,created_at FROM audit_logs ORDER BY audit_log_id DESC LIMIT 100')->fetchAll(),'server_time' => $at];
}
function save_management(PDO $db, array $session, array $b): array
{
    if ($session['role'] !== 'OWNER') {
        reject(403, 'Owner/Admin access required');
    }
    $action = $b['action'] ?? '';
    $uid = (int)$session['user_id'];
    $db->beginTransaction();
    try {
        lock_workflow($db);
        workflow_session_current($db,$session);
        $at = now_at($db);
        $result = ['success' => true];
        switch ($action) {
            case 'ingredient':
                $name = text_value($b['name'] ?? null, 'ingredient name');
                $unit = $b['unit'] ?? '';
                if (!in_array($unit, ['g','mL','units'], true)) {
                    reject(422, 'Invalid unit');
                }
                $min = scaled($b['minimum_stock'] ?? '0', 3, 'threshold', true);
                $hours = ($b['opened_shelf_life_hours'] ?? '') === '' ? null : integer($b['opened_shelf_life_hours'], 'shelf life', 87600);
                if (isset($b['id'])) {
                    $id = integer($b['id'], 'ingredient');
                    $old = query($db, 'SELECT * FROM ingredients WHERE ingredient_id=?', [$id])->fetch();
                    if (!$old) {
                        reject(404, 'Ingredient not found');
                    }
                    if ($old['unit'] !== $unit && (scaled($old['current_stock'],3,'stock',true)>0 || query($db,'SELECT ingredient_id FROM recipes WHERE ingredient_id=? UNION SELECT ingredient_id FROM recipe_items WHERE ingredient_id=? UNION SELECT ingredient_id FROM stock_batches WHERE ingredient_id=? UNION SELECT ingredient_id FROM inventory_transactions WHERE ingredient_id=? LIMIT 1',[$id,$id,$id,$id])->fetch())) {
                        reject(409, 'This ingredient has recipes or stock history. Create a new ingredient to use a different unit.');
                    }
                    query($db, 'UPDATE ingredients SET ingredient_name=?,unit=?,minimum_stock=?,opened_shelf_life_hours=?,is_active=? WHERE ingredient_id=?', [$name,$unit,dec($min, 3),$hours,management_flag($b),$id]);
                } else {
                    query($db, 'INSERT INTO ingredients(ingredient_name,unit,minimum_stock,opened_shelf_life_hours,is_active) VALUES(?,?,?,?,?)', [$name,$unit,dec($min, 3),$hours,management_flag($b)]);
                    $id = (int)$db->lastInsertId();
                }
                $result['id'] = $id;
                break;
            case 'product':
                $name = text_value($b['name'] ?? null, 'product name');
                $category = text_value($b['category'] ?? 'Coffee', 'category', 50);
                if (isset($b['id'])) {
                    management_exists($db,'products','product_id',integer($b['id'],'product'));
                    query($db, 'UPDATE products SET product_name=?,category=?,is_active=? WHERE product_id=?', [$name,$category,management_flag($b),integer($b['id'], 'product')]);
                } else {
                    query($db, 'INSERT INTO products(product_name,category,unit_price,is_active) VALUES(?,?,0,?)', [$name,$category,management_flag($b)]);
                    $result['id'] = (int)$db->lastInsertId();
                } break;
            case 'variant':
                $product = integer($b['product_id'] ?? null, 'product');
                $size = $b['size'] ?? '';
                $temp = $b['temperature'] ?? 'NA';
                if (!in_array($size, ['S','M','L'], true) || !in_array($temp, ['HOT','ICED','NA'], true)) {
                    reject(422, 'Invalid size or temperature');
                }
                $sku = text_value($b['sku'] ?? null, 'SKU', 64);
                $price = dec(scaled($b['price'] ?? null, 2, 'price'));
                management_exists($db,'products','product_id',$product);
                if (isset($b['id'])) {
                    $old=management_exists($db,'product_variants','id',integer($b['id'],'variant'));
                    if ((int)$old['product_id']!==$product) reject(422,'A variant cannot be moved to another product');
                    query($db, 'UPDATE product_variants SET size=?,temperature=?,sku=?,price=?,is_active=? WHERE id=? AND product_id=?', [$size,$temp,$sku,$price,management_flag($b),integer($b['id'], 'variant'),$product]);
                } else {
                    query($db, 'INSERT INTO product_variants(product_id,size,temperature,sku,price,is_active) VALUES(?,?,?,?,?,?)', [$product,$size,$temp,$sku,$price,management_flag($b)]);
                    $result['id'] = (int)$db->lastInsertId();
                } break;
            case 'recipe':
                $vid = integer($b['variant_id'] ?? null, 'variant');
                management_exists($db,'product_variants','id',$vid);
                $rows = $b['rows'] ?? [];
                if (!is_array($rows) || !array_is_list($rows) || count($rows) > 100) {
                    reject(422, 'Provide up to 100 explicit recipe rows');
                }
                $validated = [];
                foreach ($rows as $r) {
                    $id = integer($r['ingredient_id'] ?? null, 'ingredient');
                    management_exists($db,'ingredients','ingredient_id',$id);
                    if (isset($validated[$id])) {
                        reject(422, 'Duplicate ingredient');
                    }
                    $validated[$id] = scaled($r['qty'] ?? null, 3, 'recipe quantity');
                }
                query($db, 'DELETE FROM recipes WHERE variant_id=?', [$vid]);
                foreach ($validated as $id => $q) {
                    query($db, 'INSERT INTO recipes VALUES(?,?,?)', [$vid,$id,dec($q, 3)]);
                }break;
            case 'restock':
            case 'adjust_in':
            case 'reconcile':
                $iid = integer($b['ingredient_id'] ?? null, 'ingredient');
                $ing = query($db, 'SELECT * FROM ingredients WHERE ingredient_id=?', [$iid])->fetch();
                if (!$ing) {
                    reject(404, 'Ingredient missing');
                }
                $count = integer($b['container_count'] ?? null, 'container count', 1000);
                $per = scaled($b['quantity_per_container'] ?? null, 3, 'container quantity');
                $total = $count * $per;
                if ($total > 999999999999) {
                    reject(422, 'Delivery too large');
                }
                $expiry = date_value($b['expiration_date'] ?? null);
                if ($ing['opened_shelf_life_hours'] !== null && $expiry === null) {
                    reject(422, 'Expiration date required for perishable ingredients');
                }
                $ref = text_value($b['reference'] ?? null, 'delivery reference');
                if ($action === 'reconcile') {
                    $allocated = query($db, 'SELECT COALESCE(SUM(remaining_qty),0) FROM stock_batches WHERE ingredient_id=?', [$iid])->fetchColumn();
                    $unallocated = scaled($ing['current_stock'], 3, 'stock', true) - scaled($allocated, 3, 'allocated stock', true);
                    if ($total > $unallocated) {
                        reject(409, 'Reconciliation exceeds unallocated stock');
                    }
                    query($db, 'UPDATE ingredients SET current_stock=current_stock-? WHERE ingredient_id=?', [dec($total, 3),$iid]);
                    movement($db, $uid, $iid, 'ADJUSTMENT', -$total, 'Allocate legacy stock: '.$ref);
                }
                query($db, 'INSERT INTO stock_batches(ingredient_id,reference,received_qty,remaining_qty,qty_sealed,expiration_date,user_id,received_at) VALUES(?,?,?,?,?,?,?,?)', [$iid,$ref,dec($total, 3),dec($total, 3),dec($total, 3),$expiry,$uid,$at]);
                $bid = (int)$db->lastInsertId();
                query($db,'UPDATE stock_batches SET supplier=?,lot_reference=? WHERE id=?',[management_optional($b['supplier']??''),management_optional($b['lot_reference']??''),$bid]);
                for ($i = 0;$i < $count;$i++) {
                    query($db, 'INSERT INTO stock_containers(batch_id,received_qty,remaining_qty) VALUES(?,?,?)', [$bid,dec($per, 3),dec($per, 3)]);
                    $cid = (int)$db->lastInsertId();
                    movement($db, $uid, $iid, $action === 'restock' ? 'RESTOCK' : 'ADJUSTMENT', $per, $ref, $bid, $cid);
                }
                query($db, 'UPDATE ingredients SET current_stock=current_stock+? WHERE ingredient_id=?', [dec($total, 3),$iid]);
                $result['id'] = $bid;
                break;
            case 'batch_update':
                $id=integer($b['id']??null,'batch');
                $old=management_exists($db,'stock_batches','id',$id);
                $expiry=date_value($b['expiration_date']??null);
                $ingredient=management_exists($db,'ingredients','ingredient_id',(int)$old['ingredient_id']);
                if ($ingredient['opened_shelf_life_hours']!==null && $expiry===null) reject(422,'Expiration required for perishable stock');
                $reason=text_value($b['reason']??null,'correction reason',255);
                query($db,'UPDATE stock_batches SET reference=?,supplier=?,lot_reference=?,expiration_date=?,quarantined=? WHERE id=?',[
                    text_value($b['reference']??null,'reference'),management_optional($b['supplier']??''),management_optional($b['lot_reference']??''),$expiry,management_flag($b,'quarantined',0),$id]);
                audit_strict($db,$uid,'BATCH_METADATA_CHANGED',['batch_id'=>$id,'before'=>$old,'reason'=>$reason,'expiration_date'=>$expiry]);
                $result['id']=$id;
                break;
            case 'delete_product':
            case 'delete_variant':
            case 'delete_ingredient':
                management_delete($db,$action,integer($b['id']??null,'record'));
                $result['id']=(int)$b['id'];
                break;
            case 'waste':
            case 'adjust_out':
                $cid = integer($b['container_id'] ?? null, 'container');
                $qty = scaled($b['qty'] ?? null, 3, 'quantity');
                $reason = text_value($b['reason'] ?? null, 'reason', 255);
                $c = query($db, 'SELECT c.*,b.ingredient_id FROM stock_containers c JOIN stock_batches b ON b.id=c.batch_id WHERE c.id=? FOR UPDATE', [$cid])->fetch();
                if (!$c || scaled($c['remaining_qty'], 3, 'stock', true) < $qty) {
                    reject(409, 'Quantity exceeds container stock');
                }
                query($db, 'UPDATE stock_containers SET remaining_qty=remaining_qty-? WHERE id=?', [dec($qty, 3),$cid]);
                refresh_batch($db, (int)$c['batch_id']);
                query($db, 'UPDATE ingredients SET current_stock=current_stock-? WHERE ingredient_id=?', [dec($qty, 3),$c['ingredient_id']]);
                movement($db, $uid, (int)$c['ingredient_id'], $action === 'waste' ? 'WASTE' : 'ADJUSTMENT', -$qty, $reason, (int)$c['batch_id'], $cid);
                break;
            case 'staff_create':
            case 'staff_reset':
                $password = text_value($b['password'] ?? null, 'password', 200);
                if (strlen($password) < 12) {
                    reject(422, 'Use at least 12 characters');
                }
                if ($action === 'staff_create') {
                    query($db, "INSERT INTO users(username,password_hash,role) VALUES(?,?,'BARISTA')", [text_value($b['username'] ?? null, 'username', 64),password_hash($password, PASSWORD_DEFAULT)]);
                    $id = (int)$db->lastInsertId();
                } else {
                    $id = integer($b['user_id'] ?? null, 'staff user');
                    if (!query($db, "SELECT user_id FROM users WHERE user_id=? AND role='BARISTA'", [$id])->fetch()) {
                        reject(403, 'Only Barista accounts can be reset here');
                    }
                    query($db, 'UPDATE users SET password_hash=? WHERE user_id=?', [password_hash($password, PASSWORD_DEFAULT),$id]);
                    query($db, 'DELETE FROM api_sessions WHERE user_id=?', [$id]);
                }
                $result['id'] = $id;
                break;
            case 'recovery_issue':
                $owner = query($db, 'SELECT password_hash FROM users WHERE user_id=?', [$uid])->fetch();
                if (!is_string($b['password'] ?? null) || !password_verify($b['password'], $owner['password_hash'])) {
                    reject(403, 'Current owner password required');
                }
                $code = bin2hex(random_bytes(24));
                query($db, 'UPDATE users SET recovery_hash=? WHERE user_id=?', [password_hash($code, PASSWORD_DEFAULT),$uid]);
                $result['recovery_code'] = $code;
                break;
            default: reject(422, 'Unknown management action');
        }
        // Never log passwords, recovery codes, session tokens or complete request bodies.
        audit_strict($db, $uid, 'MANAGE_'.strtoupper($action), ['id' => $result['id'] ?? ($b['id'] ?? $b['variant_id'] ?? $b['container_id'] ?? $b['user_id'] ?? null)]);
        $db->commit();
        return $result;
    } catch (Throwable $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }throw $e;
    }
}
function management_exists(PDO $db,string $table,string $pk,int $id): array
{
    // Table and key names are internal literals, never request fields.
    $row=query($db,"SELECT * FROM $table WHERE $pk=?",[$id])->fetch();
    if (!$row) reject(404,'Record not found');
    return $row;
}
function management_flag(array $body,string $name='is_active',int $default=1): int
{
    $value=$body[$name]??$default;
    if (!in_array($value,[0,1,'0','1',false,true],true)) reject(422,"Invalid $name");
    return (int)$value;
}
function management_optional(mixed $value): ?string
{
    if ($value===null || $value==='') return null;
    return text_value($value,'supplier / lot reference');
}
function management_delete(PDO $db,string $action,int $id): void
{
    [$table,$pk]=match($action) {
        'delete_product'=>['products','product_id'],
        'delete_variant'=>['product_variants','id'],
        default=>['ingredients','ingredient_id'],
    };
    $row=management_exists($db,$table,$pk,$id);
    if ($action==='delete_product') {
        $used=query($db,'SELECT product_id FROM product_variants WHERE product_id=? UNION SELECT product_id FROM order_items WHERE product_id=? UNION SELECT product_id FROM recipe_items WHERE product_id=? LIMIT 1',[$id,$id,$id])->fetch();
    } elseif ($action==='delete_variant') {
        $used=query($db,'SELECT variant_id FROM order_items WHERE variant_id=? LIMIT 1',[$id])->fetch();
        if (!$used) query($db,'DELETE FROM recipes WHERE variant_id=?',[$id]);
    } else {
        $used=scaled($row['current_stock'],3,'stock',true)>0 || query($db,'SELECT ingredient_id FROM recipes WHERE ingredient_id=? UNION SELECT ingredient_id FROM recipe_items WHERE ingredient_id=? UNION SELECT ingredient_id FROM stock_batches WHERE ingredient_id=? UNION SELECT ingredient_id FROM inventory_transactions WHERE ingredient_id=? LIMIT 1',[$id,$id,$id,$id])->fetch();
    }
    if ($used) reject(409,'This record is referenced by recipes, variants or history. Set Active to No to archive it.');
    query($db,"DELETE FROM $table WHERE $pk=?",[$id]);
}
function sales_report(PDO $db, string $from, string $to): array
{
    if (!date_value($from) || !date_value($to) || $from > $to) {
        reject(422,'Invalid report dates');
    }
    $orders = query($db,'SELECT * FROM orders WHERE sale_at>=? AND sale_at<DATE_ADD(?,INTERVAL 1 DAY) ORDER BY order_id DESC',[$from,$to])->fetchAll();
    $g = 0;
    $n = 0;
    $v = 0;
    $sales = [];
    foreach ($orders as $o) {
        $g += scaled($o['total_gross'],2,'gross',true);
        $n += scaled($o['total_net'],2,'net',true);
        $v += scaled($o['total_vat'],2,'vat',true);
        $sales[] = receipt($db,$o);
    }
    return ['success' => true,'sales' => $sales,'totals' => ['gross' => dec($g),'net' => dec($n),'vat' => dec($v),'count' => count($sales)],'from' => $from,'to' => $to];
}
