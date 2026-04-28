<?php
/**
 * Adiciona coluna `master` na tabela usuarios.
 * Marca como master os admins do antigo tenant 1.
 */
require_once __DIR__ . '/api/config/database.php';

try {
    $db = Database::getInstance();

    // Verificar se coluna já existe
    $cols = $db->query("SHOW COLUMNS FROM usuarios LIKE 'master'")->fetchAll();
    if (count($cols) > 0) {
        echo "Coluna 'master' já existe.\n";
    } else {
        $db->exec("ALTER TABLE usuarios ADD COLUMN master TINYINT(1) NOT NULL DEFAULT 0 AFTER role");
        echo "Coluna 'master' adicionada.\n";
    }

    // Marcar admins do tenant 1 como master (migração dos existentes)
    $stmt = $db->exec("UPDATE usuarios SET master = 1 WHERE tenant_id = 1 AND role = 'admin'");
    echo "Admins do tenant 1 marcados como master: {$stmt} registros.\n";

    echo "Migração concluída!\n";
} catch (Exception $e) {
    echo "ERRO: " . $e->getMessage() . "\n";
    exit(1);
}
