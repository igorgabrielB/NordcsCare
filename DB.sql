-- =============================================
-- NordcsCare - Sistema de Prontuário Oftalmológico
-- Schema do Banco de Dados
-- =============================================

CREATE DATABASE IF NOT EXISTS nordcscare
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE nordcscare;

-- =============================================
-- Tabela: usuarios
-- =============================================
CREATE TABLE IF NOT EXISTS usuarios (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    login VARCHAR(30) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL,
    role ENUM('admin', 'medico', 'recepcionista') NOT NULL DEFAULT 'recepcionista',
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =============================================
-- Tabela: pacientes
-- =============================================
CREATE TABLE IF NOT EXISTS pacientes (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(6) NOT NULL UNIQUE,
    nome_completo VARCHAR(150) NOT NULL,
    cpf VARCHAR(14) UNIQUE,
    data_nascimento DATE,
    sexo ENUM('M', 'F', 'Outro') DEFAULT NULL,
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
    INDEX idx_nome (nome_completo),
    INDEX idx_cpf (cpf)
) ENGINE=InnoDB;

-- =============================================
-- Tabela: fila
-- =============================================
CREATE TABLE IF NOT EXISTS fila (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
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
    INDEX idx_estacao_status (estacao, status)
) ENGINE=InnoDB;

-- =============================================
-- Tabela: anamneses
-- =============================================
CREATE TABLE IF NOT EXISTS anamneses (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    paciente_id INT UNSIGNED NOT NULL,
    medico_id INT UNSIGNED NOT NULL,
    queixa_principal TEXT,
    historico_ocular TEXT,
    historico_familiar TEXT,
    alergias TEXT,
    medicamentos_em_uso TEXT,
    cirurgias_anteriores TEXT,
    observacoes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
    FOREIGN KEY (medico_id) REFERENCES usuarios(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- =============================================
-- Tabela: exames
-- =============================================
CREATE TABLE IF NOT EXISTS exames (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    paciente_id INT UNSIGNED NOT NULL,
    medico_id INT UNSIGNED NOT NULL,
    tipo_exame ENUM('acuidade_visual', 'refracao', 'tonometria', 'spot_vision', 'eyer', 'outro') NOT NULL,
    olho ENUM('OD', 'OE', 'AO') NOT NULL DEFAULT 'AO',
    resultado TEXT,
    observacoes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
    FOREIGN KEY (medico_id) REFERENCES usuarios(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- =============================================
-- Tabela: acuidade_visual
-- =============================================
CREATE TABLE IF NOT EXISTS acuidade_visual (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
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
    FOREIGN KEY (medico_id) REFERENCES usuarios(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- =============================================
-- Tabela: prescricoes
-- =============================================
CREATE TABLE IF NOT EXISTS prescricoes (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    paciente_id INT UNSIGNED NOT NULL,
    medico_id INT UNSIGNED NOT NULL,
    tipo ENUM('oculos', 'lentes_contato') NOT NULL DEFAULT 'oculos',
    od_esferico DECIMAL(5,2) DEFAULT NULL,
    od_cilindrico DECIMAL(5,2) DEFAULT NULL,
    od_eixo INT DEFAULT NULL,
    od_adicao DECIMAL(5,2) DEFAULT NULL,
    oe_esferico DECIMAL(5,2) DEFAULT NULL,
    oe_cilindrico DECIMAL(5,2) DEFAULT NULL,
    oe_eixo INT DEFAULT NULL,
    oe_adicao DECIMAL(5,2) DEFAULT NULL,
    dp DECIMAL(4,1) DEFAULT NULL,
    observacoes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
    FOREIGN KEY (medico_id) REFERENCES usuarios(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- =============================================
-- Tabela: laudos
-- =============================================
CREATE TABLE IF NOT EXISTS laudos (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    paciente_id INT UNSIGNED NOT NULL,
    medico_id INT UNSIGNED NOT NULL,
    diagnostico TEXT,
    conduta_inicial ENUM('alta', 'onibus', 'encaminhamento') DEFAULT NULL,
    conduta_final ENUM('alta', 'encaminhamento') DEFAULT NULL,
    observacoes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
    FOREIGN KEY (medico_id) REFERENCES usuarios(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- =============================================
-- Tabela: uploads
-- =============================================
CREATE TABLE IF NOT EXISTS uploads (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    paciente_id INT UNSIGNED NOT NULL,
    tipo VARCHAR(50),
    nome_arquivo VARCHAR(255) NOT NULL,
    caminho_arquivo VARCHAR(500) NOT NULL,
    uploaded_by INT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES usuarios(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- =============================================
-- Tabela: modelo_laudos
-- =============================================
CREATE TABLE IF NOT EXISTS modelo_laudos (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    dados JSON DEFAULT NULL,
    usuario_id INT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =============================================
-- Tabela: escola_agenda
-- =============================================
CREATE TABLE IF NOT EXISTS escola_agenda (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    escola VARCHAR(150) NOT NULL,
    data_atendimento DATE NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_escola_data (escola, data_atendimento),
    INDEX idx_data (data_atendimento)
) ENGINE=InnoDB;

-- =============================================
-- Inserir usuário admin padrão (senha: admin123)
-- =============================================
INSERT INTO usuarios (nome, login, senha, role) VALUES
('Administrador', 'admin', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin');
