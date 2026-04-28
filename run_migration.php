<?php
/**
 * Executa a migration de multi-tenancy via PDO
 * Use: php run_migration.php
 */

require_once __DIR__ . '/api/config/database.php';

$pdo = Database::getInstance();
$sql = file_get_contents(__DIR__ . '/migration_multitenancy.sql');

// Remove comentários de linha única e linhas USE
$lines = explode("\n", $sql);
$cleanLines = [];
foreach ($lines as $line) {
    $trimmed = trim($line);
    if ($trimmed === '' || str_starts_with($trimmed, '--')) continue;
    if (stripos($trimmed, 'USE ') === 0) continue;
    $cleanLines[] = $line;
}
$sql = implode("\n", $cleanLines);

// Split por ponto-e-vírgula
$statements = array_filter(array_map('trim', explode(';', $sql)));

$success = 0;
$errors = 0;

foreach ($statements as $stmt) {
    if (empty($stmt)) continue;
    try {
        $pdo->exec($stmt);
        $success++;
        // Show first 80 chars
        echo "OK: " . substr(preg_replace('/\s+/', ' ', $stmt), 0, 80) . "\n";
    } catch (PDOException $e) {
        $errors++;
        $msg = $e->getMessage();
        $short = substr(preg_replace('/\s+/', ' ', $stmt), 0, 80);
        // Duplicate column/table = already migrated, not a real error
        if (str_contains($msg, 'Duplicate column') || str_contains($msg, 'already exists')) {
            echo "SKIP (already exists): $short\n";
        } else {
            echo "ERROR: $short\n  -> $msg\n";
        }
    }
}

echo "\nDone: $success OK, $errors skipped/errors\n";
