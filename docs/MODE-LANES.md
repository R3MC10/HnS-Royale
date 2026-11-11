# Breachway — a two-base lane mode (design, not built)

Status: design only, 2026-11-11. Nothing in `src/` has been changed for this mode. Numbers marked
**(sim)** come from the economy sim in the session scratchpad (`scratchpad/lanes/sim.ts`); every
other number is a starting value to tune in playtests.

## 1. Pitch

Two teams, one lane, one Core each. Every 25 seconds each base sends a wave of the game's own
monsters down the lane, and the waves grind into each other in the middle. Every mob that dies near
you pays you gold and XP. There is no loot on the floor. You spend gold at your base on PoE2-style
gambles (pick a slot, pay, see what rolls) and on rough skill and support crystals. Levels run 1 to
20 over about 17 minutes. Fights happen around the waves, the towers, and the healing pads. Dying
costs you time and hands the enemy your bounty, and you can shop while you wait to respawn. The
first team to break the enemy Core wins. A match is 15-20 minutes. The early game is about your
build, the mid game about your gear, and the late game is a siege.

## 2. Match loop and win condition

**Win:** destroy the enemy Core. Surrender is available from 8:00 (section 10). The match has a
failsafe from 25:00.

| Phase | Time | What happens | What the player does |
|---|---|---|---|
| Shop | 0:00-0:20 | Base gates are closed. Everyone has 150 gold. | First buy: one gamble plus one support crystal, or two gambles. Allocate the first passive points. |
| Early | 0:20-2:00 | Gates open at 0:20. Waves spawn at 0:30 and clash at mid around 0:48. Passive gold and XP start at 0:20. | Clear waves and learn the matchup. Levels 1-4 come fast (145 XP reaches level 5). Little PvP, because both outer spires cover the approaches. |
| Early-mid | 2:00-6:00 | The second skill (level 4), tier-4 skills (crystal level 4 at player level 6), and Spirit at 3. Healing pads matter. The outer spire is fortified until 4:00. | First real fights. Trade around pads. Go back to the shop after a death. About 8 gambles and 6 crystals by 6:00 **(sim)**. |
| Mid | 6:00-12:00 | Outer spires fall (about 6-8 min), then the inner spires (about 10-12). An elite (magic, rare from 6:00) leads every third wave. Ascendancy pick at level 10. Waves change family at 6:00 and at 12:00. | Group pushes behind an elite wave. Use bounties to come back. Support tier II unlocks at level 8. Gear rises to item level 13-15. |
| Late | 12:00-end | Wards fall (about 13-15 min). Rogue exiles spawn for the team that broke a Ward and march with its waves until the Ward respawns. Waves come every 20 s from 10:00 and every 15 s from 15:00. Structure damage is +25% from 15:00. Death timers reach 30-36 s. | Siege the Core, or hold until the Ward respawns (120 s). Tier III supports from level 14. Chase rare gear at level 20. One won fight ends the match. |
| Failsafe | 25:00+ | Structures take double damage and the Core stops regenerating. At 30:00 the team with more total structure life % wins. | (Should be rare. Target: under 5% of matches.) |

## 3. Map: fixed, hand-authored, built in code

**Decision: a fixed layout, not generated.** A lane mode needs mirror symmetry for fairness,
structure ranges that are known exactly, and one picture that every player learns. The procedural
generator (`src/shared/mapgen/generate.ts`) is built for open, irregular royale maps with camps,
POIs and spawn clearings, and none of that helps here. The lane is emitted by a small builder,
`src/shared/mapgen/lane.ts`, that returns the same `GameMap` shape (a `CELL` = 64 px grid with
`OPEN`, `WALL` and `WATER`, plus obstacles), so `shared/map.ts`, collision, pathing and the client
renderer are reused unchanged. Biome dressing (tree and rock props outside the walkable band) may
use the existing biome tables for looks only.

Scale reference: players move at 230 px/s, `VIEW_RADIUS` is 1150 and royale maps are about 7-10k px
across. A hand-authored lane of about 7k px gives a 12.5 s walk from Core to mid, which is ARAM-like.

