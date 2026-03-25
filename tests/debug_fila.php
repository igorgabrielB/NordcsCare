<?php
require __DIR__ . '/../api/config/env.php';
Env::load(__DIR__ . '/../api/.env');

$pdo = new PDO(
    'mysql:host=' . Env::get('DB_HOST') . ';dbname=' . Env::get('DB_NAME'),
    Env::get('DB_USER'),
    Env::get('DB_PASSWORD')
);

echo "=== ANTES DA LIMPEZA ===\n";
$total = $pdo->query('SELECT COUNT(*) FROM fila')->fetchColumn();
echo "Total na fila: $total\n";

$hoje = $pdo->query("SELECT COUNT(*) FROM fila WHERE DATE(created_at) = CURDATE()")->fetchColumn();
echo "De hoje: $hoje\n";
echo "Antigos: " . ($total - $hoje) . "\n\n";

// Limpar registros antigos (não são de hoje)
$deleted = $pdo->exec("DELETE FROM fila WHERE DATE(created_at) < CURDATE()");
echo "=== LIMPEZA ===\n";
echo "Registros antigos removidos: $deleted\n\n";

echo "=== DEPOIS DA LIMPEZA ===\n";
$total = $pdo->query('SELECT COUNT(*) FROM fila')->fetchColumn();
echo "Total na fila: $total\n";

$totais = $pdo->query('SELECT estacao, COUNT(*) as total FROM fila GROUP BY estacao')->fetchAll(PDO::FETCH_ASSOC);
foreach ($totais as $t) {
    echo "  {$t['estacao']}: {$t['total']}\n";
}
echo "\nPronto!\n";
