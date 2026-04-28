<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';

class DashboardConfigController {

    /**
     * GET /api/dashboard-config
     * Retorna a configuração do dashboard do usuário (ou padrão do tenant)
     */
    public static function get(): void {
        $user = Auth::requireAuth();
        $db = Database::getInstance();
        $tenantId = Tenant::id();

        // Primeiro tenta buscar config do usuário
        $stmt = $db->prepare("
            SELECT id, nome, layout, is_default, updated_at 
            FROM dashboard_config 
            WHERE tenant_id = :tid AND usuario_id = :uid
            LIMIT 1
        ");
        $stmt->execute([':tid' => $tenantId, ':uid' => $user['sub']]);
        $config = $stmt->fetch(PDO::FETCH_ASSOC);

        // Se não tiver, busca o padrão do tenant
        if (!$config) {
            $stmt = $db->prepare("
                SELECT id, nome, layout, is_default, updated_at 
                FROM dashboard_config 
                WHERE tenant_id = :tid AND usuario_id IS NULL AND is_default = 1
                LIMIT 1
            ");
            $stmt->execute([':tid' => $tenantId]);
            $config = $stmt->fetch(PDO::FETCH_ASSOC);
        }

        // Se ainda não tiver, retorna layout padrão
        if (!$config) {
            $config = [
                'id' => null,
                'nome' => 'Dashboard Padrão',
                'layout' => self::getDefaultLayout(),
                'is_default' => true,
                'updated_at' => null
            ];
        } else {
            $config['layout'] = json_decode($config['layout'], true);
        }

        echo json_encode($config);
    }

    /**
     * POST /api/dashboard-config
     * Salva a configuração do dashboard do usuário
     */
    public static function save(): void {
        $user = Auth::requireTela('dashboard_builder');
        $db = Database::getInstance();
        $tenantId = Tenant::id();

        $input = json_decode(file_get_contents('php://input'), true);
        
        if (empty($input['layout']) || !isset($input['layout']['widgets'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Layout inválido']);
            return;
        }

        $nome = trim($input['nome'] ?? 'Meu Dashboard');
        $layout = json_encode($input['layout']);
        $saveForTenant = !empty($input['save_for_tenant']); // Admin pode salvar como padrão do tenant

        // Verifica se já existe config do usuário
        $stmt = $db->prepare("SELECT id FROM dashboard_config WHERE tenant_id = :tid AND usuario_id = :uid");
        $stmt->execute([':tid' => $tenantId, ':uid' => $user['sub']]);
        $existing = $stmt->fetch();

        if ($saveForTenant && Auth::hasTela($user, 'dashboard_builder')) {
            // Salvar como padrão do tenant (sobrescreve o existente)
            $stmt = $db->prepare("SELECT id FROM dashboard_config WHERE tenant_id = :tid AND usuario_id IS NULL AND is_default = 1");
            $stmt->execute([':tid' => $tenantId]);
            $existingDefault = $stmt->fetch();

            if ($existingDefault) {
                $stmt = $db->prepare("UPDATE dashboard_config SET nome = :nome, layout = :layout WHERE id = :id");
                $stmt->execute([':nome' => $nome, ':layout' => $layout, ':id' => $existingDefault['id']]);
            } else {
                $stmt = $db->prepare("INSERT INTO dashboard_config (tenant_id, usuario_id, nome, layout, is_default) VALUES (:tid, NULL, :nome, :layout, 1)");
                $stmt->execute([':tid' => $tenantId, ':nome' => $nome, ':layout' => $layout]);
            }
            echo json_encode(['success' => true, 'message' => 'Dashboard padrão salvo para a clínica']);
        } else {
            // Salvar para o usuário
            if ($existing) {
                $stmt = $db->prepare("UPDATE dashboard_config SET nome = :nome, layout = :layout WHERE id = :id");
                $stmt->execute([':nome' => $nome, ':layout' => $layout, ':id' => $existing['id']]);
            } else {
                $stmt = $db->prepare("INSERT INTO dashboard_config (tenant_id, usuario_id, nome, layout, is_default) VALUES (:tid, :uid, :nome, :layout, 0)");
                $stmt->execute([':tid' => $tenantId, ':uid' => $user['sub'], ':nome' => $nome, ':layout' => $layout]);
            }
            echo json_encode(['success' => true, 'message' => 'Dashboard salvo']);
        }
    }

    /**
     * DELETE /api/dashboard-config
     * Reseta o dashboard do usuário para o padrão
     */
    public static function reset(): void {
        $user = Auth::requireTela('dashboard_builder');
        $db = Database::getInstance();
        $tenantId = Tenant::id();

        $stmt = $db->prepare("DELETE FROM dashboard_config WHERE tenant_id = :tid AND usuario_id = :uid");
        $stmt->execute([':tid' => $tenantId, ':uid' => $user['sub']]);

        echo json_encode(['success' => true, 'message' => 'Dashboard resetado para o padrão']);
    }

    /**
     * GET /api/dashboard-config/widgets
     * Retorna lista de widgets disponíveis
     */
    public static function getWidgets(): void {
        Auth::requireTela('dashboard_builder');

        $widgets = [
            // Métricas
            ['type' => 'metric', 'name' => 'Total Matriculados', 'icon' => 'Users', 'category' => 'Métricas',
             'defaultConfig' => ['metric' => 'total_matriculados', 'title' => 'Total Matriculados', 'icon' => 'Users', 'color' => '#63b3ed']],
            ['type' => 'metric', 'name' => 'Pacientes do Dia', 'icon' => 'School', 'category' => 'Métricas',
             'defaultConfig' => ['metric' => 'pacientes_do_dia', 'title' => 'Pacientes do Dia', 'icon' => 'School', 'color' => '#48bb78']],
            ['type' => 'metric', 'name' => 'Na Fila', 'icon' => 'ClipboardList', 'category' => 'Métricas',
             'defaultConfig' => ['metric' => 'na_fila', 'title' => 'Na Fila', 'icon' => 'ClipboardList', 'color' => '#ecc94b']],
            ['type' => 'metric', 'name' => 'Atendimentos Hoje', 'icon' => 'Stethoscope', 'category' => 'Métricas',
             'defaultConfig' => ['metric' => 'atendimentos_hoje', 'title' => 'Atendimentos', 'icon' => 'Stethoscope', 'color' => '#68d391']],
            ['type' => 'metric', 'name' => 'Total Altas', 'icon' => 'CheckCircle', 'category' => 'Métricas',
             'defaultConfig' => ['metric' => 'total_altas', 'title' => 'Altas', 'icon' => 'CheckCircle', 'color' => '#38a169']],
            ['type' => 'metric', 'name' => 'Total Óculos', 'icon' => 'Glasses', 'category' => 'Métricas',
             'defaultConfig' => ['metric' => 'total_prescricoes', 'title' => 'Óculos', 'icon' => 'Glasses', 'color' => '#fc8181']],
            ['type' => 'metric', 'name' => 'Encaminhamentos', 'icon' => 'ArrowRightLeft', 'category' => 'Métricas',
             'defaultConfig' => ['metric' => 'total_encaminhamentos', 'title' => 'Encaminhamentos', 'icon' => 'ArrowRightLeft', 'color' => '#ecc94b']],
            ['type' => 'metric', 'name' => 'Total Exames', 'icon' => 'Eye', 'category' => 'Métricas',
             'defaultConfig' => ['metric' => 'total_exames', 'title' => 'Exames', 'icon' => 'Eye', 'color' => '#9f7aea']],
            ['type' => 'metric', 'name' => 'Total Laudos', 'icon' => 'FileText', 'category' => 'Métricas',
             'defaultConfig' => ['metric' => 'total_laudos', 'title' => 'Laudos', 'icon' => 'FileText', 'color' => '#4fd1c5']],
             
            // Listas
            ['type' => 'schools-today', 'name' => 'Escolas do Dia', 'icon' => 'School', 'category' => 'Listas',
             'defaultConfig' => ['title' => 'Escolas do Dia']],
            ['type' => 'schools-scheduled', 'name' => 'Próximos Atendimentos', 'icon' => 'CalendarDays', 'category' => 'Listas',
             'defaultConfig' => ['title' => 'Próximos Atendimentos']],
            ['type' => 'queue-stations', 'name' => 'Fila por Estação', 'icon' => 'LayoutGrid', 'category' => 'Listas',
             'defaultConfig' => ['title' => 'Fila por Estação']],
            ['type' => 'referrals', 'name' => 'Encaminhamentos', 'icon' => 'Send', 'category' => 'Listas',
             'defaultConfig' => ['title' => 'Encaminhamentos', 'limit' => 10]],

            // Gráficos
            ['type' => 'chart-line', 'name' => 'Gráfico de Linha', 'icon' => 'TrendingUp', 'category' => 'Gráficos',
             'defaultConfig' => ['title' => 'Atendimentos por Dia', 'dataKey' => 'atendimentos_por_dia']],
            ['type' => 'chart-bar', 'name' => 'Gráfico de Barras', 'icon' => 'BarChart2', 'category' => 'Gráficos',
             'defaultConfig' => ['title' => 'Atendimentos por Dia', 'dataKey' => 'atendimentos_por_dia']],
            ['type' => 'chart-pie', 'name' => 'Gráfico de Pizza', 'icon' => 'PieChart', 'category' => 'Gráficos',
             'defaultConfig' => ['title' => 'Condutas Iniciais', 'dataKey' => 'condutas_iniciais']],
        ];

        echo json_encode($widgets);
    }

    private static function getDefaultLayout(): array {
        return [
            'widgets' => [
                ['i' => 'total-matriculados', 'x' => 0, 'y' => 0, 'w' => 3, 'h' => 2, 'type' => 'metric', 'config' => ['metric' => 'total_matriculados', 'title' => 'Total Matriculados', 'icon' => 'Users', 'color' => '#63b3ed']],
                ['i' => 'pacientes-dia', 'x' => 3, 'y' => 0, 'w' => 3, 'h' => 2, 'type' => 'metric', 'config' => ['metric' => 'pacientes_do_dia', 'title' => 'Pacientes do Dia', 'icon' => 'School', 'color' => '#48bb78']],
                ['i' => 'na-fila', 'x' => 6, 'y' => 0, 'w' => 3, 'h' => 2, 'type' => 'metric', 'config' => ['metric' => 'na_fila', 'title' => 'Na Fila', 'icon' => 'ClipboardList', 'color' => '#ecc94b']],
                ['i' => 'atendimentos', 'x' => 9, 'y' => 0, 'w' => 3, 'h' => 2, 'type' => 'metric', 'config' => ['metric' => 'atendimentos_hoje', 'title' => 'Atendimentos', 'icon' => 'Stethoscope', 'color' => '#68d391']],
            ]
        ];
    }
}
