<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../utils/AuditLog.php';

class ProntuarioDinamicoController {

    /**
     * GET /api/prontuario-dinamico/{pacienteId}?especialidade_id=X
     * Retorna a definição do formulário + as respostas mais recentes do paciente.
     */
    public static function completo(int $pacienteId): void {
        Auth::requireAuth();
        $db = Database::getInstance();
        $tid = Tenant::id();

        $especialidadeId = (int)($_GET['especialidade_id'] ?? 0);
        if ($especialidadeId < 1) {
            http_response_code(422);
            echo json_encode(['error' => 'especialidade_id é obrigatório']);
            return;
        }

        // Verificar paciente
        $stmt = $db->prepare('SELECT id, nome_completo FROM pacientes WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $pacienteId, ':tid' => $tid]);
        $paciente = $stmt->fetch();
        if (!$paciente) {
            http_response_code(404);
            echo json_encode(['error' => 'Paciente não encontrado']);
            return;
        }

        // Verificar especialidade
        $stmt = $db->prepare('SELECT id, nome FROM especialidades WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $especialidadeId, ':tid' => $tid]);
        $esp = $stmt->fetch();
        if (!$esp) {
            http_response_code(404);
            echo json_encode(['error' => 'Especialidade não encontrada']);
            return;
        }

        // Buscar seções ativas
        $stmt = $db->prepare(
            'SELECT * FROM formulario_secoes
             WHERE especialidade_id = :eid AND tenant_id = :tid AND ativo = 1
             ORDER BY ordem ASC'
        );
        $stmt->execute([':eid' => $especialidadeId, ':tid' => $tid]);
        $secoes = $stmt->fetchAll();

        // Para cada seção, buscar campos e a resposta mais recente do paciente
        $stmtCampos = $db->prepare(
            'SELECT * FROM formulario_campos
             WHERE secao_id = :sid AND tenant_id = :tid AND ativo = 1
             ORDER BY ordem ASC'
        );

        $stmtResposta = $db->prepare(
            'SELECT id, dados, medico_id, created_at, updated_at
             FROM prontuario_dinamico
             WHERE paciente_id = :pid AND secao_id = :sid AND tenant_id = :tid
             ORDER BY created_at DESC LIMIT 1'
        );

        $stmtHistorico = $db->prepare(
            'SELECT pd.id, pd.dados, pd.created_at, u.nome AS medico_nome
             FROM prontuario_dinamico pd
             LEFT JOIN usuarios u ON u.id = pd.medico_id
             WHERE pd.paciente_id = :pid AND pd.secao_id = :sid AND pd.tenant_id = :tid
             ORDER BY pd.created_at DESC LIMIT 10'
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

            // Resposta atual
            $stmtResposta->execute([':pid' => $pacienteId, ':sid' => $secao['id'], ':tid' => $tid]);
            $resposta = $stmtResposta->fetch();
            if ($resposta) {
                $resposta['dados'] = json_decode($resposta['dados'], true);
            }
            $secao['resposta_atual'] = $resposta ?: null;

            // Histórico de respostas
            $stmtHistorico->execute([':pid' => $pacienteId, ':sid' => $secao['id'], ':tid' => $tid]);
            $historico = $stmtHistorico->fetchAll();
            foreach ($historico as &$h) {
                $h['dados'] = json_decode($h['dados'], true);
            }
            $secao['historico'] = $historico;
        }

        echo json_encode([
            'paciente'          => $paciente,
            'especialidade_id'  => (int)$especialidadeId,
            'especialidade_nome'=> $esp['nome'],
            'secoes'            => $secoes,
        ]);
    }

    /**
     * POST /api/prontuario-dinamico/{pacienteId}
     * Salva as respostas de uma ou mais seções para o paciente.
     * Body: { especialidade_id, respostas: [ {secao_id, dados: {...}}, ... ] }
     */
    public static function salvar(int $pacienteId): void {
        $user = Auth::requireAuth();
        $db = Database::getInstance();
        $tid = Tenant::id();
        $input = json_decode(file_get_contents('php://input'), true);

        $especialidadeId = (int)($input['especialidade_id'] ?? 0);
        $respostas = $input['respostas'] ?? [];

        if ($especialidadeId < 1 || !is_array($respostas) || empty($respostas)) {
            http_response_code(422);
            echo json_encode(['error' => 'especialidade_id e respostas são obrigatórios']);
            return;
        }

        // Verificar paciente
        $stmt = $db->prepare('SELECT id FROM pacientes WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $pacienteId, ':tid' => $tid]);
        if (!$stmt->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Paciente não encontrado']);
            return;
        }

        // Verificar especialidade
        $stmt = $db->prepare('SELECT id FROM especialidades WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $especialidadeId, ':tid' => $tid]);
        if (!$stmt->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Especialidade não encontrada']);
            return;
        }

        $db->beginTransaction();
        try {
            $stmtCheck = $db->prepare(
                'SELECT id FROM prontuario_dinamico
                 WHERE paciente_id = :pid AND secao_id = :sid AND tenant_id = :tid
                   AND DATE(created_at) = CURDATE()
                 ORDER BY created_at DESC LIMIT 1'
            );

            $stmtUpdate = $db->prepare(
                'UPDATE prontuario_dinamico SET dados = :dados, medico_id = :mid, updated_at = NOW()
                 WHERE id = :id'
            );

            $stmtInsert = $db->prepare(
                'INSERT INTO prontuario_dinamico
                 (tenant_id, paciente_id, especialidade_id, medico_id, secao_id, dados)
                 VALUES (:tid, :pid, :eid, :mid, :sid, :dados)'
            );

            foreach ($respostas as $resp) {
                $secaoId = (int)($resp['secao_id'] ?? 0);
                $dados   = $resp['dados'] ?? [];

                if ($secaoId < 1) continue;

                // Validar que seção pertence à especialidade do tenant
                $stmt = $db->prepare(
                    'SELECT id FROM formulario_secoes WHERE id = :id AND especialidade_id = :eid AND tenant_id = :tid'
                );
                $stmt->execute([':id' => $secaoId, ':eid' => $especialidadeId, ':tid' => $tid]);
                if (!$stmt->fetch()) continue;

                $dadosJson = json_encode($dados, JSON_UNESCAPED_UNICODE);

                // Upsert: um registro por paciente/seção por dia
                $stmtCheck->execute([':pid' => $pacienteId, ':sid' => $secaoId, ':tid' => $tid]);
                $existing = $stmtCheck->fetch();

                if ($existing) {
                    $stmtUpdate->execute([
                        ':dados' => $dadosJson,
                        ':mid'   => $user['sub'],
                        ':id'    => $existing['id'],
                    ]);
                } else {
                    $stmtInsert->execute([
                        ':tid'  => $tid,
                        ':pid'  => $pacienteId,
                        ':eid'  => $especialidadeId,
                        ':mid'  => $user['sub'],
                        ':sid'  => $secaoId,
                        ':dados'=> $dadosJson,
                    ]);
                }
            }

            $db->commit();
            AuditLog::registrar('salvar', 'prontuario_dinamico', $pacienteId,
                "Prontuário dinâmico salvo (especialidade {$especialidadeId})", $user);

            echo json_encode(['message' => 'Prontuário salvo com sucesso']);
        } catch (Exception $e) {
            $db->rollBack();
            error_log('Erro ao salvar prontuario_dinamico: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['error' => 'Erro ao salvar prontuário']);
        }
    }

    /**
     * GET /api/prontuario-dinamico/{pacienteId}/historico?especialidade_id=X&secao_id=Y
     * Retorna histórico completo de uma seção específica para o paciente.
     */
    public static function historico(int $pacienteId): void {
        Auth::requireAuth();
        $db = Database::getInstance();
        $tid = Tenant::id();

        $especialidadeId = (int)($_GET['especialidade_id'] ?? 0);
        $secaoId         = (int)($_GET['secao_id'] ?? 0);

        if ($especialidadeId < 1 || $secaoId < 1) {
            http_response_code(422);
            echo json_encode(['error' => 'especialidade_id e secao_id são obrigatórios']);
            return;
        }

        $stmt = $db->prepare(
            'SELECT pd.id, pd.dados, pd.created_at, pd.updated_at,
                    u.nome AS medico_nome, u.role AS medico_role
             FROM prontuario_dinamico pd
             LEFT JOIN usuarios u ON u.id = pd.medico_id
             WHERE pd.paciente_id = :pid AND pd.especialidade_id = :eid
               AND pd.secao_id = :sid AND pd.tenant_id = :tid
             ORDER BY pd.created_at DESC
             LIMIT 50'
        );
        $stmt->execute([
            ':pid' => $pacienteId,
            ':eid' => $especialidadeId,
            ':sid' => $secaoId,
            ':tid' => $tid,
        ]);

        $rows = $stmt->fetchAll();
        foreach ($rows as &$row) {
            $row['dados'] = json_decode($row['dados'], true);
        }

        echo json_encode($rows);
    }
}
