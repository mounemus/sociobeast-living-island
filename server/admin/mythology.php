<?php
/**
 * SOCIOBEAST GENESIS v11 — Admin Mythology
 */
session_start();
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/helpers.php';
require_once __DIR__ . '/../includes/mythology_engine.php';
require_once __DIR__ . '/../includes/ai_engine.php';

if (!isset($_SESSION['admin_logged_in']) || $_SESSION['admin_logged_in'] !== true) {
    header('Location: login.php');
    exit;
}

$message = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';
    
    if ($action === 'generate_myth') {
        $type = $_POST['myth_type'] ?? 'legend';
        $result = AIEngine::generateMythology($type);
        if ($result) {
            $message = "✨ New {$type} created: " . mb_substr($result['content'], 0, 100) . '...';
        } else {
            $message = '❌ Failed to generate mythology. Check AI configuration.';
        }
    }
    
    if ($action === 'generate_dream') {
        $result = AIEngine::generateDream();
        if ($result) {
            $message = "💤 Dream recorded: " . mb_substr($result['content'], 0, 100) . '...';
        } else {
            $message = '❌ Failed to generate dream. Check AI configuration.';
        }
    }
    
    if ($action === 'add_manual') {
        $type = $_POST['manual_type'] ?? 'legend';
        $title = $_POST['manual_title'] ?? '';
        $content = $_POST['manual_content'] ?? '';
        if (!empty($content)) {
            MythologyEngine::addMythology($type, $content, ['title' => $title, 'importance' => 3]);
            $message = "📜 Manual mythology entry added!";
        }
    }
}

