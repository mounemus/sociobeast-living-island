<?php
/**
 * SOCIOBEAST — TikTok Live relay
 *   POST { secret, events: [{type, username, displayName, count, text, giftName, coins}], heartbeat? }   ← bridge/tiktok-bridge.js
 *   GET  ?since=<id>   → { events: [...], lastId, bridgeAlive }                                             ← the game page (1 Hz)
 * The game logic runs in the browser; this file only queues events for one hour.
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$cfg = require __DIR__ . '/config.php';
@mkdir(dirname($cfg['db']), 0775, true);
$db = new PDO('sqlite:' . $cfg['db']);
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$db->exec('CREATE TABLE IF NOT EXISTS live_events (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, type TEXT, username TEXT, display_name TEXT, count INTEGER, text TEXT, gift_name TEXT, coins INTEGER);
           CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)');
$allowed = ['like', 'comment', 'gift', 'follow', 'share', 'join'];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $in = json_decode(file_get_contents('php://input'), true) ?: [];
    if ($cfg['bridge_secret'] !== '' && !hash_equals($cfg['bridge_secret'], (string)($in['secret'] ?? ''))) { http_response_code(403); echo json_encode(['error' => 'bad secret']); exit; }
    if (isset($in['heartbeat'])) $db->prepare('REPLACE INTO meta (k, v) VALUES ("ping", ?)')->execute([(string)time()]);
    $ins = $db->prepare('INSERT INTO live_events (ts, type, username, display_name, count, text, gift_name, coins) VALUES (?,?,?,?,?,?,?,?)');
    $n = 0;
    foreach (array_slice($in['events'] ?? [], 0, 200) as $e) {
        if (!in_array($e['type'] ?? '', $allowed, true)) continue;
        $ins->execute([time(), $e['type'], mb_substr((string)($e['username'] ?? ''), 0, 64), mb_substr((string)($e['displayName'] ?? $e['username'] ?? ''), 0, 64),
                       (int)($e['count'] ?? 1), mb_substr((string)($e['text'] ?? ''), 0, 300), mb_substr((string)($e['giftName'] ?? ''), 0, 64), (int)($e['coins'] ?? 0)]);
        $n++;
    }
    if (mt_rand(1, 20) === 1) $db->exec('DELETE FROM live_events WHERE ts < ' . (time() - 3600));
    echo json_encode(['success' => true, 'queued' => $n]);
    exit;
}

$since = (int)($_GET['since'] ?? 0);
if ($since === 0) { $since = (int)$db->query('SELECT COALESCE(MAX(id), 0) FROM live_events')->fetchColumn(); } // a fresh page starts now, not an hour ago
$q = $db->prepare('SELECT id, type, username, display_name AS displayName, count, text, gift_name AS giftName, coins FROM live_events WHERE id > ? ORDER BY id LIMIT 300');
$q->execute([$since]);
$events = array_map(function($e) { foreach (['id', 'count', 'coins'] as $k) $e[$k] = (int)$e[$k]; return $e; }, $q->fetchAll(PDO::FETCH_ASSOC));
$ping = (int)($db->query('SELECT v FROM meta WHERE k = "ping"')->fetchColumn() ?: 0);
echo json_encode(['events' => $events, 'lastId' => $events ? (int)end($events)['id'] : $since, 'bridgeAlive' => time() - $ping < 90]);
