<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';

class UsuarioController {

    public static function index(): void {
        Auth::requireRole(['admin']);
        $db = Database::getInstance();

        $stmt = $db->query(
            'SELECT id, nome, email, login, role, ativo, created_at, updated_at
             FROM usuarios ORDER BY nome ASC'
        );
        echo json_encode($stmt->fetchAll());
    }

    public static function show(int $id): void {
        Auth::requireRole(['admin']);
        $db = Database::getInstance();

        $stmt = $db->prepare(
            'SELECT id, nome, email, login, role, ativo, created_at, updated_at
             FROM usuarios WHERE id = :id'
        );
        $stmt->execute([':id' => $id]);
        $user = $stmt->fetch();

        if (!$user) {
            http_response_code(404);
            echo json_encode(['error' => 'Usuário não encontrado']);
            return;
        }

        echo json_encode($user);
    }

    public static function store(): void {
        Auth::requireRole(['admin']);
        $input = json_decode(file_get_contents('php://input'), true);
        $db = Database::getInstance();

        $nome = trim($input['nome'] ?? '');
        $login = trim($input['login'] ?? '');
        $senha = $input['senha'] ?? '';
        $role = $input['role'] ?? 'recepcionista';

        if ($nome === '' || $login === '' || $senha === '') {
            http_response_code(422);
            echo json_encode(['error' => 'Nome, login e senha são obrigatórios']);
            return;
        }

        if (strlen($senha) < 4) {
            http_response_code(422);
            echo json_encode(['error' => 'A senha deve ter pelo menos 4 caracteres']);
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

        $hash = password_hash($senha, PASSWORD_BCRYPT);

        $stmt = $db->prepare(
            'INSERT INTO usuarios (nome, email, login, senha, role)
             VALUES (:nome, :email, :login, :senha, :role)'
        );
        $stmt->execute([
            ':nome' => $nome,
            ':email' => $input['email'] ?? null,
            ':login' => $login,
            ':senha' => $hash,
            ':role' => $role,
        ]);

        http_response_code(201);
        echo json_encode(['message' => 'Usuário criado com sucesso', 'id' => (int)$db->lastInsertId()]);
    }

    public static function update(int $id): void {
        Auth::requireRole(['admin']);
        $input = json_decode(file_get_contents('php://input'), true);
        $db = Database::getInstance();

        $stmt = $db->prepare('SELECT id FROM usuarios WHERE id = :id');
        $stmt->execute([':id' => $id]);
        if (!$stmt->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Usuário não encontrado']);
            return;
        }

        $nome = trim($input['nome'] ?? '');
        $login = trim($input['login'] ?? '');
        $role = $input['role'] ?? 'recepcionista';

        if ($nome === '' || $login === '') {
            http_response_code(422);
            echo json_encode(['error' => 'Nome e login são obrigatórios']);
            return;
        }

        // Verificar login único (excluindo o próprio)
        $stmt = $db->prepare('SELECT id FROM usuarios WHERE login = :login AND id != :id');
        $stmt->execute([':login' => $login, ':id' => $id]);
        if ($stmt->fetch()) {
            http_response_code(422);
            echo json_encode(['error' => 'Este login já está em uso']);
            return;
        }

        $stmt = $db->prepare(
            'UPDATE usuarios SET nome = :nome, email = :email, login = :login, role = :role, ativo = :ativo
             WHERE id = :id'
        );
        $stmt->execute([
            ':nome' => $nome,
            ':email' => $input['email'] ?? null,
            ':login' => $login,
            ':role' => $role,
            ':ativo' => isset($input['ativo']) ? (int) $input['ativo'] : 1,
            ':id' => $id,
        ]);

        // Atualizar senha se enviada
        if (!empty($input['senha'])) {
            if (strlen($input['senha']) < 4) {
                http_response_code(422);
                echo json_encode(['error' => 'A senha deve ter pelo menos 4 caracteres']);
                return;
            }
            $hash = password_hash($input['senha'], PASSWORD_BCRYPT);
            $stmt = $db->prepare('UPDATE usuarios SET senha = :senha WHERE id = :id');
            $stmt->execute([':senha' => $hash, ':id' => $id]);
        }

        echo json_encode(['message' => 'Usuário atualizado com sucesso']);
    }

    public static function destroy(int $id): void {
        $user = Auth::requireRole(['admin']);

        // Não pode excluir a si mesmo
        if ($user['sub'] === $id) {
            http_response_code(422);
            echo json_encode(['error' => 'Não é possível excluir seu próprio usuário']);
            return;
        }

        $db = Database::getInstance();

        $stmt = $db->prepare('SELECT id FROM usuarios WHERE id = :id');
        $stmt->execute([':id' => $id]);
        if (!$stmt->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Usuário não encontrado']);
            return;
        }

        $stmt = $db->prepare('DELETE FROM usuarios WHERE id = :id');
        $stmt->execute([':id' => $id]);
        echo json_encode(['message' => 'Usuário excluído com sucesso']);
    }
}
