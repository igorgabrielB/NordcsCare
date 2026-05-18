<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../middleware/tenant.php';

/**
 * PermissaoController
 * Gerencia o catálogo de telas e as permissões por usuário.
 */
class PermissaoController {

    // -- GET /api/permissoes/telas ----------------------------
    // Retorna todas as telas ativas do catálogo
    public static function telas(): void {
        Auth::requireTela('perfis');
        $db = Database::getInstance();

        $stmt = $db->prepare(
            'SELECT codigo, nome, descricao, icone, categoria, rota, requer_admin, ordem
             FROM telas WHERE ativo = 1 ORDER BY ordem ASC'
        );
        $stmt->execute();
        echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    // -- GET /api/permissoes/usuario/{id} ---------------------
    // Retorna as telas liberadas para um usuário específico
    public static function getUsuario(int $userId): void {
        Auth::requireTela('perfis');
        $db = Database::getInstance();
        $tenantId = Tenant::id();

        // Verifica que o usuário pertence ao tenant
        $chk = $db->prepare('SELECT id FROM usuarios WHERE id = :id AND tenant_id = :tid');
        $chk->execute([':id' => $userId, ':tid' => $tenantId]);
        if (!$chk->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Usuário não encontrado']);
            return;
        }

        $stmt = $db->prepare(
            'SELECT tela_codigo FROM usuario_telas
             WHERE usuario_id = :uid AND tenant_id = :tid'
        );
        $stmt->execute([':uid' => $userId, ':tid' => $tenantId]);
        $telas = array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'tela_codigo');

        echo json_encode(['usuario_id' => $userId, 'telas' => $telas]);
    }

    // -- GET /api/permissoes/me -------------------------------
    // Retorna as telas do próprio usuário autenticado
    public static function getMe(): void {
        $user = Auth::requireAuth();
        $db = Database::getInstance();
        $tenantId = (int)($user['tenant_id'] ?? 0);
        $userId   = (int)($user['sub'] ?? 0);
        $role     = $user['role'] ?? '';

        // Master e admin têm acesso total — retorna todas as telas ativas do catálogo
        if (in_array($role, ['master', 'admin'])) {
            $stmt = $db->prepare('SELECT codigo FROM telas WHERE ativo = 1');
            $stmt->execute();
            $telas = array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'codigo');
            echo json_encode(['telas' => $telas]);
            return;
        }

        $stmt = $db->prepare(
            'SELECT tela_codigo FROM usuario_telas
             WHERE usuario_id = :uid AND tenant_id = :tid'
        );
        $stmt->execute([':uid' => $userId, ':tid' => $tenantId]);
        $telas = array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'tela_codigo');

        echo json_encode(['telas' => $telas]);
    }

    // -- PUT /api/permissoes/usuario/{id} ---------------------
    // Salva (substitui) as telas de um usuário
    public static function setUsuario(int $userId): void {
        Auth::requireTela('perfis');
        $db = Database::getInstance();
        $tenantId = Tenant::id();

        $input = json_decode(file_get_contents('php://input'), true);
        $telas = $input['telas'] ?? [];

        if (!is_array($telas)) {
            http_response_code(422);
            echo json_encode(['error' => 'Campo "telas" deve ser um array']);
            return;
        }

        // Verifica que o usuário pertence ao tenant
        $chk = $db->prepare('SELECT id, role FROM usuarios WHERE id = :id AND tenant_id = :tid');
        $chk->execute([':id' => $userId, ':tid' => $tenantId]);
        $targetUser = $chk->fetch();
        if (!$targetUser) {
            http_response_code(404);
            echo json_encode(['error' => 'Usuário não encontrado']);
            return;
        }

        // Admin não pode editar permissões de outro admin/master
        if (in_array($targetUser['role'], ['admin', 'master'])) {
            // Admins têm acesso total — não precisa de linha na tabela
            echo json_encode(['message' => 'Admins têm acesso total automaticamente']);
            return;
        }

        // Valida que os códigos existem
        if (!empty($telas)) {
            $placeholders = implode(',', array_fill(0, count($telas), '?'));
            $valid = $db->prepare("SELECT codigo FROM telas WHERE codigo IN ($placeholders) AND ativo = 1");
            $valid->execute($telas);
            $telas = array_column($valid->fetchAll(PDO::FETCH_ASSOC), 'codigo');
        }

        $db->beginTransaction();
        try {
            // Remove permissões anteriores
            $del = $db->prepare(
                'DELETE FROM usuario_telas WHERE usuario_id = :uid AND tenant_id = :tid'
            );
            $del->execute([':uid' => $userId, ':tid' => $tenantId]);

            // Insere novas
            if (!empty($telas)) {
                $ins = $db->prepare(
                    'INSERT IGNORE INTO usuario_telas (usuario_id, tela_codigo, tenant_id)
                     VALUES (:uid, :tela, :tid)'
                );
                foreach ($telas as $codigo) {
                    $ins->execute([':uid' => $userId, ':tela' => $codigo, ':tid' => $tenantId]);
                }
            }

            $db->commit();
            echo json_encode(['message' => 'Permissões salvas', 'telas' => $telas]);
        } catch (\Throwable $e) {
            $db->rollBack();
            http_response_code(500);
            echo json_encode(['error' => 'Erro ao salvar permissões']);
        }
    }
}
