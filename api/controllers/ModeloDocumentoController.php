<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../middleware/tenant.php';

class ModeloDocumentoController
{
    public static function index(): void
    {
        Auth::requireAuth();
        $db = Database::getInstance();

        $tipo = $_GET['tipo'] ?? null;
        if ($tipo) {
            $stmt = $db->prepare(
                'SELECT m.id, m.tipo, m.nome, m.conteudo, m.usuario_id, u.nome AS autor_nome, m.created_at, m.updated_at
                 FROM modelos_documentos m
                 JOIN usuarios u ON u.id = m.usuario_id
                 WHERE m.tenant_id = :tid AND m.tipo = :tipo
                 ORDER BY m.nome ASC'
            );
            $stmt->execute([':tid' => Tenant::id(), ':tipo' => $tipo]);
        } else {
            $stmt = $db->prepare(
                'SELECT m.id, m.tipo, m.nome, m.conteudo, m.usuario_id, u.nome AS autor_nome, m.created_at, m.updated_at
                 FROM modelos_documentos m
                 JOIN usuarios u ON u.id = m.usuario_id
                 WHERE m.tenant_id = :tid
                 ORDER BY m.tipo, m.nome ASC'
            );
            $stmt->execute([':tid' => Tenant::id()]);
        }
        echo json_encode($stmt->fetchAll());
    }

    public static function store(): void
    {
        $user = Auth::requireTela('modelos_docs');
        $input = json_decode(file_get_contents('php://input'), true);
        $db = Database::getInstance();

        $tipo = trim($input['tipo'] ?? '');
        $nome = trim($input['nome'] ?? '');
        $conteudo = trim($input['conteudo'] ?? '');

        if (!in_array($tipo, ['atestado', 'receita_medica'])) {
            http_response_code(422);
            echo json_encode(['error' => 'Tipo inválido']);
            return;
        }
        if ($nome === '') {
            http_response_code(422);
            echo json_encode(['error' => 'Nome do modelo é obrigatório']);
            return;
        }
        if ($conteudo === '') {
            http_response_code(422);
            echo json_encode(['error' => 'Conteúdo do modelo é obrigatório']);
            return;
        }

        $stmt = $db->prepare(
            'INSERT INTO modelos_documentos (tenant_id, tipo, nome, conteudo, usuario_id) VALUES (:tid, :tipo, :nome, :conteudo, :uid)'
        );
        $stmt->execute([
            ':tid' => Tenant::id(),
            ':tipo' => $tipo,
            ':nome' => $nome,
            ':conteudo' => $conteudo,
            ':uid' => $user['sub'],
        ]);

        http_response_code(201);
        echo json_encode(['id' => (int)$db->lastInsertId(), 'message' => 'Modelo criado com sucesso']);
    }

    public static function update(int $id): void
    {
        $user = Auth::requireTela('modelos_docs');
        $input = json_decode(file_get_contents('php://input'), true);
        $db = Database::getInstance();

        $stmt = $db->prepare('SELECT * FROM modelos_documentos WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $id, ':tid' => Tenant::id()]);
        $modelo = $stmt->fetch();

        if (!$modelo) {
            http_response_code(404);
            echo json_encode(['error' => 'Modelo não encontrado']);
            return;
        }

        if (!Auth::hasTela($user, 'modelos_docs') && (int)$modelo['usuario_id'] !== (int)$user['sub']) {
            http_response_code(403);
            echo json_encode(['error' => 'Sem permissão para editar este modelo']);
            return;
        }

        $nome = trim($input['nome'] ?? $modelo['nome']);
        $conteudo = trim($input['conteudo'] ?? $modelo['conteudo']);

        if ($nome === '' || $conteudo === '') {
            http_response_code(422);
            echo json_encode(['error' => 'Nome e conteúdo são obrigatórios']);
            return;
        }

        $stmt = $db->prepare('UPDATE modelos_documentos SET nome = :nome, conteudo = :conteudo WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':nome' => $nome, ':conteudo' => $conteudo, ':id' => $id, ':tid' => Tenant::id()]);

        echo json_encode(['message' => 'Modelo atualizado com sucesso']);
    }

    public static function destroy(int $id): void
    {
        $user = Auth::requireTela('modelos_docs');
        $db = Database::getInstance();

        $stmt = $db->prepare('SELECT * FROM modelos_documentos WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $id, ':tid' => Tenant::id()]);
        $modelo = $stmt->fetch();

        if (!$modelo) {
            http_response_code(404);
            echo json_encode(['error' => 'Modelo não encontrado']);
            return;
        }

        if (!Auth::hasTela($user, 'modelos_docs') && (int)$modelo['usuario_id'] !== (int)$user['sub']) {
            http_response_code(403);
            echo json_encode(['error' => 'Sem permissão para excluir este modelo']);
            return;
        }

        $stmt = $db->prepare('DELETE FROM modelos_documentos WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $id, ':tid' => Tenant::id()]);

        echo json_encode(['message' => 'Modelo excluído com sucesso']);
    }
}
