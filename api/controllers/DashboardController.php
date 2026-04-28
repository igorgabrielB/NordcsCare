<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../middleware/tenant.php';

class DashboardController {

    public static function metricas(): void {
        Auth::requireAuth();
        $db = Database::getInstance();
        $tenantId = Tenant::id();
        $tenantId = Tenant::id();

        // Date range filter (defaults to today)
        $dataInicio = $_GET['data_inicio'] ?? date('Y-m-d');
        $dataFim = $_GET['data_fim'] ?? date('Y-m-d');
        $horaInicio = $_GET['hora_inicio'] ?? null;
        $horaFim = $_GET['hora_fim'] ?? null;
        $escolaParam = isset($_GET['escola']) ? trim($_GET['escola']) : null;

        // Build datetime range for created_at queries
        $dtInicio = $dataInicio . ' ' . ($horaInicio ? $horaInicio . ':00' : '00:00:00');
        $dtFim    = $dataFim    . ' ' . ($horaFim    ? $horaFim    . ':59' : '23:59:59');

        // Escola filter snippets
        $escolaPacFilter = $escolaParam ? ' AND p.escola = :escola_p' : '';
        $escolaAhFilter  = $escolaParam ? ' AND escola = :escola_ah' : '';
        $escolaEncFilter = $escolaParam ? ' AND ah.escola = :escola_enc' : '';

        // Total matriculados (sempre global dentro do tenant, independente de escola)
        $stmtTotMat = $db->prepare('SELECT COUNT(*) FROM pacientes WHERE tenant_id = :tid');
        $stmtTotMat->execute([':tid' => $tenantId]);
        $totalMatriculados = (int) $stmtTotMat->fetchColumn();

        // Pacientes do período (escolas agendadas no intervalo)
        $diaParams = [':tid' => $tenantId, ':di' => $dataInicio, ':df' => $dataFim];
        if ($escolaParam) $diaParams[':escola_p'] = $escolaParam;
        $stmtDia = $db->prepare(
            "SELECT COUNT(DISTINCT p.id) FROM pacientes p
             INNER JOIN escola_agenda ea ON ea.escola = p.escola AND ea.tenant_id = p.tenant_id
             WHERE p.tenant_id = :tid AND ea.data_atendimento BETWEEN :di AND :df{$escolaPacFilter}"
        );
        $stmtDia->execute($diaParams);
        $pacientesDoDia = (int) $stmtDia->fetchColumn();

        // Escolas agendadas no período
        $escHojeParams = [':tid' => $tenantId, ':di' => $dataInicio, ':df' => $dataFim];
        $escHojeFilter = '';
        if ($escolaParam) {
            $escHojeFilter = ' AND ea.escola = :escola_esc';
            $escHojeParams[':escola_esc'] = $escolaParam;
        }
        $stmtEscHoje = $db->prepare(
            "SELECT ea.escola, COUNT(DISTINCT p.id) as total
             FROM escola_agenda ea
             LEFT JOIN pacientes p ON p.escola = ea.escola AND p.tenant_id = ea.tenant_id
             WHERE ea.tenant_id = :tid AND ea.data_atendimento BETWEEN :di AND :df{$escHojeFilter}
             GROUP BY ea.escola
             ORDER BY ea.escola"
        );
        $stmtEscHoje->execute($escHojeParams);
        $escolasHoje = $stmtEscHoje->fetchAll();

        // Atendimentos no período (usando atendimentos_historico)
        $medicoId = isset($_GET['medico_id']) ? (int) $_GET['medico_id'] : null;
        $ahWhere = "tenant_id = :tid AND data_atendimento BETWEEN :di AND :df";
        $ahParams = [':tid' => $tenantId, ':di' => $dataInicio, ':df' => $dataFim];
        if ($horaInicio) { $ahWhere .= " AND hora_entrada >= :hi"; $ahParams[':hi'] = $horaInicio; }
        if ($horaFim)    { $ahWhere .= " AND hora_entrada <= :hf"; $ahParams[':hf'] = $horaFim; }
        if ($medicoId)   { $ahWhere .= " AND (medico_id = :mid OR medico_refracao_id = :mid2)"; $ahParams[':mid'] = $medicoId; $ahParams[':mid2'] = $medicoId; }
        if ($escolaParam){ $ahWhere .= $escolaAhFilter; $ahParams[':escola_ah'] = $escolaParam; }

        $stmt = $db->prepare("SELECT COUNT(*) FROM atendimentos_historico WHERE {$ahWhere}");
        $stmt->execute($ahParams);
        $atendimentosHoje = (int) $stmt->fetchColumn();

        // Pacientes na fila agora (inclui multi-dia: entradas de dia anterior se escola agendada hoje)
        $naFilaFilter = $escolaParam ? " AND p.escola = :escola_fila" : '';
        $naFilaParams = [':tid' => $tenantId];
        if ($escolaParam) $naFilaParams[':escola_fila'] = $escolaParam;
        $stmtNaFila = $db->prepare(
            "SELECT COUNT(*) FROM fila f
             JOIN pacientes p ON p.id = f.paciente_id
             WHERE f.tenant_id = :tid AND f.status != 'concluido' AND f.estacao NOT IN ('altas', 'encaminhamentos')
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
               ){$naFilaFilter}"
        );
        $stmtNaFila->execute($naFilaParams);
        $naFila = (int) $stmtNaFila->fetchColumn();

