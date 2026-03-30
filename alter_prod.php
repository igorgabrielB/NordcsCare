<?php
$host = 'nordcscare-db.czs8ckmi0nop.sa-east-1.rds.amazonaws.com';
$db   = 'nordcscare';
$user = 'admin';
$pass = '44SAevvB538qxAlyysBY';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $pdo->exec("ALTER TABLE laudos_prontos ADD COLUMN especialidade VARCHAR(100) DEFAULT NULL AFTER observacoes");
    echo "laudos_prontos OK\n";

    $pdo->exec("ALTER TABLE laudos ADD COLUMN especialidade VARCHAR(100) DEFAULT NULL AFTER observacoes");
    echo "laudos OK\n";

    $pdo->exec("ALTER TABLE atendimentos_historico ADD COLUMN especialidade VARCHAR(100) DEFAULT NULL AFTER diagnostico");
    echo "atendimentos_historico OK\n";

    echo "Done!\n";
} catch (Exception $e) {
    echo "ERRO: " . $e->getMessage() . "\n";
}
