<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../middleware/tenant.php';

class HistoricoController {

    /**
     * GET /api/historico — Lista histórico de atendimentos com filtros.
     * Query params: data_inicio, data_fim, escola, resultado, paciente_id, page, limit
     */
    public static function index(): void {
        Auth::requireAuth();

        $db = Database::getInstance();

        $page = max(1, (int)($_GET['page'] ?? 1));
        $limit = min(10000, max(1, (int)($_GET['limit'] ?? 50)));
        $offset = ($page - 1) * $limit;

        $where = 'h.tenant_id = :tid';
        $params = [':tid' => Tenant::id()];

        if (!empty($_GET['data_inicio'])) {
            $where .= ' AND h.data_atendimento >= :di';
            $params[':di'] = $_GET['data_inicio'];
        }
        if (!empty($_GET['data_fim'])) {
            $where .= ' AND h.data_atendimento <= :df';
            $params[':df'] = $_GET['data_fim'];
        }
        if (!empty($_GET['escola'])) {
            $where .= ' AND h.escola = :escola';
            $params[':escola'] = $_GET['escola'];
        }
        if (!empty($_GET['resultado'])) {
            $where .= ' AND h.resultado = :resultado';
            $params[':resultado'] = $_GET['resultado'];
        }
        if (!empty($_GET['paciente_id'])) {
            $where .= ' AND h.paciente_id = :pid';
            $params[':pid'] = (int)$_GET['paciente_id'];
        }
        if (!empty($_GET['medico_id'])) {
            $where .= ' AND (h.medico_id = :mid OR h.medico_refracao_id = :mid2)';
            $params[':mid'] = (int)$_GET['medico_id'];
            $params[':mid2'] = (int)$_GET['medico_id'];
        }

        // Contagem total
        $stmtCount = $db->prepare("SELECT COUNT(*) FROM atendimentos_historico h WHERE {$where}");
        $stmtCount->execute($params);
        $total = (int)$stmtCount->fetchColumn();

        // Buscar registros com dados do paciente
        $sql = "SELECT h.*, p.nome_completo, p.cpf, p.codigo, p.sexo, p.data_nascimento
                FROM atendimentos_historico h
                JOIN pacientes p ON p.id = h.paciente_id
                WHERE {$where}
                ORDER BY h.data_atendimento DESC, h.hora_saida DESC
                LIMIT {$limit} OFFSET {$offset}";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $items = $stmt->fetchAll();

        echo json_encode([
            'data' => $items,
            'total' => $total,
            'page' => $page,
            'limit' => $limit,
            'pages' => ceil($total / $limit),
        ]);
    }

    /**
     * GET /api/historico/resumo — Resumo estatístico para relatórios.
     * Query params: data_inicio, data_fim, escola
     */
    public static function resumo(): void {
        Auth::requireAuth();

        $db = Database::getInstance();

        $where = 'tenant_id = :tid';
        $params = [':tid' => Tenant::id()];

        if (!empty($_GET['data_inicio'])) {
            $where .= ' AND data_atendimento >= :di';
            $params[':di'] = $_GET['data_inicio'];
        }
        if (!empty($_GET['data_fim'])) {
            $where .= ' AND data_atendimento <= :df';
            $params[':df'] = $_GET['data_fim'];
        }
        if (!empty($_GET['escola'])) {
            $where .= ' AND escola = :escola';
            $params[':escola'] = $_GET['escola'];
        }

        // Total de atendimentos
        $stmt = $db->prepare("SELECT COUNT(*) FROM atendimentos_historico WHERE {$where}");
        $stmt->execute($params);
        $totalAtendimentos = (int)$stmt->fetchColumn();

        // Distribuição por resultado
        $stmt = $db->prepare("SELECT resultado, COUNT(*) as total FROM atendimentos_historico WHERE {$where} GROUP BY resultado ORDER BY total DESC");
        $stmt->execute($params);
        $porResultado = $stmt->fetchAll();

        // Distribuição por escola
        $stmt = $db->prepare("SELECT escola, COUNT(*) as total FROM atendimentos_historico WHERE {$where} AND escola IS NOT NULL GROUP BY escola ORDER BY total DESC");
        $stmt->execute($params);
        $porEscola = $stmt->fetchAll();

        // Atendimentos por dia
        $stmt = $db->prepare("SELECT data_atendimento, COUNT(*) as total FROM atendimentos_historico WHERE {$where} GROUP BY data_atendimento ORDER BY data_atendimento ASC");
        $stmt->execute($params);
        $porDia = $stmt->fetchAll();

        // Tempo médio de atendimento (entrada ? saída)
        $stmt = $db->prepare("SELECT AVG(TIMESTAMPDIFF(MINUTE, CONCAT(data_atendimento, ' ', hora_entrada), CONCAT(data_atendimento, ' ', hora_saida))) as media_minutos FROM atendimentos_historico WHERE {$where} AND hora_saida IS NOT NULL");
        $stmt->execute($params);
        $mediaMinutos = $stmt->fetchColumn();

        // Atendimentos por médico (inclui médicos da refração)
        // Query 1: médicos do laudo
        $stmt = $db->prepare("SELECT medico_nome, COUNT(*) as total FROM atendimentos_historico WHERE {$where} AND medico_nome IS NOT NULL GROUP BY medico_nome ORDER BY total DESC");
        $stmt->execute($params);
        $laudoRows = $stmt->fetchAll();

        // Query 2: médicos da refração (apenas quando diferente do médico do laudo)
        $stmt = $db->prepare("SELECT medico_refracao_nome as medico_nome, COUNT(*) as total FROM atendimentos_historico WHERE {$where} AND medico_refracao_nome IS NOT NULL AND medico_refracao_nome != COALESCE(medico_nome, '') GROUP BY medico_refracao_nome ORDER BY total DESC");
        $stmt->execute($params);
        $refracaoRows = $stmt->fetchAll();

        // Merge counts per medico
        $medicoTotals = [];
        foreach ($laudoRows as $row) {
            $nome = $row['medico_nome'];
            if (!isset($medicoTotals[$nome])) $medicoTotals[$nome] = 0;
            $medicoTotals[$nome] += (int)$row['total'];
        }
        foreach ($refracaoRows as $row) {
            $nome = $row['medico_nome'];
            if (!isset($medicoTotals[$nome])) $medicoTotals[$nome] = 0;
            $medicoTotals[$nome] += (int)$row['total'];
        }
        arsort($medicoTotals);
        $porMedico = [];
        foreach ($medicoTotals as $nome => $total) {
            $porMedico[] = ['medico_nome' => $nome, 'total' => $total];
        }

        echo json_encode([
            'total_atendimentos' => $totalAtendimentos,
            'por_resultado' => $porResultado,
            'por_escola' => $porEscola,
            'por_dia' => $porDia,
            'media_minutos' => $mediaMinutos ? round((float)$mediaMinutos) : null,
            'por_medico' => $porMedico,
        ]);
    }

