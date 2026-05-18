<?php
require_once __DIR__ . '/../controllers/AuthController.php';
require_once __DIR__ . '/../controllers/EspecialidadeController.php';
require_once __DIR__ . '/../controllers/FormularioController.php';
require_once __DIR__ . '/../controllers/ProntuarioDinamicoController.php';
require_once __DIR__ . '/../controllers/PacienteController.php';
require_once __DIR__ . '/../controllers/FilaController.php';
require_once __DIR__ . '/../controllers/ProntuarioController.php';
require_once __DIR__ . '/../controllers/DashboardController.php';
require_once __DIR__ . '/../controllers/DashboardConfigController.php';
require_once __DIR__ . '/../controllers/UploadController.php';
require_once __DIR__ . '/../controllers/UsuarioController.php';
require_once __DIR__ . '/../controllers/MedicoController.php';
require_once __DIR__ . '/../controllers/EscolaAgendaController.php';
require_once __DIR__ . '/../controllers/ModeloDocumentoController.php';
// require_once __DIR__ . '/../controllers/RedCheckController.php'; // RedCheck desativado temporariamente
require_once __DIR__ . '/../controllers/LaudoProntoController.php';
require_once __DIR__ . '/../controllers/HistoricoController.php';
require_once __DIR__ . '/../controllers/SpotVisionController.php';
require_once __DIR__ . '/../controllers/TenantController.php';
require_once __DIR__ . '/../controllers/PermissaoController.php';
require_once __DIR__ . '/../controllers/PainelController.php';
require_once __DIR__ . '/../controllers/PerfilController.php';
require_once __DIR__ . '/../controllers/AgendamentoController.php';
require_once __DIR__ . '/../controllers/TriagemController.php';
require_once __DIR__ . '/../controllers/InternacaoController.php';

class Router {
    private array $routes = [];

    public function add(string $method, string $pattern, callable $handler): void {
        $this->routes[] = [
            'method' => strtoupper($method),
            'pattern' => $pattern,
            'handler' => $handler,
        ];
    }

    public function resolve(string $method, string $uri): void {
        $method = strtoupper($method);

        foreach ($this->routes as $route) {
            if ($route['method'] !== $method) {
                continue;
            }

            $pattern = '#^' . preg_replace('#\{(\w+)\}#', '(?P<$1>\d+)', $route['pattern']) . '$#';

            if (preg_match($pattern, $uri, $matches)) {
                // Extract named parameters as positional to avoid PHP 8 named-arg mismatch
                $params = array_values(array_filter($matches, 'is_string', ARRAY_FILTER_USE_KEY));
                $params = array_map('intval', $params);
                call_user_func_array($route['handler'], $params);
                return;
            }
        }

        http_response_code(404);
        echo json_encode(['error' => 'Rota não encontrada']);
    }
}

// Registrar rotas
$router = new Router();

// Auth
$router->add('POST', '/api/auth/login', [AuthController::class, 'login']);
$router->add('POST', '/api/auth/register', [AuthController::class, 'register']);
$router->add('POST', '/api/auth/switch-tenant', [AuthController::class, 'switchTenant']);
$router->add('GET', '/api/auth/my-tenants', [AuthController::class, 'myTenants']);
$router->add('GET', '/api/auth/me', [AuthController::class, 'me']);

// Perfil do usuário logado
$router->add('GET',    '/api/perfil',       [PerfilController::class, 'get']);
$router->add('PUT',    '/api/perfil',       [PerfilController::class, 'update']);
$router->add('POST',   '/api/perfil/foto',  [PerfilController::class, 'uploadFoto']);
$router->add('DELETE', '/api/perfil/foto',  [PerfilController::class, 'deleteFoto']);
$router->add('PUT',    '/api/perfil/tema',  [PerfilController::class, 'updateTema']);
$router->add('PUT',    '/api/perfil/senha', [PerfilController::class, 'alterarSenha']);

// Pacientes
$router->add('GET', '/api/pacientes', [PacienteController::class, 'index']);
$router->add('GET', '/api/pacientes/escolas', [PacienteController::class, 'escolas']);
$router->add('GET', '/api/pacientes/escolas/contagem', [PacienteController::class, 'escolasContagem']);
$router->add('DELETE', '/api/pacientes/escola', [PacienteController::class, 'destroyByEscola']);
$router->add('GET', '/api/pacientes/{id}', [PacienteController::class, 'show']);
$router->add('POST', '/api/pacientes', [PacienteController::class, 'store']);
$router->add('POST', '/api/pacientes/importar', [PacienteController::class, 'importar']);
$router->add('PUT', '/api/pacientes/{id}', [PacienteController::class, 'update']);
$router->add('DELETE', '/api/pacientes/{id}', [PacienteController::class, 'destroy']);

