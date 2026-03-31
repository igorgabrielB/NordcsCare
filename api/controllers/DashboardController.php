<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';

class DashboardController {

    public static function metricas(): void {
        Auth::requireAuth();
        $db = Database::getInstance();

        // Date range filter (defaults to today)
        $dataInicio = $_GET['data_inicio'] ?? date('Y-m-d');
        $dataFim = $_GET['data_fim'] ?? date('Y-m-d');
        $horaInicio = $_GET['hora_inicio'] ?? null;
        $horaFim = $_GET['hora_fim'] ?? null;

        // Build datetime range for created_at queries
        $dtInicio = $dataInicio . ' ' . ($horaInicio ? $horaInicio . ':00' : '00:00:00');
        $dtFim    = $dataFim    . ' ' . ($horaFim    ? $horaFim    . ':59' : '23:59:59');

        // Total pacientes
        $totalPacientes = (int) $db->query('SELECT COUNT(*) FROM pacientes')->fetchColumn();

        // Pacientes do período (escolas agendadas no intervalo)
        $stmtDia = $db->prepare(
            "SELECT COUNT(DISTINCT p.id) FROM pacientes p
             INNER JOIN escola_agenda ea ON ea.escola = p.escola
             WHERE ea.data_atendimento BETWEEN :di AND :df"
        );
        $stmtDia->execute([':di' => $dataInicio, ':df' => $dataFim]);
        $pacientesDoDia = (int) $stmtDia->fetchColumn();

        // Escolas agendadas no período
        $stmtEscHoje = $db->prepare(
            "SELECT ea.escola, COUNT(DISTINCT p.id) as total
             FROM escola_agenda ea
             LEFT JOIN pacientes p ON p.escola = ea.escola
             WHERE ea.data_atendimento BETWEEN :di AND :df
             GROUP BY ea.escola
             ORDER BY ea.escola"
        );
        $stmtEscHoje->execute([':di' => $dataInicio, ':df' => $dataFim]);
        $escolasHoje = $stmtEscHoje->fetchAll();

        // Atendimentos no período (usando atendimentos_historico)
        $medicoId = isset($_GET['medico_id']) ? (int) $_GET['medico_id'] : null;
        $ahWhere = "data_atendimento BETWEEN :di AND :df";
        $ahParams = [':di' => $dataInicio, ':df' => $dataFim];
        if ($horaInicio) { $ahWhere .= " AND hora_entrada >= :hi"; $ahParams[':hi'] = $horaInicio; }
        if ($horaFim)    { $ahWhere .= " AND hora_entrada <= :hf"; $ahParams[':hf'] = $horaFim; }
        if ($medicoId)   { $ahWhere .= " AND medico_id = :mid"; $ahParams[':mid'] = $medicoId; }

        $stmt = $db->prepare("SELECT COUNT(*) FROM atendimentos_historico WHERE {$ahWhere}");
        $stmt->execute($ahParams);
        $atendimentosHoje = (int) $stmt->fetchColumn();

        // Pacientes na fila agora (inclui multi-dia: entradas de dia anterior se escola agendada hoje)
        $stmtNaFila = $db->query(
            "SELECT COUNT(*) FROM fila f
             JOIN pacientes p ON p.id = f.paciente_id
             WHERE f.status != 'concluido' AND f.estacao NOT IN ('altas', 'encaminhamentos')
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
               )"
        );
        $naFila = (int) $stmtNaFila->fetchColumn();

        // Total exames no período
        $stmtEx = $db->prepare('SELECT COUNT(*) FROM exames WHERE created_at BETWEEN :dti AND :dtf');
        $stmtEx->execute([':dti' => $dtInicio, ':dtf' => $dtFim]);
        $totalExames = (int) $stmtEx->fetchColumn();

        // Total prescrições (óculos) no período — da atendimentos_historico
        $stmt = $db->prepare("SELECT COUNT(*) FROM atendimentos_historico WHERE resultado IN ('oculos','oculos_encaminhamento') AND {$ahWhere}");
        $stmt->execute($ahParams);
        $totalPrescricoes = (int) $stmt->fetchColumn();

        // Total laudos no período
        if ($medicoId) {
            $stmtLa = $db->prepare('SELECT COUNT(*) FROM laudos WHERE created_at BETWEEN :dti AND :dtf AND medico_id = :mid');
            $stmtLa->execute([':dti' => $dtInicio, ':dtf' => $dtFim, ':mid' => $medicoId]);
        } else {
            $stmtLa = $db->prepare('SELECT COUNT(*) FROM laudos WHERE created_at BETWEEN :dti AND :dtf');
            $stmtLa->execute([':dti' => $dtInicio, ':dtf' => $dtFim]);
        }
        $totalLaudos = (int) $stmtLa->fetchColumn();

        // Total altas no período (só alta pura, sem óculos)
        $stmt = $db->prepare("SELECT COUNT(*) FROM atendimentos_historico WHERE resultado = 'alta' AND {$ahWhere}");
        $stmt->execute($ahParams);
        $totalAltas = (int) $stmt->fetchColumn();

        // Condutas iniciais no período
        $stmt = $db->prepare(
            "SELECT conduta_inicial, COUNT(*) as total FROM laudos
             WHERE conduta_inicial IS NOT NULL AND created_at BETWEEN :dti AND :dtf
             GROUP BY conduta_inicial"
        );
        $stmt->execute([':dti' => $dtInicio, ':dtf' => $dtFim]);
        $condutasIniciais = [];
        foreach ($stmt->fetchAll() as $row) {
            $condutasIniciais[$row['conduta_inicial']] = (int) $row['total'];
        }

