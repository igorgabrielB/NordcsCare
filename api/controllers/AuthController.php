<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../utils/AuditLog.php';

class AuthController {

    public static function login(): void {
        $input = json_decode(file_get_contents('php://input'), true);

        if (empty($input['email']) || empty($input['senha'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Email e senha são obrigatórios']);
            return;
        }

        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT id, nome, email, login, senha, role, ativo FROM usuarios WHERE email = :email');
        $stmt->execute([':email' => $input['email']]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($input['senha'], $user['senha'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Credenciais inválidas']);
            return;
        }

        if (!$user['ativo']) {
            http_response_code(403);
            echo json_encode(['error' => 'Usuário desativado']);
            return;
        }

        $token = Auth::generateToken($user);

        AuditLog::registrar('login', 'usuario', (int)$user['id'], 'Login realizado', [
            'sub' => (int)$user['id'], 'nome' => $user['nome'], 'role' => $user['role']
        ]);

        // Limpar rate limit após login bem-sucedido
        if (class_exists('RateLimit')) {
            RateLimit::clearForCurrentIp();
        }

        echo json_encode([
            'token' => $token,
            'user' => [
                'id' => (int)$user['id'],
                'nome' => $user['nome'],
                'email' => $user['email'],
                'login' => $user['login'],
                'role' => $user['role'],
            ]
        ]);
    }

    public static function register(): void {
        Auth::requireRole(['admin']);

        $input = json_decode(file_get_contents('php://input'), true);

        $required = ['nome', 'email', 'senha', 'role'];
        foreach ($required as $field) {
            if (empty($input[$field])) {
                http_response_code(400);
                echo json_encode(['error' => "Campo '$field' é obrigatório"]);
                return;
            }
        }

        $allowedRoles = ['admin', 'medico', 'administrativo'];
        if (!in_array($input['role'], $allowedRoles, true)) {
            http_response_code(400);
            echo json_encode(['error' => 'Role inválida']);
            return;
        }

        $db = Database::getInstance();

        // Verificar email duplicado
        $stmt = $db->prepare('SELECT COUNT(*) FROM usuarios WHERE email = :email');
        $stmt->execute([':email' => $input['email']]);
        if ($stmt->fetchColumn() > 0) {
            http_response_code(409);
            echo json_encode(['error' => 'Email já cadastrado']);
            return;
        }

        // Verificar login duplicado
        $stmt = $db->prepare('SELECT COUNT(*) FROM usuarios WHERE login = :login');
        $stmt->execute([':login' => $input['login']]);
        if ($stmt->fetchColumn() > 0) {
            http_response_code(409);
            echo json_encode(['error' => 'Login já existe']);
            return;
        }

        $senhaHash = password_hash($input['senha'], PASSWORD_BCRYPT);
        $login = trim($input['login'] ?? '') ?: $input['email'];

        $stmt = $db->prepare(
            'INSERT INTO usuarios (nome, email, login, senha, role) VALUES (:nome, :email, :login, :senha, :role)'
        );
        $stmt->execute([
            ':nome' => $input['nome'],
            ':email' => $input['email'],
            ':login' => $login,
            ':senha' => $senhaHash,
            ':role' => $input['role'],
        ]);

        $newId = (int)$db->lastInsertId();
        $adminUser = Auth::requireAuth();
        AuditLog::registrar('criar', 'usuario', $newId, "Usuário '{$input['nome']}' ({$input['role']}) criado", $adminUser);

        http_response_code(201);
        echo json_encode(['message' => 'Usuário cadastrado com sucesso', 'id' => $newId]);
    }

    public static function me(): void {
        $user = Auth::requireAuth();
        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT id, nome, email, login, role, created_at FROM usuarios WHERE id = :id');
        $stmt->execute([':id' => $user['sub']]);
        $userData = $stmt->fetch();

        if (!$userData) {
            http_response_code(404);
            echo json_encode(['error' => 'Usuário não encontrado']);
            return;
        }

        echo json_encode($userData);
    }
}
