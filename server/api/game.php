<?php
/**
 * SOCIOBEAST GENESIS v12 — Game API (front-end polling)
 * GET  ?action=state&since=<eventId>   → game state + queued world events
 * GET  ?action=guardians               → recent guardians to spawn
 * GET  ?action=fragments               → permanent land fragments
 * POST {action:'report', spirits:N}    → front reports colony size (quests)
 * POST {action:'end_season', admin_token} (admin)
 * POST {action:'demo_event', ...}      → simulate a TikTok event (demo mode)
 */
header('Content-Type: application/json');
header('Cache-Control: no-store');

require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/helpers.php';
require_once __DIR__ . '/../includes/game_engine.php';

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$action = $input['action'] ?? $_GET['action'] ?? 'state';

try {
    switch ($action) {
        case 'state':
            $since = (int)($_GET['since'] ?? $input['since'] ?? 0);
            $state = GameEngine::tick();
            $events = GameEngine::drainEvents($since);
            echo json_encode(['success' => true, 'game' => $state, 'events' => $events,
                              'lastId' => $events ? end($events)['id'] : $since]);
            break;

        case 'guardians':
            echo json_encode(['success' => true, 'guardians' => GameEngine::recentGuardians((int)($_GET['n'] ?? 400))]);
            break;

        case 'fragments':
            echo json_encode(['success' => true, 'fragments' => GameEngine::getFragments()]);
            break;

        case 'report':
            GameEngine::reportSpirits((int)($input['spirits'] ?? 0));
            echo json_encode(['success' => true]);
            break;

        case 'demo_event':
            $type = $input['type'] ?? 'like';
            $r = GameEngine::handleLiveEvent($type, $input);
            echo json_encode(['success' => true, 'result' => $r]);
            break;

        case 'end_season':
            session_start();
            $isAdmin = !empty($_SESSION['admin_logged_in']) || (!empty($input['admin_password']) && password_verify($input['admin_password'], getConfig('admin_password', '')));
            if (!$isAdmin) { http_response_code(403); echo json_encode(['error' => 'admin only']); break; }
            echo json_encode(['success' => true] + GameEngine::endSeason());
            break;

        default:
            echo json_encode(['error' => 'unknown action']);
    }
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
