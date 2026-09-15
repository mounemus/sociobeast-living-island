<?php
/**
 * SOCIOBEAST GENESIS v11 — Configuration API
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/helpers.php';

// Public read-only config
$publicConfig = [
    'creature_name' => getConfig('creature_name', 'SocioBeast'),
    'demo_mode' => getConfig('demo_mode', '0') === '1',
    'voice_enabled' => getConfig('voice_enabled', '1') === '1',
    'subtitles_enabled' => getConfig('subtitles_enabled', '1') === '1',
    'mythology_enabled' => getConfig('mythology_enabled', '1') === '1',
    'streaming_enabled' => getConfig('streaming_enabled', '0') === '1',
    'autonomy_tick_ms' => (int)getConfig('autonomy_tick_ms', '30000'),
    'ai_available' => !empty(getConfig('openai_api_key')) || !empty(getConfig('anthropic_api_key')),
];

echo json_encode([
    'success' => true,
    'config' => $publicConfig
]);