```
 y=0 ┌───────────────────────────────────────────────────────────────────────────────────────────┐
     │ wall / props                                                                                 │
 320 ├──────┐                                                                              ┌──────┤
     │ BLUE │ W        I            O          pad(3136,400)  │  pad(4864,400)         O   I   W │ RED  │
 768 │ ⌂ N C│ 1280     1920         2688   ○3300  ·mid 3584·  ○3868   4480          5248 5888 │C N ⌂ │
     │ base │                    pad(2304,1136)                       pad(4032,1136)           │ base │
1216 ├──────┘                                                                              └──────┤
     │ wall / props                                                                                 │
1536 └───────────────────────────────────────────────────────────────────────────────────────────┘
     x=0                                                                                   x=7168
```

| Element | Value |
|---|---|
| Map | 7168 x 1536 px (112 x 24 cells) |
| Walkable lane band | y 320-1216 (896 px, 14 cells), x 1152-6016 |
| Bases | x 0-1152 (blue) and 6016-7168 (red), full height y 128-1408 |
| Shop platform (safe zone) | circle r = 420 around (448, 768); red side mirrored at (6720, 768) |
| NPC / respawn point | NPC at (320, 700), respawn at (360, 840) |
| Core (C) | (704, 768), body radius 72 |
| Ward (W) / Inner spire (I) / Outer spire (O) | x = 1280 / 1920 / 2688, y = 768 (red: 5888 / 5248 / 4480) |
| Spire spacing | outer to inner 768 px, inner to Ward 640 px. A spire's range is 520, so its zone does not overlap the next one's. |
| No-tower zone at mid | between the outer spires' ranges: x 3208-3960 (752 px) |
| Healing pads | blue (3136, 400) and (2304, 1136); red mirrored through the centre (4032, 1136) and (4864, 400) |
| Cover pillars | wall circles r = 48 at (3300, 640) and (3868, 896): line-of-sight blockers for projectiles at mid |
| Base gates | wall cells at x = 1152 and x = 6016, open at 0:20 |
| Mob path | straight waypoint line along y = 768. Mobs spawn at x = 824 (blue) and x = 6344 (red). |

There is one map size for every team size. 10v10 gets crowded, and that is accepted: ARAM is
crowded too, and a wider lane weakens the towers' zones. Open question 11.4.

## 4. Team sizes and bots

- Supported: 1v1 to 10v10 (2-20 players, matching `MAX_PLAYERS`). Default queue size: 5v5.
- Humans are split into teams by alternating the lobby order, keeping parties together when the
  lobby supports that. If the number of humans is odd, a bot joins the smaller team.
- Bots fill both teams up to the lobby's chosen team size (default 5). Minimum 3v3 with bots. A
  private 1v1 or 2v2 with no bots is allowed.
- What scales with team size n (per side):

| | Formula | n=1 | n=3 | n=5 | n=10 |
|---|---|---|---|---|---|
| Rushers per wave | 2 + ceil(n/2) | 3 | 4 | 5 | 7 |
| Ranged per wave | 1 + floor(n/3) | 1 | 2 | 2 | 4 |
| Siege (every 3rd wave) | 1, or 2 when n >= 7 | 1 | 1 | 1 | 2 |
| Mobs per wave (cap 12) | | 4-5 | 6-7 | 7-8 | 11-12 |
| Structure life multiplier | n / 5 (minimum 0.6) | 0.6 | 0.6 | 1.0 | 2.0 |
| Gold and XP per player | **does not scale** (section 7) | | | | |

Up to 24 lane mobs alive per side at once, plus 20 players and 8 structures, is well under the
royale's monster counts (62 alive at the end of a 15-bot match, `docs/SELF-SURVEY.md` gameplay
round 4).

## 5. Structures

Four per side, destroyed in order: Outer spire, then Inner spire, then Ward, then Core. A structure
can only be damaged once the one in front of it is down. Structures do not move, take no knockback
and have no defences.

| | Life (n=5) | Attacks | Rules |
|---|---|---|---|
| Outer spire | 9,000 | yes | Fortified until 4:00: 50% less damage taken. Destroyer team: 80 gold each. |
| Inner spire | 12,000 | yes | Destroyer team: 120 gold each. |
| Ward | 8,000 | no | Respawns at full life 120 s after it falls. When it falls, rogue exiles spawn for the destroying team (section 6.1). Destroyer team: 160 gold each. |
| Core | 15,000 | yes, at 1.5x the damage and rate, with 650 range | Regenerates 1% of max life per s when no enemy has hit it for 8 s. Destroyed means the match is won. |

