# 🌌 SOCIOBEAST GENESIS v12 — « THE LIVING ISLAND »
### Game Design Document · TikTok Live Edition

> **Pitch en une phrase** : Une île flottante dans le vide cosmique dont chaque créature *est* un spectateur.
> Le public ne regarde pas un Tamagotchi — **le public est l'écosystème**. Ce qu'il fait ensemble
> pendant le live sculpte l'île, écrit sa mythologie, et le stream suivant hérite de tout.

---

## 1. Le renversement conceptuel

| Avant (v11) | Maintenant (v12) |
|---|---|
| 1 créature IA + clones décoratifs | **Chaque spectateur possède un esprit** (Kodama gardien) lié à son pseudo TikTok |
| Le public envoie des commandes | Le public **est réparti en 4 clans** qui se disputent l'île |
| Émotions internes invisibles | **Météo cosmique** = émotion collective rendue visible (aurore, éclipse, pluie de météores) |
| Stream = session isolée | **Saisons persistantes** : chaque live est un chapitre, la mythologie est un livre qui s'écrit |
| Pas d'objectif | **Barre d'énergie de l'île** (objectif commun) + **quêtes** + **votes qui bifurquent le lore** |

---

## 2. Boucle de jeu (core loop)

```
  Spectateur arrive ─► son Kodama naît (nom flottant, teinte de clan)
        │
        ▼
  Il interagit (like / commentaire / cadeau / partage)
        │
        ├─► son Kodama gagne de l'XP ─► Wisp → Spirit → Elder → Legend (taille, aura, couronne)
        ├─► son CLAN gagne de l'influence ─► le territoire du clan grandit sur l'île
        ├─► la barre d'ÉNERGIE DE L'ÎLE monte ─► ÉVÉNEMENT MONDIAL quand pleine
        └─► le Beast (esprit primordial) réagit, commente, se souvient
        │
        ▼
  Toutes les ~8 min : VOTE DU CONSEIL ("!1 / !2") ─► décision gravée dans la mythologie
        │
        ▼
  Fin du live : SAISON clôturée ─► clan vainqueur remodèle le biome ─► PROPHÉTIE pour le prochain live
```

---

## 3. Les 4 Clans

