-- Migration 003: Triagem (sinais vitais + protocolo Manchester)
-- Data: 2026-05-18

CREATE TABLE IF NOT EXISTS triagem (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  paciente_id INT NOT NULL,
  usuario_id INT NOT NULL,
  especialidade_id INT NULL,

  -- Pressão arterial
  pa_sistolica SMALLINT UNSIGNED NULL COMMENT 'mmHg',
  pa_diastolica SMALLINT UNSIGNED NULL COMMENT 'mmHg',

  -- Sinais vitais
  frequencia_cardiaca SMALLINT UNSIGNED NULL COMMENT 'bpm',
  frequencia_respiratoria SMALLINT UNSIGNED NULL COMMENT 'ipm',
  saturacao_o2 TINYINT UNSIGNED NULL COMMENT 'SpO2 %',
  temperatura DECIMAL(4,1) NULL COMMENT '°C',

  -- Antropometria
  peso DECIMAL(5,2) NULL COMMENT 'kg',
  altura DECIMAL(5,2) NULL COMMENT 'cm',
  imc DECIMAL(4,2) NULL COMMENT 'calculado automaticamente',

  -- Complementar
  glicemia SMALLINT UNSIGNED NULL COMMENT 'mg/dL',

  -- Triagem clínica
  queixa_principal TEXT NULL,
  dor_escala TINYINT UNSIGNED NULL COMMENT '0–10',
  prioridade ENUM('azul','verde','amarelo','laranja','vermelho') NOT NULL DEFAULT 'verde' COMMENT 'Protocolo Manchester',
  observacoes TEXT NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_triagem_tenant  (tenant_id),
  INDEX idx_triagem_paciente (paciente_id),
  INDEX idx_triagem_data    (tenant_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Registrar tela no sistema de permissões
INSERT IGNORE INTO telas (codigo, nome, descricao, ativo)
VALUES ('triagem', 'Triagem', 'Registro de sinais vitais e triagem Manchester dos pacientes', 1);
