<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../middleware/tenant.php';
require_once __DIR__ . '/../utils/AuditLog.php';

class TenantController
{
    /**
     * Verifica se o usuário logado é master.
     */
    private static function isMasterAdmin(array $authUser): bool
    {
        return $authUser['role'] === 'master';
    }

    /**
     * Verifica se o usuário logado tem acesso a um tenant específico.
     */
    private static function hasAccessToTenant(array $authUser, int $tenantId): bool
    {
        if (self::isMasterAdmin($authUser)) return true;

        $db = Database::getInstance();
        $stmt = $db->prepare(
            'SELECT COUNT(*) FROM usuario_tenants WHERE usuario_id = :uid AND tenant_id = :tid'
        );
        $stmt->execute([':uid' => $authUser['sub'], ':tid' => $tenantId]);
        return (int)$stmt->fetchColumn() > 0;
    }

    public static function index(): void
    {
        $user = Auth::requireTela('clinicas');
        $db = Database::getInstance();

        if (self::isMasterAdmin($user)) {
            // Master admin vê TODAS as clínicas
            $stmt = $db->query(
                'SELECT id, nome, slug, ativo, created_at, updated_at,
                        (SELECT COUNT(*) FROM usuarios u WHERE u.tenant_id = tenants.id) AS total_usuarios
                 FROM tenants
                 ORDER BY nome ASC'
            );
        } else {
            // Admin normal vê apenas clínicas vinculadas
            $stmt = $db->prepare(
                'SELECT t.id, t.nome, t.slug, t.ativo, t.created_at, t.updated_at,
                        (SELECT COUNT(*) FROM usuarios u WHERE u.tenant_id = t.id) AS total_usuarios
                 FROM tenants t
                 JOIN usuario_tenants ut ON ut.tenant_id = t.id
                 WHERE ut.usuario_id = :uid
                 ORDER BY t.nome ASC'
            );
            $stmt->execute([':uid' => $user['sub']]);
        }

        echo json_encode($stmt->fetchAll());
    }

    public static function show(int $id): void
    {
        $user = Auth::requireTela('clinicas');

        if (!self::hasAccessToTenant($user, $id)) {
            http_response_code(403);
            echo json_encode(['error' => 'Você não tem acesso a esta clínica']);
            return;
        }

        $db = Database::getInstance();

        $stmt = $db->prepare(
            'SELECT id, nome, slug, ativo, created_at, updated_at
             FROM tenants WHERE id = :id'
        );
        $stmt->execute([':id' => $id]);
        $tenant = $stmt->fetch();

        if (!$tenant) {
            http_response_code(404);
            echo json_encode(['error' => 'Clínica não encontrada']);
            return;
        }

        // Contagens
        $counts = [];
        $tables = ['usuarios', 'pacientes', 'medicos'];
        foreach ($tables as $t) {
            $s = $db->prepare("SELECT COUNT(*) FROM {$t} WHERE tenant_id = :tid");
            $s->execute([':tid' => $id]);
            $counts[$t] = (int) $s->fetchColumn();
        }

        $tenant['contagens'] = $counts;
        echo json_encode($tenant);
    }

    public static function store(): void
    {
        $user = Auth::requireTela('clinicas');

        // Apenas master admin pode criar novas clínicas
        if (!self::isMasterAdmin($user)) {
            http_response_code(403);
            echo json_encode(['error' => 'Apenas o administrador master pode criar novas clínicas']);
            return;
        }

        $input = json_decode(file_get_contents('php://input'), true);
        $db = Database::getInstance();

        $nome = trim($input['nome'] ?? '');
        $slug = trim($input['slug'] ?? '');

        if ($nome === '') {
            http_response_code(422);
            echo json_encode(['error' => 'Nome é obrigatório']);
            return;
        }

        // Gerar slug se vazio
        if ($slug === '') {
            $slug = self::generateSlug($nome);
        }

        // Validar slug (somente letras minúsculas, números e hífens)
        if (!preg_match('/^[a-z0-9\-]+$/', $slug)) {
            http_response_code(422);
            echo json_encode(['error' => 'Slug inválido. Use apenas letras minúsculas, números e hífens']);
            return;
        }

        // Verificar unicidade do slug
        $stmt = $db->prepare('SELECT COUNT(*) FROM tenants WHERE slug = :slug');
        $stmt->execute([':slug' => $slug]);
        if ((int) $stmt->fetchColumn() > 0) {
            http_response_code(409);
            echo json_encode(['error' => 'Já existe uma clínica com este slug']);
            return;
        }

        $stmt = $db->prepare(
            'INSERT INTO tenants (nome, slug) VALUES (:nome, :slug)'
        );
        $stmt->execute([':nome' => $nome, ':slug' => $slug]);
        $id = (int) $db->lastInsertId();

        // Criar usuário admin padrão para o novo tenant
        $senhaAdmin = trim($input['senha_admin'] ?? '');
        $loginAdmin = trim($input['login_admin'] ?? '');
        $nomeAdmin = trim($input['nome_admin'] ?? 'Administrador');

        if ($loginAdmin !== '' && $senhaAdmin !== '') {
            $hash = password_hash($senhaAdmin, PASSWORD_DEFAULT);
            $stmt = $db->prepare(
                'INSERT INTO usuarios (tenant_id, nome, login, email, senha, role)
                 VALUES (:tid, :nome, :login, :email, :senha, :role)'
            );
            $stmt->execute([
                ':tid' => $id,
                ':nome' => $nomeAdmin,
                ':login' => $loginAdmin,
                ':email' => $loginAdmin,
                ':senha' => $hash,
                ':role' => 'admin',
            ]);
        }

        AuditLog::registrar('criar', 'tenant', $id, "Clínica criada: $nome");

        http_response_code(201);
        echo json_encode(['id' => $id, 'message' => 'Clínica criada com sucesso']);
    }