Un spectateur rejoint un clan à sa première interaction (auto-assigné au clan le plus faible pour l'équilibre, ou `!clan ember`).

| Clan | Élément | Teinte Kodama | Territoire | Pouvoir de clan (déclenché à 100 % d'influence) |
|---|---|---|---|---|
| 🌿 **Verdant** | Nature | Vert mousse | Nord | **Floraison** : l'île se couvre de fleurs, +XP pour tous |
| 🌊 **Tide** | Eau | Bleu lagon | Est | **Marée cosmique** : pluie de lucioles, tous les esprits cachés reviennent |
| 🔥 **Ember** | Feu | Orange braise | Sud | **Comète** : pluie de météores, double XP 60 s |
| 🌙 **Umbra** | Ombre | Violet nuit | Ouest | **Éclipse** : nuit totale, le Beast révèle un secret / une prophétie |

L'influence de clan est un **score relatif** : elle décroît lentement (−1 %/min) pour forcer l'engagement continu.

---

## 4. Économie des cadeaux TikTok → Sorts

Les cadeaux TikTok ont une valeur en pièces (`diamondCount`). Ils sont convertis en **sorts** par palier :

| Palier | Pièces | Sort déclenché | Effet visuel |
|---|---|---|---|
| ✨ Étincelle | 1–9 | **Bénédiction** | Le Kodama du donateur brille + saute |
| 🌸 Éveil | 10–99 | **Floraison locale** | Fleurs autour du donateur + 3 esprits naissent |
| 🌧️ Tempête | 100–499 | **Météo** | Pluie de lucioles / brume, +20 % énergie île |
| ☄️ Cosmique | 500–4 999 | **Pluie de météores** | Météores, tous les esprits dansent, Kodama du donateur → Elder |
| 🌌 Genèse | 5 000+ | **Nouvelle terre** | **Un fragment d'île permanent** apparaît, nommé d'après le donateur, inscrit dans la mythologie |

> Le donateur de palier Cosmique+ devient **Légende** : son nom est cité dans les mythes générés par l'IA.

---

## 5. Objectif commun : la Barre d'Énergie de l'Île

- Se remplit avec **likes** (+1), **commentaires** (+3), **partages** (+15), **follows** (+25), cadeaux (+valeur).
- À 100 % → **Événement Mondial** aléatoire pondéré par l'émotion collective :

| Émotion dominante | Événement |
|---|---|
| Joie | 🌈 **Aurore boréale** — le ciel s'embrase, tous les esprits chantent |
| Curiosité | 🌳 **L'Arbre-Monde s'éveille** — un arbre géant pousse au centre, révèle un mythe |
| Excitation | ☄️ **Pluie d'étoiles** — spawn massif ×20 |
| Solitude | 🌑 **Grande Éclipse** — tout disparaît, puis renaît (reset visuel dramatique) |
| Inspiration | 🔮 **Prophétie** — le Beast prédit le prochain live |

- Après l'événement, la barre repart à 0 avec un **seuil +25 %** (difficulté croissante dans le live).

---

## 6. Le Compteur de Chaos (tension)

Trop d'interactions trop vite (> 60 events / 10 s) → **Chaos** monte.
- 50 % : les esprits tremblent, la caméra vibre
- 80 % : **Panique** — 50 % des esprits se cachent (système vanish), le ciel vire rouge
- 100 % : **Fracture** — l'île se fissure, 30 s de silence, le Beast demande `!calm`

Le chat doit spammer **`!calm`** (chaque commande −5 %). Résolution → bonus XP collectif ×2.
→ Mécanique qui crée des **moments mémorables** et des clips viraux.

---

## 7. Votes du Conseil (narration branchée)

Toutes les 8 minutes (configurable), le Beast pose une question à 2-3 choix. Vote par `!1`, `!2`, `!3`.

Exemples :
- *« Une étoile filante s'écrase sur l'île. La toucher ou l'enterrer ? »*
- *« Le clan Umbra propose une alliance à Verdant. Accepter ? »*
- *« Un esprit ancien demande à dormir mille ans. Le laisser ? »*

Le résultat est **écrit dans la table `lore_decisions`** et injecté dans les prompts IA → les mythes, rêves et prophéties suivants en tiennent compte. **Le lore devient un livre dont le public a écrit chaque page.**

---

## 8. Progression du Gardien (spectateur)

| Rang | XP | Apparence du Kodama | Privilège |
|---|---|---|---|
| 🌫️ Wisp | 0 | Petit, translucide | — |
| 👻 Spirit | 50 | Taille normale, teinte de clan | Nom affiché |
| 🧙 Elder | 300 | Grand, aura lumineuse | Peut lancer `!summon` (fait naître un esprit) |
| 👑 Legend | 1 500 | Couronne de particules, ne disparaît jamais | Cité dans la mythologie, `!decree` (proposer un vote) |

XP : like +1 · commentaire +3 · partage +10 · follow +20 · cadeau +valeur/2.
**Persistant entre les lives** (table `guardians`). Revenir = retrouver *son* esprit.

---

## 9. Commandes chat

| Commande | Effet |
|---|---|
| `!me` | Le Beast présente ton esprit (rang, clan, XP) |
| `!clan <verdant/tide/ember/umbra>` | Rejoindre / changer de clan (1× par live) |
| `!top` | Affiche le top 5 gardiens |
| `!feed` `!dance` `!hide` `!seek` | Actions collectives (existantes v11) |
| `!calm` | Réduit le Chaos |
| `!1` `!2` `!3` | Voter |
| `!summon` | (Elder+) Fait naître un esprit |
| `!quest` | Affiche la quête active |
| `!lore` | Le Beast raconte la dernière décision du conseil |

---

## 10. Quêtes de live

3 quêtes tirées au hasard à l'ouverture du live, affichées dans le HUD :

- 🎯 « Atteindre **1 000 esprits** sur l'île »
- 🎯 « **20 nouveaux gardiens** rejoignent l'île »
- 🎯 « Survivre à **2 Fractures** »
- 🎯 « Le clan **Tide** atteint 100 % »
- 🎯 « **50 votes** au Conseil »

Quête réussie → **récompense collective** (événement mondial gratuit) + XP ×1.5 pendant 5 min.

---

## 11. Cycle jour/nuit & Saisons

- **Journée de l'île = 45 min réels.** Aube → jour → crépuscule → nuit.
- La nuit : les esprits dorment, la lumière devient bleue, le Beast **rêve** (génère un rêve à partir des événements du live) — moment calme, contemplatif, idéal pour les segments « lore ».
- **Saison = 1 live.** À la clôture (`!endseason` admin) : le clan vainqueur **remodèle le biome** (palette d'arbres/herbe/lumière) pour le live suivant. Umbra → forêt violette bioluminescente, Ember → savane ambrée, etc.

---

## 12. Architecture technique

```
 TikTok LIVE ──► bridge/tiktok-bridge.js (Node · tiktok-live-connector)
                          │  normalise: like/comment/gift/follow/share/join
                          ▼  POST + secret
                  api/tiktok.php ──► includes/game_engine.php ──► SQLite
                                        │  (clans, gardiens, énergie,
                                        │   chaos, votes, quêtes, saisons)
                                        ▼
                  api/game.php ◄──── poll 1.5 s ──── assets/gameEngine.js
                  (state + file d'événements)          │
                                                       ├─► VisualEngine (Three.js)
                                                       │    gardiens nommés, teintes clan,
                                                       │    météo cosmique, fragments d'île
                                                       └─► HUD stream (assets/game.css)
                                                            barre énergie, clans, votes,
                                                            leaderboard, quêtes, chaos
```

- **Zéro WebSocket requis** côté hébergement PHP mutualisé : le bridge Node tourne sur n'importe quelle machine (PC du streamer, VPS Hetzner déjà en place) et pousse en HTTP.
- **Mode démo** : `?demo=1` simule un public TikTok (bots) pour tester sans live.
- **OBS** : capturer la page en source navigateur 1080×1920 (portrait TikTok). Le HUD est conçu pour le format vertical.

---

## 13. Pourquoi ça marche sur TikTok Live

1. **Chaque spectateur voit *son* nom sur *sa* créature** → attachement immédiat, revient au live suivant.
2. **Les clans** créent de la rivalité → les cadeaux deviennent tactiques, pas juste généreux.
3. **Les Fractures** créent des moments de crise → clips, partages, « vous avez raté ça ».
4. **Le lore branché** donne une raison d'écrire dans le chat au-delà des emojis.
5. **La persistance** transforme des lives isolés en **série** avec une histoire continue.

---

## 14. Roadmap

| Phase | Contenu |
|---|---|
| **v12.0 (livrée)** | Bridge TikTok, gardiens, clans, énergie, chaos, votes, quêtes, HUD, mode démo |
| v12.1 | Fragments d'île permanents (cadeaux Genèse), biomes de saison |
| v12.2 | Voix du Beast (TTS) qui commente les votes en direct ; cartes des gardiens partageables (image générée) |
| v12.3 | Multi-plateforme : YouTube Live + Twitch via le même bridge |
| v13 | Marketplace : skins de Kodama achetables, NFT-free, revenus streamer/UbMaker |
