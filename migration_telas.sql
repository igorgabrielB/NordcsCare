-- ============================================================
-- Migration: sistema de permissões por tela
-- Executar no banco nordcscare
-- ============================================================

-- Catálogo global de telas disponíveis no sistema
CREATE TABLE IF NOT EXISTS telas (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    codigo      VARCHAR(60)  NOT NULL UNIQUE,   -- slug único, ex: 'dashboard', 'fila'
    nome        VARCHAR(120) NOT NULL,           -- Label exibido no menu
    descricao   VARCHAR(255) DEFAULT NULL,
    icone       VARCHAR(60)  DEFAULT NULL,       -- nome do ícone Lucide
    categoria   VARCHAR(60)  DEFAULT 'geral',    -- agrupamento no menu
    rota        VARCHAR(120) NOT NULL,           -- path React, ex: '/fila'
    requer_admin TINYINT(1)  NOT NULL DEFAULT 0, -- se 1, admin sempre tem acesso
    ativo       TINYINT(1)   NOT NULL DEFAULT 1,
    ordem       INT UNSIGNED NOT NULL DEFAULT 100
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Permissões de tela por usuário (scoped por tenant)
CREATE TABLE IF NOT EXISTS usuario_telas (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    usuario_id  INT UNSIGNED NOT NULL,
    tela_codigo VARCHAR(60)  NOT NULL,
    tenant_id   INT UNSIGNED NOT NULL,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_tela_tenant (usuario_id, tela_codigo, tenant_id),
    KEY idx_usuario_tenant (usuario_id, tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Catálogo inicial de telas ────────────────────────────────
INSERT IGNORE INTO telas (codigo, nome, descricao, icone, categoria, rota, requer_admin, ordem) VALUES
-- Operacional
('fila',           'Fila de Atendimento',   'Gerencia a fila de pacientes por estação',       'ListChecks',    'operacional', '/fila',                        0, 10),
('pacientes',      'Pacientes',             'Cadastro e edição de pacientes',                  'Users',         'operacional', '/pacientes',                   0, 20),
('prontuario',     'Prontuário',            'Atendimento clínico e prontuário do paciente',    'ClipboardList', 'operacional', '/prontuario/:pacienteId',       0, 30),
-- Gestão
('dashboard',      'Dashboard',             'Métricas e indicadores em tempo real',            'BarChart2',     'gestao',      '/dashboard',                   1, 40),
('relatorios',     'Relatórios',            'Relatórios gerenciais',                           'FileText',      'gestao',      '/relatorios',                  1, 50),
('relatorios_atendimentos', 'Rel. Atendimentos', 'Histórico de atendimentos exportável',      'Sheet',         'gestao',      '/relatorios/atendimentos',     1, 55),
-- Acadêmico
('agenda_escola',  'Agenda Escolar',        'Agendamento de visitas às escolas',               'CalendarDays',  'academico',   '/admin/agenda-escola',         1, 60),
('alunos',         'Alunos',                'Importação e gestão de alunos',                   'GraduationCap', 'academico',   '/admin/alunos',                1, 70),
('import_escola',  'Importar Escola',       'Importação de dados de escolas',                  'Upload',        'academico',   '/admin/import-escola',         1, 80),
('exclusao_escola','Exclusão de Escola',    'Remove escola e seus dados',                      'Trash2',        'academico',   '/admin/exclusao-escola',       1, 90),
-- Clínico / Admin
('medicos',        'Médicos',               'Cadastro de médicos',                             'Stethoscope',   'clinico',     '/admin/medicos',               1, 100),
('laudos_prontos', 'Laudos Prontos',        'Biblioteca de laudos pré-definidos',              'BookOpen',      'clinico',     '/admin/laudos-prontos',        1, 110),
('modelos_docs',   'Modelos de Documentos', 'Templates de documentos clínicos',                'FileEdit',      'clinico',     '/admin/modelos-documentos',    1, 120),
-- Sistema
('usuarios',       'Usuários',              'Cadastro e permissões de usuários',               'UserCog',       'sistema',     '/usuarios',                    1, 130),
('logs',           'Logs do Sistema',       'Auditoria de ações no sistema',                   'ScrollText',    'sistema',     '/admin/logs',                  1, 140),
('admin',          'Configurações',         'Configurações gerais da clínica',                 'Settings',      'sistema',     '/admin',                       1, 150),
('dashboard_builder','Dashboard Builder',  'Personalizar layout do dashboard',                 'LayoutTemplate','sistema',     '/admin/dashboard-builder',     1, 160),
('perfis',         'Perfis de Acesso',      'Gerenciamento de roles e permissões',             'ShieldCheck',   'sistema',     '/admin/perfis',                1, 170),
('clinicas',       'Clínicas',              'Gerenciamento de clínicas (master)',               'Hospital',      'sistema',     '/admin/clinicas',              1, 180),
('spotvision',     'SpotVision Admin',      'Configurações do módulo SpotVision',              'Eye',           'sistema',     '/admin/spotvision',            1, 190);
