# Balance pass 1 (2026-11-11)

Scope: monster scaling, PvP pacing, archetypes, economy pace. Skills were measured only (another
pass owns them). Every number below comes from headless matches where **all players are bots**.

## Method

- Harness: `scratchpad\balance` (session scratchpad). `bal.ts` runs a full 15-bot match through
  `HostRuntime` and logs every monster fight, player fight, death, skill use and three economy probes.
  `patches.mjs` turns the tuned numbers into environment levers at bundle time, so the project tree
  was not touched while testing. `run.sh` runs 64 matches (8 processes x 8 map seeds).
- "Before" = a frozen copy of `src` taken at the start of the pass. "After" = the live tree with the
  changes below (it also contains whatever the skills pass had landed by then).
- Farm mode: 5 bots on a 15-player map that ignore each other and clear camps for 7 minutes. Needed
  because in real matches bots fight almost no monsters past level 10.
- Noise: the server uses `Math.random`, so the same seeds do not replay. Two identical 64-match sets
  gave 354 s vs 370 s mean length and 17% vs 28% of matches reaching 7:00. Differences smaller than
  that are not findings. Conclusions below rest on 128 to 512 pooled matches where it mattered.

## Targets

| Area | Target | Before | After |
|---|---|---|---|
| Match length, 15 players | mean 5:00-7:00, no stalls | 6:02, 0 stalls | 5:59, 0 stalls |
| Matches reaching sudden death (7:00) | under 20% | 23% | 18% |
| Normal pack at the player's level | same share of life lost at every level band | 7 / 5 / 3 / 3 % | 5 / 5 / 5 / 6 % |
| Elite (rare-led) pack | 40-60% of life + ES in every band, about one flask | 64 / 40 / 17 / 11 % | 50 / 43 / 34 / 24 % (partly met) |
| Boss | beatable: more kills than deaths for a player who commits; 45-90 s | 0.45 kills per death, 99 s | 2.9 kills per death, 90 s |
| Deaths to monsters | at most 35% of all deaths | 44% | 42% (not met) |
| Level pace | no slower than before scaling existed (11.4 at 6:00) | 10.4 | 11.5 |
| Even duel | median 10-25 s, 9 in 10 under 45 s | 15 s, p90 55-60 s | 16-18 s, p90 54-57 s (tail not met) |
| Class, even-level duels | 40-60% | 28% to 73% | 30% to 78% (not met) |

Level bands are player level 1-5 / 6-10 / 11-15 / 16+. Pack numbers are from farm mode.

## Changes

### 1. Monster level curve gets a squared term
`src/shared/content/monsters/mods.ts`, `monsterLevelScale`.
Life `1 + 0.11 l` -> `1 + 0.11 l + 0.005 l^2`, damage `1 + 0.06 l` -> `1 + 0.06 l + 0.004 l^2` (l = level - 1).

| Level | Life before | Life after | Damage before | Damage after |
|---|---|---|---|---|
| 5 | 1.44 | 1.52 | 1.24 | 1.30 |
| 10 | 1.99 | 2.40 | 1.54 | 1.86 |
| 15 | 2.54 | 3.52 | 1.84 | 2.62 |
| 20 | 3.09 | 4.89 | 2.14 | 3.58 |

Why: with the straight line a pack at the player's own level got easier as the player levelled
(elite pack: 64% of life lost at level 1-5, 11% at 16+). A steeper straight line (0.18 / 0.12) fixed
the top end but raised deaths at level 1-5, because camp floors sit above a new player's level.
The squared term leaves levels 1-5 almost unchanged.

Farm mode, 64 matches each, cleared fights:

| Pack | Band | Kill time before | after | Life lost before | after |
|---|---|---|---|---|---|
| Normal | 1-5 | 4.8 s | 4.7 s | 7% | 5% |
| Normal | 6-10 | 5.3 s | 5.8 s | 5% | 5% |
| Normal | 11-15 | 3.9 s | 5.4 s | 3% | 5% |
| Normal | 16+ | 1.6 s | 3.7 s | 3% | 6% |
| Elite | 1-5 | 20.4 s | 21.1 s | 64% | 50% |
| Elite | 6-10 | 20.3 s | 19.0 s | 40% | 43% |
| Elite | 11-15 | 18.9 s | 17.7 s | 17% | 34% |
| Elite | 16+ | 12.7 s | 18.2 s | 11% | 24% |

