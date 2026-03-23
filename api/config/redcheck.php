<?php
/**
 * Configuração da API RedCheck
 * Preencha com suas credenciais de parceiro.
 */
class RedCheckConfig {
    /** Nome do parceiro fornecido pela RedCheck */
    public const PARTNER_NAME = 'demoeventos';

    /** Token do parceiro fornecido pela RedCheck */
    public const PARTNER_TOKEN = '48a0ff5088b5fdea581e6f695de3906f275173f6';

    /** URL base da API */
    public const BASE_URL = 'https://api.redcheck.com.br/api/v1';

    /**
     * Retorna o header Authorization para Basic Auth
     */
    public static function getAuthHeader(): string {
        return 'Basic ' . base64_encode(self::PARTNER_NAME . ':' . self::PARTNER_TOKEN);
    }

    /**
     * Verifica se as credenciais estão configuradas
     */
    public static function isConfigured(): bool {
        return self::PARTNER_NAME !== '' && self::PARTNER_TOKEN !== '';
    }
}
