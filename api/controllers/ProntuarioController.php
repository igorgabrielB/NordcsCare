<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../utils/AuditLog.php';

class ProntuarioController {
    // ========== FUNÇÃO AUXILIAR: Adicionar à Fila Automaticamente ==========

    private static function adicionarNaFilaAutomatico($db, $pacienteId, $estacao, $estacaoAnterior = null): void {
        try {
            $logFile = __DIR__ . '/../logs/fila.log';
            $logMsg = "[" . date('Y-m-d H:i:s') . "] Tentando mover paciente {$pacienteId} para fila '{$estacao}'" . ($estacaoAnterior ? " (saindo de '{$estacaoAnterior}')" : '') . "\n";
            file_put_contents($logFile, $logMsg, FILE_APPEND);

            // Preservar o created_at original (hora de entrada na fila HOJE) antes de deletar
            $stmtOrig = $db->prepare('SELECT created_at FROM fila WHERE paciente_id = :pid AND DATE(created_at) = CURDATE() ORDER BY created_at ASC LIMIT 1');
            $stmtOrig->execute([':pid' => $pacienteId]);
            $originalCreatedAt = $stmtOrig->fetchColumn();

            // Remove TODOS os registros do paciente na fila (garante apenas 1 registro por paciente)
            $stmt = $db->prepare('DELETE FROM fila WHERE paciente_id = :pid');
            $stmt->execute([':pid' => $pacienteId]);
            $deleted = $stmt->rowCount();
            file_put_contents($logFile, "[" . date('Y-m-d H:i:s') . "] Removido paciente de $deleted filas anteriores\n", FILE_APPEND);

            // Adiciona à fila na nova estação, mantendo created_at original
            // Altas/encaminhamentos = concluido (atendimento finalizado); demais = em_atendimento
            $status = in_array($estacao, ['altas', 'encaminhamentos']) ? 'concluido' : 'em_atendimento';
            if ($originalCreatedAt) {
                $stmt = $db->prepare(
                    'INSERT INTO fila (paciente_id, estacao, status, created_at)
                     VALUES (:pid, :estacao, :status, :created_at)'
                );
                $result = $stmt->execute([
                    ':pid' => $pacienteId,
                    ':estacao' => $estacao,
                    ':status' => $status,
                    ':created_at' => $originalCreatedAt,
                ]);
            } else {
                $stmt = $db->prepare(
                    'INSERT INTO fila (paciente_id, estacao, status)
                     VALUES (:pid, :estacao, :status)'
                );
                $result = $stmt->execute([
                    ':pid' => $pacienteId,
                    ':estacao' => $estacao,
                    ':status' => $status,
                ]);
            }
            file_put_contents($logFile, "[" . date('Y-m-d H:i:s') . "] INSERT resultado: " . ($result ? 'SUCCESS' : 'FAIL') . " (created_at preservado: " . ($originalCreatedAt ?: 'N/A') . ")\n", FILE_APPEND);

            // Salvar no histórico quando paciente chega em altas ou encaminhamentos
            if (in_array($estacao, ['altas', 'encaminhamentos'])) {
                self::salvarHistoricoAtendimento($db, $pacienteId, $estacao, $originalCreatedAt);
            }
        } catch (Exception $e) {
            $logFile = __DIR__ . '/../logs/fila.log';
            file_put_contents($logFile, "[" . date('Y-m-d H:i:s') . "] ERRO: " . $e->getMessage() . "\n", FILE_APPEND);
            error_log("Erro ao adicionar à fila: " . $e->getMessage());
        }
    }

