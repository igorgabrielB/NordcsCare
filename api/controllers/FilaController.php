<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../utils/AuditLog.php';

class FilaController {

    private static array $estacoesOrdem = ['acuidade', 'exames', 'laudos', 'oculos', 'altas', 'encaminhamentos'];

    /**
     * GET /api/fila — Lista toda a fila do dia, agrupada por estação.
     */
    public static function index(): void {
        Auth::requireAuth();

        $db = Database::getInstance();
        $dataParam = $_GET['data'] ?? null;

        if ($dataParam) {
            $sql = 'SELECT f.id, f.paciente_id, f.estacao, f.status, f.prioridade, f.observacoes,
                        f.atendente_id, f.created_at, f.updated_at,
                        p.nome_completo, p.codigo, p.convenio,
                        u.nome AS atendente_nome
                 FROM fila f
                 JOIN pacientes p ON p.id = f.paciente_id
                 LEFT JOIN usuarios u ON u.id = f.atendente_id
                 WHERE DATE(f.created_at) = :data
                 ORDER BY f.prioridade DESC, f.created_at ASC';
            $stmt = $db->prepare($sql);
            $stmt->execute([':data' => $dataParam]);
        } else {
            $sql = 'SELECT f.id, f.paciente_id, f.estacao, f.status, f.prioridade, f.observacoes,
                        f.atendente_id, f.created_at, f.updated_at,
                        p.nome_completo, p.codigo, p.convenio,
                        u.nome AS atendente_nome
                 FROM fila f
                 JOIN pacientes p ON p.id = f.paciente_id
                 LEFT JOIN usuarios u ON u.id = f.atendente_id
                 WHERE DATE(f.created_at) = CURDATE()
                 ORDER BY f.prioridade DESC, f.created_at ASC';
            $stmt = $db->prepare($sql);
            $stmt->execute();
        }
        $items = $stmt->fetchAll();

        // Agrupar por estação
        $filaAgrupada = [];
        foreach (self::$estacoesOrdem as $estacao) {
            $filaAgrupada[$estacao] = [];
        }
        foreach ($items as $item) {
            $filaAgrupada[$item['estacao']][] = $item;
        }

        echo json_encode($filaAgrupada);
    }

    /**
     * POST /api/fila — Adiciona paciente na fila (check-in direto para acuidade).
     */
    public static function store(): void {
        $user = Auth::requireRole(['admin', 'administrativo']);

        $input = json_decode(file_get_contents('php://input'), true);

        if (empty($input['paciente_id'])) {
            http_response_code(400);
            echo json_encode(['error' => 'paciente_id é obrigatório']);
            return;
        }

        $db = Database::getInstance();

        // Verificar se paciente existe
        $stmt = $db->prepare('SELECT id, nome_completo FROM pacientes WHERE id = :id');
        $stmt->execute([':id' => $input['paciente_id']]);
        if (!$stmt->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Paciente não encontrado']);
            return;
        }

        // Verificar se já está na fila (apenas 1 registro por paciente)
        $stmt = $db->prepare(
            'SELECT id FROM fila WHERE paciente_id = :pid LIMIT 1'
        );
        $stmt->execute([':pid' => $input['paciente_id']]);
        if ($stmt->fetch()) {
            http_response_code(409);
            echo json_encode(['error' => 'Paciente já está na fila']);
            return;
        }

        $stmt = $db->prepare(
            'INSERT INTO fila (paciente_id, estacao, status, prioridade, observacoes)
             VALUES (:paciente_id, :estacao, :status, :prioridade, :observacoes)'
        );
        $stmt->execute([
            ':paciente_id' => $input['paciente_id'],
            ':estacao' => 'acuidade',
            ':status' => 'em_atendimento',
            ':prioridade' => (int)($input['prioridade'] ?? 0),
            ':observacoes' => $input['observacoes'] ?? null,
        ]);

        $filaId = (int)$db->lastInsertId();

        AuditLog::registrar('criar', 'fila', $filaId, "Paciente {$input['paciente_id']} adicionado à fila", $user);

        http_response_code(201);
        echo json_encode(['message' => 'Paciente adicionado à fila', 'id' => $filaId]);
    }

