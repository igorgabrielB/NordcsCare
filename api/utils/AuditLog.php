<?php
require_once __DIR__ . '/../config/database.php';

class AuditLog {
    /**
     * Registra uma ação no log de auditoria.
     *
     * @param string      $acao       Ex: 'criar', 'editar', 'excluir', 'login', 'importar'
     * @param string      $entidade   Ex: 'paciente', 'usuario', 'fila', 'prontuario'
     * @param int|null    $entidadeId ID do registro afetado
     * @param string|null $detalhes   Descrição extra (opcional)
     * @param array|null  $user       Dados do usuário autenticado (sub, nome, role)
     */
    public static function registrar(
        string $acao,
        string $entidade,
        ?int $entidadeId = null,
        ?string $detalhes = null,
        ?array $user = null
    ): void {
        try {
            $db = Database::getInstance();
            $stmt = $db->prepare(
                'INSERT INTO audit_log (usuario_id, usuario_nome, usuario_role, acao, entidade, entidade_id, detalhes, ip)
                 VALUES (:uid, :nome, :role, :acao, :entidade, :eid, :detalhes, :ip)'
            );
            $stmt->execute([
                ':uid'      => $user['sub'] ?? null,
                ':nome'     => $user['nome'] ?? 'Sistema',
                ':role'     => $user['role'] ?? null,
                ':acao'     => $acao,
                ':entidade' => $entidade,
                ':eid'      => $entidadeId,
                ':detalhes' => $detalhes,
                ':ip'       => $_SERVER['REMOTE_ADDR'] ?? null,
            ]);
        } catch (\Throwable $e) {
            // Nunca deixar o audit log quebrar a operação principal
            error_log('AuditLog error: ' . $e->getMessage());
        }
    }
}
