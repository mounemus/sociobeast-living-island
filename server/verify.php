<?php
/**
 * SOCIOBEAST v11 - Quick Verification
 * Upload this file and visit it to check everything works
 */
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "<h1>🔍 SocioBeast v11 Verification</h1>";
echo "<style>body{font-family:sans-serif;padding:20px;background:#1a2a1a;color:#fff;} .ok{color:#8f8;} .err{color:#f88;} pre{background:#000;padding:10px;border-radius:5px;}</style>";

// 1. PHP Version
echo "<h2>1. PHP</h2>";
echo "<p>Version: <span class='ok'>" . PHP_VERSION . "</span></p>";

// 2. Required files
echo "<h2>2. Files</h2>";
$files = [
    'includes/db.php',
    'includes/helpers.php', 
    'includes/state_engine.php',
    'api/state.php',
    'assets/visualEngine.js',
    'assets/app.js',
    'assets/style.css',
    'assets/kodama.glb'
];
foreach ($files as $f) {
    $exists = file_exists(__DIR__ . '/' . $f);
    $class = $exists ? 'ok' : 'err';
    $icon = $exists ? '✅' : '❌';
    echo "<p>$f: <span class='$class'>$icon</span></p>";
}

// 3. Data directory
echo "<h2>3. Data Directory</h2>";
$dataDir = __DIR__ . '/data';
if (!is_dir($dataDir)) {
    mkdir($dataDir, 0777, true);
}
$writable = is_writable($dataDir);
$class = $writable ? 'ok' : 'err';
$icon = $writable ? '✅' : '❌';
echo "<p>data/ writable: <span class='$class'>$icon</span></p>";

// 4. Test includes
echo "<h2>4. PHP Includes</h2>";
try {
    require_once __DIR__ . '/includes/db.php';
    echo "<p>db.php: <span class='ok'>✅</span></p>";
} catch (Exception $e) {
    echo "<p>db.php: <span class='err'>❌ " . $e->getMessage() . "</span></p>";
}

try {
    require_once __DIR__ . '/includes/helpers.php';
    echo "<p>helpers.php: <span class='ok'>✅</span></p>";
    
    $evo = getEvolutionInfo(0);
    echo "<p>Stage 0 maxKodamas: <span class='ok'>" . $evo['maxKodamas'] . "</span></p>";
} catch (Exception $e) {
    echo "<p>helpers.php: <span class='err'>❌ " . $e->getMessage() . "</span></p>";
}

// 5. Test API
echo "<h2>5. API Test</h2>";
try {
    require_once __DIR__ . '/includes/state_engine.php';
    $state = StateEngine::getPublicState();
    echo "<p>StateEngine: <span class='ok'>✅</span></p>";
    echo "<pre>" . json_encode($state, JSON_PRETTY_PRINT) . "</pre>";
} catch (Exception $e) {
    echo "<p>StateEngine: <span class='err'>❌ " . $e->getMessage() . "</span></p>";
}

// 6. Check JS files for absolute paths
echo "<h2>6. JS Path Check</h2>";
$jsFiles = ['assets/visualEngine.js', 'assets/app.js'];
foreach ($jsFiles as $f) {
    $content = file_get_contents(__DIR__ . '/' . $f);
    if (strpos($content, "'/api/") !== false) {
        echo "<p>$f: <span class='err'>❌ Contains absolute /api/ paths</span></p>";
    } else {
        echo "<p>$f: <span class='ok'>✅ Relative paths OK</span></p>";
    }
}

echo "<h2>✅ All checks complete</h2>";
echo "<p><a href='index.php' style='color:#8f8;font-size:20px;'>→ Go to SocioBeast</a></p>";
