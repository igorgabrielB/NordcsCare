<?php
/**
 * Carrega variáveis de ambiente do arquivo .env
 * Implementação simples sem dependências externas.
 */
class Env {
    private static bool $loaded = false;
    private static array $vars = [];

    public static function load(string $path = null): void {
        if (self::$loaded) {
            return;
        }

        $path = $path ?? dirname(__DIR__) . '/.env';

        if (!file_exists($path)) {
            // Em produção, as variáveis devem vir do ambiente do servidor
            self::$loaded = true;
            return;
        }

        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            $line = trim($line);

            // Ignorar comentários
            if ($line === '' || $line[0] === '#') {
                continue;
            }

            $eqPos = strpos($line, '=');
            if ($eqPos === false) {
                continue;
            }

            $key = trim(substr($line, 0, $eqPos));
            $value = trim(substr($line, $eqPos + 1));

            // Remover aspas ao redor do valor
            if (strlen($value) >= 2 && (($value[0] === '"' && $value[-1] === '"') || ($value[0] === "'" && $value[-1] === "'"))) {
                $value = substr($value, 1, -1);
            }

            self::$vars[$key] = $value;

            // Definir no ambiente se ainda não existir
            if (getenv($key) === false) {
                putenv("$key=$value");
            }
        }

        self::$loaded = true;
    }

    /**
     * Obtém uma variável de ambiente.
     * Prioridade: variável de ambiente do sistema > .env file > default
     */
    public static function get(string $key, string $default = ''): string {
        // Primeiro tenta do ambiente do sistema (para produção com variáveis configuradas no servidor)
        $envValue = getenv($key);
        if ($envValue !== false) {
            return $envValue;
        }

        return self::$vars[$key] ?? $default;
    }

    /**
     * Verifica se estamos em ambiente de produção.
     */
    public static function isProduction(): bool {
        return self::get('APP_ENV', 'development') === 'production';
    }
}