    /**
     * PUT /api/fila/{id}/avancar — Move paciente para a próxima estação.
     */
    public static function avancar(int $id): void {
        $user = Auth::requireAuth();

        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT * FROM fila WHERE id = :id');
        $stmt->execute([':id' => $id]);
        $fila = $stmt->fetch();

        if (!$fila) {
            http_response_code(404);
            echo json_encode(['error' => 'Registro de fila não encontrado']);
            return;
        }

        // Somente admin pode avançar pacientes que estão em altas
        if ($fila['estacao'] === 'altas' && $user['role'] !== 'admin') {
            http_response_code(403);
            echo json_encode(['error' => 'Somente administradores podem alterar pacientes em alta']);
            return;
        }

        $currentIndex = array_search($fila['estacao'], self::$estacoesOrdem);
        if ($currentIndex === false || $currentIndex >= count(self::$estacoesOrdem) - 1) {
            // Última estação — marcar como concluído
            $stmt = $db->prepare('UPDATE fila SET status = :status WHERE id = :id');
            $stmt->execute([':status' => 'concluido', ':id' => $id]);
            AuditLog::registrar('avancar', 'fila', $id, 'Paciente concluiu o atendimento', $user);
            echo json_encode(['message' => 'Paciente concluiu o atendimento', 'status' => 'concluido']);
            return;
        }

        $nextEstacao = self::$estacoesOrdem[$currentIndex + 1];

        $stmt = $db->prepare(
            'UPDATE fila SET estacao = :estacao, status = :status, atendente_id = NULL WHERE id = :id'
        );
        $stmt->execute([
            ':estacao' => $nextEstacao,
            ':status' => 'em_atendimento',
            ':id' => $id,
        ]);

        echo json_encode([
            'message' => 'Paciente movido para ' . $nextEstacao,
            'estacao' => $nextEstacao,
        ]);
        AuditLog::registrar('avancar', 'fila', $id, "Paciente avançou para {$nextEstacao}", $user);
    }

    /**
     * PUT /api/fila/{id}/status — Atualiza status (aguardando / em_atendimento / concluido).
     */
    public static function updateStatus(int $id): void {
        Auth::requireAuth();

        $input = json_decode(file_get_contents('php://input'), true);

        $allowedStatuses = ['aguardando', 'em_atendimento', 'concluido'];
        if (empty($input['status']) || !in_array($input['status'], $allowedStatuses, true)) {
            http_response_code(400);
            echo json_encode(['error' => 'Status inválido. Use: ' . implode(', ', $allowedStatuses)]);
            return;
        }

        $db = Database::getInstance();

        $stmt = $db->prepare('SELECT id FROM fila WHERE id = :id');
        $stmt->execute([':id' => $id]);
        if (!$stmt->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Registro não encontrado']);
            return;
        }

        $user = Auth::requireAuth();
        $atendenteId = $input['status'] === 'em_atendimento' ? $user['sub'] : null;

        $stmt = $db->prepare('UPDATE fila SET status = :status, atendente_id = :atendente WHERE id = :id');
        $stmt->execute([
            ':status' => $input['status'],
            ':atendente' => $atendenteId,
            ':id' => $id,
        ]);

        echo json_encode(['message' => 'Status atualizado']);
    }

