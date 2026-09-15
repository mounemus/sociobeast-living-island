<?php
/**
 * SOCIOBEAST GENESIS v11 — Admin Memory
 */
session_start();
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/helpers.php';
require_once __DIR__ . '/../includes/memory_engine.php';

if (!isset($_SESSION['admin_logged_in']) || $_SESSION['admin_logged_in'] !== true) {
    header('Location: login.php');
    exit;
}

$message = '';
$db = Database::get();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';
    
    if ($action === 'mark_legendary') {
        $username = $_POST['username'] ?? '';
        if (!empty($username)) {
            require_once __DIR__ . '/../includes/mythology_engine.php';
            MythologyEngine::markViewerLegendary($username);
            $message = "✨ $username is now legendary!";
        }
    }
    
    if ($action === 'set_nickname') {
        $username = $_POST['username'] ?? '';
        $nickname = $_POST['nickname'] ?? '';
        if (!empty($username) && !empty($nickname)) {
            MemoryEngine::setViewerNickname($username, $nickname);
            $message = "📝 Nickname set for $username!";
        }
    }
    
    if ($action === 'clear_events') {
        $db->exec("DELETE FROM events_log");
        $message = "🗑️ Event log cleared.";
    }
}

$stats = MemoryEngine::getStats();
$topViewers = MemoryEngine::getTopViewers(20);
$topGifters = MemoryEngine::getTopGifters(10);
$companions = MemoryEngine::getCompanions();
$recentEvents = MemoryEngine::getRecentEvents(50);
$commands = $db->query("SELECT * FROM command_usage ORDER BY use_count DESC LIMIT 15")->fetchAll();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Memory — SocioBeast Admin</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #0a0f0a 0%, #1a251a 100%);
            color: #d0e8d0;
            min-height: 100vh;
            padding: 20px;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        h1 { color: #70b870; margin-bottom: 20px; }
        .message { background: rgba(112, 184, 112, 0.2); border: 1px solid #70b870; padding: 12px 20px; border-radius: 8px; margin-bottom: 20px; }
        nav { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
        nav a { color: #90c890; text-decoration: none; padding: 8px 16px; background: rgba(112, 184, 112, 0.1); border-radius: 6px; }
        nav a:hover { background: rgba(112, 184, 112, 0.2); }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 25px; }
        .stat-box { background: rgba(20, 30, 20, 0.8); border: 1px solid rgba(112, 184, 112, 0.3); padding: 20px; border-radius: 12px; text-align: center; }
        .stat-box .value { font-size: 32px; color: #70b870; font-weight: bold; }
        .stat-box .label { font-size: 12px; color: #708070; margin-top: 5px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 20px; }
        .card { background: rgba(20, 30, 20, 0.8); border: 1px solid rgba(112, 184, 112, 0.3); border-radius: 12px; padding: 20px; }
        .card h2 { color: #90c890; margin-bottom: 15px; font-size: 16px; }
        .scroll-box { max-height: 400px; overflow-y: auto; }
        .viewer-item { background: rgba(0,0,0,0.2); padding: 12px; margin-bottom: 8px; border-radius: 8px; }
        .viewer-item.companion { border-left: 3px solid #70b870; }
        .viewer-item.legendary { border-left: 3px solid #ffd700; background: rgba(255, 215, 0, 0.05); }
        .viewer-name { font-weight: bold; color: #90c890; }
        .viewer-stats { font-size: 12px; color: #708070; margin-top: 5px; }
        .viewer-actions { display: flex; gap: 8px; margin-top: 8px; }
        .viewer-actions button { padding: 4px 10px; font-size: 11px; }
        .event-item { padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 13px; }
        .event-item:last-child { border: none; }
        .event-type { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-right: 8px; background: rgba(112, 184, 112, 0.2); }
        .event-type.follow { background: rgba(79, 195, 247, 0.2); }
        .event-type.gift { background: rgba(255, 213, 79, 0.2); }
        .event-type.evolution { background: rgba(156, 39, 176, 0.2); }
        .event-time { color: #708070; font-size: 11px; float: right; }
        .command-bar { display: flex; align-items: center; gap: 10px; padding: 8px; background: rgba(0,0,0,0.2); margin-bottom: 6px; border-radius: 6px; }
        .command-bar .name { font-family: monospace; color: #90c890; }
        .command-bar .count { margin-left: auto; color: #70b870; font-weight: bold; }
        .command-bar .bar { flex: 1; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden; }
        .command-bar .bar-fill { height: 100%; background: #70b870; }
        button { background: linear-gradient(135deg, #4a7c4a 0%, #3a5c3a 100%); color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 12px; }
        button:hover { background: linear-gradient(135deg, #5a8c5a 0%, #4a6c4a 100%); }
        button.danger { background: linear-gradient(135deg, #7c4a4a 0%, #5c3a3a 100%); }
        button.gold { background: linear-gradient(135deg, #7c6a4a 0%, #5c4a3a 100%); }
        input { padding: 6px 10px; background: rgba(0,0,0,0.3); border: 1px solid rgba(112, 184, 112, 0.3); border-radius: 4px; color: #d0e8d0; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🧠 Memory & Relationships</h1>
        
        <nav>
            <a href="index.php">📊 Dashboard</a>
            <a href="config.php">⚙️ Configuration</a>
            <a href="memory.php">🧠 Memory</a>
            <a href="mythology.php">📜 Mythology</a>
            <a href="streaming.php">📡 Streaming</a>
            <a href="logout.php">🚪 Logout</a>
        </nav>

        <?php if ($message): ?>
        <div class="message"><?= htmlspecialchars($message) ?></div>
        <?php endif; ?>

        <!-- Stats -->
        <div class="stats-grid">
            <div class="stat-box">
                <div class="value"><?= number_format($stats['total_likes'] ?? 0) ?></div>
                <div class="label">❤️ Total Likes</div>
            </div>
            <div class="stat-box">
                <div class="value"><?= number_format($stats['total_gifts'] ?? 0) ?></div>
                <div class="label">🎁 Total Gifts</div>
            </div>
            <div class="stat-box">
                <div class="value"><?= number_format($stats['total_follows'] ?? 0) ?></div>
                <div class="label">➕ Total Follows</div>
            </div>
            <div class="stat-box">
                <div class="value"><?= number_format($stats['total_comments'] ?? 0) ?></div>
                <div class="label">💬 Total Comments</div>
            </div>
            <div class="stat-box">
                <div class="value"><?= count($companions) ?></div>
                <div class="label">🤝 Companions</div>
            </div>
            <div class="stat-box">
                <div class="value"><?= number_format($stats['sessions_count'] ?? 0) ?></div>
                <div class="label">📡 Sessions</div>
            </div>
        </div>

        <div class="grid">
            <!-- Top Viewers -->
            <div class="card">
                <h2>👥 Top Viewers (<?= count($topViewers) ?>)</h2>
                <div class="scroll-box">
                    <?php foreach ($topViewers as $v): ?>
                    <?php 
                        $isLegend = ($v['is_legend'] ?? 0) == 1;
                        $isCompanion = ($v['relationship_level'] ?? 0) >= 2;
                    ?>
                    <div class="viewer-item <?= $isLegend ? 'legendary' : ($isCompanion ? 'companion' : '') ?>">
                        <div class="viewer-name">
                            <?= $isLegend ? '⭐ ' : '' ?>
                            <?= htmlspecialchars($v['nickname'] ?? $v['username']) ?>
                            <?php if (!empty($v['nickname'])): ?>
                            <span style="color:#708070;font-size:11px">(<?= htmlspecialchars($v['username']) ?>)</span>
                            <?php endif; ?>
                        </div>
                        <div class="viewer-stats">
                            <?= getRelationshipName($v['relationship_level'] ?? 0) ?> · 
                            <?= $v['interaction_count'] ?> interactions · 
                            <?= $v['gift_total'] ?? 0 ?> gift value · 
                            Trust: <?= round($v['trust_score'] ?? 50) ?>%
                        </div>
                        <div class="viewer-actions">
                            <form method="POST" style="display:flex;gap:5px">
                                <input type="hidden" name="action" value="set_nickname">
                                <input type="hidden" name="username" value="<?= htmlspecialchars($v['username']) ?>">
                                <input type="text" name="nickname" placeholder="Nickname" value="<?= htmlspecialchars($v['nickname'] ?? '') ?>" style="width:100px">
                                <button type="submit">Set</button>
                            </form>
                            <?php if (!$isLegend && $isCompanion): ?>
                            <form method="POST">
                                <input type="hidden" name="action" value="mark_legendary">
                                <input type="hidden" name="username" value="<?= htmlspecialchars($v['username']) ?>">
                                <button type="submit" class="gold">⭐ Legendary</button>
                            </form>
                            <?php endif; ?>
                        </div>
                    </div>
                    <?php endforeach; ?>
                </div>
            </div>

            <!-- Top Gifters -->
            <div class="card">
                <h2>🎁 Top Gifters</h2>
                <div class="scroll-box">
                    <?php foreach ($topGifters as $g): ?>
                    <div class="viewer-item">
                        <div class="viewer-name"><?= htmlspecialchars($g['nickname'] ?? $g['username']) ?></div>
                        <div class="viewer-stats">
                            <?= $g['gift_count'] ?> gifts · 
                            Total value: <?= number_format($g['gift_total']) ?>
                        </div>
                    </div>
                    <?php endforeach; ?>
                </div>
            </div>

            <!-- Command Usage -->
            <div class="card">
                <h2>⚡ Command Usage</h2>
                <?php 
                $maxCount = !empty($commands) ? max(array_column($commands, 'use_count')) : 1;
                ?>
                <?php foreach ($commands as $cmd): ?>
                <div class="command-bar">
                    <span class="name"><?= htmlspecialchars($cmd['command']) ?></span>
                    <div class="bar">
                        <div class="bar-fill" style="width:<?= ($cmd['use_count'] / $maxCount) * 100 ?>%"></div>
                    </div>
                    <span class="count"><?= $cmd['use_count'] ?></span>
                </div>
                <?php endforeach; ?>
            </div>

            <!-- Recent Events -->
            <div class="card">
                <h2>📋 Recent Events</h2>
                <div class="scroll-box">
                    <?php foreach ($recentEvents as $e): ?>
                    <div class="event-item">
                        <span class="event-type <?= $e['type'] ?>"><?= htmlspecialchars($e['type']) ?></span>
                        <?= htmlspecialchars($e['description']) ?>
                        <span class="event-time"><?= $e['created_at'] ?></span>
                    </div>
                    <?php endforeach; ?>
                </div>
                <form method="POST" style="margin-top:15px">
                    <input type="hidden" name="action" value="clear_events">
                    <button type="submit" class="danger" onclick="return confirm('Clear all events?')">🗑️ Clear Event Log</button>
                </form>
            </div>
        </div>
    </div>
</body>
</html>
