<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';

class PerfilController {

    private static string $uploadDir = __DIR__ . '/../../uploads/avatars/';
    private static string $uploadUrl = '/uploads/avatars/';

    // GET /api/perfil — retorna perfil do usuário logado
    public static function get(): void {
        $user = Auth::requireAuth();
        $db = Database::getInstance();

        $stmt = $db->prepare('SELECT id, nome, nome_social, foto_perfil, tema, login, role FROM usuarios WHERE id = :id');
        $stmt->execute([':id' => $user['sub']]);
        $perfil = $stmt->fetch();

        if (!$perfil) {
            http_response_code(404);
            echo json_encode(['error' => 'Usuário não encontrado']);
            return;
        }

        echo json_encode($perfil);
    }

    // PUT /api/perfil — atualiza nome_social
    public static function update(): void {
        $user = Auth::requireAuth();
        $input = json_decode(file_get_contents('php://input'), true);
        $db = Database::getInstance();

        $nomeSocial = isset($input['nome_social']) ? trim($input['nome_social']) : null;

        // Permite limpar o nome social enviando string vazia
        if ($nomeSocial === '') {
            $nomeSocial = null;
        }

        // Validação: max 120 chars
        if ($nomeSocial !== null && mb_strlen($nomeSocial) > 120) {
            http_response_code(422);
            echo json_encode(['error' => 'Nome social muito longo (máximo 120 caracteres)']);
            return;
        }

        $stmt = $db->prepare('UPDATE usuarios SET nome_social = :ns WHERE id = :id');
        $stmt->execute([':ns' => $nomeSocial, ':id' => $user['sub']]);

        // Retorna dados atualizados
        $stmt = $db->prepare('SELECT id, nome, nome_social, foto_perfil, login, role FROM usuarios WHERE id = :id');
        $stmt->execute([':id' => $user['sub']]);
        echo json_encode($stmt->fetch());
    }

    // POST /api/perfil/foto — upload de foto de perfil
    public static function uploadFoto(): void {
        $user = Auth::requireAuth();
        $db = Database::getInstance();

        if (empty($_FILES['foto'])) {
            http_response_code(422);
            echo json_encode(['error' => 'Nenhuma foto enviada']);
            return;
        }

        $file = $_FILES['foto'];

        // Validar tipo MIME
        $allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);

        if (!in_array($mimeType, $allowedTypes)) {
            http_response_code(422);
            echo json_encode(['error' => 'Formato inválido. Use JPG, PNG ou WebP']);
            return;
        }

        // Validar tamanho (max 2MB)
        if ($file['size'] > 2 * 1024 * 1024) {
            http_response_code(422);
            echo json_encode(['error' => 'Imagem muito grande. Máximo 2MB']);
            return;
        }

        // Criar diretório se não existir
        if (!is_dir(self::$uploadDir)) {
            mkdir(self::$uploadDir, 0755, true);
        }

        // Remover foto anterior se existir
        $stmt = $db->prepare('SELECT foto_perfil FROM usuarios WHERE id = :id');
        $stmt->execute([':id' => $user['sub']]);
        $atual = $stmt->fetchColumn();
        if ($atual) {
            $caminhoAntigo = __DIR__ . '/../../' . ltrim($atual, '/');
            if (file_exists($caminhoAntigo)) {
                unlink($caminhoAntigo);
            }
        }

        // Salvar nova foto com nome único
        $ext = match($mimeType) {
            'image/jpeg' => 'jpg',
            'image/png'  => 'png',
            'image/webp' => 'webp',
            default      => 'jpg',
        };
        $filename = 'avatar_' . $user['sub'] . '_' . time() . '.' . $ext;
        $destino = self::$uploadDir . $filename;

        if (!move_uploaded_file($file['tmp_name'], $destino)) {
            http_response_code(500);
            echo json_encode(['error' => 'Erro ao salvar imagem']);
            return;
        }

        $urlFoto = self::$uploadUrl . $filename;

        $stmt = $db->prepare('UPDATE usuarios SET foto_perfil = :foto WHERE id = :id');
        $stmt->execute([':foto' => $urlFoto, ':id' => $user['sub']]);

        echo json_encode(['foto_perfil' => $urlFoto]);
    }

    // DELETE /api/perfil/foto — remove foto de perfil
    public static function deleteFoto(): void {
        $user = Auth::requireAuth();
        $db = Database::getInstance();

        $stmt = $db->prepare('SELECT foto_perfil FROM usuarios WHERE id = :id');
        $stmt->execute([':id' => $user['sub']]);
        $atual = $stmt->fetchColumn();

        if ($atual) {
            $caminho = __DIR__ . '/../../' . ltrim($atual, '/');
            if (file_exists($caminho)) {
                unlink($caminho);
            }
        }

        $stmt = $db->prepare('UPDATE usuarios SET foto_perfil = NULL WHERE id = :id');
        $stmt->execute([':id' => $user['sub']]);

        echo json_encode(['message' => 'Foto removida']);
    }

    // PUT /api/perfil/senha — alterar própria senha
    public static function alterarSenha(): void {
        $user = Auth::requireAuth();
        $input = json_decode(file_get_contents('php://input'), true);
        $db = Database::getInstance();

        $senhaAtual = $input['senha_atual'] ?? '';
        $novaSenha  = $input['nova_senha']  ?? '';
        $confirmar  = $input['confirmar']   ?? '';

        if (empty($senhaAtual) || empty($novaSenha) || empty($confirmar)) {
            http_response_code(422);
            echo json_encode(['error' => 'Preencha todos os campos']);
            return;
        }

        if ($novaSenha !== $confirmar) {
            http_response_code(422);
            echo json_encode(['error' => 'As senhas não coincidem']);
            return;
        }

        if (mb_strlen($novaSenha) < 6) {
            http_response_code(422);
            echo json_encode(['error' => 'A nova senha deve ter pelo menos 6 caracteres']);
            return;
        }

        // Verificar senha atual
        $stmt = $db->prepare('SELECT senha FROM usuarios WHERE id = :id');
        $stmt->execute([':id' => $user['sub']]);
        $hash = $stmt->fetchColumn();

        if (!$hash || !password_verify($senhaAtual, $hash)) {
            http_response_code(401);
            echo json_encode(['error' => 'Senha atual incorreta']);
            return;
        }

        $novoHash = password_hash($novaSenha, PASSWORD_DEFAULT);
        $stmt = $db->prepare('UPDATE usuarios SET senha = :senha WHERE id = :id');
        $stmt->execute([':senha' => $novoHash, ':id' => $user['sub']]);

        echo json_encode(['message' => 'Senha alterada com sucesso']);
    }

    // PUT /api/perfil/tema — salvar preferência de tema (light/dark)
    public static function updateTema(): void {
        $user = Auth::requireAuth();
        $input = json_decode(file_get_contents('php://input'), true);
        $db = Database::getInstance();

        $tema = $input['tema'] ?? '';

        if (!in_array($tema, ['light', 'dark'], true)) {
            http_response_code(422);
            echo json_encode(['error' => 'Tema inválido. Use "light" ou "dark"']);
            return;
        }

        $stmt = $db->prepare('UPDATE usuarios SET tema = :tema WHERE id = :id');
        $stmt->execute([':tema' => $tema, ':id' => $user['sub']]);

        echo json_encode(['tema' => $tema]);
    }
}
