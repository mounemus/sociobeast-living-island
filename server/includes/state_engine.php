<?php
/**
 * SOCIOBEAST GENESIS v11 — State Engine
 * Matches the actual database schema (single-row creature_state table)
 */

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

class StateEngine {

    /**
     * Get full creature state from database
     */
    public static function getState(): array {
        $db = Database::get();
        
        // Get main state (single row)
        $row = $db->query("SELECT * FROM creature_state WHERE id = 1")->fetch();
        
        if (!$row) {
            // Initialize if missing
            $now = time();
            $db->exec("INSERT OR IGNORE INTO creature_state (id, session_start, last_event_time, birth_timestamp) VALUES (1, $now, $now, $now)");
            $row = $db->query("SELECT * FROM creature_state WHERE id = 1")->fetch();
        }
        
        // Build state array
        $state = [
            // Vitals
            'energy' => (float)($row['energy'] ?? 80),
            'hunger' => (float)($row['hunger'] ?? 20),
            'happiness' => (float)($row['happiness'] ?? 55),
            
            // Evolution
            'evolution_stage' => (int)($row['evolution_stage'] ?? 0),
            'total_xp' => (int)($row['total_xp'] ?? 0),
            'autonomy_level' => (float)($row['autonomy_level'] ?? 0.05),
            'age' => (int)($row['age'] ?? 0),
            'kodama_count' => (int)($row['kodama_count'] ?? 1),
            'mutation_level' => (int)($row['mutation_level'] ?? 0),
            
            // Timing
            'last_speech_time' => (int)($row['last_speech_time'] ?? 0),
            'last_dream_time' => (int)($row['last_dream_time'] ?? 0),
            'last_myth_time' => (int)($row['last_myth_time'] ?? 0),
            'events_count' => (int)($row['events_count'] ?? 0),
            'total_sessions' => (int)($row['total_sessions'] ?? 0),
            
            // Visual
            'color_palette' => json_decode($row['color_palette'] ?? '{}', true) ?: ['primary' => '#f0f8f0', 'glow' => '#a0d0a0'],
            'visual_mutations' => json_decode($row['visual_mutations'] ?? '[]', true) ?: [],
            
            // Emotions
            'emotions' => [
                'happy' => (float)($row['emo_happy'] ?? 50),
                'excited' => (float)($row['emo_excited'] ?? 30),
                'sleepy' => (float)($row['emo_sleepy'] ?? 10),
                'curious' => (float)($row['emo_curious'] ?? 50),
                'annoyed' => (float)($row['emo_annoyed'] ?? 5),
                'lonely' => (float)($row['emo_lonely'] ?? 20),
                'inspired' => (float)($row['emo_inspired'] ?? 30),
                'nostalgic' => (float)($row['emo_nostalgic'] ?? 15),
                'dreamy' => (float)($row['emo_dreamy'] ?? 25),
                'philosophical' => (float)($row['emo_philosophical'] ?? 35),
            ],
            
            // Personality
            'personality' => [
                'friendliness' => (float)($row['friendliness'] ?? 50),
                'curiosity' => (float)($row['curiosity'] ?? 60),
                'chaos' => (float)($row['chaos'] ?? 20),
                'wisdom' => (float)($row['wisdom'] ?? 30),
                'trust' => (float)($row['trust'] ?? 40),
                'playfulness' => (float)($row['playfulness'] ?? 55),
                'mystery' => (float)($row['mystery'] ?? 45),
                'confidence' => (float)($row['confidence'] ?? 35),
                'creativity' => (float)($row['creativity'] ?? 50),
                'introspection' => (float)($row['introspection'] ?? 40),
                'attachment' => (float)($row['attachment'] ?? 30),
                'fatigue' => (float)($row['fatigue'] ?? 10),
            ],
        ];
        
        // Calculate dominant emotion
        $state['dominant_emotion'] = self::getDominantEmotion($state['emotions']);
        
        // Load visual instances
        $instances = $db->query("SELECT * FROM visual_instances WHERE is_active = 1 ORDER BY id")->fetchAll();
        $state['visual_instances'] = $instances;
        $state['kodama_count'] = max(1, count($instances));
        
        // Get mythology counts
        $mythCount = $db->query("SELECT COUNT(*) as cnt FROM mythology")->fetch();
        $dreamCount = $db->query("SELECT COUNT(*) as cnt FROM dreams")->fetch();
        $state['myth_count'] = (int)($mythCount['cnt'] ?? 0);
        $state['dream_count'] = (int)($dreamCount['cnt'] ?? 0);
        
        return $state;
    }

