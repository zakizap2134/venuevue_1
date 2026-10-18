<?php

require __DIR__.'/../backend/lib/workflow.php';
$c = ['id' => 1,'batch_id' => 1,'quarantined' => 0,'remaining_qty' => '500.000','expiration_date' => '2026-11-20','opened_at' => null,'use_by' => null];
if (!eligible($c, '2026-11-20 23:59:59') || eligible($c, '2026-11-21 00:00:00')) {
    exit(1);
}
$c['use_by'] = '2026-11-20 12:00:00';
$c['opened_at'] = '2026-11-18 12:00:00';
if (!eligible($c, '2026-11-20 11:59:59') || eligible($c, '2026-11-20 12:00:00')) {
    exit(2);
}
$plan = allocate([$c], 1000, '2026-11-20 11:59:59', 'Milk');
if ($plan[0]['take'] !== 1000) {
    exit(3);
}
echo "PASS fixed sale-time expiration and exact opened use-by boundaries\n";
