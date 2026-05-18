<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../utils/AuditLog.php';

class EspecialidadeController {

    // =========================================================
    // ESPECIALIDADES
    // =========================================================

    /** GET /api/especialidades */
    public static function index(): void {
        Auth::requireAuth();
        $db = Database::getInstance();
        $tid = Tenant::id();

        $stmt = $db->prepare(
            'SELECT e.id, e.nome, e.descricao, e.cor, e.icone, e.ativo, e.created_at,
                    (SELECT COUNT(*) FROM fila_estacoes fe WHERE fe.especialidade_id = e.id AND fe.ativo = 1) AS total_estacoes,
                    (SELECT COUNT(*) FROM formulario_secoes fs WHERE fs.especialidade_id = e.id AND fs.ativo = 1) AS total_secoes
             FROM especialidades e
             WHERE e.tenant_id = :tid
             ORDER BY e.nome ASC'
        );
        $stmt->execute([':tid' => $tid]);
        echo json_encode($stmt->fetchAll());
    }

    /** GET /api/especialidades/{id} */
    public static function show(int $id): void {
        Auth::requireAuth();
        $db = Database::getInstance();

        $stmt = $db->prepare('SELECT * FROM especialidades WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $id, ':tid' => Tenant::id()]);
        $esp = $stmt->fetch();

        if (!$esp) {
            http_response_code(404);
            echo json_encode(['error' => 'Especialidade não encontrada']);
            return;
        }

        echo json_encode($esp);
    }

    /** POST /api/especialidades */
    public static function store(): void {
        $user = Auth::requireTela('especialidades');
        $input = json_decode(file_get_contents('php://input'), true);
        $db = Database::getInstance();

        $nome = trim($input['nome'] ?? '');
        if ($nome === '') {
            http_response_code(422);
            echo json_encode(['error' => 'Nome é obrigatório']);
            return;
        }

        $stmt = $db->prepare(
            'INSERT INTO especialidades (tenant_id, nome, descricao, cor, icone)
             VALUES (:tid, :nome, :desc, :cor, :icone)'
        );
        $stmt->execute([
            ':tid'   => Tenant::id(),
            ':nome'  => $nome,
            ':desc'  => trim($input['descricao'] ?? '') ?: null,
            ':cor'   => $input['cor'] ?? '#3182ce',
            ':icone' => $input['icone'] ?? 'stethoscope',
        ]);

        $id = (int)$db->lastInsertId();
        AuditLog::registrar('criar', 'especialidade', $id, "Especialidade '{$nome}' criada", $user);

        http_response_code(201);
        echo json_encode(['id' => $id, 'message' => 'Especialidade criada com sucesso']);
    }

    /** PUT /api/especialidades/{id} */
    public static function update(int $id): void {
        $user = Auth::requireTela('especialidades');
        $input = json_decode(file_get_contents('php://input'), true);
        $db = Database::getInstance();

        $stmt = $db->prepare('SELECT id FROM especialidades WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $id, ':tid' => Tenant::id()]);
        if (!$stmt->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Especialidade não encontrada']);
            return;
        }

        $nome = trim($input['nome'] ?? '');
        if ($nome === '') {
            http_response_code(422);
            echo json_encode(['error' => 'Nome é obrigatório']);
            return;
        }

        $stmt = $db->prepare(
            'UPDATE especialidades SET nome = :nome, descricao = :desc, cor = :cor, icone = :icone, ativo = :ativo
             WHERE id = :id AND tenant_id = :tid'
        );
        $stmt->execute([
            ':nome'  => $nome,
            ':desc'  => trim($input['descricao'] ?? '') ?: null,
            ':cor'   => $input['cor'] ?? '#3182ce',
            ':icone' => $input['icone'] ?? 'stethoscope',
            ':ativo' => isset($input['ativo']) ? (int)$input['ativo'] : 1,
            ':id'    => $id,
            ':tid'   => Tenant::id(),
        ]);

        AuditLog::registrar('editar', 'especialidade', $id, "Especialidade '{$nome}' atualizada", $user);
        echo json_encode(['message' => 'Especialidade atualizada com sucesso']);
    }

    /** DELETE /api/especialidades/{id} */
    public static function destroy(int $id): void {
        $user = Auth::requireTela('especialidades');
        $db = Database::getInstance();
        $tid = Tenant::id();

        $stmt = $db->prepare('SELECT nome FROM especialidades WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $id, ':tid' => $tid]);
        $esp = $stmt->fetch();
        if (!$esp) {
            http_response_code(404);
            echo json_encode(['error' => 'Especialidade não encontrada']);
            return;
        }

        // Verificar se há pacientes na fila com essa especialidade
        $stmt = $db->prepare("SELECT COUNT(*) FROM fila WHERE especialidade_id = :id AND status != 'concluido'");
        $stmt->execute([':id' => $id]);
        if ((int)$stmt->fetchColumn() > 0) {
            http_response_code(409);
            echo json_encode(['error' => 'Não é possível excluir: há pacientes na fila desta especialidade']);
            return;
        }

        $stmt = $db->prepare('DELETE FROM especialidades WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $id, ':tid' => $tid]);

        AuditLog::registrar('excluir', 'especialidade', $id, "Especialidade '{$esp['nome']}' excluída", $user);
        echo json_encode(['message' => 'Especialidade excluída com sucesso']);
    }

    // =========================================================
    // ESTAÇÕES DA FILA
    // =========================================================

    /** GET /api/especialidades/{id}/estacoes */
    public static function estacoes(int $especialidadeId): void {
        Auth::requireAuth();
        $db = Database::getInstance();

        $stmt = $db->prepare(
            'SELECT fe.* FROM fila_estacoes fe
             INNER JOIN especialidades e ON e.id = fe.especialidade_id
             WHERE fe.especialidade_id = :eid AND e.tenant_id = :tid
             ORDER BY fe.ordem ASC'
        );
        $stmt->execute([':eid' => $especialidadeId, ':tid' => Tenant::id()]);
        echo json_encode($stmt->fetchAll());
    }

    /** POST /api/especialidades/{id}/estacoes */
    public static function storeEstacao(int $especialidadeId): void {
        $user = Auth::requireTela('especialidades');
        $input = json_decode(file_get_contents('php://input'), true);
        $db = Database::getInstance();
        $tid = Tenant::id();

        // Verificar que a especialidade pertence ao tenant
        $stmt = $db->prepare('SELECT id FROM especialidades WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $especialidadeId, ':tid' => $tid]);
        if (!$stmt->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Especialidade não encontrada']);
            return;
        }

        $nome = trim($input['nome'] ?? '');
        $label = trim($input['label'] ?? '');
        if ($nome === '' || $label === '') {
            http_response_code(422);
            echo json_encode(['error' => 'Nome e label são obrigatórios']);
            return;
        }

        // Próxima ordem
        $stmt = $db->prepare('SELECT COALESCE(MAX(ordem),0)+1 FROM fila_estacoes WHERE especialidade_id = :eid');
        $stmt->execute([':eid' => $especialidadeId]);
        $proximaOrdem = (int)$stmt->fetchColumn();

        $stmt = $db->prepare(
            'INSERT INTO fila_estacoes (tenant_id, especialidade_id, nome, label, ordem, cor, icone, prefixo_senha, tipo)
             VALUES (:tid, :eid, :nome, :label, :ordem, :cor, :icone, :prefixo, :tipo)'
        );
        $stmt->execute([
            ':tid'     => $tid,
            ':eid'     => $especialidadeId,
            ':nome'    => $nome,
            ':label'   => $label,
            ':ordem'   => $input['ordem'] ?? $proximaOrdem,
            ':cor'     => $input['cor'] ?? '#3182ce',
            ':icone'   => $input['icone'] ?? 'user',
            ':prefixo' => strtoupper(trim($input['prefixo_senha'] ?? '')) ?: null,
            ':tipo'    => in_array($input['tipo'] ?? '', ['atendimento', 'saida']) ? $input['tipo'] : 'atendimento',
        ]);

        $id = (int)$db->lastInsertId();
        AuditLog::registrar('criar', 'fila_estacao', $id, "Estação '{$label}' criada na especialidade {$especialidadeId}", $user);

        http_response_code(201);
        echo json_encode(['id' => $id, 'message' => 'Estação criada com sucesso']);
    }

    /** PUT /api/especialidades/estacoes/{id} */
    public static function updateEstacao(int $id): void {
        $user = Auth::requireTela('especialidades');
        $input = json_decode(file_get_contents('php://input'), true);
        $db = Database::getInstance();
        $tid = Tenant::id();

        $stmt = $db->prepare(
            'SELECT fe.id FROM fila_estacoes fe
             INNER JOIN especialidades e ON e.id = fe.especialidade_id
             WHERE fe.id = :id AND e.tenant_id = :tid'
        );
        $stmt->execute([':id' => $id, ':tid' => $tid]);
        if (!$stmt->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Estação não encontrada']);
            return;
        }

        $label = trim($input['label'] ?? '');
        if ($label === '') {
            http_response_code(422);
            echo json_encode(['error' => 'Label é obrigatório']);
            return;
        }

        $stmt = $db->prepare(
            'UPDATE fila_estacoes
             SET nome = :nome, label = :label, ordem = :ordem, cor = :cor,
                 icone = :icone, prefixo_senha = :prefixo, tipo = :tipo, ativo = :ativo
             WHERE id = :id'
        );
        $stmt->execute([
            ':nome'    => trim($input['nome'] ?? $label),
            ':label'   => $label,
            ':ordem'   => (int)($input['ordem'] ?? 0),
            ':cor'     => $input['cor'] ?? '#3182ce',
            ':icone'   => $input['icone'] ?? 'user',
            ':prefixo' => strtoupper(trim($input['prefixo_senha'] ?? '')) ?: null,
            ':tipo'    => in_array($input['tipo'] ?? '', ['atendimento', 'saida']) ? $input['tipo'] : 'atendimento',
            ':ativo'   => isset($input['ativo']) ? (int)$input['ativo'] : 1,
            ':id'      => $id,
        ]);

        AuditLog::registrar('editar', 'fila_estacao', $id, "Estação '{$label}' atualizada", $user);
        echo json_encode(['message' => 'Estação atualizada com sucesso']);
    }

    /** DELETE /api/especialidades/estacoes/{id} */
    public static function destroyEstacao(int $id): void {
        $user = Auth::requireTela('especialidades');
        $db = Database::getInstance();
        $tid = Tenant::id();

        $stmt = $db->prepare(
            'SELECT fe.label FROM fila_estacoes fe
             INNER JOIN especialidades e ON e.id = fe.especialidade_id
             WHERE fe.id = :id AND e.tenant_id = :tid'
        );
        $stmt->execute([':id' => $id, ':tid' => $tid]);
        $estacao = $stmt->fetch();
        if (!$estacao) {
            http_response_code(404);
            echo json_encode(['error' => 'Estação não encontrada']);
            return;
        }

        $stmt = $db->prepare('DELETE FROM fila_estacoes WHERE id = :id');
        $stmt->execute([':id' => $id]);

        AuditLog::registrar('excluir', 'fila_estacao', $id, "Estação '{$estacao['label']}' excluída", $user);
        echo json_encode(['message' => 'Estação excluída com sucesso']);
    }

    /** PUT /api/especialidades/{id}/estacoes/reordenar — body: [{id, ordem}, ...] */
    public static function reordenarEstacoes(int $especialidadeId): void {
        Auth::requireTela('especialidades');
        $input = json_decode(file_get_contents('php://input'), true);
        $db = Database::getInstance();
        $tid = Tenant::id();

        if (!is_array($input)) {
            http_response_code(422);
            echo json_encode(['error' => 'Payload inválido']);
            return;
        }

        $stmt = $db->prepare('UPDATE fila_estacoes SET ordem = :ordem WHERE id = :id AND especialidade_id = :eid');
        foreach ($input as $item) {
            $stmt->execute([
                ':ordem' => (int)($item['ordem'] ?? 0),
                ':id'    => (int)($item['id'] ?? 0),
                ':eid'   => $especialidadeId,
            ]);
        }

        echo json_encode(['message' => 'Ordem das estações salva']);
    }
}