    /**
     * Get public state (includes evolution info)
     */
    public static function getPublicState(): array {
        $state = self::getState();
        $state['evolution'] = getEvolutionInfo($state['evolution_stage']);
        
        // Session count
        $db = Database::get();
        $sessions = $db->query("SELECT COUNT(*) as cnt FROM streaming_sessions")->fetch();
        $state['total_sessions'] = (int)($sessions['cnt'] ?? 0);
        
        return $state;
    }

    /**
     * Save state back to database
     */
    public static function saveState(array $state): void {
        $db = Database::get();
        
        $sql = "UPDATE creature_state SET
            energy = ?, hunger = ?, happiness = ?,
            evolution_stage = ?, total_xp = ?, autonomy_level = ?,
            age = ?, kodama_count = ?, mutation_level = ?,
            last_speech_time = ?, last_dream_time = ?, last_myth_time = ?,
            events_count = ?, total_sessions = ?,
            color_palette = ?, visual_mutations = ?,
            emo_happy = ?, emo_excited = ?, emo_sleepy = ?, emo_curious = ?,
            emo_annoyed = ?, emo_lonely = ?, emo_inspired = ?,
            emo_nostalgic = ?, emo_dreamy = ?, emo_philosophical = ?,
            friendliness = ?, curiosity = ?, chaos = ?, wisdom = ?,
            trust = ?, playfulness = ?, mystery = ?, confidence = ?,
            creativity = ?, introspection = ?, attachment = ?, fatigue = ?,
            updated_at = datetime('now')
            WHERE id = 1";
        
        $emotions = $state['emotions'] ?? [];
        $personality = $state['personality'] ?? [];
        
        $stmt = $db->prepare($sql);
        $stmt->execute([
            $state['energy'] ?? 80,
            $state['hunger'] ?? 20,
            $state['happiness'] ?? 55,
            $state['evolution_stage'] ?? 0,
            $state['total_xp'] ?? 0,
            $state['autonomy_level'] ?? 0.05,
            $state['age'] ?? 0,
            $state['kodama_count'] ?? 1,
            $state['mutation_level'] ?? 0,
            $state['last_speech_time'] ?? 0,
            $state['last_dream_time'] ?? 0,
            $state['last_myth_time'] ?? 0,
            $state['events_count'] ?? 0,
            $state['total_sessions'] ?? 0,
            json_encode($state['color_palette'] ?? []),
            json_encode($state['visual_mutations'] ?? []),
            $emotions['happy'] ?? 50,
            $emotions['excited'] ?? 30,
            $emotions['sleepy'] ?? 10,
            $emotions['curious'] ?? 50,
            $emotions['annoyed'] ?? 5,
            $emotions['lonely'] ?? 20,
            $emotions['inspired'] ?? 30,
            $emotions['nostalgic'] ?? 15,
            $emotions['dreamy'] ?? 25,
            $emotions['philosophical'] ?? 35,
            $personality['friendliness'] ?? 50,
            $personality['curiosity'] ?? 60,
            $personality['chaos'] ?? 20,
            $personality['wisdom'] ?? 30,
            $personality['trust'] ?? 40,
            $personality['playfulness'] ?? 55,
            $personality['mystery'] ?? 45,
            $personality['confidence'] ?? 35,
            $personality['creativity'] ?? 50,
            $personality['introspection'] ?? 40,
            $personality['attachment'] ?? 30,
            $personality['fatigue'] ?? 10,
        ]);
    }

    /**
     * Tick - called every few seconds
     */
    public static function tick(): array {
        $state = self::getState();
        
        // Age increment
        $state['age'] = ($state['age'] ?? 0) + 1;
        
        // Natural decay (very slow)
        $state['energy'] = max(0, ($state['energy'] ?? 80) - 0.01);
        $state['hunger'] = min(100, ($state['hunger'] ?? 20) + 0.02);
        $state['happiness'] = max(0, min(100, ($state['happiness'] ?? 55) - 0.005));
        
        // Emotional drift
        $emotions = $state['emotions'];
        foreach ($emotions as $emo => $val) {
            $drift = (mt_rand(-5, 5) / 100);
            $emotions[$emo] = max(0, min(100, $val + $drift));
        }
        
        // Loneliness increases
        $emotions['lonely'] = min(100, $emotions['lonely'] + 0.03);
        
        $state['emotions'] = $emotions;
        $state['dominant_emotion'] = self::getDominantEmotion($emotions);
        
        // Check for evolution
        $evolved = self::checkEvolution($state);
        
        // Save state
        self::saveState($state);
        
        // Return for API
        $publicState = self::getPublicState();
        
        // Check for autonomous content
        $autoContent = self::checkAutonomousContent($state);
        
        return [
            'state' => $publicState,
            'evolved' => $evolved,
            'auto_content' => $autoContent
        ];
    }