    public static function update(int $id): void
    {
        $user = Auth::requireTela('clinicas');

        if (!self::hasAccessToTenant($user, $id)) {
            http_response_code(403);
            echo json_encode(['error' => 'Você não tem acesso a esta clínica']);
            return;
        }

        $input = json_decode(file_get_contents('php://input'), true);
        $db = Database::getInstance();

        $stmt = $db->prepare('SELECT id FROM tenants WHERE id = :id');
        $stmt->execute([':id' => $id]);
        if (!$stmt->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Clínica não encontrada']);
            return;
        }

        $nome = trim($input['nome'] ?? '');
        if ($nome === '') {
            http_response_code(422);
            echo json_encode(['error' => 'Nome é obrigatório']);
            return;
        }

        $ativo = isset($input['ativo']) ? (int) $input['ativo'] : 1;

        $stmt = $db->prepare(
            'UPDATE tenants SET nome = :nome, ativo = :ativo WHERE id = :id'
        );
        $stmt->execute([':nome' => $nome, ':ativo' => $ativo, ':id' => $id]);

        AuditLog::registrar('atualizar', 'tenant', $id, "Clínica atualizada: $nome");

        echo json_encode(['message' => 'Clínica atualizada com sucesso']);
    }

    public static function destroy(int $id): void
    {
        $user = Auth::requireTela('clinicas');

        // Apenas master admin pode excluir clínicas
        if (!self::isMasterAdmin($user)) {
            http_response_code(403);
            echo json_encode(['error' => 'Apenas o administrador master pode remover clínicas']);
            return;
        }

        $db = Database::getInstance();

        // Impedir deletar o tenant padrão
        if ($id === 1) {
            http_response_code(403);
            echo json_encode(['error' => 'Não é possível remover a clínica padrão']);
            return;
        }

        $stmt = $db->prepare('SELECT id, nome FROM tenants WHERE id = :id');
        $stmt->execute([':id' => $id]);
        $tenant = $stmt->fetch();

        if (!$tenant) {
            http_response_code(404);
            echo json_encode(['error' => 'Clínica não encontrada']);
            return;
        }

        // Verificar se tem dados vinculados
        $stmt = $db->prepare('SELECT COUNT(*) FROM usuarios WHERE tenant_id = :tid');
        $stmt->execute([':tid' => $id]);
        $totalUsuarios = (int) $stmt->fetchColumn();

        $stmt = $db->prepare('SELECT COUNT(*) FROM pacientes WHERE tenant_id = :tid');
        $stmt->execute([':tid' => $id]);
        $totalPacientes = (int) $stmt->fetchColumn();

        if ($totalUsuarios > 0 || $totalPacientes > 0) {
            http_response_code(409);
            echo json_encode([
                'error' => "Não é possível remover: existem {$totalUsuarios} usuário(s) e {$totalPacientes} paciente(s) vinculados",
            ]);
            return;
        }

        $stmt = $db->prepare('DELETE FROM tenants WHERE id = :id');
        $stmt->execute([':id' => $id]);

        AuditLog::registrar('excluir', 'tenant', $id, "Clínica removida: {$tenant['nome']}");

        echo json_encode(['message' => 'Clínica removida com sucesso']);
    }

    private static function generateSlug(string $text): string
    {
        $slug = mb_strtolower($text, 'UTF-8');
        $slug = preg_replace('/[áàãâä]/u', 'a', $slug);
        $slug = preg_replace('/[éèêë]/u', 'e', $slug);
        $slug = preg_replace('/[íìîï]/u', 'i', $slug);
        $slug = preg_replace('/[óòõôö]/u', 'o', $slug);
        $slug = preg_replace('/[úùûü]/u', 'u', $slug);
        $slug = preg_replace('/[ç]/u', 'c', $slug);
        $slug = preg_replace('/[^a-z0-9\s\-]/', '', $slug);
        $slug = preg_replace('/[\s]+/', '-', $slug);
        $slug = preg_replace('/-+/', '-', $slug);
        return trim($slug, '-');
    }

