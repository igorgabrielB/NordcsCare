<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../middleware/tenant.php';

class LaudoProntoController
{
    public static function index(): void
    {
        Auth::requireAuth();
        $db = Database::getInstance();

        $stmt = $db->prepare(
            'SELECT lp.id, lp.titulo, lp.diagnostico, lp.conduta, lp.observacoes, lp.especialidade, lp.ativo,
                    lp.usuario_id, u.nome AS autor_nome, lp.created_at, lp.updated_at
             FROM laudos_prontos lp
             JOIN usuarios u ON u.id = lp.usuario_id
             WHERE lp.tenant_id = :tid
             ORDER BY lp.titulo ASC'
        );
        $stmt->execute([':tid' => Tenant::id()]);
        echo json_encode($stmt->fetchAll());
    }

    public static function ativos(): void
    {
        Auth::requireAuth();
        $db = Database::getInstance();

        $stmt = $db->prepare(
            'SELECT id, titulo, diagnostico, conduta, observacoes, especialidade
             FROM laudos_prontos
             WHERE tenant_id = :tid AND ativo = 1
             ORDER BY titulo ASC'
        );
        $stmt->execute([':tid' => Tenant::id()]);
        echo json_encode($stmt->fetchAll());
    }

    public static function store(): void
    {
        $user = Auth::requireTela('laudos_prontos');
        $input = json_decode(file_get_contents('php://input'), true);
        $db = Database::getInstance();

        $titulo = trim($input['titulo'] ?? '');
        $diagnostico = trim($input['diagnostico'] ?? '');
        $conduta = trim($input['conduta'] ?? '') ?: null;
        $observacoes = trim($input['observacoes'] ?? '') ?: null;
        $especialidade = trim($input['especialidade'] ?? '') ?: null;

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
            'INSERT INTO laudos_prontos (tenant_id, titulo, diagnostico, conduta, observacoes, especialidade, usuario_id)
             VALUES (:tid, :titulo, :diagnostico, :conduta, :observacoes, :especialidade, :uid)'
        );
        $stmt->execute([
            ':tid' => Tenant::id(),
            ':titulo' => $titulo,
            ':diagnostico' => $diagnostico,
            ':conduta' => $conduta,
            ':observacoes' => $observacoes,
            ':especialidade' => $especialidade,
            ':uid' => $user['sub'],
        ]);
        $id = $db->lastInsertId();

        http_response_code(201);
        echo json_encode(['id' => (int) $id, 'message' => 'Laudo pronto criado com sucesso']);
    }

    public static function update(int $id): void
    {
        $user = Auth::requireTela('laudos_prontos');
        $input = json_decode(file_get_contents('php://input'), true);
        $db = Database::getInstance();

        $stmt = $db->prepare('SELECT id, usuario_id FROM laudos_prontos WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $id, ':tid' => Tenant::id()]);
        $existing = $stmt->fetch();

        if (!$existing) {
            http_response_code(404);
            echo json_encode(['error' => 'Laudo pronto não encontrado']);
            return;
        }

        if (!Auth::hasTela($user, 'laudos_prontos') && (int) $existing['usuario_id'] !== (int) $user['sub']) {
            http_response_code(403);
            echo json_encode(['error' => 'Sem permissão para editar este laudo pronto']);
            return;
        }

        $titulo = trim($input['titulo'] ?? '');
        $diagnostico = trim($input['diagnostico'] ?? '');
        $conduta = trim($input['conduta'] ?? '') ?: null;
        $observacoes = trim($input['observacoes'] ?? '') ?: null;
        $especialidade = trim($input['especialidade'] ?? '') ?: null;
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
                    conduta = :conduta, observacoes = :observacoes, especialidade = :especialidade, ativo = :ativo
             WHERE id = :id AND tenant_id = :tid'
        );
        $stmt->execute([
            ':titulo' => $titulo,
            ':diagnostico' => $diagnostico,
            ':conduta' => $conduta,
            ':observacoes' => $observacoes,
            ':especialidade' => $especialidade,
            ':ativo' => $ativo,
            ':id' => $id,
            ':tid' => Tenant::id(),
        ]);

        echo json_encode(['message' => 'Laudo pronto atualizado com sucesso']);
    }

    public static function destroy(int $id): void
    {
        $user = Auth::requireTela('laudos_prontos');
        $db = Database::getInstance();

        $stmt = $db->prepare('SELECT id, usuario_id FROM laudos_prontos WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $id, ':tid' => Tenant::id()]);
        $existing = $stmt->fetch();

        if (!$existing) {
            http_response_code(404);
            echo json_encode(['error' => 'Laudo pronto não encontrado']);
            return;
        }

        if (!Auth::hasTela($user, 'laudos_prontos') && (int) $existing['usuario_id'] !== (int) $user['sub']) {
            http_response_code(403);
            echo json_encode(['error' => 'Sem permissão para excluir este laudo pronto']);
            return;
        }

        $stmt = $db->prepare('DELETE FROM laudos_prontos WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $id, ':tid' => Tenant::id()]);

        echo json_encode(['message' => 'Laudo pronto excluído com sucesso']);
    }
}
