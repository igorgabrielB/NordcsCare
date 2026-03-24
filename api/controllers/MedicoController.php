<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';

class MedicoController {

    public static function index(): void {
        Auth::requireRole(['admin']);
        $db = Database::getInstance();

        $stmt = $db->query(
            'SELECT id, nome, crm, uf, especialidade, telefone, email, ativo, created_at, updated_at
             FROM medicos ORDER BY nome ASC'
        );
        echo json_encode($stmt->fetchAll());
    }

    public static function show(int $id): void {
        Auth::requireRole(['admin']);
        $db = Database::getInstance();

        $stmt = $db->prepare(
            'SELECT id, nome, crm, uf, especialidade, telefone, email, ativo, created_at, updated_at
             FROM medicos WHERE id = :id'
        );
        $stmt->execute([':id' => $id]);
        $medico = $stmt->fetch();

        if (!$medico) {
            http_response_code(404);
            echo json_encode(['error' => 'Médico não encontrado']);
            return;
        }

        echo json_encode($medico);
    }

    public static function store(): void {
        Auth::requireRole(['admin']);
        $input = json_decode(file_get_contents('php://input'), true);
        $db = Database::getInstance();

        $nome = trim($input['nome'] ?? '');
        $crm = trim($input['crm'] ?? '');
        $especialidade = trim($input['especialidade'] ?? 'Oftalmologia');
        $login = trim($input['login'] ?? '');
        $senha = $input['senha'] ?? '';

        if ($nome === '' || $crm === '') {
            http_response_code(422);
            echo json_encode(['error' => 'Nome e CRM são obrigatórios']);
            return;
        }

        if ($login === '' || $senha === '') {
            http_response_code(422);
            echo json_encode(['error' => 'Login e senha são obrigatórios']);
            return;
        }

        if (strlen($senha) < 8) {
            http_response_code(422);
            echo json_encode(['error' => 'A senha deve ter pelo menos 8 caracteres']);
            return;
        }

        // Verificar CRM único
        $stmt = $db->prepare('SELECT id FROM medicos WHERE crm = :crm');
        $stmt->execute([':crm' => $crm]);
        if ($stmt->fetch()) {
            http_response_code(422);
            echo json_encode(['error' => 'Este CRM já está cadastrado']);
            return;
        }

        // Verificar login único
        $stmt = $db->prepare('SELECT id FROM usuarios WHERE login = :login');
        $stmt->execute([':login' => $login]);
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
                'INSERT INTO usuarios (nome, login, senha, role, email)
                 VALUES (:nome, :login, :senha, :role, :email)'
            );
            $stmt->execute([
                ':nome' => $nome,
                ':login' => $login,
                ':senha' => $hash,
                ':role' => 'medico',
                ':email' => $input['email'] ?? null,
            ]);
            $usuarioId = (int)$db->lastInsertId();

            $stmt = $db->prepare(
                'INSERT INTO medicos (usuario_id, nome, crm, uf, especialidade, telefone, email)
                 VALUES (:uid, :nome, :crm, :uf, :especialidade, :telefone, :email)'
            );
            $stmt->execute([
                ':uid' => $usuarioId,
                ':nome' => $nome,
                ':crm' => $crm,
                ':uf' => $input['uf'] ?? 'CE',
                ':especialidade' => $especialidade ?: 'Oftalmologia',
                ':telefone' => $input['telefone'] ?? null,
                ':email' => $input['email'] ?? null,
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
        Auth::requireRole(['admin']);
        $input = json_decode(file_get_contents('php://input'), true);
        $db = Database::getInstance();

        $stmt = $db->prepare('SELECT id FROM medicos WHERE id = :id');
        $stmt->execute([':id' => $id]);
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

        // Verificar CRM único (excluindo o próprio)
        $stmt = $db->prepare('SELECT id FROM medicos WHERE crm = :crm AND id != :id');
        $stmt->execute([':crm' => $crm, ':id' => $id]);
        if ($stmt->fetch()) {
            http_response_code(422);
            echo json_encode(['error' => 'Este CRM já está cadastrado']);
            return;
        }

        $stmt = $db->prepare(
            'UPDATE medicos SET nome = :nome, crm = :crm, uf = :uf, especialidade = :especialidade,
             telefone = :telefone, email = :email, ativo = :ativo
             WHERE id = :id'
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
        ]);

        echo json_encode(['message' => 'Médico atualizado com sucesso']);
    }

    public static function destroy(int $id): void {
        Auth::requireRole(['admin']);
        $db = Database::getInstance();

        $stmt = $db->prepare('SELECT id FROM medicos WHERE id = :id');
        $stmt->execute([':id' => $id]);
        if (!$stmt->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Médico não encontrado']);
            return;
        }

        $stmt = $db->prepare('DELETE FROM medicos WHERE id = :id');
        $stmt->execute([':id' => $id]);

        echo json_encode(['message' => 'Médico excluído com sucesso']);
    }

    public static function perfil(): void {
        $user = Auth::requireAuth();
        $db = Database::getInstance();

        $stmt = $db->prepare(
            'SELECT nome, crm, uf, especialidade FROM medicos WHERE usuario_id = :uid LIMIT 1'
        );
        $stmt->execute([':uid' => $user['sub']]);
        $medico = $stmt->fetch();

        echo json_encode($medico ?: ['nome' => $user['nome'], 'crm' => null, 'uf' => null, 'especialidade' => null]);
    }
}
