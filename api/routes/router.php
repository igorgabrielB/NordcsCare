<?php
require_once __DIR__ . '/../controllers/AuthController.php';
require_once __DIR__ . '/../controllers/PacienteController.php';
require_once __DIR__ . '/../controllers/FilaController.php';
require_once __DIR__ . '/../controllers/ProntuarioController.php';
require_once __DIR__ . '/../controllers/DashboardController.php';
require_once __DIR__ . '/../controllers/UploadController.php';
require_once __DIR__ . '/../controllers/UsuarioController.php';
require_once __DIR__ . '/../controllers/MedicoController.php';
require_once __DIR__ . '/../controllers/EscolaAgendaController.php';
require_once __DIR__ . '/../controllers/ModeloDocumentoController.php';
require_once __DIR__ . '/../controllers/RedCheckController.php';
require_once __DIR__ . '/../controllers/LaudoProntoController.php';
require_once __DIR__ . '/../controllers/HistoricoController.php';

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
                // Extract named parameters
                $params = array_filter($matches, 'is_string', ARRAY_FILTER_USE_KEY);
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
$router->add('GET', '/api/auth/me', [AuthController::class, 'me']);

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
$router->add('DELETE', '/api/fila/{id}', [FilaController::class, 'destroy']);

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

// Uploads
$router->add('GET', '/api/pacientes/{pacienteId}/uploads', [UploadController::class, 'index']);
$router->add('POST', '/api/pacientes/{pacienteId}/uploads', [UploadController::class, 'store']);
$router->add('GET', '/api/uploads/{id}/download', [UploadController::class, 'download']);
$router->add('DELETE', '/api/uploads/{id}', [UploadController::class, 'destroy']);

// Usuários
$router->add('GET', '/api/usuarios', [UsuarioController::class, 'index']);
$router->add('GET', '/api/usuarios/{id}', [UsuarioController::class, 'show']);
$router->add('POST', '/api/usuarios', [UsuarioController::class, 'store']);
$router->add('PUT', '/api/usuarios/{id}', [UsuarioController::class, 'update']);
$router->add('DELETE', '/api/usuarios/{id}', [UsuarioController::class, 'destroy']);



// Médicos
$router->add('GET', '/api/medicos/perfil', [MedicoController::class, 'perfil']);
$router->add('GET', '/api/medicos', [MedicoController::class, 'index']);
$router->add('GET', '/api/medicos/{id}', [MedicoController::class, 'show']);
$router->add('POST', '/api/medicos', [MedicoController::class, 'store']);
$router->add('PUT', '/api/medicos/{id}', [MedicoController::class, 'update']);
$router->add('DELETE', '/api/medicos/{id}', [MedicoController::class, 'destroy']);

// Escola Agenda
$router->add('GET', '/api/escola-agenda', [EscolaAgendaController::class, 'index']);

// RedCheck (SpotVision / Retinografia) — somente leitura
$router->add('GET', '/api/redcheck/status', [RedCheckController::class, 'status']);
$router->add('GET', '/api/redcheck/exames/{pacienteId}', [RedCheckController::class, 'exames']);
$router->add('GET', '/api/redcheck/laudo/{id}', [RedCheckController::class, 'laudo']);
$router->add('GET', '/api/redcheck/recentes', [RedCheckController::class, 'recentes']);
$router->add('GET', '/api/redcheck/exames-demo/{redcheckPatientId}', [RedCheckController::class, 'examesDemo']);
$router->add('GET', '/api/redcheck/imagem/{laudoId}', [RedCheckController::class, 'imagem']);

// Escola Agenda (cont.)
$router->add('GET', '/api/escola-agenda/hoje', [EscolaAgendaController::class, 'hoje']);
$router->add('POST', '/api/escola-agenda', [EscolaAgendaController::class, 'store']);
$router->add('DELETE', '/api/escola-agenda/remover', [EscolaAgendaController::class, 'destroyByEscolaData']);
$router->add('DELETE', '/api/escola-agenda/{id}', [EscolaAgendaController::class, 'destroy']);

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

// Logs (apenas admin)
$router->add('GET', '/api/logs/fila', function() {
    require_once __DIR__ . '/../middleware/auth.php';
    Auth::requireRole(['admin']);
    
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
    Auth::requireRole(['admin']);

    $db = Database::getInstance();

    $page = max(1, (int)($_GET['page'] ?? 1));
    $limit = min(100, max(1, (int)($_GET['limit'] ?? 50)));
    $offset = ($page - 1) * $limit;

    $where = '1=1';
    $params = [];

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