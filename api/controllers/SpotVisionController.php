<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/s3.php';
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../middleware/tenant.php';

class SpotVisionController {

    /**
     * Lista os exames SpotVision de um paciente no S3
     * Verifica tanto o código original no filename quanto mapeamentos corrigidos
     * GET /api/spotvision/{pacienteId}
     */
    public static function listar(int $pacienteId): void {
        $user = Auth::requireAuth();

        $db = Database::getInstance();

        // Buscar código do paciente
        $stmt = $db->prepare('SELECT codigo FROM pacientes WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $pacienteId, ':tid' => Tenant::id()]);
        $paciente = $stmt->fetch();

        if (!$paciente || empty($paciente['codigo'])) {
            http_response_code(404);
            echo json_encode(['error' => 'Paciente não encontrado ou sem código']);
            return;
        }

        $codigo = $paciente['codigo'];
        $bucket = S3Config::getBucket();
        $s3 = S3Config::getClient();
        $prefix = 'ACUIDADE/SPOTVISION/';

        // Buscar mapeamentos corrigidos para este código
        $stmtMap = $db->prepare('SELECT s3_key FROM spotvision_mapeamento WHERE tenant_id = :tid AND codigo_correto = :codigo');
        $stmtMap->execute([':tid' => Tenant::id(), ':codigo' => $codigo]);
        $mappedKeys = array_column($stmtMap->fetchAll(), 's3_key');

        // Buscar keys que foram remapeados para OUTRO paciente (excluir do resultado original)
        $stmtExcl = $db->prepare('SELECT s3_key FROM spotvision_mapeamento WHERE tenant_id = :tid AND codigo_original = :codigo AND codigo_correto != :codigo2');
        $stmtExcl->execute([':tid' => Tenant::id(), ':codigo' => $codigo, ':codigo2' => $codigo]);
        $excludedKeys = array_column($stmtExcl->fetchAll(), 's3_key');

        try {
            $result = $s3->listObjectsV2([
                'Bucket' => $bucket,
                'Prefix' => $prefix,
            ]);

            $exames = [];
            $contents = $result['Contents'] ?? [];

            foreach ($contents as $object) {
                $key = $object['Key'];
                $filename = basename($key);
                if ($object['Size'] == 0) continue;

                // Se este key foi remapeado para outro paciente, pular
                if (in_array($key, $excludedKeys)) continue;

                // Verificar se faz match pelo mapeamento corrigido
                if (in_array($key, $mappedKeys)) {
                    $exames[] = [
                        'key'       => $key,
                        'filename'  => $filename,
                        'size'      => $object['Size'],
                        'modified'  => $object['LastModified']->format('Y-m-d H:i:s'),
                    ];
                    continue;
                }

                // Verificar match pelo código original no filename
                $parts = explode('_', pathinfo($filename, PATHINFO_FILENAME));
                $found = false;
                foreach ($parts as $part) {
                    if ($part === $codigo) { $found = true; break; }
                }
                if (!$found) continue;

                $exames[] = [
                    'key'       => $key,
                    'filename'  => $filename,
                    'size'      => $object['Size'],
                    'modified'  => $object['LastModified']->format('Y-m-d H:i:s'),
                ];
            }

            // Ordenar por data de modificação (mais recente primeiro)
            usort($exames, fn($a, $b) => strcmp($b['modified'], $a['modified']));

            echo json_encode($exames);

        } catch (\Aws\Exception\AwsException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Erro ao buscar exames: ' . $e->getMessage()]);
        }
    }

    /**
     * Serve o PDF diretamente como proxy (evita problemas de CORS)
     * GET /api/spotvision/view?key=ACUIDADE/SPOTVISION/XXX.pdf
     */
    public static function visualizar(): void {
        $user = Auth::requireAuth();

        $key = $_GET['key'] ?? '';
        if (empty($key)) {
            http_response_code(400);
            echo json_encode(['error' => 'Parâmetro key obrigatório']);
            return;
        }

        // Validar que o key está dentro da pasta ACUIDADE/SPOTVISION/
        if (strpos($key, 'ACUIDADE/SPOTVISION/') !== 0) {
            http_response_code(403);
            echo json_encode(['error' => 'Acesso negado']);
            return;
        }

        $bucket = S3Config::getBucket();
        $s3 = S3Config::getClient();

        try {
            $result = $s3->getObject([
                'Bucket' => $bucket,
                'Key'    => $key,
            ]);

            header('Content-Type: application/pdf');
            header('Content-Disposition: inline; filename="' . basename($key) . '"');
            header('Cache-Control: private, max-age=900');

            echo $result['Body'];

        } catch (\Aws\S3\Exception\S3Exception $e) {
            if ($e->getStatusCode() === 404) {
                http_response_code(404);
                echo json_encode(['error' => 'Arquivo não encontrado']);
            } else {
                http_response_code(500);
                echo json_encode(['error' => 'Erro ao servir PDF: ' . $e->getMessage()]);
            }
        }
    }

    /**
     * Retorna a primeira página do PDF como imagem PNG
     * GET /api/spotvision/image?key=ACUIDADE/SPOTVISION/XXX.pdf
     */
    public static function imagem(): void {
        $user = Auth::requireAuth();

        $key = $_GET['key'] ?? '';
        if (empty($key) || strpos($key, 'ACUIDADE/SPOTVISION/') !== 0) {
            http_response_code(403);
            echo json_encode(['error' => 'Acesso negado']);
            return;
        }

        $bucket = S3Config::getBucket();
        $s3 = S3Config::getClient();

        try {
            $result = $s3->getObject([
                'Bucket' => $bucket,
                'Key'    => $key,
            ]);

            $tmpPdf = tempnam(sys_get_temp_dir(), 'spot_') . '.pdf';
            $tmpImg = tempnam(sys_get_temp_dir(), 'spot_img_');
            file_put_contents($tmpPdf, $result['Body']);

            // Converter primeira página para PNG (300 DPI)
            exec("pdftoppm -png -f 1 -l 1 -r 200 " . escapeshellarg($tmpPdf) . " " . escapeshellarg($tmpImg), $output, $ret);

            $pngFile = $tmpImg . '-1.png';
            if ($ret === 0 && file_exists($pngFile)) {
                header('Content-Type: image/png');
                header('Cache-Control: private, max-age=900');
                readfile($pngFile);
                unlink($pngFile);
            } else {
                http_response_code(500);
                echo json_encode(['error' => 'Erro ao converter PDF para imagem']);
            }

            unlink($tmpPdf);
            @unlink($tmpImg);

        } catch (\Aws\S3\Exception\S3Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Erro: ' . $e->getMessage()]);
        }
    }

    /**
     * Lista TODOS os arquivos SpotVision do S3 com info de mapeamento (admin)
     * GET /api/spotvision-admin/all
     */
    public static function listarTodos(): void {
        $user = Auth::requireAuth();
        if (!Auth::hasTela($user, 'spotvision')) {
            http_response_code(403);
            echo json_encode(['error' => 'Acesso negado']);
            return;
        }

        $db = Database::getInstance();
        $bucket = S3Config::getBucket();
        $s3 = S3Config::getClient();
        $prefix = 'ACUIDADE/SPOTVISION/';

        try {
            $result = $s3->listObjectsV2([
                'Bucket' => $bucket,
                'Prefix' => $prefix,
            ]);

            $contents = $result['Contents'] ?? [];

            // Buscar todos os mapeamentos existentes
            $stmtMap = $db->prepare('SELECT s3_key, codigo_original, codigo_correto FROM spotvision_mapeamento WHERE tenant_id = :tid');
            $stmtMap->execute([':tid' => Tenant::id()]);
            $mapeamentos = [];
            foreach ($stmtMap->fetchAll() as $m) {
                $mapeamentos[$m['s3_key']] = $m;
            }

            // Buscar todos os pacientes (codigo -> nome) para exibição
            $stmtPac = $db->prepare('SELECT codigo, nome_completo FROM pacientes WHERE tenant_id = :tid AND codigo IS NOT NULL AND codigo != ""');
            $stmtPac->execute([':tid' => Tenant::id()]);
            $pacientes = [];
            foreach ($stmtPac->fetchAll() as $p) {
                $pacientes[$p['codigo']] = $p['nome_completo'];
            }

            // Buscar cache OCR
            $stmtOcr = $db->query('SELECT s3_key, nome_completo AS ocr_nome, individuo_id AS ocr_id FROM spotvision_ocr_cache');
            $ocrCache = [];
            foreach ($stmtOcr->fetchAll() as $o) {
                $ocrCache[$o['s3_key']] = $o;
            }

            $exames = [];
            foreach ($contents as $object) {
                $key = $object['Key'];
                $filename = basename($key);
                if ($object['Size'] == 0) continue;

                // Extrair código original do filename
                $parts = explode('_', pathinfo($filename, PATHINFO_FILENAME));
                $codigoArquivo = $parts[2] ?? '';

                $map = $mapeamentos[$key] ?? null;
                $codigoEfetivo = $map ? $map['codigo_correto'] : $codigoArquivo;

                $exames[] = [
                    'key'             => $key,
                    'filename'        => $filename,
                    'size'            => $object['Size'],
                    'modified'        => $object['LastModified']->format('Y-m-d H:i:s'),
                    'codigo_arquivo'  => $codigoArquivo,
                    'codigo_efetivo'  => $codigoEfetivo,
                    'mapeado'         => $map !== null,
                    'paciente_nome'   => $pacientes[$codigoEfetivo] ?? null,
                    'ocr_nome'        => $ocrCache[$key]['ocr_nome'] ?? null,
                    'ocr_id'          => $ocrCache[$key]['ocr_id'] ?? null,
                ];
            }

            usort($exames, fn($a, $b) => strcmp($b['modified'], $a['modified']));

            echo json_encode($exames);

        } catch (\Aws\Exception\AwsException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Erro ao buscar exames: ' . $e->getMessage()]);
        }
    }

    /**
     * Atualizar mapeamento de código de um exame SpotVision (admin)
     * PUT /api/spotvision-admin/mapear
     * Body: { key, codigo_correto }
     */
    public static function mapear(): void {
        $user = Auth::requireAuth();
        if (!Auth::hasTela($user, 'spotvision')) {
            http_response_code(403);
            echo json_encode(['error' => 'Acesso negado']);
            return;
        }

        $body = json_decode(file_get_contents('php://input'), true);
        $key = $body['key'] ?? '';
        $codigoCorreto = trim($body['codigo_correto'] ?? '');

        if (empty($key) || empty($codigoCorreto)) {
            http_response_code(400);
            echo json_encode(['error' => 'key e codigo_correto são obrigatórios']);
            return;
        }

        if (strpos($key, 'ACUIDADE/SPOTVISION/') !== 0) {
            http_response_code(403);
            echo json_encode(['error' => 'Acesso negado']);
            return;
        }

        // Extrair código original do filename
        $filename = basename($key);
        $parts = explode('_', pathinfo($filename, PATHINFO_FILENAME));
        $codigoOriginal = $parts[2] ?? '';

        // Verificar se o código correto pertence a algum paciente
        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT id, nome_completo FROM pacientes WHERE codigo = :codigo AND tenant_id = :tid LIMIT 1');
        $stmt->execute([':codigo' => $codigoCorreto, ':tid' => Tenant::id()]);
        $paciente = $stmt->fetch();

        if (!$paciente) {
            http_response_code(404);
            echo json_encode(['error' => 'Nenhum paciente encontrado com o código ' . $codigoCorreto]);
            return;
        }

        // Inserir ou atualizar mapeamento
        $stmt = $db->prepare('INSERT INTO spotvision_mapeamento (tenant_id, s3_key, codigo_original, codigo_correto, atualizado_por)
            VALUES (:tid, :key, :orig, :correto, :user_id)
            ON DUPLICATE KEY UPDATE codigo_correto = :correto2, atualizado_por = :user_id2, updated_at = NOW()');
        $stmt->execute([
            ':tid'       => Tenant::id(),
            ':key'       => $key,
            ':orig'      => $codigoOriginal,
            ':correto'   => $codigoCorreto,
            ':user_id'   => $user['sub'],
            ':correto2'  => $codigoCorreto,
            ':user_id2'  => $user['sub'],
        ]);

        echo json_encode([
            'success'       => true,
            'paciente_nome' => $paciente['nome_completo'],
            'paciente_id'   => $paciente['id'],
        ]);
    }

    /**
     * Remover mapeamento (restaurar código original) (admin)
     * DELETE /api/spotvision-admin/mapear?key=...
     */
    public static function removerMapeamento(): void {
        $user = Auth::requireAuth();
        if (!Auth::hasTela($user, 'spotvision')) {
            http_response_code(403);
            echo json_encode(['error' => 'Acesso negado']);
            return;
        }

        $key = $_GET['key'] ?? '';
        if (empty($key)) {
            http_response_code(400);
            echo json_encode(['error' => 'key obrigatório']);
            return;
        }

        $db = Database::getInstance();
        $stmt = $db->prepare('DELETE FROM spotvision_mapeamento WHERE s3_key = :key AND tenant_id = :tid');
        $stmt->execute([':key' => $key, ':tid' => Tenant::id()]);

        echo json_encode(['success' => true]);
    }

    /**
     * Processar OCR em lote para todos os PDFs sem cache (admin)
     * POST /api/spotvision-admin/ocr-batch
     * Baixa todos os PDFs, converte para PNG, chama OCR UMA vez em batch
     */
    public static function ocrBatch(): void {
        $user = Auth::requireAuth();
        if (!Auth::hasTela($user, 'spotvision')) {
            http_response_code(403);
            echo json_encode(['error' => 'Acesso negado']);
            return;
        }

        set_time_limit(600);

        $db = Database::getInstance();
        $bucket = S3Config::getBucket();
        $s3 = S3Config::getClient();
        $prefix = 'ACUIDADE/SPOTVISION/';

        // Buscar keys já no cache
        $stmtCached = $db->query('SELECT s3_key FROM spotvision_ocr_cache');
        $cached = array_column($stmtCached->fetchAll(), 's3_key');

        try {
            $result = $s3->listObjectsV2([
                'Bucket' => $bucket,
                'Prefix' => $prefix,
            ]);

            $contents = $result['Contents'] ?? [];
            $pending = [];
            foreach ($contents as $obj) {
                if ($obj['Size'] == 0) continue;
                if (!in_array($obj['Key'], $cached)) {
                    $pending[] = $obj['Key'];
                }
            }

            if (empty($pending)) {
                echo json_encode(['total_pending' => 0, 'processed' => 0, 'errors' => 0, 'results' => []]);
                return;
            }

            $processed = 0;
            $errors = 0;
            $results = [];
            $chunkSize = 5;
            $ocrScript = __DIR__ . '/../utils/spotvision_ocr.py';
            $stmtInsert = $db->prepare('INSERT INTO spotvision_ocr_cache (s3_key, nome, sobrenome, nome_completo, individuo_id)
                VALUES (:key, :nome, :sobrenome, :nome_completo, :individuo_id)
                ON DUPLICATE KEY UPDATE nome = :nome2, sobrenome = :sobrenome2, nome_completo = :nome_completo2, individuo_id = :individuo_id2');

            $chunks = array_chunk($pending, $chunkSize);

            foreach ($chunks as $chunk) {
                $pngMap = [];
                $tmpFiles = [];

                // Download and convert this chunk
                foreach ($chunk as $key) {
                    try {
                        $pdfResult = $s3->getObject(['Bucket' => $bucket, 'Key' => $key]);
                        $tmpPdf = tempnam(sys_get_temp_dir(), 'spot_b_') . '.pdf';
                        $tmpImg = tempnam(sys_get_temp_dir(), 'spot_bi_');
                        file_put_contents($tmpPdf, $pdfResult['Body']);
                        $tmpFiles[] = $tmpPdf;
                        $tmpFiles[] = $tmpImg;

                        exec("pdftoppm -png -f 1 -l 1 -r 200 " . escapeshellarg($tmpPdf) . " " . escapeshellarg($tmpImg), $output, $ret);
                        $pngFile = $tmpImg . '-1.png';

                        if ($ret === 0 && file_exists($pngFile)) {
                            $pngMap[$key] = $pngFile;
                            $tmpFiles[] = $pngFile;
                        } else {
                            $errors++;
                        }
                    } catch (\Exception $e) {
                        $errors++;
                    }
                }

                // Run OCR on this chunk
                if (!empty($pngMap)) {
                    $pathsInput = implode("\n", array_values($pngMap));
                    $descriptors = [
                        0 => ['pipe', 'r'],
                        1 => ['pipe', 'w'],
                        2 => ['pipe', 'w'],
                    ];
                    $proc = proc_open(
                        'python3 ' . escapeshellarg($ocrScript) . ' --batch-stdin',
                        $descriptors,
                        $pipes
                    );

                    if (is_resource($proc)) {
                        fwrite($pipes[0], $pathsInput);
                        fclose($pipes[0]);

                        $ocrOutput = stream_get_contents($pipes[1]);
                        fclose($pipes[1]);
                        fclose($pipes[2]);
                        proc_close($proc);

                        $ocrResults = json_decode($ocrOutput, true);
                        if (is_array($ocrResults)) {
                            $fileToKey = array_flip($pngMap);
                            foreach ($ocrResults as $ocrData) {
                                $file = $ocrData['file'] ?? '';
                                $s3Key = $fileToKey[$file] ?? null;
                                if (!$s3Key || isset($ocrData['error'])) { $errors++; continue; }

                                $stmtInsert->execute([
                                    ':key'             => $s3Key,
                                    ':nome'            => $ocrData['nome'] ?? null,
                                    ':sobrenome'       => $ocrData['sobrenome'] ?? null,
                                    ':nome_completo'   => $ocrData['nome_completo'] ?? null,
                                    ':individuo_id'    => $ocrData['individuo_id'] ?? null,
                                    ':nome2'           => $ocrData['nome'] ?? null,
                                    ':sobrenome2'      => $ocrData['sobrenome'] ?? null,
                                    ':nome_completo2'  => $ocrData['nome_completo'] ?? null,
                                    ':individuo_id2'   => $ocrData['individuo_id'] ?? null,
                                ]);
                                $processed++;
                                $results[] = ['key' => $s3Key, 'nome' => $ocrData['nome_completo']];
                            }
                        } else {
                            $errors += count($pngMap);
                        }
                    } else {
                        $errors += count($pngMap);
                    }
                }

                // Cleanup this chunk's temp files
                foreach ($tmpFiles as $f) {
                    @unlink($f);
                }
            }

            echo json_encode([
                'total_pending' => count($pending),
                'processed'     => $processed,
                'errors'        => $errors,
                'results'       => $results,
            ]);

        } catch (\Aws\Exception\AwsException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Erro S3: ' . $e->getMessage()]);
        }
    }

    /**
     * GET /api/spotvision-admin/ocr?key=ACUIDADE/SPOTVISION/XXX.pdf
     */
    public static function ocrExtrair(): void {
        $user = Auth::requireAuth();
        if (!Auth::hasTela($user, 'spotvision')) {
            http_response_code(403);
            echo json_encode(['error' => 'Acesso negado']);
            return;
        }

        $key = $_GET['key'] ?? '';
        if (empty($key) || strpos($key, 'ACUIDADE/SPOTVISION/') !== 0) {
            http_response_code(400);
            echo json_encode(['error' => 'key inválido']);
            return;
        }

        $bucket = S3Config::getBucket();
        $s3 = S3Config::getClient();

        try {
            $result = $s3->getObject([
                'Bucket' => $bucket,
                'Key'    => $key,
            ]);

            $tmpPdf = tempnam(sys_get_temp_dir(), 'spot_ocr_') . '.pdf';
            $tmpImg = tempnam(sys_get_temp_dir(), 'spot_ocr_img_');
            file_put_contents($tmpPdf, $result['Body']);

            // Converter para PNG
            exec("pdftoppm -png -f 1 -l 1 -r 200 " . escapeshellarg($tmpPdf) . " " . escapeshellarg($tmpImg), $output, $ret);

            $pngFile = $tmpImg . '-1.png';
            if ($ret !== 0 || !file_exists($pngFile)) {
                unlink($tmpPdf);
                @unlink($tmpImg);
                http_response_code(500);
                echo json_encode(['error' => 'Erro ao converter PDF para imagem']);
                return;
            }

            // Chamar script Python OCR
            $ocrScript = __DIR__ . '/../utils/spotvision_ocr.py';
            $cmd = 'python3 ' . escapeshellarg($ocrScript) . ' ' . escapeshellarg($pngFile) . ' 2>&1';
            $ocrOutput = shell_exec($cmd);

            // Cleanup
            unlink($tmpPdf);
            @unlink($pngFile);
            @unlink($tmpImg);

            $ocrData = json_decode($ocrOutput, true);
            if (!$ocrData || isset($ocrData['error'])) {
                http_response_code(500);
                echo json_encode(['error' => $ocrData['error'] ?? 'Erro no OCR', 'raw' => $ocrOutput]);
                return;
            }

            // Salvar no cache
            $db = Database::getInstance();
            $stmt = $db->prepare('INSERT INTO spotvision_ocr_cache (s3_key, nome, sobrenome, nome_completo, individuo_id)
                VALUES (:key, :nome, :sobrenome, :nome_completo, :individuo_id)
                ON DUPLICATE KEY UPDATE nome = :nome2, sobrenome = :sobrenome2, nome_completo = :nome_completo2, individuo_id = :individuo_id2');
            $stmt->execute([
                ':key'             => $key,
                ':nome'            => $ocrData['nome'] ?? null,
                ':sobrenome'       => $ocrData['sobrenome'] ?? null,
                ':nome_completo'   => $ocrData['nome_completo'] ?? null,
                ':individuo_id'    => $ocrData['individuo_id'] ?? null,
                ':nome2'           => $ocrData['nome'] ?? null,
                ':sobrenome2'      => $ocrData['sobrenome'] ?? null,
                ':nome_completo2'  => $ocrData['nome_completo'] ?? null,
                ':individuo_id2'   => $ocrData['individuo_id'] ?? null,
            ]);

            echo json_encode($ocrData);

        } catch (\Aws\S3\Exception\S3Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Erro S3: ' . $e->getMessage()]);
        }
    }
}
