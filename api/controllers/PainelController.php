<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';

class PainelController {

    /**
     * GET /api/painel — Retorna as últimas chamadas do painel de senha.
     * Requer autenticação (a tela do painel deve estar logada).
     */
    public static function index(): void {
        Auth::requireAuth();

        $db = Database::getInstance();
        $tenantId = Tenant::id();

        // Últimas 10 chamadas do dia, ordenadas da mais recente para a mais antiga
        $stmt = $db->prepare(
            'SELECT f.id, f.senha, f.estacao, f.chamada_em, p.nome_completo
             FROM fila f
             JOIN pacientes p ON p.id = f.paciente_id
             WHERE f.tenant_id = :tid
               AND f.chamada_em IS NOT NULL
               AND DATE(f.chamada_em) = CURDATE()
             ORDER BY f.chamada_em DESC
             LIMIT 10'
        );
        $stmt->execute([':tid' => $tenantId]);
        $chamadas = $stmt->fetchAll();

        $estacaoLabels = [
            'acuidade'        => 'Acuidade Visual',
            'laudos'          => 'Laudos',
            'oculos'          => 'Óculos',
            'altas'           => 'Altas',
            'encaminhamentos' => 'Encaminhamentos',
        ];

        $result = array_map(function ($row) use ($estacaoLabels) {
            return [
                'id'             => (int)$row['id'],
                'senha'          => $row['senha'],
                'nome_completo'  => $row['nome_completo'],
                'estacao'        => $row['estacao'],
                'estacao_label'  => $estacaoLabels[$row['estacao']] ?? $row['estacao'],
                'chamada_em'     => $row['chamada_em'],
            ];
        }, $chamadas);

        echo json_encode($result);
    }
}
