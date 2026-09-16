<?php
/**
 * SOCIOBEAST GENESIS v11 — Admin Streaming
 */
session_start();
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/helpers.php';

if (!isset($_SESSION['admin_logged_in']) || $_SESSION['admin_logged_in'] !== true) {
    header('Location: login.php');
    exit;
}

$message = '';
$db = Database::get();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';
    
    if ($action === 'start_stream') {
        $platform = $_POST['platform'] ?? 'youtube';
        $streamId = $_POST['stream_id'] ?? '';
        
        // End existing sessions
        $db->exec("UPDATE streaming_sessions SET is_active = 0, ended_at = datetime('now') WHERE is_active = 1");
        
        // Start new session
        $stmt = $db->prepare("INSERT INTO streaming_sessions (platform, stream_id, is_active) VALUES (?, ?, 1)");
        $stmt->execute([$platform, $streamId]);
        
        setConfig('streaming_enabled', '1');
        $message = "🔴 Streaming session started on $platform!";
    }
    
    if ($action === 'stop_stream') {
        $db->exec("UPDATE streaming_sessions SET is_active = 0, ended_at = datetime('now') WHERE is_active = 1");
        setConfig('streaming_enabled', '0');
        $message = "⏹️ Streaming session ended.";
    }
}

// Get current session
$currentSession = $db->query("SELECT * FROM streaming_sessions WHERE is_active = 1 ORDER BY id DESC LIMIT 1")->fetch();

// Get recent sessions
$recentSessions = $db->query("SELECT * FROM streaming_sessions ORDER BY id DESC LIMIT 20")->fetchAll();

