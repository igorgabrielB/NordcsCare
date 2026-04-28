<?php
require_once __DIR__ . '/api/config/database.php';
$pdo = Database::getInstance();
$s = $pdo->query('SELECT id, email, login FROM usuarios WHERE id = 1');
print_r($s->fetch());
