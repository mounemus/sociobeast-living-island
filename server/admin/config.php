<?php
/**
 * SOCIOBEAST GENESIS v11 — Admin Configuration
 */
session_start();
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/helpers.php';

if (!isset($_SESSION['admin_logged_in']) || $_SESSION['admin_logged_in'] !== true) {
    header('Location: login.php');
    exit;
}

$message = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';
    
    if ($action === 'save_config') {
        // Text configs
        foreach (['creature_name', 'openai_api_key', 'anthropic_api_key', 'ai_provider', 'gpt_model', 'claude_model', 'gpt_temperature', 'gpt_max_tokens', 'gpt_cooldown_ms', 'autonomy_tick_ms', 'dream_interval_ms', 'myth_interval_ms', 'youtube_api_key', 'youtube_stream_key', 'youtube_channel_id', 'tiktok_username', 'tiktok_bridge_secret', 'council_interval_min'] as $key) {
            if (isset($_POST[$key])) {
                setConfig($key, $_POST[$key]);
            }
        }
        // Boolean configs
        foreach (['demo_mode', 'voice_enabled', 'subtitles_enabled', 'mythology_enabled', 'streaming_enabled', 'visual_persistence'] as $key) {
            setConfig($key, isset($_POST[$key]) ? '1' : '0');
        }
        $message = '✅ Configuration saved!';
    }
    
    if ($action === 'change_password') {
        if (!empty($_POST['new_password']) && strlen($_POST['new_password']) >= 6) {
            setConfig('admin_password', password_hash($_POST['new_password'], PASSWORD_DEFAULT));
            $message = '🔐 Password changed!';
        } else {
            $message = '❌ Password must be at least 6 characters';
        }
    }
}

// Get current config
if (isset($_GET['gen_secret'])) { setConfig('tiktok_bridge_secret', bin2hex(random_bytes(16))); header('Location: config.php'); exit; }

