-- =============================================
-- NordcsCare - Sistema de Prontuário Oftalmológico
-- Schema do Banco de Dados
-- =============================================

CREATE DATABASE IF NOT EXISTS nordcscare
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE nordcscare;

-- =============================================
-- Tabela: tenants
-- =============================================
CREATE TABLE IF NOT EXISTS tenants (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    slug VARCHAR(50) NOT NULL UNIQUE,
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tenant padrão
INSERT INTO tenants (id, nome, slug) VALUES (1, 'Principal', 'principal');

-- =============================================
-- Tabela: usuarios
-- =============================================
CREATE TABLE IF NOT EXISTS usuarios (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT UNSIGNED NOT NULL DEFAULT 1,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    login VARCHAR(30) NOT NULL,
    senha VARCHAR(255) NOT NULL,
    role ENUM('master', 'admin', 'medico', 'administrativo') NOT NULL DEFAULT 'administrativo',
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_login_tenant (login, tenant_id),
    INDEX idx_tenant (tenant_id),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB;

-- =============================================
-- Tabela: pacientes
-- =============================================
CREATE TABLE IF NOT EXISTS pacientes (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT UNSIGNED NOT NULL DEFAULT 1,
    codigo VARCHAR(6) NOT NULL,
    nome_completo VARCHAR(150) NOT NULL,
    cpf VARCHAR(14),
    data_nascimento DATE,
    sexo ENUM('M', 'F', 'Outro') DEFAULT NULL,
    nacionalidade VARCHAR(60) DEFAULT NULL,
    naturalidade VARCHAR(100) DEFAULT NULL,
    telefone VARCHAR(20),
    email VARCHAR(100),
    cep VARCHAR(10),
    rua VARCHAR(150),
    numero VARCHAR(20),
    complemento VARCHAR(100),
    bairro VARCHAR(100),
    cidade VARCHAR(100),
    estado VARCHAR(2),
    convenio VARCHAR(100),
    escola VARCHAR(150),
    responsavel VARCHAR(150),
    numero_convenio VARCHAR(50),
    observacoes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_codigo_tenant (codigo, tenant_id),
    UNIQUE KEY uk_cpf_tenant (cpf, tenant_id),
    INDEX idx_nome (nome_completo),
    INDEX idx_tenant (tenant_id),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB;

-- =============================================
-- Tabela: fila
-- =============================================
CREATE TABLE IF NOT EXISTS fila (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT UNSIGNED NOT NULL DEFAULT 1,
    paciente_id INT UNSIGNED NOT NULL,
    estacao ENUM('acuidade', 'exames', 'laudos', 'oculos', 'altas', 'encaminhamentos') NOT NULL DEFAULT 'acuidade',
    status ENUM('aguardando', 'em_atendimento', 'concluido') NOT NULL DEFAULT 'aguardando',
    atendente_id INT UNSIGNED DEFAULT NULL,
    prioridade TINYINT UNSIGNED NOT NULL DEFAULT 0,
    observacoes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
    FOREIGN KEY (atendente_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    INDEX idx_estacao_status (estacao, status),
    INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB;

-- =============================================
-- Tabela: anamneses
-- =============================================
CREATE TABLE IF NOT EXISTS anamneses (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT UNSIGNED NOT NULL DEFAULT 1,
    paciente_id INT UNSIGNED NOT NULL,
    medico_id INT UNSIGNED NOT NULL,
    queixa_principal TEXT,
    historico_ocular TEXT,
    historico_familiar TEXT,
    alergias TEXT,
    medicamentos_em_uso TEXT,
    cirurgias_anteriores TEXT,
    historico_pessoal TEXT,
    observacoes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
    FOREIGN KEY (medico_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB;

-- =============================================
-- Tabela: exames
-- =============================================
CREATE TABLE IF NOT EXISTS exames (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT UNSIGNED NOT NULL DEFAULT 1,
    paciente_id INT UNSIGNED NOT NULL,
    medico_id INT UNSIGNED NOT NULL,
    tipo_exame ENUM('acuidade_visual', 'refracao', 'tonometria', 'spot_vision', 'eyer', 'retinografia', 'biomicroscopia', 'outro') NOT NULL,
    olho ENUM('OD', 'OE', 'AO') NOT NULL DEFAULT 'AO',
    resultado TEXT,
    observacoes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
    FOREIGN KEY (medico_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    INDEX idx_tenant_exames (tenant_id)
) ENGINE=InnoDB;

-- =============================================
-- Tabela: acuidade_visual
-- =============================================
CREATE TABLE IF NOT EXISTS acuidade_visual (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT UNSIGNED NOT NULL DEFAULT 1,
    paciente_id INT UNSIGNED NOT NULL,
    medico_id INT UNSIGNED NOT NULL,
    sem_oculos_od VARCHAR(10) DEFAULT NULL,
    sem_oculos_oe VARCHAR(10) DEFAULT NULL,
    usa_oculos TINYINT(1) NOT NULL DEFAULT 0,
    com_oculos_od VARCHAR(10) DEFAULT NULL,
    com_oculos_oe VARCHAR(10) DEFAULT NULL,
    dilata TINYINT(1) NOT NULL DEFAULT 0,
    observacoes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
    FOREIGN KEY (medico_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    INDEX idx_tenant_acuidade (tenant_id)
) ENGINE=InnoDB;

-- =============================================
-- Tabela: prescricoes
-- =============================================
CREATE TABLE IF NOT EXISTS prescricoes (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT UNSIGNED NOT NULL DEFAULT 1,
    paciente_id INT UNSIGNED NOT NULL,
    medico_id INT UNSIGNED NOT NULL,
    tipo ENUM('oculos', 'lentes_contato') NOT NULL DEFAULT 'oculos',
    od_esferico VARCHAR(20) DEFAULT NULL,
    od_cilindrico VARCHAR(20) DEFAULT NULL,
    od_eixo INT DEFAULT NULL,
    od_adicao VARCHAR(20) DEFAULT NULL,
    oe_esferico VARCHAR(20) DEFAULT NULL,
    oe_cilindrico VARCHAR(20) DEFAULT NULL,
    oe_eixo INT DEFAULT NULL,
    oe_adicao VARCHAR(20) DEFAULT NULL,
    dp DECIMAL(4,1) DEFAULT NULL,
    acuidade_od VARCHAR(20) DEFAULT NULL,
    acuidade_oe VARCHAR(20) DEFAULT NULL,
    observacoes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
    FOREIGN KEY (medico_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    INDEX idx_tenant_prescricoes (tenant_id)
) ENGINE=InnoDB;

-- =============================================
-- Tabela: laudos
-- =============================================
CREATE TABLE IF NOT EXISTS laudos (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT UNSIGNED NOT NULL DEFAULT 1,
    paciente_id INT UNSIGNED NOT NULL,
    medico_id INT UNSIGNED NOT NULL,
    diagnostico TEXT,
    diagnostico_od TEXT DEFAULT NULL,
    diagnostico_oe TEXT DEFAULT NULL,
    conduta_inicial ENUM('alta', 'onibus', 'encaminhamento', 'onibus_encaminhamento') DEFAULT NULL,
    conduta_final ENUM('alta', 'encaminhamento', 'alta_sem_oculos') DEFAULT NULL,
    observacoes TEXT,
    especialidade VARCHAR(100) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
    FOREIGN KEY (medico_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    INDEX idx_tenant_laudos (tenant_id)
) ENGINE=InnoDB;

-- =============================================
-- Tabela: uploads
-- =============================================
CREATE TABLE IF NOT EXISTS uploads (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT UNSIGNED NOT NULL DEFAULT 1,
    paciente_id INT UNSIGNED NOT NULL,
    tipo VARCHAR(50),
    nome_arquivo VARCHAR(255) NOT NULL,
    caminho_arquivo VARCHAR(500) NOT NULL,
    uploaded_by INT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES usuarios(id) ON DELETE RESTRICT,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    INDEX idx_tenant_uploads (tenant_id)
) ENGINE=InnoDB;

-- =============================================
-- Tabela: modelo_laudos
-- =============================================
CREATE TABLE IF NOT EXISTS modelo_laudos (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT UNSIGNED NOT NULL DEFAULT 1,
    nome VARCHAR(100) NOT NULL,
    dados JSON DEFAULT NULL,
    usuario_id INT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    INDEX idx_tenant_modelo (tenant_id)
) ENGINE=InnoDB;

-- =============================================
-- Tabela: laudos_prontos
-- =============================================
CREATE TABLE IF NOT EXISTS laudos_prontos (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT UNSIGNED NOT NULL DEFAULT 1,
    titulo VARCHAR(150) NOT NULL,
    diagnostico TEXT NOT NULL,
    conduta VARCHAR(50) DEFAULT NULL,
    observacoes TEXT,
    especialidade VARCHAR(100) DEFAULT NULL,
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    usuario_id INT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    INDEX idx_tenant_lp (tenant_id)
) ENGINE=InnoDB;

-- =============================================
-- Tabela: escola_agenda
-- =============================================
CREATE TABLE IF NOT EXISTS escola_agenda (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT UNSIGNED NOT NULL DEFAULT 1,
    escola VARCHAR(150) NOT NULL,
    data_atendimento DATE NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_escola_data_tenant (escola, data_atendimento, tenant_id),
    INDEX idx_data (data_atendimento),
    INDEX idx_tenant_ea (tenant_id),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB;

-- =============================================
-- Tabela: medicos
-- =============================================
CREATE TABLE IF NOT EXISTS medicos (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT UNSIGNED NOT NULL DEFAULT 1,
    usuario_id INT UNSIGNED DEFAULT NULL,
    nome VARCHAR(150) NOT NULL,
    crm VARCHAR(20) NOT NULL,
    uf VARCHAR(2) DEFAULT 'CE',
    especialidade VARCHAR(100) DEFAULT 'Oftalmologia',
    telefone VARCHAR(20) DEFAULT NULL,
    email VARCHAR(100) DEFAULT NULL,
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_crm_tenant (crm, tenant_id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    INDEX idx_tenant_medicos (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- Tabela: modelos_documentos
-- =============================================
CREATE TABLE IF NOT EXISTS modelos_documentos (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT UNSIGNED NOT NULL DEFAULT 1,
    tipo ENUM('atestado', 'receita_medica') NOT NULL,
    nome VARCHAR(100) NOT NULL,
    conteudo LONGTEXT NOT NULL,
    usuario_id INT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tipo (tipo),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    INDEX idx_tenant_md (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- Tabela: audit_log (Registro de Auditoria)
-- =============================================
CREATE TABLE IF NOT EXISTS audit_log (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT UNSIGNED DEFAULT 1,
    usuario_id INT UNSIGNED NULL,
    usuario_nome VARCHAR(100),
    usuario_role VARCHAR(30),
    acao VARCHAR(50) NOT NULL,
    entidade VARCHAR(50) NOT NULL,
    entidade_id INT UNSIGNED NULL,
    detalhes TEXT,
    ip VARCHAR(45),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_created (created_at),
    INDEX idx_audit_usuario (usuario_id),
    INDEX idx_audit_acao (acao),
    INDEX idx_audit_entidade (entidade, entidade_id),
    INDEX idx_tenant_audit (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- Tabela: atendimentos_historico
-- Armazena histórico completo de atendimentos finalizados para relatórios.
-- =============================================
CREATE TABLE IF NOT EXISTS atendimentos_historico (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT UNSIGNED NOT NULL DEFAULT 1,
    paciente_id INT UNSIGNED NOT NULL,
    escola VARCHAR(255) DEFAULT NULL,
    data_atendimento DATE NOT NULL,
    hora_entrada TIME NOT NULL,
    hora_saida TIME DEFAULT NULL,
    resultado ENUM('alta', 'encaminhamento', 'oculos', 'oculos_encaminhamento') NOT NULL,
    diagnostico TEXT DEFAULT NULL,
    especialidade VARCHAR(100) DEFAULT NULL,
    conduta_inicial VARCHAR(50) DEFAULT NULL,
    conduta_final VARCHAR(50) DEFAULT NULL,
    medico_id INT UNSIGNED DEFAULT NULL,
    medico_nome VARCHAR(255) DEFAULT NULL,
    medico_refracao_id INT UNSIGNED DEFAULT NULL,
    medico_refracao_nome VARCHAR(255) DEFAULT NULL,
    observacoes TEXT DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
    FOREIGN KEY (medico_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    INDEX idx_data (data_atendimento),
    INDEX idx_paciente_data (paciente_id, data_atendimento),
    INDEX idx_resultado (resultado),
    INDEX idx_escola (escola),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    INDEX idx_tenant_ah (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- Tabela: spotvision_mapeamento
-- Mapeamento de correção de códigos dos exames SpotVision no S3.
-- =============================================
CREATE TABLE IF NOT EXISTS spotvision_mapeamento (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT UNSIGNED NOT NULL DEFAULT 1,
    s3_key VARCHAR(500) NOT NULL,
    codigo_original VARCHAR(50) NOT NULL,
    codigo_correto VARCHAR(50) NOT NULL,
    atualizado_por INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_codigo_correto (codigo_correto),
    INDEX idx_s3_key (s3_key),
    UNIQUE KEY uk_s3_key_tenant (s3_key, tenant_id),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    INDEX idx_tenant_sv (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- Tabela: spotvision_ocr_cache
-- Cache de resultados OCR extraídos dos PDFs SpotVision.
-- =============================================
CREATE TABLE IF NOT EXISTS spotvision_ocr_cache (
    id INT AUTO_INCREMENT PRIMARY KEY,
    s3_key VARCHAR(500) NOT NULL UNIQUE,
    nome VARCHAR(100) DEFAULT NULL,
    sobrenome VARCHAR(100) DEFAULT NULL,
    nome_completo VARCHAR(200) DEFAULT NULL,
    individuo_id VARCHAR(50) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_s3_key (s3_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- Inserir usuário admin padrão (senha: admin123)
-- =============================================
INSERT INTO usuarios (tenant_id, nome, login, senha, role) VALUES
(1, 'Administrador', 'admin', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin');
