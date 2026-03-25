-- Create atendimentos_historico table
CREATE TABLE IF NOT EXISTS atendimentos_historico (
    id INT AUTO_INCREMENT PRIMARY KEY,
    paciente_id INT UNSIGNED NOT NULL,
    escola VARCHAR(255) DEFAULT NULL,
    data_atendimento DATE NOT NULL,
    hora_entrada TIME DEFAULT NULL,
    hora_saida TIME DEFAULT NULL,
    resultado ENUM('alta','encaminhamento','oculos','oculos_encaminhamento') DEFAULT NULL,
    diagnostico TEXT DEFAULT NULL,
    conduta_inicial TEXT DEFAULT NULL,
    conduta_final TEXT DEFAULT NULL,
    medico_id INT DEFAULT NULL,
    medico_nome VARCHAR(255) DEFAULT NULL,
    observacoes TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
    INDEX idx_data (data_atendimento),
    INDEX idx_paciente_data (paciente_id, data_atendimento),
    INDEX idx_resultado (resultado),
    INDEX idx_escola (escola)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add nacionalidade and naturalidade columns to pacientes
ALTER TABLE pacientes ADD COLUMN nacionalidade VARCHAR(60) DEFAULT NULL AFTER sexo;
ALTER TABLE pacientes ADD COLUMN naturalidade VARCHAR(100) DEFAULT NULL AFTER nacionalidade;
