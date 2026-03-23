<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';

class ProntuarioController {
    // ========== FUNÇÃO AUXILIAR: Adicionar à Fila Automaticamente ==========

    private static function adicionarNaFilaAutomatico($db, $pacienteId, $estacao, $estacaoAnterior = null): void {
        try {
            $logFile = __DIR__ . '/../logs/fila.log';
            $logMsg = "[" . date('Y-m-d H:i:s') . "] Tentando mover paciente {$pacienteId} para fila '{$estacao}'" . ($estacaoAnterior ? " (saindo de '{$estacaoAnterior}')" : '') . "\n";
            file_put_contents($logFile, $logMsg, FILE_APPEND);

            // Remove de TODAS as outras filas quando paciente recebe alta ou encaminhamento
            if (in_array($estacao, ['altas', 'encaminhamentos'])) {
                $stmt = $db->prepare('DELETE FROM fila WHERE paciente_id = :pid');
                $stmt->execute([':pid' => $pacienteId]);
                $deleted = $stmt->rowCount();
                file_put_contents($logFile, "[" . date('Y-m-d H:i:s') . "] Removido paciente de $deleted filas anteriores\n", FILE_APPEND);
            } elseif ($estacaoAnterior) {
                // Remove da estação anterior específica
                $stmt = $db->prepare('DELETE FROM fila WHERE paciente_id = :pid AND estacao = :estacao_ant');
                $stmt->execute([':pid' => $pacienteId, ':estacao_ant' => $estacaoAnterior]);
                $deleted = $stmt->rowCount();
                file_put_contents($logFile, "[" . date('Y-m-d H:i:s') . "] Removido de '{$estacaoAnterior}': $deleted registros\n", FILE_APPEND);
            } else {
                // Para filas de processamento sem estação anterior, apenas remove de altas/encaminhamentos
                $stmt = $db->prepare('DELETE FROM fila WHERE paciente_id = :pid AND (estacao = "altas" OR estacao = "encaminhamentos")');
                $stmt->execute([':pid' => $pacienteId]);
            }

            // Verifica se já existe na fila desejada
            $stmt = $db->prepare('SELECT id FROM fila WHERE paciente_id = :pid AND estacao = :estacao LIMIT 1');
            $stmt->execute([':pid' => $pacienteId, ':estacao' => $estacao]);
            $existing = $stmt->fetch();
            if ($existing) {
                file_put_contents($logFile, "[" . date('Y-m-d H:i:s') . "] Paciente já existe na fila '{$estacao}', abortando\n", FILE_APPEND);
                return; // Já existe, não adiciona novamente
            }

            // Adiciona à fila
            $stmt = $db->prepare(
                'INSERT INTO fila (paciente_id, estacao, status)
                 VALUES (:pid, :estacao, :status)'
            );
            // Para filas de saída (altas/encaminhamentos), marca como concluido; demais já em atendimento
            $status = in_array($estacao, ['altas', 'encaminhamentos']) ? 'concluido' : 'em_atendimento';
            $result = $stmt->execute([
                ':pid' => $pacienteId,
                ':estacao' => $estacao,
                ':status' => $status,
            ]);
            file_put_contents($logFile, "[" . date('Y-m-d H:i:s') . "] INSERT resultado: " . ($result ? 'SUCCESS' : 'FAIL') . "\n", FILE_APPEND);
        } catch (Exception $e) {
            $logFile = __DIR__ . '/../logs/fila.log';
            file_put_contents($logFile, "[" . date('Y-m-d H:i:s') . "] ERRO: " . $e->getMessage() . "\n", FILE_APPEND);
            error_log("Erro ao adicionar à fila: " . $e->getMessage());
        }
    }
    // ========== PRONTUÁRIO COMPLETO ==========