    /**
     * Salva registro no histórico de atendimentos quando paciente é finalizado (alta/encaminhamento).
     */
    private static function salvarHistoricoAtendimento($db, $pacienteId, $resultado, $horaEntrada): void {
        try {
            $logFile = __DIR__ . '/../logs/fila.log';

            // Buscar dados do paciente (escola)
            $stmt = $db->prepare('SELECT escola FROM pacientes WHERE id = :id');
            $stmt->execute([':id' => $pacienteId]);
            $escola = $stmt->fetchColumn();

            // Buscar laudo (diagnostico, conduta)
            $stmt = $db->prepare('SELECT diagnostico, conduta_inicial, conduta_final, medico_id, especialidade FROM laudos WHERE paciente_id = :pid ORDER BY created_at DESC LIMIT 1');
            $stmt->execute([':pid' => $pacienteId]);
            $laudo = $stmt->fetch();

            // Buscar nome do médico
            $medicoNome = null;
            $medicoId = $laudo['medico_id'] ?? null;
            if ($medicoId) {
                $stmt = $db->prepare('SELECT nome FROM usuarios WHERE id = :id');
                $stmt->execute([':id' => $medicoId]);
                $medicoNome = $stmt->fetchColumn();
            }

            // Mapear resultado: estação da fila → valor do ENUM
            $resultadoMap = [
                'altas' => 'alta',
                'encaminhamentos' => 'encaminhamento',
            ];
            // Verificar se tem óculos + encaminhamento
            $condutaInicial = strtolower(trim($laudo['conduta_inicial'] ?? ''));
            if ($resultado === 'encaminhamentos' && in_array($condutaInicial, ['onibus_encaminhamento'])) {
                $resultadoFinal = 'oculos_encaminhamento';
            } elseif ($resultado === 'altas' && in_array($condutaInicial, ['onibus'])) {
                $resultadoFinal = 'oculos';
            } else {
                $resultadoFinal = $resultadoMap[$resultado] ?? 'alta';
            }

            $dataAtendimento = date('Y-m-d');
            $horaEntradaTime = $horaEntrada ? date('H:i:s', strtotime($horaEntrada)) : date('H:i:s');
            $horaSaida = date('H:i:s');

            // Evitar duplicata: não inserir se já existe registro para esse paciente hoje
            $stmt = $db->prepare('SELECT id FROM atendimentos_historico WHERE paciente_id = :pid AND data_atendimento = CURDATE() LIMIT 1');
            $stmt->execute([':pid' => $pacienteId]);
            if ($stmt->fetch()) {
                // Atualizar registro existente
                $stmt = $db->prepare(
                    'UPDATE atendimentos_historico SET hora_saida = :hora_saida, resultado = :resultado,
                     diagnostico = :diagnostico, especialidade = :especialidade, conduta_inicial = :conduta_ini, conduta_final = :conduta_fin,
                     medico_id = :medico_id, medico_nome = :medico_nome
                     WHERE paciente_id = :pid AND data_atendimento = CURDATE()'
                );
                $stmt->execute([
                    ':hora_saida' => $horaSaida,
                    ':resultado' => $resultadoFinal,
                    ':diagnostico' => $laudo['diagnostico'] ?? null,
                    ':especialidade' => $laudo['especialidade'] ?? null,
                    ':conduta_ini' => $laudo['conduta_inicial'] ?? null,
                    ':conduta_fin' => $laudo['conduta_final'] ?? null,
                    ':medico_id' => $medicoId,
                    ':medico_nome' => $medicoNome,
                    ':pid' => $pacienteId,
                ]);
                file_put_contents($logFile, "[" . date('Y-m-d H:i:s') . "] Histórico ATUALIZADO para paciente {$pacienteId} (resultado: {$resultadoFinal})\n", FILE_APPEND);
            } else {
                // Inserir novo registro
                $stmt = $db->prepare(
                    'INSERT INTO atendimentos_historico (paciente_id, escola, data_atendimento, hora_entrada, hora_saida, resultado, diagnostico, especialidade, conduta_inicial, conduta_final, medico_id, medico_nome)
                     VALUES (:pid, :escola, :data, :hora_entrada, :hora_saida, :resultado, :diagnostico, :especialidade, :conduta_ini, :conduta_fin, :medico_id, :medico_nome)'
                );
                $stmt->execute([
                    ':pid' => $pacienteId,
                    ':escola' => $escola,
                    ':data' => $dataAtendimento,
                    ':hora_entrada' => $horaEntradaTime,
                    ':hora_saida' => $horaSaida,
                    ':resultado' => $resultadoFinal,
                    ':diagnostico' => $laudo['diagnostico'] ?? null,
                    ':especialidade' => $laudo['especialidade'] ?? null,
                    ':conduta_ini' => $laudo['conduta_inicial'] ?? null,
                    ':conduta_fin' => $laudo['conduta_final'] ?? null,
                    ':medico_id' => $medicoId,
                    ':medico_nome' => $medicoNome,
                ]);
                file_put_contents($logFile, "[" . date('Y-m-d H:i:s') . "] Histórico SALVO para paciente {$pacienteId} (resultado: {$resultadoFinal})\n", FILE_APPEND);
            }
        } catch (Exception $e) {
            // Não impedir o fluxo principal se o histórico falhar
            error_log("Erro ao salvar histórico: " . $e->getMessage());
            $logFile = __DIR__ . '/../logs/fila.log';
            file_put_contents($logFile, "[" . date('Y-m-d H:i:s') . "] ERRO histórico: " . $e->getMessage() . "\n", FILE_APPEND);
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
            'SELECT a.*, u.nome AS medico_nome, u.role AS medico_role FROM anamneses a
             JOIN usuarios u ON u.id = a.medico_id
             WHERE a.paciente_id = :pid ORDER BY a.created_at DESC'
        );
        $stmt->execute([':pid' => $pacienteId]);
        $anamneses = $stmt->fetchAll();

        // Exames locais
        $stmt = $db->prepare(
            'SELECT e.*, u.nome AS medico_nome, u.role AS medico_role FROM exames e
             JOIN usuarios u ON u.id = e.medico_id
             WHERE e.paciente_id = :pid ORDER BY e.created_at DESC'
        );
        $stmt->execute([':pid' => $pacienteId]);
        $exames = $stmt->fetchAll();


        // Prescrições
        $stmt = $db->prepare(
            'SELECT p.*, u.nome AS medico_nome, u.role AS medico_role FROM prescricoes p
             JOIN usuarios u ON u.id = p.medico_id
             WHERE p.paciente_id = :pid ORDER BY p.created_at DESC'
        );
        $stmt->execute([':pid' => $pacienteId]);
        $prescricoes = $stmt->fetchAll();

        // Laudos
        $stmt = $db->prepare(
            'SELECT l.*, u.nome AS medico_nome, u.role AS medico_role FROM laudos l
             JOIN usuarios u ON u.id = l.medico_id
             WHERE l.paciente_id = :pid ORDER BY l.created_at DESC'
        );
        $stmt->execute([':pid' => $pacienteId]);
        $laudos = $stmt->fetchAll();

        // Acuidade Visual
        $stmt = $db->prepare(
            'SELECT a.*, u.nome AS medico_nome, u.role AS medico_role FROM acuidade_visual a
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
        $user = Auth::requireRole(['admin', 'medico', 'administrativo']);
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
        $prescricaoMoveuFila = false;
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
                    || !empty($anamnese['historico_pessoal']) || !empty($anamnese['observacoes']);
        if ($hasAnamnese) {
            if ($existingAnamnese) {
                $stmt = $db->prepare(
                    'UPDATE anamneses SET medico_id = :mid, queixa_principal = :queixa, historico_ocular = :hist_ocular,
                     historico_familiar = :hist_familiar, alergias = :alergias, medicamentos_em_uso = :medicamentos,
                     cirurgias_anteriores = :cirurgias, historico_pessoal = :hist_pessoal, observacoes = :obs WHERE id = :id'
                );
                $stmt->execute([
                    ':mid' => $medicoId,
                    ':queixa' => $anamnese['queixa_principal'],
                    ':hist_ocular' => $anamnese['historico_ocular'] ?? null,
                    ':hist_familiar' => $anamnese['historico_familiar'] ?? null,
                    ':alergias' => $anamnese['alergias'] ?? null,
                    ':medicamentos' => $anamnese['medicamentos_em_uso'] ?? null,
                    ':cirurgias' => $anamnese['cirurgias_anteriores'] ?? null,
                    ':hist_pessoal' => $anamnese['historico_pessoal'] ?? null,
                    ':obs' => $anamnese['observacoes'] ?? null,
                    ':id' => $existingAnamnese['id'],
                ]);
                $ids['anamnese_id'] = (int)$existingAnamnese['id'];
            } else {
                $stmt = $db->prepare(
                    'INSERT INTO anamneses (paciente_id, medico_id, queixa_principal, historico_ocular,
                     historico_familiar, alergias, medicamentos_em_uso, cirurgias_anteriores, historico_pessoal, observacoes)
                     VALUES (:pid, :mid, :queixa, :hist_ocular, :hist_familiar, :alergias, :medicamentos, :cirurgias, :hist_pessoal, :obs)'
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
                    ':hist_pessoal' => $anamnese['historico_pessoal'] ?? null,
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

        // --- Tonometria manual (OD / OE) — salva como exame ---
        $tonoOD = trim($input['tonometria_od'] ?? '');
        $tonoOE = trim($input['tonometria_oe'] ?? '');
        if ($tonoOD !== '' || $tonoOE !== '') {
            // Remove registros anteriores de tonometria manual desse paciente
            $db->prepare("DELETE FROM exames WHERE paciente_id = :pid AND tipo_exame = 'tonometria'")->execute([':pid' => $pacienteId]);
            $stmtTono = $db->prepare(
                'INSERT INTO exames (paciente_id, medico_id, tipo_exame, olho, resultado) VALUES (:pid, :mid, :tipo, :olho, :resultado)'
            );
            if ($tonoOD !== '') {
                $stmtTono->execute([':pid' => $pacienteId, ':mid' => $medicoId, ':tipo' => 'tonometria', ':olho' => 'OD', ':resultado' => $tonoOD]);
            }
            if ($tonoOE !== '') {
                $stmtTono->execute([':pid' => $pacienteId, ':mid' => $medicoId, ':tipo' => 'tonometria', ':olho' => 'OE', ':resultado' => $tonoOE]);
            }
        }

        // --- Prescrição (upsert — máx 1 por paciente) ---
        $prescricao = $input['prescricao'] ?? [];
        // Sanitizar valores: remover caracteres de formatação (°, +) mantendo apenas números, ponto e sinal negativo
        // Preservar 'plano' e 'pl' como texto válido
        foreach (['od_esferico','od_cilindrico','od_eixo','od_adicao','oe_esferico','oe_cilindrico','oe_eixo','oe_adicao','dp'] as $rxField) {
            if (isset($prescricao[$rxField]) && $prescricao[$rxField] !== '') {
                $lower = strtolower(trim($prescricao[$rxField]));
                if ($lower === 'plano' || $lower === 'pl') {
                    $prescricao[$rxField] = $lower;
                } else {
                    $prescricao[$rxField] = preg_replace('/[^0-9.\-]/', '', $prescricao[$rxField]);
                }
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
                     dp = :dp, acuidade_od = :ac_od, acuidade_oe = :ac_oe, observacoes = :obs WHERE id = :id'
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
                    ':ac_od' => $prescricao['acuidade_od'] ?: null,
                    ':ac_oe' => $prescricao['acuidade_oe'] ?: null,
                    ':obs' => $prescricao['observacoes'] ?? null,
                    ':id' => $existingPrescricao['id'],
                ]);
                $ids['prescricao_id'] = (int)$existingPrescricao['id'];
            } else {
                $stmt = $db->prepare(
                    'INSERT INTO prescricoes (paciente_id, medico_id, tipo,
                     od_esferico, od_cilindrico, od_eixo, od_adicao,
                     oe_esferico, oe_cilindrico, oe_eixo, oe_adicao,
                     dp, acuidade_od, acuidade_oe, observacoes)
                     VALUES (:pid, :mid, :tipo,
                     :od_esf, :od_cil, :od_eixo, :od_add,
                     :oe_esf, :oe_cil, :oe_eixo, :oe_add,
                     :dp, :ac_od, :ac_oe, :obs)'
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
                    ':ac_od' => $prescricao['acuidade_od'] ?: null,
                    ':ac_oe' => $prescricao['acuidade_oe'] ?: null,
                    ':obs' => $prescricao['observacoes'] ?? null,
                ]);
                $ids['prescricao_id'] = (int)$db->lastInsertId();
            }

            // Após prescrição: mover paciente conforme conduta do laudo
            // Usar conduta do input atual se disponível, senão do laudo existente no DB
            $laudoInput = $input['laudo'] ?? [];
            $condutaCheck = strtolower(trim($laudoInput['conduta_inicial'] ?? ($existingLaudo['conduta_inicial'] ?? '')));
            $condutaFinal = strtolower(trim($laudoInput['conduta_final'] ?? ($existingLaudo['conduta_final'] ?? '')));
            $logFile = __DIR__ . '/../logs/fila.log';

            // Se há conduta_final definida, ela tem prioridade (usada na estação óculos)
            // Porém se conduta_inicial inclui encaminhamento, o encaminhamento sempre prevalece sobre alta
            if ($condutaFinal === 'encaminhamento') {
                file_put_contents($logFile, "[" . date('Y-m-d H:i:s') . "] Prescricao salva com conduta_final encaminhamento - movendo paciente {$pacienteId} para encaminhamentos\n", FILE_APPEND);
                self::adicionarNaFilaAutomatico($db, $pacienteId, 'encaminhamentos');
            } elseif ($condutaFinal === 'alta' && in_array($condutaCheck, ['onibus_encaminhamento', 'encaminhamento'])) {
                file_put_contents($logFile, "[" . date('Y-m-d H:i:s') . "] Prescricao salva com conduta_final alta mas conduta_inicial {$condutaCheck} - encaminhamento prevalece - movendo paciente {$pacienteId} para encaminhamentos\n", FILE_APPEND);
                self::adicionarNaFilaAutomatico($db, $pacienteId, 'encaminhamentos');
            } elseif ($condutaFinal === 'alta') {
                file_put_contents($logFile, "[" . date('Y-m-d H:i:s') . "] Prescricao salva com conduta_final alta - movendo paciente {$pacienteId} para altas\n", FILE_APPEND);
                self::adicionarNaFilaAutomatico($db, $pacienteId, 'altas');
            } elseif ($condutaCheck === 'onibus_encaminhamento') {
                file_put_contents($logFile, "[" . date('Y-m-d H:i:s') . "] Prescricao salva com conduta onibus_encaminhamento - movendo paciente {$pacienteId} para encaminhamentos\n", FILE_APPEND);
                self::adicionarNaFilaAutomatico($db, $pacienteId, 'encaminhamentos');
            } elseif ($condutaCheck === 'onibus') {
                file_put_contents($logFile, "[" . date('Y-m-d H:i:s') . "] Prescricao salva com conduta onibus - movendo paciente {$pacienteId} para altas\n", FILE_APPEND);
                self::adicionarNaFilaAutomatico($db, $pacienteId, 'altas');
            }
            $prescricaoMoveuFila = true;
        }

