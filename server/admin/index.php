<?php
/**
 * SOCIOBEAST GENESIS v11 — Admin Dashboard
 */
session_start();
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/helpers.php';
require_once __DIR__ . '/../includes/state_engine.php';
require_once __DIR__ . '/../includes/memory_engine.php';
require_once __DIR__ . '/../includes/mythology_engine.php';

// Auth check
if (!isset($_SESSION['admin_logged_in']) || $_SESSION['admin_logged_in'] !== true) {
    header('Location: login.php');
    exit;
}

// Handle actions
$message = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';
    
    switch ($action) {
        case 'save_config':
            foreach (['creature_name', 'openai_api_key', 'anthropic_api_key', 'ai_provider', 'gpt_model', 'claude_model', 'autonomy_tick_ms', 'youtube_api_key', 'youtube_stream_key', 'tiktok_username'] as $key) {
                if (isset($_POST[$key])) {
                    setConfig($key, $_POST[$key]);
                }
            }
            foreach (['demo_mode', 'voice_enabled', 'subtitles_enabled', 'mythology_enabled', 'streaming_enabled'] as $key) {
                setConfig($key, isset($_POST[$key]) ? '1' : '0');
            }
            $message = '✅ Configuration saved!';
            break;
            
        case 'reset_creature':
            StateEngine::reset();
            $message = '🔄 Creature reset to initial state!';
            break;
            
        case 'change_password':
            if (!empty($_POST['new_password']) && strlen($_POST['new_password']) >= 6) {
                setConfig('admin_password', password_hash($_POST['new_password'], PASSWORD_DEFAULT));
                $message = '🔐 Password changed!';
            } else {
                $message = '❌ Password must be at least 6 characters';
            }
            break;
    }
}

