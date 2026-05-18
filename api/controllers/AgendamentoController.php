<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../middleware/tenant.php';
require_once __DIR__ . '/../config/env.php';

class AgendamentoController {

    /**
     * GET /api/agendamentos
     * Filtros: data_inicio, data_fim, especialidade_id, medico_id, status, paciente_id, hoje=1
     */
    public static function index(): void {
        Auth::requireTela('agendamentos');
        $db  = Database::getInstance();
        $tid = Tenant::id();

        $where  = ['a.tenant_id = :tid'];
        $params = [':tid' => $tid];

        if (!empty($_GET['data_inicio'])) {
            $where[] = 'DATE(a.data_hora) >= :di';
            $params[':di'] = $_GET['data_inicio'];
        }
        if (!empty($_GET['data_fim'])) {
            $where[] = 'DATE(a.data_hora) <= :df';
            $params[':df'] = $_GET['data_fim'];
        }
        if (!empty($_GET['especialidade_id'])) {
            $where[] = 'a.especialidade_id = :eid';
            $params[':eid'] = (int)$_GET['especialidade_id'];
        }
        if (!empty($_GET['medico_id'])) {
            $where[] = 'a.medico_id = :mid';
            $params[':mid'] = (int)$_GET['medico_id'];
        }
        if (!empty($_GET['status'])) {
            $where[] = 'a.status = :status';
            $params[':status'] = $_GET['status'];
        }
        if (!empty($_GET['paciente_id'])) {
            $where[] = 'a.paciente_id = :pid';
            $params[':pid'] = (int)$_GET['paciente_id'];
        }
        if (!empty($_GET['hoje']) && $_GET['hoje'] === '1') {
            $where[] = 'DATE(a.data_hora) = CURDATE()';
        }

        $whereStr = implode(' AND ', $where);

        $stmt = $db->prepare("
            SELECT a.id, a.paciente_id, a.medico_id, a.especialidade_id,
                   a.data_hora, a.duracao_min, a.tipo, a.status, a.observacoes,
                   a.fila_id, a.notificado_em, a.created_at,
                   p.nome_completo AS paciente_nome,
                   p.telefone      AS paciente_telefone,
                   m.nome          AS medico_nome,
                   e.nome          AS especialidade_nome,
                   e.cor           AS especialidade_cor
            FROM agendamentos a
            JOIN  pacientes    p ON p.id = a.paciente_id
            LEFT JOIN medicos  m ON m.id = a.medico_id
            LEFT JOIN especialidades e ON e.id = a.especialidade_id
            WHERE {$whereStr}
            ORDER BY a.data_hora ASC
        ");
        $stmt->execute($params);
        echo json_encode($stmt->fetchAll());
    }

    /**
     * GET /api/agendamentos/{id}
     */
    public static function show(int $id): void {
        Auth::requireTela('agendamentos');
        $db = Database::getInstance();
        $stmt = $db->prepare("
            SELECT a.*, p.nome_completo AS paciente_nome, p.telefone AS paciente_telefone,
                   m.nome AS medico_nome, e.nome AS especialidade_nome, e.cor AS especialidade_cor
            FROM agendamentos a
            JOIN  pacientes p ON p.id = a.paciente_id
            LEFT JOIN medicos m ON m.id = a.medico_id
            LEFT JOIN especialidades e ON e.id = a.especialidade_id
            WHERE a.id = :id AND a.tenant_id = :tid
        ");
        $stmt->execute([':id' => $id, ':tid' => Tenant::id()]);
        $ag = $stmt->fetch();
        if (!$ag) {
            http_response_code(404);
            echo json_encode(['error' => 'Agendamento não encontrado']);
            return;
        }
        echo json_encode($ag);
    }

    /**
     * POST /api/agendamentos
     */
    public static function store(): void {
        Auth::requireTela('agendamentos');
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $db    = Database::getInstance();
        $tid   = Tenant::id();

        $pacienteId      = (int)($input['paciente_id']      ?? 0);
        $especialidadeId = (int)($input['especialidade_id'] ?? 0);
        $dataHora        = trim($input['data_hora'] ?? '');

        if (!$pacienteId || !$especialidadeId || !$dataHora) {
            http_response_code(422);
            echo json_encode(['error' => 'paciente_id, especialidade_id e data_hora são obrigatórios']);
            return;
        }

        // Validar paciente
        $stmt = $db->prepare('SELECT id, nome_completo, telefone FROM pacientes WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $pacienteId, ':tid' => $tid]);
        $paciente = $stmt->fetch();
        if (!$paciente) {
            http_response_code(404);
            echo json_encode(['error' => 'Paciente não encontrado']);
            return;
        }

        // Validar especialidade
        $stmt = $db->prepare('SELECT id, nome FROM especialidades WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $especialidadeId, ':tid' => $tid]);
        $especialidade = $stmt->fetch();
        if (!$especialidade) {
            http_response_code(404);
            echo json_encode(['error' => 'Especialidade não encontrada']);
            return;
        }

        $medicoId  = !empty($input['medico_id']) ? (int)$input['medico_id'] : null;
        $duracao   = max(15, (int)($input['duracao_min'] ?? 30));
        $tiposValidos = ['consulta', 'retorno', 'exame', 'cirurgia', 'triagem'];
        $statusValidos = ['agendado', 'confirmado', 'cancelado', 'realizado', 'falta'];
        $tipo    = in_array($input['tipo']   ?? '', $tiposValidos)  ? $input['tipo']   : 'consulta';
        $status  = in_array($input['status'] ?? '', $statusValidos) ? $input['status'] : 'agendado';
        $obs     = trim($input['observacoes'] ?? '') ?: null;

        $stmt = $db->prepare("
            INSERT INTO agendamentos
                (tenant_id, paciente_id, medico_id, especialidade_id, data_hora, duracao_min, tipo, status, observacoes)
            VALUES (:tid, :pid, :mid, :eid, :dh, :dur, :tipo, :status, :obs)
        ");
        $stmt->execute([
            ':tid' => $tid, ':pid' => $pacienteId, ':mid' => $medicoId,
            ':eid' => $especialidadeId, ':dh' => $dataHora,
            ':dur' => $duracao, ':tipo' => $tipo, ':status' => $status, ':obs' => $obs,
        ]);
        $newId = (int)$db->lastInsertId();

        // Notificação WhatsApp ao agendar
        if ($paciente['telefone'] && in_array($status, ['agendado', 'confirmado'])) {
            $medicoNome = null;
            if ($medicoId) {
                $sm = $db->prepare('SELECT nome FROM medicos WHERE id = :id');
                $sm->execute([':id' => $medicoId]);
                $medicoNome = $sm->fetchColumn() ?: null;
            }
            $sent = self::sendWhatsApp(
                $paciente['telefone'],
                self::msgAgendamento($paciente['nome_completo'], $dataHora, $especialidade['nome'], $medicoNome)
            );
            if ($sent) {
                $db->prepare('UPDATE agendamentos SET notificado_em = NOW() WHERE id = :id')
                   ->execute([':id' => $newId]);
            }
        }

        http_response_code(201);
        echo json_encode(['id' => $newId, 'message' => 'Agendamento criado']);
    }

    /**
     * PUT /api/agendamentos/{id}
     */
    public static function update(int $id): void {
        Auth::requireTela('agendamentos');
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $db    = Database::getInstance();
        $tid   = Tenant::id();

        $stmt = $db->prepare('SELECT id FROM agendamentos WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $id, ':tid' => $tid]);
        if (!$stmt->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Agendamento não encontrado']);
            return;
        }

        $fields = [];
        $params = [':id' => $id, ':tid' => $tid];
        $tiposValidos  = ['consulta', 'retorno', 'exame', 'cirurgia', 'triagem'];
        $statusValidos = ['agendado', 'confirmado', 'cancelado', 'realizado', 'falta'];

        if (isset($input['especialidade_id']))  { $fields[] = 'especialidade_id = :eid'; $params[':eid']    = (int)$input['especialidade_id']; }
        if (isset($input['medico_id']))         { $fields[] = 'medico_id = :mid';        $params[':mid']    = $input['medico_id'] ? (int)$input['medico_id'] : null; }
        if (isset($input['data_hora']))         { $fields[] = 'data_hora = :dh';         $params[':dh']     = $input['data_hora']; }
        if (isset($input['duracao_min']))        { $fields[] = 'duracao_min = :dur';      $params[':dur']    = max(15, (int)$input['duracao_min']); }
        if (isset($input['tipo'])  && in_array($input['tipo'],   $tiposValidos))  { $fields[] = 'tipo = :tipo';     $params[':tipo']   = $input['tipo']; }
        if (isset($input['status']) && in_array($input['status'], $statusValidos)) { $fields[] = 'status = :status'; $params[':status'] = $input['status']; }
        if (array_key_exists('observacoes', $input)) { $fields[] = 'observacoes = :obs'; $params[':obs'] = trim($input['observacoes']) ?: null; }

        if (empty($fields)) {
            echo json_encode(['message' => 'Nada a alterar']);
            return;
        }

        $db->prepare('UPDATE agendamentos SET ' . implode(', ', $fields) . ' WHERE id = :id AND tenant_id = :tid')
           ->execute($params);

        echo json_encode(['message' => 'Agendamento atualizado']);
    }

    /**
     * DELETE /api/agendamentos/{id}
     */
    public static function destroy(int $id): void {
        Auth::requireTela('agendamentos');
        $db   = Database::getInstance();
        $stmt = $db->prepare('DELETE FROM agendamentos WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $id, ':tid' => Tenant::id()]);
        if ($stmt->rowCount() === 0) {
            http_response_code(404);
            echo json_encode(['error' => 'Agendamento não encontrado']);
            return;
        }
        echo json_encode(['message' => 'Agendamento removido']);
    }

    /**
     * POST /api/agendamentos/{id}/confirmar
     * Confirma e notifica o paciente via WhatsApp.
     */
    public static function confirmar(int $id): void {
        Auth::requireTela('agendamentos');
        $db  = Database::getInstance();
        $tid = Tenant::id();

        $stmt = $db->prepare("
            SELECT a.*, p.nome_completo, p.telefone,
                   e.nome AS esp_nome, m.nome AS med_nome
            FROM agendamentos a
            JOIN  pacientes p ON p.id = a.paciente_id
            LEFT JOIN medicos m ON m.id = a.medico_id
            LEFT JOIN especialidades e ON e.id = a.especialidade_id
            WHERE a.id = :id AND a.tenant_id = :tid
        ");
        $stmt->execute([':id' => $id, ':tid' => $tid]);
        $ag = $stmt->fetch();
        if (!$ag) {
            http_response_code(404);
            echo json_encode(['error' => 'Agendamento não encontrado']);
            return;
        }

        $db->prepare("UPDATE agendamentos SET status = 'confirmado' WHERE id = :id")
           ->execute([':id' => $id]);

        $notificado = false;
        if ($ag['telefone']) {
            $notificado = self::sendWhatsApp(
                $ag['telefone'],
                self::msgConfirmacao($ag['nome_completo'], $ag['data_hora'], $ag['esp_nome'], $ag['med_nome'])
            );
            if ($notificado) {
                $db->prepare('UPDATE agendamentos SET notificado_em = NOW() WHERE id = :id')
                   ->execute([':id' => $id]);
            }
        }

        echo json_encode(['message' => 'Agendamento confirmado', 'notificado' => $notificado]);
    }

    /**
     * POST /api/agendamentos/{id}/notificar
     * Reenvia notificação WhatsApp.
     */
    public static function notificar(int $id): void {
        Auth::requireTela('agendamentos');
        $db  = Database::getInstance();
        $tid = Tenant::id();

        $stmt = $db->prepare("
            SELECT a.*, p.nome_completo, p.telefone,
                   e.nome AS esp_nome, m.nome AS med_nome
            FROM agendamentos a
            JOIN  pacientes p ON p.id = a.paciente_id
            LEFT JOIN medicos m ON m.id = a.medico_id
            LEFT JOIN especialidades e ON e.id = a.especialidade_id
            WHERE a.id = :id AND a.tenant_id = :tid
        ");
        $stmt->execute([':id' => $id, ':tid' => $tid]);
        $ag = $stmt->fetch();
        if (!$ag) {
            http_response_code(404);
            echo json_encode(['error' => 'Agendamento não encontrado']);
            return;
        }

        if (!$ag['telefone']) {
            http_response_code(422);
            echo json_encode(['error' => 'Paciente sem telefone cadastrado']);
            return;
        }

        $sent = self::sendWhatsApp(
            $ag['telefone'],
            self::msgAgendamento($ag['nome_completo'], $ag['data_hora'], $ag['esp_nome'], $ag['med_nome'])
        );

        if ($sent) {
            $db->prepare('UPDATE agendamentos SET notificado_em = NOW() WHERE id = :id')
               ->execute([':id' => $id]);
            echo json_encode(['message' => 'Notificação enviada com sucesso']);
        } else {
            http_response_code(502);
            echo json_encode(['error' => 'Falha ao enviar. Verifique as configurações de WhatsApp no .env']);
        }
    }

    /**
     * POST /api/agendamentos/{id}/checkin
     * Registra chegada do paciente e cria entrada na fila com a especialidade correta.
     */
    public static function checkIn(int $id): void {
        Auth::requireTela('fila');
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $db    = Database::getInstance();
        $tid   = Tenant::id();

        // Buscar agendamento com paciente
        $stmt = $db->prepare('
            SELECT a.*, p.nome_completo, p.escola
            FROM agendamentos a
            JOIN pacientes p ON p.id = a.paciente_id
            WHERE a.id = :id AND a.tenant_id = :tid
        ');
        $stmt->execute([':id' => $id, ':tid' => $tid]);
        $ag = $stmt->fetch();
        if (!$ag) {
            http_response_code(404);
            echo json_encode(['error' => 'Agendamento não encontrado']);
            return;
        }
        if ($ag['status'] === 'cancelado') {
            http_response_code(409);
            echo json_encode(['error' => 'Agendamento está cancelado']);
            return;
        }
        if ($ag['fila_id']) {
            http_response_code(409);
            echo json_encode(['error' => 'Check-in já realizado para este agendamento']);
            return;
        }

        // Verificar se paciente já está na fila ativa hoje
        $stmt = $db->prepare("
            SELECT id FROM fila
            WHERE paciente_id = :pid AND tenant_id = :tid
              AND status != 'concluido' AND DATE(created_at) = CURDATE()
            LIMIT 1
        ");
        $stmt->execute([':pid' => $ag['paciente_id'], ':tid' => $tid]);
        if ($stmt->fetch()) {
            http_response_code(409);
            echo json_encode(['error' => 'Paciente já está na fila']);
            return;
        }

        // Buscar primeira estação da especialidade
        $stmt = $db->prepare('
            SELECT nome FROM fila_estacoes
            WHERE especialidade_id = :eid AND tenant_id = :tid AND ativo = 1
            ORDER BY ordem ASC LIMIT 1
        ');
        $stmt->execute([':eid' => $ag['especialidade_id'], ':tid' => $tid]);
        $primeiraEstacao = $stmt->fetchColumn() ?: 'acuidade';

        // Gerar senha se a primeira estação tiver prefixo
        $stmt = $db->prepare('
            SELECT prefixo_senha FROM fila_estacoes
            WHERE especialidade_id = :eid AND tenant_id = :tid AND tipo = "atendimento" AND ativo = 1
            ORDER BY ordem ASC LIMIT 1
        ');
        $stmt->execute([':eid' => $ag['especialidade_id'], ':tid' => $tid]);
        $prefixo = $stmt->fetchColumn();

        $senha = null;
        if ($prefixo) {
            $stmt = $db->prepare('
                SELECT MAX(CAST(SUBSTRING(senha, :len) AS UNSIGNED)) AS ultimo
                FROM fila
                WHERE tenant_id = :tid AND DATE(created_at) = CURDATE() AND senha LIKE :like
            ');
            $stmt->execute([':len' => strlen($prefixo) + 1, ':tid' => $tid, ':like' => $prefixo . '%']);
            $ultimo = (int)($stmt->fetchColumn() ?? 0);
            $senha  = $prefixo . str_pad($ultimo + 1, 3, '0', STR_PAD_LEFT);
        }

        $prioridade = (int)($input['prioridade'] ?? 0);

        // Inserir na fila
        $stmt = $db->prepare("
            INSERT INTO fila (tenant_id, paciente_id, especialidade_id, estacao, status, prioridade, senha)
            VALUES (:tid, :pid, :eid, :est, 'aguardando', :prio, :senha)
        ");
        $stmt->execute([
            ':tid'  => $tid,
            ':pid'  => $ag['paciente_id'],
            ':eid'  => $ag['especialidade_id'],
            ':est'  => $primeiraEstacao,
            ':prio' => $prioridade,
            ':senha' => $senha,
        ]);
        $filaId = (int)$db->lastInsertId();

        // Atualizar agendamento
        $db->prepare("UPDATE agendamentos SET status = 'realizado', fila_id = :fid WHERE id = :id")
           ->execute([':fid' => $filaId, ':id' => $id]);

        echo json_encode([
            'message'  => 'Check-in realizado com sucesso',
            'fila_id'  => $filaId,
            'estacao'  => $primeiraEstacao,
            'senha'    => $senha,
        ]);
    }

    // ===================================================
    // Médico-Especialidade (pivot)
    // ===================================================

    /**
     * GET /api/medicos/{id}/especialidades
     */
    public static function medicoEspecialidades(int $medicoId): void {
        Auth::requireTela('medicos');
        $db  = Database::getInstance();
        $tid = Tenant::id();

        // Verificar acesso
        $stmt = $db->prepare('SELECT id FROM medicos WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $medicoId, ':tid' => $tid]);
        if (!$stmt->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Médico não encontrado']);
            return;
        }

        $stmt = $db->prepare('
            SELECT e.id, e.nome, e.cor
            FROM medico_especialidades me
            JOIN especialidades e ON e.id = me.especialidade_id
            WHERE me.medico_id = :mid AND e.tenant_id = :tid
            ORDER BY e.nome ASC
        ');
        $stmt->execute([':mid' => $medicoId, ':tid' => $tid]);
        echo json_encode($stmt->fetchAll());
    }

    /**
     * PUT /api/medicos/{id}/especialidades
     * Body: { "especialidade_ids": [1, 2, 3] }
     */
    public static function setMedicoEspecialidades(int $medicoId): void {
        Auth::requireTela('medicos');
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $db    = Database::getInstance();
        $tid   = Tenant::id();

        $stmt = $db->prepare('SELECT id FROM medicos WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $medicoId, ':tid' => $tid]);
        if (!$stmt->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Médico não encontrado']);
            return;
        }

        $ids = array_filter(array_map('intval', $input['especialidade_ids'] ?? []), fn($v) => $v > 0);

        // Substituir completamente
        $db->prepare('DELETE FROM medico_especialidades WHERE medico_id = :mid')
           ->execute([':mid' => $medicoId]);

        if (!empty($ids)) {
            $stmt = $db->prepare('
                INSERT IGNORE INTO medico_especialidades (medico_id, especialidade_id)
                SELECT :mid, e.id FROM especialidades e WHERE e.id = :eid AND e.tenant_id = :tid
            ');
            foreach ($ids as $eid) {
                $stmt->execute([':mid' => $medicoId, ':eid' => $eid, ':tid' => $tid]);
            }
        }

        echo json_encode(['message' => 'Especialidades do médico atualizadas']);
    }

    // ===================================================
    // Helpers privados
    // ===================================================

    private static function msgAgendamento(string $nome, string $dataHora, string $esp, ?string $medico): string {
        $dt  = new DateTime($dataHora);
        $fmt = $dt->format('d/m/Y \à\s H:i');
        $msg = "Olá, *{$nome}*! 👋\n\n";
        $msg .= "Seu agendamento foi marcado:\n";
        $msg .= "📅 *{$fmt}*\n";
        $msg .= "🏥 *{$esp}*";
        if ($medico) $msg .= "\n👨‍⚕️ Dr(a). *{$medico}*";
        $msg .= "\n\nPor favor, chegue com 15 minutos de antecedência e traga seus documentos. Até logo!";
        return $msg;
    }

    private static function msgConfirmacao(string $nome, string $dataHora, string $esp, ?string $medico): string {
        $dt  = new DateTime($dataHora);
        $fmt = $dt->format('d/m/Y \à\s H:i');
        $msg = "✅ Olá, *{$nome}*!\n\n";
        $msg .= "Seu agendamento foi *confirmado*:\n";
        $msg .= "📅 *{$fmt}*\n";
        $msg .= "🏥 *{$esp}*";
        if ($medico) $msg .= "\n👨‍⚕️ Dr(a). *{$medico}*";
        $msg .= "\n\nAté logo! 😊";
        return $msg;
    }

    /**
     * Envia mensagem WhatsApp via Evolution API (configurável no .env).
     * Se não configurado, retorna false silenciosamente.
     */
    private static function sendWhatsApp(string $telefone, string $message): bool {
        Env::load();
        $url      = Env::get('WHATSAPP_URL',      '');
        $token    = Env::get('WHATSAPP_TOKEN',     '');
        $instance = Env::get('WHATSAPP_INSTANCE',  'default');

        if (!$url || !$token) {
            return false; // WhatsApp não configurado
        }

        // Normalizar número: remover não-dígitos, garantir DDI 55
        $number = preg_replace('/\D/', '', $telefone);
        if (strlen($number) <= 11) {
            $number = '55' . $number;
        }

        // Evolution API
        $endpoint = rtrim($url, '/') . "/message/sendText/{$instance}";
        $payload  = json_encode(['number' => $number, 'text' => $message]);

        $ch = curl_init($endpoint);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $payload,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 10,
            CURLOPT_HTTPHEADER     => [
                'Content-Type: application/json',
                'apikey: ' . $token,
            ],
        ]);
        curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        return $httpCode >= 200 && $httpCode < 300;
    }
}
