<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../middleware/tenant.php';

class MedicoController {

    public static function index(): void {
        Auth::requireTela('medicos');
        $db = Database::getInstance();

        $stmt = $db->prepare(
            'SELECT id, nome, crm, uf, especialidade, telefone, email, ativo, created_at, updated_at
             FROM medicos WHERE tenant_id = :tid ORDER BY nome ASC'
        );
        $stmt->execute([':tid' => Tenant::id()]);
        echo json_encode($stmt->fetchAll());
    }

    public static function show(int $id): void {
        Auth::requireTela('medicos');
        $db = Database::getInstance();

        $stmt = $db->prepare(
            'SELECT id, nome, crm, uf, especialidade, telefone, email, ativo, created_at, updated_at
             FROM medicos WHERE id = :id AND tenant_id = :tid'
        );
        $stmt->execute([':id' => $id, ':tid' => Tenant::id()]);
        $medico = $stmt->fetch();

        if (!$medico) {
            http_response_code(404);
            echo json_encode(['error' => 'Médico não encontrado']);
            return;
        }

        echo json_encode($medico);
    }

    public static function store(): void {
        Auth::requireTela('medicos');
        $input = json_decode(file_get_contents('php://input'), true);
        $db = Database::getInstance();

        $nome = trim($input['nome'] ?? '');
        $crm = trim($input['crm'] ?? '');
        $especialidade = trim($input['especialidade'] ?? 'Oftalmologia');
        $email = trim($input['email'] ?? '');
        $login = trim($input['login'] ?? '') ?: $email;
        $senha = $input['senha'] ?? '';

        if ($nome === '' || $crm === '' || $email === '') {
            http_response_code(422);
            echo json_encode(['error' => 'Nome, CRM e email são obrigatórios']);
            return;
        }

        if ($senha === '') {
            http_response_code(422);
            echo json_encode(['error' => 'Senha é obrigatória']);
            return;
        }

        if (strlen($senha) < 8) {
            http_response_code(422);
            echo json_encode(['error' => 'A senha deve ter pelo menos 8 caracteres']);
            return;
        }

        // Verificar CRM único dentro do tenant
        $stmt = $db->prepare('SELECT id FROM medicos WHERE crm = :crm AND tenant_id = :tid');
        $stmt->execute([':crm' => $crm, ':tid' => Tenant::id()]);
        if ($stmt->fetch()) {
            http_response_code(422);
            echo json_encode(['error' => 'Este CRM já está cadastrado']);
            return;
        }

        // Verificar email único na tabela usuarios dentro do tenant
        $stmt = $db->prepare('SELECT id FROM usuarios WHERE email = :email AND tenant_id = :tid');
        $stmt->execute([':email' => $email, ':tid' => Tenant::id()]);
        if ($stmt->fetch()) {
            http_response_code(422);
            echo json_encode(['error' => 'Este email já está em uso']);
            return;
        }

        // Verificar login único dentro do tenant
        $stmt = $db->prepare('SELECT id FROM usuarios WHERE login = :login AND tenant_id = :tid');
        $stmt->execute([':login' => $login, ':tid' => Tenant::id()]);
        if ($stmt->fetch()) {
            http_response_code(422);
            echo json_encode(['error' => 'Este login já está em uso']);
            return;
        }

        // Criar usuário e médico em transação
        $db->beginTransaction();
        try {
            $hash = password_hash($senha, PASSWORD_BCRYPT);
            $stmt = $db->prepare(
                'INSERT INTO usuarios (tenant_id, nome, login, senha, role, email)
                 VALUES (:tid, :nome, :login, :senha, :role, :email)'
            );
            $stmt->execute([
                ':tid' => Tenant::id(),
                ':nome' => $nome,
                ':login' => $login,
                ':senha' => $hash,
                ':role' => 'medico',
                ':email' => $email,
            ]);
            $usuarioId = (int)$db->lastInsertId();

            $stmt = $db->prepare(
                'INSERT INTO medicos (tenant_id, usuario_id, nome, crm, uf, especialidade, telefone, email)
                 VALUES (:tid, :uid, :nome, :crm, :uf, :especialidade, :telefone, :email)'
            );
            $stmt->execute([
                ':tid' => Tenant::id(),
                ':uid' => $usuarioId,
                ':nome' => $nome,
                ':crm' => $crm,
                ':uf' => $input['uf'] ?? 'CE',
                ':especialidade' => $especialidade ?: 'Oftalmologia',
                ':telefone' => $input['telefone'] ?? null,
                ':email' => $email,
            ]);

            $db->commit();
            http_response_code(201);
            echo json_encode(['message' => 'Médico cadastrado com sucesso e usuário criado para login', 'id' => (int)$db->lastInsertId()]);
        } catch (\Exception $e) {
            $db->rollBack();
            http_response_code(500);
            echo json_encode(['error' => 'Erro ao cadastrar médico']);
        }
    }

