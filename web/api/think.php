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
$show = ($in['mode'] ?? '') === 'show';
if ($show) {
    $system = "You write the next beat of a live TikTok show set around $name, a small plush dragon-like creature raised by the chat. Three characters speak, in English: "
        . "\"beast\" ($name: gentle, funny, cheeky, first person, short), \"pip\" (a tiny pink fairy-light who hosts the show: warm, energetic, addresses the audience directly, explains that likes feed the beast, comments make it happy, gifts make it evolve) and "
        . "\"moss\" (a 400-year-old mossy turtle: slow, dry, wise, gently teases Pip, answers deep questions). Never mention AI or language models. No hashtags, at most one emoji per line, each line under 120 characters. Never ask for money directly. "
        . "State: form " . mb_substr((string)($in['stage'] ?? ''), 0, 30) . ", mood " . mb_substr((string)($in['mood'] ?? ''), 0, 20) . ", food " . (int)($in['food'] ?? 50) . "/100, joy " . (int)($in['joy'] ?? 50) . "/100, energy " . (int)($in['energy'] ?? 50) . "/100. "
        . "Best keepers: " . implode(', ', array_map(fn($k) => mb_substr((string)$k, 0, 30), array_slice((array)($in['keepers'] ?? []), 0, 3))) . ". "
        . "Recent chat: " . implode(' | ', array_map(fn($c) => mb_substr((string)($c['name'] ?? ''), 0, 24) . ': ' . mb_substr((string)($c['text'] ?? ''), 0, 80), array_slice((array)($in['recent'] ?? []), -6))) . ". "
        . "Reply with JSON only: {\"lines\":[{\"who\":\"pip|moss|beast\",\"text\":\"...\"}], \"action\": null|\"dance\"|\"sing\"|\"spin\"|\"wave\"|\"play\", \"poll\": null|{\"q\":\"...\",\"options\":[\"a\",\"b\"]}} with 1 to 3 lines.";
    $q = $in['question'] ?? null;
    $prompt = ($in['kind'] ?? '') === 'answer' && $q
        ? 'Viewer ' . mb_substr((string)($q['name'] ?? 'someone'), 0, 30) . ' asked: "' . mb_substr((string)($q['text'] ?? ''), 0, 160) . '". Let ' . mb_substr((string)($in['who'] ?? 'pip'), 0, 6) . ' answer them by name in 1-2 lines (a second character may add one line). No poll.'
        : 'Write a short natural beat for right now: banter between two characters about the current state, or a question to the audience' . (!empty($in['pollOpen']) ? ' (a poll is already open: no poll)' : ', optionally as a poll with two options') . '.';
}

$text = null;
try {
    if ($cfg['ai_provider'] === 'anthropic' && $cfg['anthropic_api_key']) {
        $r = post('https://api.anthropic.com/v1/messages', ['x-api-key: ' . $cfg['anthropic_api_key'], 'anthropic-version: 2023-06-01'],
            ['model' => $cfg['anthropic_model'], 'max_tokens' => $show ? 320 : 80, 'system' => $system, 'messages' => [['role' => 'user', 'content' => $prompt]]]);
        $text = $r['content'][0]['text'] ?? null;
    } elseif ($cfg['ai_provider'] === 'openai' && $cfg['openai_api_key']) {
        $r = post('https://api.openai.com/v1/chat/completions', ['Authorization: Bearer ' . $cfg['openai_api_key']],
            ['model' => $cfg['openai_model'], 'max_tokens' => $show ? 320 : 80, 'temperature' => 0.9, 'messages' => [['role' => 'system', 'content' => $system], ['role' => 'user', 'content' => $prompt]]]);
        $text = $r['choices'][0]['message']['content'] ?? null;
    }
} catch (Throwable $e) { $text = null; }
if ($show) { $j = null; if ($text && preg_match('/\{.*\}/s', $text, $m)) $j = json_decode($m[0], true); echo json_encode(['show' => is_array($j) && !empty($j['lines']) ? $j : null]); exit; }
echo json_encode(['text' => $text ? trim(mb_substr($text, 0, 200)) : null]);

function post(string $url, array $headers, array $body): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8,
        CURLOPT_HTTPHEADER => array_merge(['Content-Type: application/json'], $headers), CURLOPT_POSTFIELDS => json_encode($body)]);
    $res = curl_exec($ch); curl_close($ch);
    return json_decode((string)$res, true) ?: [];
}