Elite packs still ease off at high level. A steeper pair (0.008 / 0.007) flattened them further but
doubled boss deaths, so the milder one was kept.

### 2. No extra levels for elite and boss camps when scaling to the player
`MONSTER_LEVEL.scalePerTier = 0` (new field, `mods.ts`), used by `scaleToPlayer` in
`src/server/ai/hooks.ts`. Was +2 levels per camp tier (elite +2, boss +4). The starting floor
(`perTier: 2`) is unchanged.
Why: rarity already multiplies life and damage. In farm mode with everything else equal, the offset
alone moved boss deaths from 17 to 59 per 64 matches and boss kills from 52 to 45.

### 3. Bosses: half the life, 30% less damage
`src/shared/content/monsters/roster.ts`. Rotwood Matriarch life 260 -> 130, damage 26 -> 18.
Gulpmaw 290 -> 145 and 25 -> 18, Shattered Warden 280 -> 140 and 28 -> 20 (same ratio; **these two
were not in any test map**). Boss XP is pinned to its old value in `MONSTER_XP`
(`src/shared/content/classes.ts`), otherwise halving life would have halved it.
Why: the boss killed players and was almost never killed, with or without scaling.

| | Boss deaths per match | Boss kills per match |
|---|---|---|
| Real matches, no scaling (64) | 1.00 | 0.08 |
| Real matches, before (128) | 1.70 | 0.01 |
| Real matches, after (256) | 1.09 | 0.04 |
| Farm mode, before (64) | 1.30 | 0.58 |
| Farm mode, after (64) | 0.33 | 0.95 |

Median boss kill time in farm mode: 99 s -> 90 s (killers were level 18-21). Bots in real matches
still avoid the boss and still die walking into it, so the real-match kill count stays near zero.

### 4. Monster XP +5% per monster level
`MONSTER_XP_PER_LEVEL = 0.05` (`mods.ts`), applied in `monsterXp` (`src/server/progression.ts`).
Why: scaled monsters took longer to kill for the same XP, so levels came slower.
Mean level of living players at 6:00: no scaling 11.4, scaling as found 10.4, changes 1-3 only 10.1,
with this change 11.5. At 2:00 and 4:00: 5.5 -> 5.8 and 7.4 -> 8.0.

### 5. Life flasks heal half as much during a player fight
`PVP_FLASK_MULT = 0.5`, `PVP_FLASK_WINDOW = 6` (`src/shared/constants.ts`); timer in
`src/server/damage.ts`, applied in `lootDrinkFlask` (`src/server/uniques.ts`). Counts for 6 s after
dealing or taking a player hit. Mana flasks are not affected. Life flask tooltips gain the line
"50% less while fighting other players" (`src/shared/items.ts`, Polish in `src/client/i18n/pl_items.ts`).
Why: player hits are cut to 0.4 but flasks healed in full. In duels over 25 s the loser had drunk
1.5-2 flasks and absorbed 1.2-1.6 times their own life + ES.

| Pooled real matches | Rule off (384) | Rule on (512) |
|---|---|---|
| Mean match length | 377 s | 360 s |
| Matches reaching 7:00 | 27% | 18% |
| Fights ending in a kill, 90th percentile | 76 s | 69 s |
| Kill fights longer than 40 s | 17% | 13% |
| Last two players, 90th percentile | 81 s | 68 s |
| Clean 1v1 kill, median | 15 s | 16 s |

The effect is modest and only showed with large samples; a first 128-match check showed nothing.
Change 3 on its own lengthens matches (fewer boss deaths, so more players alive late: 27-34% reached
7:00); this rule brings that back under the starting value.

