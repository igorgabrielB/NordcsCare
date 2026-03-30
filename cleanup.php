<?php
// Cleanup script - remove atendimento/clinical data, keep pacientes
$host = 'nordcscare-db.czs8ckmi0nop.sa-east-1.rds.amazonaws.com';
$db   = 'nordcscare';
$user = 'admin';
$pass = '44SAevvB538qxAlyysBY';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    echo "Conectado ao banco.\n";

    $pdo->exec("SET FOREIGN_KEY_CHECKS=0");

    $tables = [
        'fila',
        'atendimentos_historico',
        'anamneses',
        'exames',
        'laudos',
        'prescricoes',
        'acuidade_visual',
        'uploads',
        'audit_log'
    ];

    foreach ($tables as $t) {
        $count = $pdo->query("SELECT COUNT(*) FROM $t")->fetchColumn();
        $pdo->exec("TRUNCATE TABLE $t");
        echo "TRUNCATED $t ($count registros removidos)\n";
    }

    $pdo->exec("SET FOREIGN_KEY_CHECKS=1");

    // Summary
    $pacientes = $pdo->query("SELECT COUNT(*) FROM pacientes")->fetchColumn();
    $usuarios  = $pdo->query("SELECT COUNT(*) FROM usuarios")->fetchColumn();
    $medicos   = $pdo->query("SELECT COUNT(*) FROM medicos")->fetchColumn();
    echo "\n--- DADOS MANTIDOS ---\n";
    echo "Pacientes: $pacientes\n";
    echo "Usuarios: $usuarios\n";
    echo "Medicos: $medicos\n";
    echo "\nLimpeza concluida com sucesso!\n";
} catch (Exception $e) {
    echo "ERRO: " . $e->getMessage() . "\n";
    exit(1);
}
