<?php
/**
 * SOCIOBEAST GENESIS v11 — Speech API
 * Generates AI speech including dreams and mythology
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/helpers.php';
require_once __DIR__ . '/../includes/state_engine.php';
require_once __DIR__ . '/../includes/ai_engine.php';
require_once __DIR__ . '/../includes/mythology_engine.php';

$input = json_decode(file_get_contents('php://input'), true) ?? [];
$mode = $input['mode'] ?? 'autonomous';
$context = $input['context'] ?? [];
$force = $input['force'] ?? false;

try {
    // Check cooldown unless forced
    if (!$force && AIEngine::isCoolingDown()) {
        $state = StateEngine::getState();
        $cooldown = (int)getConfig('gpt_cooldown_ms', '6000');
        $lastSpeech = (int)$state['last_speech_time'];
        $elapsed = (time() - $lastSpeech) * 1000;
        $remaining = max(0, $cooldown - $elapsed);
        
        echo json_encode([
            'cooldown' => true,
            'remaining_ms' => $remaining
        ]);
        exit;
    }

    // Special modes
    if ($mode === 'dream') {
        $dream = AIEngine::generateDream();
        if ($dream) {
            echo json_encode([
                'success' => true,
                'text' => $dream['content'],
                'mode' => 'dream',
                'dream_type' => $dream['type'],
                'emotion' => 'dreamy'
            ]);
        } else {
            echo json_encode(['error' => 'Dream generation failed']);
        }
        exit;
    }

    if ($mode === 'mythology') {
        $type = $context['type'] ?? 'legend';
        $myth = AIEngine::generateMythology($type);
        if ($myth) {
            echo json_encode([
                'success' => true,
                'text' => $myth['content'],
                'mode' => 'mythology',
                'myth_type' => $myth['type'],
                'myth_id' => $myth['id'],
                'emotion' => 'inspired'
            ]);
        } else {
            echo json_encode(['error' => 'Mythology generation failed']);
        }
        exit;
    }

    // Regular speech generation
    $text = AIEngine::generateSpeech($mode, $context);
    
    if ($text) {
        $state = StateEngine::getState();
        echo json_encode([
            'success' => true,
            'text' => $text,
            'mode' => $mode,
            'emotion' => $state['dominant_emotion'] ?? 'curious'
        ]);
    } else {
        echo json_encode(['error' => 'Speech generation failed']);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
