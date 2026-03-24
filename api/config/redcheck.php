<?php
require_once __DIR__ . '/env.php';
Env::load();

/**
 * Configuração da API RedCheck
 */
class RedCheckConfig {
    /** URL base da API */
    public const BASE_URL = 'https://api.redcheck.com.br/api/v1';

    public static function getPartnerName(): string {
        return Env::get('REDCHECK_PARTNER_NAME', '');
    }

    public static function getPartnerToken(): string {
        return Env::get('REDCHECK_PARTNER_TOKEN', '');
    }

    /**
     * Retorna o header Authorization para Basic Auth
     */
    public static function getAuthHeader(): string {
        return 'Basic ' . base64_encode(self::getPartnerName() . ':' . self::getPartnerToken());
    }

    /**
     * Verifica se as credenciais estão configuradas
     */
    public static function isConfigured(): bool {
        return self::getPartnerName() !== '' && self::getPartnerToken() !== '';
    }
}