    public static function completo(int $pacienteId): void {
        Auth::requireAuth();
        $db = Database::getInstance();

        // Dados do paciente
        $stmt = $db->prepare('SELECT * FROM pacientes WHERE id = :id');
        $stmt->execute([':id' => $pacienteId]);
        $paciente = $stmt->fetch();

        if (!$paciente) {
            http_response_code(404);
            echo json_encode(['error' => 'Paciente não encontrado']);
            return;
        }

        // Anamneses
        $stmt = $db->prepare(
            'SELECT a.*, u.nome AS medico_nome FROM anamneses a
             JOIN usuarios u ON u.id = a.medico_id
             WHERE a.paciente_id = :pid ORDER BY a.created_at DESC'
        );
        $stmt->execute([':pid' => $pacienteId]);
        $anamneses = $stmt->fetchAll();

        // Exames locais
        $stmt = $db->prepare(
            'SELECT e.*, u.nome AS medico_nome FROM exames e
             JOIN usuarios u ON u.id = e.medico_id
             WHERE e.paciente_id = :pid ORDER BY e.created_at DESC'
        );
        $stmt->execute([':pid' => $pacienteId]);
        $exames = $stmt->fetchAll();


        // Prescrições
        $stmt = $db->prepare(
            'SELECT p.*, u.nome AS medico_nome FROM prescricoes p
             JOIN usuarios u ON u.id = p.medico_id
             WHERE p.paciente_id = :pid ORDER BY p.created_at DESC'
        );
        $stmt->execute([':pid' => $pacienteId]);
        $prescricoes = $stmt->fetchAll();

        // Laudos
        $stmt = $db->prepare(
            'SELECT l.*, u.nome AS medico_nome FROM laudos l
             JOIN usuarios u ON u.id = l.medico_id
             WHERE l.paciente_id = :pid ORDER BY l.created_at DESC'
        );
        $stmt->execute([':pid' => $pacienteId]);
        $laudos = $stmt->fetchAll();

        // Acuidade Visual
        $stmt = $db->prepare(
            'SELECT a.*, u.nome AS medico_nome FROM acuidade_visual a
             LEFT JOIN usuarios u ON u.id = a.medico_id
             WHERE a.paciente_id = :pid ORDER BY a.created_at DESC LIMIT 1'
        );
        $stmt->execute([':pid' => $pacienteId]);
        $acuidadeVisual = $stmt->fetch();

        echo json_encode([
            'paciente' => $paciente,
            'anamneses' => $anamneses,
            'exames' => $exames,
            'prescricoes' => $prescricoes,
            'laudos' => $laudos,
            'acuidade_visual' => $acuidadeVisual,
        ]);
    }

    // ========== SALVAR ATENDIMENTO UNIFICADO ==========

