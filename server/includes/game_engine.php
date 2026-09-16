<?php
/**
 * SOCIOBEAST GENESIS v12 — Game Engine
 * Clans · Guardians · Island Energy · Chaos · Council Votes · Quests · Seasons
 * Every TikTok viewer becomes a Kodama guardian on the island.
 */

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/memory_engine.php';
require_once __DIR__ . '/state_engine.php';
require_once __DIR__ . '/island_director.php';

class GameEngine {

    // ─── Four peoples of the island (Miyazaki-inspired, original) ───
    const CLANS = [
        'grove' => ['name' => 'Grove', 'icon' => '🌲', 'element' => 'ancient forest', 'color' => '#7fd67f', 'quadrant' => 0,
                    'power' => 'green_tide',  'power_name' => 'Green Tide',  'side' => 'forest',
                    'motto' => 'The trees remember everything.'],
        'forge' => ['name' => 'Forge', 'icon' => '⚒️', 'element' => 'iron & fire', 'color' => '#e0a050', 'quadrant' => 1,
                    'power' => 'iron_bell',   'power_name' => 'Iron Bell',   'side' => 'industry',
                    'motto' => 'We are not evil. We are hungry.'],
        'fang'  => ['name' => 'Fang',  'icon' => '🐺', 'element' => 'wild beasts', 'color' => '#d9534f', 'quadrant' => 2,
                    'power' => 'the_hunt',    'power_name' => 'The Hunt',    'side' => 'forest',
                    'motto' => 'Teeth and loyalty.'],
        'veil'  => ['name' => 'Veil',  'icon' => '🌙', 'element' => 'night spirits', 'color' => '#8f8ff0', 'quadrant' => 3,
                    'power' => 'spirit_veil', 'power_name' => 'Spirit Veil', 'side' => 'forest',
                    'motto' => 'What is unseen still watches.'],
    ];

    const RANKS = [
        ['key' => 'wisp',   'name' => 'Sprout',   'icon' => '🌱', 'xp' => 0,    'scale' => 0.45],
        ['key' => 'spirit', 'name' => 'Kodama',   'icon' => '👻', 'xp' => 50,   'scale' => 0.7],
        ['key' => 'elder',  'name' => 'Elder',    'icon' => '🍃', 'xp' => 300,  'scale' => 1.0],
        ['key' => 'legend', 'name' => 'Guardian', 'icon' => '👑', 'xp' => 1500, 'scale' => 1.3],
    ];

    const XP = ['like' => 1, 'comment' => 3, 'share' => 10, 'follow' => 20, 'join' => 0];
    const ENERGY = ['like' => 1, 'comment' => 3, 'share' => 15, 'follow' => 25, 'join' => 0];

    const GIFT_TIERS = [
        ['min' => 5000, 'key' => 'genesis', 'name' => 'New Grove',   'icon' => '🌳', 'effect' => 'new_land'],
        ['min' => 500,  'key' => 'cosmic',  'name' => 'Great Howl',  'icon' => '🐺', 'effect' => 'meteor_rain'],
        ['min' => 100,  'key' => 'storm',   'name' => 'Rainfall',    'icon' => '🌧️', 'effect' => 'weather'],
        ['min' => 10,   'key' => 'bloom',   'name' => 'Seed',        'icon' => '🌸', 'effect' => 'local_bloom'],
        ['min' => 1,    'key' => 'spark',   'name' => 'Ember',       'icon' => '✨', 'effect' => 'blessing'],
    ];

    const QUEST_POOL = [
        ['key' => 'spirits_1000',  'text' => 'Reach 1,000 spirits on the island',        'metric' => 'spirits',            'target' => 1000],
        ['key' => 'guardians_20',  'text' => '20 new guardians join the island',          'metric' => 'new_guardians',      'target' => 20],
        ['key' => 'fractures_2',   'text' => 'Survive 2 curse outbreaks',                 'metric' => 'fractures_survived', 'target' => 2],
        ['key' => 'votes_50',      'text' => '50 votes at the Council',                   'metric' => 'votes',              'target' => 50],
        ['key' => 'energy_3',      'text' => 'Awaken 3 World Events',                     'metric' => 'world_events',       'target' => 3],
        ['key' => 'likes_2000',    'text' => 'Gather 2,000 likes',                        'metric' => 'likes',              'target' => 2000],
        ['key' => 'clan_100',      'text' => 'A people reaches 100% influence',           'metric' => 'clan_max',           'target' => 1],
        ['key' => 'rain_1',        'text' => 'Call the First Rain to wash the curse',     'metric' => 'rains',              'target' => 1],
    ];

    const COUNCIL_QUESTIONS = [
        ['q' => 'The Forge asks to cut the eastern grove for iron. What does the island say?',
         'options' => ['Allow the cutting', 'Refuse', 'Offer only fallen wood']],
        ['q' => 'A wounded boar-spirit drags a curse to the shore. Heal it or drive it away?',
         'options' => ['Heal it', 'Drive it away']],
        ['q' => 'A human child raised by wolves asks to live on the island. Welcome them?',
         'options' => ['Welcome them', 'Send them home', 'Let the wolves decide']],
        ['q' => 'The Mother Tree\'s spring is drying. Divert the Forge\'s river?',
         'options' => ['Divert the river', 'Let the Forge keep it', 'Dig a new spring together']],
        ['q' => 'Hunters seek the head of the Tall One, believing it grants eternal life. Warn it?',
         'options' => ['Warn the Tall One', 'Stay silent', 'Set a trap for the hunters']],
        ['q' => 'The night spirits ask for one hour of total silence each live. Grant it?',
         'options' => ['Grant the silence', 'Refuse', 'Only at dawn']],
        ['q' => 'Should the island bear a name?',
         'options' => ['Aether', 'Kodamaya', 'Leave it nameless']],
    ];

