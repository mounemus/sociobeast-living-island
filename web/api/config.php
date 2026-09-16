<?php
/**
 * SOCIOBEAST — server configuration
 * Copy config.local.php.example to config.local.php and fill it in (that file is git-ignored).
 */
$cfg = [
    'bridge_secret'     => '',            // must match BRIDGE_SECRET in bridge/.env ('' = accept anything, dev only)
    'ai_provider'       => 'anthropic',   // 'anthropic' | 'openai' | '' (scripted lines only)
    'anthropic_api_key' => '',
    'openai_api_key'    => '',
    'anthropic_model'   => 'claude-haiku-4-5-20251001',
    'openai_model'      => 'gpt-4o-mini',
    'db'                => __DIR__ . '/data/live.sqlite',
];
if (is_file(__DIR__ . '/config.local.php')) $cfg = array_merge($cfg, require __DIR__ . '/config.local.php');
return $cfg;
