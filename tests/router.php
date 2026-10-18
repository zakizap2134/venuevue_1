<?php

// Test-only router for the production build. Do not deploy the tests directory.
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (in_array($path, ['/backend/auth.php','/backend/api.php','/backend/sync.php','/backend/backup.php'], true)) {
    require dirname(__DIR__).$path;
    return;
}
$root = realpath(dirname(__DIR__).'/dist');
$file = realpath($root.$path);
if ($file && str_starts_with($file, $root.DIRECTORY_SEPARATOR) && is_file($file)) {
    $ext = pathinfo($file, PATHINFO_EXTENSION);
    header('Content-Type: '.(['js' => 'text/javascript','css' => 'text/css','svg' => 'image/svg+xml','png' => 'image/png'][$ext] ?? 'application/octet-stream'));
    readfile($file);
    return;
}
header('Content-Type: text/html; charset=utf-8');
readfile($root.'/index.html');
