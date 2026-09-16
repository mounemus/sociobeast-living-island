<?php
/**
 * SOCIOBEAST v14 — Island Director
 * "Nature is a player too."
 * An autonomous agent that plays the island against / alongside the audience:
 *   • advances the story through CHAPTERS (levels) with objectives and unlocks
 *   • takes one strategic ACTION per tick (weather, blight, gifts to the weak, characters)
 *   • gives voice to CHARACTERS of the island (original cast in a Miyazaki-like world)
 * Pure rule/utility-based so it works without an AI key; when a key is set, the
 * characters speak through AIEngine with their own persona.
 */

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

class IslandDirector {

    // ─── Original cast (roles, not copies) ───
    const CHARACTERS = [
        'mossback'   => ['name' => 'Mossback',        'icon' => '🐢', 'role' => 'the walking hill — an ancient tortoise-god carrying a grove on its shell; keeper of balance',
                          'voice' => 'ancient, slow, speaks in seasons; forgives everything but forgetfulness', 'side' => 'forest', 'color' => '#6fa86f'],
        'ember_eye'  => ['name' => 'Ember-Eye',       'icon' => '🐆', 'role' => 'the great grey lynx, matriarch of the Fang',
                          'voice' => 'sharp, proud, protective; distrusts humans but honours courage', 'side' => 'forest', 'color' => '#d9534f'],
        'ironwright' => ['name' => 'The Ironwright',  'icon' => '⚒️', 'role' => 'leader of the Forge; feeds her people with iron and fire',
                          'voice' => 'pragmatic, warm to her own, unapologetic: "we are not evil, we are hungry"', 'side' => 'industry', 'color' => '#e0a050'],
        'wanderer'   => ['name' => 'The Wanderer',    'icon' => '🎭', 'role' => 'a masked traveller who belongs to no people and speaks for balance',
                          'voice' => 'calm, curious, asks questions instead of giving orders', 'side' => 'neutral', 'color' => '#c0c0ff'],
        'blightling' => ['name' => 'The Blightling',  'icon' => '🩸', 'role' => 'the curse made flesh — a knot of black tendrils born of hatred',
                          'voice' => 'hisses in fragments; wants only to be seen', 'side' => 'curse', 'color' => '#3a0a12'],
        'tall_one'   => ['name' => 'The Tall One',    'icon' => '🌑', 'role' => 'the immense night-walking spirit; never speaks',
                          'voice' => 'silence', 'side' => 'forest', 'color' => '#9fd0ff'],
    ];

    // ─── Chapters = levels of the island ───
    const CHAPTERS = [
        1 => ['title' => 'The Sprouting',      'goal' => 'Reach 60 spirits and welcome 5 guardians',
              'check' => ['spirits' => 60, 'new_guardians' => 5], 'unlock' => ['pond'],
              'intro' => 'A grove wakes on a rock adrift in the dark. Small spirits open their eyes.', 'director_mood' => 'gentle'],
        2 => ['title' => 'Iron Comes',         'goal' => 'The Forge reaches 60% influence at least once — then bring the balance back above 0',
              'check' => ['forge_60' => 1, 'balance_pos' => 1], 'unlock' => ['ironwright', 'embers'],
              'intro' => 'Smoke rises on the eastern shore. The Ironwright has come, and her people are hungry.', 'director_mood' => 'tempting'],
        3 => ['title' => 'The Curse Awakens',  'goal' => 'Defeat the Blightling: heal 300 curse points with !calm, !pray and rain',
              'check' => ['healed' => 300], 'unlock' => ['blightling', 'mist'],
              'intro' => 'Something black moves under the roots. Hatred has found a body.', 'director_mood' => 'hostile'],
        4 => ['title' => 'The Walking Hill',   'goal' => 'Keep the balance green for 8 minutes so Mossback wakes',
              'check' => ['green_minutes' => 8], 'unlock' => ['mossback', 'shafts'],
              'intro' => 'The old tortoise stirs. A whole forest rides on its back.', 'director_mood' => 'wise'],
        5 => ['title' => 'The Long Night',     'goal' => 'Survive the Tall One\'s passing twice and hold 30 Council votes',
              'check' => ['tall_one' => 2, 'votes' => 30], 'unlock' => ['ember_eye', 'stars'],
              'intro' => 'The night grows tall. Ember-Eye watches the humans from the ridge.', 'director_mood' => 'solemn'],
        6 => ['title' => 'Balance',            'goal' => 'End the season with every people above 20% and the curse below 10%',
              'check' => ['all_peoples_20' => 1, 'curse_low' => 1], 'unlock' => ['wanderer', 'bloom'],
              'intro' => 'Nobody won. Everyone lives. This is the hardest chapter, and the only one that matters.', 'director_mood' => 'serene'],
    ];

