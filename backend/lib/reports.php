<?php
declare(strict_types=1);
require_once __DIR__.'/management.php';
function dashboard(PDO $db): array
{
    $snapshot=management_snapshot($db);$today=substr($snapshot['server_time'],0,10);
    $report=sales_report($db,$today,$today);
    return ['success'=>true,'server_time'=>$snapshot['server_time'],'totals'=>$report['totals'],
        'low_stock'=>array_values(array_filter($snapshot['ingredients'],fn($i)=>(int)$i['is_active']===1 && scaled($i['eligible_stock'],3,'stock',true)<=scaled($i['minimum_stock'],3,'threshold',true))),
        'ingredients'=>$snapshot['ingredients'],'recent_sales'=>array_slice($report['sales'],0,10)];
}
function history_page(PDO $db,array $params): array
{
    $kind=$params['kind']??'audit';
    if (!in_array($kind,['audit','movements'],true)) reject(422,'Invalid history type');
    $page=integer($params['page']??1,'page',100000);$limit=30;$offset=($page-1)*$limit;
    $table=$kind==='audit'?'audit_logs':'inventory_transactions';$pk=$kind==='audit'?'audit_log_id':'inventory_transaction_id';
    $where=[];$args=[];
    if (!empty($params['from']) && !empty($params['to']) && date_value($params['from'])>date_value($params['to'])) reject(422,'From date must not be after through date');
    foreach(['from'=>'>=','to'=>'<='] as $key=>$op) if (($params[$key]??'')!=='') {
        $date=date_value($params[$key]);$where[]="t.created_at $op ?";$args[]=$date.($key==='from'?' 00:00:00':' 23:59:59');
    }
    if (($params['search']??'')!=='') {
        $term=text_value($params['search'],'search',100);
        $column=$kind==='audit'?'t.action':'t.reason';
        $where[]="($column LIKE ? OR u.username LIKE ?)";$args[]='%'.$term.'%';$args[]='%'.$term.'%';
    }
    $filter=$where?' WHERE '.implode(' AND ',$where):'';
    $count=(int)query($db,"SELECT COUNT(*) FROM $table t LEFT JOIN users u ON u.user_id=t.user_id".$filter,$args)->fetchColumn();
    $rows=query($db,"SELECT t.*,u.username FROM $table t LEFT JOIN users u ON u.user_id=t.user_id".$filter." ORDER BY t.$pk DESC LIMIT $limit OFFSET $offset",$args)->fetchAll();
    return ['success'=>true,'rows'=>$rows,'page'=>$page,'total'=>$count,'pages'=>(int)ceil($count/$limit)];
}
