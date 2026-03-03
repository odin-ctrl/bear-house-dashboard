<?php
/**
 * Bear House Dashboard - Favrit API Proxy
 * Handles OAuth and proxies requests to Favrit
 */
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// Token cache file
$tokenFile = DATA_DIR . 'favrit-token.json';

/**
 * Get Favrit access token (with caching)
 */
function getFavritToken() {
    global $tokenFile;
    
    // Check cached token
    if (file_exists($tokenFile)) {
        $cached = json_decode(file_get_contents($tokenFile), true);
        if ($cached && isset($cached['expires_at']) && time() < $cached['expires_at'] - 60) {
            return $cached['access_token'];
        }
    }
    
    // Get new token
    $ch = curl_init('https://favrit.com/oauth/token');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query([
            'grant_type' => 'client_credentials',
            'client_id' => FAVRIT_CLIENT_ID,
            'client_secret' => FAVRIT_CLIENT_SECRET
        ]),
        CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded']
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 200) {
        return null;
    }
    
    $data = json_decode($response, true);
    if (!isset($data['access_token'])) {
        return null;
    }
    
    // Cache token
    $expiresIn = $data['expires_in'] ?? 3600;
    $data['expires_at'] = time() + $expiresIn;
    file_put_contents($tokenFile, json_encode($data));
    
    return $data['access_token'];
}

/**
 * Make Favrit API request
 */
function favritAPI($endpoint, $params = []) {
    $token = getFavritToken();
    if (!$token) {
        return ['error' => 'Failed to get access token'];
    }
    
    $url = FAVRIT_API_BASE . $endpoint;
    if (!empty($params)) {
        $url .= '?' . http_build_query($params);
    }
    
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $token,
            'Accept: text/csv'
        ]
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 200) {
        return ['error' => 'API request failed', 'status' => $httpCode];
    }
    
    return $response;
}

/**
 * Parse CSV response to array
 */
function parseCSV($csv) {
    $lines = explode("\n", trim($csv));
    if (count($lines) < 2) return [];
    
    $headers = str_getcsv($lines[0], ';');
    $data = [];
    
    for ($i = 1; $i < count($lines); $i++) {
        $values = str_getcsv($lines[$i], ';');
        if (count($values) === count($headers)) {
            $row = array_combine($headers, $values);
            $data[] = $row;
        }
    }
    
    return $data;
}

// Require authentication for all Favrit endpoints
requireAuth();

switch ($action) {
    case 'sales':
        // Get sales data for a location and date range
        $locationId = $_GET['location'] ?? '';
        $fromDate = $_GET['from'] ?? date('Y-m-d', strtotime('-1 day'));
        $toDate = $_GET['to'] ?? date('Y-m-d');
        
        if (empty($locationId)) {
            errorResponse('Location ID required');
        }
        
        $response = favritAPI("/api/orderlines/v3/$locationId", [
            'from-date' => $fromDate . 'T00:00:00',
            'to-date' => $toDate . 'T23:59:59'
        ]);
        
        if (is_array($response) && isset($response['error'])) {
            jsonResponse($response, 500);
        }
        
        $data = parseCSV($response);
        jsonResponse(['data' => $data, 'count' => count($data)]);
        break;
        
    case 'today':
        // Get today's sales summary for all locations
        global $LOCATIONS;
        
        $today = date('Y-m-d');
        $summaries = [];
        
        foreach ($LOCATIONS as $name => $id) {
            $response = favritAPI("/api/orderlines/v3/$id", [
                'from-date' => $today . 'T00:00:00',
                'to-date' => $today . 'T23:59:59'
            ]);
            
            if (!is_array($response)) {
                $data = parseCSV($response);
                $total = 0;
                $orderCount = 0;
                
                foreach ($data as $row) {
                    if (($row['order_line_type'] ?? '') === 'ORDER_LINE') {
                        $total += floatval($row['amount_with_vat'] ?? 0);
                        $orderCount++;
                    }
                }
                
                $summaries[$name] = [
                    'total' => round($total, 2),
                    'orders' => $orderCount,
                    'avgTicket' => $orderCount > 0 ? round($total / $orderCount, 2) : 0
                ];
            }
        }
        
        jsonResponse($summaries);
        break;
        
    case 'locations':
        // Return available locations
        global $LOCATIONS;
        jsonResponse($LOCATIONS);
        break;
        
    default:
        errorResponse('Unknown action', 404);
}