    /**
     * PUT /api/fila/{id}/mover — Move paciente para uma estação específica.
     */
    public static function mover(int $id): void {
        $user = Auth::requireAuth();

        $input = json_decode(file_get_contents('php://input'), true);

        if (empty($input['estacao']) || !in_array($input['estacao'], self::$estacoesOrdem, true)) {
            http_response_code(400);
            echo json_encode(['error' => 'Estação inválida. Use: ' . implode(', ', self::$estacoesOrdem)]);
            return;
        }

        $db = Database::getInstance();

        $stmt = $db->prepare('SELECT id, estacao FROM fila WHERE id = :id');
        $stmt->execute([':id' => $id]);
        $fila = $stmt->fetch();
        if (!$fila) {
            http_response_code(404);
            echo json_encode(['error' => 'Registro não encontrado']);
            return;
        }

        // Somente admin pode mover pacientes que estão em altas
        if ($fila['estacao'] === 'altas' && $user['role'] !== 'admin') {
            http_response_code(403);
            echo json_encode(['error' => 'Somente administradores podem alterar pacientes em alta']);
            return;
        }

        $stmt = $db->prepare(
            'UPDATE fila SET estacao = :estacao, status = :status, atendente_id = NULL WHERE id = :id'
        );
        $stmt->execute([
            ':estacao' => $input['estacao'],
            ':status' => 'em_atendimento',
            ':id' => $id,
        ]);

        echo json_encode(['message' => 'Paciente movido para ' . $input['estacao']]);

        AuditLog::registrar('mover', 'fila', $id, "Paciente movido para estação {$input['estacao']}", $user);
    }

    /**
     * DELETE /api/fila/{id} — Remove paciente da fila.
     */
    public static function destroy(int $id): void {
        $user = Auth::requireRole(['admin', 'administrativo']);

        $db = Database::getInstance();

        $stmt = $db->prepare('SELECT id, estacao FROM fila WHERE id = :id');
        $stmt->execute([':id' => $id]);
        $fila = $stmt->fetch();
        if (!$fila) {
            http_response_code(404);
            echo json_encode(['error' => 'Registro não encontrado']);
            return;
        }

        // Somente admin pode remover pacientes que estão em altas
        if ($fila['estacao'] === 'altas' && $user['role'] !== 'admin') {
            http_response_code(403);
            echo json_encode(['error' => 'Somente administradores podem alterar pacientes em alta']);
            return;
        }

        $stmt = $db->prepare('DELETE FROM fila WHERE id = :id');
        $stmt->execute([':id' => $id]);

        AuditLog::registrar('excluir', 'fila', $id, 'Paciente removido da fila', $user);

        echo json_encode(['message' => 'Paciente removido da fila']);
    }

    /**
     * GET /api/fila/pacientes-disponiveis — Lista pacientes que NÃO estão na fila hoje.
     */
    public static function pacientesDisponiveis(): void {
        Auth::requireAuth();

        $db = Database::getInstance();
        $search = $_GET['search'] ?? '';

        $sql = 'SELECT p.id, p.nome_completo, p.cpf, p.convenio
                FROM pacientes p
                WHERE p.id NOT IN (
                    SELECT f.paciente_id FROM fila f
                )';

        if ($search !== '') {
            $sql .= ' AND (p.nome_completo LIKE :search OR p.cpf LIKE :search2)';
        }
        $sql .= ' ORDER BY p.nome_completo ASC LIMIT 20';

        $stmt = $db->prepare($sql);
        $params = [];
        if ($search !== '') {
            $searchTerm = "%$search%";
            $params[':search'] = $searchTerm;
            $params[':search2'] = $searchTerm;
        }
        $stmt->execute($params);

        echo json_encode($stmt->fetchAll());
    }

    /**
     * PUT /api/fila/{id}/prioridade — Alterna prioridade do paciente na fila.
     */
    public static function togglePrioridade(int $id): void {
        $user = Auth::requireRole(['admin', 'administrativo']);

        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT id, prioridade FROM fila WHERE id = :id');
        $stmt->execute([':id' => $id]);
        $fila = $stmt->fetch();

        if (!$fila) {
            http_response_code(404);
            echo json_encode(['error' => 'Registro não encontrado']);
            return;
        }

        $novaPrioridade = $fila['prioridade'] > 0 ? 0 : 1;
        $stmt = $db->prepare('UPDATE fila SET prioridade = :prioridade WHERE id = :id');
        $stmt->execute([':prioridade' => $novaPrioridade, ':id' => $id]);

        $label = $novaPrioridade > 0 ? 'ativada' : 'removida';
        AuditLog::registrar('prioridade', 'fila', $id, "Prioridade {$label}", $user);

        echo json_encode(['message' => "Prioridade {$label}", 'prioridade' => $novaPrioridade]);
    }
}
