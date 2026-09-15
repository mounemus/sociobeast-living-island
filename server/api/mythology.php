<?php
/**
 * SOCIOBEAST GENESIS v11 — Mythology API
 * Access and generate mythology content
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/helpers.php';
require_once __DIR__ . '/../includes/mythology_engine.php';

$input = json_decode(file_get_contents('php://input'), true) ?? [];
$action = $input['action'] ?? $_GET['action'] ?? 'get';

try {
    switch ($action) {
        case 'get':
            $limit = min(50, (int)($input['limit'] ?? $_GET['limit'] ?? 10));
            $myths = MythologyEngine::getRecentMythology($limit);
            $dreams = MythologyEngine::getDreams($limit);
            $stats = MythologyEngine::getStats();
            
            echo json_encode([
                'success' => true,
                'mythology' => $myths,
                'dreams' => $dreams,
                'stats' => $stats
            ]);
            break;

        case 'summary':
            echo json_encode([
                'success' => true,
                'summary' => MythologyEngine::getMythologySummary(),
                'context' => MythologyEngine::getMythologyContext()
            ]);
            break;

        case 'full':
            echo json_encode([
                'success' => true,
                'data' => MythologyEngine::getFullMythology()
            ]);
            break;

        default:
            echo json_encode(['error' => 'Unknown action']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
