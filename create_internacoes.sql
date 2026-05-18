CREATE TABLE IF NOT EXISTS leitos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  codigo VARCHAR(20) NOT NULL,
  nome VARCHAR(100) NULL,
  ala VARCHAR(60) NULL,
  andar VARCHAR(30) NULL,
  tipo ENUM('enfermaria','apartamento','uti','semi_uti') NOT NULL DEFAULT 'enfermaria',
  status ENUM('livre','ocupado','higienizacao','reservado') NOT NULL DEFAULT 'livre',
  observacoes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_leito_tenant (tenant_id, codigo),
  INDEX idx_leito_status (tenant_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS internacoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  paciente_id INT NOT NULL,
  leito_id INT NOT NULL,
  medico_id INT NULL,
  usuario_id INT NOT NULL,
  data_admissao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_alta DATETIME NULL,
  motivo_internacao TEXT NOT NULL,
  diagnostico VARCHAR(255) NULL,
  convenio VARCHAR(100) NULL,
  numero_autorizacao VARCHAR(60) NULL,
  observacoes TEXT NULL,
  status ENUM('ativo','alta','transferido','obito') NOT NULL DEFAULT 'ativo',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_internacao_tenant (tenant_id, status),
  INDEX idx_internacao_paciente (paciente_id),
  INDEX idx_internacao_leito (leito_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS evolucoes_internacao (
  id INT AUTO_INCREMENT PRIMARY KEY,
  internacao_id INT NOT NULL,
  tenant_id INT NOT NULL,
  usuario_id INT NOT NULL,
  tipo ENUM('medica','enfermagem','fisioterapia','nutricao','outro') NOT NULL DEFAULT 'medica',
  texto TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_evolucao_internacao (internacao_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO telas (codigo, nome, descricao, icone, categoria)
VALUES ('internacoes', 'Internações', 'Gerenciamento de leitos e internações hospitalares', 'BedDouble', 'operacional');

SELECT 'OK' AS resultado;
