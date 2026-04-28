<?php
/**
 * Tenant Middleware - Gerencia o contexto multi-tenant.
 * 
 * O tenant_id é extraído do JWT do usuário autenticado.
 * Todas as queries devem usar Tenant::id() para filtrar dados.
 */
class Tenant {
    private static ?int $currentId = null;

    /**
     * Define o tenant_id para a requisição atual.
     * Chamado automaticamente após autenticação.
     */
    public static function set(int $tenantId): void {
        self::$currentId = $tenantId;
    }

    /**
     * Retorna o tenant_id atual.
     * Lança exceção se não definido (requisição não autenticada).
     */
    public static function id(): int {
        if (self::$currentId === null) {
            throw new RuntimeException('Tenant não definido. Autenticação necessária.');
        }
        return self::$currentId;
    }

    /**
     * Retorna o tenant_id ou null (para contextos opcionais como audit_log).
     */
    public static function idOrNull(): ?int {
        return self::$currentId;
    }

    /**
     * Verifica se o tenant está definido.
     */
    public static function isSet(): bool {
        return self::$currentId !== null;
    }

    /**
     * Reseta o tenant (para testes ou super admin).
     */
    public static function reset(): void {
        self::$currentId = null;
    }
}