    /**
     * Check and handle evolution
     */
    private static function checkEvolution(array &$state): ?array {
        $stage = $state['evolution_stage'] ?? 0;
        $xp = $state['total_xp'] ?? 0;
        
        $thresholds = [100, 350, 800, 1500];
        
        if ($stage < 4 && isset($thresholds[$stage]) && $xp >= $thresholds[$stage]) {
            $state['evolution_stage'] = $stage + 1;
            $state['autonomy_level'] = min(1.0, ($state['autonomy_level'] ?? 0.05) + 0.15);
            
            // Boost emotions
            $state['emotions']['excited'] = min(100, ($state['emotions']['excited'] ?? 50) + 30);
            $state['emotions']['happy'] = min(100, ($state['emotions']['happy'] ?? 50) + 20);
            
            // Log event
            $db = Database::get();
            $info = getEvolutionInfo($stage + 1);
            $stmt = $db->prepare("INSERT INTO events_log (type, description) VALUES ('evolution', ?)");
            $stmt->execute(["Evolved to Stage " . ($stage + 2) . ": " . $info['name']]);
            
            return [
                'newStage' => $stage + 1,
                'name' => $info['name'],
                'maxKodamas' => $info['maxKodamas']
            ];
        }
        
        return null;
    }

    /**
     * Check for autonomous content generation
     */
    private static function checkAutonomousContent(array $state): ?array {
        $autonomy = $state['autonomy_level'] ?? 0.05;
        
        if (mt_rand(0, 100) > $autonomy * 100) {
            return null;
        }
        
        $emotions = $state['emotions'];
        
        if (($emotions['dreamy'] ?? 0) > 30 || ($emotions['sleepy'] ?? 0) > 40) {
            return ['type' => 'dream_pending'];
        }
        
        if (($emotions['philosophical'] ?? 0) > 30 || ($emotions['inspired'] ?? 0) > 40) {
            return ['type' => 'mythology_pending'];
        }
        
        return null;
    }

    /**
     * Apply event impact
     */
    public static function applyEvent(string $type, array $data = []): array {
        $state = self::getState();
        
        $xpGain = 0;
        $happinessGain = 0;
        $emotionChanges = [];
        
        switch ($type) {
            case 'like':
                $count = $data['count'] ?? 1;
                $xpGain = $count;
                $happinessGain = min(5, $count * 0.5);
                $emotionChanges = ['happy' => 2, 'lonely' => -3, 'excited' => 1];
                break;
                
            case 'gift':
                $value = $data['value'] ?? 1;
                $xpGain = $value * 2;
                $happinessGain = min(15, $value);
                $emotionChanges = ['happy' => 5, 'excited' => 8, 'lonely' => -10, 'inspired' => 3];
                $state['energy'] = min(100, ($state['energy'] ?? 80) + $value * 0.5);
                break;
                
            case 'follow':
                $xpGain = 5;
                $happinessGain = 3;
                $emotionChanges = ['happy' => 3, 'lonely' => -5, 'curious' => 2];
                break;
                
            case 'comment':
                $xpGain = 2;
                $happinessGain = 2;
                $emotionChanges = ['curious' => 3, 'lonely' => -4, 'happy' => 1];
                break;
                
            case 'share':
                $xpGain = 3;
                $happinessGain = 2;
                $emotionChanges = ['excited' => 2, 'happy' => 2];
                break;
                
            case 'command':
                $cmd = $data['command'] ?? '';
                switch ($cmd) {
                    case 'feed':
                        $state['hunger'] = max(0, ($state['hunger'] ?? 20) - 30);
                        $state['energy'] = min(100, ($state['energy'] ?? 80) + 15);
                        $emotionChanges = ['happy' => 5, 'sleepy' => -5];
                        break;
                    case 'sleep':
                        $state['energy'] = min(100, ($state['energy'] ?? 80) + 25);
                        $emotionChanges = ['sleepy' => 10, 'dreamy' => 8];
                        break;
                    case 'dance':
                        $emotionChanges = ['excited' => 15, 'happy' => 8];
                        break;
                    case 'chaos':
                        $emotionChanges = ['excited' => 20, 'curious' => 10];
                        $state['personality']['chaos'] = min(100, ($state['personality']['chaos'] ?? 30) + 5);
                        break;
                    case 'calm':
                        $emotionChanges = ['sleepy' => 5, 'happy' => 3, 'excited' => -10];
                        break;
                    case 'prophecy':
                        $emotionChanges = ['philosophical' => 10, 'inspired' => 5, 'dreamy' => 3];
                        break;
                    case 'dream':
                        $emotionChanges = ['dreamy' => 15, 'sleepy' => 5, 'nostalgic' => 5];
                        break;
                }
                $xpGain = 3;
                break;
        }
        
        // Apply XP
        $state['total_xp'] = ($state['total_xp'] ?? 0) + $xpGain;
        
        // Apply happiness
        $state['happiness'] = max(0, min(100, ($state['happiness'] ?? 55) + $happinessGain));
        
        // Apply emotion changes
        foreach ($emotionChanges as $emo => $change) {
            if (isset($state['emotions'][$emo])) {
                $state['emotions'][$emo] = max(0, min(100, $state['emotions'][$emo] + $change));
            }
        }
        
        // Update dominant emotion
        $state['dominant_emotion'] = self::getDominantEmotion($state['emotions']);
        
        // Reduce loneliness
        $state['emotions']['lonely'] = max(0, ($state['emotions']['lonely'] ?? 20) - 5);
        
        // Increment events count
        $state['events_count'] = ($state['events_count'] ?? 0) + 1;
        
        // Check evolution
        $evolved = self::checkEvolution($state);
        
        // Save IMMEDIATELY
        self::saveState($state);
        
        return [
            'state' => self::getPublicState(),
            'evolved' => $evolved,
            'xpGained' => $xpGain
        ];
    }

