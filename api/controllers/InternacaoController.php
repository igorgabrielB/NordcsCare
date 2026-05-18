<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../middleware/tenant.php';

class InternacaoController {

    // ── helpers ──────────────────────────────────────────────────────────────

    private static function tipoOk(?string $v): string {
        return in_array($v, ['enfermaria','apartamento','uti','semi_uti'], true) ? $v : 'enfermaria';
    }

    private static function leitoStatusOk(?string $v): string {
        return in_array($v, ['livre','ocupado','higienizacao','reservado'], true) ? $v : 'livre';
    }

    private static function internStatusOk(?string $v): string {
        return in_array($v, ['ativo','alta','transferido','obito'], true) ? $v : 'ativo';
    }

    private static function evolTipoOk(?string $v): string {
        return in_array($v, ['medica','enfermagem','fisioterapia','nutricao','outro'], true) ? $v : 'medica';
    }

    // ─────────────────────────────────────────────────────────────────────────
    // LEITOS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * GET /api/leitos
     * ?status=livre|ocupado|higienizacao|reservado
     * ?ala=<nome>
     * ?tipo=enfermaria|apartamento|uti|semi_uti
     */
    public static function leitosIndex(): void {
        Auth::requireAuth();
        $db  = Database::getInstance();
        $tid = Tenant::id();

        $where  = ['l.tenant_id = :tid'];
        $params = [':tid' => $tid];

        if (!empty($_GET['status'])) {
            $where[] = 'l.status = :status';
            $params[':status'] = self::leitoStatusOk($_GET['status']);
        }
        if (!empty($_GET['ala'])) {
            $where[] = 'l.ala = :ala';
            $params[':ala'] = $_GET['ala'];
        }
        if (!empty($_GET['tipo'])) {
            $where[] = 'l.tipo = :tipo';
            $params[':tipo'] = self::tipoOk($_GET['tipo']);
        }

        $sql  = 'SELECT l.*,
                        i.id AS internacao_id,
                        p.nome_completo AS paciente_nome,
                        p.id AS paciente_id
                 FROM leitos l
                 LEFT JOIN internacoes i ON i.leito_id = l.id AND i.status = \'ativo\'
                 LEFT JOIN pacientes p ON p.id = i.paciente_id
                 WHERE ' . implode(' AND ', $where) . '
                 ORDER BY l.ala ASC, l.andar ASC, l.codigo ASC';

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        echo json_encode(['data' => $stmt->fetchAll()]);
    }

    /**
     * GET /api/leitos/{id}
     */
    public static function leitosShow(int $id): void {
        Auth::requireAuth();
        $db  = Database::getInstance();
        $tid = Tenant::id();

        $stmt = $db->prepare(
            'SELECT l.*,
                    i.id AS internacao_id,
                    p.nome_completo AS paciente_nome,
                    p.id AS paciente_id
             FROM leitos l
             LEFT JOIN internacoes i ON i.leito_id = l.id AND i.status = \'ativo\'
             LEFT JOIN pacientes p ON p.id = i.paciente_id
             WHERE l.id = :id AND l.tenant_id = :tid'
        );
        $stmt->execute([':id' => $id, ':tid' => $tid]);
        $row = $stmt->fetch();

        if (!$row) { http_response_code(404); echo json_encode(['error' => 'Leito não encontrado']); return; }
        echo json_encode(['data' => $row]);
    }

    /**
     * POST /api/leitos
     */
    public static function leitosStore(): void {
        $user = Auth::requireAuth();
        $db   = Database::getInstance();
        $tid  = Tenant::id();
        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        if (empty($body['codigo'])) {
            http_response_code(422);
            echo json_encode(['error' => 'Código do leito é obrigatório']);
            return;
        }

        $stmt = $db->prepare(
            'INSERT INTO leitos (tenant_id,codigo,nome,ala,andar,tipo,status,observacoes)
             VALUES (:tid,:codigo,:nome,:ala,:andar,:tipo,:status,:obs)'
        );
        $stmt->execute([
            ':tid'    => $tid,
            ':codigo' => trim($body['codigo']),
            ':nome'   => $body['nome']   ?? null,
            ':ala'    => $body['ala']    ?? null,
            ':andar'  => $body['andar']  ?? null,
            ':tipo'   => self::tipoOk($body['tipo'] ?? null),
            ':status' => self::leitoStatusOk($body['status'] ?? 'livre'),
            ':obs'    => $body['observacoes'] ?? null,
        ]);

        $newId = (int) $db->lastInsertId();
        self::leitosShow($newId);
        http_response_code(201);
    }

