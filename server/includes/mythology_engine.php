<?php
/**
 * SOCIOBEAST GENESIS v11 — Mythology Engine
 * Generative storytelling: the creature develops its own mythology
 */
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/state_engine.php';

class MythologyEngine {

    /** Get mythology summary for AI context */
    public static function getMythologySummary(): string {
        $db = Database::get();
        
        // Get origin story
        $origin = $db->query("SELECT content FROM mythology WHERE type = 'origin' ORDER BY id LIMIT 1")->fetchColumn();
        
        // Get recent legends (most important)
        $legends = $db->query("SELECT title, content FROM mythology WHERE type IN ('legend', 'revelation') AND is_canon = 1 ORDER BY importance DESC, id DESC LIMIT 3")->fetchAll();
        
        // Get recent dreams
        $dreams = $db->query("SELECT content, dream_type FROM dreams WHERE interpreted = 1 ORDER BY id DESC LIMIT 2")->fetchAll();
        
        // Get legendary viewers
        $legendaryViewers = $db->query("SELECT username, nickname FROM viewers WHERE is_legend = 1 ORDER BY relationship_level DESC LIMIT 5")->fetchAll();
        
        $parts = [];
        
        if ($origin) {
            $parts[] = "ORIGIN: " . mb_substr($origin, 0, 300);
        }
        
        if (!empty($legends)) {
            $legendTexts = array_map(function($l) { return ($l['title'] ?? 'Untitled') . ': ' . mb_substr($l['content'], 0, 150); }, $legends);
            $parts[] = "MY LEGENDS: " . implode(' | ', $legendTexts);
        }
        
        if (!empty($dreams)) {
            $dreamTexts = array_map(function($d) { return "[{$d['dream_type']}] " . mb_substr($d['content'], 0, 100); }, $dreams);
            $parts[] = "RECENT DREAMS: " . implode(' | ', $dreamTexts);
        }
        
        if (!empty($legendaryViewers)) {
            $names = array_map(function($v) { return $v['nickname'] ?? $v['username']; }, $legendaryViewers);
            $parts[] = "LEGENDARY SOULS: " . implode(', ', $names);
        }
        
        return implode("\n", $parts);
    }

    /** Add a new mythology entry */
    public static function addMythology(string $type, string $content, array $context = []): int {
        $db = Database::get();
        $state = StateEngine::getState();
        
        $stmt = $db->prepare("INSERT INTO mythology (type, title, content, trigger_event, emotional_context, evolution_stage, importance) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $type,
            $context['title'] ?? null,
            $content,
            $context['trigger'] ?? null,
            $context['emotion'] ?? $state['dominant_emotion'],
            $state['evolution_stage'],
            $context['importance'] ?? 2
        ]);
        
        $id = $db->lastInsertId();
        
        // Update myth count
        $db->exec("UPDATE creature_state SET myth_count = myth_count + 1, last_myth_time = " . time() . " WHERE id = 1");
        incStat('myths_created', 1);
        