Spire attack (the Core uses the same one, stronger):
- Range 520 px, one homing bolt every 1.2 s at 700 px/s. A dodge roll's i-frames avoid it
  (`DODGE_IFRAMES`), which leaves room for skill.
- Against mobs: 35% of the mob's max life per bolt, so a mob dies in 3 bolts at any level.
- Against players: `15 + 3 x lane level` damage. Each bolt in a row on the same player adds +40%,
  up to x2.2. Bolts ignore armour, evasion, block and resistances (they are structure hits, not
  monster hits), and `PVP_DAMAGE_MULT` does not apply. At level 10 that is about 45, 63, 81, 99:
  roughly 5 s under a spire kills an unsupported diver.
- Target priority: an enemy player who damaged an allied player inside the range in the last 2 s
  (call for help). Otherwise the nearest enemy mob. Otherwise the nearest enemy player.
- Backdoor rule: a structure takes 70% less damage while no attacking-team mob is within 600 px of it.
- Late siege: structures take +25% damage from 15:00 and double damage from 25:00.

Why these life totals: bots deal about 13 damage per second with basic attacks and 21-39 with
skills against monsters (`docs/BALANCE.md`, "Skill numbers"). As a working estimate, one player's
siege damage is 15 + 3 x level per second. At level 10 (about 7:00), five players do about 225/s,
so the outer spire falls after about 40 s of uncontested hitting. That is two pushes, not one.
These numbers are not measured. They are the first thing to check with bots (build list P2).

Mobs damage structures with their normal hit damage x2, so a wave that nobody answers chips about
3-5% off an outer spire before the bolts kill it.

## 6. Waves

- Spawn at 0:30, then every 25 s. Every 20 s from 10:00, every 15 s from 15:00.
- Mobs march along the lane at 150 px/s (their own speed is overridden while marching), so waves
  meet at mid about 18 s after spawning.
- Lane level = floor(mean level of all players in the match), minimum 1. Mob life and damage use
  `monsterLevelScale` (`src/shared/content/monsters/mods.ts`) at that level, plus the usual rarity
  multipliers.
- Behaviour: march; aggro on the nearest hostile thing within 380 px (enemy mob, then enemy
  structure, then enemy player); go back to the waypoint line once nothing is in range. A mob that
  is hit by an enemy player switches to that player for 3 s. Mobs never leash home and never chase
  beyond 500 px off the lane line.

Composition, using the existing roster (`src/shared/content/monsters/roster.ts`):

| Window | Rusher | Ranged | Elite (every 3rd wave from wave 3) |
|---|---|---|---|
| 0:30-6:00 | Barkgnaw / Feral Wolf, alternating waves | Sapspitter | one rusher rolled **magic** |
| 6:00-12:00 | Reedlurker | Mire Chanter | one rusher or ranged rolled **rare** |
| 12:00+ | Spire Harrier | Shardslinger | one rusher **and** one ranged rolled **rare** |
| Enemy Ward down | | | rogue exiles join (section 6.1) |

**Elites instead of big siege minions.** There are no dedicated siege monsters. The wave's pusher is an
ordinary wave monster promoted with the existing monster rarity system (`extSpawned(sys, m, rarity)` and its elite mods in
`src/server/ai/hooks.ts`, `src/shared/content/monsters/mods.ts`), so players read it the same way as in
the royale: blue name = magic, yellow name = rare, with its modifiers shown. Lane rules for elites:
- Mods that do not fit a lane are excluded: anything that summons, teleports or makes the elite
  invulnerable while away from the lane (`nearOnly`, Veiled Sphere). The rest of the pool is used as is.
- Siege role: an elite deals x3 its hit damage to structures (normal mobs x2), and spire bolts deal
  15% of its max life instead of 35%, so an elite tanks about 7 bolts and is what lets a wave reach a
  spire. Answering the elite is the defending team's job.
- Reward: its purse share counts as 3 mobs (magic) or 5 mobs (rare). No item drops (the mode has none).

### 6.1 Rogue exiles (the inhibitor reward)