// Fila
$router->add('GET', '/api/fila', [FilaController::class, 'index']);
$router->add('GET', '/api/fila/pacientes-disponiveis', [FilaController::class, 'pacientesDisponiveis']);
$router->add('POST', '/api/fila', [FilaController::class, 'store']);
$router->add('PUT', '/api/fila/{id}/avancar', [FilaController::class, 'avancar']);
$router->add('PUT', '/api/fila/{id}/status', [FilaController::class, 'updateStatus']);
$router->add('PUT', '/api/fila/{id}/mover', [FilaController::class, 'mover']);
$router->add('PUT', '/api/fila/{id}/prioridade', [FilaController::class, 'togglePrioridade']);
$router->add('POST', '/api/fila/{id}/chamar', [FilaController::class, 'chamar']);
$router->add('DELETE', '/api/fila/{id}', [FilaController::class, 'destroy']);

// Painel de Senha
$router->add('GET', '/api/painel', [PainelController::class, 'index']);

// Prontuário
$router->add('GET', '/api/prontuario/{pacienteId}', [ProntuarioController::class, 'completo']);
$router->add('POST', '/api/prontuario/{pacienteId}/atendimento', [ProntuarioController::class, 'storeAtendimento']);
$router->add('DELETE', '/api/prontuario/{pacienteId}/laudo', [ProntuarioController::class, 'excluirLaudo']);

// Modelos de Laudos
$router->add('GET', '/api/modelos-laudos', [ProntuarioController::class, 'listarModelos']);
$router->add('POST', '/api/modelos-laudos', [ProntuarioController::class, 'criarModelo']);
$router->add('DELETE', '/api/modelos-laudos/{id}', [ProntuarioController::class, 'excluirModelo']);

// Modelos de Documentos (atestado, receita médica)
$router->add('GET', '/api/modelos-documentos', [ModeloDocumentoController::class, 'index']);
$router->add('POST', '/api/modelos-documentos', [ModeloDocumentoController::class, 'store']);
$router->add('PUT', '/api/modelos-documentos/{id}', [ModeloDocumentoController::class, 'update']);
$router->add('DELETE', '/api/modelos-documentos/{id}', [ModeloDocumentoController::class, 'destroy']);

// Dashboard
$router->add('GET', '/api/dashboard/metricas', [DashboardController::class, 'metricas']);

// Dashboard Config (Builder)
$router->add('GET', '/api/dashboard-config', [DashboardConfigController::class, 'get']);
$router->add('POST', '/api/dashboard-config', [DashboardConfigController::class, 'save']);
$router->add('DELETE', '/api/dashboard-config', [DashboardConfigController::class, 'reset']);
$router->add('GET', '/api/dashboard-config/widgets', [DashboardConfigController::class, 'getWidgets']);

// Uploads
$router->add('GET', '/api/pacientes/{pacienteId}/uploads', [UploadController::class, 'index']);
$router->add('POST', '/api/pacientes/{pacienteId}/uploads', [UploadController::class, 'store']);
$router->add('GET', '/api/uploads/{id}/download', [UploadController::class, 'download']);
$router->add('DELETE', '/api/uploads/{id}', [UploadController::class, 'destroy']);

// SpotVision (S3)
$router->add('GET', '/api/spotvision/view', [SpotVisionController::class, 'visualizar']);
$router->add('GET', '/api/spotvision/image', [SpotVisionController::class, 'imagem']);
$router->add('GET', '/api/spotvision/{pacienteId}', [SpotVisionController::class, 'listar']);

// SpotVision Admin
$router->add('GET', '/api/spotvision-admin/all', [SpotVisionController::class, 'listarTodos']);
$router->add('GET', '/api/spotvision-admin/ocr', [SpotVisionController::class, 'ocrExtrair']);
$router->add('POST', '/api/spotvision-admin/ocr-batch', [SpotVisionController::class, 'ocrBatch']);
$router->add('PUT', '/api/spotvision-admin/mapear', [SpotVisionController::class, 'mapear']);
$router->add('DELETE', '/api/spotvision-admin/mapear', [SpotVisionController::class, 'removerMapeamento']);

