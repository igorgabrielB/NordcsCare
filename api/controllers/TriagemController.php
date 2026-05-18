<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../middleware/tenant.php';

class TriagemController {

    private static function calcImc(?float $peso, ?float $altura): ?float {
        if (!$peso || !$altura || $altura <= 0) return null;
        $m = $altura / 100.0;
        return round($peso / ($m * $m), 2);
    }

    private static function prioOk(?string $v): string {
        return in_array($v, ['azul','verde','amarelo','laranja','vermelho'], true) ? $v : 'verde';
    }

    /**
     * GET /api/triagem
     * ?data=YYYY-MM-DD (padrão hoje)
     * ?paciente_id=N   (histórico de um paciente)
     */
    public static function index(): void {
        Auth::requireAuth();
        $db     = Database::getInstance();
        $tid    = Tenant::id();
        $data   = $_GET['data']        ?? date('Y-m-d');
        $pid    = isset($_GET['paciente_id']) ? (int)$_GET['paciente_id'] : null;

        $sql = 'SELECT t.*,
                       p.nome_completo, p.codigo AS paciente_codigo, p.data_nascimento,
                       u.nome AS usuario_nome,
                       e.nome AS especialidade_nome, e.cor AS especialidade_cor
                FROM triagem t
                JOIN pacientes p ON p.id = t.paciente_id
                JOIN usuarios  u ON u.id = t.usuario_id
                LEFT JOIN especialidades e ON e.id = t.especialidade_id
                WHERE t.tenant_id = :tid';

        $params = [':tid' => $tid];

        if ($pid) {
            $sql .= ' AND t.paciente_id = :pid ORDER BY t.created_at DESC LIMIT 50';
            $params[':pid'] = $pid;
        } else {
            $sql .= ' AND DATE(t.created_at) = :data ORDER BY
                      FIELD(t.prioridade,\'vermelho\',\'laranja\',\'amarelo\',\'verde\',\'azul\'), t.created_at ASC';
            $params[':data'] = $data;
        }

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        foreach ($rows as &$row) {
            if (!empty($row['data_nascimento'])) {
                $row['idade'] = (int) date_diff(
                    new DateTime($row['data_nascimento']), new DateTime()
                )->y;
            }
        }
        unset($row);

        echo json_encode(['data' => $rows]);
    }

    /**
     * POST /api/triagem
     */
    public static function store(): void {
        $user = Auth::requireAuth();
        $db  = Database::getInstance();
        $tid = Tenant::id();
        $uid = (int)$user['sub'];

        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        if (empty($body['paciente_id'])) {
            http_response_code(422);
            echo json_encode(['error' => 'paciente_id é obrigatório']);
            return;
        }

        $peso   = isset($body['peso'])   && $body['peso']   !== '' ? (float)$body['peso']   : null;
        $altura = isset($body['altura']) && $body['altura'] !== '' ? (float)$body['altura'] : null;
        $imc    = self::calcImc($peso, $altura);

        $stmt = $db->prepare(
            'INSERT INTO triagem
               (tenant_id, paciente_id, usuario_id, especialidade_id,
                pa_sistolica, pa_diastolica,
                frequencia_cardiaca, frequencia_respiratoria, saturacao_o2, temperatura,
                peso, altura, imc, glicemia,
                queixa_principal, dor_escala, prioridade, observacoes)
             VALUES
               (:tid, :pid, :uid, :eid,
                :pas, :pad,
                :fc,  :fr,  :spo2, :temp,
                :peso,:alt, :imc,  :gli,
                :queixa, :dor, :prio, :obs)'
        );

        $stmt->execute([
            ':tid'  => $tid,
            ':pid'  => (int)$body['paciente_id'],
            ':uid'  => $uid,
            ':eid'  => !empty($body['especialidade_id']) ? (int)$body['especialidade_id'] : null,
            ':pas'  => isset($body['pa_sistolica'])          && $body['pa_sistolica']          !== '' ? (int)$body['pa_sistolica']          : null,
            ':pad'  => isset($body['pa_diastolica'])         && $body['pa_diastolica']         !== '' ? (int)$body['pa_diastolica']         : null,
            ':fc'   => isset($body['frequencia_cardiaca'])   && $body['frequencia_cardiaca']   !== '' ? (int)$body['frequencia_cardiaca']   : null,
            ':fr'   => isset($body['frequencia_respiratoria']) && $body['frequencia_respiratoria'] !== '' ? (int)$body['frequencia_respiratoria'] : null,
            ':spo2' => isset($body['saturacao_o2'])          && $body['saturacao_o2']          !== '' ? (int)$body['saturacao_o2']          : null,
            ':temp' => isset($body['temperatura'])           && $body['temperatura']           !== '' ? (float)$body['temperatura']          : null,
            ':peso' => $peso,
            ':alt'  => $altura,
            ':imc'  => $imc,
            ':gli'  => isset($body['glicemia'])              && $body['glicemia']              !== '' ? (int)$body['glicemia']              : null,
            ':queixa' => !empty($body['queixa_principal']) ? $body['queixa_principal'] : null,
            ':dor'  => isset($body['dor_escala'])            && $body['dor_escala'] !== '' ? (int)$body['dor_escala'] : null,
            ':prio' => self::prioOk($body['prioridade'] ?? null),
            ':obs'  => !empty($body['observacoes']) ? $body['observacoes'] : null,
        ]);

        $id = (int)$db->lastInsertId();
        $stmt2 = $db->prepare(
            'SELECT t.*, p.nome_completo, p.codigo AS paciente_codigo, p.data_nascimento,
                    u.nome AS usuario_nome, e.nome AS especialidade_nome, e.cor AS especialidade_cor
             FROM triagem t
             JOIN pacientes p ON p.id = t.paciente_id
             JOIN usuarios  u ON u.id = t.usuario_id
             LEFT JOIN especialidades e ON e.id = t.especialidade_id
             WHERE t.id = :id'
        );
        $stmt2->execute([':id' => $id]);
        $row = $stmt2->fetch();

        http_response_code(201);
        echo json_encode(['data' => $row, 'message' => 'Triagem registrada com sucesso']);
    }

    /**
     * GET /api/triagem/{id}
     */
    public static function show(int $id): void {
        Auth::requireAuth();
        $db  = Database::getInstance();
        $tid = Tenant::id();

        $stmt = $db->prepare(
            'SELECT t.*, p.nome_completo, p.codigo AS paciente_codigo, p.data_nascimento,
                    u.nome AS usuario_nome, e.nome AS especialidade_nome, e.cor AS especialidade_cor
             FROM triagem t
             JOIN pacientes p ON p.id = t.paciente_id
             JOIN usuarios  u ON u.id = t.usuario_id
             LEFT JOIN especialidades e ON e.id = t.especialidade_id
             WHERE t.id = :id AND t.tenant_id = :tid'
        );
        $stmt->execute([':id' => $id, ':tid' => $tid]);
        $row = $stmt->fetch();

        if (!$row) {
            http_response_code(404);
            echo json_encode(['error' => 'Registro não encontrado']);
            return;
        }
        echo json_encode(['data' => $row]);
    }

    /**
     * PUT /api/triagem/{id}
     */
    public static function update(int $id): void {
        Auth::requireAuth();
        $db  = Database::getInstance();
        $tid = Tenant::id();

        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        $peso   = isset($body['peso'])   && $body['peso']   !== '' ? (float)$body['peso']   : null;
        $altura = isset($body['altura']) && $body['altura'] !== '' ? (float)$body['altura'] : null;
        $imc    = self::calcImc($peso, $altura);

        $stmt = $db->prepare(
            'UPDATE triagem SET
               especialidade_id     = :eid,
               pa_sistolica         = :pas,
               pa_diastolica        = :pad,
               frequencia_cardiaca  = :fc,
               frequencia_respiratoria = :fr,
               saturacao_o2         = :spo2,
               temperatura          = :temp,
               peso                 = :peso,
               altura               = :alt,
               imc                  = :imc,
               glicemia             = :gli,
               queixa_principal     = :queixa,
               dor_escala           = :dor,
               prioridade           = :prio,
               observacoes          = :obs
             WHERE id = :id AND tenant_id = :tid'
        );

        $stmt->execute([
            ':eid'  => !empty($body['especialidade_id']) ? (int)$body['especialidade_id'] : null,
            ':pas'  => isset($body['pa_sistolica'])          && $body['pa_sistolica']          !== '' ? (int)$body['pa_sistolica']          : null,
            ':pad'  => isset($body['pa_diastolica'])         && $body['pa_diastolica']         !== '' ? (int)$body['pa_diastolica']         : null,
            ':fc'   => isset($body['frequencia_cardiaca'])   && $body['frequencia_cardiaca']   !== '' ? (int)$body['frequencia_cardiaca']   : null,
            ':fr'   => isset($body['frequencia_respiratoria']) && $body['frequencia_respiratoria'] !== '' ? (int)$body['frequencia_respiratoria'] : null,
            ':spo2' => isset($body['saturacao_o2'])          && $body['saturacao_o2']          !== '' ? (int)$body['saturacao_o2']          : null,
            ':temp' => isset($body['temperatura'])           && $body['temperatura']           !== '' ? (float)$body['temperatura']          : null,
            ':peso' => $peso,
            ':alt'  => $altura,
            ':imc'  => $imc,
            ':gli'  => isset($body['glicemia'])              && $body['glicemia']              !== '' ? (int)$body['glicemia']              : null,
            ':queixa' => !empty($body['queixa_principal']) ? $body['queixa_principal'] : null,
            ':dor'  => isset($body['dor_escala']) && $body['dor_escala'] !== '' ? (int)$body['dor_escala'] : null,
            ':prio' => self::prioOk($body['prioridade'] ?? null),
            ':obs'  => !empty($body['observacoes']) ? $body['observacoes'] : null,
            ':id'   => $id,
            ':tid'  => $tid,
        ]);

        echo json_encode(['message' => 'Triagem atualizada']);
    }

    /**
     * DELETE /api/triagem/{id}
     */
    public static function destroy(int $id): void {
        Auth::requireAuth();
        $db  = Database::getInstance();
        $tid = Tenant::id();

        $db->prepare('DELETE FROM triagem WHERE id = :id AND tenant_id = :tid')
           ->execute([':id' => $id, ':tid' => $tid]);

        echo json_encode(['message' => 'Triagem removida']);
    }
}
