<?php
require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/tenant.php';
Env::load();

/**
 * JWT Auth Middleware - Implementação simples sem dependências externas
 */
class Auth {
    private const EXPIRATION = 28800; // 8 horas

    private static function getSecret(): string {
        $secret = Env::get('JWT_SECRET', '');
        if ($secret === '') {
            throw new RuntimeException('JWT_SECRET não configurado');
        }
        return $secret;
    }

    public static function generateToken(array $userData): string {
        $header = self::base64UrlEncode(json_encode(['typ' => 'JWT', 'alg' => 'HS256']));
        $payload = self::base64UrlEncode(json_encode([
            'sub' => $userData['id'],
            'tenant_id' => (int)$userData['tenant_id'],
            'nome' => $userData['nome'],
            'login' => $userData['login'],
            'role' => $userData['role'],
            'iat' => time(),
            'exp' => time() + self::EXPIRATION,
        ]));
        $secret = self::getSecret();
        $signature = self::base64UrlEncode(
            hash_hmac('sha256', "$header.$payload", $secret, true)
        );
        return "$header.$payload.$signature";
    }

    public static function validateToken(string $token): ?array {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            return null;
        }

        [$header, $payload, $signature] = $parts;

        $secret = self::getSecret();
        $validSignature = self::base64UrlEncode(
            hash_hmac('sha256', "$header.$payload", $secret, true)
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

        // Definir contexto do tenant para a requisição
        if (isset($userData['tenant_id'])) {
            Tenant::set((int)$userData['tenant_id']);
        }

        return $userData;
    }

    /**
     * Verifica se o usuário tem permissão de admin (role admin ou master).
     * Uso interno — não expor diretamente aos controllers, usar hasTela().
     */
    public static function isAdmin(array $user): bool {
        return in_array($user['role'], ['admin', 'master'], true);
    }

    /**
     * Verifica se o usuário tem acesso a uma tela específica.
     * Consulta exclusivamente a tabela usuario_telas.
     */
    public static function hasTela(array $user, string $codigo): bool {
        // admin e master têm acesso irrestrito
        if (in_array($user['role'] ?? '', ['admin', 'master'], true)) {
            return true;
        }
        try {
            require_once __DIR__ . '/../config/database.php';
            $pdo = Database::getInstance();
            $stmt = $pdo->prepare(
                'SELECT 1 FROM usuario_telas WHERE usuario_id = :uid AND tela_codigo = :codigo AND tenant_id = :tenant'
            );
            $stmt->execute([
                ':uid'    => $user['sub'],
                ':codigo' => $codigo,
                ':tenant' => $user['tenant_id'],
            ]);
            return (bool) $stmt->fetchColumn();
        } catch (\Throwable $e) {
            return false;
        }
    }

    /**
     * Middleware: garante autenticação e permissão de tela.
     * Retorna os dados do usuário ou envia 403 e encerra.
     */
    public static function requireTela(string $codigo): array {
        $user = self::requireAuth();
        if (self::hasTela($user, $codigo)) {
            return $user;
        }
        http_response_code(403);
        echo json_encode(['error' => 'Acesso negado. Permissão necessária: ' . $codigo]);
        exit;
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

        // Fallback: token via query parameter (para <img> tags que não enviam headers)
        if (isset($_GET['token']) && is_string($_GET['token']) && $_GET['token'] !== '') {
            return $_GET['token'];
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
