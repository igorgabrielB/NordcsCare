<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../utils/AuditLog.php';

class FilaController {

    // Arrays estáticos mantidos para retrocompatibilidade (fila sem especialidade_id)
    private static array $estacoesOrdemFallback = ['acuidade', 'laudos', 'oculos', 'altas', 'encaminhamentos'];

    private static array $senhaPrefixFallback = [
        'acuidade'        => 'AC',
        'exames'          => 'EX',
        'laudos'          => 'LA',
        'oculos'          => 'OC',
        'altas'           => 'AL',
        'encaminhamentos' => 'EN',
    ];

    /**
     * Busca estações da fila de uma especialidade no banco de dados.
     * Retorna array de rows com campos: nome, label, cor, icone, prefixo_senha, gera_senha.
     * Se especialidade_id for null/0, retorna array vazio (usar fallback).
     */
    private static function getEstacoesDinamicas(PDO $db, int $tenantId, ?int $especialidadeId): array {
        if (!$especialidadeId) return [];
        $stmt = $db->prepare(
            'SELECT nome, label, cor, icone, prefixo_senha, gera_senha
             FROM fila_estacoes
             WHERE especialidade_id = :eid AND tenant_id = :tid AND ativo = 1
             ORDER BY ordem ASC'
        );
        $stmt->execute([':eid' => $especialidadeId, ':tid' => $tenantId]);
        return $stmt->fetchAll();
    }

    /**
     * Gera o próximo número de senha formatado para a estação (ex: AC001, EX003).
     * Retorna null para estações configuradas com gera_senha = 0.
     */
    public static function gerarSenha(PDO $db, string $estacao, int $tenantId, ?int $especialidadeId = null): ?string {
        if ($especialidadeId) {
            $stmt = $db->prepare(
                'SELECT prefixo_senha, gera_senha FROM fila_estacoes
                 WHERE nome = :nome AND especialidade_id = :eid AND tenant_id = :tid LIMIT 1'
            );
            $stmt->execute([':nome' => $estacao, ':eid' => $especialidadeId, ':tid' => $tenantId]);
            $row = $stmt->fetch();
            if ($row && !(int)$row['gera_senha']) return null;
            $prefix = $row ? $row['prefixo_senha'] : strtoupper(substr($estacao, 0, 2));
        } else {
            // Fallback para registros sem especialidade_id
            if (in_array($estacao, ['altas', 'encaminhamentos'], true)) return null;
            $prefix = self::$senhaPrefixFallback[$estacao] ?? strtoupper(substr($estacao, 0, 2));
        }
        $stmt = $db->prepare(
            'SELECT COUNT(*) FROM fila WHERE tenant_id = :tid AND estacao = :estacao AND DATE(created_at) = CURDATE()'
        );
        $stmt->execute([':tid' => $tenantId, ':estacao' => $estacao]);
        $seq = (int)$stmt->fetchColumn() + 1;
        return $prefix . str_pad($seq, 3, '0', STR_PAD_LEFT);
    }

