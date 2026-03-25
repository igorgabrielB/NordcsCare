<?php
require_once __DIR__ . '/../api/config/env.php';
Env::load(__DIR__ . '/../api/.env');
$pdo = new PDO(
    'mysql:host=' . Env::get('DB_HOST') . ';dbname=' . Env::get('DB_NAME'),
    Env::get('DB_USER'),
    Env::get('DB_PASSWORD')
);
$stmt = $pdo->query('SELECT id, nome, login, senha, role FROM usuarios');
$users = $stmt->fetchAll(PDO::FETCH_ASSOC);
foreach ($users as $u) {
    echo "ID:{$u['id']} Login:{$u['login']} Role:{$u['role']} Hash:" . substr($u['senha'], 0, 20) . "...\n";
    // Testar senhas comuns
    foreach (['Admin@2026', 'admin123', '266072', 'admin', '12345678'] as $pwd) {
        if (password_verify($pwd, $u['senha'])) {
            echo "  >>> SENHA ENCONTRADA: $pwd\n";
        }
    }
}