### 6. Quarterstaff base damage -12%
`src/shared/content/bases.ts`: 26 / 30 / 35 / 40 / 46 -> 23 / 26 / 31 / 35 / 40.
Why: at tier 1 it had the highest basic damage per second of any weapon (36.1; sword 33.3, axe 36.2,
mace 34, dagger 29.5) together with the longest melee reach (92), the widest arc (150) and the
highest crit (10%). Mistrunner: even-level duel wins 58-63% -> 52%, kills per match 0.75-0.96 -> 0.71,
match wins about 10% before and after. **Low confidence**: the duel change is within noise.

## Result on the whole match (real matches)

| | Before (128) | After (256) |
|---|---|---|
| Mean / median length | 362 / 360 s | 359 / 367 s |
| Under 5:00 / 5:00-7:00 / over 7:00 | 16 / 61 / 23 % | 21 / 61 / 18 % |
| Over 9:00, stalls | 1%, 0 | 1%, 0 |
| Level at 2:00 / 4:00 / 6:00 | 5.5 / 7.4 / 10.4 | 5.8 / 8.0 / 11.5 |
| Deaths to monsters | 44% (6.2 per match) | 42% (5.9 per match) |
| of which boss / exiles / other | 1.70 / 1.59 / 2.90 | 1.09 / 1.50 / 3.32 |

Deaths to ordinary monsters went up 15% with the steeper curve and ate most of the boss saving.

## Measured and left alone

- **`PVP_DAMAGE_MULT` 0.4.** 0.5 gave a 5:28 mean with 34% of matches under 5:00; 0.6 gave 4:55.
  Median duel length is already inside the target at 0.4. The long tail comes from chasing: in long
  fights the winner lands 0.7 hits per second against 1.5 in short ones.
- **Sudden death.** Keep it. Of the matches that reached 7:00, only 11 of 45 had been down to two
  players before 6:00. It mostly ends slow lobbies (2.5 players alive at 7:00), not stalled duels.
- **Bows.** Harrier wins 73-78% of even-level duels. Bow damage -15%, move speed while shooting
  0.5 -> 0.3, and range 420 -> 330 with -15% damage each left it at 64-76%. Not changed.
- **Mace +12%** for Bellwarden: 30% -> 38%, inside noise. Not changed.
- **Exiles.** 1.5 player deaths per match; at level 1-5 a bot that fights one dies 35% of the time and
  wins 2%. They scale from gear, not level, and were outside this pass.
- **Drop rates.** Items worn at 2:00 / 4:00 / 6:00: 2.9 / 3.9 / 5.0 in real matches, 4.4 / 6.3 / 7.4 for
  bots that farm full time. Life flask uses ready: 1.4 / 1.6 / 2.4. Skill gems 4.3 / 5.8 / 7.1,
  supports 2.6 / 4.0 / 5.4. Nothing clearly starved. Gems run rich for a full-time farmer (6 spare
  gems and 3.8 uncut at 6:00).
- **Crafting currency: not measured.** Bots hold 0 currency, runes and essences at every probe; they
  do not pick it up.
- **Defence types.** The table by defence at death is confounded: players with two defence types are
  the ones who lived long enough to find the gear. No conclusion drawn.

## Classes (after, 256 matches; expected win 6.7%)

| Class | Weapon | Match win | Top 3 | Kills | Even-level duel win |
|---|---|---|---|---|---|
| Harrier | bow | 11% | 30% | 1.02 | 78% |
| Lanternwright | wand | 10% | 30% | 0.62 | 64% |
| Mistrunner | quarterstaff | 10% | 22% | 0.71 | 52% |
| Reaver | axe | 8% | 21% | 0.51 | 41% |
| Bellwarden | mace | 5% | 19% | 0.42 | 35% |
| Drifter | sword | 4% | 12% | 0.38 | 41% |
| Gloamcaller | staff | 3% | 18% | 0.36 | 30% |
| Gutterblade | dagger | 2% | 8% | 0.29 | 33% |

The two ranged-basic-attack classes are on top and the two casters plus the dagger are at the
bottom. Weapon damage changes of 12-15% did not move this, so it is range and skill kit.

## Skills (report only, before, 128 matches)

Basic attacks deal about 52% of all damage and the ranged basic attack alone takes 21% of player kills.

