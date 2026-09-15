<?php
// DIAGNOSTIC DÉTAILLÉ v2
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "<h1>🔍 Diagnostic Détaillé SocioBeast</h1><pre style='background:#111;color:#0f0;padding:20px;'>";

// 1. Vérifier structure des dossiers
echo "=== STRUCTURE ===\n";
$required = ['includes', 'api', 'assets', 'admin', 'data'];
foreach ($required as $dir) {
    $path = __DIR__ . '/' . $dir;
    $exists = is_dir($path);
    echo "$dir/: " . ($exists ? "✅" : "❌ MANQUANT") . "\n";
}
echo "\n";

// 2. Vérifier fichiers includes
echo "=== FICHIERS INCLUDES ===\n";
$includes = ['db.php', 'helpers.php', 'state_engine.php', 'memory_engine.php', 'mythology_engine.php', 'ai_engine.php'];
foreach ($includes as $file) {
    $path = __DIR__ . '/includes/' . $file;
    echo "$file: " . (file_exists($path) ? "✅ " . filesize($path) . " bytes" : "❌ MANQUANT") . "\n";
}
echo "\n";

// 3. Créer dossier data si nécessaire
$dataDir = __DIR__ . '/data';
if (!is_dir($dataDir)) {
    mkdir($dataDir, 0755, true);
    echo "Créé dossier data/\n";
}
echo "data/ writable: " . (is_writable($dataDir) ? "✅" : "❌") . "\n\n";

// 4. Test chargement db.php
echo "=== TEST db.php ===\n";
try {
    require_once __DIR__ . '/includes/db.php';
    echo "Chargement: ✅\n";
    
    if (class_exists('Database')) {
        echo "Classe Database: ✅\n";
        $db = Database::get();
        echo "Connexion: ✅\n";
        
        // Vérifier tables
        $tables = $db->query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")->fetchAll(PDO::FETCH_COLUMN);
        echo "Tables: " . implode(', ', $tables) . "\n";
    } else {
        echo "Classe Database: ❌ NON TROUVÉE\n";
    }
} catch (Throwable $e) {
    echo "❌ ERREUR: " . $e->getMessage() . "\n";
    echo "Fichier: " . basename($e->getFile()) . " ligne " . $e->getLine() . "\n";
}
echo "\n";

// 5. Test chargement helpers.php
echo "=== TEST helpers.php ===\n";
try {
    require_once __DIR__ . '/includes/helpers.php';
    echo "Chargement: ✅\n";
    
    // Test fonctions
    if (function_exists('getConfig')) echo "getConfig(): ✅\n";
    if (function_exists('getEvolutionInfo')) echo "getEvolutionInfo(): ✅\n";
    if (function_exists('getCurrentEvolution')) echo "getCurrentEvolution(): ✅\n";
    
} catch (Throwable $e) {
    echo "❌ ERREUR: " . $e->getMessage() . "\n";
    echo "Ligne: " . $e->getLine() . "\n";
}
echo "\n";

// 6. Test chargement state_engine.php
echo "=== TEST state_engine.php ===\n";
try {
    require_once __DIR__ . '/includes/state_engine.php';
    echo "Chargement: ✅\n";
    
    if (class_exists('StateEngine')) {
        echo "Classe StateEngine: ✅\n";
        
        // Test getState
        $state = StateEngine::getState();
        echo "getState(): ✅\n";
        echo "  - evolution_stage: " . ($state['evolution_stage'] ?? 'N/A') . "\n";
        echo "  - energy: " . ($state['energy'] ?? 'N/A') . "\n";
        echo "  - kodama_count: " . ($state['kodama_count'] ?? 'N/A') . "\n";
        
        // Test getPublicState
        $public = StateEngine::getPublicState();
        echo "getPublicState(): ✅\n";
    }
} catch (Throwable $e) {
    echo "❌ ERREUR: " . $e->getMessage() . "\n";
    echo "Fichier: " . basename($e->getFile()) . " ligne " . $e->getLine() . "\n";
    echo "Trace:\n" . $e->getTraceAsString() . "\n";
}
echo "\n";

// 7. Test autres engines
echo "=== TEST AUTRES ENGINES ===\n";
try {
    require_once __DIR__ . '/includes/memory_engine.php';
    echo "memory_engine.php: ✅\n";
} catch (Throwable $e) {
    echo "memory_engine.php: ❌ " . $e->getMessage() . " (ligne " . $e->getLine() . ")\n";
}

try {
    require_once __DIR__ . '/includes/mythology_engine.php';
    echo "mythology_engine.php: ✅\n";
} catch (Throwable $e) {
    echo "mythology_engine.php: ❌ " . $e->getMessage() . " (ligne " . $e->getLine() . ")\n";
}

try {
    require_once __DIR__ . '/includes/ai_engine.php';
    echo "ai_engine.php: ✅\n";
} catch (Throwable $e) {
    echo "ai_engine.php: ❌ " . $e->getMessage() . " (ligne " . $e->getLine() . ")\n";
}
echo "\n";

// 8. Test API state.php
echo "=== TEST API ===\n";
$apiFiles = ['state.php', 'event.php', 'speak.php', 'mythology.php'];
foreach ($apiFiles as $file) {
    $path = __DIR__ . '/api/' . $file;
    echo "$file: " . (file_exists($path) ? "✅" : "❌") . "\n";
}
echo "\n";

// 9. Test assets
echo "=== TEST ASSETS ===\n";
$assets = ['visualEngine.js', 'app.js', 'style.css', 'kodama.glb'];
foreach ($assets as $file) {
    $path = __DIR__ . '/assets/' . $file;
    echo "$file: " . (file_exists($path) ? "✅ " . filesize($path) . " bytes" : "❌") . "\n";
}
echo "\n";

// 10. Résumé
echo "=== RÉSUMÉ ===\n";
$allOk = class_exists('Database') && class_exists('StateEngine') && function_exists('getEvolutionInfo');
if ($allOk) {
    echo "✅ Tous les tests passent!\n";
    echo "→ Supprime /data/sociobeast.db et recharge index.php\n";
} else {
    echo "❌ Des erreurs ont été détectées ci-dessus.\n";
}

echo "</pre>";

// Bouton pour supprimer la DB
if (isset($_GET['reset_db'])) {
    $dbPath = __DIR__ . '/data/sociobeast.db';
    if (file_exists($dbPath)) {
        unlink($dbPath);
        echo "<p style='color:green;font-weight:bold;'>✅ Base de données supprimée! Rechargez la page principale.</p>";
    } else {
        echo "<p>Base de données n'existe pas encore.</p>";
    }
} else {
    echo "<p><a href='?reset_db=1' style='background:#c00;color:#fff;padding:10px 20px;text-decoration:none;border-radius:5px;'>🗑️ Supprimer la base de données et recommencer</a></p>";
}
?>
