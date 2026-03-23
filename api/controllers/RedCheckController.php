<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/redcheck.php';
require_once __DIR__ . '/../middleware/auth.php';

/**
 * RedCheckController — Consulta de exames na API RedCheck (somente leitura)
 */
class RedCheckController {

    /**
     * GET /api/redcheck/status — Verifica se a integração está configurada
     */
    public static function status(): void {
        Auth::requireAuth();
        echo json_encode([
            'configured' => RedCheckConfig::isConfigured(),
        ]);
    }

    /**
     * GET /api/redcheck/exames/{pacienteId} — Busca exames do paciente na RedCheck pelo CPF
     */
    public static function exames(int $pacienteId): void {
        Auth::requireAuth();
        $db = Database::getInstance();

        if (!RedCheckConfig::isConfigured()) {
            http_response_code(503);
            echo json_encode(['error' => 'Integração RedCheck não configurada']);
            return;
        }

        // Buscar CPF do paciente local
        $stmt = $db->prepare('SELECT cpf, nome_completo FROM pacientes WHERE id = :id');
        $stmt->execute([':id' => $pacienteId]);
        $paciente = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$paciente) {
            http_response_code(404);
            echo json_encode(['error' => 'Paciente não encontrado']);
            return;
        }

        $cpf = preg_replace('/\D/', '', $paciente['cpf'] ?? '');

        if (!$cpf) {
            echo json_encode(['laudos' => [], 'message' => 'Paciente sem CPF cadastrado']);
            return;
        }

        // Buscar paciente na RedCheck pelo CPF
        $patientResponse = self::apiRequest('GET', '/patient?cpf=' . urlencode($cpf));
        $redcheckPatientId = null;

        if ($patientResponse['httpCode'] === 200 && !empty($patientResponse['body'])) {
            $patients = $patientResponse['body'];
            if (isset($patients['data'])) $patients = $patients['data'];
            if (isset($patients['id'])) {
                $redcheckPatientId = $patients['id'];
            } elseif (is_array($patients) && isset($patients[0]['id'])) {
                $redcheckPatientId = $patients[0]['id'];
            }
        }

        if (!$redcheckPatientId) {
            echo json_encode(['laudos' => [], 'message' => 'Paciente não encontrado na RedCheck']);
            return;
        }

        // Buscar laudos do paciente na RedCheck
        $response = self::apiRequest('GET', '/report?patientId=' . $redcheckPatientId . '&perPage=50');

        if ($response['httpCode'] !== 200) {
            http_response_code(502);
            echo json_encode(['error' => 'Erro ao consultar exames na RedCheck']);
            return;
        }

        $body = $response['body'];
        $laudos = [];

        if (isset($body['laudos'])) {
            $laudos = $body['laudos'];
        } elseif (isset($body['data'])) {
            $laudos = $body['data'];
        } elseif (is_array($body) && isset($body[0]['id'])) {
            $laudos = $body;
        }

        // Mapear para formato simplificado
        $result = array_map(function ($l) {
            $examTypes = [1 => 'Spot Vision', 2 => 'Retinografia', 3 => 'Retinografia', 4 => 'OCT', 5 => 'Outro'];
            $statusMap = [0 => 'bloqueado', 1 => 'pendente', 2 => 'diagnosticado'];
            $eyeMap = [0 => 'N/I', 1 => 'OD', 2 => 'OE', 3 => 'AO'];

            return [
                'id' => $l['id'] ?? null,
                'tipo_exame' => $examTypes[$l['examType'] ?? 5] ?? 'Outro',
                'olho' => $eyeMap[$l['eye'] ?? 0] ?? 'N/I',
                'status' => $statusMap[$l['status'] ?? 1] ?? 'pendente',
                'diabetico' => (bool) ($l['diabetic'] ?? false),
                'observacao' => $l['observation'] ?? '',
                'data' => $l['registrationDate'] ?? $l['created_at'] ?? null,
                'public_url' => $l['linkExternal'] ?? $l['public_url'] ?? null,
                'paciente_nome' => $l['patient']['name'] ?? '',
            ];
        }, $laudos);

