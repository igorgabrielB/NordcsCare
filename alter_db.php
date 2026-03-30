<?php
$pdo = new PDO('mysql:host=127.0.0.1;dbname=nordcscare', 'root', '266072');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$pdo->exec("ALTER TABLE laudos_prontos ADD COLUMN especialidade VARCHAR(100) DEFAULT NULL AFTER observacoes");
echo "laudos_prontos OK\n";

$pdo->exec("ALTER TABLE laudos ADD COLUMN especialidade VARCHAR(100) DEFAULT NULL AFTER observacoes");
echo "laudos OK\n";

$pdo->exec("ALTER TABLE atendimentos_historico ADD COLUMN especialidade VARCHAR(100) DEFAULT NULL AFTER diagnostico");
echo "atendimentos_historico OK\n";

echo "Done!\n";
