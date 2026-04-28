<?php
/**
 * Migration: Criar tabela dashboard_config para layouts personalizados
 */
require_once 'api/config/database.php';

$db = Database::getInstance();

echo "=== Migration: Dashboard Config ===\n\n";

// Criar tabela de configuração de dashboard
$sql = "
CREATE TABLE IF NOT EXISTS dashboard_config (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT UNSIGNED NOT NULL,
    usuario_id INT UNSIGNED NULL COMMENT 'NULL = config padrão do tenant',
    nome VARCHAR(100) NOT NULL DEFAULT 'Meu Dashboard',
    layout JSON NOT NULL COMMENT 'Configuração do grid layout',
    is_default TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_default (tenant_id, usuario_id, is_default)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
";

try {
    $db->exec($sql);
    echo "[OK] Tabela dashboard_config criada\n";
} catch (PDOException $e) {
    echo "[ERRO] " . $e->getMessage() . "\n";
}

// Criar configuração padrão para cada tenant existente
$tenants = $db->query("SELECT id FROM tenants")->fetchAll(PDO::FETCH_ASSOC);

$defaultLayout = json_encode([
    'widgets' => [
        ['i' => 'total-matriculados', 'x' => 0, 'y' => 0, 'w' => 3, 'h' => 2, 'type' => 'metric', 'config' => ['metric' => 'total_matriculados', 'title' => 'Total Matriculados', 'icon' => 'Users', 'color' => '#63b3ed']],
        ['i' => 'pacientes-dia', 'x' => 3, 'y' => 0, 'w' => 3, 'h' => 2, 'type' => 'metric', 'config' => ['metric' => 'pacientes_do_dia', 'title' => 'Pacientes do Dia', 'icon' => 'School', 'color' => '#48bb78']],
        ['i' => 'na-fila', 'x' => 6, 'y' => 0, 'w' => 3, 'h' => 2, 'type' => 'metric', 'config' => ['metric' => 'na_fila', 'title' => 'Na Fila', 'icon' => 'ClipboardList', 'color' => '#ecc94b']],
        ['i' => 'atendimentos', 'x' => 9, 'y' => 0, 'w' => 3, 'h' => 2, 'type' => 'metric', 'config' => ['metric' => 'atendimentos_hoje', 'title' => 'Atendimentos', 'icon' => 'Stethoscope', 'color' => '#68d391']],
        ['i' => 'escolas-hoje', 'x' => 0, 'y' => 2, 'w' => 6, 'h' => 4, 'type' => 'schools-today', 'config' => ['title' => 'Escolas do Dia']],
        ['i' => 'fila-estacoes', 'x' => 6, 'y' => 2, 'w' => 6, 'h' => 4, 'type' => 'queue-stations', 'config' => ['title' => 'Fila por Estação']],
        ['i' => 'grafico-atendimentos', 'x' => 0, 'y' => 6, 'w' => 8, 'h' => 4, 'type' => 'chart-line', 'config' => ['title' => 'Atendimentos por Dia', 'dataKey' => 'atendimentos_por_dia']],
        ['i' => 'condutas', 'x' => 8, 'y' => 6, 'w' => 4, 'h' => 4, 'type' => 'chart-pie', 'config' => ['title' => 'Condutas Iniciais', 'dataKey' => 'condutas_iniciais']],
    ]
]);

foreach ($tenants as $tenant) {
    try {
        $stmt = $db->prepare("
            INSERT IGNORE INTO dashboard_config (tenant_id, usuario_id, nome, layout, is_default)
            VALUES (:tid, NULL, 'Dashboard Padrão', :layout, 1)
        ");
        $stmt->execute([':tid' => $tenant['id'], ':layout' => $defaultLayout]);
        echo "[OK] Config padrão criada para tenant {$tenant['id']}\n";
    } catch (PDOException $e) {
        echo "[INFO] Tenant {$tenant['id']}: " . $e->getMessage() . "\n";
    }
}

echo "\n=== Migration concluída ===\n";
