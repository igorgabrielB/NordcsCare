-- ============================================================
-- Migration: sub-telas do Prontuário para controle interno
-- Executar no banco nordcscare
-- ============================================================

-- Telas específicas para funcionalidades internas do Prontuário.
-- Não aparecem como páginas no menu, mas controlam seções dentro da tela de prontuário.

INSERT IGNORE INTO telas (codigo, nome, descricao, icone, categoria, rota, requer_admin, ordem) VALUES
-- Sub-ações do Prontuário
('prontuario_laudo',    'Prontuário - Laudo/Receita', 'Permite criar/editar laudos, prescrições e imprimir documentos médicos', 'ClipboardList', 'clinico', '/prontuario/:pacienteId', 0, 31),
('prontuario_acuidade', 'Prontuário - Acuidade Visual', 'Permite registrar acuidade visual no prontuário', 'Eye', 'clinico', '/prontuario/:pacienteId', 0, 32);
