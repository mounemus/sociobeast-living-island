<?php
/**
 * SOCIOBEAST GENESIS v12 — TikTok Live ingest endpoint
 * Receives normalised events from bridge/tiktok-bridge.js
 * POST { secret, events: [ {type, username, displayName, count, text, giftName, coins} ] }
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/helpers.php';
require_once __DIR__ . '/../includes/game_engine.php';

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$secret = getConfig('tiktok_bridge_secret', '');
$demo = getConfig('demo_mode', '0') === '1' || isset($_GET['demo']);

if (!$demo && $secret !== '' && ($input['secret'] ?? '') !== $secret) {
    http_response_code(403);
    echo json_encode(['error' => 'Invalid bridge secret']);
    exit;
}

$events = $input['events'] ?? (isset($input['type']) ? [$input] : []);
if (isset($input['heartbeat'])) { setConfig('bridge_last_ping', (string)time()); setConfig('bridge_status', json_encode($input['heartbeat'])); }
$results = [];
$allowed = ['like', 'comment', 'gift', 'follow', 'share', 'join'];

foreach (array_slice($events, 0, 100) as $ev) {
    $type = $ev['type'] ?? '';
    if (!in_array($type, $allowed, true)) continue;
    try {
        $ev['_bridge'] = true;
        $r = GameEngine::handleLiveEvent($type, $ev);
        unset($r['game']);
        $results[] = $r;
    } catch (Throwable $e) {
        $results[] = ['type' => $type, 'error' => $e->getMessage()];
    }
}

echo json_encode(['success' => true, 'processed' => count($results), 'results' => $results, 'game' => GameEngine::publicState()]);
