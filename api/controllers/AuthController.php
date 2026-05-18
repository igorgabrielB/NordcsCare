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
        $stmt = $db->prepare('SELECT id, tenant_id, nome, nome_social, foto_perfil, tema, email, login, senha, role, ativo FROM usuarios WHERE email = :email');
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

        // Definir tenant para o audit log
        Tenant::set((int)$user['tenant_id']);

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
                'tenant_id' => (int)$user['tenant_id'],
                'nome' => $user['nome'],
                'nome_social' => $user['nome_social'],
                'foto_perfil' => $user['foto_perfil'],
                'tema' => $user['tema'] ?? 'dark',
                'email' => $user['email'],
                'login' => $user['login'],
                'role' => $user['role'],
            ],
            'tenants' => self::getUserTenants((int)$user['id']),
        ]);
    }

    public static function register(): void {
        Auth::requireTela('usuarios');

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

        $tenantId = Tenant::id();

        // Verificar email duplicado dentro do tenant
        $stmt = $db->prepare('SELECT COUNT(*) FROM usuarios WHERE email = :email AND tenant_id = :tid');
        $stmt->execute([':email' => $input['email'], ':tid' => $tenantId]);
        if ($stmt->fetchColumn() > 0) {
            http_response_code(409);
            echo json_encode(['error' => 'Email já cadastrado']);
            return;
        }

        // Verificar login duplicado dentro do tenant
        $stmt = $db->prepare('SELECT COUNT(*) FROM usuarios WHERE login = :login AND tenant_id = :tid');
        $stmt->execute([':login' => $input['login'], ':tid' => $tenantId]);
        if ($stmt->fetchColumn() > 0) {
            http_response_code(409);
            echo json_encode(['error' => 'Login já existe']);
            return;
        }

        $senhaHash = password_hash($input['senha'], PASSWORD_BCRYPT);
        $login = trim($input['login'] ?? '') ?: $input['email'];

        $stmt = $db->prepare(
            'INSERT INTO usuarios (tenant_id, nome, email, login, senha, role) VALUES (:tid, :nome, :email, :login, :senha, :role)'
        );
        $stmt->execute([
            ':tid' => $tenantId,
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
        $stmt = $db->prepare('SELECT id, tenant_id, nome, nome_social, foto_perfil, tema, email, login, role, created_at FROM usuarios WHERE id = :id');
        $stmt->execute([':id' => $user['sub']]);
        $userData = $stmt->fetch();

        if (!$userData) {
            http_response_code(404);
            echo json_encode(['error' => 'Usuário não encontrado']);
            return;
        }

        // Retornar o tenant_id ativo (do JWT), não o "home" do banco
        $userData['tenant_id'] = (int)$user['tenant_id'];
        $userData['tenants'] = self::getUserTenants((int)$userData['id']);

        echo json_encode($userData);
    }

    /**
     * Permite que um usuário troque para outro tenant ao qual tem acesso.
     * Role 'master' pode acessar TODOS os tenants.
     * Outros usuários só podem trocar entre tenants vinculados em usuario_tenants.
     */
    public static function switchTenant(): void
    {
        $user = Auth::requireAuth();

        $input = json_decode(file_get_contents('php://input'), true);
        $targetTenantId = (int)($input['tenant_id'] ?? 0);

        if ($targetTenantId < 1) {
            http_response_code(400);
            echo json_encode(['error' => 'tenant_id inválido']);
            return;
        }

        $db = Database::getInstance();

        // Buscar dados reais do usuário (do banco, não do JWT)
        $stmt = $db->prepare('SELECT id, tenant_id, nome, email, login, role, nome_social, foto_perfil, tema FROM usuarios WHERE id = :id');
        $stmt->execute([':id' => $user['sub']]);
        $realUser = $stmt->fetch();

        if (!$realUser) {
            http_response_code(404);
            echo json_encode(['error' => 'Usuário não encontrado']);
            return;
        }

        $isMasterAdmin = $realUser['role'] === 'master';

        // Verificar se o usuário tem acesso ao tenant alvo
        if (!$isMasterAdmin) {
            $stmt = $db->prepare(
                'SELECT COUNT(*) FROM usuario_tenants WHERE usuario_id = :uid AND tenant_id = :tid'
            );
            $stmt->execute([':uid' => $realUser['id'], ':tid' => $targetTenantId]);
            if ((int)$stmt->fetchColumn() === 0) {
                http_response_code(403);
                echo json_encode(['error' => 'Você não tem acesso a esta clínica']);
                return;
            }
        }

        // Verificar se o tenant existe e está ativo
        $stmt = $db->prepare('SELECT id, nome, slug FROM tenants WHERE id = :id AND ativo = 1');
        $stmt->execute([':id' => $targetTenantId]);
        $tenant = $stmt->fetch();

        if (!$tenant) {
            http_response_code(404);
            echo json_encode(['error' => 'Clínica não encontrada ou inativa']);
            return;
        }

        // Gerar novo token com o tenant_id alvo
        $tokenData = $realUser;
        $tokenData['tenant_id'] = $targetTenantId;
        $newToken = Auth::generateToken($tokenData);

        Tenant::set($targetTenantId);
        AuditLog::registrar('switch_tenant', 'tenant', $targetTenantId, 
            "Trocou para clínica: {$tenant['nome']}");

        echo json_encode([
            'token' => $newToken,
            'tenant' => [
                'id' => (int)$tenant['id'],
                'nome' => $tenant['nome'],
                'slug' => $tenant['slug'],
            ],
            'user' => [
                'id' => (int)$realUser['id'],
                'tenant_id' => $targetTenantId,
                'nome' => $realUser['nome'],
                'email' => $realUser['email'],
                'login' => $realUser['login'],
                'role' => $realUser['role'],
                'nome_social' => $realUser['nome_social'] ?? null,
                'foto_perfil' => $realUser['foto_perfil'] ?? null,
                'tema' => $realUser['tema'] ?? 'dark',
            ]
        ]);
    }

    /**
     * Retorna a lista de tenants aos quais o usuário tem acesso.
     * Admin master (tenant 1) retorna TODOS os tenants.
     */
    public static function myTenants(): void
    {
        $user = Auth::requireAuth();
        echo json_encode(self::getUserTenants((int)$user['sub']));
    }

    /**
     * Helper: busca os tenants de um usuário.
     */
    private static function getUserTenants(int $userId): array
    {
        $db = Database::getInstance();

        // Verificar se é admin master (role = 'master')
        $stmt = $db->prepare('SELECT role FROM usuarios WHERE id = :id');
        $stmt->execute([':id' => $userId]);
        $u = $stmt->fetch();

        if (!$u) return [];

        if ($u['role'] === 'master') {
            // Master vê TODOS os tenants ativos
            $stmt = $db->query('SELECT id, nome, slug FROM tenants WHERE ativo = 1 ORDER BY nome');
            return $stmt->fetchAll();
        }

        // Usuário normal: busca na tabela de vínculos
        $stmt = $db->prepare(
            'SELECT t.id, t.nome, t.slug
             FROM usuario_tenants ut
             JOIN tenants t ON t.id = ut.tenant_id
             WHERE ut.usuario_id = :uid AND t.ativo = 1
             ORDER BY t.nome'
        );
        $stmt->execute([':uid' => $userId]);
        return $stmt->fetchAll();
    }
}
