<?php
$BASE_URL = 'http://localhost/NordcsCare/api';

function req($method, $url, $data = null, $token = '') {
    $ch = curl_init();
    curl_setopt_array($ch, [CURLOPT_URL => $url, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 30, CURLOPT_CUSTOMREQUEST => $method]);
    $headers = ['Content-Type: application/json'];
    if ($token) $headers[] = "Authorization: Bearer $token";
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    if ($data !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    $response = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['status' => $code, 'body' => json_decode($response, true), 'raw' => $response];
}

// Login
$r = req('POST', "$BASE_URL/auth/login", ['login' => 'admin', 'senha' => 'admin123']);
$token = $r['body']['token'];
echo "Login: {$r['status']}\n";

// Create test patient
$r = req('POST', "$BASE_URL/pacientes", [
    'nome_completo' => 'Debug Exames Test',
    'data_nascimento' => '2015-01-01',
    'sexo' => 'M',
    'escola' => 'Debug',
    'responsavel' => 'Resp',
    'telefone' => '(11) 91234-5678',
], $token);
$pid = $r['body']['id'];
echo "Paciente criado: ID=$pid (status {$r['status']})\n";

// Add to fila
$r = req('POST', "$BASE_URL/fila", ['paciente_id' => $pid, 'escola' => 'Debug'], $token);
echo "Fila checkin: {$r['status']} - {$r['raw']}\n";

// Send exames
$r = req('POST', "$BASE_URL/prontuario/$pid/atendimento", [
    'exames' => [
        ['tipo_exame' => 'biomicroscopia', 'olho' => 'AO', 'resultado' => 'Sem alterações'],
    ]
], $token);
echo "Exames: status={$r['status']} body={$r['raw']}\n";

// Cleanup
req('DELETE', "$BASE_URL/pacientes/$pid", null, $token);
echo "Cleanup done\n";
