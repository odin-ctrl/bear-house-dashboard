<?php
/**
 * Bear House Dashboard - Configuration
 * PHP version for Domeneshop hosting
 */

// Error handling
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// CORS headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Auth-Token, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Data directory
define('DATA_DIR', __DIR__ . '/../data/');
if (!is_dir(DATA_DIR)) {
    mkdir(DATA_DIR, 0755, true);
}

// Favrit API config
define('FAVRIT_CLIENT_ID', '7d35e68d-8d28-4e30-aec4-e80dfdf8feeb');
define('FAVRIT_CLIENT_SECRET', '4fa-IHDx8~krJPpRu~.SKIWB1M');
define('FAVRIT_API_BASE', 'https://favrit.com/ws/accounting-api-service');

// Planday API config
define('PLANDAY_CLIENT_ID', 'eea0dc07-83f6-4df7-9792-79b120ba7839');
define('PLANDAY_REFRESH_TOKEN', 'MTnGQFLsIECNhGOFEwYrNg');
define('PLANDAY_TOKEN_URL', 'https://id.planday.com/connect/token');
define('PLANDAY_API_BASE', 'https://openapi.planday.com');

// Location IDs
$LOCATIONS = [
    'nesbyen' => 113593088,
    'hemsedal' => 248457994,
    'hemsedal_takeaway' => 252780678,
    'al_bakeri' => 114571637,
    'al_bearhouse' => 146824761,
    'nesbyen_pizzeria' => 136213164
];

// Departments
$DEPARTMENTS = [
    16761 => ['name' => 'Bakeri Nesbyen', 'location' => 'nesbyen'],
    16854 => ['name' => 'Bakeri Hemsedal', 'location' => 'hemsedal'],
    16851 => ['name' => 'Produksjon', 'location' => 'nesbyen'],
    16852 => ['name' => 'Bakeri Ål', 'location' => 'al'],
    16853 => ['name' => 'Burger Ål', 'location' => 'al']
];

// Helper functions
function loadJSON($file, $default = []) {
    $path = DATA_DIR . $file;
    if (file_exists($path)) {
        $content = file_get_contents($path);
        return json_decode($content, true) ?: $default;
    }
    return $default;
}

function saveJSON($file, $data) {
    $path = DATA_DIR . $file;
    file_put_contents($path, json_encode($data, JSON_PRETTY_PRINT));
}

function jsonResponse($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data);
    exit;
}

function errorResponse($message, $status = 400) {
    jsonResponse(['error' => $message], $status);
}

// Session management
session_start();

function isAuthenticated() {
    return isset($_SESSION['user']) && !empty($_SESSION['user']);
}

function requireAuth() {
    if (!isAuthenticated()) {
        errorResponse('Unauthorized', 401);
    }
}

function getUser() {
    return $_SESSION['user'] ?? null;
}
