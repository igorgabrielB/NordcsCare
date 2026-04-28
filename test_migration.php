<?php
require_once __DIR__ . '/api/config/database.php';
$pdo = Database::getInstance();

echo "=== Tenants ===\n";
$stmt = $pdo->query('SELECT * FROM tenants');
print_r($stmt->fetchAll());

echo "\n=== Usuarios (primeiros 5) ===\n";
$stmt = $pdo->query('SELECT id, tenant_id, nome, login, role FROM usuarios LIMIT 5');
print_r($stmt->fetchAll());

echo "\n=== Tabelas com tenant_id ===\n";
$tables = ['usuarios','pacientes','fila','anamneses','exames','acuidade_visual','prescricoes','laudos','uploads','modelo_laudos','laudos_prontos','escola_agenda','medicos','atendimentos_historico','modelos_documentos','audit_log'];
foreach ($tables as $t) {
    $stmt = $pdo->query("SHOW COLUMNS FROM $t LIKE 'tenant_id'");
    $col = $stmt->fetch();
    echo "$t: " . ($col ? "OK" : "MISSING") . "\n";
}
