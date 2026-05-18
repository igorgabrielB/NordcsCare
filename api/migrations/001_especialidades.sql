-- ============================================================
-- Migration 001: Especialidades, Fila Dinâmica e Formulários
-- Execute via: mysql -u root nordcscare < 001_especialidades.sql
-- ============================================================

USE nordcscare;

-- ============================================================
-- 1. NOVAS TABELAS
-- ============================================================

CREATE TABLE IF NOT EXISTS especialidades (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT UNSIGNED NOT NULL DEFAULT 1,
    nome VARCHAR(100) NOT NULL,
    descricao TEXT DEFAULT NULL,
    cor VARCHAR(7) NOT NULL DEFAULT '#3182ce',
    icone VARCHAR(50) NOT NULL DEFAULT 'stethoscope',
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tenant (tenant_id),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS fila_estacoes (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT UNSIGNED NOT NULL DEFAULT 1,
    especialidade_id INT UNSIGNED NOT NULL,
    nome VARCHAR(50) NOT NULL,
    label VARCHAR(100) NOT NULL,
    ordem TINYINT UNSIGNED NOT NULL DEFAULT 0,
    cor VARCHAR(7) NOT NULL DEFAULT '#3182ce',
    icone VARCHAR(50) NOT NULL DEFAULT 'user',
    prefixo_senha VARCHAR(3) DEFAULT NULL,
    tipo ENUM('atendimento','saida') NOT NULL DEFAULT 'atendimento',
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_especialidade (especialidade_id),
    INDEX idx_tenant (tenant_id),
    FOREIGN KEY (especialidade_id) REFERENCES especialidades(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS formulario_secoes (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT UNSIGNED NOT NULL DEFAULT 1,
    especialidade_id INT UNSIGNED NOT NULL,
    nome VARCHAR(100) NOT NULL,
    label VARCHAR(150) NOT NULL,
    icone VARCHAR(50) NOT NULL DEFAULT 'file-text',
    ordem TINYINT UNSIGNED NOT NULL DEFAULT 0,
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_especialidade (especialidade_id),
    INDEX idx_tenant (tenant_id),
    FOREIGN KEY (especialidade_id) REFERENCES especialidades(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS formulario_campos (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    secao_id INT UNSIGNED NOT NULL,
    tenant_id INT UNSIGNED NOT NULL DEFAULT 1,
    nome VARCHAR(100) NOT NULL,
    label VARCHAR(150) NOT NULL,
    tipo ENUM('texto','numero','textarea','select','checkbox','data','hora','fracao') NOT NULL DEFAULT 'texto',
    opcoes JSON DEFAULT NULL,
    obrigatorio TINYINT(1) NOT NULL DEFAULT 0,
    placeholder VARCHAR(150) DEFAULT NULL,
    unidade VARCHAR(30) DEFAULT NULL,
    ordem TINYINT UNSIGNED NOT NULL DEFAULT 0,
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_secao (secao_id),
    INDEX idx_tenant (tenant_id),
    FOREIGN KEY (secao_id) REFERENCES formulario_secoes(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS prontuario_dinamico (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT UNSIGNED NOT NULL DEFAULT 1,
    paciente_id INT UNSIGNED NOT NULL,
    especialidade_id INT UNSIGNED NOT NULL,
    medico_id INT UNSIGNED NOT NULL,
    secao_id INT UNSIGNED NOT NULL,
    dados JSON NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_paciente (paciente_id),
    INDEX idx_especialidade (especialidade_id),
    INDEX idx_secao (secao_id),
    INDEX idx_tenant (tenant_id),
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
    FOREIGN KEY (especialidade_id) REFERENCES especialidades(id),
    FOREIGN KEY (medico_id) REFERENCES usuarios(id),
    FOREIGN KEY (secao_id) REFERENCES formulario_secoes(id),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 2. ALTERAR TABELAS EXISTENTES
-- ============================================================

-- Fila: adicionar especialidade_id + converter estacao de ENUM para VARCHAR
ALTER TABLE fila
    ADD COLUMN especialidade_id INT UNSIGNED DEFAULT NULL AFTER tenant_id;

ALTER TABLE fila
    ADD INDEX idx_especialidade (especialidade_id);

ALTER TABLE fila
    MODIFY COLUMN estacao VARCHAR(50) NOT NULL DEFAULT 'acuidade';

-- Laudos: condutas de ENUM para VARCHAR (permite valores livres por especialidade)
ALTER TABLE laudos
    MODIFY COLUMN conduta_inicial VARCHAR(100) DEFAULT NULL,
    MODIFY COLUMN conduta_final VARCHAR(100) DEFAULT NULL;

-- Histórico: resultado de ENUM para VARCHAR
ALTER TABLE atendimentos_historico
    MODIFY COLUMN resultado VARCHAR(100) NOT NULL;

-- ============================================================
-- 3. SEED — Oftalmologia para TODOS os tenants existentes
-- ============================================================

-- Inserir especialidade Oftalmologia para cada tenant que ainda não tem
INSERT INTO especialidades (tenant_id, nome, descricao, cor, icone)
SELECT id, 'Oftalmologia', 'Atendimento oftalmológico', '#38a169', 'eye'
FROM tenants
WHERE id NOT IN (SELECT DISTINCT tenant_id FROM especialidades WHERE nome = 'Oftalmologia');

-- Inserir estações para cada especialidade Oftalmologia recém-criada
INSERT INTO fila_estacoes (tenant_id, especialidade_id, nome, label, ordem, cor, icone, prefixo_senha, tipo)
SELECT e.tenant_id, e.id, 'acuidade', 'Acuidade Visual', 1, '#38a169', 'eye', 'AC', 'atendimento'
FROM especialidades e WHERE e.nome = 'Oftalmologia'
  AND e.id NOT IN (SELECT DISTINCT especialidade_id FROM fila_estacoes WHERE nome = 'acuidade');

INSERT INTO fila_estacoes (tenant_id, especialidade_id, nome, label, ordem, cor, icone, prefixo_senha, tipo)
SELECT e.tenant_id, e.id, 'laudos', 'Laudos', 2, '#805ad5', 'file-text', 'LA', 'atendimento'
FROM especialidades e WHERE e.nome = 'Oftalmologia'
  AND e.id NOT IN (SELECT DISTINCT especialidade_id FROM fila_estacoes WHERE nome = 'laudos');

INSERT INTO fila_estacoes (tenant_id, especialidade_id, nome, label, ordem, cor, icone, prefixo_senha, tipo)
SELECT e.tenant_id, e.id, 'oculos', 'Óculos', 3, '#e53e3e', 'glasses', 'OC', 'atendimento'
FROM especialidades e WHERE e.nome = 'Oftalmologia'
  AND e.id NOT IN (SELECT DISTINCT especialidade_id FROM fila_estacoes WHERE nome = 'oculos');

INSERT INTO fila_estacoes (tenant_id, especialidade_id, nome, label, ordem, cor, icone, prefixo_senha, tipo)
SELECT e.tenant_id, e.id, 'altas', 'Altas', 4, '#22863a', 'check-circle', NULL, 'saida'
FROM especialidades e WHERE e.nome = 'Oftalmologia'
  AND e.id NOT IN (SELECT DISTINCT especialidade_id FROM fila_estacoes WHERE nome = 'altas');

INSERT INTO fila_estacoes (tenant_id, especialidade_id, nome, label, ordem, cor, icone, prefixo_senha, tipo)
SELECT e.tenant_id, e.id, 'encaminhamentos', 'Encaminhamentos', 5, '#6f42c1', 'send', NULL, 'saida'
FROM especialidades e WHERE e.nome = 'Oftalmologia'
  AND e.id NOT IN (SELECT DISTINCT especialidade_id FROM fila_estacoes WHERE nome = 'encaminhamentos');

-- Vincular registros de fila existentes à especialidade Oftalmologia
UPDATE fila f
INNER JOIN especialidades e ON e.tenant_id = f.tenant_id AND e.nome = 'Oftalmologia'
SET f.especialidade_id = e.id
WHERE f.especialidade_id IS NULL;

-- FK: só adicionar após atualizar os dados (pode já existir em re-runs)
ALTER TABLE fila
    ADD CONSTRAINT fk_fila_especialidade
    FOREIGN KEY (especialidade_id) REFERENCES especialidades(id) ON DELETE SET NULL;

-- ============================================================
-- 4. SEED — Formulário padrão Oftalmologia (tenant 1)
-- ============================================================

SET @esp1 = (SELECT id FROM especialidades WHERE tenant_id = 1 AND nome = 'Oftalmologia' LIMIT 1);

INSERT IGNORE INTO formulario_secoes (tenant_id, especialidade_id, nome, label, icone, ordem) VALUES
    (1, @esp1, 'anamnese',   'Anamnese',        'clipboard-list', 1),
    (1, @esp1, 'acuidade',   'Acuidade Visual', 'eye',            2),
    (1, @esp1, 'exames',     'Exames',          'microscope',     3),
    (1, @esp1, 'prescricao', 'Prescrição',      'glasses',        4),
    (1, @esp1, 'laudo',      'Laudo',           'file-text',      5);

-- Campos: Anamnese
SET @sec_an = (SELECT id FROM formulario_secoes WHERE especialidade_id = @esp1 AND nome = 'anamnese' LIMIT 1);
INSERT IGNORE INTO formulario_campos (secao_id, tenant_id, nome, label, tipo, obrigatorio, ordem) VALUES
    (@sec_an, 1, 'queixa_principal',    'Queixa Principal',    'textarea', 0, 1),
    (@sec_an, 1, 'historico_ocular',    'Histórico Ocular',    'textarea', 0, 2),
    (@sec_an, 1, 'historico_familiar',  'Histórico Familiar',  'textarea', 0, 3),
    (@sec_an, 1, 'alergias',            'Alergias',            'textarea', 0, 4),
    (@sec_an, 1, 'medicamentos_em_uso', 'Medicamentos em Uso', 'textarea', 0, 5),
    (@sec_an, 1, 'cirurgias_anteriores','Cirurgias Anteriores','textarea', 0, 6),
    (@sec_an, 1, 'observacoes',         'Observações',         'textarea', 0, 7);

-- Campos: Acuidade Visual
SET @sec_ac = (SELECT id FROM formulario_secoes WHERE especialidade_id = @esp1 AND nome = 'acuidade' LIMIT 1);
INSERT IGNORE INTO formulario_campos (secao_id, tenant_id, nome, label, tipo, obrigatorio, ordem, opcoes) VALUES
    (@sec_ac, 1, 'sem_oculos_od', 'Sem Óculos - OD', 'select',   0, 1, '["20/200","20/150","20/100","20/80","20/70","20/60","20/50","20/40","20/30","20/25","20/20"]'),
    (@sec_ac, 1, 'sem_oculos_oe', 'Sem Óculos - OE', 'select',   0, 2, '["20/200","20/150","20/100","20/80","20/70","20/60","20/50","20/40","20/30","20/25","20/20"]'),
    (@sec_ac, 1, 'usa_oculos',    'Usa Óculos',      'checkbox', 0, 3, NULL),
    (@sec_ac, 1, 'com_oculos_od', 'Com Óculos - OD', 'select',   0, 4, '["20/200","20/150","20/100","20/80","20/70","20/60","20/50","20/40","20/30","20/25","20/20"]'),
    (@sec_ac, 1, 'com_oculos_oe', 'Com Óculos - OE', 'select',   0, 5, '["20/200","20/150","20/100","20/80","20/70","20/60","20/50","20/40","20/30","20/25","20/20"]'),
    (@sec_ac, 1, 'dilata',        'Dilata',          'checkbox', 0, 6, NULL),
    (@sec_ac, 1, 'observacoes',   'Observações',     'textarea', 0, 7, NULL);

-- Campos: Laudo
SET @sec_la = (SELECT id FROM formulario_secoes WHERE especialidade_id = @esp1 AND nome = 'laudo' LIMIT 1);
INSERT IGNORE INTO formulario_campos (secao_id, tenant_id, nome, label, tipo, obrigatorio, ordem, opcoes) VALUES
    (@sec_la, 1, 'diagnostico',      'Diagnóstico',      'textarea', 0, 1, NULL),
    (@sec_la, 1, 'diagnostico_od',   'Diagnóstico OD',   'textarea', 0, 2, NULL),
    (@sec_la, 1, 'diagnostico_oe',   'Diagnóstico OE',   'textarea', 0, 3, NULL),
    (@sec_la, 1, 'conduta_inicial',  'Conduta Inicial',  'select',   0, 4, '["alta","onibus","encaminhamento","onibus_encaminhamento"]'),
    (@sec_la, 1, 'conduta_final',    'Conduta Final',    'select',   0, 5, '["alta","encaminhamento"]'),
    (@sec_la, 1, 'especialidade',    'Especialidade',    'texto',    0, 6, NULL),
    (@sec_la, 1, 'observacoes',      'Observações',      'textarea', 0, 7, NULL);

-- ============================================================
-- 5. NOVAS TELAS NO CATÁLOGO DE PERMISSÕES
-- ============================================================

INSERT IGNORE INTO telas (codigo, nome, descricao, icone, categoria, rota, requer_admin, ordem, ativo) VALUES
    ('especialidades',     'Especialidades',      'Gerenciar especialidades médicas e configurar formulários dinâmicos', 'stethoscope', 'sistema', '/admin/especialidades', 1, 91, 1),
    ('prontuario_dinamico','Prontuário Dinâmico', 'Acessar prontuário dinâmico por especialidade',                      'file-text',   'clinico', '/prontuario-dinamico',  0, 46, 1);
