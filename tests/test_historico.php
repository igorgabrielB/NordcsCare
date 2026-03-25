<?php
// Test historico API endpoints
require __DIR__ . '/../api/config/env.php';
Env::load(__DIR__ . '/../api/.env');

$pdo = new PDO(
    'mysql:host=' . Env::get('DB_HOST') . ';dbname=' . Env::get('DB_NAME'),
    Env::get('DB_USER'),
    Env::get('DB_PASSWORD')
);

echo "=== Teste: atendimentos_historico ===\n\n";

// Check table exists
$cols = $pdo->query("DESCRIBE atendimentos_historico")->fetchAll(PDO::FETCH_ASSOC);
echo "Tabela existe com " . count($cols) . " colunas\n";

// Check records
$count = $pdo->query("SELECT COUNT(*) FROM atendimentos_historico")->fetchColumn();
echo "Registros no histórico: {$count}\n\n";

// Test: simulate saving a record
echo "=== Testando INSERT no histórico ===\n";

// Find a test patient
$stmt = $pdo->query("SELECT id, nome_completo, convenio FROM pacientes LIMIT 1");
$paciente = $stmt->fetch(PDO::FETCH_ASSOC);
if ($paciente) {
    echo "Paciente de teste: {$paciente['nome_completo']} (ID: {$paciente['id']})\n";
    
    // Insert test record
    $stmt = $pdo->prepare(
        "INSERT INTO atendimentos_historico (paciente_id, escola, data_atendimento, hora_entrada, hora_saida, resultado, diagnostico, conduta_inicial, medico_nome)
         VALUES (:pid, :escola, CURDATE(), '08:00:00', '09:30:00', 'alta', 'Teste diagnóstico', 'alta', 'Dr. Teste')"
    );
    $stmt->execute([':pid' => $paciente['id'], ':escola' => $paciente['convenio']]);
    $histId = $pdo->lastInsertId();
    echo "Registro inserido com ID: {$histId}\n";

    // Read back
    $stmt = $pdo->prepare("SELECT * FROM atendimentos_historico WHERE id = :id");
    $stmt->execute([':id' => $histId]);
    $hist = $stmt->fetch(PDO::FETCH_ASSOC);
    echo "Data: {$hist['data_atendimento']}, Entrada: {$hist['hora_entrada']}, Saída: {$hist['hora_saida']}, Resultado: {$hist['resultado']}\n";

    // Clean up test record
    $pdo->prepare("DELETE FROM atendimentos_historico WHERE id = :id")->execute([':id' => $histId]);
    echo "Registro de teste removido\n";
} else {
    echo "Nenhum paciente encontrado para teste\n";
}

echo "\n=== Tudo OK! ===\n";
