-- =========================================================
-- Migration 002: Agendamentos + Médico-Especialidade
-- =========================================================

-- Pivot: médico pode atender em várias especialidades
CREATE TABLE IF NOT EXISTS medico_especialidades (
  medico_id        INT UNSIGNED NOT NULL,
  especialidade_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (medico_id, especialidade_id),
  FOREIGN KEY (medico_id)        REFERENCES medicos(id)       ON DELETE CASCADE,
  FOREIGN KEY (especialidade_id) REFERENCES especialidades(id) ON DELETE CASCADE
);

-- Agendamentos de pacientes
CREATE TABLE IF NOT EXISTS agendamentos (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id        INT UNSIGNED NOT NULL DEFAULT 1,
  paciente_id      INT UNSIGNED NOT NULL,
  medico_id        INT UNSIGNED NULL,
  especialidade_id INT UNSIGNED NOT NULL,
  data_hora        DATETIME NOT NULL,
  duracao_min      SMALLINT UNSIGNED NOT NULL DEFAULT 30,
  tipo             ENUM('consulta','retorno','exame','cirurgia','triagem') NOT NULL DEFAULT 'consulta',
  status           ENUM('agendado','confirmado','cancelado','realizado','falta') NOT NULL DEFAULT 'agendado',
  observacoes      TEXT NULL,
  fila_id          INT UNSIGNED NULL,
  notificado_em    DATETIME NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant_data   (tenant_id, data_hora),
  INDEX idx_paciente      (paciente_id),
  INDEX idx_medico        (medico_id),
  INDEX idx_especialidade (especialidade_id)
);

-- Tela de controle de acesso
INSERT IGNORE INTO telas (nome, descricao) VALUES
  ('agendamentos', 'Agendamentos de pacientes');
