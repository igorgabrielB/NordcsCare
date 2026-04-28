<?php
/**
 * Migração: Trocar flag master por role 'master' no ENUM.
 * - Altera ENUM para incluir 'master'
 * - Converte usuarios com master=1 para role='master'
 * - Remove coluna master
 */
require_once __DIR__ . '/api/config/database.php';

try {
    $db = Database::getInstance();

    // 1. Alterar ENUM de role para incluir 'master'
    $db->exec("ALTER TABLE usuarios MODIFY COLUMN role ENUM('master','admin','medico','administrativo') NOT NULL DEFAULT 'administrativo'");
    echo "ENUM atualizado com role 'master'.\n";

    // 2. Converter usuarios com master=1 para role='master'
    $count = $db->exec("UPDATE usuarios SET role = 'master' WHERE master = 1");
    echo "Convertidos {$count} usuários para role='master'.\n";

    // 3. Remover coluna master (não é mais necessária)
    $cols = $db->query("SHOW COLUMNS FROM usuarios LIKE 'master'")->fetchAll();
    if (count($cols) > 0) {
        $db->exec("ALTER TABLE usuarios DROP COLUMN master");
        echo "Coluna 'master' removida.\n";
    }

    echo "Migração concluída!\n";
} catch (Exception $e) {
    echo "ERRO: " . $e->getMessage() . "\n";
    exit(1);
}
