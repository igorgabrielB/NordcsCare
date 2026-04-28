<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../middleware/tenant.php';

class UploadController {

    private static string $uploadDir = __DIR__ . '/../../uploads/';

    private static function ensureDir(): void {
        if (!is_dir(self::$uploadDir)) {
            mkdir(self::$uploadDir, 0755, true);
        }
    }

    // Listar uploads de um paciente
    public static function index(int $pacienteId): void {
        Auth::requireAuth();
        $db = Database::getInstance();

        $stmt = $db->prepare(
            'SELECT u.*, usr.nome AS uploaded_by_nome
             FROM uploads u
             JOIN usuarios usr ON usr.id = u.uploaded_by
             WHERE u.paciente_id = :pid AND u.tenant_id = :tid
             ORDER BY u.created_at DESC'
        );
        $stmt->execute([':pid' => $pacienteId, ':tid' => Tenant::id()]);
        echo json_encode($stmt->fetchAll());
    }

    // Upload de arquivo
    public static function store(int $pacienteId): void {
        $user = Auth::requireAuth();
        $db = Database::getInstance();

        // Verifica paciente
        $stmt = $db->prepare('SELECT id FROM pacientes WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $pacienteId, ':tid' => Tenant::id()]);
        if (!$stmt->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Paciente não encontrado']);
            return;
        }

        if (empty($_FILES['arquivo'])) {
            http_response_code(422);
            echo json_encode(['error' => 'Nenhum arquivo enviado']);
            return;
        }

        $file = $_FILES['arquivo'];
        if ($file['error'] !== UPLOAD_ERR_OK) {
            http_response_code(422);
            echo json_encode(['error' => 'Erro no upload do arquivo']);
            return;
        }

        // Validar tipo
        $allowedMimes = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ];
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);

        if (!in_array($mime, $allowedMimes, true)) {
            http_response_code(422);
            echo json_encode(['error' => 'Tipo de arquivo não permitido. Aceitos: imagens, PDF, DOC/DOCX']);
            return;
        }

        // Validar tamanho (10MB)
        if ($file['size'] > 10 * 1024 * 1024) {
            http_response_code(422);
            echo json_encode(['error' => 'Arquivo excede o limite de 10MB']);
            return;
        }

        self::ensureDir();

        // Gerar nome seguro
        $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
        $ext = preg_replace('/[^a-zA-Z0-9]/', '', $ext);
        $novoNome = $pacienteId . '_' . bin2hex(random_bytes(8)) . '.' . $ext;
        $destino = self::$uploadDir . $novoNome;

        if (!move_uploaded_file($file['tmp_name'], $destino)) {
            http_response_code(500);
            echo json_encode(['error' => 'Falha ao salvar arquivo']);
            return;
        }

        $tipo = $_POST['tipo'] ?? 'documento';
        $nomeOriginal = basename($file['name']);

        $stmt = $db->prepare(
            'INSERT INTO uploads (tenant_id, paciente_id, tipo, nome_arquivo, caminho_arquivo, uploaded_by)
             VALUES (:tid, :pid, :tipo, :nome, :caminho, :uid)'
        );
        $stmt->execute([
            ':tid' => Tenant::id(),
            ':pid' => $pacienteId,
            ':tipo' => $tipo,
            ':nome' => $nomeOriginal,
            ':caminho' => 'uploads/' . $novoNome,
            ':uid' => $user['sub'],
        ]);

        http_response_code(201);
        echo json_encode([
            'message' => 'Arquivo enviado com sucesso',
            'id' => (int) $db->lastInsertId(),
            'nome_arquivo' => $nomeOriginal,
            'caminho_arquivo' => 'uploads/' . $novoNome,
        ]);
    }

    // Download/visualizar arquivo
    public static function download(int $id): void {
        Auth::requireAuth();
        $db = Database::getInstance();

        $stmt = $db->prepare('SELECT * FROM uploads WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $id, ':tid' => Tenant::id()]);
        $upload = $stmt->fetch();

        if (!$upload) {
            http_response_code(404);
            echo json_encode(['error' => 'Arquivo não encontrado']);
            return;
        }

        $filePath = __DIR__ . '/../../' . $upload['caminho_arquivo'];

        if (!file_exists($filePath)) {
            http_response_code(404);
            echo json_encode(['error' => 'Arquivo não encontrado no servidor']);
            return;
        }

        $realBase = realpath(__DIR__ . '/../../uploads/');
        $realFile = realpath($filePath);
        if ($realFile === false || strpos($realFile, $realBase) !== 0) {
            http_response_code(403);
            echo json_encode(['error' => 'Acesso negado']);
            return;
        }

        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime = finfo_file($finfo, $realFile);
        finfo_close($finfo);

        header('Content-Type: ' . $mime);
        header('Content-Disposition: inline; filename="' . $upload['nome_arquivo'] . '"');
        header('Content-Length: ' . filesize($realFile));
        readfile($realFile);
        exit;
    }

    // Excluir arquivo
    public static function destroy(int $id): void {
        $user = Auth::requireAuth();
        $db = Database::getInstance();

        $stmt = $db->prepare('SELECT * FROM uploads WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $id, ':tid' => Tenant::id()]);
        $upload = $stmt->fetch();

        if (!$upload) {
            http_response_code(404);
            echo json_encode(['error' => 'Arquivo não encontrado']);
            return;
        }

        $filePath = __DIR__ . '/../../' . $upload['caminho_arquivo'];
        if (file_exists($filePath)) {
            $realBase = realpath(__DIR__ . '/../../uploads/');
            $realFile = realpath($filePath);
            if ($realFile !== false && strpos($realFile, $realBase) === 0) {
                unlink($realFile);
            }
        }

        $stmt = $db->prepare('DELETE FROM uploads WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $id, ':tid' => Tenant::id()]);
        echo json_encode(['message' => 'Arquivo excluído com sucesso']);
    }
}