| Skill | Share of casts | Share of damage | Damage/s vs monsters | Damage per mana | Share of player kills | Note |
|---|---|---|---|---|---|---|
| Ranged basic attack (bow, wand) | - | 14% | - | - | 21% | top killer |
| Quarterstaff basic | - | 11% | - | - | 12% | before change 6 |
| Pyre Effigy | 4% | 6% | 67.9 | 1.9 | 7% | highest damage/s, 2-4x the rest |
| Wheeling Glaive | 1% | 1% | 49.2 | 3.9 | 1% | strong, rarely used |
| Splinter Volley | 10% | 5% | 30.7 | 1.6 | 7% | fine |
| Cinderbolt | 13% | 6% | 23.7 | 1.8 | 5% | fine |
| Galeshot Barrage | 17% | 2% | 15.8 | 1.0 | 3% | most cast skill, 3.4 per player hit |
| Frostgale | 9% | 3% | 13.9 | 0.9 | 2% | weak for its use |
| Faultline Slam | 5% | 2% | 9.5 | 1.1 | 3% | lowest damage/s |
| Glacial Lance | 4% | 1% | 12.9 | 1.1 | 1% | weak |
| Stormcall Sigil | 2% | 1% | 14.0 | 0.7 | 1% | worst damage per mana |
| Hoarfrost Snare | 5% | 2% | 17.3 | 0.8 | 2% | poor damage per mana |

## Skill numbers (gameplay pass, 2026-11-11)

Goal: pressing a skill clearly beats basic attacking for its mana, and no skill is twice the rest. Only
`src/shared/content/gems.ts` numbers changed. Measured with the same harness, 128 matches before and
128 after on the same bot code; damage is against monsters. Basic attacks deal 13 damage per second
of swing time (sword and quarterstaff 22, bow and wand 7).

| Skill | Change | Damage/s of use before -> after | Damage per mana before -> after |
|---|---|---|---|
| Pyre Effigy | cost 16 -> 14, damage 8 -> 7, totem lasts 8 -> 6 s, fires every 0.8 -> 0.9 s | 76.9 -> 54.2 | 2.1 -> 1.7 |
| Faultline Slam | cost 11 -> 9, damage x2.5 -> x2.8, radius 66 -> 74, time 1.75 -> 1.5, hit at 72% -> 62% | 12.0 -> 22.4 | 1.4 -> 2.6 |
| Sundering Blow | damage x2.1 -> x2.3, time 1.45 -> 1.25, hit at 62% -> 58% | 20.0 -> 24.8 | 2.8 -> 3.1 |
| Glacial Lance | cost 8 -> 7, damage 16 -> 22, time 0.75 -> 0.7 | 13.5 -> 22.6 | 1.1 -> 2.0 |
| Galeshot Barrage | cost 3 -> 2, damage x0.55 -> x0.7, spread 7 -> 4 | 13.9 -> 21.5 | 0.8 -> 1.8 |
| Frostgale | cost 9 -> 8, damage 15 -> 19 | 17.0 -> 23.2 | 1.1 -> 1.8 |
| Stormvault | cost 12 -> 10, damage x1.7 -> x2.2, radius 60 -> 70 | 18.2 -> 24.8 | 1.1 -> 1.8 |
| Stormcall Sigil | cost 12 -> 10, damage 30 -> 34, radius 74 -> 84, delay 0.8 -> 0.6 s | 19.4 -> 24.7 | 0.9 -> 1.4 |
| Hoarfrost Snare | cost 9 -> 7, damage 22 -> 26 | 20.9 -> 25.4 | 1.0 -> 1.6 |
| Rending Chop | hit at 65% -> 55% of the swing | 21.6 -> 24.0 | 5.1 -> 5.7 |
| Unchanged: Cinderbolt / Splinter Volley / Stormthread / Reaping Whirl / Wheeling Glaive | - | 25.9 / 33.5 / 32.8 / 28.2 / 32.9 -> 25.3 / 35.2 / 32.8 / 30.1 / 38.7 | 1.9 / 1.7 / 1.7 / 2.9 / 2.5 -> 1.9 / 1.7 / 1.7 / 3.1 / 2.9 |
| All skills | | 24.2 -> 27.0 | 1.69 -> 2.02 |