// Build OBS config
$protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
$host = $_SERVER['HTTP_HOST'];
$basePath = dirname(dirname($_SERVER['REQUEST_URI']));
$liveUrl = $protocol . '://' . $host . rtrim($basePath, '/') . '/index.php';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Streaming — SocioBeast Admin</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #0a0f0a 0%, #1a251a 100%);
            color: #d0e8d0;
            min-height: 100vh;
            padding: 20px;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        h1 { color: #70b870; margin-bottom: 20px; }
        .message { background: rgba(112, 184, 112, 0.2); border: 1px solid #70b870; padding: 12px 20px; border-radius: 8px; margin-bottom: 20px; }
        nav { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
        nav a { color: #90c890; text-decoration: none; padding: 8px 16px; background: rgba(112, 184, 112, 0.1); border-radius: 6px; }
        nav a:hover { background: rgba(112, 184, 112, 0.2); }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px; }
        .card { background: rgba(20, 30, 20, 0.8); border: 1px solid rgba(112, 184, 112, 0.3); border-radius: 12px; padding: 20px; }
        .card h2 { color: #90c890; margin-bottom: 15px; font-size: 18px; }
        label { display: block; margin-bottom: 5px; color: #90c890; font-size: 14px; }
        input, select, textarea { width: 100%; padding: 10px; margin-bottom: 15px; background: rgba(0,0,0,0.3); border: 1px solid rgba(112, 184, 112, 0.3); border-radius: 6px; color: #d0e8d0; font-size: 14px; font-family: monospace; }
        textarea { min-height: 80px; resize: vertical; }
        button { background: linear-gradient(135deg, #4a7c4a 0%, #3a5c3a 100%); color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 14px; }
        button:hover { background: linear-gradient(135deg, #5a8c5a 0%, #4a6c4a 100%); }
        button.danger { background: linear-gradient(135deg, #7c4a4a 0%, #5c3a3a 100%); }
        .live-indicator { display: flex; align-items: center; gap: 10px; padding: 20px; background: rgba(255, 0, 0, 0.1); border: 2px solid rgba(255, 0, 0, 0.4); border-radius: 12px; margin-bottom: 20px; }
        .live-indicator.offline { background: rgba(100, 100, 100, 0.1); border-color: rgba(100, 100, 100, 0.4); }
        .live-dot { width: 16px; height: 16px; background: #ff4444; border-radius: 50%; animation: pulse 1s infinite; }
        .live-indicator.offline .live-dot { background: #666; animation: none; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .code-block { background: rgba(0,0,0,0.4); padding: 15px; border-radius: 8px; font-family: monospace; font-size: 13px; overflow-x: auto; margin-bottom: 15px; }
        .step { background: rgba(112, 184, 112, 0.1); padding: 12px; margin-bottom: 8px; border-radius: 6px; border-left: 3px solid #70b870; }
        .step-num { color: #70b870; font-weight: bold; margin-right: 8px; }
        .session-item { background: rgba(0,0,0,0.2); padding: 12px; margin-bottom: 8px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; }
        .session-item.active { border-left: 3px solid #ff4444; }
        .session-meta { color: #708070; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>📡 Streaming</h1>
        
        <nav>
            <a href="index.php">📊 Dashboard</a>
            <a href="island.php">🌲 Island</a>
            <a href="config.php">⚙️ Configuration</a>
            <a href="memory.php">🧠 Memory</a>
            <a href="mythology.php">📜 Mythology</a>
            <a href="streaming.php">📡 Streaming</a>
            <a href="logout.php">🚪 Logout</a>
        </nav>

        <?php if ($message): ?>
        <div class="message"><?= htmlspecialchars($message) ?></div>
        <?php endif; ?>

        <!-- Live Status -->
        <div class="live-indicator <?= $currentSession ? '' : 'offline' ?>">
            <div class="live-dot"></div>
            <div>
                <?php if ($currentSession): ?>
                <strong>🔴 LIVE</strong> on <?= htmlspecialchars(ucfirst($currentSession['platform'])) ?>
                <div style="font-size:12px;color:#708070">Started: <?= $currentSession['started_at'] ?></div>
                <?php else: ?>
                <strong>⏹️ OFFLINE</strong>
                <div style="font-size:12px;color:#708070">No active streaming session</div>
                <?php endif; ?>
            </div>
            <?php if ($currentSession): ?>
            <form method="POST" style="margin-left:auto">
                <input type="hidden" name="action" value="stop_stream">
                <button type="submit" class="danger">⏹️ End Stream</button>
            </form>
            <?php endif; ?>
        </div>

        <div class="grid">
            <!-- Start Stream -->
            <div class="card">
                <h2>🚀 Start Streaming Session</h2>
                <form method="POST">
                    <input type="hidden" name="action" value="start_stream">
                    <label>Platform</label>
                    <select name="platform">
                        <option value="youtube">YouTube Live</option>
                        <option value="tiktok">TikTok LIVE</option>
                        <option value="twitch">Twitch</option>
                        <option value="web">Web Only</option>
                    </select>
                    <label>Stream ID (optional)</label>
                    <input type="text" name="stream_id" placeholder="YouTube video ID or stream key">
                    <button type="submit">🔴 Start Streaming Session</button>
                </form>
            </div>

            <!-- OBS Setup -->
            <div class="card">
                <h2>🎬 OBS Browser Source Setup</h2>
                
                <div class="step"><span class="step-num">1.</span> In OBS, click "+" under Sources</div>
                <div class="step"><span class="step-num">2.</span> Select "Browser"</div>
                <div class="step"><span class="step-num">3.</span> Use these settings:</div>
                
                <label>URL</label>
                <div class="code-block"><?= htmlspecialchars($liveUrl) ?></div>
                
                <label>Width × Height</label>
                <div class="code-block">1920 × 1080</div>
                
                <label>Custom CSS (for transparency)</label>
                <textarea readonly>body { background: transparent !important; }
#creature-canvas { background: transparent !important; }</textarea>
                
                <div class="step"><span class="step-num">4.</span> Check "Shutdown source when not visible"</div>
                <div class="step"><span class="step-num">5.</span> Click OK</div>
            </div>

            <!-- YouTube RTMP -->
            <div class="card">
                <h2>📺 YouTube RTMP Info</h2>
                <label>RTMP Server</label>
                <div class="code-block">rtmp://a.rtmp.youtube.com/live2</div>
                
                <label>Stream Key</label>
                <div class="code-block">
                    <?php 
                    $key = getConfig('youtube_stream_key', '');
                    echo $key ? '****' . substr($key, -4) : 'Not configured - set in Configuration';
                    ?>
                </div>
                
                <p style="color:#708070;font-size:12px;margin-top:10px">
                    Get your stream key from YouTube Studio → Go Live → Stream
                </p>
            </div>

            <!-- Recent Sessions -->
            <div class="card">
                <h2>📋 Recent Sessions</h2>
                <?php if (empty($recentSessions)): ?>
                <p style="color:#708070">No streaming sessions yet.</p>
                <?php else: ?>
                <?php foreach ($recentSessions as $session): ?>
                <div class="session-item <?= $session['is_active'] ? 'active' : '' ?>">
                    <div>
                        <strong><?= htmlspecialchars(ucfirst($session['platform'])) ?></strong>
                        <?= $session['is_active'] ? '🔴' : '' ?>
                        <div class="session-meta">
                            <?= $session['started_at'] ?>
                            <?= $session['ended_at'] ? ' → ' . $session['ended_at'] : '' ?>
                        </div>
                    </div>
                    <div style="text-align:right">
                        <div style="color:#70b870"><?= $session['total_interactions'] ?? 0 ?> interactions</div>
                        <div class="session-meta">Peak: <?= $session['peak_viewers'] ?? 0 ?> viewers</div>
                    </div>
                </div>
                <?php endforeach; ?>
                <?php endif; ?>
            </div>
        </div>
    </div>
</body>
</html>
