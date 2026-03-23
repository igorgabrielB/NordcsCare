<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';

class LaudoProntoController
{
    public static function index(): void
    {
        Auth::requireAuth();
        $db = Database::getInstance();

        $stmt = $db->query(
            'SELECT lp.id, lp.titulo, lp.diagnostico, lp.conduta, lp.observacoes, lp.ativo,
                    lp.usuario_id, u.nome AS autor_nome, lp.created_at, lp.updated_at
             FROM laudos_prontos lp
             JOIN usuarios u ON u.id = lp.usuario_id
             ORDER BY lp.titulo ASC'
        );
        echo json_encode($stmt->fetchAll());
    }

    public static function ativos(): void
    {
        Auth::requireAuth();
        $db = Database::getInstance();

        $stmt = $db->query(
            'SELECT id, titulo, diagnostico, conduta, observacoes
             FROM laudos_prontos
             WHERE ativo = 1
             ORDER BY titulo ASC'
        );
        echo json_encode($stmt->fetchAll());
    }

    public static function store(): void
    {
        $user = Auth::requireRole(['admin', 'medico']);
        $input = json_decode(file_get_contents('php://input'), true);
        $db = Database::getInstance();

        $titulo = trim($input['titulo'] ?? '');
        $diagnostico = trim($input['diagnostico'] ?? '');
        $conduta = trim($input['conduta'] ?? '') ?: null;
        $observacoes = trim($input['observacoes'] ?? '') ?: null;

        if ($titulo === '') {
            http_response_code(422);
            echo json_encode(['error' => 'Título é obrigatório']);
            return;
        }
        if ($diagnostico === '') {
            http_response_code(422);
            echo json_encode(['error' => 'Diagnóstico é obrigatório']);
            return;
        }

        $stmt = $db->prepare(
            'INSERT INTO laudos_prontos (titulo, diagnostico, conduta, observacoes, usuario_id)
             VALUES (:titulo, :diagnostico, :conduta, :observacoes, :uid)'
        );
        $stmt->execute([
            ':titulo' => $titulo,
            ':diagnostico' => $diagnostico,
            ':conduta' => $conduta,
            ':observacoes' => $observacoes,
            ':uid' => $user['sub'],
        ]);
        $id = $db->lastInsertId();

        http_response_code(201);
        echo json_encode(['id' => (int) $id, 'message' => 'Laudo pronto criado com sucesso']);
    }

    public static function update(int $id): void
    {
        $user = Auth::requireRole(['admin', 'medico']);
        $input = json_decode(file_get_contents('php://input'), true);
        $db = Database::getInstance();

        $stmt = $db->prepare('SELECT id, usuario_id FROM laudos_prontos WHERE id = :id');
        $stmt->execute([':id' => $id]);
        $existing = $stmt->fetch();

        if (!$existing) {
            http_response_code(404);
            echo json_encode(['error' => 'Laudo pronto não encontrado']);
            return;
        }

        if ($user['role'] !== 'admin' && (int) $existing['usuario_id'] !== (int) $user['sub']) {
            http_response_code(403);
            echo json_encode(['error' => 'Sem permissão para editar este laudo pronto']);
            return;
        }

        $titulo = trim($input['titulo'] ?? '');
        $diagnostico = trim($input['diagnostico'] ?? '');
        $conduta = trim($input['conduta'] ?? '') ?: null;
        $observacoes = trim($input['observacoes'] ?? '') ?: null;
        $ativo = isset($input['ativo']) ? (int) $input['ativo'] : 1;

        if ($titulo === '') {
            http_response_code(422);
            echo json_encode(['error' => 'Título é obrigatório']);
            return;
        }
        if ($diagnostico === '') {
            http_response_code(422);
            echo json_encode(['error' => 'Diagnóstico é obrigatório']);
            return;
        }

        $stmt = $db->prepare(
            'UPDATE laudos_prontos SET titulo = :titulo, diagnostico = :diagnostico,
                    conduta = :conduta, observacoes = :observacoes, ativo = :ativo
             WHERE id = :id'
        );
        $stmt->execute([
            ':titulo' => $titulo,
            ':diagnostico' => $diagnostico,
            ':conduta' => $conduta,
            ':observacoes' => $observacoes,
            ':ativo' => $ativo,
            ':id' => $id,
        ]);

        echo json_encode(['message' => 'Laudo pronto atualizado com sucesso']);
    }

    public static function destroy(int $id): void
    {
        $user = Auth::requireRole(['admin', 'medico']);
        $db = Database::getInstance();

        $stmt = $db->prepare('SELECT id, usuario_id FROM laudos_prontos WHERE id = :id');
        $stmt->execute([':id' => $id]);
        $existing = $stmt->fetch();

        if (!$existing) {
            http_response_code(404);
            echo json_encode(['error' => 'Laudo pronto não encontrado']);
            return;
        }

        if ($user['role'] !== 'admin' && (int) $existing['usuario_id'] !== (int) $user['sub']) {
            http_response_code(403);
            echo json_encode(['error' => 'Sem permissão para excluir este laudo pronto']);
            return;
        }

        $stmt = $db->prepare('DELETE FROM laudos_prontos WHERE id = :id');
        $stmt->execute([':id' => $id]);

        echo json_encode(['message' => 'Laudo pronto excluído com sucesso']);
    }
}
