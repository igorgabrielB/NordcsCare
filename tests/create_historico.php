<?php
require __DIR__ . '/../api/config/env.php';
Env::load(__DIR__ . '/../api/.env');

$pdo = new PDO(
    'mysql:host=' . Env::get('DB_HOST') . ';dbname=' . Env::get('DB_NAME'),
    Env::get('DB_USER'),
    Env::get('DB_PASSWORD')
);

$pdo->exec("
CREATE TABLE IF NOT EXISTS atendimentos_historico (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    paciente_id INT UNSIGNED NOT NULL,
    escola VARCHAR(255) DEFAULT NULL,
    data_atendimento DATE NOT NULL,
    hora_entrada TIME NOT NULL,
    hora_saida TIME DEFAULT NULL,
    resultado ENUM('alta', 'encaminhamento', 'oculos', 'oculos_encaminhamento') NOT NULL,
    diagnostico TEXT DEFAULT NULL,
    conduta_inicial VARCHAR(50) DEFAULT NULL,
    conduta_final VARCHAR(50) DEFAULT NULL,
    medico_id INT UNSIGNED DEFAULT NULL,
    medico_nome VARCHAR(255) DEFAULT NULL,
    observacoes TEXT DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
    FOREIGN KEY (medico_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    INDEX idx_data (data_atendimento),
    INDEX idx_paciente_data (paciente_id, data_atendimento),
    INDEX idx_resultado (resultado),
    INDEX idx_escola (escola)
) ENGINE=InnoDB
");

echo "Tabela atendimentos_historico criada com sucesso!\n";

// Verificar
$cols = $pdo->query("DESCRIBE atendimentos_historico")->fetchAll(PDO::FETCH_ASSOC);
foreach ($cols as $c) {
    echo "  {$c['Field']} ({$c['Type']})\n";
}