// Usuários
$router->add('GET', '/api/usuarios', [UsuarioController::class, 'index']);
$router->add('GET', '/api/usuarios/{id}', [UsuarioController::class, 'show']);
$router->add('POST', '/api/usuarios', [UsuarioController::class, 'store']);
$router->add('PUT', '/api/usuarios/{id}', [UsuarioController::class, 'update']);
$router->add('DELETE', '/api/usuarios/{id}', [UsuarioController::class, 'destroy']);



// Médicos
$router->add('GET',    '/api/medicos/perfil',              [MedicoController::class, 'perfil']);
$router->add('GET',    '/api/medicos',                     [MedicoController::class, 'index']);
$router->add('GET',    '/api/medicos/{id}',                [MedicoController::class, 'show']);
$router->add('POST',   '/api/medicos',                     [MedicoController::class, 'store']);
$router->add('PUT',    '/api/medicos/{id}',                [MedicoController::class, 'update']);
$router->add('DELETE', '/api/medicos/{id}',                [MedicoController::class, 'destroy']);
$router->add('GET',    '/api/medicos/{id}/especialidades', [AgendamentoController::class, 'medicoEspecialidades']);
$router->add('PUT',    '/api/medicos/{id}/especialidades', [AgendamentoController::class, 'setMedicoEspecialidades']);

// Agendamentos
$router->add('GET',    '/api/agendamentos',                [AgendamentoController::class, 'index']);
$router->add('GET',    '/api/agendamentos/{id}',           [AgendamentoController::class, 'show']);
$router->add('POST',   '/api/agendamentos',                [AgendamentoController::class, 'store']);
$router->add('PUT',    '/api/agendamentos/{id}',           [AgendamentoController::class, 'update']);
$router->add('DELETE', '/api/agendamentos/{id}',           [AgendamentoController::class, 'destroy']);
$router->add('POST',   '/api/agendamentos/{id}/confirmar', [AgendamentoController::class, 'confirmar']);
$router->add('POST',   '/api/agendamentos/{id}/notificar', [AgendamentoController::class, 'notificar']);
$router->add('POST',   '/api/agendamentos/{id}/checkin',   [AgendamentoController::class, 'checkIn']);

// Escola Agenda
$router->add('GET', '/api/escola-agenda', [EscolaAgendaController::class, 'index']);

// RedCheck (SpotVision / Retinografia) — desativado temporariamente
// $router->add('GET', '/api/redcheck/status', [RedCheckController::class, 'status']);
// $router->add('GET', '/api/redcheck/exames/{pacienteId}', [RedCheckController::class, 'exames']);
// $router->add('GET', '/api/redcheck/laudo/{id}', [RedCheckController::class, 'laudo']);
// $router->add('GET', '/api/redcheck/recentes', [RedCheckController::class, 'recentes']);
// $router->add('GET', '/api/redcheck/exames-demo/{redcheckPatientId}', [RedCheckController::class, 'examesDemo']);
// $router->add('GET', '/api/redcheck/imagem/{laudoId}', [RedCheckController::class, 'imagem']);

// Escola Agenda (cont.)
$router->add('GET', '/api/escola-agenda/hoje', [EscolaAgendaController::class, 'hoje']);
$router->add('POST', '/api/escola-agenda', [EscolaAgendaController::class, 'store']);
$router->add('DELETE', '/api/escola-agenda/remover', [EscolaAgendaController::class, 'destroyByEscolaData']);
$router->add('DELETE', '/api/escola-agenda/{id}', [EscolaAgendaController::class, 'destroy']);

// Permissões de telas
$router->add('GET',  '/api/permissoes/telas',              [PermissaoController::class, 'telas']);
$router->add('GET',  '/api/permissoes/me',                 [PermissaoController::class, 'getMe']);
$router->add('GET',  '/api/permissoes/usuario/{id}',       [PermissaoController::class, 'getUsuario']);
$router->add('PUT',  '/api/permissoes/usuario/{id}',       [PermissaoController::class, 'setUsuario']);

// Clínicas (Tenants)
$router->add('GET', '/api/clinicas', [TenantController::class, 'index']);
$router->add('GET', '/api/clinicas/{id}', [TenantController::class, 'show']);
$router->add('POST', '/api/clinicas', [TenantController::class, 'store']);
$router->add('PUT', '/api/clinicas/{id}', [TenantController::class, 'update']);
$router->add('DELETE', '/api/clinicas/{id}', [TenantController::class, 'destroy']);
$router->add('GET', '/api/clinicas/{id}/usuarios', [TenantController::class, 'usuarios']);
$router->add('POST', '/api/clinicas/{id}/usuarios', [TenantController::class, 'vincularUsuario']);
$router->add('DELETE', '/api/clinicas/{id}/usuarios', [TenantController::class, 'desvincularUsuario']);