When a team destroys an enemy Ward, rogue exiles spawn on that team's side and push the enemy lane.
They use the existing exile system (`src/server/ai/exiles.ts`: rolled gear, flask, dodge roll, real
skills) because an exile plays like a player and is the hardest thing in the game to ignore.
- **Spawn:** 1 exile right away at the destroying team's front structure, then 1 more with each of
  that team's waves while the enemy Ward is down. At most 1 + floor(team size / 2) alive per team
  (3 at 5v5). When the Ward respawns, no more spawn; living exiles keep fighting until killed.
- **Level:** lane level + 2, through the same `monsterLevelScale` path exiles now use in the royale
  (`EXILE_LEVEL` reference level).
- **Behaviour:** marches with its team's wave like a mob, but fights like an exile: targets the
  nearest enemy player first, then mobs, then structures, and uses its flask only while being hit.
  It does not leash home and never enters the enemy shop platform.
- **Structure damage:** x3 its hit damage (as an elite). Spire bolts deal 10% of its max life, and it
  can dodge-roll them.
- **Reward for killing one:** 100 gold and 30 + 4 x lane level XP to every enemy player within 1200 px,
  and a short announcement. This makes the defending team's comeback (killing the exiles while the
  Ward is down) pay well.
- **Ending the match:** exiles are what turns a broken Ward into a Core siege, so they replace the
  old "super-brute" closer.

Changes for lane use (data only): `summon` attacks are removed. That is why Hollow Tender is not
used, and Leechkin and Cindermite swarms stay out. `aggroRadius` is replaced by the 380 px rule.
Leaps, charges and novas stay as they are: they are the telegraphs players learn to dodge.

## 7. XP, levels, gold

