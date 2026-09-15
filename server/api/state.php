<?php
/**
 * SOCIOBEAST GENESIS v11 — State API
 * Returns creature state with visual persistence
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
require_once __DIR__ . '/../includes/state_engine.php';
require_once __DIR__ . '/../includes/mythology_engine.php';

$input = json_decode(file_get_contents('php://input'), true) ?? [];
$action = $input['action'] ?? 'get';

try {
    switch ($action) {
        case 'tick':
            // Gentle state decay
            StateEngine::tick();
            $state = StateEngine::getPublicState();
            
            // Check if creature should dream or create mythology
            $autoContent = null;
            if (getConfig('mythology_enabled', '1') === '1') {
                if (MythologyEngine::shouldDream()) {
                    $autoContent = ['type' => 'dream_pending'];
                } elseif (MythologyEngine::shouldGenerateMythology()) {
                    $autoContent = ['type' => 'mythology_pending'];
                }
            }
            
            echo json_encode([
                'success' => true,
                'state' => $state,
                'auto_content' => $autoContent
            ]);
            break;

        case 'get':
            echo json_encode([
                'success' => true,
                'state' => StateEngine::getPublicState()
            ]);
            break;

        case 'sync_instances':
            // Sync visual instances from frontend
            $instances = $input['instances'] ?? [];
            if (!empty($instances)) {
                StateEngine::syncVisualInstances($instances);
            }
            echo json_encode([
                'success' => true,
                'synced' => count($instances)
            ]);
            break;

        case 'add_instance':
            // Add a new visual instance (when kodama duplicates)
            $x = (float)($input['x'] ?? (mt_rand(-250, 250) / 100));
            $z = (float)($input['z'] ?? (mt_rand(20, 80) / 100));
            $scale = (float)($input['scale'] ?? (mt_rand(40, 100) / 100));
            
            $instanceId = StateEngine::addVisualInstance($x, $z, $scale);
            
            echo json_encode([
                'success' => true,
                'instance_id' => $instanceId,
                'state' => StateEngine::getPublicState()
            ]);
            break;

        case 'new_session':
            // Record new session (called on page load)
            StateEngine::recordNewSession();
            echo json_encode([
                'success' => true,
                'state' => StateEngine::getPublicState()
            ]);
            break;

        default:
            echo json_encode(['error' => 'Unknown action']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
