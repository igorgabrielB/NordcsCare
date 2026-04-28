<?php
require_once "/var/www/html/api/config/database.php";
require_once "/var/www/html/api/middleware/auth.php";
$db = Database::getInstance();

$stmt = $db->query("SELECT id, nome, login, role FROM usuarios LIMIT 1");
$user = $stmt->fetch(PDO::FETCH_ASSOC);
$token = Auth::generateToken($user);

$baseUrl = 'https://nordcscare.com.br';
$ch = curl_init();
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: Bearer $token",
    "Content-Type: application/json"
]);

// Test resumo
curl_setopt($ch, CURLOPT_URL, "$baseUrl/api/historico/resumo?data_inicio=2026-03-01&data_fim=2026-04-10");
$resp = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
echo "/api/historico/resumo: HTTP $code\n";
echo substr($resp, 0, 500) . "\n";

curl_close($ch);

// Now test the actual endpoints
$baseUrl = 'https://nordcscare.com.br';
$ch = curl_init();
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: Bearer $token",
    "Content-Type: application/json"
]);

// Test escolas
curl_setopt($ch, CURLOPT_URL, "$baseUrl/api/historico/escolas");
$resp = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
echo "/api/historico/escolas: HTTP $code\n";
echo substr($resp, 0, 200) . "\n\n";

// Test resumo - capture full response
curl_setopt($ch, CURLOPT_URL, "$baseUrl/api/historico/resumo?data_inicio=2026-03-01&data_fim=2026-04-10");
$resp = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
echo "/api/historico/resumo: HTTP $code\n";
echo "Full response: " . $resp . "\n\n";

// Test resumo without filters
curl_setopt($ch, CURLOPT_URL, "$baseUrl/api/historico/resumo");
$resp = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
echo "/api/historico/resumo (no filters): HTTP $code\n";
echo "Full response: " . $resp . "\n\n";

// Test historico list
curl_setopt($ch, CURLOPT_URL, "$baseUrl/api/historico?data_inicio=2026-03-01&data_fim=2026-04-10&page=1&limit=2");
$resp = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
echo "/api/historico: HTTP $code\n";
echo substr($resp, 0, 500) . "\n";

curl_close($ch);