    /**
     * Add visual instance
     */
    public static function addVisualInstance(float $x, float $z, float $scale): ?string {
        $db = Database::get();
        $state = self::getState();
        
        $maxKodamas = getEvolutionInfo($state['evolution_stage'])['maxKodamas'] ?? 5;
        $currentCount = count($state['visual_instances']);
        
        if ($currentCount >= $maxKodamas) {
            return null;
        }
        
        $instanceId = 'kodama_' . bin2hex(random_bytes(4)) . '_' . time();
        
        $stmt = $db->prepare("INSERT INTO visual_instances (instance_id, pos_x, pos_z, scale, birth_time, is_active) VALUES (?, ?, ?, ?, ?, 1)");
        $stmt->execute([$instanceId, $x, $z, $scale, time()]);
        
        // Update count
        $state['kodama_count'] = $currentCount + 1;
        self::saveState($state);
        
        return $instanceId;
    }

    /**
     * Sync visual instances
     */
    public static function syncVisualInstances(array $instances): void {
        if (empty($instances)) return;
        
        $db = Database::get();
        $stmt = $db->prepare("UPDATE visual_instances SET pos_x = ?, pos_z = ?, scale = ? WHERE instance_id = ?");
        
        foreach ($instances as $inst) {
            if (!empty($inst['id'])) {
                $stmt->execute([
                    $inst['x'] ?? 0,
                    $inst['z'] ?? 0.5,
                    $inst['scale'] ?? 1,
                    $inst['id']
                ]);
            }
        }
    }

    /**
     * Get dominant emotion
     */
    private static function getDominantEmotion(array $emotions): string {
        if (empty($emotions)) return 'curious';
        arsort($emotions);
        reset($emotions);
        return key($emotions) ?: 'curious';
    }

    /**
     * Reset creature
     */
    public static function reset(): void {
        $db = Database::get();
        $now = time();
        
        // Reset main state
        $db->exec("DELETE FROM creature_state");
        $db->exec("INSERT INTO creature_state (id, session_start, last_event_time, birth_timestamp) VALUES (1, $now, $now, $now)");
        
        // Reset visual instances
        $db->exec("DELETE FROM visual_instances");
        $db->exec("INSERT INTO visual_instances (instance_id, pos_x, pos_z, scale, birth_time, is_active) VALUES ('kodama_prime', 0, 0.5, 1.0, $now, 1)");
        
        // Clear logs
        $db->exec("DELETE FROM mythology WHERE id > 1");
        $db->exec("DELETE FROM dreams");
        $db->exec("DELETE FROM events_log");
    }

    /**
     * Record new session
     */
    public static function recordNewSession(): void {
        $db = Database::get();
        $now = time();
        
        $db->exec("UPDATE creature_state SET 
            session_start = $now, 
            total_sessions = total_sessions + 1 
            WHERE id = 1");
        
        incStat('sessions_count', 1);
    }
}
