<?php
/**
 * SOCIOBEAST v14 — Event API (on-page interactions: clicks, demo audience, admin buttons)
 * Thin wrapper over GameEngine::handleLiveEvent so page interactions and TikTok events
 * share one rule set. Keeps the v11 response shape expected by assets/app.js.
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/helpers.php';
require_once __DIR__ . '/../includes/state_engine.php';
require_once __DIR__ . '/../includes/memory_engine.php';
require_once __DIR__ . '/../includes/game_engine.php';

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) { echo json_encode(['error' => 'Invalid JSON']); exit; }

$type = $input['type'] ?? 'like';
$username = trim($input['username'] ?? 'anonymous') ?: 'anonymous';
$allowed = ['like', 'comment', 'gift', 'follow', 'share', 'join'];
if (!in_array($type, $allowed, true)) $type = 'like';

$response = ['success' => true, 'type' => $type, 'visualEffect' => null, 'intensity' => 1, 'speechMode' => null, 'command' => null];

try {
    $r = GameEngine::handleLiveEvent($type, $input);

    switch ($type) {
        case 'like':    $response['visualEffect'] = 'glow'; break;
        case 'gift':    $response['visualEffect'] = 'burst'; $response['intensity'] = min(3, 1 + ((int)($input['coins'] ?? $input['value'] ?? 1)) / 200); $response['speechMode'] = 'reactive'; $response['giftName'] = $input['giftName'] ?? 'gift'; break;
        case 'follow':  $response['visualEffect'] = 'sparkle'; $response['intensity'] = 1.5; $response['speechMode'] = 'greeting'; break;
        case 'share':   $response['visualEffect'] = 'ripple'; break;
        case 'comment':
            $text = strtolower(trim($input['text'] ?? ''));
            MemoryEngine::recordComment($username, $input['text'] ?? '');
            foreach (['feed', 'sleep', 'dance', 'evolve', 'hello', 'prophecy', 'dream', 'myth', 'remember', 'sing', 'calm', 'chaos'] as $cmd) {
                if (strpos($text, '!' . $cmd) !== false || $text === $cmd) { $response['command'] = $cmd; $response['speechMode'] = 'command'; break; }
            }
            if (!$response['command'] && mt_rand(0, 100) < 30) $response['speechMode'] = 'conversational';
            $response['commentText'] = $input['text'] ?? '';
            break;
    }

    if ($r['newGuardian'] ?? false) $response['speechMode'] = $response['speechMode'] ?: 'greeting';
    $response['game'] = $r['game'] ?? null;
    $response['state'] = StateEngine::getPublicState();
} catch (Throwable $e) {
    http_response_code(500);
    $response = ['success' => false, 'error' => $e->getMessage()];
}
echo json_encode($response);