    /**
     * Lista os usuários vinculados a um tenant (via usuario_tenants).
     */
    public static function usuarios(int $id): void
    {
        $user = Auth::requireTela('clinicas');

        if (!self::hasAccessToTenant($user, $id)) {
            http_response_code(403);
            echo json_encode(['error' => 'Você não tem acesso a esta clínica']);
            return;
        }

        $db = Database::getInstance();

        $stmt = $db->prepare(
            'SELECT u.id, u.nome, u.email, u.login, u.role, u.tenant_id AS home_tenant_id,
                    ut.created_at AS vinculado_em
             FROM usuario_tenants ut
             JOIN usuarios u ON u.id = ut.usuario_id
             WHERE ut.tenant_id = :tid
             ORDER BY u.nome'
        );
        $stmt->execute([':tid' => $id]);
        echo json_encode($stmt->fetchAll());
    }

    /**
     * Vincula um usuário a um tenant.
     */
    public static function vincularUsuario(int $id): void
    {
        $user = Auth::requireTela('clinicas');

        // Apenas master admin pode vincular usuários a qualquer clínica
        if (!self::isMasterAdmin($user)) {
            http_response_code(403);
            echo json_encode(['error' => 'Apenas o administrador master pode vincular usuários']);
            return;
        }

        $input = json_decode(file_get_contents('php://input'), true);
        $db = Database::getInstance();

        $usuarioId = (int)($input['usuario_id'] ?? 0);
        if ($usuarioId < 1) {
            http_response_code(400);
            echo json_encode(['error' => 'usuario_id é obrigatório']);
            return;
        }

        // Verificar que o tenant existe
        $stmt = $db->prepare('SELECT id FROM tenants WHERE id = :id');
        $stmt->execute([':id' => $id]);
        if (!$stmt->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Clínica não encontrada']);
            return;
        }

        // Verificar que o usuário existe
        $stmt = $db->prepare('SELECT id, nome FROM usuarios WHERE id = :id');
        $stmt->execute([':id' => $usuarioId]);
        $usuario = $stmt->fetch();
        if (!$usuario) {
            http_response_code(404);
            echo json_encode(['error' => 'Usuário não encontrado']);
            return;
        }

        // Verificar duplicata
        $stmt = $db->prepare('SELECT COUNT(*) FROM usuario_tenants WHERE usuario_id = :uid AND tenant_id = :tid');
        $stmt->execute([':uid' => $usuarioId, ':tid' => $id]);
        if ((int)$stmt->fetchColumn() > 0) {
            http_response_code(409);
            echo json_encode(['error' => 'Usuário já vinculado a esta clínica']);
            return;
        }

        $stmt = $db->prepare('INSERT INTO usuario_tenants (usuario_id, tenant_id) VALUES (:uid, :tid)');
        $stmt->execute([':uid' => $usuarioId, ':tid' => $id]);

        AuditLog::registrar('vincular_usuario', 'tenant', $id, "Usuário '{$usuario['nome']}' vinculado à clínica");

        http_response_code(201);
        echo json_encode(['message' => 'Usuário vinculado com sucesso']);
    }

    /**
     * Remove vínculo de um usuário com um tenant.
     */
    public static function desvincularUsuario(int $id): void
    {
        $user = Auth::requireTela('clinicas');

        // Apenas master admin pode desvincular usuários
        if (!self::isMasterAdmin($user)) {
            http_response_code(403);
            echo json_encode(['error' => 'Apenas o administrador master pode desvincular usuários']);
            return;
        }

        $input = json_decode(file_get_contents('php://input'), true);
        $db = Database::getInstance();

        $usuarioId = (int)($input['usuario_id'] ?? 0);
        if ($usuarioId < 1) {
            http_response_code(400);
            echo json_encode(['error' => 'usuario_id é obrigatório']);
            return;
        }

        // Não permitir desvincular do tenant "casa" do usuário
        $stmt = $db->prepare('SELECT tenant_id FROM usuarios WHERE id = :id');
        $stmt->execute([':id' => $usuarioId]);
        $user = $stmt->fetch();
        if ($user && (int)$user['tenant_id'] === $id) {
            http_response_code(409);
            echo json_encode(['error' => 'Não é possível desvincular o usuário da sua clínica principal']);
            return;
        }

        $stmt = $db->prepare('DELETE FROM usuario_tenants WHERE usuario_id = :uid AND tenant_id = :tid');
        $stmt->execute([':uid' => $usuarioId, ':tid' => $id]);

        if ($stmt->rowCount() === 0) {
            http_response_code(404);
            echo json_encode(['error' => 'Vínculo não encontrado']);
            return;
        }

        AuditLog::registrar('desvincular_usuario', 'tenant', $id, "Usuário desvinculado da clínica");

        echo json_encode(['message' => 'Vínculo removido com sucesso']);
    }
}
