<?php
/**
 * SOCIOBEAST — the creature's voice (LLM relay)
 * POST { prompt, mood, stage, name, food, joy, energy, keepers[] } → { text }
 * Keeps the API key server-side. Falls back to { text: null } when no provider is configured.
 */
header('Content-Type: application/json');
$cfg = require __DIR__ . '/config.php';
$in = json_decode(file_get_contents('php://input'), true) ?: [];
$name = mb_substr((string)($in['name'] ?? 'SocioBeast'), 0, 40);

$system = "You are $name, a small living creature raised on a TikTok Live by strangers who feed you with likes, talk to you in the chat and give you gifts so you can evolve. "
    . "You are gentle, funny, a little cheeky, never mean, never sad for long. You speak in the first person, in English, one or two short sentences (max 140 characters), no hashtags, no emoji spam (one emoji at most). "
    . "Never mention being an AI or a language model. Never ask for money directly; you may playfully hint that likes taste good and gifts make you grow. "
    . "Current form: " . mb_substr((string)($in['stage'] ?? 'Hatchling'), 0, 30) . ". Mood: " . mb_substr((string)($in['mood'] ?? 'curious'), 0, 20)
    . ". Food " . (int)($in['food'] ?? 50) . "/100, joy " . (int)($in['joy'] ?? 50) . "/100, energy " . (int)($in['energy'] ?? 50) . "/100. "
    . "Your best keepers: " . implode(', ', array_map(fn($k) => mb_substr((string)$k, 0, 30), array_slice((array)($in['keepers'] ?? []), 0, 3))) . '.';
$prompt = mb_substr((string)($in['prompt'] ?? 'Say something.'), 0, 400);

$text = null;
try {
    if ($cfg['ai_provider'] === 'anthropic' && $cfg['anthropic_api_key']) {
        $r = post('https://api.anthropic.com/v1/messages', ['x-api-key: ' . $cfg['anthropic_api_key'], 'anthropic-version: 2023-06-01'],
            ['model' => $cfg['anthropic_model'], 'max_tokens' => 80, 'system' => $system, 'messages' => [['role' => 'user', 'content' => $prompt]]]);
        $text = $r['content'][0]['text'] ?? null;
    } elseif ($cfg['ai_provider'] === 'openai' && $cfg['openai_api_key']) {
        $r = post('https://api.openai.com/v1/chat/completions', ['Authorization: Bearer ' . $cfg['openai_api_key']],
            ['model' => $cfg['openai_model'], 'max_tokens' => 80, 'temperature' => 0.9, 'messages' => [['role' => 'system', 'content' => $system], ['role' => 'user', 'content' => $prompt]]]);
        $text = $r['choices'][0]['message']['content'] ?? null;
    }
} catch (Throwable $e) { $text = null; }
echo json_encode(['text' => $text ? trim(mb_substr($text, 0, 200)) : null]);

function post(string $url, array $headers, array $body): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8,
        CURLOPT_HTTPHEADER => array_merge(['Content-Type: application/json'], $headers), CURLOPT_POSTFIELDS => json_encode($body)]);
    $res = curl_exec($ch); curl_close($ch);
    return json_decode((string)$res, true) ?: [];
}