        echo json_encode(['laudos' => $result]);
    }

    /**
     * GET /api/redcheck/laudo/{laudoId} — Busca detalhe de um laudo específico
     */
    public static function laudo(int $laudoId): void {
        Auth::requireAuth();

        if (!RedCheckConfig::isConfigured()) {
            http_response_code(503);
            echo json_encode(['error' => 'Integração RedCheck não configurada']);
            return;
        }

        $response = self::apiRequest('GET', "/report/$laudoId");

        if ($response['httpCode'] === 404) {
            http_response_code(404);
            echo json_encode(['error' => 'Laudo não encontrado na RedCheck']);
            return;
        }

        if ($response['httpCode'] >= 400) {
            http_response_code(502);
            echo json_encode(['error' => 'Erro ao consultar RedCheck']);
            return;
        }

        echo json_encode($response['body']);
    }

    /**
     * GET /api/redcheck/recentes — Lista pacientes do RedCheck que possuem exames SpotVision ou Retinografia
     */
    public static function recentes(): void {
        Auth::requireAuth();

        if (!RedCheckConfig::isConfigured()) {
            http_response_code(503);
            echo json_encode(['error' => 'Integração RedCheck não configurada']);
            return;
        }

        // Buscar laudos — a resposta vem em body['laudos']
        $response = self::apiRequest('GET', '/report?perPage=1000');

        if ($response['httpCode'] !== 200) {
            http_response_code(502);
            echo json_encode(['error' => 'Erro ao consultar RedCheck']);
            return;
        }

        $body = $response['body'];
        $laudos = [];
        if (isset($body['laudos'])) $laudos = $body['laudos'];
        elseif (isset($body['data'])) $laudos = $body['data'];

        // Filtrar apenas SpotVision (1) e Retinografia (2, 3)
        $tiposDesejados = [1, 2, 3];
        $pacientes = [];
        $tiposPorPaciente = [];

        foreach ($laudos as $l) {
            $examType = $l['examType'] ?? null;
            if (!in_array($examType, $tiposDesejados, true)) continue;

            $pid = $l['patient']['id'] ?? ($l['patientId'] ?? null);
            if (!$pid) continue;

            $examTypes = [1 => 'SpotVision', 2 => 'Retinografia', 3 => 'Retinografia'];
            $tipoNome = $examTypes[$examType] ?? '';

            if (!isset($tiposPorPaciente[$pid])) {
                $tiposPorPaciente[$pid] = [];
            }
            if (!in_array($tipoNome, $tiposPorPaciente[$pid])) {
                $tiposPorPaciente[$pid][] = $tipoNome;
            }

            if (!isset($pacientes[$pid])) {
                $pacientes[$pid] = [
                    'redcheck_id' => $pid,
                    'nome' => $l['patient']['name'] ?? 'Sem nome',
                    'cpf' => $l['patient']['cpf'] ?? '',
                ];
            }
        }

        // Adicionar tipos de exame ao resultado
        $resultado = [];
        foreach ($pacientes as $pid => $p) {
            $p['tipos_exame'] = implode(', ', $tiposPorPaciente[$pid] ?? []);
            $resultado[] = $p;
        }

        // Ordenar por nome
        usort($resultado, fn($a, $b) => strcasecmp($a['nome'], $b['nome']));

        echo json_encode(['pacientes' => $resultado]);
    }

    /**
     * GET /api/redcheck/exames-demo/{redcheckPatientId} — Busca exames por ID RedCheck direto (demo)
     */
    public static function examesDemo(int $redcheckPatientId): void {
        Auth::requireAuth();

        if (!RedCheckConfig::isConfigured()) {
            http_response_code(503);
            echo json_encode(['error' => 'Integração RedCheck não configurada']);
            return;
        }

        $response = self::apiRequest('GET', '/report?patientId=' . $redcheckPatientId . '&perPage=50');

        if ($response['httpCode'] !== 200) {
            http_response_code(502);
            echo json_encode(['error' => 'Erro ao consultar exames na RedCheck']);
            return;
        }

        $body = $response['body'];
        $laudos = [];
        if (isset($body['laudos'])) $laudos = $body['laudos'];
        elseif (isset($body['data'])) $laudos = $body['data'];
        elseif (is_array($body) && isset($body[0]['id'])) $laudos = $body;

        $result = array_map(function ($l) {
            $examTypes = [1 => 'Spot Vision', 2 => 'Retinografia', 3 => 'Retinografia', 4 => 'OCT', 5 => 'Outro'];
            $statusMap = [0 => 'bloqueado', 1 => 'pendente', 2 => 'diagnosticado'];
            $eyeMap = [0 => 'N/I', 1 => 'OD', 2 => 'OE', 3 => 'AO'];

            return [
                'id' => $l['id'] ?? null,
                'tipo_exame' => $examTypes[$l['examType'] ?? 5] ?? 'Outro',
                'olho' => $eyeMap[$l['eye'] ?? 0] ?? 'N/I',
                'status' => $statusMap[$l['status'] ?? 1] ?? 'pendente',
                'diabetico' => (bool) ($l['diabetic'] ?? false),
                'observacao' => $l['observation'] ?? '',
                'data' => $l['registrationDate'] ?? $l['created_at'] ?? null,
                'public_url' => $l['linkExternal'] ?? $l['public_url'] ?? null,
                'paciente_nome' => $l['patient']['name'] ?? '',
            ];
        }, $laudos);

        echo json_encode(['laudos' => $result]);
    }

    /**
     * GET /api/redcheck/imagem/{laudoId} — Proxy do exame (imagem, PDF ou página HTML) — contorna X-Frame-Options
     */
    public static function imagem(int $laudoId): void {
        Auth::requireAuth();

        if (!RedCheckConfig::isConfigured()) {
            http_response_code(503);
            echo json_encode(['error' => 'Integração RedCheck não configurada']);
            return;
        }

        // Buscar detalhe do laudo para obter URL
        $response = self::apiRequest('GET', "/report/$laudoId");

        if ($response['httpCode'] !== 200 || empty($response['body'])) {
            http_response_code(404);
            echo json_encode(['error' => 'Laudo não encontrado']);
            return;
        }

        $body = $response['body'];
        $url = $body['linkExternal'] ?? $body['public_url'] ?? $body['linkImage'] ?? $body['imageUrl'] ?? null;

        if (!$url) {
            http_response_code(404);
            echo json_encode(['error' => 'Arquivo não disponível para este exame']);
            return;
        }

        // Validar que a URL pertence a um domínio permitido
        $parsedUrl = parse_url($url);
        $allowedHosts = ['redcheck.com.br', 'api.redcheck.com.br', 'storage.redcheck.com.br', 'img.redcheck.com.br', 'amazonaws.com', 's3.amazonaws.com'];
        $host = $parsedUrl['host'] ?? '';
        $isAllowed = false;
        foreach ($allowedHosts as $allowed) {
            if ($host === $allowed || str_ends_with($host, '.' . $allowed)) {
                $isAllowed = true;
                break;
            }
        }

        if (!$isAllowed) {
            http_response_code(403);
            echo json_encode(['error' => 'URL não permitida']);
            return;
        }

        // Fazer proxy do conteúdo
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: ' . RedCheckConfig::getAuthHeader(),
        ]);

        $data = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE) ?: '';

        if ($httpCode !== 200 || !$data) {
            http_response_code(502);
            echo json_encode(['error' => 'Erro ao buscar conteúdo do exame']);
            return;
        }

        // Detectar tipo de conteúdo
        $mimeBase = strtolower(explode(';', $contentType)[0]);

        if ($mimeBase === 'application/pdf' || str_starts_with($data, '%PDF')) {
            header('Content-Type: application/pdf');
            header('Content-Disposition: inline');
        } elseif (str_starts_with($mimeBase, 'image/')) {
            header('Content-Type: ' . $contentType);
        } elseif ($mimeBase === 'text/html' || str_contains($data, '<html') || str_contains($data, '<!DOCTYPE')) {
            // Para HTML, reescrever URLs relativas para absolutas e remover X-Frame-Options
            $baseUrl = $parsedUrl['scheme'] . '://' . $host;
            // Adicionar <base> tag e CSS para centralizar conteúdo
            $centerCss = '<style>body{display:flex;flex-direction:column;align-items:center;justify-content:flex-start;min-height:100vh;margin:0 auto;max-width:100%;}</style>';
            $data = preg_replace(
                '/(<head[^>]*>)/i',
                '$1<base href="' . htmlspecialchars($baseUrl, ENT_QUOTES) . '/">' . $centerCss,
                $data,
                1
            );
            header('Content-Type: text/html; charset=utf-8');
        } else {
            header('Content-Type: ' . ($contentType ?: 'application/octet-stream'));
        }

        header('Cache-Control: private, max-age=3600');
        // Remover X-Frame-Options que o servidor original enviou
        header_remove('X-Frame-Options');
        echo $data;
    }

    // ===== HELPERS =====

    private static function apiRequest(string $method, string $endpoint): array {
        $url = RedCheckConfig::BASE_URL . $endpoint;

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: ' . RedCheckConfig::getAuthHeader(),
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

        $body = json_decode($response, true);

        return [
            'httpCode' => $httpCode,
            'body' => $body ?? $response,
        ];
    }
}