    public static function storeAtendimento(int $pacienteId): void {
        $user = Auth::requireRole(['admin', 'medico']);
        $input = json_decode(file_get_contents('php://input'), true);
        $db = Database::getInstance();

        // Verifica se paciente existe
        $stmt = $db->prepare('SELECT id FROM pacientes WHERE id = :id');
        $stmt->execute([':id' => $pacienteId]);
        if (!$stmt->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Paciente não encontrado']);
            return;
        }

        $medicoId = $user['sub'];
        $ids = [];

        try {
            $db->beginTransaction();

        // Verificar registros existentes (limite: 1 por paciente)
        $stmtExistAnam = $db->prepare('SELECT id FROM anamneses WHERE paciente_id = :pid LIMIT 1');
        $stmtExistAnam->execute([':pid' => $pacienteId]);
        $existingAnamnese = $stmtExistAnam->fetch();

        $stmtExistLaudo = $db->prepare('SELECT id FROM laudos WHERE paciente_id = :pid LIMIT 1');
        $stmtExistLaudo->execute([':pid' => $pacienteId]);
        $existingLaudo = $stmtExistLaudo->fetch();

        $stmtExistRx = $db->prepare('SELECT id FROM prescricoes WHERE paciente_id = :pid LIMIT 1');
        $stmtExistRx->execute([':pid' => $pacienteId]);
        $existingPrescricao = $stmtExistRx->fetch();

        // --- Anamnese (upsert — máx 1 por paciente) ---
        $anamnese = $input['anamnese'] ?? [];
        $hasAnamnese = !empty($anamnese['queixa_principal']) || !empty($anamnese['historico_ocular'])
                    || !empty($anamnese['historico_familiar']) || !empty($anamnese['alergias'])
                    || !empty($anamnese['medicamentos_em_uso']) || !empty($anamnese['cirurgias_anteriores'])
                    || !empty($anamnese['observacoes']);
        if ($hasAnamnese) {
            if ($existingAnamnese) {
                $stmt = $db->prepare(
                    'UPDATE anamneses SET medico_id = :mid, queixa_principal = :queixa, historico_ocular = :hist_ocular,
                     historico_familiar = :hist_familiar, alergias = :alergias, medicamentos_em_uso = :medicamentos,
                     cirurgias_anteriores = :cirurgias, observacoes = :obs WHERE id = :id'
                );
                $stmt->execute([
                    ':mid' => $medicoId,
                    ':queixa' => $anamnese['queixa_principal'],
                    ':hist_ocular' => $anamnese['historico_ocular'] ?? null,
                    ':hist_familiar' => $anamnese['historico_familiar'] ?? null,
                    ':alergias' => $anamnese['alergias'] ?? null,
                    ':medicamentos' => $anamnese['medicamentos_em_uso'] ?? null,
                    ':cirurgias' => $anamnese['cirurgias_anteriores'] ?? null,
                    ':obs' => $anamnese['observacoes'] ?? null,
                    ':id' => $existingAnamnese['id'],
                ]);
                $ids['anamnese_id'] = (int)$existingAnamnese['id'];
            } else {
                $stmt = $db->prepare(
                    'INSERT INTO anamneses (paciente_id, medico_id, queixa_principal, historico_ocular,
                     historico_familiar, alergias, medicamentos_em_uso, cirurgias_anteriores, observacoes)
                     VALUES (:pid, :mid, :queixa, :hist_ocular, :hist_familiar, :alergias, :medicamentos, :cirurgias, :obs)'
                );
                $stmt->execute([
                    ':pid' => $pacienteId,
                    ':mid' => $medicoId,
                    ':queixa' => $anamnese['queixa_principal'],
                    ':hist_ocular' => $anamnese['historico_ocular'] ?? null,
                    ':hist_familiar' => $anamnese['historico_familiar'] ?? null,
                    ':alergias' => $anamnese['alergias'] ?? null,
                    ':medicamentos' => $anamnese['medicamentos_em_uso'] ?? null,
                    ':cirurgias' => $anamnese['cirurgias_anteriores'] ?? null,
                    ':obs' => $anamnese['observacoes'] ?? null,
                ]);
                $ids['anamnese_id'] = (int)$db->lastInsertId();
            }
        }

        // --- Exames (delete + re-insert — associados ao laudo único) ---
        $exames = $input['exames'] ?? [];
        $ids['exame_ids'] = [];
        // Remove exames anteriores apenas se novos exames foram enviados
        if (!empty($exames)) {
            $db->prepare('DELETE FROM exames WHERE paciente_id = :pid')->execute([':pid' => $pacienteId]);
        }
        foreach ($exames as $exame) {
            if (empty($exame['tipo_exame'])) continue;
            $stmt = $db->prepare(
                'INSERT INTO exames (paciente_id, medico_id, tipo_exame, olho, resultado, observacoes)
                 VALUES (:pid, :mid, :tipo, :olho, :resultado, :obs)'
            );
            $stmt->execute([
                ':pid' => $pacienteId,
                ':mid' => $medicoId,
                ':tipo' => $exame['tipo_exame'],
                ':olho' => $exame['olho'] ?? 'AO',
                ':resultado' => $exame['resultado'] ?? null,
                ':obs' => $exame['observacoes'] ?? null,
            ]);
            $ids['exame_ids'][] = (int)$db->lastInsertId();
        }
        // Mover automaticamente: exames → laudos (se houve exames novos)
        if (!empty($ids['exame_ids'])) {
            self::adicionarNaFilaAutomatico($db, $pacienteId, 'laudos', 'exames');
        }

        // --- Prescrição (upsert — máx 1 por paciente) ---
        $prescricao = $input['prescricao'] ?? [];
        // Sanitizar valores: remover caracteres de formatação (°, +) mantendo apenas números, ponto e sinal negativo
        foreach (['od_esferico','od_cilindrico','od_eixo','od_adicao','oe_esferico','oe_cilindrico','oe_eixo','oe_adicao','dp'] as $rxField) {
            if (isset($prescricao[$rxField]) && $prescricao[$rxField] !== '') {
                $prescricao[$rxField] = preg_replace('/[^0-9.\-]/', '', $prescricao[$rxField]);
            }
        }
        $hasRx = !empty($prescricao['od_esferico']) || !empty($prescricao['oe_esferico'])
              || !empty($prescricao['od_cilindrico']) || !empty($prescricao['oe_cilindrico']);
        if ($hasRx) {
            if ($existingPrescricao) {
                $stmt = $db->prepare(
                    'UPDATE prescricoes SET medico_id = :mid, tipo = :tipo,
                     od_esferico = :od_esf, od_cilindrico = :od_cil, od_eixo = :od_eixo, od_adicao = :od_add,
                     oe_esferico = :oe_esf, oe_cilindrico = :oe_cil, oe_eixo = :oe_eixo, oe_adicao = :oe_add,
                     dp = :dp, observacoes = :obs WHERE id = :id'
                );
                $stmt->execute([
                    ':mid' => $medicoId,
                    ':tipo' => $prescricao['tipo'] ?? 'oculos',
                    ':od_esf' => $prescricao['od_esferico'] ?: null,
                    ':od_cil' => $prescricao['od_cilindrico'] ?: null,
                    ':od_eixo' => $prescricao['od_eixo'] ?: null,
                    ':od_add' => $prescricao['od_adicao'] ?: null,
                    ':oe_esf' => $prescricao['oe_esferico'] ?: null,
                    ':oe_cil' => $prescricao['oe_cilindrico'] ?: null,
                    ':oe_eixo' => $prescricao['oe_eixo'] ?: null,
                    ':oe_add' => $prescricao['oe_adicao'] ?: null,
                    ':dp' => $prescricao['dp'] ?: null,
                    ':obs' => $prescricao['observacoes'] ?? null,
                    ':id' => $existingPrescricao['id'],
                ]);
                $ids['prescricao_id'] = (int)$existingPrescricao['id'];
            } else {
                $stmt = $db->prepare(
                    'INSERT INTO prescricoes (paciente_id, medico_id, tipo,
                     od_esferico, od_cilindrico, od_eixo, od_adicao,
                     oe_esferico, oe_cilindrico, oe_eixo, oe_adicao,
                     dp, observacoes)
                     VALUES (:pid, :mid, :tipo,
                     :od_esf, :od_cil, :od_eixo, :od_add,
                     :oe_esf, :oe_cil, :oe_eixo, :oe_add,
                     :dp, :obs)'
                );
                $stmt->execute([
                    ':pid' => $pacienteId,
                    ':mid' => $medicoId,
                    ':tipo' => $prescricao['tipo'] ?? 'oculos',
                    ':od_esf' => $prescricao['od_esferico'] ?: null,
                    ':od_cil' => $prescricao['od_cilindrico'] ?: null,
                    ':od_eixo' => $prescricao['od_eixo'] ?: null,
                    ':od_add' => $prescricao['od_adicao'] ?: null,
                    ':oe_esf' => $prescricao['oe_esferico'] ?: null,
                    ':oe_cil' => $prescricao['oe_cilindrico'] ?: null,
                    ':oe_eixo' => $prescricao['oe_eixo'] ?: null,
                    ':oe_add' => $prescricao['oe_adicao'] ?: null,
                    ':dp' => $prescricao['dp'] ?: null,
                    ':obs' => $prescricao['observacoes'] ?? null,
                ]);
                $ids['prescricao_id'] = (int)$db->lastInsertId();
            }
        }