        // Condutas finais no período
        $stmt = $db->prepare(
            "SELECT conduta_final, COUNT(*) as total FROM laudos
             WHERE conduta_final IS NOT NULL AND created_at BETWEEN :dti AND :dtf
             GROUP BY conduta_final"
        );
        $stmt->execute([':dti' => $dtInicio, ':dtf' => $dtFim]);
        $condutasFinais = [];
        foreach ($stmt->fetchAll() as $row) {
            $condutasFinais[$row['conduta_final']] = (int) $row['total'];
        }

        // Atendimentos por dia no período (usando atendimentos_historico)
        $porDiaParams = [':di' => $dataInicio, ':df' => $dataFim];
        $porDiaExtra = '';
        if ($horaInicio) { $porDiaExtra .= " AND hora_entrada >= :hi"; $porDiaParams[':hi'] = $horaInicio; }
        if ($horaFim)    { $porDiaExtra .= " AND hora_entrada <= :hf"; $porDiaParams[':hf'] = $horaFim; }
        $stmt = $db->prepare(
            "SELECT data_atendimento as dia, COUNT(*) as total
             FROM atendimentos_historico
             WHERE data_atendimento BETWEEN :di AND :df {$porDiaExtra}
             GROUP BY data_atendimento
             ORDER BY dia ASC"
        );
        $stmt->execute($porDiaParams);
        $porDia = [];
        foreach ($stmt->fetchAll() as $row) {
            $porDia[] = ['dia' => $row['dia'], 'total' => (int) $row['total']];
        }

        // Fila por estação (sempre atual, sem filtro de data)
        $stmt = $db->query(
            "SELECT estacao, status, COUNT(*) as total
             FROM fila
             WHERE status != 'concluido' AND estacao NOT IN ('altas', 'encaminhamentos')
             GROUP BY estacao, status"
        );
        $filaPorEstacao = [];
        foreach ($stmt->fetchAll() as $row) {
            $filaPorEstacao[] = [
                'estacao' => $row['estacao'],
                'status' => $row['status'],
                'total' => (int) $row['total'],
            ];
        }

        // Encaminhamentos no período (da atendimentos_historico)
        $stmt = $db->prepare("SELECT COUNT(*) FROM atendimentos_historico WHERE resultado IN ('encaminhamento','oculos_encaminhamento') AND {$ahWhere}");
        $stmt->execute($ahParams);
        $totalEncaminhamentos = (int) $stmt->fetchColumn();

        // Lista detalhada de encaminhamentos para o painel
        $encWhereParams = [':di' => $dataInicio, ':df' => $dataFim];
        $encWhereExtra = '';
        if ($horaInicio) { $encWhereExtra .= " AND ah.hora_entrada >= :hi"; $encWhereParams[':hi'] = $horaInicio; }
        if ($horaFim)    { $encWhereExtra .= " AND ah.hora_entrada <= :hf"; $encWhereParams[':hf'] = $horaFim; }
        $stmtEnc = $db->prepare(
            "SELECT ah.paciente_id, p.nome_completo, ah.escola, ah.diagnostico, ah.conduta_inicial, ah.conduta_final, ah.observacoes, ah.created_at
             FROM atendimentos_historico ah
             INNER JOIN pacientes p ON p.id = ah.paciente_id
             WHERE ah.data_atendimento BETWEEN :di AND :df {$encWhereExtra}
               AND ah.resultado IN ('encaminhamento','oculos_encaminhamento')
             ORDER BY ah.created_at DESC"
        );
        $stmtEnc->execute($encWhereParams);
        $encaminhamentos = $stmtEnc->fetchAll(PDO::FETCH_ASSOC);

        // Próximas escolas agendadas (a partir de hoje, máx 15)
        $hoje = date('Y-m-d');
        $stmtAgenda = $db->prepare(
            "SELECT ea.escola, ea.data_atendimento, COUNT(p.id) as total_alunos
             FROM escola_agenda ea
             LEFT JOIN pacientes p ON p.escola = ea.escola
             WHERE ea.data_atendimento >= :hoje
             GROUP BY ea.escola, ea.data_atendimento
             ORDER BY ea.data_atendimento ASC, ea.escola ASC
             LIMIT 15"
        );
        $stmtAgenda->execute([':hoje' => $hoje]);
        $escolasAgendadas = $stmtAgenda->fetchAll();

        echo json_encode([
            'total_pacientes' => $totalPacientes,
            'pacientes_do_dia' => $pacientesDoDia,
            'escolas_hoje' => $escolasHoje,
            'atendimentos_hoje' => $atendimentosHoje,
            'na_fila' => $naFila,
            'total_exames' => $totalExames,
            'total_prescricoes' => $totalPrescricoes,
            'total_laudos' => $totalLaudos,
            'total_altas' => $totalAltas,
            'condutas_iniciais' => $condutasIniciais,
            'condutas_finais' => $condutasFinais,
            'atendimentos_por_dia' => $porDia,
            'fila_por_estacao' => $filaPorEstacao,
            'escolas_agendadas' => $escolasAgendadas,
            'total_encaminhamentos' => $totalEncaminhamentos,
            'encaminhamentos' => $encaminhamentos,
        ]);
    }
}