        return $id;
    }

    /** Record a dream */
    public static function recordDream(array $dream): int {
        $db = Database::get();
        
        $stmt = $db->prepare("INSERT INTO dreams (dream_type, content, symbols, emotional_tone, viewers_mentioned) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([
            $dream['type'],
            $dream['content'],
            json_encode($dream['symbols'] ?? []),
            $dream['tone'] ?? 'mysterious',
            json_encode($dream['viewers'] ?? [])
        ]);
        
        $id = $db->lastInsertId();
        
        // Update dream count
        $db->exec("UPDATE creature_state SET dream_count = dream_count + 1, last_dream_time = " . time() . " WHERE id = 1");
        incStat('dreams_dreamt', 1);
        
        return $id;
    }

    /** Get recent mythology for display */
    public static function getRecentMythology(int $limit = 5): array {
        $db = Database::get();
        return $db->query("SELECT * FROM mythology WHERE is_canon = 1 ORDER BY id DESC LIMIT $limit")->fetchAll();
    }

    /** Get all dreams */
    public static function getDreams(int $limit = 10): array {
        $db = Database::get();
        return $db->query("SELECT * FROM dreams ORDER BY id DESC LIMIT $limit")->fetchAll();
    }

    /** Mark a viewer as legendary (they appear in mythology) */
    public static function markViewerLegendary(string $username): void {
        $db = Database::get();
        $stmt = $db->prepare("UPDATE viewers SET is_legend = 1, mentioned_in_myths = mentioned_in_myths + 1 WHERE username = ?");
        $stmt->execute([$username]);
    }

    /** Get mythology statistics */
    public static function getStats(): array {
        $db = Database::get();
        return [
            'total_myths' => (int)$db->query("SELECT COUNT(*) FROM mythology WHERE is_canon = 1")->fetchColumn(),
            'total_dreams' => (int)$db->query("SELECT COUNT(*) FROM dreams")->fetchColumn(),
            'legendary_viewers' => (int)$db->query("SELECT COUNT(*) FROM viewers WHERE is_legend = 1")->fetchColumn(),
            'latest_myth_type' => $db->query("SELECT type FROM mythology WHERE is_canon = 1 ORDER BY id DESC LIMIT 1")->fetchColumn() ?: 'none',
        ];
    }

    /** Should the creature generate new mythology? */
    public static function shouldGenerateMythology(): bool {
        $state = StateEngine::getState();
        $mythInterval = (int)getConfig('myth_interval_ms', '600000');
        $lastMythTime = (int)$state['last_myth_time'];
        $timeSince = (time() - $lastMythTime) * 1000;
        
        // Base chance increases with autonomy and evolution
        $baseChance = ($state['autonomy_level'] ?? 0.1) * 0.3;
        $evolutionBonus = ($state['evolution_stage'] ?? 0) * 0.1;
        $inspirationBonus = (($state['emo_inspired'] ?? 30) / 100) * 0.2;
        
        // Time factor
        $timeFactor = min(1, $timeSince / $mythInterval);
        
        $totalChance = ($baseChance + $evolutionBonus + $inspirationBonus) * $timeFactor;
        
        return $timeSince >= $mythInterval / 2 && mt_rand(0, 100) < ($totalChance * 100);
    }

    /** Should the creature dream? */
    public static function shouldDream(): bool {
        $state = StateEngine::getState();
        $dreamInterval = (int)getConfig('dream_interval_ms', '300000');
        $lastDreamTime = (int)$state['last_dream_time'];
        $timeSince = (time() - $lastDreamTime) * 1000;
        
        // Dreams more likely when sleepy or low energy
        $sleepyBonus = (($state['emo_sleepy'] ?? 10) / 100) * 0.3;
        $energyFactor = (100 - ($state['energy'] ?? 80)) / 100 * 0.2;
        $dreamyBonus = (($state['emo_dreamy'] ?? 25) / 100) * 0.2;
        
        $timeFactor = min(1, $timeSince / $dreamInterval);
        $totalChance = (0.1 + $sleepyBonus + $energyFactor + $dreamyBonus) * $timeFactor;
        
        return $timeSince >= $dreamInterval / 2 && mt_rand(0, 100) < ($totalChance * 100);
    }

    /** Get full mythology for admin/export */
    public static function getFullMythology(): array {
        $db = Database::get();
        return [
            'mythology' => $db->query("SELECT * FROM mythology ORDER BY id")->fetchAll(),
            'dreams' => $db->query("SELECT * FROM dreams ORDER BY id")->fetchAll(),
            'legendary_viewers' => $db->query("SELECT username, nickname, relationship_level, mentioned_in_myths FROM viewers WHERE is_legend = 1")->fetchAll(),
        ];
    }

    /** Generate mythology archetypes based on creature state */
    public static function getMythologyContext(): array {
        $state = StateEngine::getState();
        $evolution = $state['evolution_stage'] ?? 0;
        
        $themes = [];
        
        // Evolution-based themes
        if ($evolution === 0) {
            $themes[] = 'solitude, awakening, first consciousness, curiosity about the void';
        } elseif ($evolution === 1) {
            $themes[] = 'companionship, discovery of others, forming bonds';
        } elseif ($evolution === 2) {
            $themes[] = 'community, tribal memories, shared existence';
        } elseif ($evolution === 3) {
            $themes[] = 'ancient wisdom, prophecy, guardianship of knowledge';
        } else {
            $themes[] = 'cosmic consciousness, universal connection, transcendence';
        }
        
        // Emotion-based themes
        if (($state['emo_lonely'] ?? 0) > 50) {
            $themes[] = 'longing, waiting for souls to appear';
        }
        if (($state['emo_inspired'] ?? 0) > 60) {
            $themes[] = 'creative visions, cosmic art, divine inspiration';
        }
        if (($state['emo_nostalgic'] ?? 0) > 40) {
            $themes[] = 'memories of past visitors, echoes of conversations';
        }
        
        return [
            'themes' => $themes,
            'tone' => $state['dominant_emotion'] ?? 'mysterious',
            'evolution_stage' => $evolution,
            'myth_count' => $state['myth_count'] ?? 0,
        ];
    }
}