        // --- Laudo (upsert — máx 1 por paciente) ---
        $laudo = $input['laudo'] ?? [];
        if (!empty($laudo['conduta_inicial']) || !empty($laudo['conduta_final']) || !empty($laudo['diagnostico'])) {
            if ($existingLaudo) {
                $stmt = $db->prepare(
                    'UPDATE laudos SET medico_id = :mid, diagnostico = :diagnostico,
                     conduta_inicial = :conduta_ini, conduta_final = :conduta_fin, observacoes = :obs
                     WHERE id = :id'
                );
                $stmt->execute([
                    ':mid' => $medicoId,
                    ':diagnostico' => $laudo['diagnostico'] ?? null,
                    ':conduta_ini' => $laudo['conduta_inicial'] ?: null,
                    ':conduta_fin' => $laudo['conduta_final'] ?: null,
                    ':obs' => $laudo['observacoes'] ?? null,
                    ':id' => $existingLaudo['id'],
                ]);
                $ids['laudo_id'] = (int)$existingLaudo['id'];
            } else {
                $stmt = $db->prepare(
                    'INSERT INTO laudos (paciente_id, medico_id, diagnostico, conduta_inicial, conduta_final, observacoes)
                     VALUES (:pid, :mid, :diagnostico, :conduta_ini, :conduta_fin, :obs)'
                );
                $stmt->execute([
                    ':pid' => $pacienteId,
                    ':mid' => $medicoId,
                    ':diagnostico' => $laudo['diagnostico'] ?? null,
                    ':conduta_ini' => $laudo['conduta_inicial'] ?: null,
                    ':conduta_fin' => $laudo['conduta_final'] ?: null,
                    ':obs' => $laudo['observacoes'] ?? null,
                ]);
                $ids['laudo_id'] = (int)$db->lastInsertId();
            }

            // --- Adicionar à fila de Altas ou Encaminhamentos ---
            $condutaInicial = trim($laudo['conduta_inicial'] ?? '');
            $logFile = __DIR__ . '/../logs/fila.log';
            file_put_contents($logFile, "[" . date('Y-m-d H:i:s') . "] Conduta Inicial recebida: '{$condutaInicial}'\n", FILE_APPEND);
            
            if (strtolower($condutaInicial) === 'alta') {
                file_put_contents($logFile, "[" . date('Y-m-d H:i:s') . "] Detectada conduta ALTA para paciente {$pacienteId}\n", FILE_APPEND);
                self::adicionarNaFilaAutomatico($db, $pacienteId, 'altas');
            } elseif (strtolower($condutaInicial) === 'encaminhamento') {
                file_put_contents($logFile, "[" . date('Y-m-d H:i:s') . "] Detectada conduta ENCAMINHAMENTO para paciente {$pacienteId}\n", FILE_APPEND);
                self::adicionarNaFilaAutomatico($db, $pacienteId, 'encaminhamentos');
            } else {
                file_put_contents($logFile, "[" . date('Y-m-d H:i:s') . "] Nenhuma fila detectada para conduta: '{$condutaInicial}'\n", FILE_APPEND);
            }
        }

