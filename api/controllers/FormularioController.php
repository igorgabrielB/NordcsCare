<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../utils/AuditLog.php';

class FormularioController {

    private static array $tiposValidos = ['texto','numero','textarea','select','checkbox','data','hora','fracao'];

    // =========================================================
    // DEFINIÇÃO DO FORMULÁRIO
    // =========================================================

    /**
     * GET /api/formularios/{especialidadeId}
     * Retorna a definição completa: seções + campos de cada seção.
     */
    public static function definicao(int $especialidadeId): void {
        Auth::requireAuth();
        $db = Database::getInstance();
        $tid = Tenant::id();

        // Verificar que especialidade pertence ao tenant
        $stmt = $db->prepare('SELECT id, nome FROM especialidades WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $especialidadeId, ':tid' => $tid]);
        $esp = $stmt->fetch();
        if (!$esp) {
            http_response_code(404);
            echo json_encode(['error' => 'Especialidade não encontrada']);
            return;
        }

        // Buscar seções
        $stmt = $db->prepare(
            'SELECT * FROM formulario_secoes
             WHERE especialidade_id = :eid AND tenant_id = :tid AND ativo = 1
             ORDER BY ordem ASC'
        );
        $stmt->execute([':eid' => $especialidadeId, ':tid' => $tid]);
        $secoes = $stmt->fetchAll();

        // Para cada seção, buscar campos
        $stmt = $db->prepare(
            'SELECT * FROM formulario_campos
             WHERE secao_id = :sid AND tenant_id = :tid AND ativo = 1
             ORDER BY ordem ASC'
        );

        foreach ($secoes as &$secao) {
            $stmt->execute([':sid' => $secao['id'], ':tid' => $tid]);
            $campos = $stmt->fetchAll();
            foreach ($campos as &$campo) {
                if ($campo['opcoes'] !== null) {
                    $campo['opcoes'] = json_decode($campo['opcoes'], true);
                }
            }
            $secao['campos'] = $campos;
        }

        echo json_encode([
            'especialidade_id' => (int)$especialidadeId,
            'especialidade_nome' => $esp['nome'],
            'secoes' => $secoes,
        ]);
    }

    /**
     * GET /api/formularios/{especialidadeId}/todas-secoes
     * Retorna todas as seções (inclusive inativas) — para admin.
     */
    public static function todasSecoes(int $especialidadeId): void {
        Auth::requireTela('especialidades');
        $db = Database::getInstance();
        $tid = Tenant::id();

        $stmt = $db->prepare(
            'SELECT * FROM formulario_secoes
             WHERE especialidade_id = :eid AND tenant_id = :tid
             ORDER BY ordem ASC'
        );
        $stmt->execute([':eid' => $especialidadeId, ':tid' => $tid]);
        $secoes = $stmt->fetchAll();

        $stmtCampos = $db->prepare(
            'SELECT * FROM formulario_campos
             WHERE secao_id = :sid AND tenant_id = :tid
             ORDER BY ordem ASC'
        );

        foreach ($secoes as &$secao) {
            $stmtCampos->execute([':sid' => $secao['id'], ':tid' => $tid]);
            $campos = $stmtCampos->fetchAll();
            foreach ($campos as &$campo) {
                if ($campo['opcoes'] !== null) {
                    $campo['opcoes'] = json_decode($campo['opcoes'], true);
                }
            }
            $secao['campos'] = $campos;
        }

        echo json_encode($secoes);
    }

    // =========================================================
    // SEÇÕES
    // =========================================================

    /** POST /api/formularios/secoes */
    public static function storeSecao(): void {
        $user = Auth::requireTela('especialidades');
        $input = json_decode(file_get_contents('php://input'), true);
        $db = Database::getInstance();
        $tid = Tenant::id();

        $especialidadeId = (int)($input['especialidade_id'] ?? 0);
        $nome  = trim($input['nome'] ?? '');
        $label = trim($input['label'] ?? '');

        if ($especialidadeId < 1 || $nome === '' || $label === '') {
            http_response_code(422);
            echo json_encode(['error' => 'especialidade_id, nome e label são obrigatórios']);
            return;
        }

        // Verificar que especialidade pertence ao tenant
        $stmt = $db->prepare('SELECT id FROM especialidades WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $especialidadeId, ':tid' => $tid]);
        if (!$stmt->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Especialidade não encontrada']);
            return;
        }

        $stmt = $db->prepare('SELECT COALESCE(MAX(ordem),0)+1 FROM formulario_secoes WHERE especialidade_id = :eid AND tenant_id = :tid');
        $stmt->execute([':eid' => $especialidadeId, ':tid' => $tid]);
        $proximaOrdem = (int)$stmt->fetchColumn();

        $stmt = $db->prepare(
            'INSERT INTO formulario_secoes (tenant_id, especialidade_id, nome, label, icone, ordem)
             VALUES (:tid, :eid, :nome, :label, :icone, :ordem)'
        );
        $stmt->execute([
            ':tid'   => $tid,
            ':eid'   => $especialidadeId,
            ':nome'  => $nome,
            ':label' => $label,
            ':icone' => $input['icone'] ?? 'file-text',
            ':ordem' => $input['ordem'] ?? $proximaOrdem,
        ]);

        $id = (int)$db->lastInsertId();
        AuditLog::registrar('criar', 'formulario_secao', $id, "Seção '{$label}' criada", $user);

        http_response_code(201);
        echo json_encode(['id' => $id, 'message' => 'Seção criada com sucesso']);
    }

    /** PUT /api/formularios/secoes/{id} */
    public static function updateSecao(int $id): void {
        $user = Auth::requireTela('especialidades');
        $input = json_decode(file_get_contents('php://input'), true);
        $db = Database::getInstance();
        $tid = Tenant::id();

        $stmt = $db->prepare('SELECT id FROM formulario_secoes WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $id, ':tid' => $tid]);
        if (!$stmt->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Seção não encontrada']);
            return;
        }

        $label = trim($input['label'] ?? '');
        if ($label === '') {
            http_response_code(422);
            echo json_encode(['error' => 'Label é obrigatório']);
            return;
        }

        $stmt = $db->prepare(
            'UPDATE formulario_secoes
             SET nome = :nome, label = :label, icone = :icone, ordem = :ordem, ativo = :ativo
             WHERE id = :id AND tenant_id = :tid'
        );
        $stmt->execute([
            ':nome'  => trim($input['nome'] ?? $label),
            ':label' => $label,
            ':icone' => $input['icone'] ?? 'file-text',
            ':ordem' => (int)($input['ordem'] ?? 0),
            ':ativo' => isset($input['ativo']) ? (int)$input['ativo'] : 1,
            ':id'    => $id,
            ':tid'   => $tid,
        ]);

        AuditLog::registrar('editar', 'formulario_secao', $id, "Seção '{$label}' atualizada", $user);
        echo json_encode(['message' => 'Seção atualizada com sucesso']);
    }

    /** DELETE /api/formularios/secoes/{id} */
    public static function destroySecao(int $id): void {
        $user = Auth::requireTela('especialidades');
        $db = Database::getInstance();
        $tid = Tenant::id();

        $stmt = $db->prepare('SELECT label FROM formulario_secoes WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $id, ':tid' => $tid]);
        $secao = $stmt->fetch();
        if (!$secao) {
            http_response_code(404);
            echo json_encode(['error' => 'Seção não encontrada']);
            return;
        }

        $stmt = $db->prepare('DELETE FROM formulario_secoes WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $id, ':tid' => $tid]);

        AuditLog::registrar('excluir', 'formulario_secao', $id, "Seção '{$secao['label']}' excluída", $user);
        echo json_encode(['message' => 'Seção excluída com sucesso']);
    }

    /** PUT /api/formularios/secoes/reordenar — body: [{id, ordem}, ...] */
    public static function reordenarSecoes(): void {
        Auth::requireTela('especialidades');
        $input = json_decode(file_get_contents('php://input'), true);
        $db = Database::getInstance();
        $tid = Tenant::id();

        if (!is_array($input)) {
            http_response_code(422);
            echo json_encode(['error' => 'Payload inválido']);
            return;
        }

        $stmt = $db->prepare('UPDATE formulario_secoes SET ordem = :ordem WHERE id = :id AND tenant_id = :tid');
        foreach ($input as $item) {
            $stmt->execute([
                ':ordem' => (int)($item['ordem'] ?? 0),
                ':id'    => (int)($item['id'] ?? 0),
                ':tid'   => $tid,
            ]);
        }

        echo json_encode(['message' => 'Ordem das seções salva']);
    }

    // =========================================================
    // CAMPOS
    // =========================================================

    /** POST /api/formularios/campos */
    public static function storeCampo(): void {
        $user = Auth::requireTela('especialidades');
        $input = json_decode(file_get_contents('php://input'), true);
        $db = Database::getInstance();
        $tid = Tenant::id();

        $secaoId = (int)($input['secao_id'] ?? 0);
        $nome    = trim($input['nome'] ?? '');
        $label   = trim($input['label'] ?? '');
        $tipo    = $input['tipo'] ?? 'texto';

        if ($secaoId < 1 || $nome === '' || $label === '') {
            http_response_code(422);
            echo json_encode(['error' => 'secao_id, nome e label são obrigatórios']);
            return;
        }

        if (!in_array($tipo, self::$tiposValidos, true)) {
            http_response_code(422);
            echo json_encode(['error' => 'Tipo inválido. Use: ' . implode(', ', self::$tiposValidos)]);
            return;
        }

        // Verificar que seção pertence ao tenant
        $stmt = $db->prepare('SELECT id FROM formulario_secoes WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $secaoId, ':tid' => $tid]);
        if (!$stmt->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Seção não encontrada']);
            return;
        }

        // Validar opções para tipo select
        $opcoes = null;
        if ($tipo === 'select' && !empty($input['opcoes'])) {
            $opcoes = json_encode(array_values(array_filter(array_map('trim', (array)$input['opcoes']))));
        }

        $stmt = $db->prepare('SELECT COALESCE(MAX(ordem),0)+1 FROM formulario_campos WHERE secao_id = :sid AND tenant_id = :tid');
        $stmt->execute([':sid' => $secaoId, ':tid' => $tid]);
        $proximaOrdem = (int)$stmt->fetchColumn();

        $stmt = $db->prepare(
            'INSERT INTO formulario_campos
             (secao_id, tenant_id, nome, label, tipo, opcoes, obrigatorio, placeholder, unidade, ordem)
             VALUES (:sid, :tid, :nome, :label, :tipo, :opcoes, :req, :placeholder, :unidade, :ordem)'
        );
        $stmt->execute([
            ':sid'         => $secaoId,
            ':tid'         => $tid,
            ':nome'        => $nome,
            ':label'       => $label,
            ':tipo'        => $tipo,
            ':opcoes'      => $opcoes,
            ':req'         => isset($input['obrigatorio']) ? (int)$input['obrigatorio'] : 0,
            ':placeholder' => trim($input['placeholder'] ?? '') ?: null,
            ':unidade'     => trim($input['unidade'] ?? '') ?: null,
            ':ordem'       => $input['ordem'] ?? $proximaOrdem,
        ]);

        $id = (int)$db->lastInsertId();
        AuditLog::registrar('criar', 'formulario_campo', $id, "Campo '{$label}' criado na seção {$secaoId}", $user);

        http_response_code(201);
        echo json_encode(['id' => $id, 'message' => 'Campo criado com sucesso']);
    }

    /** PUT /api/formularios/campos/{id} */
    public static function updateCampo(int $id): void {
        $user = Auth::requireTela('especialidades');
        $input = json_decode(file_get_contents('php://input'), true);
        $db = Database::getInstance();
        $tid = Tenant::id();

        $stmt = $db->prepare('SELECT id FROM formulario_campos WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $id, ':tid' => $tid]);
        if (!$stmt->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Campo não encontrado']);
            return;
        }

        $label = trim($input['label'] ?? '');
        $tipo  = $input['tipo'] ?? 'texto';

        if ($label === '' || !in_array($tipo, self::$tiposValidos, true)) {
            http_response_code(422);
            echo json_encode(['error' => 'Label e tipo válido são obrigatórios']);
            return;
        }

        $opcoes = null;
        if ($tipo === 'select' && !empty($input['opcoes'])) {
            $opcoes = json_encode(array_values(array_filter(array_map('trim', (array)$input['opcoes']))));
        }

        $stmt = $db->prepare(
            'UPDATE formulario_campos
             SET nome = :nome, label = :label, tipo = :tipo, opcoes = :opcoes,
                 obrigatorio = :req, placeholder = :placeholder, unidade = :unidade,
                 ordem = :ordem, ativo = :ativo
             WHERE id = :id AND tenant_id = :tid'
        );
        $stmt->execute([
            ':nome'        => trim($input['nome'] ?? $label),
            ':label'       => $label,
            ':tipo'        => $tipo,
            ':opcoes'      => $opcoes,
            ':req'         => isset($input['obrigatorio']) ? (int)$input['obrigatorio'] : 0,
            ':placeholder' => trim($input['placeholder'] ?? '') ?: null,
            ':unidade'     => trim($input['unidade'] ?? '') ?: null,
            ':ordem'       => (int)($input['ordem'] ?? 0),
            ':ativo'       => isset($input['ativo']) ? (int)$input['ativo'] : 1,
            ':id'          => $id,
            ':tid'         => $tid,
        ]);

        AuditLog::registrar('editar', 'formulario_campo', $id, "Campo '{$label}' atualizado", $user);
        echo json_encode(['message' => 'Campo atualizado com sucesso']);
    }

    /** DELETE /api/formularios/campos/{id} */
    public static function destroyCampo(int $id): void {
        $user = Auth::requireTela('especialidades');
        $db = Database::getInstance();
        $tid = Tenant::id();

        $stmt = $db->prepare('SELECT label FROM formulario_campos WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $id, ':tid' => $tid]);
        $campo = $stmt->fetch();
        if (!$campo) {
            http_response_code(404);
            echo json_encode(['error' => 'Campo não encontrado']);
            return;
        }

        $stmt = $db->prepare('DELETE FROM formulario_campos WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $id, ':tid' => $tid]);

        AuditLog::registrar('excluir', 'formulario_campo', $id, "Campo '{$campo['label']}' excluído", $user);
        echo json_encode(['message' => 'Campo excluído com sucesso']);
    }

    /** PUT /api/formularios/campos/reordenar — body: [{id, ordem}, ...] */
    public static function reordenarCampos(): void {
        Auth::requireTela('especialidades');
        $input = json_decode(file_get_contents('php://input'), true);
        $db = Database::getInstance();
        $tid = Tenant::id();

        if (!is_array($input)) {
            http_response_code(422);
            echo json_encode(['error' => 'Payload inválido']);
            return;
        }

        $stmt = $db->prepare('UPDATE formulario_campos SET ordem = :ordem WHERE id = :id AND tenant_id = :tid');
        foreach ($input as $item) {
            $stmt->execute([
                ':ordem' => (int)($item['ordem'] ?? 0),
                ':id'    => (int)($item['id'] ?? 0),
                ':tid'   => $tid,
            ]);
        }

        echo json_encode(['message' => 'Ordem dos campos salva']);
    }
}
