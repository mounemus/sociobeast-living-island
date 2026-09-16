<?php
/**
 * SOCIOBEAST — live page (PHP host). Same page as index.html, in live mode: it reads real TikTok events
 * from api/tiktok.php (pushed by bridge/tiktok-bridge.js) and speaks through api/think.php.
 * OBS browser source: https://your-host/live/index.php   (add ?voice=1 for TTS, ?name=… to rename the beast)
 */
$q = $_GET;
$cfg = ['mode' => 'live', 'voice' => ($q['voice'] ?? '') === '1', 'ai' => ($q['ai'] ?? '') !== '0', 'name' => mb_substr((string)($q['name'] ?? 'SocioBeast'), 0, 24)];
$html = file_get_contents(__DIR__ . '/index.html');
echo str_replace('<script>', '<script>window.BEAST_CONFIG = ' . json_encode($cfg, JSON_HEX_TAG | JSON_HEX_AMP) . ';', $html);