// Laudos Prontos
$router->add('GET', '/api/laudos-prontos', [LaudoProntoController::class, 'index']);
$router->add('GET', '/api/laudos-prontos/ativos', [LaudoProntoController::class, 'ativos']);
$router->add('POST', '/api/laudos-prontos', [LaudoProntoController::class, 'store']);
$router->add('PUT', '/api/laudos-prontos/{id}', [LaudoProntoController::class, 'update']);
$router->add('DELETE', '/api/laudos-prontos/{id}', [LaudoProntoController::class, 'destroy']);

// Histórico de Atendimentos (Relatórios)
$router->add('GET', '/api/historico', [HistoricoController::class, 'index']);
$router->add('GET', '/api/historico/resumo', [HistoricoController::class, 'resumo']);
$router->add('GET', '/api/historico/escolas', [HistoricoController::class, 'escolas']);
$router->add('GET', '/api/historico/exportar', [HistoricoController::class, 'exportar']);

// Especialidades + Estações
$router->add('GET',    '/api/especialidades',                          [EspecialidadeController::class, 'index']);
$router->add('GET',    '/api/especialidades/{id}',                     [EspecialidadeController::class, 'show']);
$router->add('POST',   '/api/especialidades',                          [EspecialidadeController::class, 'store']);
$router->add('PUT',    '/api/especialidades/{id}',                     [EspecialidadeController::class, 'update']);
$router->add('DELETE', '/api/especialidades/{id}',                     [EspecialidadeController::class, 'destroy']);
$router->add('GET',    '/api/especialidades/{id}/estacoes',            [EspecialidadeController::class, 'estacoes']);
$router->add('POST',   '/api/especialidades/{id}/estacoes',            [EspecialidadeController::class, 'storeEstacao']);
$router->add('PUT',    '/api/especialidades/{id}/estacoes/reordenar',  [EspecialidadeController::class, 'reordenarEstacoes']);
$router->add('PUT',    '/api/especialidades/estacoes/{id}',            [EspecialidadeController::class, 'updateEstacao']);
$router->add('DELETE', '/api/especialidades/estacoes/{id}',            [EspecialidadeController::class, 'destroyEstacao']);

// Formulários dinâmicos
$router->add('GET',    '/api/formularios/{id}',                         [FormularioController::class, 'definicao']);
$router->add('GET',    '/api/formularios/{id}/admin',                   [FormularioController::class, 'todasSecoes']);
$router->add('POST',   '/api/formularios/secoes',                       [FormularioController::class, 'storeSecao']);
$router->add('PUT',    '/api/formularios/secoes/{id}',                  [FormularioController::class, 'updateSecao']);
$router->add('DELETE', '/api/formularios/secoes/{id}',                  [FormularioController::class, 'destroySecao']);
$router->add('PUT',    '/api/formularios/secoes/reordenar',             [FormularioController::class, 'reordenarSecoes']);
$router->add('POST',   '/api/formularios/campos',                       [FormularioController::class, 'storeCampo']);
$router->add('PUT',    '/api/formularios/campos/{id}',                  [FormularioController::class, 'updateCampo']);
$router->add('DELETE', '/api/formularios/campos/{id}',                  [FormularioController::class, 'destroyCampo']);
$router->add('PUT',    '/api/formularios/campos/reordenar',             [FormularioController::class, 'reordenarCampos']);

// Prontuário Dinâmico
$router->add('GET',  '/api/prontuario-dinamico/{id}',           [ProntuarioDinamicoController::class, 'completo']);
$router->add('POST', '/api/prontuario-dinamico/{id}',           [ProntuarioDinamicoController::class, 'salvar']);
$router->add('GET',  '/api/prontuario-dinamico/{id}/historico', [ProntuarioDinamicoController::class, 'historico']);

// Triagem
$router->add('GET',    '/api/triagem',       [TriagemController::class, 'index']);
$router->add('POST',   '/api/triagem',       [TriagemController::class, 'store']);
$router->add('GET',    '/api/triagem/{id}',  [TriagemController::class, 'show']);
$router->add('PUT',    '/api/triagem/{id}',  [TriagemController::class, 'update']);
$router->add('DELETE', '/api/triagem/{id}',  [TriagemController::class, 'destroy']);