        // --- Laudo (upsert — máx 1 por paciente) ---
        $laudo = $input['laudo'] ?? [];
        if (!empty($laudo['conduta_inicial']) || !empty($laudo['conduta_final']) || !empty($laudo['diagnostico'])) {
            if ($existingLaudo) {
                $stmt = $db->prepare(
                    'UPDATE laudos SET medico_id = :mid, diagnostico = :diagnostico,
                     conduta_inicial = :conduta_ini, conduta_final = :conduta_fin, observacoes = :obs, especialidade = :especialidade
                     WHERE id = :id'
                );
                $stmt->execute([
                    ':mid' => $medicoId,
                    ':diagnostico' => $laudo['diagnostico'] ?? null,
                    ':conduta_ini' => $laudo['conduta_inicial'] ?: null,
                    ':conduta_fin' => $laudo['conduta_final'] ?: null,
                    ':obs' => $laudo['observacoes'] ?? null,
                    ':especialidade' => $laudo['especialidade'] ?? null,
                    ':id' => $existingLaudo['id'],
                ]);
                $ids['laudo_id'] = (int)$existingLaudo['id'];
            } else {
                $stmt = $db->prepare(
                    'INSERT INTO laudos (paciente_id, medico_id, diagnostico, conduta_inicial, conduta_final, observacoes, especialidade)
                     VALUES (:pid, :mid, :diagnostico, :conduta_ini, :conduta_fin, :obs, :especialidade)'
                );
                $stmt->execute([
                    ':pid' => $pacienteId,
                    ':mid' => $medicoId,
                    ':diagnostico' => $laudo['diagnostico'] ?? null,
                    ':conduta_ini' => $laudo['conduta_inicial'] ?: null,
                    ':conduta_fin' => $laudo['conduta_final'] ?: null,
                    ':obs' => $laudo['observacoes'] ?? null,
                    ':especialidade' => $laudo['especialidade'] ?? null,
                ]);
                $ids['laudo_id'] = (int)$db->lastInsertId();
            }

            // --- Adicionar à fila de Altas ou Encaminhamentos (somente se a prescrição não já moveu) ---
            if (!$prescricaoMoveuFila) {
                $condutaInicial = trim($laudo['conduta_inicial'] ?? '');
                $logFile = __DIR__ . '/../logs/fila.log';
                file_put_contents($logFile, "[" . date('Y-m-d H:i:s') . "] Conduta Inicial recebida: '{$condutaInicial}'\n", FILE_APPEND);
                
                if (strtolower($condutaInicial) === 'alta') {
                    file_put_contents($logFile, "[" . date('Y-m-d H:i:s') . "] Detectada conduta ALTA para paciente {$pacienteId}\n", FILE_APPEND);
                    self::adicionarNaFilaAutomatico($db, $pacienteId, 'altas');
                } elseif (strtolower($condutaInicial) === 'onibus') {
                    file_put_contents($logFile, "[" . date('Y-m-d H:i:s') . "] Detectada conduta ONIBUS para paciente {$pacienteId}\n", FILE_APPEND);
                    self::adicionarNaFilaAutomatico($db, $pacienteId, 'oculos', 'laudos');
                } elseif (strtolower($condutaInicial) === 'encaminhamento') {
                    file_put_contents($logFile, "[" . date('Y-m-d H:i:s') . "] Detectada conduta ENCAMINHAMENTO para paciente {$pacienteId}\n", FILE_APPEND);
                    self::adicionarNaFilaAutomatico($db, $pacienteId, 'encaminhamentos');
                } elseif (strtolower($condutaInicial) === 'onibus_encaminhamento') {
                    file_put_contents($logFile, "[" . date('Y-m-d H:i:s') . "] Detectada conduta ONIBUS+ENCAMINHAMENTO para paciente {$pacienteId}\n", FILE_APPEND);
                    self::adicionarNaFilaAutomatico($db, $pacienteId, 'oculos', 'laudos');
                } else {
                    file_put_contents($logFile, "[" . date('Y-m-d H:i:s') . "] Nenhuma fila detectada para conduta: '{$condutaInicial}'\n", FILE_APPEND);
                }
            }
        }

