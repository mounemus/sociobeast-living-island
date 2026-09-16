<?php
/**
 * SOCIOBEAST v14 — Admin · The Living Island
 * Live game state, chapters, Nature (director) parameters, cast, curse controls,
 * and the TikTok Live transmission panel (bridge status, OBS URL, test events).
 */
session_start();
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/helpers.php';
require_once __DIR__ . '/../includes/game_engine.php';
require_once __DIR__ . '/../includes/island_director.php';

if (!isset($_SESSION['admin_logged_in']) || $_SESSION['admin_logged_in'] !== true) { header('Location: login.php'); exit; }

$message = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    switch ($_POST['action'] ?? '') {
        case 'save_params':
            foreach (['council_interval_min', 'curse_spam_threshold', 'curse_decay_per_min', 'tiktok_username', 'stream_platform', 'obs_overlay_note'] as $k) if (isset($_POST[$k])) setConfig($k, trim($_POST[$k]));
            foreach (['demo_mode', 'director_speech_ai'] as $k) setConfig($k, isset($_POST[$k]) ? '1' : '0');
            IslandDirector::setParam('enabled', isset($_POST['director_enabled']));
            IslandDirector::setParam('aggressiveness', (float)($_POST['aggressiveness'] ?? 0.5));
            $message = '✅ Island parameters saved';
            break;
        case 'set_chapter': IslandDirector::setParam('chapter', (int)$_POST['chapter']); $message = '📖 Chapter set'; break;
        case 'trigger':
            $ev = $_POST['event'] ?? '';
            if ($ev === 'speak') IslandDirector::speak($_POST['who'] ?? 'wanderer', $_POST['instruction'] ?: 'Say something about the island.');
            elseif ($ev === 'blight') GameEngine::queueEventPublic('blight', ['strength' => 0.6, 'boss' => false]);
            elseif ($ev === 'council') { $g = GameEngine::getGame(); GameEngine::openCouncilPublic($g); }
            else GameEngine::queueEventPublic('world_event', ['event' => $ev, 'number' => 0, 'by' => 'admin']);
            $message = '⚡ Triggered: ' . htmlspecialchars($ev);
            break;
        case 'curse': GameEngine::adjustCurse((float)$_POST['delta']); $message = '🩸 Curse adjusted'; break;
        case 'end_season': $r = GameEngine::endSeason(); $message = '🏆 Season ended — winner: ' . $r['winner']; break;
        case 'gen_secret': setConfig('tiktok_bridge_secret', bin2hex(random_bytes(16))); $message = '🔑 New bridge secret generated'; break;
        case 'test_event':
            GameEngine::handleLiveEvent($_POST['type'] ?? 'like', ['username' => 'admin_test', 'displayName' => 'Admin', 'count' => 5, 'coins' => 100, 'giftName' => 'Rainfall', 'text' => $_POST['text'] ?? '!me']);
            $message = '🧪 Test event sent';
            break;
        case 'reset_game': GameEngine::resetGame(); $message = '🔄 Game reset (guardians, peoples, chapters)'; break;
    }
}