// Leitos
$router->add('GET',    '/api/leitos',              [InternacaoController::class, 'leitosIndex']);
$router->add('POST',   '/api/leitos',              [InternacaoController::class, 'leitosStore']);
$router->add('GET',    '/api/leitos/{id}',         [InternacaoController::class, 'leitosShow']);
$router->add('PUT',    '/api/leitos/{id}',         [InternacaoController::class, 'leitosUpdate']);
$router->add('DELETE', '/api/leitos/{id}',         [InternacaoController::class, 'leitosDestroy']);

// Internações
$router->add('GET',    '/api/internacoes',                       [InternacaoController::class, 'index']);
$router->add('POST',   '/api/internacoes',                       [InternacaoController::class, 'store']);
$router->add('GET',    '/api/internacoes/stats',                 [InternacaoController::class, 'stats']);
$router->add('GET',    '/api/internacoes/{id}',                  [InternacaoController::class, 'show']);
$router->add('PUT',    '/api/internacoes/{id}',                  [InternacaoController::class, 'update']);
$router->add('POST',   '/api/internacoes/{id}/alta',             [InternacaoController::class, 'darAlta']);
$router->add('POST',   '/api/internacoes/{id}/transferir',       [InternacaoController::class, 'transferir']);
$router->add('GET',    '/api/internacoes/{id}/evolucoes',        [InternacaoController::class, 'evolucoes']);
$router->add('POST',   '/api/internacoes/{id}/evolucoes',        [InternacaoController::class, 'storeEvolucao']);
$router->add('DELETE', '/api/evolucoes/{id}',                    [InternacaoController::class, 'destroyEvolucao']);

// Logs (apenas admin)
$router->add('GET', '/api/logs/fila', function() {
    require_once __DIR__ . '/../middleware/auth.php';
    Auth::requireTela('logs');
    
    $logFile = __DIR__ . '/../logs/fila.log';
    if (!file_exists($logFile)) {
        http_response_code(404);
        echo json_encode(['error' => 'Arquivo de log não encontrado']);
        return;
    }
    
    $logs = file_get_contents($logFile);
    $lines = array_filter(explode("\n", $logs), fn($line) => trim($line) !== '');
    
    echo json_encode([
        'total_lines' => count($lines),
        'logs' => array_slice($lines, max(0, count($lines) - 100)) // Últimas 100 linhas
    ]);
});

// Auditoria (apenas admin)
$router->add('GET', '/api/audit', function() {
    require_once __DIR__ . '/../middleware/auth.php';
    require_once __DIR__ . '/../config/database.php';
    require_once __DIR__ . '/../middleware/tenant.php';
    Auth::requireTela('logs');

    $db = Database::getInstance();

    $page = max(1, (int)($_GET['page'] ?? 1));
    $limit = min(100, max(1, (int)($_GET['limit'] ?? 50)));
    $offset = ($page - 1) * $limit;

    $where = 'tenant_id = :tid';
    $params = [':tid' => Tenant::id()];

    if (!empty($_GET['usuario'])) {
        $where .= ' AND usuario_nome LIKE :usuario';
        $params[':usuario'] = '%' . $_GET['usuario'] . '%';
    }
    if (!empty($_GET['acao'])) {
        $where .= ' AND acao = :acao';
        $params[':acao'] = $_GET['acao'];
    }
    if (!empty($_GET['entidade'])) {
        $where .= ' AND entidade = :entidade';
        $params[':entidade'] = $_GET['entidade'];
    }
    if (!empty($_GET['data_inicio'])) {
        $where .= ' AND created_at >= :di';
        $params[':di'] = $_GET['data_inicio'] . ' 00:00:00';
    }
    if (!empty($_GET['data_fim'])) {
        $where .= ' AND created_at <= :df';
        $params[':df'] = $_GET['data_fim'] . ' 23:59:59';
    }

    $countStmt = $db->prepare("SELECT COUNT(*) FROM audit_log WHERE {$where}");
    $countStmt->execute($params);
    $total = (int)$countStmt->fetchColumn();

    $stmt = $db->prepare(
        "SELECT * FROM audit_log WHERE {$where} ORDER BY created_at DESC LIMIT :limit OFFSET :offset"
    );
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();

    echo json_encode([
        'total' => $total,
        'page' => $page,
        'limit' => $limit,
        'data' => $stmt->fetchAll(),
    ]);
});
?>