    /**
     * GET /api/historico/escolas — Lista escolas com atendimentos para filtros.
     */
    public static function escolas(): void {
        Auth::requireAuth();

        $db = Database::getInstance();
        $stmt = $db->prepare("SELECT DISTINCT escola FROM atendimentos_historico WHERE tenant_id = :tid AND escola IS NOT NULL ORDER BY escola ASC");
        $stmt->execute([':tid' => Tenant::id()]);
        $escolas = array_column($stmt->fetchAll(), 'escola');

        echo json_encode($escolas);
    }

    /**
     * GET /api/historico/exportar — Exporta dados como CSV.
     * Query params: data_inicio, data_fim, escola, resultado
     */
    public static function exportar(): void {
        Auth::requireTela('relatorios_atendimentos');

        $db = Database::getInstance();

        $where = 'h.tenant_id = :tid';
        $params = [':tid' => Tenant::id()];

        if (!empty($_GET['data_inicio'])) {
            $where .= ' AND h.data_atendimento >= :di';
            $params[':di'] = $_GET['data_inicio'];
        }
        if (!empty($_GET['data_fim'])) {
            $where .= ' AND h.data_atendimento <= :df';
            $params[':df'] = $_GET['data_fim'];
        }
        if (!empty($_GET['escola'])) {
            $where .= ' AND h.escola = :escola';
            $params[':escola'] = $_GET['escola'];
        }
        if (!empty($_GET['resultado'])) {
            $where .= ' AND h.resultado = :resultado';
            $params[':resultado'] = $_GET['resultado'];
        }

        $sql = "SELECT h.data_atendimento, h.hora_entrada, h.hora_saida, p.nome_completo, p.cpf, p.sexo, p.data_nascimento, h.escola, h.resultado, h.diagnostico, h.especialidade, h.conduta_inicial, h.conduta_final
                FROM atendimentos_historico h
                JOIN pacientes p ON p.id = h.paciente_id
                WHERE {$where}
                ORDER BY h.data_atendimento ASC, h.hora_entrada ASC";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $items = $stmt->fetchAll();

        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="relatorio_atendimentos.csv"');

        $output = fopen('php://output', 'w');
        // BOM para Excel reconhecer UTF-8
        fprintf($output, chr(0xEF) . chr(0xBB) . chr(0xBF));
        fputcsv($output, ['Data', 'Paciente', 'Sexo', 'Data Nasc.', 'CPF', 'Desfecho', 'Especialidade'], ';');

        $sexoLabel = ['M' => 'Masculino', 'F' => 'Feminino', 'Outro' => 'Outro'];
        $resultadoLabel = ['alta' => 'Alta', 'encaminhamento' => 'Encaminhamento', 'oculos' => 'Óculos (Alta)', 'oculos_encaminhamento' => 'Óculos (Encaminhamento)'];
        foreach ($items as $row) {
            fputcsv($output, [
                date('d/m/Y', strtotime($row['data_atendimento'])),
                $row['nome_completo'],
                $sexoLabel[$row['sexo']] ?? $row['sexo'] ?? '',
                $row['data_nascimento'] ? date('d/m/Y', strtotime($row['data_nascimento'])) : '',
                $row['cpf'],
                $resultadoLabel[$row['resultado']] ?? $row['resultado'],
                $row['especialidade'],
            ], ';');
        }

        fclose($output);
        exit;
    }
}