    // ═══════════════════════════════════════════════════════════
    private static $schemaDone = false;
    public static function ensureSchema(): void {
        if (self::$schemaDone) return; self::$schemaDone = true;
        $db = Database::get();
        $db->exec("
            CREATE TABLE IF NOT EXISTS director_state (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                chapter INTEGER DEFAULT 1,
                chapter_started INTEGER DEFAULT 0,
                enabled INTEGER DEFAULT 1,
                aggressiveness REAL DEFAULT 0.5,
                last_action INTEGER DEFAULT 0,
                last_speech INTEGER DEFAULT 0,
                boss_hp REAL DEFAULT 0,
                boss_active INTEGER DEFAULT 0,
                green_seconds REAL DEFAULT 0,
                unlocks TEXT DEFAULT '[]',
                chapter_metrics TEXT DEFAULT '{}',
                log TEXT DEFAULT '[]'
            );
            CREATE TABLE IF NOT EXISTS character_state (
                key TEXT PRIMARY KEY,
                present INTEGER DEFAULT 0,
                mood REAL DEFAULT 0.5,
                pos_x REAL DEFAULT 0, pos_z REAL DEFAULT 0,
                last_line TEXT, last_spoke INTEGER DEFAULT 0
            );
        ");
        $db->exec("INSERT OR IGNORE INTO director_state (id, chapter_started, last_action) VALUES (1, " . time() . ", " . time() . ")");
        foreach (array_keys(self::CHARACTERS) as $k) $db->exec("INSERT OR IGNORE INTO character_state (key) VALUES ('$k')");
    }

    public static function resetSchemaFlag(): void { self::$schemaDone = false; }

    public static function get(): array {
        self::ensureSchema();
        $d = Database::get()->query("SELECT * FROM director_state WHERE id = 1")->fetch();
        $d['unlocks'] = json_decode($d['unlocks'] ?: '[]', true) ?: [];
        $d['chapter_metrics'] = json_decode($d['chapter_metrics'] ?: '{}', true) ?: [];
        $d['log'] = json_decode($d['log'] ?: '[]', true) ?: [];
        return $d;
    }

    private static function save(array $d): void {
        Database::get()->prepare("UPDATE director_state SET chapter=?, chapter_started=?, enabled=?, aggressiveness=?, last_action=?, last_speech=?, boss_hp=?, boss_active=?, green_seconds=?, unlocks=?, chapter_metrics=?, log=? WHERE id = 1")
            ->execute([$d['chapter'], $d['chapter_started'], $d['enabled'], $d['aggressiveness'], $d['last_action'], $d['last_speech'], $d['boss_hp'], $d['boss_active'], $d['green_seconds'],
                       json_encode(array_values(array_unique($d['unlocks']))), json_encode($d['chapter_metrics']), json_encode(array_slice($d['log'], -40))]);
    }

    private static function log(array &$d, string $line): void {
        $d['log'][] = ['t' => time(), 'line' => $line];
        GameEngine::queueEventPublic('nature_move', ['line' => $line, 'chapter' => (int)$d['chapter']]);
    }

    public static function setParam(string $key, $value): void {
        self::ensureSchema();
        $d = self::get();
        if ($key === 'enabled') $d['enabled'] = (int)(bool)$value;
        if ($key === 'aggressiveness') $d['aggressiveness'] = max(0, min(1, (float)$value));
        if ($key === 'chapter') { $d['chapter'] = max(1, min(count(self::CHAPTERS), (int)$value)); $d['chapter_started'] = time(); $d['chapter_metrics'] = []; self::applyUnlocks($d); self::log($d, 'The story turns to chapter ' . $d['chapter'] . ': ' . self::CHAPTERS[$d['chapter']]['title']); GameEngine::queueEventPublic('chapter', self::chapterPublic($d) + ['intro' => self::CHAPTERS[$d['chapter']]['intro']]); }
        self::save($d);
    }

    private static function applyUnlocks(array &$d): void {
        for ($c = 1; $c <= $d['chapter']; $c++) foreach (self::CHAPTERS[$c]['unlock'] as $u) $d['unlocks'][] = $u;
        if (in_array('blightling', $d['unlocks']) && !$d['boss_active'] && $d['chapter'] === 3) { $d['boss_active'] = 1; $d['boss_hp'] = 300; }
        $db = Database::get();
        foreach (['ironwright', 'blightling', 'mossback', 'ember_eye', 'wanderer'] as $ch) {
            $present = ($ch === 'blightling') ? (int)$d['boss_active'] : (in_array($ch, $d['unlocks']) ? 1 : 0);
            $db->prepare("UPDATE character_state SET present = ? WHERE key = ?")->execute([$present, $ch]);
        }
    }

    // ═══════════════════════════════════════════════════════════
    // MAIN LOOP — called from GameEngine::tick
    // ═══════════════════════════════════════════════════════════
    public static function tick(array &$game, array $clans, float $dtMin): void {
        $d = self::get();
        if (empty($d['unlocks'])) { self::applyUnlocks($d); self::log($d, 'Chapter 1 — ' . self::CHAPTERS[1]['title'] . '. ' . self::CHAPTERS[1]['intro']); }
        $m = json_decode($game['metrics'] ?: '{}', true) ?: [];
        $forest = (($clans['grove']['influence'] ?? 25) + ($clans['fang']['influence'] ?? 25) + ($clans['veil']['influence'] ?? 25)) / 3;
        $forge = (float)($clans['forge']['influence'] ?? 25);
        $balance = max(-1, min(1, ($forest - $forge) / 60));
        $curse = (float)$game['chaos'];

        // chapter metrics
        $cm = &$d['chapter_metrics'];
        if ($forge >= 60) $cm['forge_60'] = 1;
        if ($balance > 0) { $cm['balance_pos'] = 1; $d['green_seconds'] += $dtMin * 60; } else { $d['green_seconds'] = max(0, $d['green_seconds'] - $dtMin * 30); }
        $cm['green_minutes'] = round($d['green_seconds'] / 60, 1);
        $cm['spirits'] = $m['spirits'] ?? 0; $cm['new_guardians'] = $m['new_guardians'] ?? 0; $cm['votes'] = $m['votes'] ?? 0;
        $cm['tall_one'] = $m['tall_one_events'] ?? 0; $cm['healed'] = $m['healed'] ?? 0;
        $cm['all_peoples_20'] = (min(array_map(fn($c) => (float)$c['influence'], $clans)) >= 20) ? 1 : 0;
        $cm['curse_low'] = $curse < 10 ? 1 : 0;

        // boss (chapter 3): the Blightling feeds on curse and dies from healing
        if ($d['boss_active']) {
            $d['boss_hp'] = max(0, $d['boss_hp'] + $curse * 0.02 * $dtMin * 60 - ($m['healed_delta'] ?? 0));
            if (($cm['healed'] ?? 0) >= 300 || $d['boss_hp'] <= 0) { $d['boss_active'] = 0; $d['boss_hp'] = 0; $game['chaos'] = 0; self::log($d, 'The Blightling dissolves into rain. Hatred remembered how to be water.'); GameEngine::queueEventPublic('boss_defeated', ['name' => 'The Blightling']); Database::get()->exec("UPDATE character_state SET present = 0 WHERE key = 'blightling'"); }
        }

        // chapter completion
        $ch = self::CHAPTERS[$d['chapter']];
        $done = true; foreach ($ch['check'] as $k => $target) if (($cm[$k] ?? 0) < $target) $done = false;
        if ($done && $d['chapter'] < count(self::CHAPTERS)) {
            GameEngine::queueEventPublic('chapter_complete', ['chapter' => $d['chapter'], 'title' => $ch['title']]);
            $d['chapter']++; $d['chapter_started'] = time(); $d['chapter_metrics'] = []; $d['green_seconds'] = 0;
            self::applyUnlocks($d);
            $next = self::CHAPTERS[$d['chapter']];
            self::log($d, 'Chapter ' . $d['chapter'] . ' — ' . $next['title'] . '. ' . $next['intro']);
            GameEngine::queueEventPublic('chapter', self::chapterPublic($d) + ['intro' => $next['intro']]);
            GameEngine::queueEventPublic('request_speech', ['mode' => 'mythology', 'type' => 'legend', 'context' => 'A new chapter begins: ' . $next['title'] . '. ' . $next['intro']]);
            $game['xp_multiplier'] = 1.5; $game['xp_multiplier_until'] = time() + 180;
        }

        // ─── NATURE'S MOVE — one action every 45–120 s depending on aggressiveness ───
        $interval = 120 - 75 * (float)$d['aggressiveness'];
        if ($d['enabled'] && time() - (int)$d['last_action'] > $interval) {
            $d['last_action'] = time();
            self::act($d, $game, $clans, $balance, $curse, $m);
        }
        self::save($d);
    }

    /** Utility-based choice: each candidate action scores itself against the state; highest wins (with noise). */
    private static function act(array &$d, array &$game, array $clans, float $balance, float $curse, array $m): void {
        $mood = self::CHAPTERS[$d['chapter']]['director_mood'];
        $weakest = array_keys($clans, min($clans))[0] ?? 'grove';
        usort($clans, fn($a, $b) => $a['influence'] <=> $b['influence']);
        $weakest = $clans[0]['key'] ?? 'grove';
        $active = (int)Database::get()->query("SELECT COUNT(*) c FROM guardians WHERE last_seen > datetime('now','-10 minutes')")->fetch()['c'];
        $r = fn() => mt_rand(0, 100) / 100;

        $cands = [
            'rain'        => ($curse / 100) * 1.4 + ($mood === 'gentle' ? 0.2 : 0) + $r() * 0.3,
            'blight'      => ($balance < -0.2 ? 0.8 : 0.1) + ($mood === 'hostile' ? 0.5 : 0) + ($active > 3 ? 0.2 : -0.5) + $r() * 0.3,
            'help_weak'   => (1 - ($clans[0]['influence'] / 100)) * 0.9 + $r() * 0.3,
            'tempt'       => ($mood === 'tempting' ? 0.9 : 0.2) + ($balance > 0.5 ? 0.3 : 0) + $r() * 0.3,
            'character'   => (count($d['unlocks']) > 2 ? 0.6 : 0.1) + $r() * 0.5,
            'fireflies'   => ($active < 2 ? 0.7 : 0.3) + $r() * 0.3,
            'council'     => ($mood === 'solemn' || $mood === 'serene' ? 0.5 : 0.2) + $r() * 0.4,
            'silence'     => ($mood === 'serene' ? 0.6 : 0.05) + $r() * 0.2,
        ];
        arsort($cands); $action = array_key_first($cands);

        switch ($action) {
            case 'rain':
                $game['chaos'] = max(0, $curse - 25); self::metric($game, 'healed', 25);
                GameEngine::queueEventPublic('world_event', ['event' => 'first_rain', 'number' => 0, 'by' => 'nature']);
                self::log($d, 'Nature calls the rain. The curse loosens its grip.'); break;
            case 'blight':
                $game['chaos'] = min(100, $curse + 12 + 15 * (float)$d['aggressiveness']);
                GameEngine::queueEventPublic('blight', ['strength' => (float)$d['aggressiveness'], 'boss' => (bool)$d['boss_active'], 'boss_hp' => $d['boss_hp']]);
                self::log($d, 'Black tendrils push through the roots. The island tests the humans.'); break;
            case 'help_weak':
                Database::get()->prepare("UPDATE clans SET influence = MIN(100, influence + 12) WHERE key = ?")->execute([$weakest]);
                GameEngine::queueEventPublic('nature_gift', ['clan' => $weakest, 'amount' => 12]);
                self::log($d, 'Nature leans toward the ' . ucfirst($weakest) . ', who were losing ground.'); break;
            case 'tempt':
                Database::get()->exec("UPDATE clans SET influence = MIN(100, influence + 8) WHERE key = 'forge'");
                $game['xp_multiplier'] = 1.5; $game['xp_multiplier_until'] = time() + 60;
                self::speak('ironwright', 'Offer the audience iron: more XP for one minute, at the cost of the trees. Be tempting and honest.');
                self::log($d, 'The Ironwright lights the furnaces: ×1.5 XP for a minute, and the forest holds its breath.'); break;
            case 'character':
                $present = Database::get()->query("SELECT key FROM character_state WHERE present = 1")->fetchAll(PDO::FETCH_COLUMN);
                if ($present) { $who = $present[array_rand($present)]; self::speak($who, 'Comment on the current state of the island in one or two sentences, in character.'); self::log($d, self::CHARACTERS[$who]['name'] . ' speaks.'); }
                break;
            case 'fireflies':
                GameEngine::queueEventPublic('world_event', ['event' => 'firefly_migration', 'number' => 0, 'by' => 'nature']);
                self::log($d, 'Nature sends fireflies to call the humans back.'); break;
            case 'council':
                GameEngine::openCouncilPublic($game); self::log($d, 'The Wanderer convenes the Council.'); break;
            case 'silence':
                GameEngine::queueEventPublic('silence', ['seconds' => 20]); self::log($d, 'Nature asks for twenty seconds of silence.'); break;
        }
    }

    private static function metric(array &$game, string $k, $n = 1): void {
        $m = json_decode($game['metrics'] ?: '{}', true) ?: []; $m[$k] = ($m[$k] ?? 0) + $n; $game['metrics'] = json_encode($m);
    }

    /** Character line — AI if available, else a written fallback. */
    public static function speak(string $who, string $instruction): void {
        self::ensureSchema();
        if (!isset(self::CHARACTERS[$who])) return;
        $c = self::CHARACTERS[$who];
        $line = null;
        if (getConfig('director_speech_ai', '1') === '1' && class_exists('AIEngine') && AIEngine::isAvailable()) {
            try { $line = AIEngine::generateSpeech('reactive', ['context' => "You are now speaking AS {$c['name']}, {$c['role']}. Voice: {$c['voice']}. $instruction Stay under 30 words."]); } catch (Throwable $e) {}
        }
        if (!$line) $line = self::fallbackLine($who);
        Database::get()->prepare("UPDATE character_state SET last_line = ?, last_spoke = ? WHERE key = ?")->execute([$line, time(), $who]);
        GameEngine::queueEventPublic('character_speak', ['who' => $who, 'name' => $c['name'], 'icon' => $c['icon'], 'color' => $c['color'], 'line' => $line]);
    }

    private static function fallbackLine(string $who): string {
        $lines = [
            'mossback'   => ['I have carried this grove for a thousand springs. I can carry your quarrels too.', 'Slow down. The moss is listening.', 'Balance is not a place. It is a way of walking.'],
            'ember_eye'  => ['Humans smell of smoke and apology. Prove you are more than that.', 'My cubs sleep under the roots you want to burn.', 'Courage I respect. Greed I bury.'],
            'ironwright' => ['We do not hate the forest. We simply cannot eat it.', 'Iron feeds children. Show me a tree that does.', 'Give me one hour of fire and I will give you a winter of bread.'],
            'wanderer'   => ['Who here has asked the river what it wants?', 'Every side is right about something. That is the problem.', 'I carry no flag. I carry questions.'],
            'blightling' => ['...see me... see me...', 'hate is warm. hate is warm.', 'you made me. you made me.'],
            'tall_one'   => ['…'],
        ];
        $l = $lines[$who] ?? ['…']; return $l[array_rand($l)];
    }

    // ═══════════════════════════════════════════════════════════
    public static function chapterPublic(array $d = null): array {
        $d = $d ?: self::get();
        $ch = self::CHAPTERS[$d['chapter']];
        $progress = [];
        foreach ($ch['check'] as $k => $target) $progress[$k] = ['value' => $d['chapter_metrics'][$k] ?? 0, 'target' => $target];
        return ['number' => (int)$d['chapter'], 'total' => count(self::CHAPTERS), 'title' => $ch['title'], 'goal' => $ch['goal'],
                'progress' => $progress, 'unlocks' => $d['unlocks'], 'mood' => $ch['director_mood']];
    }

    public static function publicState(): array {
        $d = self::get();
        $chars = Database::get()->query("SELECT * FROM character_state")->fetchAll();
        $cast = [];
        foreach ($chars as $c) $cast[$c['key']] = self::CHARACTERS[$c['key']] + ['present' => (bool)$c['present'], 'lastLine' => $c['last_line'], 'lastSpoke' => (int)$c['last_spoke']];
        return ['enabled' => (bool)$d['enabled'], 'aggressiveness' => (float)$d['aggressiveness'], 'chapter' => self::chapterPublic($d),
                'boss' => ['active' => (bool)$d['boss_active'], 'hp' => round((float)$d['boss_hp']), 'max' => 300],
                'cast' => $cast, 'log' => array_slice($d['log'], -12)];
    }

    public static function chaptersList(): array {
        $out = []; foreach (self::CHAPTERS as $n => $c) $out[] = ['number' => $n, 'title' => $c['title'], 'goal' => $c['goal'], 'unlock' => $c['unlock']]; return $out;
    }
}
