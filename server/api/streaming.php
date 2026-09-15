<?php
/**
 * SOCIOBEAST GENESIS v11 — YouTube Streaming API
 * Manage YouTube Live streaming integration
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

$input = json_decode(file_get_contents('php://input'), true) ?? [];
$action = $input['action'] ?? $_GET['action'] ?? 'status';

try {
    switch ($action) {
        case 'status':
            // Get current streaming status
            $db = Database::get();
            $session = $db->query("SELECT * FROM streaming_sessions WHERE is_active = 1 ORDER BY id DESC LIMIT 1")->fetch();
            
            echo json_encode([
                'success' => true,
                'streaming' => (bool)$session,
                'session' => $session,
                'youtube_configured' => !empty(getConfig('youtube_api_key'))
            ]);
            break;

        case 'start':
            // Start a new streaming session
            $platform = $input['platform'] ?? 'youtube';
            $streamId = $input['stream_id'] ?? null;
            
            $db = Database::get();
            
            // End any existing active sessions
            $db->exec("UPDATE streaming_sessions SET is_active = 0, ended_at = datetime('now') WHERE is_active = 1");
            
            // Create new session
            $stmt = $db->prepare("INSERT INTO streaming_sessions (platform, stream_id, is_active) VALUES (?, ?, 1)");
            $stmt->execute([$platform, $streamId]);
            
            setConfig('streaming_enabled', '1');
            
            echo json_encode([
                'success' => true,
                'session_id' => $db->lastInsertId(),
                'message' => 'Streaming session started'
            ]);
            break;

        case 'stop':
            // Stop streaming session
            $db = Database::get();
            
            // Get current session stats
            $session = $db->query("SELECT * FROM streaming_sessions WHERE is_active = 1")->fetch();
            
            $db->exec("UPDATE streaming_sessions SET is_active = 0, ended_at = datetime('now') WHERE is_active = 1");
            setConfig('streaming_enabled', '0');
            
            echo json_encode([
                'success' => true,
                'message' => 'Streaming session ended',
                'session' => $session
            ]);
            break;

        case 'update_stats':
            // Update streaming statistics
            $viewers = (int)($input['viewers'] ?? 0);
            $interactions = (int)($input['interactions'] ?? 0);
            
            $db = Database::get();
            $stmt = $db->prepare("UPDATE streaming_sessions SET 
                peak_viewers = MAX(peak_viewers, ?),
                total_interactions = total_interactions + ?
                WHERE is_active = 1");
            $stmt->execute([$viewers, $interactions]);
            
            echo json_encode(['success' => true]);
            break;

        case 'get_obs_config':
            // Get OBS browser source configuration
            $creatureName = getConfig('creature_name', 'SocioBeast');
            $baseUrl = (isset($_SERVER['HTTPS']) ? 'https' : 'http') . '://' . $_SERVER['HTTP_HOST'] . dirname($_SERVER['REQUEST_URI']);
            
            echo json_encode([
                'success' => true,
                'obs_config' => [
                    'url' => rtrim($baseUrl, '/') . '/index.php',
                    'width' => 1920,
                    'height' => 1080,
                    'fps' => 30,
                    'css' => '
                        body { 
                            background: transparent !important; 
                        }
                        #creature-canvas { 
                            background: transparent !important; 
                        }
                    ',
                    'instructions' => [
                        '1. In OBS, add a new Browser Source',
                        '2. Set URL to: ' . rtrim($baseUrl, '/') . '/index.php',
                        '3. Set Width: 1920, Height: 1080',
                        '4. Check "Shutdown source when not visible"',
                        '5. Add the custom CSS provided above for transparency'
                    ]
                ]
            ]);
            break;

        case 'get_rtmp_info':
            // Get YouTube RTMP streaming info
            $streamKey = getConfig('youtube_stream_key', '');
            
            echo json_encode([
                'success' => true,
                'rtmp' => [
                    'server' => 'rtmp://a.rtmp.youtube.com/live2',
                    'stream_key' => $streamKey ? '****' . substr($streamKey, -4) : 'Not configured',
                    'has_key' => !empty($streamKey)
                ]
            ]);
            break;

        case 'sessions':
            // Get streaming history
            $limit = min(50, (int)($input['limit'] ?? 20));
            $db = Database::get();
            $sessions = $db->query("SELECT * FROM streaming_sessions ORDER BY id DESC LIMIT $limit")->fetchAll();
            
            echo json_encode([
                'success' => true,
                'sessions' => $sessions
            ]);
            break;

        default:
            echo json_encode(['error' => 'Unknown action']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