Level cap 20 (the royale's `MAX_LEVEL` is 40; the mode clamps it). The XP curve is the existing
`xpToNext(level) = 18 + 4.5 x level^1.45`. Cumulative XP needed: level 5 145, 8 381, 10 618,
14 1314, 18 2346, 20 3001.

**Wave purse.** Each wave carries, for every enemy player, a purse of gold and XP split evenly
across its mobs. When a mob dies, from any cause (players, spire bolts or mobs), **every** enemy
player alive within 1200 px gets that mob's share in full. There is no last-hitting and no
splitting between teammates. Being in lane alive is what earns. Mob XP from `monsterXp` is not
used in this mode.

| Source | Gold | XP |
|---|---|---|
| Start | 150 | 0 |
| Passive, from 0:20 | 2 / s (120 / min), also while dead | 0.5 / s, alive only |
| Wave purse, per player per full wave | `min(80, 36 + 3 x minute)` | `min(90, 18 + 4.5 x minute)` |
| Player kill | 120 + bounty (section 9) | 20 + 4 x victim level |
| Assist (damage in the last 10 s) | 60 split among assisters | half of the kill XP, split |
| Outer / inner spire / Ward | 80 / 120 / 160 to every member of the destroying team | 0 |
| First takedown of the match | +50% | |

Catch-up XP: a player below the match's mean level gains +15% XP from every source per level
behind, up to +60%. Gold has no catch-up of its own. Bounties do that job (section 9).

## 8. The base NPC: gambling and crystals

One NPC per base, the Quartermaster. It can only be used on the shop platform or while dead. All
prices update the moment you level. Nothing is in limited stock.

### 8.1 Gamble (PoE2's gambling vendor, cut down)

You pick a slot, pay the gold, and get an item of a random base for that slot. The base is limited
to bases whose `reqIlvl` is no higher than the item level. Rarity is random. Item level = your
level, up to `MAX_ITEM_LEVEL` 20. The item is shown at once (there is no identify step), and that
reveal is the slot-machine moment. Built on `rollItem(ilvl, rarity, baseId)` from
`src/server/loot.ts`.

Price = slot base x (1 + 0.12 x (item level - 1)):

| Slot | Base | Item level 1 | Item level 10 | Item level 20 |
|---|---|---|---|---|
| Weapon (main hand; you pick the weapon kind) | 70 | 70 | 146 | 230 |
| Off hand (shield / quiver / focus) | 50 | 50 | 104 | 164 |
| Body armour | 60 | 60 | 125 | 197 |
| Helmet, gloves, boots | 45 | 45 | 94 | 148 |
| Belt | 40 | 40 | 83 | 131 |
| Ring | 55 | 55 | 114 | 180 |
| Amulet | 65 | 65 | 135 | 213 |
| Life / mana flask | 30 | 30 | 62 | 98 |

Rarity odds: normal 35%, magic 50%, rare 14%, unique 1%. A unique comes from the existing
`rollUnique` pool for that slot at that item level. If none fits, the result becomes a rare.
Pity: after 5 non-rare results in a row, the next gamble is rare or better. The counter is per
player. Weapon gambles let you pick the weapon kind (a sword player does not want a bow). Every
other slot only picks the slot. The defence type is random, as in PoE2.

Selling: any item sells for 25% of the current gamble price for its slot at its own item level.
This frees inventory space; it is not a profit loop.

### 8.2 Rough crystals (uncut gems)

These are the existing rough crystals (`ROUGH_SKILL`, `ROUGH_SUPPORT`, `ROUGH_SPIRIT`,
`src/shared/content/gems.ts`). Cutting, and raising an owned gem to a crystal's level, work exactly
as in the royale. Only the source changes: the shop instead of drops.

| Crystal | Level / tier you can buy | Price |
|---|---|---|
| Skill crystal, level k | k <= min(10, 1 + floor(player level / 2)): level 1 at player level 1, level 4 at 6 (all tier-4 skills), level 10 at 18 | round(40 + 15 x k^1.4): k1 55, k3 115, k4 157, k5 183, k8 312, k10 416 |
| Support crystal, tier I / II / III | tier I from level 1, II from level 8, III from level 14 | 80 / 200 / 400 |
| Spirit crystal (persistent / meta gems) | from level 3, when the first Spirit milestone arrives, at the skill-crystal level cap | 150 |

Start kit: the royale's class starter weapon (its weapon skill comes with it) and starter flask,
plus 150 gold. There is no free crystal, so the first buy is a real choice.

## 9. Death, respawn, healing, comeback and anti-snowball

- **Death timer:** `min(36, 6 + 1.5 x level)` s, so 7.5 s at level 1, 21 s at level 10 and 36 s at
  level 20. +4 s from 15:00. The shop is open while dead. The camera follows a living teammate.
- **Respawn:** on the platform with full life, mana and flask charges. Nothing is lost on death: no
  items, no gold, no XP.
- **Healing in base:** on the platform you regenerate 10% of max life and mana per second, and
  flasks refill over 5 s. There is no recall, so walking back costs about 12 s each way. That is
  the price of going home.
- **Healing pads (4):** walking over a pad heals 20% of max life and 25% of flask charges. It
  respawns 40 s after use, and first appears at 1:30. Either team can take any pad, so denying the
  enemy's pad is a play.
- **Spawn protection:** enemy players on a shop platform take 15% of max life per second as true
  damage and cannot be healed there.
- **Bounty:** a kill pays 120. Each kill streak above 1 adds +40 to the victim's bounty, up to +200,
  and the whole bounty pays out when that player dies (a shutdown). A player on a death streak is
  worth 20% less per death after the first, down to 40%. This is the main way gold flows from the
  leading team to the trailing one.
- **XP catch-up:** +15% per level below the match mean, up to +60%. **(sim)** At 15:00 it narrows
  the gap between the most-fed and least-fed player from 4.7 to 3.6 levels, and at 18:00 from 3.0
  to 1.6.
- **Comeback windows:** the outer spire is fortified until 4:00, the Ward respawns after 120 s, the
  backdoor rule applies, the Core regenerates out of combat, and level-scaled death timers cost the
  leader more late.
- **Making sure it ends:** after the Ward falls, rogue exiles join every wave (section 6.1). Waves come faster
  from 10:00 and 15:00, structures take +25% damage from 15:00, and the 25:00 failsafe applies.
- **PvP damage:** a mode override `PVP_DAMAGE_MULT = 0.6`, up from the royale's 0.4. The flask rule
  (`PVP_FLASK_MULT` 0.5) stays. Reason: the royale's even 1v1 has a median of 16-18 s
  (`docs/BALANCE.md`), which is right for one duel but far too long for a fight next to a wave
  with respawns. See open question 11.2.

## 10. Other rules

- Teams: no friendly fire. Allies' projectiles pass through each other.
- Passive tree: as in the royale, one point per level (19 points by level 20). Ascendancy: at
  level 10 the pick is offered in the panel for free. The trial shrine is a royale map feature and
  is cut here. `ASC_POINT_STEPS` gives +2 at level 16.
- Surrender: from 8:00. Needs 70% of the team's humans (bots abstain). A failed vote can be
  retried after 60 s. An all-bot team never surrenders.
- Leavers: a bot takes over the leaver's hero, gear and gold at once. Rejoining takes the hero back.
- Royale systems switched off in this mode: full loot, item and crystal drops from monsters,
  camps, exiles, bosses, shrines, the reveal and sudden death rules, and map generation.

### Augment layer ("Boons") — not in the MVP

ARAM: Mayhem offers a pick of 1 of 3 augments at levels 3, 7, 11 and 15. Here, the passive tree
(a choice every level), the ascendancy (level 10) and the gamble already give every match a new
build. A third choice layer adds UI and balance work before the base loop is proven.
**Recommendation: do not build it until the MVP has been played.** If builds turn out samey, add
the smallest version: pick 1 of 3 at levels 6 and 13, one reroll per match, from a pool of 12
entries. Each entry is a bundle of existing `ModKey`s or passive keys (for example "+1 projectile,
20% less projectile damage", or "+25% life flask recovery, flasks also heal allies within 300 px
for 30%"). No new mechanics, and nothing that touches gold or XP.

## 11. Build list (priority order, MVP first)

P0 — minimum playable version (5v5 with bots, one map):

| # | Item | Reuse | New |
|---|---|---|---|
| 1 | Mode flag and match flow: two teams, respawn, Core win, no full loot | `server/game.ts` round flow, `host.ts` lobby | a `server/modes/lanes.ts` mode controller; `team` on players; team-aware hit checks in `server/damage.ts` |
| 2 | Lane map | `GameMap` / `CELL` grid, `shared/map.ts`, collision, renderer, biome props | `shared/mapgen/lane.ts` builder; `setMap` branch |
| 3 | Lane mobs | roster, `monsterLevelScale`, attacks and telegraphs in `server/ai/brain.ts`, rarity | `team` on monsters; targets that can be monsters or structures, not just `players.get(m.target)`; waypoint march; wave spawner |
| 4 | Structures | modelled as speed-0 monsters with one homing projectile attack, using the existing projectile code | order lock, backdoor rule, call for help, bolt damage formula |
| 5 | Gold + XP purse | `gainXp`, the `prog` message | `gold` on player state, purse payout, HUD counter |
| 6 | Quartermaster shop | `rollItem`, `rollFlask`, rough-crystal items, inventory | shop panel: gamble per slot, crystals, sell; platform / dead check |
| 7 | Lane bot | `server/bots/bot.ts` movement, skills, dodge | lane brain: follow the friendly wave, fight within 600 px, retreat under 30% life with no flask charges, scripted shopping |

P1 — the loop's levers: bounties, XP catch-up, healing pads, fortify and Ward respawn, elite waves, rogue exiles on Ward kill,
growing death timers, wave timing steps, surrender, scoreboard (kills, gold, structures), spectate
while dead.

P2 — tuning: a headless bot harness like `scratchpad/balance` that runs 64 lane matches and logs
match length, structure fall times, level and gold per minute, TTK in fights, and comeback rate
(the share of matches won by the team that lost the first outer spire). Minimap lane view.

P3 — optional: Boons (section 10), a second lane map, party queue.

**Cut** (with the reason): stealth brush (no stealth system), recall (walking back is the cost),
snowball / poro-style gap closer (dodge roll and movement skills already do it), one-way frost
gates, turret plates (fortify does the same job), item drops from mobs (pickup fights between
teammates, ground clutter in a crowded lane, attention pulled off the wave; gold is fair and easy to
read), crafting currency in the shop, the unidentified / identify step, augment sets and rerolls,
champion-select rerolls, ranked MMR, trial shrines, exiles, bosses.

## 12. Economy sim

`scratchpad/lanes/sim.ts` (headless Node/TS, `node --experimental-strip-types sim.ts`). One 5v5
match is modelled as three archetypes on one team: **ahead** (in lane 92% of waves, 0.15 deaths
per minute, 30% of takedowns), **average** (80%, 0.3, 20%) and **behind** (62%, 0.5, 10%). The sim
uses the numbers in sections 6-9, the real `xpToNext` curve, death timers plus 13 s to walk back,
spire gold at assumed fall times of 6:30, 10:30 and 14:00, and a scripted shopper. The shopper
raises its main skill crystal once the cap is 2 or more levels ahead. It buys two supports of each
newly unlocked tier and a second skill at level 4. It gambles the slot whose item is 4 or more item
levels behind, and from level 16 it gambles for rares in its weakest slot. Means are over 400 runs,
with catch-up on. Kill bounty transfer is not modelled.

| Min | Player | Level | Gold/min | XP/min | Gold earned | Gambles | of which rare+ | Crystals bought | Main gem level | Support tier | Unspent |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 2 | average | 3.8 | 223 | 53 | 446 | 1.4 | 0.2 | 3.7 | 2.7 | I | 29 |
| 5 | ahead | 9.2 | 304 | 115 | 1520 | 8.0 | 1.7 | 6.3 | 5.0 | I-II | 57 |
| 5 | average | 8.3 | 260 | 94 | 1298 | 7.8 | 1.6 | 5.4 | 4.6 | I | 52 |
| 5 | behind | 7.3 | 217 | 74 | 1085 | 7.6 | 1.6 | 4.5 | 3.8 | I | 52 |
| 6 | average | 9.3 | 261 | 99 | 1565 | 8.6 | 1.8 | 6.2 | 5.0 | I-II | 60 |
| 10 | ahead | 14.6 | 341 | 157 | 3414 | 16.5 | 3.9 | 9.0 | 7.3 | II | 64 |
| 10 | average | 13.2 | 285 | 125 | 2847 | 15.1 | 3.3 | 8.1 | 6.8 | II | 63 |
| 10 | behind | 11.8 | 229 | 99 | 2293 | 12.6 | 2.8 | 7.4 | 6.1 | II | 58 |
| 12 | average | 14.9 | 299 | 136 | 3584 | 17.8 | 4.0 | 9.1 | 7.4 | II | 70 |
| 15 | ahead | 19.3 | 384 | 199 | 5757 | 26.2 | 6.1 | 11.0 | 9.1 | III | 81 |
| 15 | average | 17.6 | 318 | 157 | 4776 | 21.8 | 5.0 | 10.5 | 8.8 | II-III | 79 |
| 15 | behind | 15.7 | 254 | 124 | 3814 | 19.5 | 4.4 | 9.1 | 7.9 | II | 73 |
| 18 | average | 19.8 | 331 | 184 | 5966 | 27.9 | 6.5 | 10.9 | 9.1 | III | 83 |

Purchases by phase for the average player (cumulative): end of shop phase, 1 gamble + 1 support.
By 2:00, about 1-2 gambles and 4 crystals. By 6:00, 9 gambles and 6 crystals. By 12:00, 18 gambles
(4 of them rare or better) and 9 crystals. By 18:00, 28 gambles and 11 crystals.

Readings:
- Level targets are met: about 8 at 5:00, 13 at 10:00, 17-18 at 15:00, and 20 at about 18:00.
- Gold earned per minute rises from about 220 to 330, so there is a clear power curve. Unspent
  gold stays under 100, so the shop always has something worth buying (the late rare chase is the
  sink).
- Spread: ahead earns 1.55x what behind earns (gold) and 1.6x (XP). Catch-up turns a 4.7-level gap
  into 3.6 at 15:00. Bounties should close more of it but are not modelled. Check them in the P2
  bot harness.
- Passive gold is about 40% of income early and about 35% late, so even a player who dies a lot
  keeps buying. Waves are the bigger share, which rewards being in lane.

## 13. Risks and open questions (with recommended answers)

1. **Monsters fighting monsters is new engine work** (the biggest risk). `brain.ts` resolves every
   target as `players.get(m.target)`. *Recommendation:* add one target abstraction, `{kind:
   player|monster|structure, id}`, used only by lane mobs and structures. Royale monsters keep
   their current code path. Build it first and measure it with 24 mobs on screen.
2. **PvP time to kill.** At 0.4, team fights next to waves will drag, and flasks plus pads could
   make dives free. *Recommendation:* use 0.6 for this mode and target a median of 6-10 s for an
   even 1v1 in lane. Measure it in P2 before changing anything else.
3. **Gear variance snowballs harder than levels.** A rare weapon at item level 8 can decide the
   lane. *Recommendation:* item level is tied to your own level, the pity rare comes after 5 tries,
   and weapon kind is pickable. Bounties make the fed player pay. If the P2 data shows the first
   rare weapon predicting wins at more than 60%, drop the rare odds to 10% and add a second pity
   step.
4. **One map size for 1v1 to 10v10.** *Recommendation:* keep it. If 10v10 fights become unreadable,
   widen the band to 18 cells only when n >= 8 (one builder parameter).
5. **Bot quality decides how bot-filled matches feel.** *Recommendation:* the lane brain stays
   simple (follow the wave, fight near it, retreat when low, scripted shopping). Bots must never
   walk past their own wave.
6. **Structure life is a guess** (based on 13-39 damage per second measured against monsters).
   *Recommendation:* tune in P2 to hit these fall times: outer 6-8 min, inner 10-12, Core 15-19.
7. **No mob drops may feel un-ARPG.** *Recommendation:* keep the gamble reveal loud and fast (big
   rarity flash). Revisit only if playtesters miss the loot.
8. **Spawn camping and Core regeneration** could make sieges futile. *Recommendation:* Core
   regeneration needs 8 s with no hits, and the platform damage only covers the platform, not the
   Core.

## 14. Research notes and sources

Systems copied, with no names, art or text: one lane with a mirrored base on each side; four
structures per side in order (ARAM has outer, inhibitor turret, inhibitor and two nexus turrets,
then the nexus; here the nexus turrets are merged into the Core); an inhibitor-like structure that
respawns; stronger minions while it is down; shopping only at the base or while dead; no recall;
healing pads in the lane; passive gold and XP; death timers that grow with level; kill bounties;
surrender. From ARAM: Mayhem: a pick of 1 of 3 at fixed levels, kept here only as an optional
later layer. From PoE2: gambling as gold paid for a random-rarity item of a chosen kind, and uncut
gems gated by level, using this game's existing rough crystals and support tiers.

Confirmed from sources:
- ARAM: 1400 starting gold, start at level 3, 60 gold per 10 s from 1:00, first minions at 0:50,
  waves every 25 s falling to 13 s late, siege minions every second wave from the third. Death
  timers 11-40 s by level. Kill bounty 180 base. Surrender from 8:00 with a 70% vote. Shopping only
  after death. Recall disabled, and the fountain does not heal. A 5 XP/s aura and 50% reduced
  healing. Average game about 20 minutes. Structures per side: outer, inhibitor turret, inhibitor,
  two nexus turrets, nexus. Gates closed for the first 15 s. Four health relics.
- ARAM: Mayhem: released 2025-10-22 and extended past its first end date. Picks at level 3 (start),
  7, 11 and 15. 1 of 3, with one reroll per offer. Silver, Gold and Prismatic tiers. Level cap 18.
  Nexus turrets 3000 life and nexus 3000 (changed from 1800 and 5500). Relics heal 22% of missing
  life. One super minion while the inhibitor is down. Patches through 26.16 (Aug 2026) are still
  tuning it. The 2026 patch history disagrees with itself about whether augment synergy sets were
  removed.
- PoE2: vendors sell unidentified items of random rarity (magic, rare or unique) for gold. Uncut
  skill gems come in odd-level tiers up to 13, with their level set by the area level, and some
  skills need a higher-tier uncut gem.

Not confirmed (so every number here is original, not copied): ARAM turret, inhibitor and nexus
stats; inhibitor respawn time; relic respawn; map dimensions; per-wave counts; Mayhem match-length
data. PoE2 gamble prices and rarity odds (no source publishes odds), and PoE2's current stock
refresh rules. The poe2wiki gamble page blocked automated access. Uncut support gem rules after
patch 0.3.

Sources:
- https://wiki.leagueoflegends.com/en-us/ARAM
- https://wiki.leagueoflegends.com/en-us/ARAM:_Mayhem
- https://wiki.leagueoflegends.com/en-us/ARAM:_Mayhem/Patch_history?oldid=4089729
- https://wiki.leagueoflegends.com/en-us/Howling_Abyss
- https://arammayhem.com/patch/26-3/ , https://arammayhem.com/patch/26-13/ , https://arammayhem.com/patch/26-16/
- https://www.poe2wiki.net/wiki/Gamble (blocked to automated fetch; the description of gambling comes from its search snippet)
- https://www.poe2wiki.net/wiki/Uncut_Skill_Gem , https://vulkk.com/2025/03/10/path-of-exile-2-gemcutting-explained/
- https://mobalytics.gg/poe-2/guides/gambling (HTTP 403, not read)