        // Total exames no período
        $exParams = [':tid' => $tenantId, ':dti' => $dtInicio, ':dtf' => $dtFim];
        $exFilter = '';
        if ($escolaParam) {
            $exFilter = " AND paciente_id IN (SELECT id FROM pacientes WHERE escola = :escola_ex AND tenant_id = :tid2)";
            $exParams[':escola_ex'] = $escolaParam;
            $exParams[':tid2'] = $tenantId;
        }
        $stmtEx = $db->prepare("SELECT COUNT(*) FROM exames WHERE tenant_id = :tid AND created_at BETWEEN :dti AND :dtf{$exFilter}");
        $stmtEx->execute($exParams);
        $totalExames = (int) $stmtEx->fetchColumn();

        // Total prescrições (óculos) no período — da atendimentos_historico
        $stmt = $db->prepare("SELECT COUNT(*) FROM atendimentos_historico WHERE resultado IN ('oculos','oculos_encaminhamento') AND {$ahWhere}");
        $stmt->execute($ahParams);
        $totalPrescricoes = (int) $stmt->fetchColumn();

        // Total laudos no período
        $laParams = [':tid' => $tenantId, ':dti' => $dtInicio, ':dtf' => $dtFim];
        $laFilter = '';
        if ($medicoId) { $laFilter .= ' AND medico_id = :mid'; $laParams[':mid'] = $medicoId; }
        if ($escolaParam) {
            $laFilter .= " AND paciente_id IN (SELECT id FROM pacientes WHERE escola = :escola_la AND tenant_id = :tid2)";
            $laParams[':escola_la'] = $escolaParam;
            $laParams[':tid2'] = $tenantId;
        }
        $stmtLa = $db->prepare("SELECT COUNT(*) FROM laudos WHERE tenant_id = :tid AND created_at BETWEEN :dti AND :dtf{$laFilter}");
        $stmtLa->execute($laParams);
        $totalLaudos = (int) $stmtLa->fetchColumn();

        // Total altas no período (só alta pura, sem óculos)
        $stmt = $db->prepare("SELECT COUNT(*) FROM atendimentos_historico WHERE resultado = 'alta' AND {$ahWhere}");
        $stmt->execute($ahParams);
        $totalAltas = (int) $stmt->fetchColumn();

        // Condutas iniciais no período
        $condParams = [':tid' => $tenantId, ':dti' => $dtInicio, ':dtf' => $dtFim];
        $condFilter = '';
        if ($escolaParam) {
            $condFilter = " AND paciente_id IN (SELECT id FROM pacientes WHERE escola = :escola_cond AND tenant_id = :tid2)";
            $condParams[':escola_cond'] = $escolaParam;
            $condParams[':tid2'] = $tenantId;
        }
        $stmt = $db->prepare(
            "SELECT conduta_inicial, COUNT(*) as total FROM laudos
             WHERE tenant_id = :tid AND conduta_inicial IS NOT NULL AND created_at BETWEEN :dti AND :dtf{$condFilter}
             GROUP BY conduta_inicial"
        );
        $stmt->execute($condParams);
        $condutasIniciais = [];
        foreach ($stmt->fetchAll() as $row) {
            $condutasIniciais[] = ['name' => $row['conduta_inicial'], 'value' => (int) $row['total']];
        }

        // Condutas finais no período
        $stmt = $db->prepare(
            "SELECT conduta_final, COUNT(*) as total FROM laudos
             WHERE tenant_id = :tid AND conduta_final IS NOT NULL AND created_at BETWEEN :dti AND :dtf{$condFilter}
             GROUP BY conduta_final"
        );
        $stmt->execute($condParams);
        $condutasFinais = [];
        foreach ($stmt->fetchAll() as $row) {
            $condutasFinais[] = ['name' => $row['conduta_final'], 'value' => (int) $row['total']];
        }

        // Atendimentos por dia no período (usando atendimentos_historico)
        $porDiaParams = [':tid' => $tenantId, ':di' => $dataInicio, ':df' => $dataFim];
        $porDiaExtra = '';
        if ($horaInicio) { $porDiaExtra .= " AND hora_entrada >= :hi"; $porDiaParams[':hi'] = $horaInicio; }
        if ($horaFim)    { $porDiaExtra .= " AND hora_entrada <= :hf"; $porDiaParams[':hf'] = $horaFim; }
        if ($escolaParam){ $porDiaExtra .= $escolaAhFilter; $porDiaParams[':escola_ah'] = $escolaParam; }
        $stmt = $db->prepare(
            "SELECT data_atendimento as dia, COUNT(*) as total
             FROM atendimentos_historico
             WHERE tenant_id = :tid AND data_atendimento BETWEEN :di AND :df {$porDiaExtra}
             GROUP BY data_atendimento
             ORDER BY dia ASC"
        );
        $stmt->execute($porDiaParams);
        $porDia = [];
        foreach ($stmt->fetchAll() as $row) {
            // Format date as dd/MM for chart display
            $label = date('d/M', strtotime($row['dia']));
            $porDia[] = ['name' => $label, 'value' => (int) $row['total']];
        }