        // --- Acuidade Visual (upsert — máx 1 por paciente) ---
        $acuidade = $input['acuidade'] ?? [];
        if (!empty($acuidade) && $user['role'] === 'medico') {
            http_response_code(403);
            echo json_encode(['error' => 'Médicos não podem registrar acuidade visual']);
            return;
        }
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

            // Mover automaticamente: acuidade → laudos
            self::adicionarNaFilaAutomatico($db, $pacienteId, 'laudos', 'acuidade');
        }

        $db->commit();

        AuditLog::registrar('salvar', 'prontuario', $pacienteId, 'Atendimento salvo (IDs: ' . json_encode($ids) . ')', $user);

        http_response_code(201);
        echo json_encode(['message' => 'Atendimento salvo com sucesso', 'ids' => $ids]);
        } catch (Exception $e) {
            $db->rollBack();
            error_log('Erro ao salvar atendimento: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['error' => 'Erro ao salvar atendimento']);
        }
    }

    // ========== MODELOS DE LAUDOS ==========

    public static function listarModelos(): void {
        $user = Auth::requireAuth();
        $db = Database::getInstance();

        $stmt = $db->prepare(
            'SELECT m.id, m.nome, m.dados, u.nome AS autor_nome, u.role AS autor_role, m.created_at
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
        $user = Auth::requireRole(['admin']);
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
            AuditLog::registrar('excluir', 'prontuario', $pacienteId, 'Laudo completo excluído', $user);
            echo json_encode(['message' => 'Laudo excluído com sucesso']);
        } catch (Exception $e) {
            $db->rollBack();
            error_log('Erro ao excluir laudo: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['error' => 'Erro ao excluir laudo']);
        }
    }
}