Spread without the totem: 12 - 34 (2.8x) before, 21 - 39 (1.8x) after. Pyre Effigy still reads highest
because a totem is cast in 0.7 s and deals its damage over 6 s; per mana it is now below the average.
Basic attacks' share of all damage: 52% -> 50%.

Whole match, old numbers -> new numbers: mean length 358 -> 331 s (two runs each: 362, 354 -> 322, 340),
under 5:00 25% -> 34%, reaching sudden death 20% -> 10%, 0 stalls, deaths to monsters 46% -> 49%.
Faster kills mean faster levels and earlier boss attempts. Still inside the 5:00 - 7:00 target.

Also in this pass (not numbers): a roll that cancels a skill before its first hit refunds the mana and
the cooldown (`server/skills.ts`).

## Monster lethality (bot behaviour pass, 2026-11-11)

Question: deaths to monsters were 48% of all deaths and a third of matches ended under 5:00. Is that the monsters or
the bots? Every monster death in 128 baseline matches was logged (victim level, killer, distance to the lair, time from
80% life, biggest hit, the bot's goal). Result: mostly the bots. No monster number was changed in this pass.

What the baseline deaths looked like:

- Boss (1.70 per match + 0.37 to its adds): 66% of victims level 8 or lower, median 573 px from the lair, 65% within
  6 s of a player fight, 89% of the damage from sap volleys. Bots gathered on a ring 450 px round the map centre, with
  the lair 300-420 px off it, chased each other through the arena and walked through it to camps on the far side.
- Exiles (1.96): victims level 5.9 on average, biggest hit 33% of life and shield, 14 s from 80% life to dead. Bots of
  level 1-5 that fought one died 35% and won 1%; level 6-10: 21% / 9%; level 11-15: 9% / 18%. Exiles are not scaled to
  the player (gear of item level 8-17 from the first second). This part is real.
- Ordinary packs and shrine guards (2.59): 25-36 s from 80% life, no hit above 14% of the pool, 7-8 monsters near,
  no flask use left in 85% of cases, 40% within 6 s of a player fight. Slow attrition a player would walk away from.

Changes (all in `src/server/bots/bot.ts` unless noted): unready bots (under level 13) keep their roaming, targets, loot
and late gathering out of the boss arena, never step deeper inside 700 px of the lair and back out when the boss wakes;
bots under 30% life with no flask use back off from packs; bots sidestep monster projectiles and leave line telegraphs
sideways; bots under level 10 leave exiles alone; `BOT_LATE_SECS` 270 -> 240 (`src/shared/constants.ts`).

| 128 matches per arm, 15 bots | Before | After |
|---|---|---|
| Deaths to monsters | 47.9% (6.70 per match) | 32.7% (4.58 per match) |
| Boss / boss adds | 1.70 / 0.37 | 0.55 / 0.20 |
| Exiles | 1.96 | 1.34 |
| Ordinary packs / shrine guards | 1.71 / 0.88 | 1.59 / 0.88 |
| Victim level 1-5 / 6-10 / 11+ (per match) | 2.78 / 3.35 / 0.57 | 1.95 / 2.03 / 0.60 |
| Mean / median length | 329 / 324 s | 362 / 360 s |
| Under 5:00 / over 7:00 (sudden death) | 38% / 15% | 11% / 15% |
| Stalls | 0 | 0 |
| Level at 2:00 / 4:00 / 6:00 | 6.3 / 8.9 / 12.7 | 6.1 / 8.0 / 11.3 |
| Normal pack, life lost, level 1-5 / 6-10 | 5% / 3% | 4% / 3% |
| Elite pack, life lost, level 1-5 / 6-10 | 40% / 19% | 27-33% / 17-27% |
| Level 1-5 bot an exile reaches: dies / wins | 35% / 1% | 30% / 1% |

Two sets of 64 matches with the same code differ by up to 17 s on the mean and 8 points on the tail shares.

Left alone on purpose: exile damage and speed, boss numbers, the level curve. The targets are met without them, and
the exile result is partly a bot result too (a bot cannot break line of sight or lead an exile into another player).

## Exiles on the level curve, flask trickle (gameplay pass 2, 2026-11-11)

Both arms on the open maps (walkable ground about 37% -> 55%), 128 matches of 15 bots each, same map code.

Exiles: `EXILE_LEVEL` 8 (`src/shared/content/monsters/exiles.ts`) is the level the rolled gear stands for. An exile
starts at level 1 and is raised to the player who wakes it on `monsterLevelScale`, like any monster
(`src/server/ai/hooks.ts`). Life / damage against the gear values: x0.56 / x0.62 at level 1, x0.73 / x0.76 at
level 4, x1 at 8, x1.97 / x1.62 at 15, x2.73 / x2.22 at 20. Speed, skills and the dodge roll are unchanged. It drinks
its flask only while it is being hit. The bot rule `EXILE_MIN_LV` is removed; bots run from an exile under 40% life.

Flasks: a flask with less than one use left gains 0.5 charges per second while its owner has taken no damage for 6 s,
up to one use (`FLASK_TRICKLE_PER_SEC`, `FLASK_TRICKLE_DELAY` in `src/shared/constants.ts`; a use costs 10). Kill
charges are unchanged.

| 128 matches per arm | Before | After |
|---|---|---|
| Level 1-5, damaged by an exile: died / won | 13% / 0% with the bot rule (bots ran); 39% / 6% without it | 13% / 22% |
| Level 1-5, fought back (3+ hits): died / won / left | 31% / 17% / 48% (rule off, 64 matches) | 9% / 45% / 42% |
| Level 6-10, fought back: died / won / left | 18% / 33% / 49% (rule off, 64 matches) | 7% / 30% / 62% |
| Level 11-15, damaged by one: died / won (few) | 6% / 19% of 16 | 3% / 18% of 33 |
| Damaged and ran: got away | 83% | 79% |
| Exile life / damage met at level 1-5, 6-10, 11-15 | 354 / 33, 352 / 33, 349 / 31 | 218 / 23, 337 / 30, 426 / 34 |
| Exile deaths per match | 1.17 (2.72 with the rule off) | 1.17 |
| Under 30% life with no flask use, share of living time | 15.8% | 10.4% |
| Such stretches over 30 s / over 60 s, per match | 5.24 / 3.13 | 2.36 / 0.08 |
| Flask uses per player | 4.0 | 5.3 |
| Deaths to monsters | 22% (3.14 per match) | 22% (3.08) |
| Mean / median length | 390 / 380 s | 370 / 369 s |
| Under 5:00 / over 7:00 (sudden death) | 5% / 28% | 10% / 16% |
| Stalls | 0 | 0 |
| Level at 2:00 / 4:00 / 6:00 | 6.1 / 7.7 / 11.1 | 6.9 / 9.2 / 12.8 |

Open maps alone, same code (old -> new map, 128 matches each): mean 380 -> 390 s, under 5:00 6% -> 5%, sudden death
23% -> 28%, stalls 0, deaths to monsters 29% -> 22% (boss 0.52 -> 0.22 per match, packs 1.33 -> 1.06, shrine guards
0.73 -> 0.55, exiles 1.27 -> 1.17). The sudden-death target (under 20%) was already missed on the old maps in this
re-run (23%; the 15% of the last pass did not repeat, its own build gave 19% on a new set of 64). Matches are not
repeatable by seed, so sets of 64 differ by several points.

## Boss objective, wounds kept (gameplay pass 3, 2026-11-11)

428 matches before (frozen copy including the coordinator's wake change), 288 after, 15 bots each.

Matriarch (`src/shared/content/monsters/roster.ts:171`): `hp` 130 -> 65, `damage` 18 -> 12.6. Met at level 13 it has
about 1,200 life and hits for about 40: a 20-30 s fight for a level 12-14 bot (13-22 damage a second). Gulpmaw and the
Shattered Warden are unchanged. Reward unchanged (best table in the match, 20x XP, broadcast on wake and on kill).

Bots (`src/server/bots/bot.ts`): every bot hunts the boss from level 12 (`BOSS_MIN_LV`, was 13; was one bot in three),
only with 70% life and a flask ready (`BOSS_GO_HP`), and tries again 40 s after leaving the lair (`BOSS_RETRY_MS`). A bot
keeps a rare or unique monster under 50% life within 600 px as its target unless a player is hitting it; a boss under
50% is finished even then (`COMMIT_HP`, `pickTarget`).

Wounds (`src/server/ai/brain.ts` `WOUND_MEMORY` 60 s, `state.ts` `woundT`, `hooks.ts`, `src/server/monsters.ts`): a
monster a player hit does not heal on the walk home or at idle for 60 s, and a camp that falls asleep (no player within
1,500 px) no longer resets a wounded monster to full. That reset was what undid abandoned fights: with the 60 s rule
alone, 63-71% of exiles were still back to full 30 s after a no-result fight.

| | Before | After |
|---|---|---|
| Boss attempted / killed (share of matches) | 56% / 1% | 75% / 24% |
| Clean level 11-15 boss fights: won / died / left | 0% / 6% / 88% (17, one set) | 34% / 9% / 54% (108) |
| Boss fights with a player in them: died / won | 27% / 0% | 19% / 7% |
| Deaths to boss + adds per match | 0.49 | 0.39 |
| Level 6-10 exile fights with no result | 52% | 50% |
| Exile back to full 30 s after a no-result fight (level 6-10) | 71% (no-wound arm) | 0% |
| Exile life at the next fight after a no-result fight | 73.8% (full 23%) | 66.5% (full 7%) |
| Exiles killed per match | 1.5 | 1.7 |
| Deaths to monsters | 25% (3.48 per match) | 21% (2.88) |
| Mean / median length | 376 / 373 s | 384 / 380 s |
| Under 5:00 / sudden death | 9% / 25% | 9% / 29% |
| Stalls | 0 | 0 |

Tried and dropped: boss life x0.4 (24% killed), hunting from level 11 (25%, sudden death 33%), half the bots hunting
(17%). The kill rate stops near 25-30% because most boss fights get a third party. The coordinator's wake rule
(idle monsters woken from out of sight scale to the attacker) moved nothing measurable (284 matches each: deaths to
monsters 25% vs 25%, boss attempted 56% vs 56%).

Tried, not adopted: bots hunting at 3:30 instead of 4:00 (`BOT_LATE_SECS` 240 -> 210, 288 matches) brings sudden death
29% -> 17%, but under 5:00 9% -> 16%, mean 384 -> 358 s, and boss kills 24% -> 14% (bots stop hunting it to hunt
players). It trades the objective for the timer, and it is a bot constant that says little about people. Left at 240.

## Endgame by game rules, boss XP (gameplay pass 4, 2026-11-11)

264 matches before (round 12 tree, frozen copy), 264 after (live tree), 15 bots each. The game has no zone; the rules
that end a match are the survivor reveal, the final duel and sudden death (7:00, not touched). `BOT_LATE_SECS` stays 240.

Reveal (`src/shared/constants.ts:143`): `REVEAL_AFTER` 300 -> 240 s. Every survivor is shown on the map from 4:00 (or
from 5 left, unchanged). Bots and people both get the positions; bots walk to them and stop farming.

Final duel (`src/server/damage.ts:136`): `FINAL_DUEL_PVP_MULT` 1.5 -> 2. With two left, player hits do x2 (on top of
the x0.4 PvP cut), so the last duel ends before sudden death more often. In sudden-death matches the last pair had
already traded 40-280 hits before 7:00: they had met, the fight did not end.

Boss XP (`src/shared/content/classes.ts:50-54`): base XP 87 / 97 / 93 -> 30 / 34 / 33. A Matriarch kill at level 13 is
about +4 levels (was about +8). Drops unchanged.

| | Before | After |
|---|---|---|
| Sudden death (7:00) | 35% | 17% |
| Mean / median length | 394 / 396 s | 363 / 357 s |
| Under 5:00 | 7% | 14% |
| Alive at 4:00 / 5:00 / 7:00 | 9.1 / 4.5 / 2.5 | 8.8 / 3.9 / 2.6 |
| Two left at (median) / final duel median, p75 | 352 s / 28 s, 48 s | 325 s / 21 s, 35 s |
| Deaths to monsters | 21% (2.97 per match) | 21% (3.00) |
| Boss attempted / killed | 71% / 22% | 74% / 23% |
| Boss killer level after the kill | 23.3 | 17.9 |
| Boss killer wins / fair share / top 3 | 62% / 18% / 88% | 62% / 16% / 79% |
| Stalls | 0 | 0 |

Arms (264 each): reveal 240 alone 23% sudden death; final duel x2 alone 19%; both 14%; reveal 210 (132) 23% and boss
kills 15%; reveal also at 7 left 25%. Boss XP arms on top of both: full 66% killer wins, x0.35 64%, none 51%. The
killer wins most matches because the strongest bot takes the boss; the XP is worth 10-15 points of that at most. Sims are
not deterministic: about +-5 points of noise on a 264-match share, +-6 on the killer win share (about 60 kills).

## What bots cannot tell us

- Bots now sidestep monster shots and leave line telegraphs, but they read 45-95% of shots on a fixed
  rule and never use cover; they kite at range without error. The bow advantage is likely overstated
  for humans.
- Match length in bot play follows the reveal (4:00) and the final duel now, but bots always walk to the
  revealed survivors. People may hide or wait for the others to fight; the length targets say the loop
  can fit 5-7 minutes, not that people will.
- The boss killer wins 62% of bot matches it is in, with or without most of the XP. Whether a weaker
  person can steal the boss and turn the match round, bots cannot say.
- Bots fight the boss standing still in melee or at a fixed range and never use its adds or the arena
  walls; 24% kills in bot play says the numbers allow it, not that people will take it. Bots also never
  decide to wait for someone else to soften the boss and steal it.
- Bots leave a fight at fixed life thresholds. Whether people come back to a wounded exile (the 60 s
  wound memory) or treat a half-dead one as bait, bots cannot say.
- A bot that an exile reaches cannot break line of sight or lead it into someone else; exile lethality
  against low levels (now 13% of such meetings fatal) may be lower for people, or higher for new ones.
- Exile fights at level 11+ are rare in bot matches (63 meetings in 128 matches). The scaled-up exile
  (twice the life at level 15) is untested as a fight.
- Bots wait out the flask trickle by walking away. Whether people turn it into hit-and-hide play, or
  find 6-26 s too long, bots cannot say.
- 60% of bot player fights break off without a kill. Human duel length may differ a lot.
- Bots fight few monsters after level 10 in a real match and stay away from bosses, so the level 11+
  pack numbers come from farm mode only.
- Bots drink a flask at 55% life every time; the flask rule's effect depends on that habit.
- Bots keep their class weapon, so weapon type and class cannot be separated.

## Open questions for the owner

1. Deaths to monsters are still 42% of all deaths. Is that the game you want, or should ordinary
   monsters and exiles be softened for low-level players?
2. Elite packs still get easier past level 15 (24% of life lost against 50% at level 1-5). A steeper
   curve fixes it but makes the boss deadlier again. Flatten further?
3. The boss is a 20-30 s fight at level 12-14, killed in about a quarter of bot matches, now worth about
   +4 levels (was +8) plus the best drops. Its killer wins 62% of those matches either way. Fine?
4. Bow and wand classes win most even duels in bot play. Wait for human data, or act now through the
   skills pass (ranged basic attack)?
5. Sudden death is at 17% after the earlier reveal (4:00) and the x2 final duel. If people hide more than
   bots, the next lever is the reveal again (it is map information only), not a zone.
6. Gulpmaw and the Shattered Warden got the first cut but not the second (life x0.5, damage x0.7 on the
   Matriarch only). Every bot match ran on Hollowpine (Matriarch), so they are untested; give them the same
   cut if Gloamwater or Broken Spire is played.
