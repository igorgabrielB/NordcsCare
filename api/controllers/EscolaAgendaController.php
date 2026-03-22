<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';

class EscolaAgendaController {

    /** GET /api/escola-agenda  — lista agenda (filtro opcional ?mes=YYYY-MM) */
    public static function index(): void {
        Auth::requireAuth();
        $db = Database::getInstance();

        $mes = $_GET['mes'] ?? null;

        if ($mes && preg_match('/^\d{4}-\d{2}$/', $mes)) {
            $stmt = $db->prepare(
                "SELECT ea.*, (SELECT COUNT(*) FROM pacientes p WHERE p.escola = ea.escola) as total_alunos
                 FROM escola_agenda ea
                 WHERE DATE_FORMAT(ea.data_atendimento, '%Y-%m') = :mes
                 ORDER BY ea.data_atendimento ASC, ea.escola ASC"
            );
            $stmt->execute([':mes' => $mes]);
        } else {
            $stmt = $db->query(
                "SELECT ea.*, (SELECT COUNT(*) FROM pacientes p WHERE p.escola = ea.escola) as total_alunos
                 FROM escola_agenda ea
                 ORDER BY ea.data_atendimento ASC, ea.escola ASC"
            );
        }

        echo json_encode($stmt->fetchAll());
    }

    /** GET /api/escola-agenda/hoje — escolas agendadas para hoje + contagem de alunos */
    public static function hoje(): void {
        Auth::requireAuth();
        $db = Database::getInstance();

        $hoje = date('Y-m-d');
        $stmt = $db->prepare(
            "SELECT ea.escola, COUNT(p.id) as total_alunos
             FROM escola_agenda ea
             LEFT JOIN pacientes p ON p.escola = ea.escola
             WHERE ea.data_atendimento = :hoje
             GROUP BY ea.escola
             ORDER BY ea.escola ASC"
        );
        $stmt->execute([':hoje' => $hoje]);

        echo json_encode($stmt->fetchAll());
    }

    /** POST /api/escola-agenda  — adicionar datas para uma escola */
    public static function store(): void {
        Auth::requireRole(['admin']);
        $db = Database::getInstance();

        $body = json_decode(file_get_contents('php://input'), true);
        $escola = trim($body['escola'] ?? '');
        $datas = $body['datas'] ?? [];

        if (!$escola) {
            http_response_code(400);
            echo json_encode(['error' => 'Escola é obrigatória']);
            return;
        }

        if (empty($datas) || !is_array($datas)) {
            http_response_code(400);
            echo json_encode(['error' => 'Informe ao menos uma data']);
            return;
        }

        $inseridos = 0;
        $stmt = $db->prepare(
            "INSERT IGNORE INTO escola_agenda (escola, data_atendimento) VALUES (:escola, :data)"
        );

        foreach ($datas as $data) {
            if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $data)) {
                $stmt->execute([':escola' => $escola, ':data' => $data]);
                $inseridos += $stmt->rowCount();
            }
        }

        echo json_encode(['inseridos' => $inseridos]);
    }

    /** DELETE /api/escola-agenda/{id}  — remover uma data específica */
    public static function destroy(int $id): void {
        Auth::requireRole(['admin']);
        $db = Database::getInstance();

        $stmt = $db->prepare("DELETE FROM escola_agenda WHERE id = :id");
        $stmt->execute([':id' => $id]);

        echo json_encode(['ok' => true]);
    }

    /** DELETE /api/escola-agenda  — remover por escola+data (via query params) */
    public static function destroyByEscolaData(): void {
        Auth::requireRole(['admin']);
        $db = Database::getInstance();

        $body = json_decode(file_get_contents('php://input'), true);
        $escola = trim($body['escola'] ?? '');
        $data = trim($body['data'] ?? '');

        if (!$escola || !$data) {
            http_response_code(400);
            echo json_encode(['error' => 'Escola e data são obrigatórios']);
            return;
        }

        $stmt = $db->prepare("DELETE FROM escola_agenda WHERE escola = :escola AND data_atendimento = :data");
        $stmt->execute([':escola' => $escola, ':data' => $data]);

        echo json_encode(['ok' => true, 'removed' => $stmt->rowCount()]);
    }
}
