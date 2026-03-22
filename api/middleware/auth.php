<?php
/**
 * JWT Auth Middleware - Implementação simples sem dependências externas
 */
class Auth {
    private const SECRET = 'nordcscare_jwt_secret_key_2026_change_in_production';
    private const EXPIRATION = 28800; // 8 horas

    public static function generateToken(array $userData): string {
        $header = self::base64UrlEncode(json_encode(['typ' => 'JWT', 'alg' => 'HS256']));
        $payload = self::base64UrlEncode(json_encode([
            'sub' => $userData['id'],
            'nome' => $userData['nome'],
            'login' => $userData['login'],
            'role' => $userData['role'],
            'iat' => time(),
            'exp' => time() + self::EXPIRATION,
        ]));
        $signature = self::base64UrlEncode(
            hash_hmac('sha256', "$header.$payload", self::SECRET, true)
        );
        return "$header.$payload.$signature";
    }

    public static function validateToken(string $token): ?array {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            return null;
        }

        [$header, $payload, $signature] = $parts;

        $validSignature = self::base64UrlEncode(
            hash_hmac('sha256', "$header.$payload", self::SECRET, true)
        );

        if (!hash_equals($validSignature, $signature)) {
            return null;
        }

        $data = json_decode(self::base64UrlDecode($payload), true);
        if (!$data || !isset($data['exp']) || $data['exp'] < time()) {
            return null;
        }

        return $data;
    }

    /**
     * Middleware: verifica se a requisição está autenticada.
     * Retorna os dados do usuário ou envia 401 e encerra.
     */
    public static function requireAuth(): array {
        $token = self::getBearerToken();
        if (!$token) {
            http_response_code(401);
            echo json_encode(['error' => 'Token não fornecido']);
            exit;
        }

        $userData = self::validateToken($token);
        if (!$userData) {
            http_response_code(401);
            echo json_encode(['error' => 'Token inválido ou expirado']);
            exit;
        }

        return $userData;
    }

    /**
     * Middleware: verifica se o usuário tem uma das roles permitidas.
     */
    public static function requireRole(array $allowedRoles): array {
        $user = self::requireAuth();
        if (!in_array($user['role'], $allowedRoles, true)) {
            http_response_code(403);
            echo json_encode(['error' => 'Acesso negado. Role necessária: ' . implode(' ou ', $allowedRoles)]);
            exit;
        }
        return $user;
    }

    private static function getBearerToken(): ?string {
        $headers = '';
        if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
            $headers = $_SERVER['HTTP_AUTHORIZATION'];
        } elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
            $headers = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
        } elseif (function_exists('apache_request_headers')) {
            $requestHeaders = apache_request_headers();
            if (isset($requestHeaders['Authorization'])) {
                $headers = $requestHeaders['Authorization'];
            }
        }

        if (preg_match('/Bearer\s(\S+)/', $headers, $matches)) {
            return $matches[1];
        }
        return null;
    }

    private static function base64UrlEncode(string $data): string {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function base64UrlDecode(string $data): string {
        return base64_decode(strtr($data, '-_', '+/'));
    }
}