    public static function update(int $id): void {
        Auth::requireTela('medicos');
        $input = json_decode(file_get_contents('php://input'), true);
        $db = Database::getInstance();

        $stmt = $db->prepare('SELECT id FROM medicos WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $id, ':tid' => Tenant::id()]);
        if (!$stmt->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Médico não encontrado']);
            return;
        }

        $nome = trim($input['nome'] ?? '');
        $crm = trim($input['crm'] ?? '');

        if ($nome === '' || $crm === '') {
            http_response_code(422);
            echo json_encode(['error' => 'Nome e CRM são obrigatórios']);
            return;
        }

        // Verificar CRM único (excluindo o próprio, dentro do tenant)
        $stmt = $db->prepare('SELECT id FROM medicos WHERE crm = :crm AND id != :id AND tenant_id = :tid');
        $stmt->execute([':crm' => $crm, ':id' => $id, ':tid' => Tenant::id()]);
        if ($stmt->fetch()) {
            http_response_code(422);
            echo json_encode(['error' => 'Este CRM já está cadastrado']);
            return;
        }

        $stmt = $db->prepare(
            'UPDATE medicos SET nome = :nome, crm = :crm, uf = :uf, especialidade = :especialidade,
             telefone = :telefone, email = :email, ativo = :ativo
             WHERE id = :id AND tenant_id = :tid'
        );
        $stmt->execute([
            ':nome' => $nome,
            ':crm' => $crm,
            ':uf' => $input['uf'] ?? 'CE',
            ':especialidade' => trim($input['especialidade'] ?? 'Oftalmologia') ?: 'Oftalmologia',
            ':telefone' => $input['telefone'] ?? null,
            ':email' => $input['email'] ?? null,
            ':ativo' => isset($input['ativo']) ? (int) $input['ativo'] : 1,
            ':id' => $id,
            ':tid' => Tenant::id(),
        ]);

        echo json_encode(['message' => 'Médico atualizado com sucesso']);
    }

    public static function destroy(int $id): void {
        Auth::requireTela('medicos');
        $db = Database::getInstance();

        $stmt = $db->prepare('SELECT id FROM medicos WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $id, ':tid' => Tenant::id()]);
        if (!$stmt->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Médico não encontrado']);
            return;
        }

        $stmt = $db->prepare('DELETE FROM medicos WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $id, ':tid' => Tenant::id()]);

        echo json_encode(['message' => 'Médico excluído com sucesso']);
    }

    public static function perfil(): void {
        $user = Auth::requireAuth();
        $db = Database::getInstance();

        $stmt = $db->prepare(
            'SELECT nome, crm, uf, especialidade FROM medicos WHERE usuario_id = :uid AND tenant_id = :tid LIMIT 1'
        );
        $stmt->execute([':uid' => $user['sub'], ':tid' => Tenant::id()]);
        $medico = $stmt->fetch();

        echo json_encode($medico ?: ['nome' => $user['nome'], 'crm' => null, 'uf' => null, 'especialidade' => null]);
    }
}
