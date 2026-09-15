<?php
/**
 * SOCIOBEAST GENESIS v11 — Memory Engine
 * Deep relational memory with viewer tracking
 */
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

class MemoryEngine {

    /** Track a viewer interaction (creates or updates relationship) */
    public static function trackViewer(string $username, string $type = 'interaction'): array {
        if (empty($username)) return [];
        $db = Database::get();
        
        // Upsert viewer
        $stmt = $db->prepare("
            INSERT INTO viewers (username, interaction_count, last_seen)
            VALUES (?, 1, datetime('now'))
            ON CONFLICT(username) DO UPDATE SET
                interaction_count = interaction_count + 1,
                last_seen = datetime('now')
        ");
        $stmt->execute([$username]);
        
        // Get updated viewer data
        $stmt = $db->prepare("SELECT * FROM viewers WHERE username = ?");
        $stmt->execute([$username]);
        $viewer = $stmt->fetch();
        
        // Update relationship level
        $newLevel = calculateRelationshipLevel($viewer);
        if ($newLevel != $viewer['relationship_level']) {
            $stmt = $db->prepare("UPDATE viewers SET relationship_level = ? WHERE username = ?");
            $stmt->execute([$newLevel, $username]);
            
            // If leveled up to companion or higher, potential legend
            if ($newLevel >= 3 && !$viewer['is_legend']) {
                incStat('relationships_formed', 1);
            }
        }
        
        return $viewer;
    }

    /** Record like */
    public static function recordLike(string $username, int $count = 1): array {
        $viewer = self::trackViewer($username, 'like');
        incStat('total_likes', $count);
        
        $db = Database::get();
        $stmt = $db->prepare("UPDATE viewers SET like_count = like_count + ? WHERE username = ?");
        $stmt->execute([$count, $username]);
        
        // Update trust/affinity
        $trustBoost = min(5, $count * 0.5);
        $stmt = $db->prepare("UPDATE viewers SET trust_score = MIN(100, trust_score + ?), affinity_score = MIN(100, affinity_score + ?) WHERE username = ?");
        $stmt->execute([$trustBoost, $trustBoost * 0.5, $username]);
        
        return $viewer;
    }

    /** Record gift */
    public static function recordGift(string $username, string $giftName, int $value = 1): array {
        $viewer = self::trackViewer($username, 'gift');
        incStat('total_gifts', 1);
        
        $db = Database::get();
        $stmt = $db->prepare("
            UPDATE viewers SET
                gift_total = gift_total + ?,
                gift_count = gift_count + 1,
                trust_score = MIN(100, trust_score + ?),
                affinity_score = MIN(100, affinity_score + ?)
            WHERE username = ?
        ");
        $trustBoost = min(10, $value * 0.8);
        $affinityBoost = min(8, $value * 0.5);
        $stmt->execute([$value, $trustBoost, $affinityBoost, $username]);

        // Big gifts create memorable moments
        if ($value >= 10) {
            self::addMemorableMoment($username, "Gave a magnificent $giftName (value: $value)", 'gift');
            self::addEvent('big_gift', "$username sent $giftName (value: $value)", $username);
        }
        
        return $viewer;
    }

    /** Record comment */
    public static function recordComment(string $username, string $text): array {
        $viewer = self::trackViewer($username, 'comment');
        incStat('total_comments', 1);
        
        $db = Database::get();
        $short = mb_substr($text, 0, 200);
        $stmt = $db->prepare("
            UPDATE viewers SET
                comment_count = comment_count + 1,
                last_comment = ?,
                trust_score = MIN(100, trust_score + 1)
            WHERE username = ?
        ");
        $stmt->execute([$short, $username]);
        
        return $viewer;
    }

    /** Record follow */
    public static function recordFollow(string $username): array {
        $viewer = self::trackViewer($username, 'follow');
        incStat('total_follows', 1);
        
        $db = Database::get();
        $stmt = $db->prepare("UPDATE viewers SET trust_score = MIN(100, trust_score + 8), affinity_score = MIN(100, affinity_score + 5) WHERE username = ?");
        $stmt->execute([$username]);
        
        self::addMemorableMoment($username, "Joined our forest family", 'follow');
        self::addEvent('follow', "$username followed", $username);
        
        return $viewer;
    }

    /** Add memorable moment to viewer's history */
    public static function addMemorableMoment(string $username, string $description, string $type): void {
        $db = Database::get();
        $stmt = $db->prepare("SELECT memorable_moments FROM viewers WHERE username = ?");
        $stmt->execute([$username]);
        $moments = json_decode($stmt->fetchColumn() ?: '[]', true);
        
        $moments[] = [
            'type' => $type,
            'description' => $description,
            'time' => time()
        ];
        
        // Keep only last 20 moments
        $moments = array_slice($moments, -20);
        
        $stmt = $db->prepare("UPDATE viewers SET memorable_moments = ? WHERE username = ?");
        $stmt->execute([json_encode($moments), $username]);
    }

    /** Set AI-generated personality notes for a viewer */
    public static function setViewerNotes(string $username, string $notes): void {
        $db = Database::get();
        $stmt = $db->prepare("UPDATE viewers SET personality_notes = ? WHERE username = ?");
        $stmt->execute([mb_substr($notes, 0, 500), $username]);
    }

    /** Set creature's nickname for a viewer */
    public static function setViewerNickname(string $username, string $nickname): void {
        $db = Database::get();
        $stmt = $db->prepare("UPDATE viewers SET nickname = ? WHERE username = ?");
        $stmt->execute([mb_substr($nickname, 0, 50), $username]);
    }

    /** Record command usage */
    public static function recordCommand(string $command): void {
        $db = Database::get();
        $stmt = $db->prepare("
            INSERT INTO command_usage (command, use_count) VALUES (?, 1)
            ON CONFLICT(command) DO UPDATE SET use_count = use_count + 1
        ");
        $stmt->execute([$command]);
    }

    /** Add event to log */
    public static function addEvent(string $type, string $description, string $username = '', ?array $impacts = null): void {
        $db = Database::get();
        $stmt = $db->prepare("INSERT INTO events_log (type, description, username, emotional_impact, personality_shift) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([
            $type,
            mb_substr($description, 0, 300),
            $username,
            $impacts['emotional'] ?? null,
            $impacts['personality'] ? json_encode($impacts['personality']) : null
        ]);

        // Keep only last 500 events
        $db->exec("DELETE FROM events_log WHERE id NOT IN (SELECT id FROM events_log ORDER BY id DESC LIMIT 500)");
    }

    /** Get top viewers by relationship level */
    public static function getTopViewers(int $n = 10): array {
        $db = Database::get();
        return $db->query("SELECT * FROM viewers ORDER BY relationship_level DESC, interaction_count DESC LIMIT $n")->fetchAll(PDO::FETCH_ASSOC);
    }

    /** Get top gifters */
    public static function getTopGifters(int $n = 10): array {
        $db = Database::get();
        return $db->query("SELECT * FROM viewers WHERE gift_count > 0 ORDER BY gift_total DESC LIMIT $n")->fetchAll(PDO::FETCH_ASSOC);
    }

    /** Get viewer by username */
    public static function getViewer(string $username): ?array {
        $db = Database::get();
        $stmt = $db->prepare("SELECT * FROM viewers WHERE username = ?");
        $stmt->execute([$username]);
        return $stmt->fetch() ?: null;
    }

    /** Get viewers with high relationship levels (for mythology) */
    public static function getCompanions(): array {
        $db = Database::get();
        return $db->query("SELECT * FROM viewers WHERE relationship_level >= 2 ORDER BY relationship_level DESC, trust_score DESC")->fetchAll(PDO::FETCH_ASSOC);
    }

    /** Get recent events */
    public static function getRecentEvents(int $n = 30): array {
        $db = Database::get();
        return $db->query("SELECT * FROM events_log ORDER BY id DESC LIMIT $n")->fetchAll(PDO::FETCH_ASSOC);
    }

    /** Build memory summary for AI context */
    public static function buildSummary(): string {
        $stats = self::getStats();
        $topV = self::getTopViewers(5);
        $companions = array_filter($topV, function($v) { return ($v['relationship_level'] ?? 0) >= 2; });
        $events = self::getRecentEvents(5);

        $parts = [];
        
        // Stats
        $parts[] = "Lifetime stats — Likes: " . ($stats['total_likes'] ?? 0) . ", Gifts: " . ($stats['total_gifts'] ?? 0) . ", Follows: " . ($stats['total_follows'] ?? 0) . ", Sessions: " . ($stats['sessions_count'] ?? 0);
        
        // Companions (high relationship viewers)
        if (!empty($companions)) {
            $companionInfo = array_map(function($v) {
                $name = $v['nickname'] ?? $v['username'];
                $rel = getRelationshipName($v['relationship_level']);
                return "$name ($rel)";
            }, array_slice($companions, 0, 5));
            $parts[] = "My companions: " . implode(', ', $companionInfo);
        }
        
        // Recent notable events
        $notableEvents = array_filter($events, function($e) { return in_array($e['type'], ['follow', 'big_gift', 'evolution', 'mythology']); });
        if (!empty($notableEvents)) {
            $eventDescs = array_map(function($e) { return $e['description']; }, array_slice($notableEvents, 0, 3));
            $parts[] = "Recent memories: " . implode('; ', $eventDescs);
        }
        
        return implode("\n", $parts);
    }

    /** Get all stats */
    public static function getStats(): array {
        $db = Database::get();
        $rows = $db->query("SELECT * FROM stats")->fetchAll(PDO::FETCH_ASSOC);
        $result = [];
        foreach ($rows as $r) $result[$r['key']] = (int)$r['value'];
        return $result;
    }

    /** Get full memory overview */
    public static function getFullMemory(): array {
        return [
            'stats'       => self::getStats(),
            'top_viewers' => self::getTopViewers(30),
            'top_gifters' => self::getTopGifters(20),
            'companions'  => self::getCompanions(),
            'events'      => self::getRecentEvents(100),
            'commands'    => Database::get()->query("SELECT * FROM command_usage ORDER BY use_count DESC")->fetchAll(PDO::FETCH_ASSOC),
        ];
    }
}
