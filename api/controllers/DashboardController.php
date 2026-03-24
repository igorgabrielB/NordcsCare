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

        // Atendimentos no período
        $medicoId = isset($_GET['medico_id']) ? (int) $_GET['medico_id'] : null;
        if ($medicoId) {
            $stmt = $db->prepare('SELECT COUNT(*) FROM laudos WHERE DATE(created_at) BETWEEN :di AND :df AND medico_id = :mid');
            $stmt->execute([':di' => $dataInicio, ':df' => $dataFim, ':mid' => $medicoId]);
        } else {
            $stmt = $db->prepare('SELECT COUNT(*) FROM laudos WHERE DATE(created_at) BETWEEN :di AND :df');
            $stmt->execute([':di' => $dataInicio, ':df' => $dataFim]);
        }
        $atendimentosHoje = (int) $stmt->fetchColumn();

        // Pacientes na fila agora (não concluídos e não de alta/encaminhamento, somente hoje)
        $naFila = (int) $db->query("SELECT COUNT(*) FROM fila WHERE DATE(created_at) = CURDATE() AND status != 'concluido' AND estacao NOT IN ('altas', 'encaminhamentos')")->fetchColumn();

        // Total exames no período
        $stmtEx = $db->prepare('SELECT COUNT(*) FROM exames WHERE DATE(created_at) BETWEEN :di AND :df');
        $stmtEx->execute([':di' => $dataInicio, ':df' => $dataFim]);
        $totalExames = (int) $stmtEx->fetchColumn();

        // Total prescrições no período
        $stmtPr = $db->prepare('SELECT COUNT(*) FROM prescricoes WHERE DATE(created_at) BETWEEN :di AND :df');
        $stmtPr->execute([':di' => $dataInicio, ':df' => $dataFim]);
        $totalPrescricoes = (int) $stmtPr->fetchColumn();

        // Total laudos no período
        if ($medicoId) {
            $stmtLa = $db->prepare('SELECT COUNT(*) FROM laudos WHERE DATE(created_at) BETWEEN :di AND :df AND medico_id = :mid');
            $stmtLa->execute([':di' => $dataInicio, ':df' => $dataFim, ':mid' => $medicoId]);
        } else {
            $stmtLa = $db->prepare('SELECT COUNT(*) FROM laudos WHERE DATE(created_at) BETWEEN :di AND :df');
            $stmtLa->execute([':di' => $dataInicio, ':df' => $dataFim]);
        }
        $totalLaudos = (int) $stmtLa->fetchColumn();

        // Total altas no período (pacientes que foram para estação altas)
        $stmtAltas = $db->prepare(
            "SELECT COUNT(*) FROM fila WHERE estacao = 'altas' AND DATE(created_at) BETWEEN :di AND :df"
        );
        $stmtAltas->execute([':di' => $dataInicio, ':df' => $dataFim]);
        $totalAltas = (int) $stmtAltas->fetchColumn();

        // Condutas iniciais no período
        $stmt = $db->prepare(
            "SELECT conduta_inicial, COUNT(*) as total FROM laudos
             WHERE conduta_inicial IS NOT NULL AND DATE(created_at) BETWEEN :di AND :df
             GROUP BY conduta_inicial"
        );
        $stmt->execute([':di' => $dataInicio, ':df' => $dataFim]);
        $condutasIniciais = [];
        foreach ($stmt->fetchAll() as $row) {
            $condutasIniciais[$row['conduta_inicial']] = (int) $row['total'];
        }

        // Condutas finais no período
        $stmt = $db->prepare(
            "SELECT conduta_final, COUNT(*) as total FROM laudos
             WHERE conduta_final IS NOT NULL AND DATE(created_at) BETWEEN :di AND :df
             GROUP BY conduta_final"
        );
        $stmt->execute([':di' => $dataInicio, ':df' => $dataFim]);
        $condutasFinais = [];
        foreach ($stmt->fetchAll() as $row) {
            $condutasFinais[$row['conduta_final']] = (int) $row['total'];
        }

        // Atendimentos por dia no período
        $stmt = $db->prepare(
            "SELECT DATE(created_at) as dia, COUNT(*) as total
             FROM laudos
             WHERE DATE(created_at) BETWEEN :di AND :df
             GROUP BY DATE(created_at)
             ORDER BY dia ASC"
        );
        $stmt->execute([':di' => $dataInicio, ':df' => $dataFim]);
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

        // Encaminhamentos no período
        $stmtEnc = $db->prepare(
            "SELECT l.paciente_id, p.nome_completo, p.escola, l.diagnostico, l.conduta_inicial, l.conduta_final, l.observacoes, l.created_at
             FROM laudos l
             INNER JOIN pacientes p ON p.id = l.paciente_id
             WHERE DATE(l.created_at) BETWEEN :di AND :df
               AND (l.conduta_inicial IN ('encaminhamento','onibus_encaminhamento') OR l.conduta_final = 'encaminhamento')
             ORDER BY l.created_at DESC"
        );
        $stmtEnc->execute([':di' => $dataInicio, ':df' => $dataFim]);
        $encaminhamentos = $stmtEnc->fetchAll(PDO::FETCH_ASSOC);
        $totalEncaminhamentos = count($encaminhamentos);

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