    // World events awakened by the island's energy
    const WORLD_EVENTS = [
        'spirit_lights'     => 'Spirit Lights',
        'mother_tree'       => 'The Mother Tree awakens',
        'firefly_migration' => 'Firefly Migration',
        'tall_one'          => 'The Tall One passes',
        'first_rain'        => 'The First Rain',
        'prophecy'          => 'Prophecy',
    ];

    // ═══════════════════════════════════════════════════════════════
    // SCHEMA
    // ═══════════════════════════════════════════════════════════════
    private static $schemaDone = false;
    public static function ensureSchema(): void {
        if (self::$schemaDone) return;
        self::$schemaDone = true;
        $db = Database::get();
        $db->exec("
            CREATE TABLE IF NOT EXISTS guardians (
                username TEXT PRIMARY KEY,
                display_name TEXT,
                clan TEXT DEFAULT 'grove',
                xp INTEGER DEFAULT 0,
                rank TEXT DEFAULT 'wisp',
                instance_id TEXT,
                pos_x REAL DEFAULT 0, pos_z REAL DEFAULT 0,
                clan_changed_season INTEGER DEFAULT 0,
                lives_seen INTEGER DEFAULT 1,
                total_gifts INTEGER DEFAULT 0,
                first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS clans (
                key TEXT PRIMARY KEY,
                influence REAL DEFAULT 25,
                members INTEGER DEFAULT 0,
                total_xp INTEGER DEFAULT 0,
                seasons_won INTEGER DEFAULT 0,
                last_power_at INTEGER DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS game_state (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                season INTEGER DEFAULT 1,
                season_started INTEGER DEFAULT 0,
                island_energy REAL DEFAULT 0,
                energy_threshold REAL DEFAULT 500,
                chaos REAL DEFAULT 0,
                fractures INTEGER DEFAULT 0,
                fractured_until INTEGER DEFAULT 0,
                world_events INTEGER DEFAULT 0,
                island_time REAL DEFAULT 0.25,
                biome TEXT DEFAULT 'grove',
                xp_multiplier REAL DEFAULT 1,
                xp_multiplier_until INTEGER DEFAULT 0,
                last_tick INTEGER DEFAULT 0,
                last_council INTEGER DEFAULT 0,
                event_window_start INTEGER DEFAULT 0,
                event_window_count INTEGER DEFAULT 0,
                quests TEXT DEFAULT '[]',
                metrics TEXT DEFAULT '{}'
            );
            CREATE TABLE IF NOT EXISTS council_votes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                season INTEGER,
                question TEXT,
                options TEXT,
                votes TEXT DEFAULT '{}',
                voters TEXT DEFAULT '{}',
                status TEXT DEFAULT 'open',
                winner INTEGER,
                opened_at INTEGER,
                closes_at INTEGER
            );
            CREATE TABLE IF NOT EXISTS lore_decisions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                season INTEGER,
                question TEXT,
                decision TEXT,
                vote_count INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS world_event_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                payload TEXT DEFAULT '{}',
                created_at INTEGER
            );
            CREATE TABLE IF NOT EXISTS land_fragments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT, donor TEXT, angle REAL, distance REAL, radius REAL,
                season INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS seasons (
                season INTEGER PRIMARY KEY,
                winner_clan TEXT, started_at INTEGER, ended_at INTEGER,
                summary TEXT
            );
        ");
        $now = time();
        $db->exec("INSERT OR IGNORE INTO game_state (id, season_started, last_tick, last_council, event_window_start) VALUES (1, $now, $now, $now, $now)");
        foreach (array_keys(self::CLANS) as $c) {
            $db->exec("INSERT OR IGNORE INTO clans (key) VALUES ('$c')");
        }
        $gs = self::getGame();
        if ($gs['quests'] === '[]' || $gs['quests'] === '' || $gs['quests'] === null) {
            self::rollQuests();
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // STATE ACCESS
    // ═══════════════════════════════════════════════════════════════
    public static function getGame(): array {
        $db = Database::get();
        return $db->query("SELECT * FROM game_state WHERE id = 1")->fetch() ?: [];
    }

    private static function saveGame(array $g): void {
        $db = Database::get();
        $cols = ['season','season_started','island_energy','energy_threshold','chaos','fractures','fractured_until',
                 'world_events','island_time','biome','xp_multiplier','xp_multiplier_until','last_tick','last_council',
                 'event_window_start','event_window_count','quests','metrics'];
        $sets = []; $vals = [];
        foreach ($cols as $c) { if (array_key_exists($c, $g)) { $sets[] = "$c = ?"; $vals[] = $g[$c]; } }
        $db->prepare("UPDATE game_state SET " . implode(', ', $sets) . " WHERE id = 1")->execute($vals);
    }

    public static function getClans(): array {
        $db = Database::get();
        $rows = $db->query("SELECT * FROM clans")->fetchAll();
        $out = [];
        foreach ($rows as $r) {
            $out[$r['key']] = array_merge(self::CLANS[$r['key']], $r);
        }
        return $out;
    }

    private static function metric(array &$g, string $key, int $inc = 1): void {
        $m = json_decode($g['metrics'] ?: '{}', true) ?: [];
        $m[$key] = ($m[$key] ?? 0) + $inc;
        $g['metrics'] = json_encode($m);
    }

    private static function queueEvent(string $type, array $payload = []): void {
        $db = Database::get();
        $db->prepare("INSERT INTO world_event_queue (type, payload, created_at) VALUES (?, ?, ?)")
           ->execute([$type, json_encode($payload), time()]);
        // keep queue small
        $db->exec("DELETE FROM world_event_queue WHERE id NOT IN (SELECT id FROM world_event_queue ORDER BY id DESC LIMIT 200)");
    }

    public static function queueEventPublic(string $type, array $payload = []): void { self::ensureSchema(); self::queueEvent($type, $payload); }
    public static function openCouncilPublic(array &$game): void { self::ensureSchema(); self::openCouncil($game, true); }

    public static function drainEvents(int $sinceId): array {
        $db = Database::get();
        $st = $db->prepare("SELECT * FROM world_event_queue WHERE id > ? ORDER BY id ASC LIMIT 60");
        $st->execute([$sinceId]);
        $rows = $st->fetchAll();
        foreach ($rows as &$r) $r['payload'] = json_decode($r['payload'], true) ?: [];
        return $rows;
    }

    // ═══════════════════════════════════════════════════════════════
    // GUARDIANS (viewers → kodamas)
    // ═══════════════════════════════════════════════════════════════
    public static function rankFor(int $xp): array {
        $r = self::RANKS[0];
        foreach (self::RANKS as $rank) if ($xp >= $rank['xp']) $r = $rank;
        return $r;
    }

    public static function getGuardian(string $username): ?array {
        $db = Database::get();
        $st = $db->prepare("SELECT * FROM guardians WHERE username = ?");
        $st->execute([$username]);
        return $st->fetch() ?: null;
    }

    private static function weakestClan(): string {
        $db = Database::get();
        $row = $db->query("SELECT key FROM clans ORDER BY members ASC, influence ASC LIMIT 1")->fetch();
        return $row['key'] ?? 'grove';
    }

    /** Ensure a guardian exists; returns [guardian, isNew] */
    public static function touchGuardian(string $username, string $displayName = ''): array {
        $db = Database::get();
        $g = self::getGuardian($username);
        if ($g) {
            $db->prepare("UPDATE guardians SET last_seen = CURRENT_TIMESTAMP, display_name = COALESCE(NULLIF(?,''), display_name) WHERE username = ?")
               ->execute([$displayName, $username]);
            return [$g, false];
        }
        $clan = self::weakestClan();
        $angle = mt_rand(0, 6283) / 1000;
        $q = self::CLANS[$clan]['quadrant'];
        $angle = $q * M_PI / 2 + (mt_rand(0, 1000) / 1000) * M_PI / 2; // inside clan quadrant
        $dist = 4 + mt_rand(0, 2000) / 100;
        $x = cos($angle) * $dist; $z = sin($angle) * $dist;
        $instanceId = 'guardian_' . preg_replace('/[^a-z0-9_]/i', '', $username) . '_' . substr(md5($username), 0, 6);
        $db->prepare("INSERT INTO guardians (username, display_name, clan, instance_id, pos_x, pos_z) VALUES (?,?,?,?,?,?)")
           ->execute([$username, $displayName ?: $username, $clan, $instanceId, $x, $z]);
        $db->prepare("UPDATE clans SET members = members + 1 WHERE key = ?")->execute([$clan]);
        $g = self::getGuardian($username);
        $game = self::getGame();
        self::metric($game, 'new_guardians');
        self::saveGame($game);
        self::queueEvent('guardian_born', ['guardian' => self::publicGuardian($g)]);
        return [$g, true];
    }

    public static function publicGuardian(array $g): array {
        $rank = self::rankFor((int)$g['xp']);
        $next = null;
        foreach (self::RANKS as $r) if ($r['xp'] > $g['xp']) { $next = $r; break; }
        return [
            'username' => $g['username'],
            'name' => $g['display_name'] ?: $g['username'],
            'clan' => $g['clan'],
            'clanColor' => self::CLANS[$g['clan']]['color'] ?? '#ffffff',
            'clanIcon' => self::CLANS[$g['clan']]['icon'] ?? '',
            'xp' => (int)$g['xp'],
            'rank' => $rank['key'],
            'rankName' => $rank['name'],
            'rankIcon' => $rank['icon'],
            'scale' => $rank['scale'],
            'nextXp' => $next ? $next['xp'] : null,
            'instanceId' => $g['instance_id'],
            'x' => (float)$g['pos_x'], 'z' => (float)$g['pos_z'],
            'lives' => (int)$g['lives_seen'],
        ];
    }

    private static function addGuardianXp(string $username, int $xp): array {
        $db = Database::get();
        $g = self::getGuardian($username);
        if (!$g) return ['rankUp' => null];
        $game = self::getGame();
        $mult = (time() < (int)$game['xp_multiplier_until']) ? (float)$game['xp_multiplier'] : 1.0;
        $xp = (int)round($xp * $mult);
        $oldRank = self::rankFor((int)$g['xp']);
        $newXp = (int)$g['xp'] + $xp;
        $newRank = self::rankFor($newXp);
        $db->prepare("UPDATE guardians SET xp = ?, rank = ? WHERE username = ?")->execute([$newXp, $newRank['key'], $username]);
        $db->prepare("UPDATE clans SET total_xp = total_xp + ? WHERE key = ?")->execute([$xp, $g['clan']]);
        $rankUp = null;
        if ($newRank['key'] !== $oldRank['key']) {
            $rankUp = $newRank;
            $g['xp'] = $newXp;
            self::queueEvent('rank_up', ['guardian' => self::publicGuardian($g), 'rank' => $newRank]);
            if ($newRank['key'] === 'legend') {
                $db->prepare("UPDATE viewers SET is_legend = 1 WHERE username = ?")->execute([$username]);
                MemoryEngine::addMemorableMoment($username, "Became a Legend of the island", 'legend');
            }
        }
        return ['rankUp' => $rankUp, 'xp' => $newXp];
    }

    public static function setClan(string $username, string $clan): array {
        if (!isset(self::CLANS[$clan])) return ['ok' => false, 'reason' => 'unknown_clan'];
        $db = Database::get();
        [$g] = self::touchGuardian($username);
        $game = self::getGame();
        if ((int)$g['clan_changed_season'] === (int)$game['season'] && $g['clan'] !== $clan) {
            return ['ok' => false, 'reason' => 'already_changed'];
        }
        if ($g['clan'] === $clan) return ['ok' => true, 'clan' => $clan];
        $db->prepare("UPDATE clans SET members = MAX(0, members - 1) WHERE key = ?")->execute([$g['clan']]);
        $db->prepare("UPDATE clans SET members = members + 1 WHERE key = ?")->execute([$clan]);
        // relocate to new quadrant
        $q = self::CLANS[$clan]['quadrant'];
        $angle = $q * M_PI / 2 + (mt_rand(0, 1000) / 1000) * M_PI / 2;
        $dist = 4 + mt_rand(0, 2000) / 100;
        $db->prepare("UPDATE guardians SET clan = ?, clan_changed_season = ?, pos_x = ?, pos_z = ? WHERE username = ?")
           ->execute([$clan, $game['season'], cos($angle) * $dist, sin($angle) * $dist, $username]);
        $g = self::getGuardian($username);
        self::queueEvent('clan_change', ['guardian' => self::publicGuardian($g)]);
        return ['ok' => true, 'clan' => $clan];
    }

    public static function leaderboard(int $n = 5): array {
        $db = Database::get();
        $rows = $db->query("SELECT * FROM guardians ORDER BY xp DESC LIMIT $n")->fetchAll();
        return array_map([self::class, 'publicGuardian'], $rows);
    }

    public static function recentGuardians(int $n = 400): array {
        self::ensureSchema();
        $db = Database::get();
        $rows = $db->query("SELECT * FROM guardians ORDER BY last_seen DESC LIMIT $n")->fetchAll();
        return array_map([self::class, 'publicGuardian'], $rows);
    }

    // ═══════════════════════════════════════════════════════════════
    // CORE: handle a normalised live event
    // type: like | comment | gift | follow | share | join
    // ═══════════════════════════════════════════════════════════════
    public static function handleLiveEvent(string $type, array $d): array {
        self::ensureSchema();
        $username = trim($d['username'] ?? 'anonymous') ?: 'anonymous';
        $display = trim($d['displayName'] ?? $username);
        $count = max(1, (int)($d['count'] ?? 1));
        $result = ['type' => $type, 'username' => $username, 'commands' => []];

        [$guardian, $isNew] = self::touchGuardian($username, $display);
        $result['newGuardian'] = $isNew;
        if (!empty($d['_bridge'])) { setConfig('bridge_last_ping', (string)time()); setConfig('bridge_last_event', $type . ' from ' . $username); }

        $game = self::getGame();
        self::tickInternal($game);

        // ── Chaos window (events / 10s) ──
        $now = time();
        if ($now - (int)$game['event_window_start'] >= 10) {
            $game['event_window_start'] = $now;
            $game['event_window_count'] = 0;
        }
        $isCalm = $type === 'comment' && stripos(trim($d['text'] ?? ''), '!calm') === 0;
        if (!$isCalm) {
            $game['event_window_count'] += ($type === 'like') ? min($count, 5) : 1;
            if ($game['event_window_count'] > (int)getConfig('curse_spam_threshold', '60')) $game['chaos'] = min(100, (float)$game['chaos'] + 2);
        }

        $xp = 0; $energy = 0; $clanInfluence = 0;

        switch ($type) {
            case 'like':
                $xp = self::XP['like'] * min($count, 30);
                $energy = self::ENERGY['like'] * $count;
                $clanInfluence = 0.05 * $count;
                self::metric($game, 'likes', $count);
                break;

            case 'comment':
                $text = trim($d['text'] ?? '');
                $xp = self::XP['comment']; $energy = self::ENERGY['comment']; $clanInfluence = 0.5;
                $result['commands'] = self::handleCommand($username, $text, $game, $result);
                break;

            case 'gift':
                $coins = max(1, (int)($d['coins'] ?? $d['value'] ?? 1)) * $count;
                $giftName = $d['giftName'] ?? 'gift';
                $tier = self::giftTier($coins);
                $xp = (int)($coins / 2); $energy = $coins; $clanInfluence = $coins * 0.4;
                Database::get()->prepare("UPDATE guardians SET total_gifts = total_gifts + ? WHERE username = ?")->execute([$coins, $username]);
                self::metric($game, 'gift_coins', $coins);
                $payload = ['guardian' => self::publicGuardian(self::getGuardian($username)), 'tier' => $tier,
                            'coins' => $coins, 'giftName' => $giftName];
                if ($tier['key'] === 'genesis') {
                    $payload['fragment'] = self::createLandFragment($username, $display, $game);
                }
                if ($tier['key'] === 'cosmic' || $tier['key'] === 'genesis') {
                    // Instant Elder
                    $g = self::getGuardian($username);
                    if ((int)$g['xp'] < 300) $xp += 300 - (int)$g['xp'];
                    $game['xp_multiplier'] = 2; $game['xp_multiplier_until'] = $now + 60;
                    $payload['doubleXp'] = 60;
                }
                self::queueEvent('gift_spell', $payload);
                $result['tier'] = $tier;
                break;

            case 'follow':
                $xp = self::XP['follow']; $energy = self::ENERGY['follow']; $clanInfluence = 3;
                break;

            case 'share':
                $xp = self::XP['share']; $energy = self::ENERGY['share']; $clanInfluence = 2;
                break;

            case 'join':
                $xp = 0; $energy = 0;
                if (!$isNew) {
                    Database::get()->prepare("UPDATE guardians SET lives_seen = lives_seen + 1 WHERE username = ? AND last_seen < datetime('now', '-6 hours')")->execute([$username]);
                    self::queueEvent('guardian_return', ['guardian' => self::publicGuardian(self::getGuardian($username))]);
                }
                break;
        }

        // Fractured island: nothing counts except !calm
        $fractured = $now < (int)$game['fractured_until'];
        if ($fractured) { $xp = 0; $energy = 0; $clanInfluence = 0; }

        if ($xp > 0) $result['xp'] = self::addGuardianXp($username, $xp);
        if ($clanInfluence > 0) self::addClanInfluence($guardian['clan'], $clanInfluence, $game);
        if ($energy > 0) self::addEnergy($game, $energy);

        self::checkQuests($game);
        self::saveGame($game);

        // Also feed the creature's emotional engine (v11 compat)
        try { StateEngine::applyEvent($type === 'join' ? 'comment' : $type, ['count' => $count, 'value' => $d['coins'] ?? 1]); } catch (Throwable $e) {}

        $result['game'] = self::publicState();
        return $result;
    }

    private static function giftTier(int $coins): array {
        foreach (self::GIFT_TIERS as $t) if ($coins >= $t['min']) return $t;
        return self::GIFT_TIERS[count(self::GIFT_TIERS) - 1];
    }

    // ═══════════════════════════════════════════════════════════════
    // CHAT COMMANDS
    // ═══════════════════════════════════════════════════════════════
    private static function handleCommand(string $username, string $text, array &$game, array &$result): array {
        $out = [];
        if ($text === '' || $text[0] !== '!') return $out;
        $parts = preg_split('/\s+/', strtolower(substr($text, 1)));
        $cmd = $parts[0] ?? '';
        $arg = $parts[1] ?? '';
        MemoryEngine::recordCommand($cmd);

        // Votes
        if (preg_match('/^[123]$/', $cmd)) {
            $v = self::castVote($username, (int)$cmd, $game);
            $out[] = ['cmd' => 'vote', 'ok' => $v];
            return $out;
        }

        switch ($cmd) {
            case 'calm': case 'pray': case 'breathe':
                self::metric($game, 'healed', min(5, (float)$game['chaos']));
                $game['chaos'] = max(0, (float)$game['chaos'] - 5);
                if ($game['chaos'] <= 0 && time() < (int)$game['fractured_until']) {
                    $game['fractured_until'] = 0;
                    $game['xp_multiplier'] = 2; $game['xp_multiplier_until'] = time() + 120;
                    self::metric($game, 'fractures_survived');
                    self::queueEvent('fracture_healed', ['by' => $username]);
                }
                $out[] = ['cmd' => 'calm', 'chaos' => $game['chaos']];
                break;

            case 'clan':
                $r = self::setClan($username, $arg);
                $out[] = ['cmd' => 'clan'] + $r;
                break;

            case 'me':
                $g = self::getGuardian($username);
                self::queueEvent('spotlight', ['guardian' => self::publicGuardian($g)]);
                $out[] = ['cmd' => 'me'];
                break;

            case 'top':
                self::queueEvent('show_leaderboard', ['top' => self::leaderboard(5)]);
                $out[] = ['cmd' => 'top'];
                break;

            case 'quest':
                self::queueEvent('show_quests', ['quests' => json_decode($game['quests'], true)]);
                break;

            case 'lore':
                $db = Database::get();
                $last = $db->query("SELECT * FROM lore_decisions ORDER BY id DESC LIMIT 1")->fetch();
                if ($last) self::queueEvent('tell_lore', ['decision' => $last]);
                break;

            case 'summon':
                $g = self::getGuardian($username);
                $rank = self::rankFor((int)$g['xp']);
                if (in_array($rank['key'], ['elder', 'legend'])) {
                    self::queueEvent('summon', ['guardian' => self::publicGuardian($g), 'count' => $rank['key'] === 'legend' ? 5 : 2]);
                    $out[] = ['cmd' => 'summon', 'ok' => true];
                } else {
                    $out[] = ['cmd' => 'summon', 'ok' => false, 'reason' => 'rank'];
                }
                break;

            case 'decree':
                $g = self::getGuardian($username);
                if (self::rankFor((int)$g['xp'])['key'] === 'legend') {
                    self::openCouncil($game, true);
                    $out[] = ['cmd' => 'decree', 'ok' => true];
                }
                break;

            case 'feed': case 'dance': case 'hide': case 'seek': case 'chaos': case 'sleep': case 'rain':
                self::queueEvent('collective_action', ['action' => $cmd, 'by' => $username]);
                $out[] = ['cmd' => $cmd];
                break;
        }
        return $out;
    }

    // ═══════════════════════════════════════════════════════════════
    // CLANS
    // ═══════════════════════════════════════════════════════════════
    private static function addClanInfluence(string $clan, float $amount, array &$game): void {
        $db = Database::get();
        $db->prepare("UPDATE clans SET influence = MIN(100, influence + ?) WHERE key = ?")->execute([$amount, $clan]);
        $row = $db->prepare("SELECT influence, last_power_at FROM clans WHERE key = ?");
        $row->execute([$clan]); $c = $row->fetch();
        if ((float)$c['influence'] >= 100 && time() - (int)$c['last_power_at'] > 120) {
            // Clan power!
            $db->prepare("UPDATE clans SET influence = 40, last_power_at = ? WHERE key = ?")->execute([time(), $clan]);
            self::metric($game, 'clan_max');
            $power = self::CLANS[$clan]['power'];
            self::queueEvent('clan_power', ['clan' => $clan, 'power' => $power, 'name' => self::CLANS[$clan]['power_name']]);
            if ($power === 'iron_bell')   { $game['xp_multiplier'] = 2; $game['xp_multiplier_until'] = time() + 60; $game['chaos'] = min(100, (float)$game['chaos'] + 10); } // industry feeds the curse
            if ($power === 'spirit_veil') { self::queueEvent('request_speech', ['mode' => 'prophecy']); }
            if ($power === 'green_tide')  { self::queueEvent('mass_xp', ['xp' => 10]); self::massXp(10); $game['chaos'] = max(0, (float)$game['chaos'] - 15); }
            if ($power === 'the_hunt')    { $game['xp_multiplier'] = 1.5; $game['xp_multiplier_until'] = time() + 90; }
        }
    }

    private static function massXp(int $xp): void {
        Database::get()->exec("UPDATE guardians SET xp = xp + $xp WHERE last_seen > datetime('now', '-30 minutes')");
    }

    // ═══════════════════════════════════════════════════════════════
    // ISLAND ENERGY → WORLD EVENTS
    // ═══════════════════════════════════════════════════════════════
    private static function addEnergy(array &$game, float $amount): void {
        $game['island_energy'] = (float)$game['island_energy'] + $amount;
        if ($game['island_energy'] >= (float)$game['energy_threshold']) {
            $game['island_energy'] = 0;
            $game['energy_threshold'] = round((float)$game['energy_threshold'] * 1.25);
            $game['world_events'] = (int)$game['world_events'] + 1;
            self::metric($game, 'world_events');
            $event = self::pickWorldEvent();
            self::queueEvent('world_event', ['event' => $event, 'number' => $game['world_events']]);
            if ($event === 'prophecy') self::queueEvent('request_speech', ['mode' => 'prophecy']);
            if ($event === 'mother_tree') self::queueEvent('request_speech', ['mode' => 'mythology']);
            if ($event === 'first_rain') { self::metric($game, 'healed', min(40, (float)$game['chaos'])); $game['chaos'] = max(0, (float)$game['chaos'] - 40); self::metric($game, 'rains'); }
            if ($event === 'tall_one') self::metric($game, 'tall_one_events');
            if ($event === 'tall_one') self::queueEvent('request_speech', ['mode' => 'reactive', 'context' => 'The Tall One, the great night-walking spirit, is crossing the island. Speak in awe and silence.']);
            MemoryEngine::addEvent('world_event', "World event #{$game['world_events']}: $event", '');
        }
    }

    private static function pickWorldEvent(): string {
        $state = StateEngine::getPublicState();
        $emo = $state['emotions'] ?? [];
        $dominant = 'happy'; $max = -1;
        $game = self::getGame();
        if ((float)$game['chaos'] > 50 && mt_rand(0, 100) < 50) return 'first_rain'; // the island heals itself when cursed
        foreach (['happy' => 'spirit_lights', 'curious' => 'mother_tree', 'excited' => 'firefly_migration', 'lonely' => 'tall_one', 'inspired' => 'prophecy'] as $e => $ev) {
            if (($emo[$e] ?? 0) > $max) { $max = $emo[$e] ?? 0; $dominant = $ev; }
        }
        // Weighted randomness: 60% dominant, 40% random
        if (mt_rand(0, 100) < 60) return $dominant;
        $all = array_keys(self::WORLD_EVENTS);
        return $all[array_rand($all)];
    }

    // ═══════════════════════════════════════════════════════════════
    // COUNCIL VOTES
    // ═══════════════════════════════════════════════════════════════
    public static function getOpenVote(): ?array {
        $db = Database::get();
        $v = $db->query("SELECT * FROM council_votes WHERE status = 'open' ORDER BY id DESC LIMIT 1")->fetch();
        if (!$v) return null;
        $v['options'] = json_decode($v['options'], true);
        $v['votes'] = json_decode($v['votes'], true) ?: [];
        $v['remaining'] = max(0, (int)$v['closes_at'] - time());
        return $v;
    }

    private static function openCouncil(array &$game, bool $force = false): void {
        if (self::getOpenVote()) return;
        $q = self::COUNCIL_QUESTIONS[array_rand(self::COUNCIL_QUESTIONS)];
        $db = Database::get();
        $votes = array_fill(1, count($q['options']), 0);
        $db->prepare("INSERT INTO council_votes (season, question, options, votes, opened_at, closes_at) VALUES (?,?,?,?,?,?)")
           ->execute([$game['season'], $q['q'], json_encode($q['options']), json_encode($votes), time(), time() + 90]);
        $game['last_council'] = time();
        self::queueEvent('council_open', ['vote' => self::getOpenVote()]);
    }

    private static function castVote(string $username, int $choice, array &$game): bool {
        $v = self::getOpenVote();
        if (!$v || $choice < 1 || $choice > count($v['options'])) return false;
        $voters = json_decode($v['voters'], true) ?: [];
        if (isset($voters[$username])) return false;
        $voters[$username] = $choice;
        $votes = $v['votes']; $votes[$choice] = ($votes[$choice] ?? 0) + 1;
        Database::get()->prepare("UPDATE council_votes SET votes = ?, voters = ? WHERE id = ?")
            ->execute([json_encode($votes), json_encode($voters), $v['id']]);
        self::metric($game, 'votes');
        self::queueEvent('vote_cast', ['votes' => $votes, 'total' => count($voters)]);
        return true;
    }

    private static function closeCouncil(array &$game): void {
        $v = self::getOpenVote();
        if (!$v || time() < (int)$v['closes_at']) return;
        $votes = $v['votes'];
        arsort($votes);
        $winner = (int)array_key_first($votes);
        $count = array_sum($votes);
        $decision = $v['options'][$winner - 1] ?? '?';
        $db = Database::get();
        $db->prepare("UPDATE council_votes SET status = 'closed', winner = ? WHERE id = ?")->execute([$winner, $v['id']]);
        $db->prepare("INSERT INTO lore_decisions (season, question, decision, vote_count) VALUES (?,?,?,?)")
           ->execute([$game['season'], $v['question'], $decision, $count]);
        MemoryEngine::addEvent('council', "The council decided: {$v['question']} → $decision ($count votes)", '');
        self::queueEvent('council_closed', ['question' => $v['question'], 'decision' => $decision, 'votes' => $count]);
        self::queueEvent('request_speech', ['mode' => 'reactive', 'context' => "The council voted: $decision"]);
    }

    /** Lore context injected into AI prompts */
    public static function loreContext(int $n = 5): string {
        self::ensureSchema();
        $db = Database::get();
        $rows = $db->query("SELECT question, decision FROM lore_decisions ORDER BY id DESC LIMIT $n")->fetchAll();
        if (!$rows) return '';
        $lines = array_map(fn($r) => "- {$r['question']} → The island chose: {$r['decision']}", $rows);
        return "Council decisions written into the island's history:\n" . implode("\n", $lines);
    }

    // ═══════════════════════════════════════════════════════════════
    // QUESTS
    // ═══════════════════════════════════════════════════════════════
    private static function rollQuests(): void {
        $pool = self::QUEST_POOL; shuffle($pool);
        $quests = array_map(fn($q) => $q + ['progress' => 0, 'done' => false], array_slice($pool, 0, 3));
        $g = self::getGame();
        $g['quests'] = json_encode($quests);
        $g['metrics'] = '{}';
        self::saveGame($g);
    }

    private static function checkQuests(array &$game): void {
        $quests = json_decode($game['quests'] ?: '[]', true) ?: [];
        $m = json_decode($game['metrics'] ?: '{}', true) ?: [];
        $changed = false;
        foreach ($quests as &$q) {
            if ($q['done']) continue;
            $val = $m[$q['metric']] ?? 0;
            if ($q['metric'] === 'spirits') $val = $m['spirits'] ?? 0;
            $q['progress'] = $val;
            if ($val >= $q['target']) {
                $q['done'] = true; $changed = true;
                $game['xp_multiplier'] = 1.5; $game['xp_multiplier_until'] = time() + 300;
                self::queueEvent('quest_complete', ['quest' => $q]);
                self::queueEvent('world_event', ['event' => 'firefly_migration', 'number' => 0, 'reward' => true]);
            }
        }
        $game['quests'] = json_encode($quests);
    }

    public static function reportSpirits(int $count): void {
        $g = self::getGame();
        $m = json_decode($g['metrics'] ?: '{}', true) ?: [];
        if (($m['spirits'] ?? 0) < $count) { $m['spirits'] = $count; $g['metrics'] = json_encode($m); self::checkQuests($g); self::saveGame($g); }
    }

    // ═══════════════════════════════════════════════════════════════
    // LAND FRAGMENTS (Genesis gifts)
    // ═══════════════════════════════════════════════════════════════
    private static function createLandFragment(string $username, string $display, array $game): array {
        $db = Database::get();
        $n = (int)$db->query("SELECT COUNT(*) c FROM land_fragments")->fetch()['c'];
        $angle = ($n * 2.399) % (2 * M_PI); // golden angle spread
        $frag = ['name' => "Grove of " . ($display ?: $username), 'donor' => $username, 'angle' => $angle,
                 'distance' => 42 + $n * 3, 'radius' => 6 + mt_rand(0, 40) / 10, 'season' => $game['season']];
        $db->prepare("INSERT INTO land_fragments (name, donor, angle, distance, radius, season) VALUES (?,?,?,?,?,?)")
           ->execute([$frag['name'], $username, $angle, $frag['distance'], $frag['radius'], $game['season']]);
        MemoryEngine::addMemorableMoment($username, "Gifted a new land: {$frag['name']}", 'genesis');
        MemoryEngine::addEvent('genesis', "A new land was born: {$frag['name']}", $username);
        return $frag;
    }

    public static function getFragments(): array {
        self::ensureSchema();
        return Database::get()->query("SELECT * FROM land_fragments ORDER BY id")->fetchAll();
    }

    // ═══════════════════════════════════════════════════════════════
    // TICK (time-based: chaos decay, influence decay, day/night, council, fracture)
    // ═══════════════════════════════════════════════════════════════
    private static function tickInternal(array &$game): void {
        $now = time();
        $dt = max(0, $now - (int)$game['last_tick']);
        if ($dt <= 0) return;
        $game['last_tick'] = $now;
        $dtMin = $dt / 60;

        // Fracture trigger (checked before natural decay)
        if ((float)$game['chaos'] >= 100 && $now >= (int)$game['fractured_until']) {
            $game['fractured_until'] = $now + 30;
            $game['fractures'] = (int)$game['fractures'] + 1;
            $game['chaos'] = 60;
            self::queueEvent('fracture', ['number' => $game['fractures']]);
            MemoryEngine::addEvent('fracture', "The island fractured (#{$game['fractures']})", '');
        } elseif ($now >= (int)$game['fractured_until'] && (int)$game['fractured_until'] > 0) {
            $game['fractured_until'] = 0;
            self::metric($game, 'fractures_survived');
            self::queueEvent('fracture_healed', ['by' => 'time']);
        }

        // The curse fades 3/min naturally; industry feeds it
        $game['chaos'] = max(0, (float)$game['chaos'] - (float)getConfig('curse_decay_per_min', '3') * $dtMin);
        $forge = (float)(Database::get()->query("SELECT influence FROM clans WHERE key = 'forge'")->fetch()['influence'] ?? 0);
        if ($forge > 75) $game['chaos'] = min(100, (float)$game['chaos'] + 1.5 * $dtMin);

        // Clan influence decay 1/min
        Database::get()->exec("UPDATE clans SET influence = MAX(5, influence - " . (1 * $dtMin) . ")");

        // Island time: 45 real minutes = 1 day
        $game['island_time'] = fmod((float)$game['island_time'] + $dtMin / 45, 1.0);

        // Council every N minutes
        $interval = (int)getConfig('council_interval_min', '8');
        self::closeCouncil($game);
        if ($now - (int)$game['last_council'] > $interval * 60) self::openCouncil($game);

        // Nature plays (Island Director)
        try { IslandDirector::tick($game, self::getClans(), $dtMin); } catch (Throwable $e) { error_log('[Director] ' . $e->getMessage()); }
    }

    public static function tick(): array {
        self::ensureSchema();
        $game = self::getGame();
        self::tickInternal($game);
        self::checkQuests($game);
        self::saveGame($game);
        return self::publicState();
    }

    public static function adjustCurse(float $delta): void { $g = self::getGame(); $g['chaos'] = max(0, min(100, (float)$g['chaos'] + $delta)); self::saveGame($g); }

    public static function resetGame(): void {
        $db = Database::get();
        foreach (['guardians', 'clans', 'game_state', 'council_votes', 'lore_decisions', 'world_event_queue', 'land_fragments', 'seasons', 'director_state', 'character_state'] as $t) $db->exec("DROP TABLE IF EXISTS $t");
        self::$schemaDone = false; IslandDirector::resetSchemaFlag(); self::ensureSchema(); IslandDirector::ensureSchema();
    }

    // ═══════════════════════════════════════════════════════════════
    // SEASONS
    // ═══════════════════════════════════════════════════════════════
    public static function endSeason(): array {
        self::ensureSchema();
        $db = Database::get();
        $game = self::getGame();
        $clans = $db->query("SELECT key, total_xp FROM clans ORDER BY total_xp DESC")->fetchAll();
        $winner = $clans[0]['key'] ?? 'grove';
        $db->prepare("INSERT OR REPLACE INTO seasons (season, winner_clan, started_at, ended_at, summary) VALUES (?,?,?,?,?)")
           ->execute([$game['season'], $winner, $game['season_started'], time(), json_encode(['clans' => $clans, 'metrics' => json_decode($game['metrics'], true)])]);
        $db->prepare("UPDATE clans SET seasons_won = seasons_won + 1 WHERE key = ?")->execute([$winner]);
        $db->exec("UPDATE clans SET influence = 25, total_xp = 0");
        MemoryEngine::addEvent('season', "Season {$game['season']} ended. Clan $winner reshaped the island.", '');
        $game['season'] = (int)$game['season'] + 1;
        $game['season_started'] = time();
        $game['biome'] = $winner;
        $game['island_energy'] = 0; $game['energy_threshold'] = 500; $game['chaos'] = 0; $game['world_events'] = 0;
        self::saveGame($game);
        self::rollQuests();
        self::queueEvent('season_end', ['winner' => $winner, 'season' => $game['season'] - 1, 'biome' => $winner]);
        self::queueEvent('request_speech', ['mode' => 'prophecy']);
        return ['winner' => $winner, 'season' => $game['season']];
    }

    // ═══════════════════════════════════════════════════════════════
    // PUBLIC STATE for the front-end
    // ═══════════════════════════════════════════════════════════════
    public static function publicState(): array {
        self::ensureSchema();
        $g = self::getGame();
        $clans = self::getClans();
        $pub = [];
        foreach ($clans as $k => $c) {
            $pub[$k] = ['name' => $c['name'], 'icon' => $c['icon'], 'color' => $c['color'], 'quadrant' => $c['quadrant'],
                        'influence' => round((float)$c['influence'], 1), 'members' => (int)$c['members'],
                        'xp' => (int)$c['total_xp'], 'wins' => (int)$c['seasons_won'], 'side' => $c['side'], 'motto' => $c['motto']];
        }
        $forest = (($clans['grove']['influence'] ?? 25) + ($clans['fang']['influence'] ?? 25) + ($clans['veil']['influence'] ?? 25)) / 3;
        $industry = (float)($clans['forge']['influence'] ?? 25);
        $balance = max(-1, min(1, ($forest - $industry) / 60)); // +1 lush forest … -1 iron ash
        return [
            'balance' => round($balance, 3),
            'balanceLabel' => $balance > 0.35 ? 'The forest thrives' : ($balance < -0.35 ? 'The Forge devours the land' : 'Balance holds'),
            'season' => (int)$g['season'],
            'biome' => $g['biome'],
            'energy' => round((float)$g['island_energy']),
            'energyThreshold' => (int)$g['energy_threshold'],
            'chaos' => round((float)$g['chaos'], 1),
            'fractured' => time() < (int)$g['fractured_until'],
            'fracturedRemaining' => max(0, (int)$g['fractured_until'] - time()),
            'fractures' => (int)$g['fractures'],
            'worldEvents' => (int)$g['world_events'],
            'islandTime' => round((float)$g['island_time'], 4),
            'xpMultiplier' => (time() < (int)$g['xp_multiplier_until']) ? (float)$g['xp_multiplier'] : 1,
            'xpMultiplierRemaining' => max(0, (int)$g['xp_multiplier_until'] - time()),
            'clans' => $pub,
            'quests' => json_decode($g['quests'] ?: '[]', true),
            'vote' => self::getOpenVote(),
            'leaderboard' => self::leaderboard(5),
            'director' => IslandDirector::publicState(),
            'guardianCount' => (int)Database::get()->query("SELECT COUNT(*) c FROM guardians")->fetch()['c'],
            'lore' => Database::get()->query("SELECT question, decision FROM lore_decisions ORDER BY id DESC LIMIT 3")->fetchAll(),
        ];
    }
}