$s = GameEngine::publicState();
$dir = $s['director'];
$chapters = IslandDirector::chaptersList();
$bridgePing = (int)getConfig('bridge_last_ping', '0');
$bridgeAge = $bridgePing ? time() - $bridgePing : null;
$bridgeOk = $bridgeAge !== null && $bridgeAge < 120;
$secret = getConfig('tiktok_bridge_secret', '');
$base = (isset($_SERVER['HTTPS']) ? 'https' : 'http') . '://' . $_SERVER['HTTP_HOST'] . rtrim(dirname(dirname($_SERVER['SCRIPT_NAME'])), '/');
$seasons = Database::get()->query("SELECT * FROM seasons ORDER BY season DESC LIMIT 5")->fetchAll();
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Admin · The Living Island</title>
<style>
  :root { --bg:#0a0f0a; --card:#131a13; --line:rgba(127,214,127,.25); --g:#7fd67f; --y:#ffe08a; --r:#ff5060; --t:#e8f0e8; }
  body { margin:0; font-family:'Segoe UI',system-ui,sans-serif; background:var(--bg); color:var(--t); }
  .wrap { max-width:1200px; margin:0 auto; padding:20px; }
  nav { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:18px; } nav a { color:var(--g); text-decoration:none; padding:8px 14px; border:1px solid var(--line); border-radius:8px; } nav a.on { background:rgba(127,214,127,.15); }
  h1 { margin:0 0 6px; font-weight:600; } h2 { font-size:14px; letter-spacing:1px; text-transform:uppercase; color:var(--g); margin:0 0 10px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(330px,1fr)); gap:16px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:16px; }
  .kv { display:flex; justify-content:space-between; padding:5px 0; border-bottom:1px dashed rgba(255,255,255,.06); font-size:14px; } .kv b { color:var(--y); }
  .bar { height:10px; background:rgba(255,255,255,.08); border-radius:5px; overflow:hidden; margin:4px 0 8px; } .bar > div { height:100%; }
  label { display:block; font-size:12px; opacity:.8; margin:10px 0 4px; } input,select,textarea { width:100%; box-sizing:border-box; background:#0d130d; color:var(--t); border:1px solid var(--line); border-radius:8px; padding:8px; font-size:14px; }
  input[type=checkbox] { width:auto; margin-right:8px; } .row { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
  button { background:var(--g); color:#052005; border:0; border-radius:8px; padding:8px 14px; font-weight:600; cursor:pointer; } button.warn { background:var(--r); color:#fff; } button.ghost { background:transparent; color:var(--g); border:1px solid var(--line); }
  .msg { background:rgba(127,214,127,.12); border:1px solid var(--g); border-radius:10px; padding:10px 14px; margin-bottom:16px; }
  .dot { display:inline-block; width:10px; height:10px; border-radius:50%; margin-right:6px; background:#666; } .dot.ok { background:var(--g); box-shadow:0 0 10px var(--g); } .dot.bad { background:var(--r); }
  code { background:#0d130d; padding:2px 6px; border-radius:6px; font-size:12px; word-break:break-all; }
  .log div { font-size:12px; padding:3px 0 3px 8px; border-left:2px solid var(--g); margin:3px 0; opacity:.9; }
  .cast { display:grid; grid-template-columns:1fr 1fr; gap:8px; } .cast div { border:1px solid var(--line); border-radius:10px; padding:8px; font-size:12px; } .cast .off { opacity:.4; }
  .ch { display:flex; gap:10px; align-items:center; padding:6px 0; border-bottom:1px dashed rgba(255,255,255,.06); font-size:13px; } .ch.on { color:var(--y); }
</style>
</head>
<body><div class="wrap">
<nav>
  <a href="index.php">📊 Dashboard</a><a href="island.php" class="on">🌲 Island</a><a href="config.php">⚙️ Configuration</a><a href="memory.php">🧠 Memory</a><a href="mythology.php">📜 Mythology</a><a href="streaming.php">📡 Streaming</a><a href="../index.php?hud=1" target="_blank">▶ Open live</a><a href="logout.php">🚪 Logout</a>
</nav>
<div style="border-radius:14px;overflow:hidden;margin-bottom:14px;max-height:180px"><img src="../assets/art/keyart.jpg" style="width:100%;display:block;object-fit:cover;max-height:180px" alt=""></div>
<h1>🌲 The Living Island — control room</h1>
<p style="opacity:.7;margin:0 0 16px">Season <?= $s['season'] ?> · Chapter <?= $dir['chapter']['number'] ?>/<?= $dir['chapter']['total'] ?> · <?= htmlspecialchars($dir['chapter']['title']) ?> · <?= $s['guardianCount'] ?> guardians</p>
<?php if ($message): ?><div class="msg"><?= $message ?></div><?php endif; ?>

<div class="grid">

  <!-- LIVE STATE -->
  <div class="card">
    <h2>Live state</h2>
    <div class="kv"><span>Balance</span><b><?= $s['balance'] ?> — <?= htmlspecialchars($s['balanceLabel']) ?></b></div>
    <div class="bar"><div style="width:<?= (1 - $s['balance']) / 2 * 100 ?>%;background:linear-gradient(90deg,#7fd67f,#e0a050)"></div></div>
    <div class="kv"><span>Island energy</span><b><?= $s['energy'] ?> / <?= $s['energyThreshold'] ?></b></div>
    <div class="bar"><div style="width:<?= min(100, $s['energy'] / max(1, $s['energyThreshold']) * 100) ?>%;background:#ffe08a"></div></div>
    <div class="kv"><span>The Curse</span><b style="color:<?= $s['chaos'] > 70 ? 'var(--r)' : 'var(--y)' ?>"><?= $s['chaos'] ?>% <?= $s['fractured'] ? '· OUTBREAK' : '' ?></b></div>
    <div class="bar"><div style="width:<?= $s['chaos'] ?>%;background:linear-gradient(90deg,#ff8a5a,#ff2a2a)"></div></div>
    <?php foreach ($s['clans'] as $k => $c): ?>
      <div class="kv"><span><?= $c['icon'] ?> <?= $c['name'] ?> <small style="opacity:.6">(<?= $c['members'] ?>)</small></span><b><?= $c['influence'] ?>%</b></div>
    <?php endforeach; ?>
    <form method="post" class="row" style="margin-top:10px">
      <input type="hidden" name="action" value="curse"><button name="delta" value="-20">−20 curse</button><button name="delta" value="20" class="warn">+20 curse</button>
    </form>
    <form method="post" style="margin-top:8px" onsubmit="return confirm('End the season? The people with the most XP reshapes the island.')"><input type="hidden" name="action" value="end_season"><button class="ghost">🏆 End season</button></form>
  </div>

  <!-- CHAPTERS -->
  <div class="card">
    <h2>Chapters (levels)</h2>
    <?php foreach ($chapters as $c): ?>
      <div class="ch <?= $c['number'] === $dir['chapter']['number'] ? 'on' : '' ?>"><span><?= $c['number'] <= $dir['chapter']['number'] ? '●' : '○' ?></span><div><b><?= $c['number'] ?>. <?= htmlspecialchars($c['title']) ?></b><br><small style="opacity:.75"><?= htmlspecialchars($c['goal']) ?></small></div></div>
    <?php endforeach; ?>
    <p style="font-size:12px;opacity:.8;margin:10px 0 4px">Current goal progress:</p>
    <?php foreach ($dir['chapter']['progress'] as $k => $p): ?>
      <div class="kv"><span><?= htmlspecialchars(str_replace('_', ' ', $k)) ?></span><b><?= $p['value'] ?> / <?= $p['target'] ?></b></div>
    <?php endforeach; ?>
    <form method="post" class="row" style="margin-top:10px"><input type="hidden" name="action" value="set_chapter">
      <select name="chapter" style="width:auto"><?php foreach ($chapters as $c): ?><option value="<?= $c['number'] ?>" <?= $c['number'] === $dir['chapter']['number'] ? 'selected' : '' ?>>Chapter <?= $c['number'] ?> — <?= htmlspecialchars($c['title']) ?></option><?php endforeach; ?></select>
      <button>Jump to chapter</button></form>
  </div>

  <!-- NATURE / DIRECTOR -->
  <div class="card">
    <h2>Nature plays — the Island Director</h2>
    <form method="post"><input type="hidden" name="action" value="save_params">
      <label><input type="checkbox" name="director_enabled" <?= $dir['enabled'] ? 'checked' : '' ?>> Nature acts autonomously (weather, blight, gifts to the weak, characters)</label>
      <label>Aggressiveness: <span id="agv"><?= $dir['aggressiveness'] ?></span></label>
      <input type="range" name="aggressiveness" min="0" max="1" step="0.05" value="<?= $dir['aggressiveness'] ?>" oninput="agv.textContent=this.value">
      <label><input type="checkbox" name="director_speech_ai" <?= getConfig('director_speech_ai', '1') === '1' ? 'checked' : '' ?>> Characters speak through the AI provider (else written lines)</label>
      <label>Council interval (minutes)</label><input type="number" name="council_interval_min" min="2" max="60" value="<?= htmlspecialchars(getConfig('council_interval_min', '8')) ?>">
      <label>Curse: spam threshold (events / 10 s)</label><input type="number" name="curse_spam_threshold" min="10" max="500" value="<?= htmlspecialchars(getConfig('curse_spam_threshold', '60')) ?>">
      <label>Curse: natural decay (% / min)</label><input type="number" step="0.5" name="curse_decay_per_min" min="0" max="20" value="<?= htmlspecialchars(getConfig('curse_decay_per_min', '3')) ?>">
      <label><input type="checkbox" name="demo_mode" <?= getConfig('demo_mode', '0') === '1' ? 'checked' : '' ?>> Demo mode (simulated audience on the live page)</label>
      <input type="hidden" name="tiktok_username" value="<?= htmlspecialchars(getConfig('tiktok_username', '')) ?>">
      <div style="margin-top:12px"><button>💾 Save parameters</button></div>
    </form>
    <h2 style="margin-top:16px">Recent moves</h2>
    <div class="log"><?php foreach (array_reverse($dir['log']) as $l): ?><div><small style="opacity:.5"><?= date('H:i', $l['t']) ?></small> <?= htmlspecialchars($l['line']) ?></div><?php endforeach; ?></div>
  </div>

  <!-- CAST -->
  <div class="card">
    <h2>The cast</h2>
    <div class="cast">
      <?php foreach ($dir['cast'] as $k => $c): ?>
        <div class="<?= $c['present'] ? '' : 'off' ?>"><b style="color:<?= $c['color'] ?>"><?= $c['icon'] ?> <?= htmlspecialchars($c['name']) ?></b><br><span style="opacity:.8"><?= htmlspecialchars($c['role']) ?></span><?php if ($c['lastLine']): ?><br><i style="opacity:.7">"<?= htmlspecialchars($c['lastLine']) ?>"</i><?php endif; ?></div>
      <?php endforeach; ?>
    </div>
    <form method="post" class="row" style="margin-top:12px"><input type="hidden" name="action" value="trigger"><input type="hidden" name="event" value="speak">
      <select name="who" style="width:auto"><?php foreach ($dir['cast'] as $k => $c): if ($k === 'tall_one') continue; ?><option value="<?= $k ?>"><?= $c['icon'] ?> <?= htmlspecialchars($c['name']) ?></option><?php endforeach; ?></select>
      <input name="instruction" placeholder="Instruction (optional): e.g. greet the newcomers" style="flex:1;min-width:180px"><button>🗣 Make them speak</button></form>
  </div>

  <!-- EVENTS -->
  <div class="card">
    <h2>Trigger events</h2>
    <form method="post" class="row"><input type="hidden" name="action" value="trigger">
      <button name="event" value="first_rain">🌧️ First Rain</button><button name="event" value="spirit_lights">🌈 Spirit Lights</button><button name="event" value="mother_tree">🌳 Mother Tree</button>
      <button name="event" value="firefly_migration">✨ Fireflies</button><button name="event" value="tall_one">🌑 Tall One</button><button name="event" value="prophecy">🔮 Prophecy</button>
      <button name="event" value="council">🏛️ Council</button><button name="event" value="blight" class="warn">🩸 Blight</button>
    </form>
    <h2 style="margin-top:16px">Test as a viewer</h2>
    <form method="post" class="row"><input type="hidden" name="action" value="test_event">
      <button name="type" value="like">❤️ 5 likes</button><button name="type" value="gift">🎁 Rainfall gift</button><button name="type" value="follow">➕ Follow</button>
      <input name="text" value="!me" style="width:120px"><button name="type" value="comment">💬 Comment</button>
    </form>
    <form method="post" style="margin-top:16px" onsubmit="return confirm('Reset guardians, peoples, chapters and lore? This cannot be undone.')"><input type="hidden" name="action" value="reset_game"><button class="warn">🔄 Reset the whole game</button></form>
  </div>

  <!-- TIKTOK LIVE TRANSMISSION -->
  <div class="card">
    <h2>TikTok Live transmission</h2>
    <div class="kv"><span>Bridge</span><b><span class="dot <?= $bridgeOk ? 'ok' : ($bridgePing ? 'bad' : '') ?>"></span><?= $bridgeOk ? 'connected' : ($bridgePing ? 'silent for ' . round($bridgeAge / 60) . ' min' : 'never seen') ?></b></div>
    <div class="kv"><span>Last event</span><b><?= htmlspecialchars(getConfig('bridge_last_event', '—')) ?></b></div>
    <form method="post"><input type="hidden" name="action" value="save_params">
      <label>TikTok @username</label><input name="tiktok_username" value="<?= htmlspecialchars(getConfig('tiktok_username', '')) ?>" placeholder="your_tiktok_handle">
      <input type="hidden" name="aggressiveness" value="<?= $dir['aggressiveness'] ?>"><?php if ($dir['enabled']): ?><input type="hidden" name="director_enabled" value="1"><?php endif; ?>
      <?php if (getConfig('director_speech_ai', '1') === '1'): ?><input type="hidden" name="director_speech_ai" value="1"><?php endif; ?><?php if (getConfig('demo_mode', '0') === '1'): ?><input type="hidden" name="demo_mode" value="1"><?php endif; ?>
      <div style="margin-top:8px"><button>Save</button></div></form>
    <label>Bridge secret (put it in <code>bridge/.env</code> as <code>BRIDGE_SECRET</code>)</label>
    <div class="row"><code style="flex:1"><?= $secret ? htmlspecialchars($secret) : '— none —' ?></code><form method="post"><input type="hidden" name="action" value="gen_secret"><button class="ghost">🔑 Generate</button></form></div>
    <label>bridge/.env</label>
    <pre style="background:#0d130d;padding:10px;border-radius:8px;font-size:12px;white-space:pre-wrap">TIKTOK_USERNAME=<?= htmlspecialchars(getConfig('tiktok_username', 'your_username')) ?>

SOCIOBEAST_URL=<?= htmlspecialchars($base) ?>

BRIDGE_SECRET=<?= htmlspecialchars($secret ?: 'generate-one-above') ?></pre>
    <label>OBS browser source (1080 × 1920)</label>
    <code><?= htmlspecialchars($base) ?>/index.php?hud=1</code>
    <p style="font-size:12px;opacity:.75;margin:10px 0 0">Start the bridge with <code>npm start</code> in <code>bridge/</code>. The dot above turns green as soon as the first TikTok event arrives. Streaming settings (YouTube keys, sessions) stay under <a href="streaming.php" style="color:var(--g)">📡 Streaming</a>.</p>
  </div>

  <!-- SEASONS -->
  <div class="card">
    <h2>Seasons</h2>
    <?php if (!$seasons): ?><p style="opacity:.7;font-size:13px">No season closed yet.</p><?php endif; ?>
    <?php foreach ($seasons as $se): ?><div class="kv"><span>Season <?= $se['season'] ?></span><b><?= htmlspecialchars($se['winner_clan']) ?> · <?= date('Y-m-d', $se['ended_at']) ?></b></div><?php endforeach; ?>
    <h2 style="margin-top:16px">Top guardians</h2>
    <?php foreach ($s['leaderboard'] as $g): ?><div class="kv"><span><?= $g['rankIcon'] ?> <?= htmlspecialchars($g['name']) ?> <small style="color:<?= $g['clanColor'] ?>"><?= $g['clan'] ?></small></span><b><?= $g['xp'] ?> XP</b></div><?php endforeach; ?>
  </div>

</div>
<p style="opacity:.5;font-size:12px;margin-top:20px">Auto-refresh every 30 s.</p>
<script>setTimeout(function(){ if (!document.activeElement || document.activeElement.tagName === 'BODY') location.reload(); }, 30000);</script>
</div></body></html>
