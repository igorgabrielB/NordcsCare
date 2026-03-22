<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';

class DashboardController {

    public static function metricas(): void {
        Auth::requireAuth();
        $db = Database::getInstance();

        // Total pacientes
        $totalPacientes = (int) $db->query('SELECT COUNT(*) FROM pacientes')->fetchColumn();

        // Atendimentos hoje
        $hoje = date('Y-m-d');
        $atendimentosHoje = (int) $db->prepare(
            'SELECT COUNT(*) FROM laudos WHERE DATE(created_at) = :hoje'
        )->execute([':hoje' => $hoje]) ? $db->prepare(
            'SELECT COUNT(*) FROM laudos WHERE DATE(created_at) = :hoje'
        ) : 0;
        $stmt = $db->prepare('SELECT COUNT(*) FROM laudos WHERE DATE(created_at) = :hoje');
        $stmt->execute([':hoje' => $hoje]);
        $atendimentosHoje = (int) $stmt->fetchColumn();

        // Pacientes na fila agora (não concluídos e não de alta/encaminhamento)
        $naFila = (int) $db->query("SELECT COUNT(*) FROM fila WHERE status != 'concluido' AND estacao NOT IN ('altas', 'encaminhamentos')")->fetchColumn();

        // Total exames
        $totalExames = (int) $db->query('SELECT COUNT(*) FROM exames')->fetchColumn();

        // Total prescrições
        $totalPrescricoes = (int) $db->query('SELECT COUNT(*) FROM prescricoes')->fetchColumn();

        // Total laudos
        $totalLaudos = (int) $db->query('SELECT COUNT(*) FROM laudos')->fetchColumn();

        // Condutas iniciais (distribuição)
        $stmt = $db->query(
            "SELECT conduta_inicial, COUNT(*) as total FROM laudos
             WHERE conduta_inicial IS NOT NULL
             GROUP BY conduta_inicial"
        );
        $condutasIniciais = [];
        foreach ($stmt->fetchAll() as $row) {
            $condutasIniciais[$row['conduta_inicial']] = (int) $row['total'];
        }

        // Condutas finais (distribuição)
        $stmt = $db->query(
            "SELECT conduta_final, COUNT(*) as total FROM laudos
             WHERE conduta_final IS NOT NULL
             GROUP BY conduta_final"
        );
        $condutasFinais = [];
        foreach ($stmt->fetchAll() as $row) {
            $condutasFinais[$row['conduta_final']] = (int) $row['total'];
        }

        // Atendimentos por dia (últimos 7 dias)
        $stmt = $db->query(
            "SELECT DATE(created_at) as dia, COUNT(*) as total
             FROM laudos
             WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
             GROUP BY DATE(created_at)
             ORDER BY dia ASC"
        );
        $porDia = [];
        foreach ($stmt->fetchAll() as $row) {
            $porDia[] = ['dia' => $row['dia'], 'total' => (int) $row['total']];
        }

        // Fila por estação (excluindo altas e encaminhamentos)
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

        echo json_encode([
            'total_pacientes' => $totalPacientes,
            'atendimentos_hoje' => $atendimentosHoje,
            'na_fila' => $naFila,
            'total_exames' => $totalExames,
            'total_prescricoes' => $totalPrescricoes,
            'total_laudos' => $totalLaudos,
            'condutas_iniciais' => $condutasIniciais,
            'condutas_finais' => $condutasFinais,
            'atendimentos_por_dia' => $porDia,
            'fila_por_estacao' => $filaPorEstacao,
        ]);
    }
}