        // Fila por estação (sempre atual, sem filtro de data)
        $filaEstParams = [':tid' => $tenantId];
        $filaEstJoin = '';
        $filaEstFilter = '';
        if ($escolaParam) {
            $filaEstJoin = ' JOIN pacientes p ON p.id = f.paciente_id';
            $filaEstFilter = " AND p.escola = :escola_fest";
            $filaEstParams[':escola_fest'] = $escolaParam;
        }
        $stmtFest = $db->prepare(
            "SELECT f.estacao, f.status, COUNT(*) as total
             FROM fila f{$filaEstJoin}
             WHERE f.tenant_id = :tid AND f.status != 'concluido' AND f.estacao NOT IN ('altas', 'encaminhamentos'){$filaEstFilter}
             GROUP BY f.estacao, f.status"
        );
        $stmtFest->execute($filaEstParams);
        $filaPorEstacao = [];
        foreach ($stmtFest->fetchAll() as $row) {
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
        $encWhereParams = [':tid' => $tenantId, ':di' => $dataInicio, ':df' => $dataFim];
        $encWhereExtra = '';
        if ($horaInicio) { $encWhereExtra .= " AND ah.hora_entrada >= :hi"; $encWhereParams[':hi'] = $horaInicio; }
        if ($horaFim)    { $encWhereExtra .= " AND ah.hora_entrada <= :hf"; $encWhereParams[':hf'] = $horaFim; }
        if ($escolaParam){ $encWhereExtra .= $escolaEncFilter; $encWhereParams[':escola_enc'] = $escolaParam; }
        $stmtEnc = $db->prepare(
            "SELECT ah.paciente_id, p.nome_completo, ah.escola, ah.diagnostico, ah.conduta_inicial, ah.conduta_final, ah.observacoes, ah.created_at
             FROM atendimentos_historico ah
             INNER JOIN pacientes p ON p.id = ah.paciente_id
             WHERE ah.tenant_id = :tid AND ah.data_atendimento BETWEEN :di AND :df {$encWhereExtra}
               AND ah.resultado IN ('encaminhamento','oculos_encaminhamento')
             ORDER BY ah.created_at DESC"
        );
        $stmtEnc->execute($encWhereParams);
        $encaminhamentos = $stmtEnc->fetchAll(PDO::FETCH_ASSOC);

        // Encaminhamentos por tipo (resultado) no período
        $stmt = $db->prepare(
            "SELECT resultado as name, COUNT(*) as total FROM atendimentos_historico
             WHERE {$ahWhere}
             GROUP BY resultado"
        );
        $stmt->execute($ahParams);
        $encaminhamentosTipo = [];
        $labelMap = [
            'alta' => 'Alta',
            'oculos' => 'Óculos',
            'encaminhamento' => 'Encaminhamento',
            'oculos_encaminhamento' => 'Óc. + Encam.',
        ];
        foreach ($stmt->fetchAll() as $row) {
            $encaminhamentosTipo[] = [
                'name' => $labelMap[$row['name']] ?? $row['name'],
                'value' => (int) $row['total'],
            ];
        }

        // Próximas escolas agendadas (a partir de hoje, máx 15)
        $hoje = date('Y-m-d');
        $agendaParams = [':tid' => $tenantId, ':hoje' => $hoje];
        $agendaFilter = '';
        if ($escolaParam) {
            $agendaFilter = ' AND ea.escola = :escola_agenda';
            $agendaParams[':escola_agenda'] = $escolaParam;
        }
        $stmtAgenda = $db->prepare(
            "SELECT ea.escola, ea.data_atendimento, COUNT(p.id) as total_alunos
             FROM escola_agenda ea
             LEFT JOIN pacientes p ON p.escola = ea.escola AND p.tenant_id = ea.tenant_id
             WHERE ea.tenant_id = :tid AND ea.data_atendimento >= :hoje{$agendaFilter}
             GROUP BY ea.escola, ea.data_atendimento
             ORDER BY ea.data_atendimento ASC, ea.escola ASC
             LIMIT 15"
        );
        $stmtAgenda->execute($agendaParams);
        $escolasAgendadas = $stmtAgenda->fetchAll();

        echo json_encode([
            'total_matriculados' => $totalMatriculados,
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
            'encaminhamentos_tipo' => $encaminhamentosTipo,
        ]);
    }
}