$mythology = MythologyEngine::getRecentMythology(20);
$dreams = MythologyEngine::getDreams(15);
$stats = MythologyEngine::getStats();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mythology — SocioBeast Admin</title>
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
        input, select, textarea { width: 100%; padding: 10px; margin-bottom: 15px; background: rgba(0,0,0,0.3); border: 1px solid rgba(112, 184, 112, 0.3); border-radius: 6px; color: #d0e8d0; font-size: 14px; }
        textarea { min-height: 100px; resize: vertical; }
        button { background: linear-gradient(135deg, #4a7c4a 0%, #3a5c3a 100%); color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 14px; margin-right: 10px; margin-bottom: 10px; }
        button:hover { background: linear-gradient(135deg, #5a8c5a 0%, #4a6c4a 100%); }
        .myth-item, .dream-item { background: rgba(0,0,0,0.2); padding: 15px; margin-bottom: 10px; border-radius: 8px; border-left: 3px solid #70b870; }
        .myth-item .type { color: #70b870; font-size: 12px; text-transform: uppercase; margin-bottom: 5px; }
        .myth-item .title { color: #90c890; font-weight: bold; margin-bottom: 8px; }
        .myth-item .content, .dream-item .content { color: #b0c8b0; line-height: 1.5; font-style: italic; }
        .myth-item .meta, .dream-item .meta { color: #708070; font-size: 11px; margin-top: 8px; }
        .dream-item { border-left-color: #8080c0; }
        .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 20px; }
        .stat-box { background: rgba(0,0,0,0.2); padding: 15px; border-radius: 8px; text-align: center; }
        .stat-box .value { font-size: 28px; color: #70b870; font-weight: bold; }
        .stat-box .label { font-size: 12px; color: #708070; }
        .scroll-box { max-height: 500px; overflow-y: auto; }
    </style>
</head>
<body>
    <div class="container">
        <h1>📜 Mythology & Dreams</h1>
        
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

        <!-- Stats -->
        <div class="stats-grid">
            <div class="stat-box">
                <div class="value"><?= $stats['total_myths'] ?></div>
                <div class="label">Myths Created</div>
            </div>
            <div class="stat-box">
                <div class="value"><?= $stats['total_dreams'] ?></div>
                <div class="label">Dreams Dreamt</div>
            </div>
            <div class="stat-box">
                <div class="value"><?= $stats['legendary_viewers'] ?></div>
                <div class="label">Legendary Viewers</div>
            </div>
            <div class="stat-box">
                <div class="value"><?= ucfirst($stats['latest_myth_type']) ?></div>
                <div class="label">Latest Type</div>
            </div>
        </div>

        <div class="grid">
            <!-- Generate -->
            <div class="card">
                <h2>✨ Generate Content</h2>
                
                <form method="POST" style="margin-bottom: 20px;">
                    <input type="hidden" name="action" value="generate_myth">
                    <label>Mythology Type</label>
                    <select name="myth_type">
                        <option value="legend">Legend</option>
                        <option value="prophecy">Prophecy</option>
                        <option value="revelation">Revelation</option>
                        <option value="origin">Origin Story</option>
                    </select>
                    <button type="submit">🌟 Generate Mythology</button>
                </form>
                
                <form method="POST">
                    <input type="hidden" name="action" value="generate_dream">
                    <button type="submit">💤 Generate Dream</button>
                </form>
            </div>

            <!-- Manual Entry -->
            <div class="card">
                <h2>✍️ Add Manual Entry</h2>
                <form method="POST">
                    <input type="hidden" name="action" value="add_manual">
                    <label>Type</label>
                    <select name="manual_type">
                        <option value="legend">Legend</option>
                        <option value="prophecy">Prophecy</option>
                        <option value="revelation">Revelation</option>
                        <option value="origin">Origin</option>
                    </select>
                    <label>Title (optional)</label>
                    <input type="text" name="manual_title" placeholder="The Awakening...">
                    <label>Content</label>
                    <textarea name="manual_content" placeholder="In the beginning..."></textarea>
                    <button type="submit">📜 Add to Mythology</button>
                </form>
            </div>
        </div>

        <div class="grid" style="margin-top: 20px;">
            <!-- Mythology -->
            <div class="card">
                <h2>📖 Mythology (<?= count($mythology) ?>)</h2>
                <div class="scroll-box">
                    <?php if (empty($mythology)): ?>
                    <p style="color:#708070">No mythology yet. The creature's story is waiting to be written...</p>
                    <?php else: ?>
                    <?php foreach ($mythology as $myth): ?>
                    <div class="myth-item">
                        <div class="type"><?= htmlspecialchars($myth['type']) ?></div>
                        <?php if (!empty($myth['title'])): ?>
                        <div class="title"><?= htmlspecialchars($myth['title']) ?></div>
                        <?php endif; ?>
                        <div class="content"><?= htmlspecialchars($myth['content']) ?></div>
                        <div class="meta">
                            Stage <?= ($myth['evolution_stage'] ?? 0) + 1 ?> · 
                            <?= $myth['created_at'] ?>
                        </div>
                    </div>
                    <?php endforeach; ?>
                    <?php endif; ?>
                </div>
            </div>

            <!-- Dreams -->
            <div class="card">
                <h2>💤 Dreams (<?= count($dreams) ?>)</h2>
                <div class="scroll-box">
                    <?php if (empty($dreams)): ?>
                    <p style="color:#708070">No dreams yet. The creature sleeps peacefully...</p>
                    <?php else: ?>
                    <?php foreach ($dreams as $dream): ?>
                    <div class="dream-item">
                        <div class="type" style="color:#8080c0"><?= htmlspecialchars($dream['dream_type']) ?></div>
                        <div class="content"><?= htmlspecialchars($dream['content']) ?></div>
                        <div class="meta">
                            Tone: <?= htmlspecialchars($dream['emotional_tone'] ?? 'mysterious') ?> · 
                            <?= $dream['created_at'] ?>
                        </div>
                    </div>
                    <?php endforeach; ?>
                    <?php endif; ?>
                </div>
            </div>
        </div>
    </div>
</body>
</html>