    /**
     * PUT /api/leitos/{id}
     */
    public static function leitosUpdate(int $id): void {
        Auth::requireAuth();
        $db   = Database::getInstance();
        $tid  = Tenant::id();
        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        $stmt = $db->prepare('SELECT id FROM leitos WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $id, ':tid' => $tid]);
        if (!$stmt->fetch()) { http_response_code(404); echo json_encode(['error' => 'Leito não encontrado']); return; }

        $fields = [];
        $params = [':id' => $id, ':tid' => $tid];

        foreach (['codigo','nome','ala','andar','observacoes'] as $col) {
            if (array_key_exists($col, $body)) {
                $fields[] = "$col = :$col";
                $params[":$col"] = $body[$col];
            }
        }
        if (array_key_exists('tipo', $body)) {
            $fields[] = 'tipo = :tipo';
            $params[':tipo'] = self::tipoOk($body['tipo']);
        }
        if (array_key_exists('status', $body)) {
            $fields[] = 'status = :status';
            $params[':status'] = self::leitoStatusOk($body['status']);
        }

        if ($fields) {
            $db->prepare('UPDATE leitos SET ' . implode(', ', $fields) . ' WHERE id = :id AND tenant_id = :tid')
               ->execute($params);
        }

        self::leitosShow($id);
    }

    /**
     * DELETE /api/leitos/{id}
     */
    public static function leitosDestroy(int $id): void {
        Auth::requireAuth();
        $db  = Database::getInstance();
        $tid = Tenant::id();

        // Verifica se há internação ativa
        $check = $db->prepare('SELECT id FROM internacoes WHERE leito_id = :id AND status = \'ativo\' AND tenant_id = :tid');
        $check->execute([':id' => $id, ':tid' => $tid]);
        if ($check->fetch()) {
            http_response_code(409);
            echo json_encode(['error' => 'Leito possui internação ativa. Dê alta antes de remover.']);
            return;
        }

        $stmt = $db->prepare('DELETE FROM leitos WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $id, ':tid' => $tid]);
        if ($stmt->rowCount() === 0) { http_response_code(404); echo json_encode(['error' => 'Leito não encontrado']); return; }

        echo json_encode(['message' => 'Leito removido com sucesso']);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // INTERNAÇÕES
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * GET /api/internacoes
     * ?status=ativo|alta|transferido|obito
     * ?paciente_id=N
     */
    public static function index(): void {
        Auth::requireAuth();
        $db  = Database::getInstance();
        $tid = Tenant::id();

        $where  = ['i.tenant_id = :tid'];
        $params = [':tid' => $tid];

        $status = $_GET['status'] ?? 'ativo';
        if ($status !== 'todos') {
            $where[] = 'i.status = :status';
            $params[':status'] = self::internStatusOk($status);
        }

        if (!empty($_GET['paciente_id'])) {
            $where[] = 'i.paciente_id = :pid';
            $params[':pid'] = (int)$_GET['paciente_id'];
        }

        $sql = 'SELECT i.*,
                       p.nome_completo AS paciente_nome, p.data_nascimento,
                       l.codigo AS leito_codigo, l.ala, l.andar, l.tipo AS leito_tipo,
                       m.nome AS medico_nome,
                       u.nome AS usuario_nome
                FROM internacoes i
                JOIN pacientes p ON p.id = i.paciente_id
                JOIN leitos l ON l.id = i.leito_id
                LEFT JOIN medicos m ON m.id = i.medico_id
                JOIN usuarios u ON u.id = i.usuario_id
                WHERE ' . implode(' AND ', $where) . '
                ORDER BY i.data_admissao DESC';

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        foreach ($rows as &$row) {
            if (!empty($row['data_nascimento'])) {
                $row['idade'] = (int) date_diff(new DateTime($row['data_nascimento']), new DateTime())->y;
            }
        }

        echo json_encode(['data' => $rows]);
    }

    /**
     * GET /api/internacoes/{id}
     */
    public static function show(int $id): void {
        Auth::requireAuth();
        $db  = Database::getInstance();
        $tid = Tenant::id();

        $stmt = $db->prepare(
            'SELECT i.*,
                    p.nome_completo AS paciente_nome, p.data_nascimento, p.codigo AS paciente_codigo,
                    l.codigo AS leito_codigo, l.ala, l.andar, l.tipo AS leito_tipo,
                    m.nome AS medico_nome,
                    u.nome AS usuario_nome
             FROM internacoes i
             JOIN pacientes p ON p.id = i.paciente_id
             JOIN leitos l ON l.id = i.leito_id
             LEFT JOIN medicos m ON m.id = i.medico_id
             JOIN usuarios u ON u.id = i.usuario_id
             WHERE i.id = :id AND i.tenant_id = :tid'
        );
        $stmt->execute([':id' => $id, ':tid' => $tid]);
        $row = $stmt->fetch();

        if (!$row) { http_response_code(404); echo json_encode(['error' => 'Internação não encontrada']); return; }

        // Busca evoluções
        $evStmt = $db->prepare(
            'SELECT e.*, u.nome AS autor
             FROM evolucoes_internacao e
             JOIN usuarios u ON u.id = e.usuario_id
             WHERE e.internacao_id = :id AND e.tenant_id = :tid
             ORDER BY e.created_at DESC'
        );
        $evStmt->execute([':id' => $id, ':tid' => $tid]);
        $row['evolucoes'] = $evStmt->fetchAll();

        if (!empty($row['data_nascimento'])) {
            $row['idade'] = (int) date_diff(new DateTime($row['data_nascimento']), new DateTime())->y;
        }

        echo json_encode(['data' => $row]);
    }

    /**
     * POST /api/internacoes
     */
    public static function store(): void {
        $user = Auth::requireAuth();
        $db   = Database::getInstance();
        $tid  = Tenant::id();
        $uid  = (int)$user['sub'];
        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        // Validações
        if (empty($body['paciente_id']) || empty($body['leito_id']) || empty($body['motivo_internacao'])) {
            http_response_code(422);
            echo json_encode(['error' => 'Paciente, leito e motivo são obrigatórios']);
            return;
        }

        // Verifica se o leito existe e pertence ao tenant
        $leitoStmt = $db->prepare('SELECT id, status FROM leitos WHERE id = :id AND tenant_id = :tid');
        $leitoStmt->execute([':id' => (int)$body['leito_id'], ':tid' => $tid]);
        $leito = $leitoStmt->fetch();

        if (!$leito) {
            http_response_code(404);
            echo json_encode(['error' => 'Leito não encontrado']);
            return;
        }

        if ($leito['status'] !== 'livre') {
            http_response_code(409);
            echo json_encode(['error' => 'Leito não está disponível (status: ' . $leito['status'] . ')']);
            return;
        }

        // Verifica se paciente já tem internação ativa
        $ativaStmt = $db->prepare(
            'SELECT id FROM internacoes WHERE paciente_id = :pid AND tenant_id = :tid AND status = \'ativo\''
        );
        $ativaStmt->execute([':pid' => (int)$body['paciente_id'], ':tid' => $tid]);
        if ($ativaStmt->fetch()) {
            http_response_code(409);
            echo json_encode(['error' => 'Paciente já possui uma internação ativa']);
            return;
        }

        // Transação: cria internação + atualiza status do leito
        $db->beginTransaction();
        try {
            $stmt = $db->prepare(
                'INSERT INTO internacoes (tenant_id,paciente_id,leito_id,medico_id,usuario_id,
                                          data_admissao,motivo_internacao,diagnostico,
                                          convenio,numero_autorizacao,observacoes,status)
                 VALUES (:tid,:pac,:leito,:med,:uid,
                         :adm,:motivo,:diag,
                         :conv,:auth,:obs,:status)'
            );
            $stmt->execute([
                ':tid'    => $tid,
                ':pac'    => (int)$body['paciente_id'],
                ':leito'  => (int)$body['leito_id'],
                ':med'    => !empty($body['medico_id']) ? (int)$body['medico_id'] : null,
                ':uid'    => $uid,
                ':adm'    => $body['data_admissao'] ?? date('Y-m-d H:i:s'),
                ':motivo' => trim($body['motivo_internacao']),
                ':diag'   => $body['diagnostico']        ?? null,
                ':conv'   => $body['convenio']           ?? null,
                ':auth'   => $body['numero_autorizacao'] ?? null,
                ':obs'    => $body['observacoes']        ?? null,
                ':status' => 'ativo',
            ]);

            $newId = (int) $db->lastInsertId();

            // Marca leito como ocupado
            $db->prepare('UPDATE leitos SET status = \'ocupado\' WHERE id = :id')
               ->execute([':id' => (int)$body['leito_id']]);

            $db->commit();
        } catch (\Exception $e) {
            $db->rollBack();
            http_response_code(500);
            echo json_encode(['error' => 'Erro ao registrar internação: ' . $e->getMessage()]);
            return;
        }

        http_response_code(201);
        self::show($newId);
    }

    /**
     * PUT /api/internacoes/{id}
     */
    public static function update(int $id): void {
        Auth::requireAuth();
        $db   = Database::getInstance();
        $tid  = Tenant::id();
        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        $stmt = $db->prepare('SELECT id FROM internacoes WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $id, ':tid' => $tid]);
        if (!$stmt->fetch()) { http_response_code(404); echo json_encode(['error' => 'Internação não encontrada']); return; }

        $fields = [];
        $params = [':id' => $id, ':tid' => $tid];

        foreach (['motivo_internacao','diagnostico','convenio','numero_autorizacao','observacoes','medico_id'] as $col) {
            if (array_key_exists($col, $body)) {
                $fields[] = "$col = :$col";
                $params[":$col"] = $body[$col];
            }
        }

        if ($fields) {
            $db->prepare('UPDATE internacoes SET ' . implode(', ', $fields) . ' WHERE id = :id AND tenant_id = :tid')
               ->execute($params);
        }

        self::show($id);
    }

    /**
     * POST /api/internacoes/{id}/alta
     * Registra alta (ou transferência ou óbito) e libera o leito
     */
    public static function darAlta(int $id): void {
        Auth::requireAuth();
        $db   = Database::getInstance();
        $tid  = Tenant::id();
        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        $stmt = $db->prepare('SELECT id, leito_id, status FROM internacoes WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $id, ':tid' => $tid]);
        $intern = $stmt->fetch();

        if (!$intern) { http_response_code(404); echo json_encode(['error' => 'Internação não encontrada']); return; }
        if ($intern['status'] !== 'ativo') {
            http_response_code(409);
            echo json_encode(['error' => 'Internação já finalizada (status: ' . $intern['status'] . ')']);
            return;
        }

        $novoStatus = self::internStatusOk($body['status'] ?? 'alta');
        if ($novoStatus === 'ativo') $novoStatus = 'alta'; // não pode "reativar" via alta

        $dataAlta = $body['data_alta'] ?? date('Y-m-d H:i:s');

        $db->beginTransaction();
        try {
            $db->prepare(
                'UPDATE internacoes SET status = :status, data_alta = :data_alta WHERE id = :id AND tenant_id = :tid'
            )->execute([':status' => $novoStatus, ':data_alta' => $dataAlta, ':id' => $id, ':tid' => $tid]);

            // Leito para higienização
            $novoLeito = ($novoStatus === 'transferido') ? 'livre' : 'higienizacao';
            $db->prepare('UPDATE leitos SET status = :s WHERE id = :id')
               ->execute([':s' => $novoLeito, ':id' => $intern['leito_id']]);

            $db->commit();
        } catch (\Exception $e) {
            $db->rollBack();
            http_response_code(500);
            echo json_encode(['error' => 'Erro ao dar alta: ' . $e->getMessage()]);
            return;
        }

        self::show($id);
    }

    /**
     * POST /api/internacoes/{id}/transferir
     * Transfere paciente para outro leito
     */
    public static function transferir(int $id): void {
        Auth::requireAuth();
        $db   = Database::getInstance();
        $tid  = Tenant::id();
        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        if (empty($body['novo_leito_id'])) {
            http_response_code(422);
            echo json_encode(['error' => 'novo_leito_id é obrigatório']);
            return;
        }

        $stmt = $db->prepare('SELECT id, leito_id, status FROM internacoes WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $id, ':tid' => $tid]);
        $intern = $stmt->fetch();

        if (!$intern) { http_response_code(404); echo json_encode(['error' => 'Internação não encontrada']); return; }
        if ($intern['status'] !== 'ativo') {
            http_response_code(409);
            echo json_encode(['error' => 'Internação não está ativa']);
            return;
        }

        $novoLeitoId = (int)$body['novo_leito_id'];

        $leitoStmt = $db->prepare('SELECT id, status FROM leitos WHERE id = :id AND tenant_id = :tid');
        $leitoStmt->execute([':id' => $novoLeitoId, ':tid' => $tid]);
        $novoLeito = $leitoStmt->fetch();

        if (!$novoLeito) { http_response_code(404); echo json_encode(['error' => 'Novo leito não encontrado']); return; }
        if ($novoLeito['status'] !== 'livre') {
            http_response_code(409);
            echo json_encode(['error' => 'Novo leito não está disponível']);
            return;
        }

        $db->beginTransaction();
        try {
            // Atualiza internação
            $db->prepare('UPDATE internacoes SET leito_id = :novo WHERE id = :id AND tenant_id = :tid')
               ->execute([':novo' => $novoLeitoId, ':id' => $id, ':tid' => $tid]);

            // Libera leito antigo para higienização
            $db->prepare("UPDATE leitos SET status = 'higienizacao' WHERE id = :id")
               ->execute([':id' => $intern['leito_id']]);

            // Marca novo leito como ocupado
            $db->prepare("UPDATE leitos SET status = 'ocupado' WHERE id = :id")
               ->execute([':id' => $novoLeitoId]);

            $db->commit();
        } catch (\Exception $e) {
            $db->rollBack();
            http_response_code(500);
            echo json_encode(['error' => 'Erro ao transferir: ' . $e->getMessage()]);
            return;
        }

        self::show($id);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // EVOLUÇÕES
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * GET /api/internacoes/{id}/evolucoes
     */
    public static function evolucoes(int $id): void {
        Auth::requireAuth();
        $db  = Database::getInstance();
        $tid = Tenant::id();

        // Verifica que a internação pertence ao tenant
        $chk = $db->prepare('SELECT id FROM internacoes WHERE id = :id AND tenant_id = :tid');
        $chk->execute([':id' => $id, ':tid' => $tid]);
        if (!$chk->fetch()) { http_response_code(404); echo json_encode(['error' => 'Internação não encontrada']); return; }

        $stmt = $db->prepare(
            'SELECT e.*, u.nome AS autor
             FROM evolucoes_internacao e
             JOIN usuarios u ON u.id = e.usuario_id
             WHERE e.internacao_id = :id AND e.tenant_id = :tid
             ORDER BY e.created_at DESC'
        );
        $stmt->execute([':id' => $id, ':tid' => $tid]);
        echo json_encode(['data' => $stmt->fetchAll()]);
    }

    /**
     * POST /api/internacoes/{id}/evolucoes
     */
    public static function storeEvolucao(int $id): void {
        $user = Auth::requireAuth();
        $db   = Database::getInstance();
        $tid  = Tenant::id();
        $uid  = (int)$user['sub'];
        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        if (empty($body['texto'])) {
            http_response_code(422);
            echo json_encode(['error' => 'Texto da evolução é obrigatório']);
            return;
        }

        // Verifica internação
        $chk = $db->prepare('SELECT id FROM internacoes WHERE id = :id AND tenant_id = :tid AND status = \'ativo\'');
        $chk->execute([':id' => $id, ':tid' => $tid]);
        if (!$chk->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Internação ativa não encontrada']);
            return;
        }

        $stmt = $db->prepare(
            'INSERT INTO evolucoes_internacao (internacao_id,tenant_id,usuario_id,tipo,texto)
             VALUES (:iid,:tid,:uid,:tipo,:texto)'
        );
        $stmt->execute([
            ':iid'   => $id,
            ':tid'   => $tid,
            ':uid'   => $uid,
            ':tipo'  => self::evolTipoOk($body['tipo'] ?? 'medica'),
            ':texto' => trim($body['texto']),
        ]);

        $evId = (int) $db->lastInsertId();
        $ev = $db->prepare(
            'SELECT e.*, u.nome AS autor
             FROM evolucoes_internacao e
             JOIN usuarios u ON u.id = e.usuario_id
             WHERE e.id = :id'
        );
        $ev->execute([':id' => $evId]);

        http_response_code(201);
        echo json_encode(['data' => $ev->fetch(), 'message' => 'Evolução registrada']);
    }

    /**
     * DELETE /api/evolucoes/{id}
     */
    public static function destroyEvolucao(int $id): void {
        $user = Auth::requireAuth();
        $db   = Database::getInstance();
        $tid  = Tenant::id();
        $uid  = (int)$user['sub'];

        // Só o autor pode deletar
        $stmt = $db->prepare(
            'DELETE FROM evolucoes_internacao WHERE id = :id AND tenant_id = :tid AND usuario_id = :uid'
        );
        $stmt->execute([':id' => $id, ':tid' => $tid, ':uid' => $uid]);

        if ($stmt->rowCount() === 0) {
            http_response_code(403);
            echo json_encode(['error' => 'Evolução não encontrada ou sem permissão']);
            return;
        }

        echo json_encode(['message' => 'Evolução removida']);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RELATÓRIO / ESTATÍSTICAS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * GET /api/internacoes/stats
     */
    public static function stats(): void {
        Auth::requireAuth();
        $db  = Database::getInstance();
        $tid = Tenant::id();

        $totalLeitos = $db->prepare('SELECT COUNT(*) FROM leitos WHERE tenant_id = :tid');
        $totalLeitos->execute([':tid' => $tid]);

        $statusCounts = $db->prepare(
            'SELECT status, COUNT(*) AS total FROM leitos WHERE tenant_id = :tid GROUP BY status'
        );
        $statusCounts->execute([':tid' => $tid]);
        $leitosStatus = [];
        foreach ($statusCounts->fetchAll() as $r) $leitosStatus[$r['status']] = (int)$r['total'];

        $tipoCounts = $db->prepare(
            'SELECT tipo, COUNT(*) AS total,
                    SUM(CASE WHEN status=\'ocupado\' THEN 1 ELSE 0 END) AS ocupados
             FROM leitos WHERE tenant_id = :tid GROUP BY tipo'
        );
        $tipoCounts->execute([':tid' => $tid]);

        $internAtivas = $db->prepare(
            'SELECT COUNT(*) FROM internacoes WHERE tenant_id = :tid AND status = \'ativo\''
        );
        $internAtivas->execute([':tid' => $tid]);

        $tempMedio = $db->prepare(
            'SELECT AVG(TIMESTAMPDIFF(HOUR, data_admissao, data_alta)) AS media_horas
             FROM internacoes WHERE tenant_id = :tid AND status = \'alta\' AND data_alta IS NOT NULL
             AND data_admissao >= DATE_SUB(NOW(), INTERVAL 30 DAY)'
        );
        $tempMedio->execute([':tid' => $tid]);

        echo json_encode([
            'data' => [
                'total_leitos'     => (int)$totalLeitos->fetchColumn(),
                'leitos_status'    => $leitosStatus,
                'leitos_por_tipo'  => $tipoCounts->fetchAll(),
                'internacoes_ativas' => (int)$internAtivas->fetchColumn(),
                'tempo_medio_horas'  => round((float)$tempMedio->fetchColumn(), 1),
            ]
        ]);
    }
}
