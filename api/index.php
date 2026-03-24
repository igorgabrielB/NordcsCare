<?php
require_once __DIR__ . '/config/env.php';
Env::load();

// HTTPS redirect em produção
if (Env::get('FORCE_HTTPS', 'false') === 'true') {
    if (empty($_SERVER['HTTPS']) || $_SERVER['HTTPS'] === 'off') {
        $redirectUrl = 'https://' . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI'];
        header('Location: ' . $redirectUrl, true, 301);
        exit;
    }
    header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
}

// Security headers
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('X-XSS-Protection: 1; mode=block');

// CORS
$allowedOrigins = array_map('trim', explode(',', Env::get('CORS_ORIGIN', 'http://localhost:5173')));
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins, true)) {
    header("Access-Control-Allow-Origin: $origin");
}
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Max-Age: 86400');

// Preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Rate limiting para login
if (str_contains($_SERVER['REQUEST_URI'], '/api/auth/login') && $_SERVER['REQUEST_METHOD'] === 'POST') {
    require_once __DIR__ . '/middleware/rate_limit.php';
    RateLimit::check();
}

require_once __DIR__ . '/routes/router.php';

// Parse URI
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Remove /NordcsCare prefix if present (XAMPP htdocs structure)
$basePath = '/NordcsCare';
if (str_starts_with($uri, $basePath)) {
    $uri = substr($uri, strlen($basePath));
}

$method = $_SERVER['REQUEST_METHOD'];

$router->resolve($method, $uri);