        // --- Acuidade Visual (upsert — máx 1 por paciente) ---
        $acuidade = $input['acuidade'] ?? [];
        $hasAcuidade = !empty($acuidade['sem_oculos_od']) || !empty($acuidade['sem_oculos_oe'])
                    || !empty($acuidade['com_oculos_od']) || !empty($acuidade['com_oculos_oe'])
                    || !empty($acuidade['observacoes']) || !empty($acuidade['usa_oculos'])
                    || !empty($acuidade['dilata']);
        if ($hasAcuidade) {
            $stmtExistAcuidade = $db->prepare('SELECT id FROM acuidade_visual WHERE paciente_id = :pid LIMIT 1');
            $stmtExistAcuidade->execute([':pid' => $pacienteId]);
            $existingAcuidade = $stmtExistAcuidade->fetch();

            if ($existingAcuidade) {
                $stmt = $db->prepare(
                    'UPDATE acuidade_visual SET medico_id = :mid, sem_oculos_od = :sem_od, sem_oculos_oe = :sem_oe,
                     usa_oculos = :usa_oc, com_oculos_od = :com_od, com_oculos_oe = :com_oe, dilata = :dilata, observacoes = :obs
                     WHERE id = :id'
                );
                $stmt->execute([
                    ':mid' => $medicoId,
                    ':sem_od' => $acuidade['sem_oculos_od'] ?? null,
                    ':sem_oe' => $acuidade['sem_oculos_oe'] ?? null,
                    ':usa_oc' => $acuidade['usa_oculos'] ? 1 : 0,
                    ':com_od' => $acuidade['com_oculos_od'] ?? null,
                    ':com_oe' => $acuidade['com_oculos_oe'] ?? null,
                    ':dilata' => $acuidade['dilata'] ? 1 : 0,
                    ':obs' => $acuidade['observacoes'] ?? null,
                    ':id' => $existingAcuidade['id'],
                ]);
                $ids['acuidade_id'] = (int)$existingAcuidade['id'];
            } else {
                $stmt = $db->prepare(
                    'INSERT INTO acuidade_visual (paciente_id, medico_id, sem_oculos_od, sem_oculos_oe, usa_oculos, com_oculos_od, com_oculos_oe, dilata, observacoes)
                     VALUES (:pid, :mid, :sem_od, :sem_oe, :usa_oc, :com_od, :com_oe, :dilata, :obs)'
                );
                $stmt->execute([
                    ':pid' => $pacienteId,
                    ':mid' => $medicoId,
                    ':sem_od' => $acuidade['sem_oculos_od'] ?? null,
                    ':sem_oe' => $acuidade['sem_oculos_oe'] ?? null,
                    ':usa_oc' => $acuidade['usa_oculos'] ? 1 : 0,
                    ':com_od' => $acuidade['com_oculos_od'] ?? null,
                    ':com_oe' => $acuidade['com_oculos_oe'] ?? null,
                    ':dilata' => $acuidade['dilata'] ? 1 : 0,
                    ':obs' => $acuidade['observacoes'] ?? null,
                ]);
                $ids['acuidade_id'] = (int)$db->lastInsertId();
            }

            // Mover automaticamente: acuidade → exames
            self::adicionarNaFilaAutomatico($db, $pacienteId, 'exames', 'acuidade');
        }

