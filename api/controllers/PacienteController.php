<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../utils/AuditLog.php';

class PacienteController {

    public static function index(): void {
        Auth::requireAuth();

        $db = Database::getInstance();

        $search = $_GET['search'] ?? '';
        $escolaDia = isset($_GET['escola_dia']) && $_GET['escola_dia'] === '1';
        $escolaParam = $_GET['escola'] ?? '';
        $page = max(1, (int)($_GET['page'] ?? 1));
        $limit = min(100, max(1, (int)($_GET['limit'] ?? 20)));
        $offset = ($page - 1) * $limit;

        $tenantId = Tenant::id();

        // Build escola filter conditions
        $escolaCondition = '';
        $escolaBinds = [];
        if ($escolaParam) {
            $escolaCondition = ' AND escola = :escola_filter';
            $escolaBinds[':escola_filter'] = $escolaParam;
        } elseif ($escolaDia) {
            $escolaCondition = ' AND escola IN (SELECT escola FROM escola_agenda WHERE data_atendimento = CURDATE() AND tenant_id = :tid2)';
        }

        if ($search !== '') {
            $searchClean = preg_replace('/[\.\-\/]/', '', $search);
            $stmt = $db->prepare(
                'SELECT * FROM pacientes WHERE tenant_id = :tid AND (nome_completo LIKE :search OR REPLACE(REPLACE(cpf, ".", ""), "-", "") LIKE :search2 OR codigo LIKE :search3)' . $escolaCondition .
                ' ORDER BY nome_completo ASC LIMIT :limit OFFSET :offset'
            );
            $searchTerm = "%$search%";
            $searchTermClean = "%$searchClean%";
            $stmt->bindValue(':tid', $tenantId, PDO::PARAM_INT);
            $stmt->bindValue(':search', $searchTerm, PDO::PARAM_STR);
            $stmt->bindValue(':search2', $searchTermClean, PDO::PARAM_STR);
            $stmt->bindValue(':search3', $searchTerm, PDO::PARAM_STR);
            foreach ($escolaBinds as $k => $v) $stmt->bindValue($k, $v, PDO::PARAM_STR);
            if ($escolaDia) $stmt->bindValue(':tid2', $tenantId, PDO::PARAM_INT);
            $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
            $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
            $stmt->execute();

            $countStmt = $db->prepare(
                'SELECT COUNT(*) FROM pacientes WHERE tenant_id = :tid AND (nome_completo LIKE :search OR REPLACE(REPLACE(cpf, ".", ""), "-", "") LIKE :search2 OR codigo LIKE :search3)' . $escolaCondition
            );
            $countBinds = array_merge([':tid' => $tenantId, ':search' => $searchTerm, ':search2' => $searchTermClean, ':search3' => $searchTerm], $escolaBinds);
            if ($escolaDia) $countBinds[':tid2'] = $tenantId;
            $countStmt->execute($countBinds);
        } else {
            $stmt = $db->prepare(
                'SELECT * FROM pacientes WHERE tenant_id = :tid' . $escolaCondition . ' ORDER BY nome_completo ASC LIMIT :limit OFFSET :offset'
            );
            $stmt->bindValue(':tid', $tenantId, PDO::PARAM_INT);
            foreach ($escolaBinds as $k => $v) $stmt->bindValue($k, $v, PDO::PARAM_STR);
            if ($escolaDia) $stmt->bindValue(':tid2', $tenantId, PDO::PARAM_INT);
            $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
            $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
            $stmt->execute();

            $countBinds = array_merge([':tid' => $tenantId], $escolaBinds);
            if ($escolaDia) $countBinds[':tid2'] = $tenantId;
            $countStmt = $db->prepare('SELECT COUNT(*) FROM pacientes WHERE tenant_id = :tid' . $escolaCondition);
            $countStmt->execute($countBinds);
        }

        $pacientes = $stmt->fetchAll();
        $total = (int)$countStmt->fetchColumn();

        echo json_encode([
            'data' => $pacientes,
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
                'totalPages' => ceil($total / $limit),
            ]
        ]);
    }

    public static function show(int $id): void {
        Auth::requireAuth();

        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT * FROM pacientes WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $id, ':tid' => Tenant::id()]);
        $paciente = $stmt->fetch();

        if (!$paciente) {
            http_response_code(404);
            echo json_encode(['error' => 'Paciente não encontrado']);
            return;
        }

        echo json_encode($paciente);
    }

    /**
     * GET /api/pacientes/escolas — Lista escolas distintas cadastradas.
     */
    public static function escolas(): void {
        Auth::requireAuth();
        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT DISTINCT escola FROM pacientes WHERE tenant_id = :tid AND escola IS NOT NULL AND escola != "" ORDER BY escola ASC');
        $stmt->execute([':tid' => Tenant::id()]);
        $escolas = $stmt->fetchAll(PDO::FETCH_COLUMN);
        echo json_encode($escolas);
    }

    public static function escolasContagem(): void {
        Auth::requireTela('pacientes');
        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT escola, COUNT(*) as total FROM pacientes WHERE tenant_id = :tid AND escola IS NOT NULL AND escola != "" GROUP BY escola ORDER BY escola ASC');
        $stmt->execute([':tid' => Tenant::id()]);
        $rows = $stmt->fetchAll();
        echo json_encode($rows);
    }

    public static function store(): void {
        $user = Auth::requireTela('pacientes');

        $input = json_decode(file_get_contents('php://input'), true);

        if (empty($input['nome_completo'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Nome completo é obrigatório']);
            return;
        }

        $db = Database::getInstance();

        $tenantId = Tenant::id();

        // Gerar código sequencial de 6 dígitos (mínimo 280000) dentro do tenant
        $stmt = $db->prepare('SELECT MAX(CAST(codigo AS UNSIGNED)) FROM pacientes WHERE tenant_id = :tid');
        $stmt->execute([':tid' => $tenantId]);
        $maxCode = max((int)$stmt->fetchColumn(), 279999);
        $novoCodigo = str_pad($maxCode + 1, 6, '0', STR_PAD_LEFT);

        // Verificar CPF duplicado se fornecido (dentro do tenant)
        if (!empty($input['cpf'])) {
            $stmt = $db->prepare('SELECT COUNT(*) FROM pacientes WHERE cpf = :cpf AND tenant_id = :tid');
            $stmt->execute([':cpf' => $input['cpf'], ':tid' => $tenantId]);
            if ($stmt->fetchColumn() > 0) {
                http_response_code(409);
                echo json_encode(['error' => 'CPF já cadastrado']);
                return;
            }
        }

        $stmt = $db->prepare(
            'INSERT INTO pacientes (tenant_id, codigo, nome_completo, cpf, data_nascimento, sexo, nacionalidade, naturalidade, telefone, email, cep, rua, numero, complemento, bairro, cidade, estado, convenio, escola, responsavel, observacoes)
             VALUES (:tid, :codigo, :nome_completo, :cpf, :data_nascimento, :sexo, :nacionalidade, :naturalidade, :telefone, :email, :cep, :rua, :numero, :complemento, :bairro, :cidade, :estado, :convenio, :escola, :responsavel, :observacoes)'
        );

        $stmt->execute([
            ':tid' => $tenantId,
            ':codigo' => $novoCodigo,
            ':nome_completo' => $input['nome_completo'],
            ':cpf' => $input['cpf'] ?? null,
            ':data_nascimento' => $input['data_nascimento'] ?? null,
            ':sexo' => $input['sexo'] ?? null,
            ':nacionalidade' => $input['nacionalidade'] ?? null,
            ':naturalidade' => $input['naturalidade'] ?? null,
            ':telefone' => $input['telefone'] ?? null,
            ':email' => $input['email'] ?? null,
            ':cep' => $input['cep'] ?? null,
            ':rua' => $input['rua'] ?? null,
            ':numero' => $input['numero'] ?? null,
            ':complemento' => $input['complemento'] ?? null,
            ':bairro' => $input['bairro'] ?? null,
            ':cidade' => $input['cidade'] ?? null,
            ':estado' => $input['estado'] ?? null,
            ':convenio' => $input['convenio'] ?? null,
            ':escola' => $input['escola'] ?? null,
            ':responsavel' => $input['responsavel'] ?? null,
            ':observacoes' => $input['observacoes'] ?? null,
        ]);

        $id = (int)$db->lastInsertId();

        AuditLog::registrar('criar', 'paciente', $id, "Paciente '{$input['nome_completo']}' (código {$novoCodigo}) cadastrado", $user);

        http_response_code(201);
        echo json_encode(['message' => 'Paciente cadastrado com sucesso', 'id' => $id, 'codigo' => $novoCodigo]);
    }

    public static function update(int $id): void {
        $user = Auth::requireTela('pacientes');

        $input = json_decode(file_get_contents('php://input'), true);

        $db = Database::getInstance();

        $tenantId = Tenant::id();

        // Verificar se paciente existe no tenant
        $stmt = $db->prepare('SELECT id FROM pacientes WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $id, ':tid' => $tenantId]);
        if (!$stmt->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Paciente não encontrado']);
            return;
        }

        // Verificar CPF duplicado se mudou (dentro do tenant)
        if (!empty($input['cpf'])) {
            $stmt = $db->prepare('SELECT COUNT(*) FROM pacientes WHERE cpf = :cpf AND id != :id AND tenant_id = :tid');
            $stmt->execute([':cpf' => $input['cpf'], ':id' => $id, ':tid' => $tenantId]);
            if ($stmt->fetchColumn() > 0) {
                http_response_code(409);
                echo json_encode(['error' => 'CPF já cadastrado para outro paciente']);
                return;
            }
        }

        $stmt = $db->prepare(
            'UPDATE pacientes SET nome_completo = :nome_completo, cpf = :cpf, data_nascimento = :data_nascimento,
             sexo = :sexo, nacionalidade = :nacionalidade, naturalidade = :naturalidade,
             telefone = :telefone, email = :email, cep = :cep, rua = :rua, numero = :numero,
             complemento = :complemento, bairro = :bairro, cidade = :cidade, estado = :estado,
             convenio = :convenio, escola = :escola, responsavel = :responsavel, observacoes = :observacoes
             WHERE id = :id AND tenant_id = :tid'
        );

        $stmt->execute([
            ':id' => $id,
            ':tid' => $tenantId,
            ':nome_completo' => $input['nome_completo'] ?? null,
            ':cpf' => $input['cpf'] ?? null,
            ':data_nascimento' => $input['data_nascimento'] ?? null,
            ':sexo' => $input['sexo'] ?? null,
            ':nacionalidade' => $input['nacionalidade'] ?? null,
            ':naturalidade' => $input['naturalidade'] ?? null,
            ':telefone' => $input['telefone'] ?? null,
            ':email' => $input['email'] ?? null,
            ':cep' => $input['cep'] ?? null,
            ':rua' => $input['rua'] ?? null,
            ':numero' => $input['numero'] ?? null,
            ':complemento' => $input['complemento'] ?? null,
            ':bairro' => $input['bairro'] ?? null,
            ':cidade' => $input['cidade'] ?? null,
            ':estado' => $input['estado'] ?? null,
            ':convenio' => $input['convenio'] ?? null,
            ':escola' => $input['escola'] ?? null,
            ':responsavel' => $input['responsavel'] ?? null,
            ':observacoes' => $input['observacoes'] ?? null,
        ]);

        AuditLog::registrar('editar', 'paciente', $id, "Paciente atualizado", $user);

        echo json_encode(['message' => 'Paciente atualizado com sucesso']);
    }

    public static function destroy(int $id): void {
        $user = Auth::requireTela('pacientes');
        $tenantId = Tenant::id();

        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT id FROM pacientes WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $id, ':tid' => $tenantId]);
        if (!$stmt->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Paciente não encontrado']);
            return;
        }

        $stmt = $db->prepare('DELETE FROM pacientes WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $id, ':tid' => $tenantId]);

        AuditLog::registrar('excluir', 'paciente', $id, 'Paciente excluído', $user);

        echo json_encode(['message' => 'Paciente removido com sucesso']);
    }

    /**
     * DELETE /api/pacientes/escola/{escola} — Exclusão em lote por escola
     */
    public static function destroyByEscola(): void {
        $user = Auth::requireTela('pacientes');

        $input = json_decode(file_get_contents('php://input'), true);
        $escola = trim($input['escola'] ?? '');

        if ($escola === '') {
            http_response_code(400);
            echo json_encode(['error' => 'Nome da escola é obrigatório']);
            return;
        }

        $db = Database::getInstance();

        $tenantId = Tenant::id();
        $countStmt = $db->prepare('SELECT COUNT(*) FROM pacientes WHERE escola = :escola AND tenant_id = :tid');
        $countStmt->execute([':escola' => $escola, ':tid' => $tenantId]);
        $total = (int)$countStmt->fetchColumn();

        if ($total === 0) {
            http_response_code(404);
            echo json_encode(['error' => 'Nenhum paciente encontrado para esta escola']);
            return;
        }

        $stmt = $db->prepare('DELETE FROM pacientes WHERE escola = :escola AND tenant_id = :tid');
        $stmt->execute([':escola' => $escola, ':tid' => $tenantId]);

        AuditLog::registrar('excluir_lote', 'paciente', null, "Excluído {$total} pacientes da escola '{$escola}'", $user);

        echo json_encode([
            'message' => "$total paciente(s) da escola \"$escola\" removidos com sucesso",
            'removidos' => $total,
        ]);
    }

    /**
     * POST /api/pacientes/importar — Importação em lote via CSV
     */
    public static function importar(): void {
        $user = Auth::requireTela('pacientes');

        $input = json_decode(file_get_contents('php://input'), true);
        $pacientes = $input['pacientes'] ?? [];

        if (empty($pacientes) || !is_array($pacientes)) {
            http_response_code(400);
            echo json_encode(['error' => 'Nenhum paciente enviado']);
            return;
        }

        $db = Database::getInstance();
        $importados = 0;
        $erros = [];

        $tenantId = Tenant::id();

        // Obter próximo código (mínimo 280000) dentro do tenant
        $stmt = $db->prepare('SELECT MAX(CAST(codigo AS UNSIGNED)) FROM pacientes WHERE tenant_id = :tid');
        $stmt->execute([':tid' => $tenantId]);
        $nextCode = max((int)$stmt->fetchColumn(), 279999) + 1;

        $insertStmt = $db->prepare(
            'INSERT INTO pacientes (tenant_id, codigo, nome_completo, cpf, data_nascimento, sexo, telefone, email, cep, rua, numero, complemento, bairro, cidade, estado, convenio, escola, responsavel, numero_convenio, observacoes)
             VALUES (:tid, :codigo, :nome_completo, :cpf, :data_nascimento, :sexo, :telefone, :email, :cep, :rua, :numero, :complemento, :bairro, :cidade, :estado, :convenio, :escola, :responsavel, :numero_convenio, :observacoes)'
        );

        $cpfCheckStmt = $db->prepare('SELECT COUNT(*) FROM pacientes WHERE cpf = :cpf AND tenant_id = :tid');

        foreach ($pacientes as $i => $p) {
            $linha = $i + 1;
            $nome = trim($p['nome_completo'] ?? '');
            if ($nome === '') {
                $erros[] = "Linha {$linha}: Nome obrigatório";
                continue;
            }

            $cpf = !empty($p['cpf']) ? trim($p['cpf']) : null;

            // Verificar CPF duplicado no banco
            if ($cpf) {
                $cpfCheckStmt->execute([':cpf' => $cpf, ':tid' => $tenantId]);
                if ($cpfCheckStmt->fetchColumn() > 0) {
                    $erros[] = "Linha {$linha}: CPF {$cpf} já cadastrado ({$nome})";
                    continue;
                }
            }

            $codigo = str_pad($nextCode, 6, '0', STR_PAD_LEFT);

            try {
                $insertStmt->execute([
                    ':tid' => $tenantId,
                    ':codigo' => $codigo,
                    ':nome_completo' => $nome,
                    ':cpf' => $cpf,
                    ':data_nascimento' => !empty($p['data_nascimento']) ? $p['data_nascimento'] : null,
                    ':sexo' => !empty($p['sexo']) ? $p['sexo'] : null,
                    ':telefone' => !empty($p['telefone']) ? $p['telefone'] : null,
                    ':email' => !empty($p['email']) ? $p['email'] : null,
                    ':cep' => !empty($p['cep']) ? $p['cep'] : null,
                    ':rua' => !empty($p['rua']) ? $p['rua'] : null,
                    ':numero' => !empty($p['numero']) ? $p['numero'] : null,
                    ':complemento' => !empty($p['complemento']) ? $p['complemento'] : null,
                    ':bairro' => !empty($p['bairro']) ? $p['bairro'] : null,
                    ':cidade' => !empty($p['cidade']) ? $p['cidade'] : null,
                    ':estado' => !empty($p['estado']) ? $p['estado'] : null,
                    ':convenio' => !empty($p['convenio']) ? $p['convenio'] : null,
                    ':escola' => !empty($p['escola']) ? $p['escola'] : null,
                    ':responsavel' => !empty($p['responsavel']) ? $p['responsavel'] : null,
                    ':numero_convenio' => !empty($p['numero_convenio']) ? $p['numero_convenio'] : null,
                    ':observacoes' => !empty($p['observacoes']) ? $p['observacoes'] : null,
                ]);
                $importados++;
                $nextCode++;
            } catch (Exception $e) {
                $erros[] = "Linha {$linha}: Erro ao inserir '{$nome}'";
            }
        }

        AuditLog::registrar('importar', 'paciente', null, "Importação: {$importados} pacientes importados" . (count($erros) > 0 ? ", " . count($erros) . " erros" : ''), $user);

        http_response_code(201);
        echo json_encode([
            'message' => "Importação concluída: {$importados} pacientes importados",
            'importados' => $importados,
            'erros' => $erros,
        ]);
    }
}
