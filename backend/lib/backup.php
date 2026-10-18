<?php
declare(strict_types=1);
require_once __DIR__.'/workflow.php';

// Fixed table allow-list and dependency order. Uploaded SQL is never executed.
const BACKUP_TABLES=['users','events','products','ingredients','product_variants','recipe_items','recipes','stock_batches','stock_containers','orders','order_items','inventory_transactions','audit_logs'];
const BACKUP_MAX_BYTES=24*1024*1024;

function backup_password(mixed $value): string
{
    if (!is_string($value)||strlen($value)<12||strlen($value)>200) reject(422,'Backup password must be 12–200 characters');
    return $value;
}
function verify_owner_password(PDO $db,array $session,mixed $password): array
{
    $owner=query($db,"SELECT * FROM users WHERE user_id=? AND role='OWNER' AND is_active=1",[$session['user_id']])->fetch();
    if (!$owner||!is_string($password)||!password_verify($password,$owner['password_hash'])) reject(403,'Current owner password is incorrect');
    return $owner;
}
function backup_snapshot(PDO $db): array
{
    $tables=[];
    foreach (BACKUP_TABLES as $table) $tables[$table]=$db->query("SELECT * FROM `$table`")->fetchAll();
    return ['format'=>'venuevue-data','version'=>2,'created_at'=>now_at($db),'tables'=>$tables];
}
function backup_encrypt(array $snapshot,string $password): array
{
    $plain=json_encode($snapshot,JSON_THROW_ON_ERROR);
    if (strlen($plain)>BACKUP_MAX_BYTES) reject(413,'Backup exceeds the 24 MB application-backup limit; use the documented host database backup');
    $salt=random_bytes(16);$iv=random_bytes(12);$tag='';
    $key=hash_pbkdf2('sha256',$password,$salt,210000,32,true);
    $cipher=openssl_encrypt($plain,'aes-256-gcm',$key,OPENSSL_RAW_DATA,$iv,$tag,'venuevue-backup-v2');
    if ($cipher===false) throw new RuntimeException('Backup encryption failed');
    return ['format'=>'venuevue-encrypted-backup','version'=>2,'salt'=>base64_encode($salt),'iv'=>base64_encode($iv),'tag'=>base64_encode($tag),'data'=>base64_encode($cipher)];
}
function backup_decrypt(mixed $envelope,string $password): array
{
    if (!is_array($envelope)||($envelope['format']??'')!=='venuevue-encrypted-backup'||($envelope['version']??null)!==2) reject(422,'Unsupported backup format');
    $parts=[];
    foreach (['salt'=>16,'iv'=>12,'tag'=>16,'data'=>null] as $name=>$length) {
        if (!is_string($envelope[$name]??null)||strlen($envelope[$name])>BACKUP_MAX_BYTES*1.4) reject(422,'Invalid backup encoding or file size');
        $value=base64_decode($envelope[$name],true);
        if ($value===false||($length!==null&&strlen($value)!==$length)) reject(422,'Invalid backup encoding');
        $parts[$name]=$value;
    }
    $key=hash_pbkdf2('sha256',$password,$parts['salt'],210000,32,true);
    $plain=openssl_decrypt($parts['data'],'aes-256-gcm',$key,OPENSSL_RAW_DATA,$parts['iv'],$parts['tag'],'venuevue-backup-v2');
    if ($plain===false) reject(422,'Backup password is incorrect or the file was modified');
    $snapshot=json_decode($plain,true);
    if (!is_array($snapshot)||($snapshot['format']??'')!=='venuevue-data'||($snapshot['version']??null)!==2||!isset($snapshot['tables'])) reject(422,'Invalid backup contents');
    return $snapshot;
}
function backup_validate(PDO $db,array $snapshot,array $owner): array
{
    $tables=$snapshot['tables'];
    if (!is_array($tables)||array_diff(array_keys($tables),BACKUP_TABLES)||array_diff(BACKUP_TABLES,array_keys($tables))) reject(422,'Backup tables do not match this application version');
    $counts=[];$total=0;$sourceOwner=null;
    foreach (BACKUP_TABLES as $table) {
        $rows=$tables[$table];
        if (!is_array($rows)||!array_is_list($rows)) reject(422,'Invalid backup rows');
        $counts[$table]=count($rows);$total+=count($rows);
        if ($total>100000) reject(413,'Backup exceeds the 100,000-row application limit');
        $columns=array_column($db->query("SHOW COLUMNS FROM `$table`")->fetchAll(),'Field');
        foreach ($rows as $row) {
            if (!is_array($row)||array_diff(array_keys($row),$columns)||array_diff($columns,array_keys($row))) reject(422,'Backup schema differs from the installed version');
            foreach($row as $value) if (!is_scalar($value)&&$value!==null) reject(422,'Invalid backup cell');
            if ($table==='users') {
                if (!in_array($row['role'],['OWNER','BARISTA'],true)) reject(422,'Backup contains an invalid role');
                if ($row['username']===$owner['username'] && $row['role']==='OWNER' && (int)$row['is_active']===1) $sourceOwner=$row;
            }
        }
    }
    if (!$sourceOwner) reject(422,'Backup must contain your active owner username. Use the matching owner account.');
    return ['created_at'=>$snapshot['created_at'],'counts'=>$counts,'owner_id'=>(int)$sourceOwner['user_id']];
}
function backup_check_invariants(PDO $db): void
{
    $checks=[
        "SELECT COUNT(*) FROM stock_batches b WHERE b.remaining_qty<>(SELECT COALESCE(SUM(c.remaining_qty),0) FROM stock_containers c WHERE c.batch_id=b.id) OR b.qty_sealed<>(SELECT COALESCE(SUM(c.remaining_qty),0) FROM stock_containers c WHERE c.batch_id=b.id AND c.opened_at IS NULL) OR b.qty_opened<>(SELECT COALESCE(SUM(c.remaining_qty),0) FROM stock_containers c WHERE c.batch_id=b.id AND c.opened_at IS NOT NULL)",
        "SELECT COUNT(*) FROM ingredients i WHERE i.current_stock<(SELECT COALESCE(SUM(b.remaining_qty),0) FROM stock_batches b WHERE b.ingredient_id=i.ingredient_id)",
        "SELECT COUNT(*) FROM order_items WHERE line_gross IS NOT NULL AND (line_net IS NULL OR line_vat IS NULL OR line_net<0 OR line_vat<0 OR line_gross<>line_net+line_vat)",
        "SELECT COUNT(*) FROM orders o WHERE o.total_gross IS NOT NULL AND (o.total_net IS NULL OR o.total_vat IS NULL OR o.total_gross<>o.total_net+o.total_vat OR o.total_gross<>(SELECT COALESCE(SUM(line_gross),0) FROM order_items WHERE order_id=o.order_id) OR o.total_net<>(SELECT COALESCE(SUM(line_net),0) FROM order_items WHERE order_id=o.order_id))",
    ];
    foreach($checks as $sql) if ((int)$db->query($sql)->fetchColumn()>0) reject(422,'Backup stock or VAT totals are inconsistent; restore rolled back');
}
function backup_action(PDO $db,array $session,array $body): array
{
    if ($session['role']!=='OWNER') reject(403,'Owner access required');
    $action=$body['action']??'';
    if ($action==='restore_preview') {
        $password=backup_password($body['backup_password']??null);
        $owner=verify_owner_password($db,$session,$body['current_password']??null);
        $snapshot=backup_decrypt($body['envelope']??null,$password);
        $summary=backup_validate($db,$snapshot,$owner);$token=bin2hex(random_bytes(32));
        query($db,'DELETE FROM restore_jobs WHERE expires_at<NOW()');
        query($db,'INSERT INTO restore_jobs(token_hash,session_id,user_id,envelope,expires_at) VALUES(?,?,?,?,DATE_ADD(NOW(),INTERVAL 10 MINUTE))',[hash('sha256',$token),$session['session_id'],$session['user_id'],json_encode($body['envelope'],JSON_THROW_ON_ERROR)]);
        return ['success'=>true,'preview_token'=>$token,'summary'=>$summary];
    }
    $db->beginTransaction();
    try {
        lock_workflow($db);
        workflow_session_current($db,$session);
        $owner=verify_owner_password($db,$session,$body['current_password']??null);
        if ($action==='backup_download') {
            $envelope=backup_encrypt(backup_snapshot($db),backup_password($body['backup_password']??null));
            audit_strict($db,(int)$owner['user_id'],'BACKUP_DOWNLOADED');
            $db->commit();return ['success'=>true,'envelope'=>$envelope];
        }
        if ($action==='safety_download') {
            $row=query($db,'SELECT envelope FROM safety_backups WHERE id=?',[integer($body['id']??null,'backup ID')])->fetch();
            if (!$row) reject(404,'Safety backup not found');
            $db->commit();return ['success'=>true,'envelope'=>json_decode($row['envelope'],true)];
        }
        if ($action!=='restore_apply'||($body['confirmation']??'')!=='RESTORE') reject(422,'Type RESTORE to confirm replacement');
        $token=$body['preview_token']??'';
        if (!is_string($token)||!preg_match('/^[a-f0-9]{64}$/D',$token)) reject(422,'Invalid preview token');
        $job=query($db,'SELECT * FROM restore_jobs WHERE token_hash=? AND user_id=? AND session_id=? AND expires_at>NOW() FOR UPDATE',[hash('sha256',$token),$owner['user_id'],$session['session_id']])->fetch();
        if (!$job) reject(409,'Preview expired or already used; preview the backup again');
        $password=backup_password($body['backup_password']??null);
        $snapshot=backup_decrypt(json_decode($job['envelope'],true),$password);
        $summary=backup_validate($db,$snapshot,$owner);
        $safety=backup_encrypt(backup_snapshot($db),$password);
        query($db,'INSERT INTO safety_backups(user_id,envelope,created_at) VALUES(?,?,NOW())',[$owner['user_id'],json_encode($safety,JSON_THROW_ON_ERROR)]);
        $safetyId=(int)$db->lastInsertId();
        query($db,'DELETE FROM api_sessions');
        foreach(array_reverse(BACKUP_TABLES) as $table) $db->exec("DELETE FROM `$table`");
        foreach(BACKUP_TABLES as $table) {
            foreach($snapshot['tables'][$table] as $row) {
                // Keep the authenticated owner's current recovery credentials.
                if ($table==='users' && (int)$row['user_id']===$summary['owner_id']) {
                    $row['password_hash']=$owner['password_hash'];$row['recovery_hash']=$owner['recovery_hash'];
                }
                $columns=array_keys($row);
                query($db,'INSERT INTO `'.$table.'` (`'.implode('`,`',$columns).'`) VALUES ('.implode(',',array_fill(0,count($columns),'?')).')',array_values($row));
            }
        }
        backup_check_invariants($db);
        audit_strict($db,$summary['owner_id'],'BACKUP_RESTORED',['source_created_at'=>$summary['created_at'],'safety_backup_id'=>$safetyId]);
        query($db,'DELETE FROM restore_jobs');
        $db->commit();
        return ['success'=>true,'safety_backup_id'=>$safetyId,'sign_in_required'=>true];
    } catch(Throwable $e) { if($db->inTransaction())$db->rollBack();throw $e; }
}
