-- =============================================
-- NordcsCare - Migration: Multi-Tenancy
-- Adiciona suporte a múltiplos clientes (tenants)
-- =============================================

USE nordcscare;

-- =============================================
-- 1. Tabela mestra de tenants (clientes)
-- =============================================
CREATE TABLE IF NOT EXISTS tenants (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    slug VARCHAR(50) NOT NULL UNIQUE,
    logo_url VARCHAR(500) DEFAULT NULL,
    config JSON DEFAULT NULL,
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 2. Criar tenant padrão para dados existentes
-- =============================================
INSERT INTO tenants (id, nome, slug) VALUES (1, 'Padrão', 'padrao');

-- =============================================
-- 3. Adicionar tenant_id em todas as tabelas de dados
-- =============================================

-- usuarios
ALTER TABLE usuarios
    ADD COLUMN tenant_id INT UNSIGNED NOT NULL DEFAULT 1 AFTER id,
    ADD INDEX idx_tenant (tenant_id),
    ADD FOREIGN KEY fk_usuarios_tenant (tenant_id) REFERENCES tenants(id);

-- pacientes
ALTER TABLE pacientes
    ADD COLUMN tenant_id INT UNSIGNED NOT NULL DEFAULT 1 AFTER id,
    ADD INDEX idx_tenant (tenant_id),
    ADD FOREIGN KEY fk_pacientes_tenant (tenant_id) REFERENCES tenants(id);

-- fila
ALTER TABLE fila
    ADD COLUMN tenant_id INT UNSIGNED NOT NULL DEFAULT 1 AFTER id,
    ADD INDEX idx_tenant (tenant_id),
    ADD FOREIGN KEY fk_fila_tenant (tenant_id) REFERENCES tenants(id);

-- anamneses
ALTER TABLE anamneses
    ADD COLUMN tenant_id INT UNSIGNED NOT NULL DEFAULT 1 AFTER id,
    ADD INDEX idx_tenant (tenant_id),
    ADD FOREIGN KEY fk_anamneses_tenant (tenant_id) REFERENCES tenants(id);

-- exames
ALTER TABLE exames
    ADD COLUMN tenant_id INT UNSIGNED NOT NULL DEFAULT 1 AFTER id,
    ADD INDEX idx_tenant (tenant_id),
    ADD FOREIGN KEY fk_exames_tenant (tenant_id) REFERENCES tenants(id);

-- acuidade_visual
ALTER TABLE acuidade_visual
    ADD COLUMN tenant_id INT UNSIGNED NOT NULL DEFAULT 1 AFTER id,
    ADD INDEX idx_tenant (tenant_id),
    ADD FOREIGN KEY fk_acuidade_tenant (tenant_id) REFERENCES tenants(id);

-- prescricoes
ALTER TABLE prescricoes
    ADD COLUMN tenant_id INT UNSIGNED NOT NULL DEFAULT 1 AFTER id,
    ADD INDEX idx_tenant (tenant_id),
    ADD FOREIGN KEY fk_prescricoes_tenant (tenant_id) REFERENCES tenants(id);

-- laudos
ALTER TABLE laudos
    ADD COLUMN tenant_id INT UNSIGNED NOT NULL DEFAULT 1 AFTER id,
    ADD INDEX idx_tenant (tenant_id),
    ADD FOREIGN KEY fk_laudos_tenant (tenant_id) REFERENCES tenants(id);

-- uploads
ALTER TABLE uploads
    ADD COLUMN tenant_id INT UNSIGNED NOT NULL DEFAULT 1 AFTER id,
    ADD INDEX idx_tenant (tenant_id),
    ADD FOREIGN KEY fk_uploads_tenant (tenant_id) REFERENCES tenants(id);

-- modelo_laudos
ALTER TABLE modelo_laudos
    ADD COLUMN tenant_id INT UNSIGNED NOT NULL DEFAULT 1 AFTER id,
    ADD INDEX idx_tenant (tenant_id),
    ADD FOREIGN KEY fk_modelo_laudos_tenant (tenant_id) REFERENCES tenants(id);

-- laudos_prontos
ALTER TABLE laudos_prontos
    ADD COLUMN tenant_id INT UNSIGNED NOT NULL DEFAULT 1 AFTER id,
    ADD INDEX idx_tenant (tenant_id),
    ADD FOREIGN KEY fk_laudos_prontos_tenant (tenant_id) REFERENCES tenants(id);

-- escola_agenda
ALTER TABLE escola_agenda
    ADD COLUMN tenant_id INT UNSIGNED NOT NULL DEFAULT 1 AFTER id,
    ADD INDEX idx_tenant (tenant_id),
    ADD FOREIGN KEY fk_escola_agenda_tenant (tenant_id) REFERENCES tenants(id);

-- medicos
ALTER TABLE medicos
    ADD COLUMN tenant_id INT UNSIGNED NOT NULL DEFAULT 1 AFTER id,
    ADD INDEX idx_tenant (tenant_id),
    ADD FOREIGN KEY fk_medicos_tenant (tenant_id) REFERENCES tenants(id);

-- atendimentos_historico
ALTER TABLE atendimentos_historico
    ADD COLUMN tenant_id INT UNSIGNED NOT NULL DEFAULT 1 AFTER id,
    ADD INDEX idx_tenant (tenant_id),
    ADD FOREIGN KEY fk_historico_tenant (tenant_id) REFERENCES tenants(id);

-- modelos_documentos
ALTER TABLE modelos_documentos
    ADD COLUMN tenant_id INT UNSIGNED NOT NULL DEFAULT 1 AFTER id,
    ADD INDEX idx_tenant (tenant_id),
    ADD FOREIGN KEY fk_modelos_doc_tenant (tenant_id) REFERENCES tenants(id);

-- audit_log
ALTER TABLE audit_log
    ADD COLUMN tenant_id INT UNSIGNED DEFAULT 1 AFTER id,
    ADD INDEX idx_tenant (tenant_id);

-- spotvision_mapeamento
ALTER TABLE spotvision_mapeamento
    ADD COLUMN tenant_id INT UNSIGNED NOT NULL DEFAULT 1 AFTER id,
    ADD INDEX idx_tenant (tenant_id),
    ADD FOREIGN KEY fk_spotvision_map_tenant (tenant_id) REFERENCES tenants(id);

-- spotvision_ocr_cache
ALTER TABLE spotvision_ocr_cache
    ADD COLUMN tenant_id INT UNSIGNED NOT NULL DEFAULT 1 AFTER id,
    ADD INDEX idx_tenant (tenant_id),
    ADD FOREIGN KEY fk_spotvision_ocr_tenant (tenant_id) REFERENCES tenants(id);

-- =============================================
-- 4. Ajustar UNIQUE constraints para incluir tenant_id
--    (login pode repetir entre tenants diferentes)
-- =============================================

-- usuarios: login deve ser único apenas dentro do tenant
ALTER TABLE usuarios DROP INDEX login;
ALTER TABLE usuarios ADD UNIQUE KEY uk_tenant_login (tenant_id, login);

-- pacientes: codigo deve ser único apenas dentro do tenant
ALTER TABLE pacientes DROP INDEX codigo;
ALTER TABLE pacientes ADD UNIQUE KEY uk_tenant_codigo (tenant_id, codigo);

-- pacientes: cpf deve ser único apenas dentro do tenant
ALTER TABLE pacientes DROP INDEX cpf;
ALTER TABLE pacientes ADD UNIQUE KEY uk_tenant_cpf (tenant_id, cpf);

-- medicos: crm deve ser único apenas dentro do tenant
ALTER TABLE medicos DROP INDEX crm;
ALTER TABLE medicos ADD UNIQUE KEY uk_tenant_crm (tenant_id, crm);

-- escola_agenda: unique key escola+data deve incluir tenant
ALTER TABLE escola_agenda DROP INDEX uk_escola_data;
ALTER TABLE escola_agenda ADD UNIQUE KEY uk_tenant_escola_data (tenant_id, escola, data_atendimento);

-- =============================================
-- 5. Nota
-- =============================================
-- Todos os dados existentes recebem tenant_id = 1 (tenant 'Padrão').
-- Para criar um novo cliente, basta:
--   INSERT INTO tenants (nome, slug) VALUES ('Nome do Cliente', 'slug-do-cliente');
-- E criar um usuário admin para esse tenant:
--   INSERT INTO usuarios (tenant_id, nome, login, senha, role)
--   VALUES (<tenant_id>, 'Admin', 'admin', '<hash>', 'admin');
