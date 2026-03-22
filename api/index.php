<?php
header('Content-Type: application/json; charset=utf-8');

// CORS
$allowedOrigin = 'http://localhost:5173';
if (isset($_SERVER['HTTP_ORIGIN']) && $_SERVER['HTTP_ORIGIN'] === $allowedOrigin) {
    header("Access-Control-Allow-Origin: $allowedOrigin");
}
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Max-Age: 86400');

// Preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
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
