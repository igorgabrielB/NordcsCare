<?php
require_once __DIR__ . '/api/config/database.php';
$pdo = Database::getInstance();
$sql = file_get_contents(__DIR__ . '/migration_usuario_tenants.sql');

$lines = explode("\n", $sql);
$cleanLines = [];
foreach ($lines as $line) {
    $trimmed = trim($line);
    if ($trimmed === '' || str_starts_with($trimmed, '--')) continue;
    if (stripos($trimmed, 'USE ') === 0) continue;
    $cleanLines[] = $line;
}
$sql = implode("\n", $cleanLines);
$statements = array_filter(array_map('trim', explode(';', $sql)));

foreach ($statements as $stmt) {
    if (empty($stmt)) continue;
    try {
        $pdo->exec($stmt);
        echo "OK: " . substr(preg_replace('/\s+/', ' ', $stmt), 0, 80) . "\n";
    } catch (PDOException $e) {
        $msg = $e->getMessage();
        if (str_contains($msg, 'already exists') || str_contains($msg, 'Duplicate')) {
            echo "SKIP: " . substr(preg_replace('/\s+/', ' ', $stmt), 0, 80) . "\n";
        } else {
            echo "ERROR: " . substr(preg_replace('/\s+/', ' ', $stmt), 0, 80) . "\n  -> $msg\n";
        }
    }
}
echo "\nDone!\n";
