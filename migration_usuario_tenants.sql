-- =============================================
-- NordcsCare - Migration: usuario_tenants
-- Permite um usuário acessar múltiplas clínicas
-- =============================================
USE nordcscare;

CREATE TABLE IF NOT EXISTS usuario_tenants (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT UNSIGNED NOT NULL,
    tenant_id INT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_usuario_tenant (usuario_id, tenant_id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    INDEX idx_usuario (usuario_id),
    INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Vincular todos os usuários existentes ao seu tenant atual
INSERT IGNORE INTO usuario_tenants (usuario_id, tenant_id)
SELECT id, tenant_id FROM usuarios;
