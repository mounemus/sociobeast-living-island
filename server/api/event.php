<?php
/**
 * SOCIOBEAST GENESIS v11 — Event API
 * Handles all viewer interactions with deep memory
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
require_once __DIR__ . '/../includes/memory_engine.php';

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    echo json_encode(['error' => 'Invalid JSON']);
    exit;
}

$type = $input['type'] ?? '';
$username = trim($input['username'] ?? 'anonymous');

// Prepare response
$response = [
    'success' => true,
    'type' => $type,
    'visualEffect' => null,
    'intensity' => 1,
    'speechMode' => null,
    'command' => null,
];

try {
    // Record interaction
    StateEngine::recordEvent();
    
    // Process by type
    switch ($type) {
        case 'like':
            $count = max(1, (int)($input['count'] ?? 1));
            MemoryEngine::recordLike($username, $count);
            
            // Emotional impact
            StateEngine::adjustEmotions([
                'happy' => min(8, $count * 0.4),
                'lonely' => -min(5, $count * 0.3),
                'excited' => min(6, $count * 0.3)
            ]);
            
            // XP
            $xpResult = StateEngine::addXP(min(15, $count));
            
            $response['visualEffect'] = 'glow';
            $response['intensity'] = min(2, $count / 10);
            
            // Speech on significant likes
            if ($count >= 10) {
                $response['speechMode'] = 'reactive';
            }
            
            if ($xpResult['evolved']) {
                $response['evolved'] = true;
                $response['newStage'] = $xpResult['newStage'];
                $response['speechMode'] = 'evolution';
            }
            break;

        case 'comment':
            $text = trim($input['text'] ?? '');
            if (empty($text)) break;
            
            MemoryEngine::recordComment($username, $text);
            
            // Check for commands
            $lowerText = strtolower($text);
            $commands = ['feed','sleep','dance','evolve','hello','prophecy','dream','myth','remember','sing','calm','chaos'];
            $foundCommand = null;
            foreach ($commands as $cmd) {
                if (strpos($lowerText, $cmd) !== false) {
                    $foundCommand = $cmd;
                    break;
                }
            }
            
            if ($foundCommand) {
                MemoryEngine::recordCommand($foundCommand);
                $response['command'] = $foundCommand;
                $response['speechMode'] = 'command';
                
                // Command-specific effects
                switch ($foundCommand) {
                    case 'feed':
                        StateEngine::adjustVitals(['energy' => 20, 'hunger' => -25]);
                        StateEngine::adjustEmotions(['happy' => 10]);
                        $response['visualEffect'] = 'pulse';
                        break;
                    case 'sleep':
                        StateEngine::adjustEmotions(['sleepy' => 15, 'dreamy' => 10]);
                        StateEngine::adjustVitals(['energy' => 10]);
                        $response['visualEffect'] = 'dim';
                        break;
                    case 'dance':
                        StateEngine::adjustEmotions(['excited' => 12, 'happy' => 8]);
                        $response['visualEffect'] = 'rattle';
                        $response['intensity'] = 2;
                        break;
                    case 'chaos':
                        StateEngine::adjustPersonality(['chaos' => 5]);
                        StateEngine::adjustEmotions(['excited' => 15]);
                        $response['visualEffect'] = 'burst';
                        $response['intensity'] = 2.5;
                        break;
                    case 'calm':
                        StateEngine::adjustPersonality(['chaos' => -3]);
                        StateEngine::adjustEmotions(['happy' => 5, 'excited' => -8]);
                        $response['visualEffect'] = 'calm';
                        break;
                    case 'prophecy':
                    case 'dream':
                    case 'myth':
                        StateEngine::adjustEmotions(['inspired' => 8, 'philosophical' => 5]);
                        $response['visualEffect'] = 'mystical';
                        break;
                    case 'remember':
                        StateEngine::adjustEmotions(['nostalgic' => 12]);
                        break;
                    case 'evolve':
                        $xpResult = StateEngine::addXP(25);
                        if ($xpResult['evolved']) {
                            $response['evolved'] = true;
                            $response['newStage'] = $xpResult['newStage'];
                            $response['speechMode'] = 'evolution';
                            $response['visualEffect'] = 'evolve';
                            $response['intensity'] = 3;
                        }
                        break;
                }
            } else {
                // Normal conversational comment
                StateEngine::adjustEmotions([
                    'curious' => 3,
                    'lonely' => -5,
                    'happy' => 2
                ]);
                StateEngine::addXP(3);
                $response['speechMode'] = 'conversational';
                $response['commentText'] = $text;
            }
            
            $response['visualEffect'] = $response['visualEffect'] ?? 'glow';
            break;

        case 'gift':
            $giftName = $input['giftName'] ?? 'mysterious gift';
            $value = max(1, (int)($input['value'] ?? 1));
            
            MemoryEngine::recordGift($username, $giftName, $value);
            
            // Strong emotional impact
            StateEngine::adjustEmotions([
                'happy' => min(20, $value * 1.2),
                'excited' => min(15, $value * 0.8),
                'lonely' => -min(10, $value * 0.5),
                'inspired' => min(8, $value * 0.4)
            ]);
            
            StateEngine::adjustPersonality([
                'trust' => min(5, $value * 0.3),
                'attachment' => min(4, $value * 0.2)
            ]);
            
            $xpResult = StateEngine::addXP(min(50, $value * 2));
            
            $response['visualEffect'] = 'burst';
            $response['intensity'] = min(3, 1 + $value / 20);
            $response['speechMode'] = 'reactive';
            $response['giftName'] = $giftName;
            
            if ($xpResult['evolved']) {
                $response['evolved'] = true;
                $response['newStage'] = $xpResult['newStage'];
                $response['speechMode'] = 'evolution';
            }
            break;

        case 'follow':
            MemoryEngine::recordFollow($username);
            
            StateEngine::adjustEmotions([
                'happy' => 12,
                'excited' => 8,
                'lonely' => -8
            ]);
            
            StateEngine::adjustPersonality([
                'trust' => 3,
                'confidence' => 2
            ]);
            
            StateEngine::addXP(15);
            
            $response['visualEffect'] = 'sparkle';
            $response['intensity'] = 1.5;
            $response['speechMode'] = 'greeting';
            break;

        case 'share':
            MemoryEngine::trackViewer($username, 'share');
            incStat('total_shares', 1);
            
            StateEngine::adjustEmotions([
                'happy' => 8,
                'inspired' => 5
            ]);
            
            StateEngine::addXP(10);
            
            $response['visualEffect'] = 'ripple';
            break;
    }

    // Return updated state
    $response['state'] = StateEngine::getPublicState();

} catch (Exception $e) {
    $response = ['error' => $e->getMessage()];
    http_response_code(500);
}

echo json_encode($response);
