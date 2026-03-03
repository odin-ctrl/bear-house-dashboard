<?php
/**
 * Bear House Dashboard - Authentication API
 */
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// Default users (will be created if users.json doesn't exist)
$defaultUsers = [
    ['username' => 'martin', 'password' => '2308', 'name' => 'Martin', 'role' => 'admin', 'location' => 'all'],
    ['username' => 'torstein', 'password' => '1504', 'name' => 'Torstein', 'role' => 'staff', 'location' => 'nesbyen'],
    ['username' => 'elisabeth', 'password' => '0101', 'name' => 'Elisabeth', 'role' => 'staff', 'location' => 'nesbyen'],
    ['username' => 'julia', 'password' => '0505', 'name' => 'Julia', 'role' => 'staff', 'location' => 'hemsedal'],
    ['username' => 'malin', 'password' => '1212', 'name' => 'Malin', 'role' => 'staff', 'location' => 'al']
];

// Load or create users
$users = loadJSON('users.json', []);
if (empty($users)) {
    $users = $defaultUsers;
    saveJSON('users.json', $users);
}

switch ($action) {
    case 'login':
        if ($method !== 'POST') {
            errorResponse('Method not allowed', 405);
        }
        
        $input = json_decode(file_get_contents('php://input'), true);
        $username = strtolower(trim($input['username'] ?? ''));
        $password = trim($input['password'] ?? '');
        
        if (empty($username) || empty($password)) {
            errorResponse('Brukernavn og passord kreves');
        }
        
        // Find user
        $foundUser = null;
        foreach ($users as $user) {
            if (strtolower($user['username']) === $username && $user['password'] === $password) {
                $foundUser = $user;
                break;
            }
        }
        
        if (!$foundUser) {
            // Log failed attempt
            $loginLog = loadJSON('login-log.json', []);
            $loginLog[] = [
                'timestamp' => date('c'),
                'username' => $username,
                'success' => false,
                'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown'
            ];
            saveJSON('login-log.json', array_slice($loginLog, -1000)); // Keep last 1000
            
            errorResponse('Feil brukernavn eller passord', 401);
        }
        
        // Create session
        $_SESSION['user'] = [
            'username' => $foundUser['username'],
            'name' => $foundUser['name'],
            'role' => $foundUser['role'],
            'location' => $foundUser['location'],
            'loginTime' => time()
        ];
        
        // Log successful login
        $loginLog = loadJSON('login-log.json', []);
        $loginLog[] = [
            'timestamp' => date('c'),
            'username' => $username,
            'success' => true,
            'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown'
        ];
        saveJSON('login-log.json', array_slice($loginLog, -1000));
        
        // Generate token for API calls
        $token = bin2hex(random_bytes(32));
        $_SESSION['token'] = $token;
        
        jsonResponse([
            'success' => true,
            'user' => $_SESSION['user'],
            'token' => $token
        ]);
        break;
        
    case 'logout':
        session_destroy();
        jsonResponse(['success' => true]);
        break;
        
    case 'check':
        if (isAuthenticated()) {
            jsonResponse([
                'authenticated' => true,
                'user' => getUser()
            ]);
        } else {
            jsonResponse([
                'authenticated' => false
            ]);
        }
        break;
        
    case 'users':
        requireAuth();
        $user = getUser();
        if ($user['role'] !== 'admin') {
            errorResponse('Admin access required', 403);
        }
        
        if ($method === 'GET') {
            // Return users without passwords
            $safeUsers = array_map(function($u) {
                return [
                    'username' => $u['username'],
                    'name' => $u['name'],
                    'role' => $u['role'],
                    'location' => $u['location']
                ];
            }, $users);
            jsonResponse($safeUsers);
        } elseif ($method === 'POST') {
            $input = json_decode(file_get_contents('php://input'), true);
            // Add/update user logic here
            jsonResponse(['success' => true]);
        }
        break;
        
    default:
        errorResponse('Unknown action', 404);
}
