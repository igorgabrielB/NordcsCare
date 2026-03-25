<?php
/**
 * Rate Limiting simples baseado em arquivo.
 * Em produção, considere usar Redis para melhor performance.
 */
class RateLimit {
    private const MAX_ATTEMPTS = 3;       // Máximo de tentativas
    private const WINDOW_SECONDS = 60;    // Janela de 1 minuto
    private const STORAGE_DIR = __DIR__ . '/../logs/rate_limit';

    public static function check(): void {
        $ip = self::getClientIp();
        $key = md5($ip);

        if (!is_dir(self::STORAGE_DIR)) {
            mkdir(self::STORAGE_DIR, 0700, true);
        }

        $file = self::STORAGE_DIR . '/' . $key . '.json';

        $data = ['attempts' => [], 'blocked_until' => 0];
        if (file_exists($file)) {
            $content = file_get_contents($file);
            $parsed = json_decode($content, true);
            if (is_array($parsed)) {
                $data = $parsed;
            }
        }

        $now = time();

        // Verificar se está bloqueado
        if (isset($data['blocked_until']) && $data['blocked_until'] > $now) {
            $retryAfter = $data['blocked_until'] - $now;
            http_response_code(429);
            header("Retry-After: $retryAfter");
            echo json_encode(['error' => 'Muitas tentativas de login. Tente novamente em alguns minutos.']);
            exit;
        }

        // Limpar tentativas fora da janela
        $data['attempts'] = array_filter(
            $data['attempts'] ?? [],
            fn($timestamp) => $timestamp > ($now - self::WINDOW_SECONDS)
        );
        $data['attempts'] = array_values($data['attempts']);

        // Registrar tentativa
        $data['attempts'][] = $now;

        // Verificar limite
        if (count($data['attempts']) > self::MAX_ATTEMPTS) {
            $data['blocked_until'] = $now + self::WINDOW_SECONDS;
            file_put_contents($file, json_encode($data), LOCK_EX);

            http_response_code(429);
            header("Retry-After: " . self::WINDOW_SECONDS);
            echo json_encode(['error' => 'Muitas tentativas de login. Tente novamente em alguns minutos.']);
            exit;
        }

        file_put_contents($file, json_encode($data), LOCK_EX);
    }

    /**
     * Limpar o registro de um IP após login bem-sucedido.
     */
    public static function clearForCurrentIp(): void {
        $ip = self::getClientIp();
        $key = md5($ip);
        $file = self::STORAGE_DIR . '/' . $key . '.json';

        if (file_exists($file)) {
            unlink($file);
        }
    }

    private static function getClientIp(): string {
        // Em produção atrás de load balancer, usar X-Forwarded-For
        if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            $ips = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
            return trim($ips[0]);
        }
        return $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
    }
}