    /**
     * GET /api/fila — Lista toda a fila do dia, agrupada por estação.
     */
    public static function index(): void {
        Auth::requireAuth();

        $db = Database::getInstance();
        $tenantId = Tenant::id();
        $dataParam = $_GET['data'] ?? null;
        $escolaParam = isset($_GET['escola']) ? trim($_GET['escola']) : null;

        // Subquery multi-dia: também exibe entradas não concluídas de dias anteriores
        // quando a escola do paciente está agendada para a data consultada.
        $sqlMultiDia = '(
                DATE(f.created_at) = :data
                OR (
                    f.status != \'concluido\'
                    AND f.estacao NOT IN (\'altas\', \'encaminhamentos\')
                    AND DATE(f.created_at) IN (
                        SELECT ea.data_atendimento FROM escola_agenda ea WHERE ea.escola = p.escola
                    )
                    AND EXISTS (
                        SELECT 1 FROM escola_agenda ea2
                        WHERE ea2.escola = p.escola AND ea2.data_atendimento = :data2
                    )
                )
            )';

        $sqlMultiDiaCurdate = '(
                DATE(f.created_at) = CURDATE()
                OR (
                    f.status != \'concluido\'
                    AND f.estacao NOT IN (\'altas\', \'encaminhamentos\')
                    AND DATE(f.created_at) IN (
                        SELECT ea.data_atendimento FROM escola_agenda ea WHERE ea.escola = p.escola
                    )
                    AND EXISTS (
                        SELECT 1 FROM escola_agenda ea2
                        WHERE ea2.escola = p.escola AND ea2.data_atendimento = CURDATE()
                    )
                )
            )';

        $escolaFilter = $escolaParam ? ' AND p.escola = :escola' : '';

        if ($dataParam) {
            $sql = "SELECT f.id, f.paciente_id, f.estacao, f.status, f.prioridade, f.observacoes,
                        f.atendente_id, f.created_at, f.updated_at, f.senha,
                        p.nome_completo, p.codigo, p.convenio, p.escola,
                        u.nome AS atendente_nome
                 FROM fila f
                 JOIN pacientes p ON p.id = f.paciente_id
                 LEFT JOIN usuarios u ON u.id = f.atendente_id
                 WHERE f.tenant_id = :tid AND {$sqlMultiDia}{$escolaFilter}
                 ORDER BY f.prioridade DESC, f.created_at ASC";
            $params = [':tid' => $tenantId, ':data' => $dataParam, ':data2' => $dataParam];
            if ($escolaParam) $params[':escola'] = $escolaParam;
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
        } else {
            $sql = "SELECT f.id, f.paciente_id, f.estacao, f.status, f.prioridade, f.observacoes,
                        f.atendente_id, f.created_at, f.updated_at, f.senha,
                        p.nome_completo, p.codigo, p.convenio, p.escola,
                        u.nome AS atendente_nome
                 FROM fila f
                 JOIN pacientes p ON p.id = f.paciente_id
                 LEFT JOIN usuarios u ON u.id = f.atendente_id
                 WHERE f.tenant_id = :tid AND {$sqlMultiDiaCurdate}{$escolaFilter}
                 ORDER BY f.prioridade DESC, f.created_at ASC";
            $params = [':tid' => $tenantId];
            if ($escolaParam) $params[':escola'] = $escolaParam;
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
        }
        $items = $stmt->fetchAll();

        // Agrupar por estação dinamicamente — sempre retorna Record<string, FilaItem[]>
        $especialidadeId = isset($_GET['especialidade_id']) ? (int)$_GET['especialidade_id'] : null;
        $filaAgrupada = [];

        if ($especialidadeId) {
            $estacoesDef = self::getEstacoesDinamicas($db, $tenantId, $especialidadeId);
            foreach ($estacoesDef as $est) {
                $filaAgrupada[$est['nome']] = [];
            }
        } else {
            foreach (self::$estacoesOrdemFallback as $estacao) {
                $filaAgrupada[$estacao] = [];
            }
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
        $user = Auth::requireTela('fila');

        $input = json_decode(file_get_contents('php://input'), true);

        if (empty($input['paciente_id'])) {
            http_response_code(400);
            echo json_encode(['error' => 'paciente_id é obrigatório']);
            return;
        }

        $db = Database::getInstance();
        $tenantId = Tenant::id();

        // Verificar se paciente existe no tenant
        $stmt = $db->prepare('SELECT id, nome_completo FROM pacientes WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $input['paciente_id'], ':tid' => $tenantId]);
        if (!$stmt->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Paciente não encontrado']);
            return;
        }

        // Verificar se já está na fila ativa (hoje ou em dia anterior se a escola for multi-dia)
        $stmt = $db->prepare(
            'SELECT f.id FROM fila f
             JOIN pacientes p ON p.id = f.paciente_id
             WHERE f.paciente_id = :pid
               AND f.estacao NOT IN ("altas", "encaminhamentos")
               AND f.status != "concluido"
               AND (
                   DATE(f.created_at) = CURDATE()
                   OR (
                       DATE(f.created_at) IN (
                           SELECT ea.data_atendimento FROM escola_agenda ea WHERE ea.escola = p.escola
                       )
                       AND EXISTS (
                           SELECT 1 FROM escola_agenda ea2
                           WHERE ea2.escola = p.escola AND ea2.data_atendimento = CURDATE()
                       )
                   )
               )
             LIMIT 1'
        );
        $stmt->execute([':pid' => $input['paciente_id']]);
        if ($stmt->fetch()) {
            http_response_code(409);
            echo json_encode(['error' => 'Paciente já está na fila']);
            return;
        }

        // Verificar se paciente já foi atendido hoje (está em altas/encaminhamentos)
        $warning = null;
        $stmt = $db->prepare(
            'SELECT resultado, hora_saida FROM atendimentos_historico WHERE paciente_id = :pid AND data_atendimento = CURDATE() LIMIT 1'
        );
        $stmt->execute([':pid' => $input['paciente_id']]);
        $historicoHoje = $stmt->fetch();
        if ($historicoHoje) {
            $resultadoLabel = match($historicoHoje['resultado']) {
                'alta' => 'Alta',
                'encaminhamento' => 'Encaminhamento',
                'oculos' => 'Óculos (Alta)',
                'oculos_encaminhamento' => 'Óculos (Encaminhamento)',
                default => $historicoHoje['resultado'],
            };
            $horaSaida = $historicoHoje['hora_saida'] ? date('H:i', strtotime($historicoHoje['hora_saida'])) : '';
            $warning = "Paciente já foi atendido hoje ({$resultadoLabel}" . ($horaSaida ? " às {$horaSaida}" : '') . ")";
        }

        // Determinar especialidade e primeira estação
        $especialidadeId = !empty($input['especialidade_id']) ? (int)$input['especialidade_id'] : null;
        $primeiraEstacao = 'acuidade'; // fallback

        if ($especialidadeId) {
            // Verificar que especialidade pertence ao tenant
            $stmtEsp = $db->prepare('SELECT id FROM especialidades WHERE id = :id AND tenant_id = :tid AND ativo = 1');
            $stmtEsp->execute([':id' => $especialidadeId, ':tid' => $tenantId]);
            if (!$stmtEsp->fetch()) {
                http_response_code(404);
                echo json_encode(['error' => 'Especialidade não encontrada']);
                return;
            }
            $stmtEst = $db->prepare(
                'SELECT nome FROM fila_estacoes WHERE especialidade_id = :eid AND tenant_id = :tid AND ativo = 1 ORDER BY ordem ASC LIMIT 1'
            );
            $stmtEst->execute([':eid' => $especialidadeId, ':tid' => $tenantId]);
            $firstRow = $stmtEst->fetch();
            if ($firstRow) $primeiraEstacao = $firstRow['nome'];
        }

        $senha = self::gerarSenha($db, $primeiraEstacao, $tenantId, $especialidadeId);

        $stmt = $db->prepare(
            'INSERT INTO fila (tenant_id, paciente_id, especialidade_id, estacao, status, prioridade, observacoes, senha)
             VALUES (:tid, :paciente_id, :especialidade_id, :estacao, :status, :prioridade, :observacoes, :senha)'
        );
        $stmt->execute([
            ':tid'            => $tenantId,
            ':paciente_id'    => $input['paciente_id'],
            ':especialidade_id'=> $especialidadeId,
            ':estacao'        => $primeiraEstacao,
            ':status'         => 'em_atendimento',
            ':prioridade'     => (int)($input['prioridade'] ?? 0),
            ':observacoes'    => $input['observacoes'] ?? null,
            ':senha'          => $senha,
        ]);

        $filaId = (int)$db->lastInsertId();

        AuditLog::registrar('criar', 'fila', $filaId, "Paciente {$input['paciente_id']} adicionado à fila", $user);

        http_response_code(201);
        $response = ['message' => 'Paciente adicionado à fila', 'id' => $filaId, 'estacao' => $primeiraEstacao];
        if ($warning) {
            $response['warning'] = $warning;
        }
        echo json_encode($response);
    }

    /**
     * PUT /api/fila/{id}/avancar — Move paciente para a próxima estação.
     */
    public static function avancar(int $id): void {
        $user = Auth::requireAuth();

        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT id, estacao, especialidade_id FROM fila WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $id, ':tid' => Tenant::id()]);
        $fila = $stmt->fetch();

        if (!$fila) {
            http_response_code(404);
            echo json_encode(['error' => 'Registro de fila não encontrado']);
            return;
        }

        $especialidadeId = $fila['especialidade_id'] ? (int)$fila['especialidade_id'] : null;

        // Buscar estações dinâmicas ou fallback
        if ($especialidadeId) {
            $estacoesDef = self::getEstacoesDinamicas($db, Tenant::id(), $especialidadeId);
            $estacoesOrdem = array_column($estacoesDef, 'nome');
        } else {
            $estacoesOrdem = self::$estacoesOrdemFallback;
        }

        // Somente admin/master pode avançar pacientes que estão na última estação confirmada (ex: altas)
        $ultimaEstacao = end($estacoesOrdem);
        if ($fila['estacao'] === $ultimaEstacao && !Auth::hasTela($user, 'admin')) {
            http_response_code(403);
            echo json_encode(['error' => 'Somente administradores podem alterar pacientes na última estação']);
            return;
        }

        $currentIndex = array_search($fila['estacao'], $estacoesOrdem);
        if ($currentIndex === false || $currentIndex >= count($estacoesOrdem) - 1) {
            // Última estação — marcar como concluído
            $stmt = $db->prepare('UPDATE fila SET status = :status WHERE id = :id');
            $stmt->execute([':status' => 'concluido', ':id' => $id]);
            AuditLog::registrar('avancar', 'fila', $id, 'Paciente concluiu o atendimento', $user);
            echo json_encode(['message' => 'Paciente concluiu o atendimento', 'status' => 'concluido']);
            return;
        }

        $nextEstacao = $estacoesOrdem[$currentIndex + 1];
        $novaSenha = self::gerarSenha($db, $nextEstacao, Tenant::id(), $especialidadeId);

        $stmt = $db->prepare(
            'UPDATE fila SET estacao = :estacao, status = :status, senha = :senha, atendente_id = NULL WHERE id = :id'
        );
        $stmt->execute([
            ':estacao' => $nextEstacao,
            ':status'  => 'em_atendimento',
            ':senha'   => $novaSenha,
            ':id'      => $id,
        ]);

        echo json_encode([
            'message' => 'Paciente movido para ' . $nextEstacao,
            'estacao' => $nextEstacao,
            'senha'   => $novaSenha,
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

        $stmt = $db->prepare('SELECT id FROM fila WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $id, ':tid' => Tenant::id()]);
        if (!$stmt->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Registro não encontrado']);
            return;
        }

        $user = Auth::requireAuth();
        $atendenteId = $input['status'] === 'em_atendimento' ? $user['sub'] : null;

        $stmt = $db->prepare('UPDATE fila SET status = :status, atendente_id = :atendente WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([
            ':status' => $input['status'],
            ':atendente' => $atendenteId,
            ':id' => $id,
            ':tid' => Tenant::id(),
        ]);

        echo json_encode(['message' => 'Status atualizado']);
    }

    /**
     * PUT /api/fila/{id}/mover — Move paciente para uma estação específica.
     */
    public static function mover(int $id): void {
        $user = Auth::requireAuth();

        $input = json_decode(file_get_contents('php://input'), true);
        $db = Database::getInstance();
        $tid = Tenant::id();

        if (empty($input['estacao'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Estação é obrigatória']);
            return;
        }

        $stmt = $db->prepare('SELECT id, estacao, especialidade_id FROM fila WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $id, ':tid' => $tid]);
        $fila = $stmt->fetch();
        if (!$fila) {
            http_response_code(404);
            echo json_encode(['error' => 'Registro não encontrado']);
            return;
        }

        $especialidadeId = $fila['especialidade_id'] ? (int)$fila['especialidade_id'] : null;

        // Validar estação destino
        if ($especialidadeId) {
            $estacoesDef = self::getEstacoesDinamicas($db, $tid, $especialidadeId);
            $estacoesNomes = array_column($estacoesDef, 'nome');
        } else {
            $estacoesNomes = self::$estacoesOrdemFallback;
        }

        if (!in_array($input['estacao'], $estacoesNomes, true)) {
            http_response_code(400);
            echo json_encode(['error' => 'Estação inválida. Use: ' . implode(', ', $estacoesNomes)]);
            return;
        }

        $ultimaEstacao = end($estacoesNomes);
        if ($fila['estacao'] === $ultimaEstacao && !Auth::hasTela($user, 'admin')) {
            http_response_code(403);
            echo json_encode(['error' => 'Somente administradores podem alterar pacientes na última estação']);
            return;
        }

        $novaSenha = self::gerarSenha($db, $input['estacao'], $tid, $especialidadeId);

        $stmt = $db->prepare(
            'UPDATE fila SET estacao = :estacao, status = :status, senha = :senha, atendente_id = NULL WHERE id = :id AND tenant_id = :tid'
        );
        $stmt->execute([
            ':estacao' => $input['estacao'],
            ':status'  => 'em_atendimento',
            ':senha'   => $novaSenha,
            ':id'      => $id,
            ':tid'     => $tid,
        ]);

        echo json_encode(['message' => 'Paciente movido para ' . $input['estacao'], 'senha' => $novaSenha]);

        AuditLog::registrar('mover', 'fila', $id, "Paciente movido para estação {$input['estacao']}", $user);
    }

    /**
     * DELETE /api/fila/{id} — Remove paciente da fila.
     */
    public static function destroy(int $id): void {
        $user = Auth::requireTela('fila');

        $db = Database::getInstance();

        $stmt = $db->prepare('SELECT id, estacao, especialidade_id FROM fila WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $id, ':tid' => Tenant::id()]);
        $fila = $stmt->fetch();
        if (!$fila) {
            http_response_code(404);
            echo json_encode(['error' => 'Registro não encontrado']);
            return;
        }

        $especialidadeId = $fila['especialidade_id'] ? (int)$fila['especialidade_id'] : null;
        if ($especialidadeId) {
            $estacoesDef = self::getEstacoesDinamicas($db, Tenant::id(), $especialidadeId);
            $ultimaEstacao = !empty($estacoesDef) ? end($estacoesDef)['nome'] : 'encaminhamentos';
        } else {
            $ultimaEstacao = 'altas';
        }

        if ($fila['estacao'] === $ultimaEstacao && !Auth::hasTela($user, 'admin')) {
            http_response_code(403);
            echo json_encode(['error' => 'Somente administradores podem alterar pacientes na última estação']);
            return;
        }

        $stmt = $db->prepare('DELETE FROM fila WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $id, ':tid' => Tenant::id()]);

        AuditLog::registrar('excluir', 'fila', $id, 'Paciente removido da fila', $user);

        echo json_encode(['message' => 'Paciente removido da fila']);
    }

    /**
     * GET /api/fila/pacientes-disponiveis — Lista pacientes que NÃO estão na fila hoje.
     */
    public static function pacientesDisponiveis(): void {
        Auth::requireAuth();

        $db = Database::getInstance();
        $tenantId = Tenant::id();
        $search = $_GET['search'] ?? '';

        $sql = 'SELECT p.id, p.nome_completo, p.cpf, p.convenio
                FROM pacientes p
                WHERE p.tenant_id = :tid AND p.id NOT IN (
                    SELECT f.paciente_id FROM fila f WHERE f.tenant_id = :tid2
                )';

        if ($search !== '') {
            $sql .= ' AND (p.nome_completo LIKE :search OR p.cpf LIKE :search2)';
        }
        $sql .= ' ORDER BY p.nome_completo ASC LIMIT 20';

        $stmt = $db->prepare($sql);
        $params = [':tid' => $tenantId, ':tid2' => $tenantId];
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
        $user = Auth::requireTela('fila');

        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT id, prioridade FROM fila WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $id, ':tid' => Tenant::id()]);
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

    /**
     * POST /api/fila/{id}/chamar — Chama paciente no painel de senha.
     */
    public static function chamar(int $id): void {
        $user = Auth::requireTela('chamar_paciente');

        $db = Database::getInstance();
        $stmt = $db->prepare(
            'SELECT f.id, f.senha, f.estacao, p.nome_completo
             FROM fila f
             JOIN pacientes p ON p.id = f.paciente_id
             WHERE f.id = :id AND f.tenant_id = :tid'
        );
        $stmt->execute([':id' => $id, ':tid' => Tenant::id()]);
        $fila = $stmt->fetch();

        if (!$fila) {
            http_response_code(404);
            echo json_encode(['error' => 'Registro não encontrado']);
            return;
        }

        $stmt = $db->prepare('UPDATE fila SET chamada_em = NOW() WHERE id = :id');
        $stmt->execute([':id' => $id]);

        AuditLog::registrar('chamar', 'fila', $id, "Paciente chamado no painel", $user);

        echo json_encode([
            'message' => 'Paciente chamado',
            'senha' => $fila['senha'],
            'nome_completo' => $fila['nome_completo'],
            'estacao' => $fila['estacao'],
        ]);
    }
}