        $db->commit();
        http_response_code(201);
        echo json_encode(['message' => 'Atendimento salvo com sucesso', 'ids' => $ids]);
        } catch (Exception $e) {
            $db->rollBack();
            error_log('Erro ao salvar atendimento: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['error' => 'Erro ao salvar atendimento: ' . $e->getMessage()]);
        }
    }

    // ========== MODELOS DE LAUDOS ==========

    public static function listarModelos(): void {
        $user = Auth::requireAuth();
        $db = Database::getInstance();

        $stmt = $db->prepare(
            'SELECT m.id, m.nome, m.dados, u.nome AS autor_nome, m.created_at
             FROM modelo_laudos m
             JOIN usuarios u ON u.id = m.usuario_id
             ORDER BY m.nome ASC'
        );
        $stmt->execute();
        $modelos = $stmt->fetchAll();
        foreach ($modelos as &$m) {
            $m['dados'] = $m['dados'] ? json_decode($m['dados'], true) : null;
        }
        echo json_encode($modelos);
    }

    public static function criarModelo(): void {
        $user = Auth::requireRole(['admin', 'medico']);
        $input = json_decode(file_get_contents('php://input'), true);
        $db = Database::getInstance();

        $nome = trim($input['nome'] ?? '');
        if ($nome === '') {
            http_response_code(422);
            echo json_encode(['error' => 'Nome do modelo é obrigatório']);
            return;
        }

        $dados = $input['dados'] ?? null;

        $stmt = $db->prepare(
            'INSERT INTO modelo_laudos (nome, dados, usuario_id)
             VALUES (:nome, :dados, :uid)'
        );
        $stmt->execute([
            ':nome' => $nome,
            ':dados' => $dados ? json_encode($dados) : null,
            ':uid' => $user['sub'],
        ]);

        http_response_code(201);
        echo json_encode(['message' => 'Modelo criado com sucesso', 'id' => (int)$db->lastInsertId()]);
    }

    public static function excluirModelo(int $id): void {
        $user = Auth::requireRole(['admin', 'medico']);
        $db = Database::getInstance();

        $stmt = $db->prepare('SELECT id, usuario_id FROM modelo_laudos WHERE id = :id');
        $stmt->execute([':id' => $id]);
        $modelo = $stmt->fetch();

        if (!$modelo) {
            http_response_code(404);
            echo json_encode(['error' => 'Modelo não encontrado']);
            return;
        }

        if ((int)$modelo['usuario_id'] !== $user['sub'] && $user['role'] !== 'admin') {
            http_response_code(403);
            echo json_encode(['error' => 'Sem permissão para excluir este modelo']);
            return;
        }

        $stmt = $db->prepare('DELETE FROM modelo_laudos WHERE id = :id');
        $stmt->execute([':id' => $id]);
        echo json_encode(['message' => 'Modelo excluído com sucesso']);
    }

    // ========== EXCLUIR LAUDO COMPLETO (somente admin) ==========

    public static function excluirLaudo(int $pacienteId): void {
        Auth::requireRole(['admin']);
        $db = Database::getInstance();

        // Verifica se paciente existe
        $stmt = $db->prepare('SELECT id FROM pacientes WHERE id = :id');
        $stmt->execute([':id' => $pacienteId]);
        if (!$stmt->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Paciente não encontrado']);
            return;
        }

        try {
            $db->beginTransaction();
            $db->prepare('DELETE FROM anamneses WHERE paciente_id = :pid')->execute([':pid' => $pacienteId]);
            $db->prepare('DELETE FROM exames WHERE paciente_id = :pid')->execute([':pid' => $pacienteId]);
            $db->prepare('DELETE FROM prescricoes WHERE paciente_id = :pid')->execute([':pid' => $pacienteId]);
            $db->prepare('DELETE FROM laudos WHERE paciente_id = :pid')->execute([':pid' => $pacienteId]);
            $db->prepare('DELETE FROM acuidade_visual WHERE paciente_id = :pid')->execute([':pid' => $pacienteId]);
            $db->commit();
            echo json_encode(['message' => 'Laudo excluído com sucesso']);
        } catch (Exception $e) {
            $db->rollBack();
            error_log('Erro ao excluir laudo: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['error' => 'Erro ao excluir laudo']);
        }
    }
}