$state = StateEngine::getPublicState();
$stats = MemoryEngine::getStats();
$mythStats = MythologyEngine::getStats();
$topViewers = MemoryEngine::getTopViewers(10);
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SocioBeast Admin</title>
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
        .message {
            background: rgba(112, 184, 112, 0.2);
            border: 1px solid #70b870;
            padding: 12px 20px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 20px; }
        .card {
            background: rgba(20, 30, 20, 0.8);
            border: 1px solid rgba(112, 184, 112, 0.3);
            border-radius: 12px;
            padding: 20px;
        }
        .card h2 { color: #90c890; margin-bottom: 15px; font-size: 18px; }
        .stat { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.1); }
        .stat:last-child { border: none; }
        .stat-value { color: #70b870; font-weight: bold; }
        label { display: block; margin-bottom: 5px; color: #90c890; font-size: 14px; }
        input, select, textarea {
            width: 100%;
            padding: 10px;
            margin-bottom: 15px;
            background: rgba(0,0,0,0.3);
            border: 1px solid rgba(112, 184, 112, 0.3);
            border-radius: 6px;
            color: #d0e8d0;
            font-size: 14px;
        }
        input:focus, select:focus { outline: none; border-color: #70b870; }
        button {
            background: linear-gradient(135deg, #4a7c4a 0%, #3a5c3a 100%);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s;
        }
        button:hover { background: linear-gradient(135deg, #5a8c5a 0%, #4a6c4a 100%); }
        button.danger { background: linear-gradient(135deg, #7c4a4a 0%, #5c3a3a 100%); }
        .checkbox-row { display: flex; align-items: center; gap: 10px; margin-bottom: 15px; }
        .checkbox-row input { width: auto; margin: 0; }
        .viewers-list { max-height: 300px; overflow-y: auto; }
        .viewer-item { display: flex; justify-content: space-between; padding: 8px; background: rgba(0,0,0,0.2); margin-bottom: 5px; border-radius: 4px; }
        nav { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
        nav a {
            color: #90c890;
            text-decoration: none;
            padding: 8px 16px;
            background: rgba(112, 184, 112, 0.1);
            border-radius: 6px;
            transition: all 0.2s;
        }
        nav a:hover { background: rgba(112, 184, 112, 0.2); }
        .evolution-bar {
            height: 8px;
            background: rgba(0,0,0,0.3);
            border-radius: 4px;
            overflow: hidden;
            margin-top: 5px;
        }
        .evolution-fill { height: 100%; background: linear-gradient(90deg, #4a7c4a, #70b870); }
    </style>
</head>
<body>
    <div class="container">
        <h1>🌲 SocioBeast Admin</h1>
        
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
        <div class="message"><?= clean($message) ?></div>
        <?php endif; ?>

        <div class="grid">
            <!-- Creature State -->
            <div class="card">
                <h2>🦋 Creature State</h2>
                <div class="stat">
                    <span>Evolution Stage</span>
                    <span class="stat-value"><?= ($state['evolution_stage'] ?? 0) + 1 ?>/5</span>
                </div>
                <div class="evolution-bar">
                    <div class="evolution-fill" style="width: <?= (($state['evolution_stage'] ?? 0) + 1) * 20 ?>%"></div>
                </div>
                <div class="stat">
                    <span>Total XP</span>
                    <span class="stat-value"><?= number_format($state['total_xp'] ?? 0) ?></span>
                </div>
                <div class="stat">
                    <span>Kodamas</span>
                    <span class="stat-value"><?= $state['kodama_count'] ?? 1 ?></span>
                </div>
                <div class="stat">
                    <span>Autonomy Level</span>
                    <span class="stat-value"><?= round(($state['autonomy_level'] ?? 0) * 100) ?>%</span>
                </div>
                <div class="stat">
                    <span>Age (cycles)</span>
                    <span class="stat-value"><?= number_format($state['age'] ?? 0) ?></span>
                </div>
                <div class="stat">
                    <span>Dominant Emotion</span>
                    <span class="stat-value"><?= ucfirst($state['dominant_emotion'] ?? 'curious') ?></span>
                </div>
            </div>

            <!-- Vitals -->
            <div class="card">
                <h2>💚 Vitals</h2>
                <div class="stat">
                    <span>⚡ Energy</span>
                    <span class="stat-value"><?= round($state['energy'] ?? 80) ?>%</span>
                </div>
                <div class="stat">
                    <span>🍎 Hunger</span>
                    <span class="stat-value"><?= round($state['hunger'] ?? 20) ?>%</span>
                </div>
                <div class="stat">
                    <span>💚 Happiness</span>
                    <span class="stat-value"><?= round($state['happiness'] ?? 55) ?>%</span>
                </div>
            </div>

            <!-- Mythology Stats -->
            <div class="card">
                <h2>📜 Mythology</h2>
                <div class="stat">
                    <span>Myths Created</span>
                    <span class="stat-value"><?= $mythStats['total_myths'] ?></span>
                </div>
                <div class="stat">
                    <span>Dreams Dreamt</span>
                    <span class="stat-value"><?= $mythStats['total_dreams'] ?></span>
                </div>
                <div class="stat">
                    <span>Legendary Viewers</span>
                    <span class="stat-value"><?= $mythStats['legendary_viewers'] ?></span>
                </div>
                <div class="stat">
                    <span>Latest Myth Type</span>
                    <span class="stat-value"><?= ucfirst($mythStats['latest_myth_type']) ?></span>
                </div>
            </div>

            <!-- Statistics -->
            <div class="card">
                <h2>📊 Lifetime Stats</h2>
                <div class="stat">
                    <span>❤️ Total Likes</span>
                    <span class="stat-value"><?= number_format($stats['total_likes'] ?? 0) ?></span>
                </div>
                <div class="stat">
                    <span>🎁 Total Gifts</span>
                    <span class="stat-value"><?= number_format($stats['total_gifts'] ?? 0) ?></span>
                </div>
                <div class="stat">
                    <span>➕ Total Follows</span>
                    <span class="stat-value"><?= number_format($stats['total_follows'] ?? 0) ?></span>
                </div>
                <div class="stat">
                    <span>💬 Total Comments</span>
                    <span class="stat-value"><?= number_format($stats['total_comments'] ?? 0) ?></span>
                </div>
                <div class="stat">
                    <span>📡 Sessions</span>
                    <span class="stat-value"><?= number_format($stats['sessions_count'] ?? 0) ?></span>
                </div>
            </div>

            <!-- Top Viewers -->
            <div class="card">
                <h2>👥 Top Viewers</h2>
                <div class="viewers-list">
                    <?php if (empty($topViewers)): ?>
                    <p style="color:#708070">No viewers yet</p>
                    <?php else: ?>
                    <?php foreach ($topViewers as $v): ?>
                    <div class="viewer-item">
                        <span><?= clean($v['nickname'] ?? $v['username']) ?></span>
                        <span style="color:#70b870"><?= $v['interaction_count'] ?> interactions</span>
                    </div>
                    <?php endforeach; ?>
                    <?php endif; ?>
                </div>
            </div>

            <!-- Quick Actions -->
            <div class="card">
                <h2>⚡ Quick Actions</h2>
                <form method="POST" style="margin-bottom: 15px;">
                    <input type="hidden" name="action" value="reset_creature">
                    <button type="submit" class="danger" onclick="return confirm('Reset creature to initial state? This cannot be undone!')">
                        🔄 Reset Creature
                    </button>
                </form>
                <a href="../index.php" target="_blank">
                    <button type="button">👁️ View Live</button>
                </a>
            </div>
        </div>
    </div>
</body>
</html>