$config = [
    'creature_name' => getConfig('creature_name', 'SocioBeast'),
    'openai_api_key' => getConfig('openai_api_key', ''),
    'anthropic_api_key' => getConfig('anthropic_api_key', ''),
    'ai_provider' => getConfig('ai_provider', 'openai'),
    'gpt_model' => getConfig('gpt_model', 'gpt-4o-mini'),
    'claude_model' => getConfig('claude_model', 'claude-sonnet-4-20250514'),
    'gpt_temperature' => getConfig('gpt_temperature', '0.92'),
    'gpt_max_tokens' => getConfig('gpt_max_tokens', '200'),
    'gpt_cooldown_ms' => getConfig('gpt_cooldown_ms', '6000'),
    'autonomy_tick_ms' => getConfig('autonomy_tick_ms', '30000'),
    'dream_interval_ms' => getConfig('dream_interval_ms', '300000'),
    'myth_interval_ms' => getConfig('myth_interval_ms', '600000'),
    'demo_mode' => getConfig('demo_mode', '0') === '1',
    'voice_enabled' => getConfig('voice_enabled', '1') === '1',
    'subtitles_enabled' => getConfig('subtitles_enabled', '1') === '1',
    'mythology_enabled' => getConfig('mythology_enabled', '1') === '1',
    'streaming_enabled' => getConfig('streaming_enabled', '0') === '1',
    'visual_persistence' => getConfig('visual_persistence', '1') === '1',
    'youtube_api_key' => getConfig('youtube_api_key', ''),
    'youtube_stream_key' => getConfig('youtube_stream_key', ''),
    'youtube_channel_id' => getConfig('youtube_channel_id', ''),
    'tiktok_username' => getConfig('tiktok_username', ''),
    'tiktok_bridge_secret' => getConfig('tiktok_bridge_secret', ''),
    'council_interval_min' => getConfig('council_interval_min', '8'),
];
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Configuration — SocioBeast Admin</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #0a0f0a 0%, #1a251a 100%);
            color: #d0e8d0;
            min-height: 100vh;
            padding: 20px;
        }
        .container { max-width: 900px; margin: 0 auto; }
        h1 { color: #70b870; margin-bottom: 20px; }
        .message { background: rgba(112, 184, 112, 0.2); border: 1px solid #70b870; padding: 12px 20px; border-radius: 8px; margin-bottom: 20px; }
        nav { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
        nav a { color: #90c890; text-decoration: none; padding: 8px 16px; background: rgba(112, 184, 112, 0.1); border-radius: 6px; }
        nav a:hover { background: rgba(112, 184, 112, 0.2); }
        .card { background: rgba(20, 30, 20, 0.8); border: 1px solid rgba(112, 184, 112, 0.3); border-radius: 12px; padding: 25px; margin-bottom: 20px; }
        .card h2 { color: #90c890; margin-bottom: 20px; font-size: 18px; border-bottom: 1px solid rgba(112, 184, 112, 0.2); padding-bottom: 10px; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        @media (max-width: 600px) { .form-row { grid-template-columns: 1fr; } }
        label { display: block; margin-bottom: 5px; color: #90c890; font-size: 14px; }
        .help { font-size: 12px; color: #708070; margin-bottom: 10px; }
        input, select, textarea { width: 100%; padding: 12px; margin-bottom: 5px; background: rgba(0,0,0,0.3); border: 1px solid rgba(112, 184, 112, 0.3); border-radius: 6px; color: #d0e8d0; font-size: 14px; }
        input:focus, select:focus { outline: none; border-color: #70b870; }
        button { background: linear-gradient(135deg, #4a7c4a 0%, #3a5c3a 100%); color: white; border: none; padding: 14px 28px; border-radius: 8px; cursor: pointer; font-size: 14px; margin-top: 10px; }
        button:hover { background: linear-gradient(135deg, #5a8c5a 0%, #4a6c4a 100%); }
        .checkbox-row { display: flex; align-items: center; gap: 10px; margin-bottom: 15px; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 6px; }
        .checkbox-row input { width: auto; margin: 0; }
        .checkbox-row label { margin: 0; }
    </style>
</head>
<body>
    <div class="container">
        <h1>⚙️ Configuration</h1>
        
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

        <form method="POST">
            <input type="hidden" name="action" value="save_config">

            <!-- Basic Settings -->
            <div class="card">
                <h2>🌲 Basic Settings</h2>
                <label>Creature Name</label>
                <input type="text" name="creature_name" value="<?= htmlspecialchars($config['creature_name']) ?>">
                
                <div class="checkbox-row">
                    <input type="checkbox" name="demo_mode" id="demo_mode" <?= $config['demo_mode'] ? 'checked' : '' ?>>
                    <label for="demo_mode">Demo Mode (simulated interactions)</label>
                </div>
                <div class="checkbox-row">
                    <input type="checkbox" name="voice_enabled" id="voice_enabled" <?= $config['voice_enabled'] ? 'checked' : '' ?>>
                    <label for="voice_enabled">Voice Synthesis (TTS)</label>
                </div>
                <div class="checkbox-row">
                    <input type="checkbox" name="subtitles_enabled" id="subtitles_enabled" <?= $config['subtitles_enabled'] ? 'checked' : '' ?>>
                    <label for="subtitles_enabled">Show Subtitles</label>
                </div>
                <div class="checkbox-row">
                    <input type="checkbox" name="visual_persistence" id="visual_persistence" <?= $config['visual_persistence'] ? 'checked' : '' ?>>
                    <label for="visual_persistence">Visual Persistence (save kodama positions)</label>
                </div>
            </div>

            <!-- AI Settings -->
            <div class="card">
                <h2>🤖 AI Configuration</h2>
                
                <label>AI Provider</label>
                <select name="ai_provider">
                    <option value="openai" <?= $config['ai_provider'] === 'openai' ? 'selected' : '' ?>>OpenAI (GPT)</option>
                    <option value="anthropic" <?= $config['ai_provider'] === 'anthropic' ? 'selected' : '' ?>>Anthropic (Claude)</option>
                </select>
                
                <div class="form-row">
                    <div>
                        <label>OpenAI API Key</label>
                        <input type="password" name="openai_api_key" value="<?= htmlspecialchars($config['openai_api_key']) ?>" placeholder="sk-...">
                        <div class="help">Get from platform.openai.com</div>
                    </div>
                    <div>
                        <label>Anthropic API Key</label>
                        <input type="password" name="anthropic_api_key" value="<?= htmlspecialchars($config['anthropic_api_key']) ?>" placeholder="sk-ant-...">
                        <div class="help">Get from console.anthropic.com</div>
                    </div>
                </div>

                <div class="form-row">
                    <div>
                        <label>GPT Model</label>
                        <input type="text" name="gpt_model" value="<?= htmlspecialchars($config['gpt_model']) ?>">
                    </div>
                    <div>
                        <label>Claude Model</label>
                        <input type="text" name="claude_model" value="<?= htmlspecialchars($config['claude_model']) ?>">
                    </div>
                </div>

                <div class="form-row">
                    <div>
                        <label>Temperature (0.0 - 1.0)</label>
                        <input type="text" name="gpt_temperature" value="<?= htmlspecialchars($config['gpt_temperature']) ?>">
                    </div>
                    <div>
                        <label>Max Tokens</label>
                        <input type="text" name="gpt_max_tokens" value="<?= htmlspecialchars($config['gpt_max_tokens']) ?>">
                    </div>
                </div>

                <label>Speech Cooldown (ms)</label>
                <input type="text" name="gpt_cooldown_ms" value="<?= htmlspecialchars($config['gpt_cooldown_ms']) ?>">
                <div class="help">Minimum time between AI responses</div>
            </div>

            <!-- Mythology Settings -->
            <div class="card">
                <h2>📜 Mythology & Dreams</h2>
                
                <div class="checkbox-row">
                    <input type="checkbox" name="mythology_enabled" id="mythology_enabled" <?= $config['mythology_enabled'] ? 'checked' : '' ?>>
                    <label for="mythology_enabled">Enable Mythology Generation</label>
                </div>

                <div class="form-row">
                    <div>
                        <label>Autonomy Tick (ms)</label>
                        <input type="text" name="autonomy_tick_ms" value="<?= htmlspecialchars($config['autonomy_tick_ms']) ?>">
                        <div class="help">How often creature thinks autonomously</div>
                    </div>
                    <div>
                        <label>Dream Interval (ms)</label>
                        <input type="text" name="dream_interval_ms" value="<?= htmlspecialchars($config['dream_interval_ms']) ?>">
                        <div class="help">Minimum time between dreams</div>
                    </div>
                </div>

                <label>Mythology Interval (ms)</label>
                <input type="text" name="myth_interval_ms" value="<?= htmlspecialchars($config['myth_interval_ms']) ?>">
                <div class="help">Minimum time between new mythology</div>
            </div>

            <!-- Streaming Settings -->
            <div class="card">
                <h2>📡 Streaming</h2>
                
                <div class="checkbox-row">
                    <input type="checkbox" name="streaming_enabled" id="streaming_enabled" <?= $config['streaming_enabled'] ? 'checked' : '' ?>>
                    <label for="streaming_enabled">Enable Streaming Mode</label>
                </div>

                <label>YouTube API Key</label>
                <input type="password" name="youtube_api_key" value="<?= htmlspecialchars($config['youtube_api_key']) ?>">

                <label>YouTube Stream Key</label>
                <input type="password" name="youtube_stream_key" value="<?= htmlspecialchars($config['youtube_stream_key']) ?>">

                <label>YouTube Channel ID</label>
                <input type="text" name="youtube_channel_id" value="<?= htmlspecialchars($config['youtube_channel_id']) ?>">
            </div>

            <!-- TikTok Settings -->
            <div class="card">
                <h2>📱 TikTok Integration</h2>
                
                <label>TikTok Username</label>
                <input type="text" name="tiktok_username" value="<?= htmlspecialchars($config['tiktok_username']) ?>">

                <label>Bridge Secret</label>
                <input type="text" name="tiktok_bridge_secret" value="<?= htmlspecialchars($config['tiktok_bridge_secret']) ?>" readonly>
                <div class="help">Used for secure communication with TikTok bridge (bridge/.env → BRIDGE_SECRET)</div>
                <?php if (empty($config['tiktok_bridge_secret'])): ?>
                <div class="help" style="color:#ffb">Secret empty — <a href="?gen_secret=1" style="color:#9f9">generate one</a></div>
                <?php endif; ?>
            </div>

            <!-- Living Island game -->
            <div class="card">
                <h2>🎮 Living Island (v12)</h2>
                <label>Council vote interval (minutes)</label>
                <input type="number" name="council_interval_min" min="2" max="60" value="<?= htmlspecialchars($config['council_interval_min']) ?>">
                <div class="help">A Council vote opens automatically every N minutes during the live.</div>
                <div style="margin-top:10px">
                    <button type="button" onclick="if(confirm('End the current season? The winning clan reshapes the island.')) fetch('../api/game.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'end_season'})}).then(r=>r.json()).then(d=>alert('Season ended. Winner: '+d.winner))">🏆 End season now</button>
                </div>
            </div>

            <button type="submit">💾 Save Configuration</button>
        </form>

        <!-- Password Change -->
        <div class="card" style="margin-top: 30px;">
            <h2>🔐 Change Admin Password</h2>
            <form method="POST">
                <input type="hidden" name="action" value="change_password">
                <label>New Password (min 6 characters)</label>
                <input type="password" name="new_password" placeholder="Enter new password">
                <button type="submit">Change Password</button>
            </form>
        </div>
    </div>
</body>
</html>
