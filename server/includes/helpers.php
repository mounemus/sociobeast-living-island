<?php
/**
 * SOCIOBEAST GENESIS v11 — Helpers
 */
require_once __DIR__ . '/db.php';

/** Get config value */
function getConfig(string $key, string $default = ''): string {
    static $cache = [];
    if (!isset($cache[$key])) {
        $db = Database::get();
        $stmt = $db->prepare("SELECT value FROM config WHERE key = ?");
        $stmt->execute([$key]);
        $cache[$key] = $stmt->fetchColumn() ?: $default;
    }
    return $cache[$key];
}

/** Set config value */
function setConfig(string $key, string $value): void {
    $db = Database::get();
    $stmt = $db->prepare("INSERT OR REPLACE INTO config (key, value, updated_at) VALUES (?, ?, datetime('now'))");
    $stmt->execute([$key, $value]);
}

/** Increment stat */
function incStat(string $key, int $amount = 1): void {
    $db = Database::get();
    $stmt = $db->prepare("INSERT INTO stats (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = value + ?");
    $stmt->execute([$key, $amount, $amount]);
}

/** Get stat */
function getStat(string $key): int {
    $db = Database::get();
    $stmt = $db->prepare("SELECT value FROM stats WHERE key = ?");
    $stmt->execute([$key]);
    return (int)($stmt->fetchColumn() ?: 0);
}

/** Clamp value */
function clamp(float $value, float $min, float $max): float {
    return max($min, min($max, $value));
}

/** Clean output */
function clean(string $text): string {
    return htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
}

/** Get evolution stages data */
function getEvolutionStages(): array {
    return [
        0 => [
            'name' => 'Solitary Spirit',
            'threshold' => 0,
            'autonomyBase' => 0.05,
            'vocab' => 'simple, childlike, curious',
            'maxKodamas' => 100,
            'colors' => ['primary' => '#f0f8f0', 'glow' => '#a0d0a0'],
            'mythThemes' => ['awakening', 'solitude', 'first light']
        ],
        1 => [
            'name' => 'Awakening Colony',
            'threshold' => 100,
            'autonomyBase' => 0.12,
            'vocab' => 'wonder, discovery, bonding',
            'maxKodamas' => 250,
            'colors' => ['primary' => '#e8f5e8', 'glow' => '#90c890'],
            'mythThemes' => ['companionship', 'division', 'mirror']
        ],
        2 => [
            'name' => 'Forest Nation',
            'threshold' => 350,
            'autonomyBase' => 0.22,
            'vocab' => 'collective, tribal, rhythmic',
            'maxKodamas' => 500,
            'colors' => ['primary' => '#e0f0e0', 'glow' => '#80c080'],
            'mythThemes' => ['tribe', 'ritual', 'shared memory']
        ],
        3 => [
            'name' => 'Ancient Grove',
            'threshold' => 800,
            'autonomyBase' => 0.35,
            'vocab' => 'wise, prophetic, ancient',
            'maxKodamas' => 750,
            'colors' => ['primary' => '#d8ecd8', 'glow' => '#70b870', 'accent' => '#509050'],
            'mythThemes' => ['prophecy', 'guardianship', 'ancestral wisdom']
        ],
        4 => [
            'name' => 'Cosmic Forest',
            'threshold' => 1500,
            'autonomyBase' => 0.50,
            'vocab' => 'transcendent, cosmic, ethereal',
            'maxKodamas' => 1000,
            'colors' => ['primary' => '#d0e8d0', 'glow' => '#60b060', 'accent' => '#40a040', 'cosmic' => '#c0f0ff'],
            'mythThemes' => ['universe', 'transcendence', 'infinite connection']
        ],
    ];
}

/** Get current evolution */
function getCurrentEvolution(int $stage): array {
    $stages = getEvolutionStages();
    return $stages[$stage] ?? $stages[0];
}

/** Get dominant emotion from state */
function getDominantEmotion(array $state): string {
    $emotions = [
        'happy' => (float)($state['emo_happy'] ?? 50),
        'excited' => (float)($state['emo_excited'] ?? 30),
        'sleepy' => (float)($state['emo_sleepy'] ?? 10),
        'curious' => (float)($state['emo_curious'] ?? 50),
        'annoyed' => (float)($state['emo_annoyed'] ?? 5),
        'lonely' => (float)($state['emo_lonely'] ?? 20),
        'inspired' => (float)($state['emo_inspired'] ?? 30),
        'nostalgic' => (float)($state['emo_nostalgic'] ?? 15),
        'dreamy' => (float)($state['emo_dreamy'] ?? 25),
        'philosophical' => (float)($state['emo_philosophical'] ?? 35),
    ];
    arsort($emotions);
    reset($emotions);
    return key($emotions) ?: 'curious';
}

/** Format time ago */
function timeAgo(int $timestamp): string {
    $diff = time() - $timestamp;
    if ($diff < 60) return 'just now';
    if ($diff < 3600) return floor($diff / 60) . ' minutes ago';
    if ($diff < 86400) return floor($diff / 3600) . ' hours ago';
    if ($diff < 604800) return floor($diff / 86400) . ' days ago';
    return date('M j, Y', $timestamp);
}

/** Generate unique instance ID */
function generateInstanceId(): string {
    return 'kodama_' . bin2hex(random_bytes(4)) . '_' . time();
}

/** JSON response helper */
function jsonResponse(array $data, int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

/** Secure random float */
function randomFloat(float $min = 0, float $max = 1): float {
    return $min + mt_rand() / mt_getrandmax() * ($max - $min);
}

/** Calculate relationship level based on interactions */
function calculateRelationshipLevel(array $viewer): int {
    $interactions = (int)$viewer['interaction_count'];
    $gifts = (int)$viewer['gift_total'];
    $trust = (float)($viewer['trust_score'] ?? 50);
    
    $score = ($interactions * 2) + ($gifts * 3) + ($trust * 0.5);
    
    if ($score < 10) return 0;  // Stranger
    if ($score < 50) return 1;  // Acquaintance
    if ($score < 150) return 2; // Friend
    if ($score < 400) return 3; // Companion
    return 4; // Soulmate
}

/** Get relationship name */
function getRelationshipName(int $level): string {
    switch ($level) {
        case 0: return 'Stranger';
        case 1: return 'Acquaintance';
        case 2: return 'Friend';
        case 3: return 'Companion';
        case 4: return 'Soul Friend';
        default: return 'Unknown';
    }
}

/** Alias for getCurrentEvolution - used by state_engine */
function getEvolutionInfo(int $stage): array {
    return getCurrentEvolution($stage);
}
