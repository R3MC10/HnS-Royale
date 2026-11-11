# HnS Royale — self survey (loop agent)

Budget rule from the coordinator: at most 3 rounds, one high-impact item per round, survey from code and
existing evidence, launch the game only to verify a finished change.

## Round 1 — 2026-11-11 — angle: monster and boss behaviour

**What would most improve the game for a player right now?** Boss and camp fights that cannot be reset by
accident. Evidence (headless sim of the real `Game`, 4 map seeds, player pulled along real A* paths):
a boss at 40% life that was walked ~780 px from its spot turned round and was back at 100% about 5 s later,
whether or not the player stayed next to it; and 6 of 103 pulled monsters ended up settled 270–640 px away
from their camp for the rest of the match.

**What is broken?**
- Walk-home heal (12%/s) plus an instant full heal on arrival ran even with the player standing beside the monster.
- A monster walking home in a straight line into a wall "settled" there and made that spot its new home.
- A monster whose target was out of reach behind a wall pressed against the wall for as long as the target lived.
- A monster walking home ignored a player next to it until it was hit.

**Decisions**
- Healing: PoE2 monsters do not heal when kited; they reset when you really leave. So: no healing while any living player is within 900 px (5 s linger) or it was hit in the last 4 s. Really leaving still resets it (regen 12%/s; camps farther than 1500 px from everyone reset as before).
- No instant full heal on reaching home; the out-of-combat regen does that job.
- Walk home retraces chase breadcrumbs (one per 48 px, loops cut out) instead of a straight line. A blocked crumb is skipped, after 3 skips it settles as before (rare fallback).
- A chase gives up after 3 s with the target beyond max(600, 1.8 × aggro) and not hitting it.
- A monster walking home within half its leash of home fights again when a player is inside its aggro radius.

**Done this round**
- `src/server/ai/brain.ts`: `canRecover`, `trackChase`, new `stepReturn`, lose-interest and re-aggro in `thinkRoster`.
- `src/server/ai/state.ts`: `trail`, `nearT`, `loseT`, `retSkips`.
- `src/server/ai/hooks.ts`: in-combat timer per active monster; idle regen gated by `canRecover`.
- Verified: `tsc --noEmit` clean. Sim after the change: 0 of 127 monsters settled away from camp (4 seeds); boss life stays flat while the player is within range and only recovers 5 s after the player is 900+ px away. Live: boss set to 50%, kited for 20 s inside range, still 1123/2247 — `loop-boss-no-kite-heal.png`.

## Round 2 — 2026-11-11 — angle: combat feel (monsters chasing)

**What is broken?** Monsters walk straight at their target, so a tree line or wall between a pack and the
player stops it (seed 1337: the boss stood 282 px from home pushing into a wall with the player in the open).

**Decision** — simplest thing that works: keep straight-line chasing; only a monster that covers less than a
third of the ground it should in 0.4 s, with no clear straight line to its target, asks for a short A* route
(reusing `server/bots/path.ts findPath`, 4000-node budget, one search per tick for all monsters, 2 s back-off
when none is found) and follows it until the straight line is clear again or 6 s pass.

**Done this round**
- `src/server/ai/brain.ts`: `chaseSteer`, `clearLine`, `resetChasePaths`; `state.ts`: `route`, `routeT`, `routeCd`, probe fields; `hooks.ts`: per-tick budget reset.
- Verified: `tsc --noEmit` clean. Sim: 14–32 monsters per seed used a route during the pulls, the seed-1337 boss now follows (506 px out instead of stuck at 282), sim run time unchanged. Live: a wolf with an active route reached the player through trees, no server errors — `loop-chase-route.png`.
- Not shown: share of ranged monsters "keeping up" is unchanged, because they hold their preferred range by design.

## Round 3 — not run
Stopped after two rounds to keep usage low; nothing else surveyed from code was both clearly high-impact and
outside the areas other agents own. Checked and found already present: endgame reveal of survivors (three or
fewer left), end-of-match results flow.

## Round 4 — 2026-11-11 — upgrade loop: frame-time cliff, trees, quick fixes, solo start

**Frame-time cliff (fixed).** Cause: Chrome keeps every 2D canvas on the GPU until the page's canvases pass
a fixed GPU memory cap (about 512 MB). The game's cache canvases (terrain chunks, painted ground, silhouettes,
gore layers, hero frames; about 1000 canvases) reach it after 8–16 roamed places; from then on frames cost
30–60 ms and never recover. It was not a regression from one change: the older snapshot build breaks the
same way on a longer roam. Raising `CHUNK_CACHE_MAX` to 700 only made it arrive in the first roam.
- Fix: `src/client/gfx/softcanvas.ts` (imported first in `main.ts`) creates every off-page 2D canvas up to
  512 px with `willReadFrequently`, which keeps it off the GPU cap. `CHUNK_CACHE_MAX` back to 260.
- Same 8-spot teleport roam, 1280x720, solo: before — pass 1 7.6 / 8.6 ms (median / p99), pass 2 38.4 / 71.2,
  pass 3 46.5 / 76.3. After — six passes, every one 7.6 / 8.6.
- Not measured: a full 20-player match, other GPUs or browsers.

**Trees hide the player (done).** A tall prop drawn in front of the local player, or of a player or monster
within 380 px of them, eases to 35% opacity and back (`render.ts propFade`, `statics.ts propBox`). Seen live
for the local player (`upgrade-treefade.png`); not checked for enemies.

**Quick fixes.** Spirit orb now shows reserved / total like the skills panel (`hud/vitals.ts`). "Kills" is
"Player kills" in HUD, spectate, scoreboard and results. Winner screen holds 12 s (`ROUND_END_TIME` 14,
`hostruntime.ts endHold` 12) — not watched live. Monster name labels are already drawn after the world, so
above trees; no change, not checked live.

**Solo start too hard.** Cause: with six or fewer alive, bots treat the match as late game from second 0
(1100 px hunt range) and walk straight to the new player. Fix: `OPENING_TRUCE = 40` s in
`src/server/bots/bot.ts` — bots do not pick player targets in the first 40 s unless hit from close by.
Not verified (bot matches were off limits this round).

## Round 5 — 2026-11-11 — upgrade loop: life globe, winner screen, match length, hero idle

**Life globe pale at full life (fixed).** Cause: the starter kit gives 3 energy shield; a full shield drew a
40% pale-blue layer over the whole globe, so full life looked grey-pink until the shield was hit. Fix
(`hud/vitals.ts`): the shield tints the liquid only for a character with no life pool; otherwise shield is
the blue ring and number, barrier the gold ring and "+N". Seen live at level 1, 110/110 with 3 shield: deep
red (`upgrade-lifeglobe.png`).

**Winner screen (done, not seen live).** Any key or click after 1.5 s sends `r-skip`; the host shows the
results once every human still in the match has skipped (at least 2 s in), else after the usual 12 s
(`net/roomproto.ts`, `net/hostruntime.ts`, `client/main.ts`; hint line in `render.ts`). Results table marks
bots with "BOT" (`ResultRow.bot`, `menus.ts`). Typecheck only: a hall match needs bots, which were off.

**Match length (10–12.5 min with 15 players; target 5–7).** Levers looked at, cheapest first:

| Lever | PoE2-compatible | Cost | Chosen |
|---|---|---|---|
| Show survivors on the map earlier (5 left instead of 3, and for everyone after 5 min) | yes, map information only | two constants | yes |
| Bots hunt sooner (late game from 4.5 min instead of 7; centre pull full by then) | yes | one constant | yes |
| Smaller map per player count | yes | touches map generation, camp counts, spawn spacing | no, next if the first two are not enough |
| Reveal an idle player | yes | needs idle tracking and a rule for trading / inventory time | no |

Done: `REVEAL_ALIVE = 5`, `REVEAL_AFTER = 300`, `BOT_LATE_SECS = 270` in `shared/constants.ts`, used in
`server/snapshot.ts` and `server/bots/bot.ts`. **Effect on match length is not measured** (bot matches were
off); the "Alive" counter still turns red at 3, not 5.

**Hero (done).** Two-handed idle held the haft level at the hips, which read as pointing at the ground from
some facings; the idle now carries it across the body, head over the right shoulder (`hero_anim.py idle`,
2h only; attacks and run unchanged). Face: brow and eye sockets were near-black and the beard covered the
jaw; sockets are now a skin shade, brow lighter, beard and moustache smaller (`hero_body.py`). `hero.glb`
regenerated. Idle seen live with a greataxe (`upgrade-heroidle.png`); the face is mostly under the name
plate at game zoom, so the face change is not confirmed by eye. Other classes and the idle-to-attack blend
were not looked at.

## Round 6 — 2026-11-11 — upgrade loop: first minutes, pickup, reveal, hall return, sandbox checks

**Self-survey.** *Most improves the game now:* the first minute (a new player gets no controls and F
sometimes "does nothing") and the end of a match (results needed a click to get back to the hall).
*Missing:* a notice when survivors become visible. *Confusing:* "Alive" turned red at 3 while the reveal
starts at 5; rough skill and support crystals look alike; the skill-slot picker.

**F pickup (fixed).** Cause: a hovered label always won, so F with the mouse resting on a far label only
started a walk. Now (`client/main.ts onAction`): hovered item if in reach, else nearest item in reach, else
walk to the hovered far label. Live: far label hovered, F took the item underfoot without moving; second F
walked to the far one (`upgrade-fpickup.png`).

**First-spawn controls strip (done).** `client/firsthints.ts`, called on `welcome`: one strip with the
player's current binds (move, attack, dodge, flask, pick up, inventory, passives, skills), close button,
goes away after 40 s, shown once per browser (`hns-hints-seen`). Seen live (`upgrade-firsthints.png`).

**Survivor reveal (done).** "Alive" is red exactly while the server sends survivor positions; a "Survivors
Revealed" banner shows for 4 s when that starts (`hud/royale.ts`). Seen live with the fight clock forced to
5:00 (`upgrade-reveal.png`); the 5-left trigger shares the same code path and was not forced separately.

**Jewel quick-socket (verified, works).** Right-click socketed the jewel into the allocated socket; Ctrl+click
of a second with no free socket gave the refusal toast (`upgrade-jewelsocket.png`). The toast was cut off by
the docked bag, so the text is shorter now (`server/progression.ts`).

**Spectate and return to the hall (user requirement).** Flow now:
1. A player who dies stays in the match as a spectator until it ends (no timeout, nothing forces Leave).
2. Leave (spectate bar or Esc menu) is optional: in a hall it sends `r-leave`, the player is back on the
   hall screen at once and stays a member; the match goes on.
3. Winner screen: 12 s, or 2 s once every human still in the match clicked through.
4. The host ends the match: everyone is taken out of the arena, the hall is in "room" state with the same
   members and bots, and every player who took part (winner, dead spectators, those who left to the hall)
   gets the results.
5. New: the results screen returns to the hall by itself after 20 s ("Back to the hall (n)",
   `client/menus/menus.ts renderPost`); Rematch / Back still work at once. Nobody goes to the main menu.
6. Bots ready themselves again; the host is always ready; other humans are set to not ready and tick Ready
   (or press Rematch) — kept so an absent player is not pulled into the next match.
Headless check (Node `HostRuntime`, 4 humans + 1 bot): early death and late death both stayed in the match
and kept receiving snapshots with a spectate target; the one who clicked Leave got `r-left` and stayed a
member; all four got `r-end` 12.0 s after the win; hall had the same 5 members; a second `r-start` put all
of them in again. The 20 s auto-return itself is type-checked only (not seen in a browser).

**Sandbox numbers (Node, fast-forward, 1 idle human + bots, random map seeds).**
- 15 players, 3 matches: fight 9:19, 6:05, 8:47 (mean 8:04; was 10–12.5 min; target 5–7 not reached).
  First death 81 / 91 / 25 s; half the field dead by about 4:40.
- Opening truce: player-vs-player hits in the first 40 s: 65 / 0 / 4 (first at 12.9 / 41.1 / 32.3 s);
  20 players: 0 (first 55.8 s). So the truce mostly holds but leaks in some matches (retaliation rule).
  The idle human was first hit at 555 / 276 / 162 s.
- Skip: with the human's `r-skip` sent 2.5 s into the winner screen, results came at 2.5 s; without, 11.9 s.
- BOT tag: 14 of 14 bot rows flagged, the human row not.
- Host tick, 20 players whole match (13,579 ticks): mean 1.24 ms, p99 3.30 ms, max 5.6 ms, none over 33 ms.
  15 players: mean 0.7 ms, p99 2.2 ms, max 8.1 ms. Node on this PC, not the browser worker.
- Found: results "Match length" includes the 12 s winner screen (571 s shown for a 559 s fight).

## Backlog (ranked)

| # | Item | Impact | Effort |
|---|------|--------|--------|
| 1 | Match length still 6–9 min with 15 players (target 5–7): next lever is a smaller map per player count | high | medium |
| 2 | Opening truce leaks in some matches (65 player hits before 40 s in one of four): tighten the retaliation rule in `bots/bot.ts` | high | small |
| 3 | Clicking a skill slot on the bar opens a picker above it with the skills for that slot | medium | medium |
| 4 | Rough skill crystals and rough support crystals look the same in the gem bag | medium | small |
| 5 | At 720p the character and skills panels cut off their last row | medium | small |
| 6 | See the 20 s results-to-hall return and the hint strip in a real two-player hall | medium | small |
| 7 | Results "Match length" counts the 12 s winner screen | low | small |
| 8 | Leaver during a fight gets no kill-feed line (placement is recorded) | low | small |
| 9 | Hero: top-tier plate too bright, low-tier leather gloves/boots barely visible | low | medium |
| 10 | Boss bar: no marker for what the next phase does | medium | small |
| 11 | Faded-prop entries kept for props that leave the screen while faded | low | small |

- [x] F pickup, first-spawn controls, survivor reveal notice, jewel quick-socket, auto return to the hall (round 6)
- [x] Checked in sandbox: bot truce, winner skip, BOT tag, 15-player match length, 20-player tick cost (round 6)
- [x] Frame time breaks after roaming (round 4)
- [x] Trees hide the player (round 4)
- [x] Monsters settle far from their camp (round 1)
- [x] Kiter walks a boss back to full life (round 1)
- [x] Monsters stuck on walls while chasing (round 2)

## Round 7 — 2026-11-11 — upgrade loop: match length, opening truce, slot picker, crystals, 720p panels

All match numbers: Node, fast-forward, 1 idle human + bots, seeded random (`scratchpad/up7/msim.ts`). Bot
matches only; no human match was played.

**Match length (done: smaller map per player count).** The map already scaled with players
(`side = sqrt(baseArea + players * areaPerPlayer)`), only too generously. `shared/mapgen/generate.ts MAPGEN`:
`baseArea 26e6 -> 45e6`, `areaPerPlayer 11.5e6 -> 3.7e6`. Two-player maps keep their size (7.0k -> 7.2k px);
15 players 14.1k -> 10.0k px; 20 players 16.0k -> 10.9k px.

| 15 players | Runs | Fight mean | Range |
|---|---|---|---|
| Before (side 14,080) | 15 | 8:15 (495 s) | 6:20 - 13:32 |
| Sweep, 8e6 per player (12,096) | 6 | 7:47 | 5:28 - 11:11 |
| Sweep, 6e6 per player (10,752) | 6 | 7:13 | 6:08 - 8:48 |
| Sweep, 4.5e6 per player (9,664) | 6 | 5:14 | 4:11 - 6:46 |
| After, final code (10,048) | 24 | 5:36 (336 s) over the 22 that finished | 3:15 - 7:04 |

Other counts after: 20 players 5:57 (5:01 - 6:59, 5 runs); 6 players about 3:10 (1:31 - 4:02, 8 runs);
3 players 4:45 (2:36 - 7:43, 4 runs). Side effects: camps on a 15-player map fell from about 96 to about 38
(20 players: 24 - 36), closest pair of spawns from 2.0 - 2.8k px to 1.35 - 1.85k px.
**Not finished: 2 of the 24 final matches were still running at the 700 s cap** (and 2 of about 60 earlier
runs on the small map; none in 15 runs on the old map, which did have 11- and 13-minute matches). Traces:
(a) two bots duelling with life going *up* on both (recovery beats their damage); (b) a wand bot circling a
monster it was not killing while the idle human stood untouched. Not fixed; top of the backlog.

**Opening truce (cause found, reduced, not zero).** The suspected retaliation rule was not the start of it.
Classifying every player hit before 40 s: no bot ever picked a player on its own; each leak began with a
*stray* hit (two bots on the same monster or camp, swings and projectiles catching the other), and the
rule `d < 160 && hurtT > 0` then turned it into a duel. `hurtT` is set by any life loss, so a monster's hit
next to another player also counted. Changes, all in `server/bots/bot.ts`:
- a bot reads the hit events and fights back during the truce only against a player who landed 3 hits on
  it within 4 s (snapshots carrying a hit on the bot are no longer skipped);
- during the truce a bot does not attack a monster with another player within 300 px (unless it is on the
  bot), does not pick a camp another visible player is at or nearer to, and gives up a camp on the way
  there for the same reason.

| Player hits before 40 s, 15 players | Runs | Per match |
|---|---|---|
| Old code, old map | 12 | 7.6 |
| Old code, small map (4.5e6 sweep) | 6 | 23 |
| Retaliation by attacker only, small map | 24 | 18 |
| + three hits needed | 24 | 8.7 |
| + camps yielded (final) | 24 | 5.0 (median 3, max 18, 5 matches with 0) |

Final, other counts: 20 players 6.0 (5 runs), 6 players 1.4, 3 players 0. What is left is stray hits
(82 of 121) and the duels that follow three of them (39). Zero needs a server rule (no player damage in the
first 40 s), which is a design decision, not taken.

**Results "Match length" (fixed).** `net/hostruntime.ts endMatch`: time for players alive at the end no longer
counts the winner screen. Sim: results 242 / 149 / 237 s for fights of 242 / 149 / 237 s (was +12 s).

**Skill slot picker (done).** A click on a bar slot opens a small list above it (`client/skillbar.ts`): the
cut skill gems in the bag the slot accepts (not already on the bar, gem limit respected), "Take the gem
out" when it holds one, and "Open the Skills panel". Second click, a click elsewhere or the close-panels
key closes it. Seen live at 1280x720 in Polish (`up7-picker.png`, `up7-picker2.png`): listed 3 of 4 bag
gems (the fourth was already on the bar), a pick socketed it, reopening showed "Wyjmij kamień". Polish
entries added in `i18n/pl.ts`. Not looked at: the English text, the Ctrl second row, a full bar.

**Rough crystals (done).** `client/gfx/gemart.ts`: skill = blue, support = gold with a ring mark, spirit =
violet with a diamond mark (marks lower left, clear of the level number). Seen live (`up7-crystals-zoom.png`).
Ground label colour unchanged.

**720p panels (they already scroll; cue added).** At 1280x720 both panels are docked 561 px tall; the wheel
scrolled the character sheet 346 px and the Skills panel 459 px to their ends, so nothing was unreachable.
The cut row was the scroll edge, with no cue in the headless shots (scrollbars hidden there). Added a fade
on the last 30 px while more is below (`client/hud/dock.ts`), seen live (`up7-char720.png`,
`up7-skills720.png`). Not checked in a normal browser window with visible scrollbars.

Seen on the way: the first-spawn controls strip overlaps the top of the docked left panel at 720p.

## Backlog (re-ranked after round 7)

| # | Item | Impact | Effort |
|---|------|--------|--------|
| 1 | Bot matches that do not end (about 1 in 12 past 11.5 min): duel where recovery beats damage; ranged bot stuck on a monster while a survivor waits | high | medium |
| 2 | Camps per player dropped with the smaller map (15 players: ~96 -> ~38): check levelling pace with people; raise camp density if thin | high | small |
| 3 | Opening truce still leaks ~5 stray hits a match; zero needs a server rule (no player damage for 40 s): decide | medium | small |
| 4 | See in a real two-player hall: match length with people, 20 s results return, hint strip, slot picker | medium | small |
| 5 | First-spawn controls strip overlaps the docked character / skills panel at 720p | low | small |
| 6 | Six-player matches run about 3 min: confirm that is wanted | low | small |
| 7 | Leaver during a fight gets no kill-feed line (placement is recorded) | low | small |
| 8 | Boss bar: no marker for what the next phase does | medium | small |
| 9 | Hero: top-tier plate too bright, low-tier leather gloves/boots barely visible | low | medium |
| 10 | Faded-prop entries kept for props that leave the screen while faded | low | small |

- [x] Match length 15 players 8:15 -> 5:36, truce leak cause and reduction, results length, slot picker, crystal marks, panel scroll cue (round 7)

## Round 8 — 2026-11-11 — upgrade loop: matches that never end, camps per player, hint strip, round-end line

All match numbers: Node, fast-forward, 1 idle human + bots, seeded random (`scratchpad/up8/msim.ts`), 15 players
unless said. Bot matches only; no human match was played.

**Matches that never end (fixed: 0 of 168).** Round-7 code, 144 matches, 700 s cap: 3 still running, 6 more past
9 minutes. Three causes, each seen in the traces:

1. *Wall standoff (bot fault).* A ranged bot walked straight at its target from any distance and only shot inside
   560 px; melee bots took the path beyond 260 px, ranged bots never did. With a wall between, it stood 650 - 880 px
   from an idle player (two runs) or from another ranged bot doing the same (one run) for the rest of the match.
   This is also round 7's "duel with life going up on both": nobody was being hit. People walk round a wall, so
   this one cannot stall them.
2. *Monsters before the last survivor (bot fault, slow rather than stuck).* With the survivors revealed, a bot still
   fought every pack that noticed it on the way (one bot went from level 17 to 23 in 100 s while the last player
   waited; that match took 11:06).
3. *Duel where recovery keeps up with damage (game rule, would stall people too).* After 1 and 2 were fixed, 4 of
   144 were still running at 700 s, all real duels. PvP damage is x0.4, so the hits in those duels were 3 - 11
   life each and 1.5 - 10 life a second in total, against 2 - 7 life a second of regeneration, a 67 - 204 energy
   shield that refills between hits, and flasks. A level-8 wand did 15 - 27 damage per 10 s to an axe player who
   regenerates 49 in that time and cannot catch a kiter of the same speed. Nothing in that is bot-specific.

Changes:
- `server/bots/bot.ts`: ranged bots take the path beyond 560 px; any bot that has not hurt its player target for
  5 s takes the path to it (shooting on the way when in range) instead of pushing straight at it; a path to a
  moving target is renewed as the target moves (it was kept for 6 s, so a bot ran to where the target had been);
  while the survivors are revealed only a monster already on the bot is fought.
- Sudden death, a server rule for cause 3 (`shared/constants.ts SUDDEN_DEATH_*`, `server/game.ts`): from 7:00 of
  fight, damage between players doubles every 60 s (x16 at most), with one feed line when it starts ("Sudden
  death: players hurt each other more" / "Nagła śmierć: gracze ranią się coraz mocniej"). It only touches matches
  already past the 5 - 7 min target. **A design choice made here, not asked for**: set `SUDDEN_DEATH_AFTER` out of
  reach to switch it off; cause 3 then comes back for bots and people alike.

| 15 players, 144 matches each (same seeds) | Still running at cap | Fight mean | Longest finished | Past 7:00 |
|---|---|---|---|---|
| Round-7 code (cap 700 s) | 3 | 6:08 (368 s) over the 141 that finished | 11:06 | 27 |
| Bot fixes 1 + 2 (cap 700 s) | 4 (all cause 3) | 6:18 over the 140 that finished | 11:17 | 40 |
| + sudden death + path renewal (cap 900 s) | 0 | 6:06 (366 s) | 9:52 | 35 |
| + camps (final code, cap 900 s) | 0 | 6:17 (377 s), median 6:08 | 8:59 | 35 |

Another 24 final-code matches in the truce sim also all finished (168 in total). A first version of fix 1 that
made ranged bots hold fire without a clear line was dropped: wooded ground blocked it so often that matches ran
30 s longer.
Other counts, final code: 20 players 7:05 (5:43 - 8:24, 16 runs; was 5:57 over 5 runs in round 7, see camps);
6 players 3:04 (12 runs); 3 players 4:22 (8 runs). No stall in any of them. Opening-truce hits before 40 s:
2.8 a match over 24 runs (5.0 in round 7), not looked into further.

**Camps per player (raised, about half restored).** Measured what the bots have when 4 are left and at fixed times:

| 15 players | Camps on the map | Fight mean | 4 left at | Level then | Items worn | Gear score | Level at 2:00 / 4:00 |
|---|---|---|---|---|---|---|---|
| Old map (26e6 + 11.5e6 per player), 48 runs | 86 (5.7 a player) | 7:48 | 5:53 | 12.1 | 6.1 | 111 | 6.9 / 9.0 |
| Small map before this round, 144 runs | 27 (1.8) | 6:06 | 4:12 | 8.4 | 4.1 | 58 | 5.1 / 7.5 |
| 3 a player (**taken**), 144 runs | 45 (3.0) | 6:17 | 4:37 | 9.9 | 4.9 | 79 | 6.0 / 8.4 |
| 4 a player, 48 runs | 60 (4.0) | 6:44 | 4:59 | 11.1 | 5.7 | 97 | 6.5 / 8.6 |
| 5.7 a player, 144 runs | 79 (5.3) | 6:56 | 5:04 | 11.4 | 5.7 | 93 | 7.0 / 9.3 |

(Gear score = the bots' own item score summed over worn items. All rows use this round's bots and sudden death.
The sim's camp count is about 10 higher than the map's: it includes the boss and trial packs.) Progression was
clearly thinner: 3.7 levels and about half the gear score down at the last fights; at equal times levels 17 - 26 %
and gear score about 40 % down. The camp count was not held down by `campArea` but by spacing: two spawn
clearings per player, each keeping camps 850 px away, left no room.
`shared/mapgen/generate.ts MAPGEN`: `spawnCampClearance 850 -> 600` (monsters notice from 260 - 440 px),
`campSpacing 600 -> 450`, new `campsPerPlayer: 3` as a floor on the camp count. Full restoration (5.7) costs 50 s
of match and puts the mean at the top of the band, so 3 was taken: +11 s, level +1.5 and gear +35 % at the last
fights. Map camps now: 2 players 22 (same), 6 players 28 (same), 10 players 35 (was 32), 15 players 45 (was 27),
20 players 60 (was 25). **Side effect: 20-player matches went from about 6:00 to about 7:00**; there the looser
spacing alone already gives 50+ camps, whatever the floor.

**Hint strip (fixed).** `client/firsthints.ts yieldFirstHints`, called from `hud/dock.ts updateDock`: the strip is
hidden while the inventory, character sheet, Skills panel, social panel or passive tree is open and comes back
when they close (its 40 s keep running). Seen live at 1280x720, Polish: hidden with each of C / G / I open,
back at the same place after (`up8-hints-yield-panels-open.png`).

**Round-end line (fixed).** `client/main.ts onSnap`: when the round ends the inventory, character sheet, Skills
panel and social panel close, so nothing covers the centred lines. The right-docked inventory was cutting the
end of the Polish line as well, so it closes too. Chat and the passive tree are left alone; a panel reopened
after that covers the line again. Seen live (`up8-roundend-panels-closed.png`).

Not verified: the sudden-death feed line in a browser (text and translation only read in code); sudden death,
camps 600 px from a spawn and the new camp counts with people; items 3 - 4 in English or at other sizes.

Seen on the way: `server/skills.ts blocked()` walks the whole obstacle list for every projectile step, and
player shots stop at water edges while monster shots (`blocksProjectile`) fly over them.

## Backlog (re-ranked after round 8)

| # | Item | Impact | Effort |
|---|------|--------|--------|
| 1 | See in a real two-player hall: match length with people, sudden death at 7:00 (felt? fair?), camps near spawns, 20 s results return, slot picker | high | small |
| 2 | PvP damage versus recovery: hits of 3 - 11 at x0.4 against 2 - 7 life/s regeneration plus a refilling energy shield; sudden death only bounds it. Decide whether duels should be decided sooner | high | medium |
| 3 | 20-player matches now about 7:00 (camps 25 -> 60): trim the camp spacing or floor for big halls, or accept | medium | small |
| 4 | Camps per player at 3 of the old 5.7 (gear at the last fights 79 against 111): 4 costs another 27 s; decide | medium | small |
| 5 | Opening truce still leaks about 3 stray hits a match; zero needs a server rule (no player damage for 40 s): decide | medium | small |
| 6 | Six-player matches run about 3 min: confirm that is wanted | low | small |
| 7 | Player shots stop at water edges, monster shots do not; `blocked()` scans every obstacle per projectile step | low | small |
| 8 | Leaver during a fight gets no kill-feed line (placement is recorded) | low | small |
| 9 | Boss bar: no marker for what the next phase does | medium | small |
| 10 | Hero: top-tier plate too bright, low-tier leather gloves/boots barely visible | low | medium |
| 11 | Faded-prop entries kept for props that leave the screen while faded | low | small |

- [x] No match left running in 168 (wall standoff, monsters before survivors, sudden death), camps per player 1.8 -> 3.0, hint strip yields to panels, round-end line uncovered (round 8)

## Round 9 — 2026-11-11 — upgrade loop: first-session walk, shots over water, projectile scan, unused props

Sims: Node, fast-forward, 1 idle human + bots, seeded (`scratchpad/up9/`: `msim.ts` as in round 8, `perf.ts`,
`water.ts`, `artscan.mjs`, `artmove.mjs`). No human match was played; nothing was run in a browser this round.

**A. First session with 2 - 4 friends, read from the code** (launcher -> menu -> hall -> match -> death -> results
-> hall). The path holds together: one link, name, Browse, Join, Ready, spawn pick, spectate after death, results,
20 s back to the hall, and the strings on it have Polish entries. What is missing or confusing, by impact / effort:

| # | Finding | Impact | Effort | State |
|---|---------|--------|--------|-------|
| 1 | Only ready players enter a match and the host can begin with 2 ready (a bot counts). A friend who has not clicked "Ready up" is left in the hall for the whole match (about 6 min) with chat only; the host saw just "(N ready)" | high | small | **fixed** |
| 2 | A friend who drops during the fight cannot come back: rejoin by tab id works in the countdown only (`hostruntime.rejoin`) | high | medium | open |
| 3 | Only public STUN: a friend behind a strict NAT (some mobile / carrier networks) cannot join at all, and the message ("needs a TURN server") is nothing a player can act on. Needs a TURN server (`HNS_ICE`) or at least plainer advice | high for those hit | medium (infrastructure) | open, owner |
| 4 | A friend who arrives while a match runs waits in the hall: no watching, and the practice arena is offered only between matches | medium | medium | open |
| 5 | Hall "Biome" list: "Random" always gives Hollowpine (`game.newMap` falls back to the prototype biome), and the two other biomes have no painted props or ground wired (`decor.ts`, `prewarm.ts` are Hollowpine only) | medium | small (hide the choice) / large (wire them) | open, owner |
| 6 | The launcher's file server sent every file again on each reload (`no-cache` with no validator), all of it through the host's upload | medium | small | **fixed** |
| 7 | Main menu shows "Dev: join this page's dedicated server" to everyone; under the launcher there is no such server ("Could not connect to a dedicated server.") | low | small | open (hiding it behind `?dev=1` changes the owner's dev flow: decide) |
| 8 | If the tunnel or the lobby process dies after the link is printed, the launcher window says nothing; new joins just fail | low | small | open |
| 9 | No invite link straight into the hall: every friend types a name, clicks Browse, clicks Join | low | small | open |
| 10 | First run downloads the tunnel tool (about 60 MB exe); antivirus / SmartScreen may ask. macOS gets no internet link | low | none | noted |

Fixed:
- 1: `client/menus/menus.ts renderRoom`: the host sees, under the Begin button, "Not ready yet: {names}. If you
  begin now, they sit this match out." / "Jeszcze niegotowi: {x}. Jeśli zaczniesz teraz, ten mecz ich ominie."
  (`i18n/pl_content.ts`) while any non-bot member is not ready. Nothing is blocked: an absent friend can still be
  left out on purpose. Translation checked through `tr()` in Node; **not seen in a browser** (needs a second person
  in the hall).
- 6: `lobby/server.ts`: files carry an ETag (size + mtime) and a matching `If-None-Match` gets an empty 304.
  Checked against `dist/lobby.js` on :4123: first GET of `art/index.json` 200 with 263,609 bytes, second 304 with
  0 bytes, wrong tag 200. Not checked through a tunnel or in a browser.

**B. Shots and water (fixed).** Map data has three cell kinds (open / wall / water) and obstacle circles of kind
rocks / ruin / tree / shrine / water; "water" circles are the rim of water cells and are the only kind that does not
block sight. Monster shots already used `shared/map.blocksProjectile` (wall cell or any non-water circle); player
shots used a private `blocked()` that stopped at every circle, water rims included, and ignored cell kinds.
`server/skills.ts updateProjs` now calls `blocksProjectile` too, so both fly over water and stop at walls and
props. Dash, blink and totem placement keep `blocked()` (a body cannot stand in water). Hollowpine, the prototype
biome, has no water at all (`waterChance: 0`), so this only shows when a host picks Gloamwater.
Check (`water.ts`, Gloamwater maps, 6 seeds, 485 - 699 water rim circles each): 190 straight lanes open ground ->
water -> open ground with nothing else on the line; the old rule stops the shot on all 190; now 185 reach the far
bank and the other 5 ended on a monster or player standing in the lane (within 26 px of the end point, which was
not blocked ground).

**C. `blocked()` cost (material, fixed with B).** 20 players, 3 matches, per 30 Hz host tick:

| | Tick mean | p99 | Projectile update share of the tick |
|---|---|---|---|
| Before (linear scan of 5,463 - 5,765 obstacles, 54 - 58 µs a call) | 0.65 - 0.74 ms | 1.58 - 2.00 ms | 28 - 45 % |
| After (grid lookup, about 0.05 µs a call) | 0.37 - 0.44 ms | 0.86 - 1.21 ms | 3.6 - 4.1 % |

Above the 10 % line, so it was changed; in absolute terms the host tick was never near its 33 ms budget in Node.
`blocked()` itself (dash / blink / totem, a few calls a cast) now uses `forObstaclesNear` with the same test.

After B + C, 24 fifteen-player matches (seeds 1000 - 1007, 2000 - 2007, 3000 - 3007, cap 900 s): 0 still running,
fight mean 6:19 (379 s), 3:50 - 8:24 (round 8: 6:17 over 144).

**D. Unused props (193 moved, 13.4 MB).** Props are only drawn through the pick lists in
`client/gfx/sprites2d/decor.ts` ("prop_hollowpine_" + name, or an fx_ decal). `artscan.mjs` took every prop in
`public/art/index.json` and looked for its id, its short name or its path as a literal anywhere in `src/`,
`public/*.html` and `scripts/` (outside the art generators), then again in the built bundles: 242 of 665 props are
referenced, 423 are not.
- Moved: the 193 unreferenced `prop_hollowpine_*` folders -> `art/unused/prop/` (one PNG each, 13.42 MB), and their
  193 entries dropped from `public/art/index.json` (320 -> 264 KB). `public/` went from 136.7 to 122.6 MB. After the
  move every index entry has its file and all 246 ids in the decor lists still have art.
- `scripts/art/import.mjs`: a static whose folder exists under `art/unused/<kind>/` is skipped, so `npm run art`
  does not copy these back from `art/out` (delete the folder there to ship one again). **The importer was not
  run**; that line is syntax-checked only.
- Left alone, also unreferenced by code but whole sets rather than filler: `bs_*` 102 files 8.8 MB (Brokenspire),
  `gw_*` 104 files 8.3 MB (Gloamwater), `prop_shrine_*` 24 files 1.8 MB (one per shrine buff). Another 19 MB if
  they are parked too: a decision for the owner.
- Images load only when drawn, so friends never downloaded these files; the saving is in the folder / zip.

Not verified: anything in a browser this round (the not-ready line, shots over water as seen by a player);
the importer skip; the ETag through the tunnel.

## Backlog (re-ranked after round 9)

| # | Item | Impact | Effort |
|---|------|--------|--------|
| 1 | See in a real two-player hall: match length with people, sudden death at 7:00, camps near spawns, 20 s results return, slot picker, the new not-ready line | high | small |
| 2 | PvP damage versus recovery (hits of 3 - 11 at x0.4 against 2 - 7 life/s regeneration plus a refilling energy shield); sudden death only bounds it: decide | high | medium |
| 3 | A friend who drops during the fight cannot rejoin (countdown only) | high | medium |
| 4 | Strict-NAT friends cannot join: TURN server or plainer advice in the message: decide | high for those hit | medium |
| 5 | Hall biome list: "Random" is always Hollowpine and the other two biomes have no painted art wired: hide the choice or wire them (their 206 props are in `public/art/prop`) | medium | small / large |
| 6 | Late arrival waits out the match with chat only: allow practice or watching | medium | medium |
| 7 | 20-player matches about 7:00 (camps 25 -> 60): trim for big halls or accept | medium | small |
| 8 | Camps per player at 3 of the old 5.7: 4 costs another 27 s; decide | medium | small |
| 9 | Opening truce still leaks about 3 stray hits a match; zero needs a server rule: decide | medium | small |
| 10 | Park `bs_*`, `gw_*`, `prop_shrine_*` props too (19 MB) until they are wired: decide | low | small |
| 11 | "Dev: join this page's dedicated server" link on everyone's main menu | low | small |
| 12 | Launcher is silent when the tunnel or lobby process dies | low | small |
| 13 | Invite link straight into the hall | low | small |
| 14 | Six-player matches run about 3 min: confirm that is wanted | low | small |
| 15 | Leaver during a fight gets no kill-feed line | low | small |
| 16 | Boss bar: no marker for what the next phase does | medium | small |
| 17 | Hero: top-tier plate too bright, low-tier leather gloves/boots barely visible | low | medium |
| 18 | Faded-prop entries kept for props that leave the screen while faded | low | small |

- [x] Host sees who is not ready, launcher file server answers 304, player shots fly over water like monster shots, projectile obstacle scan off the tick (28 - 45 % -> 4 %), 193 unused props parked (13.4 MB) (round 9)

## Round 10 — 2026-11-11 — upgrade loop: rejoin during the fight, biome choice hidden, launcher says what died, dev link gated

Sims: Node, headless HostRuntime (`scratchpad/up10/`: `rejoin.ts`, `msim.ts` as in round 8/9). One short solo
headless-Chrome look at the menu and the hall (lobby server :4123, dedicated server :4124, all stopped again).
No human match was played and no tunnel was started.

**1. Rejoin during the fight (done).** A player (not a bot) whose connection closes while the fight is on keeps
their hero in the match for `REJOIN_GRACE` = 75 s (`net/hostruntime.ts`).
- `HostRuntime.close` -> `holdHero`: the player record is moved to a closed placeholder connection
  (`GameHost.moveConn`, `server/host.ts`); the hero has no inputs, so it stands where it was, and it is hit, killed
  and looted like anyone. The hall member is removed as before. Hall line: "{name} lost the connection: their hero
  waits 75 s for them".
- Coming back: `r-hello` with the same per-tab `rid` the countdown rejoin already used (sessionStorage `hns-rid`:
  survives a reload in the same tab, not a new tab or browser). `rejoin` hands the record to the new connection:
  `r-go`, then `welcome` with the old player id, and the map, stats, inventory, progression, skill bar and ground
  item details are sent again (`resendBar` in `server/skills.ts`, `progResend` in `server/progression.ts`); the input
  ack restarts at 0. A returning player is let in even when the hall is full.
- Grace over (`tickAway`): the hero dies through the normal `onPlayerKilled` (loot spills, kill line with
  "a lost connection" as the killer, a place; the results row is marked "left"). The dead record stays until the
  match ends, so the player can still come back and watch.
- Dead players who drop (or who are killed while away) are parked the same way and come back as spectators.
- Unchanged: a drop in the countdown (fresh hero through the old path), `r-leave`, a kick (hero removed at once),
  bots.
- Client (`client/menus/menus.ts onDisconnected`): a guest who drops out of a running match reads "Lost the
  connection to the host. If the hall is still open, join it again within 75 seconds to get your hero back."
  instead of "The host left: the match is over." (the 75 is written into the string: change both together).
  Polish entries added for the new lines and for two older ones that had none ("Lost the connection to the host.",
  "The host left: the match is over.").

Check (`rejoin.ts`, 5 humans + 1 bot, 30 checks, all pass): A drops alive, stands still 20 s at (1094,672),
reconnects: same record and id, `r-go` + welcome/map/stats/inv/prog/bar, new inputs move it (x 1094 -> 864, ack
30), old connection ignored, still alive 80 s later. B drops and stays away: alive at 74 s, dead at 75.0 s, place
#6 "left", ground items 4 -> 10; B then reconnects as a spectator. C dies, drops, reconnects: spectating, can
cycle the target. D is killed while away: spectator. All four got `r-end`; nothing parked after the match;
rematch, countdown rejoin and kick behave as before; host alone after four drops: match ends 87 s later.
Bot matches after the change: 12 fifteen-player matches (seeds 1000 - 1005, 2000 - 2005, cap 900 s): 0 still
running, fight mean 6:11 (371 s), 4:19 - 8:42 (round 9: 6:19 over 24).

**2. Biome choice hidden (done).** `client/menus/menus.ts`: `SHOW_BIOME = false` drops the Biome row from the
hall rules (host select and guest read-out) and the Biome column from the lobby browser. Settings, protocol and
`game.nextMap.biome` are untouched; flip the constant when a second biome is wired. Seen in headless Chrome
(`scratchpad/up10-hall-no-biome.png`): rules show hall name, map size, max players.

**3. Launcher says what died (done).** `scripts/play-with-friends.mjs`: after the link block, an exit of the lobby
process or of the tunnel prints a boxed notice (what stopped, who can no longer connect, that a running match /
players already in the hall go on, restart the launcher), and the launcher stays up so the text stays on screen.
Ctrl+C / closing the window stays silent. Checked with `--no-tunnel --no-build --no-open` on :4123 by killing the
lobby child: "THE GAME SERVER STOPPED (exit code 1) ..." appeared. **The tunnel notice is read from the code only**
(no tunnel was started).

**4. Dev link gated (done).** The dedicated server (`server/index.ts`) answers `GET /dedicated` with 204; the
main menu shows "Dev: join this page's dedicated server" only when that probe answers 204 or under `?dev=1`.
Headless Chrome: launcher's lobby server (404) -> link hidden (`scratchpad/up10-menu-no-dev-link.png`); dedicated
server (`tsx src/server/index.ts`, the `npm run dev` server) -> link shown without any parameter; `?dev=1` -> shown.

Not verified: rejoin in real browsers over WebRTC (how long the host takes to notice a dead peer, what the
returning player's screen looks like on the first frames, the spectator view after a reconnect); the new
disconnect line on screen; the tunnel-death notice. Seen in passing, not fixed: in Polish the hall still shows
"GATHERED 1/20" and the first two hall chat lines in English.

## Backlog (re-ranked after round 10)

| # | Item | Impact | Effort |
|---|------|--------|--------|
| 1 | See in a real two-player hall: match length with people, sudden death at 7:00, camps near spawns, 20 s results return, slot picker, the not-ready line, and now a real drop + rejoin (close the tab's network, rejoin within 75 s) | high | small |
| 2 | PvP damage versus recovery (hits of 3 - 11 at x0.4 against 2 - 7 life/s regeneration plus a refilling energy shield); sudden death only bounds it: decide | high | medium |
| 3 | Strict-NAT friends cannot join: TURN server or plainer advice in the message: decide | high for those hit | medium |
| 4 | Late arrival waits out the match with chat only: allow practice or watching | medium | medium |
| 5 | Rejoin only works from the same tab (sessionStorage rid): a crashed browser or another device cannot take the hero back. Name-based or localStorage token: decide | medium | small |
| 6 | 20-player matches about 7:00 (camps 25 -> 60): trim for big halls or accept | medium | small |
| 7 | Camps per player at 3 of the old 5.7: 4 costs another 27 s; decide | medium | small |
| 8 | Opening truce still leaks about 3 stray hits a match; zero needs a server rule: decide | medium | small |
| 9 | Polish gaps in the hall: "GATHERED n/20", "Your hall is listed in the lobby browser. Waiting for players…" | low | small |
| 10 | Wire Gloamwater / Brokenspire art and turn `SHOW_BIOME` back on, or park `bs_*`, `gw_*`, `prop_shrine_*` (19 MB): decide | medium | large / small |
| 11 | Invite link straight into the hall | low | small |
| 12 | Six-player matches run about 3 min: confirm that is wanted | low | small |
| 13 | A waiting (dropped) hero has no marker over its head; other players cannot tell it from an idle one | low | small |
| 14 | Boss bar: no marker for what the next phase does | medium | small |
| 15 | Hero: top-tier plate too bright, low-tier leather gloves/boots barely visible | low | medium |
| 16 | Faded-prop entries kept for props that leave the screen while faded | low | small |

- [x] Rejoin during the fight (75 s grace, same hero, spectator if dead), biome choice hidden, launcher reports a dead lobby / tunnel process, dev link only on a dedicated server or `?dev=1` (round 10)

## Gameplay round 1 — 2026-11-11 — game feel: lost taps, weightless own hits, loot that just appears

Survey: code read (`client/main.ts` input loop, `shared/sim.ts`, `server/combat.ts`, `client/render.ts onEvents`) and a solo
headless-Chrome session on a scratch dedicated server (`scratchpad/gp/`).

| Problem | Evidence | Change | Before -> after |
|---|---|---|---|
| A press made while the hero is busy is thrown away. Input was the held state sampled 30 times a second, nothing else | Code: `stepPlayer` starts an attack only if `atkCd <= 0` on that tick; a sword swing blocks for 647 ms | `client/input.ts` `taps`, `client/main.ts` `bufferedSkills` / `bufferedDodge`: a fresh press of a skill slot or dodge is kept 300 ms (`TAP_BUFFER_MS`) and sent on the first free tick | Tap attack, tap again 430 / 507 ms into the swing: 1 swing (from the code) -> 2 swings, second starts 665 ms after the first (back to back). Tap 153 ms in: still 1 (expired, intended). Dodge tapped 909 ms after a roll (cooldown 1.1 s): 1 roll -> 2. Five 8 ms taps: 5 swings |
| Tapping a skill while holding attack did nothing: the lowest held slot always won, and slot 0 is the attack | `skillbar.ts heldSlot` | The newest live tap wins over held slots (`main.ts inputStep`) | Hold attack 3.5 s + one tap on Q (Stormvault): 0 casts (from the code) -> 1 cast |
| Your own hits had no weight on the screen: flash, slide and numbers existed, but no hit-stop and no camera response (shake only when you were hit) | `render.ts`: `shake` set only for `self` and `boom`; hit-stop only for PvP kills (`gore/index.ts`) | `main.ts hitStopEvents`: the picture holds after the frame that shows the impact: 26 ms a hit, 52 ms a crit or a quarter-life hit, 46 ms a monster kill, 72 ms an elite kill, at most one hold per 200 ms; `render.ts` `OWN_HIT_SHAKE` 1.1 px / 2.2 px heavy. Both follow Options > Graphics > Screen shake | Frame holds measured in Chrome (frames with no draw calls): none -> 30, 31, 31, 30 ms on a Cragback (1.9% of the fight), 62, 37, 69, 23 ms killing a Gnashling (6.1%) |
| Damage numbers faded in at one size | `render.ts` floats | 20% larger for the first 120 ms | read from the code only |
| Loot appeared on the ground in one frame | `render.ts drawGroundItem` | A fresh drop hops out over 0.34 s (13 px arc, spin, grows from 55%), its rarity disc fades in, magic and better get a ring glint on landing (`DROP_*` constants). Items already lying there when you arrive do not hop | `scratchpad/gp1-loot-drop.png`: fade-in and the rare glint are visible; the arc itself is too short to catch in a still |

Not verified: how any of this feels in the hand (hit-stop lengths, shake size, 300 ms buffer); guests over WebRTC (a
buffered tap is sent on two ticks; the shortest use is 0.12 s, so it cannot fire twice, but that is reasoning, not a test).

## Gameplay round 2 — 2026-11-11 — loop pacing measured; glued feet after a hit; swing sound timing

Sim: `scratchpad/gp/lsim.ts`, 15-player bot matches fast-forwarded (8 seeds), bots as stand-ins for players.

| Measure | Value |
|---|---|
| First hit dealt / first monster kill / first item taken | 4 s / 5 - 8 s / 10 - 23 s (median per match) |
| Level 2 / 3 / 4 / 5 / 6 / 8 (median) | 8 s / 22 s / 40 s / 60 s / 100 s / 200 s |
| Monster time to kill | 3.5 - 4.8 s, 3 - 5 hits; elite 8 - 15 s |
| Gap between two fights (4 s without a hit) | median 7 - 9 s, 90th percentile 19 - 36 s |
| Share of time within 3 s of a hit, per 30 s of the match | 57 - 65% at the start, 65 - 85% at 1 - 2.5 min, 35 - 60% from 2.5 to 4.5 min (nearest living monster 1000 - 2200 px away = 4 - 10 s on foot), 85 - 100% after that |
| Player-versus-player time to kill | median 5 - 34 s by match, single fights up to 100 s |
| Last five alive -> end / last two -> end | 80 - 150 s / 4 - 103 s |
| Monsters still alive at the end | 20 - 80 of 100 - 145 |

Reading: the opening is quick and the level curve is even. The match sags in minutes 3 - 4: nearby camps are gone, nobody
is on the map yet, and about half of all monsters are never fought. Player fights have a long tail. Neither was changed
here: the first is map and reveal timing tuned in rounds 7 - 8, the second is damage against recovery (balance agent).

| Problem | Evidence | Change | Before -> after |
|---|---|---|---|
| Feet glued for the whole animation after the hit has landed | `sim.ts`: move speed x`swingMoveMult` (0.15 - 0.5) while `atkT > 0`; the hit lands half-way, so a sword holds you at 30% speed for 330 ms after contact, a maul at 15% for 675 ms | `shared/constants.ts` `ATTACK_RECOVER_TAIL` 0.2 s, `ATTACK_RECOVER_MOVE` 0.8; `sim.ts`: the last 0.2 s of any attack or skill use moves at 80% speed at least. Facing stays locked. Shared by server and prediction | Holding a direction through one swing (`scratchpad/gp/mv.ts`): sword 46 -> 74 px, 667 -> 433 ms under half speed; dagger 48 -> 69 px; maul 47 -> 84 px. Match length over 8 seeds: 388 s -> 396 s mean (noise; the balance agent was editing at the same time) |
| Swing sound ends before the hit | `audio/game.ts`: the whoosh (0.1 - 0.34 s long) started with the wind-up; the hit lands at 50% of the swing: a sword had 110 ms of silence before the impact, a maul 375 ms | The whoosh is delayed so it ends on the hit (`SWING_SFX_LEN`) | Delay 0 -> 0.10 s sword, 0 dagger, 0.46 s maul. Not listened to |

Not verified: whether 80% for 0.2 s is enough to be felt, or too kind to kiting with a spear; the sound by ear.

## Gameplay round 3 — 2026-11-11 — Stormvault landing, pickup

| Problem | Evidence | Change | Before -> after |
|---|---|---|---|
| Stormvault lands as six thin white lines | `gfx/skills.ts crackle` | `thunderclap`: lit disc, a ring racing out, eight forked arms that re-strike every 50 ms with a violet body and a glow at each tip, sparks, a scorch mark | `scratchpad/gp3-vault-strip.png` (after only; four frames about 100 ms apart) |
| Taking an item: it vanishes, a sound plays | `render.ts` | A puff of 7 - 16 particles in the item's rarity colour flies from the item into the hero (0.2 - 0.4 s) | `scratchpad/gp3-pickup.png`, first frame. It also plays when someone else takes an item within 130 px of you |

Round 4 not run: what is left needs hands on the keys or belongs to balance.

Still hurting, ranked:
1. Player fights run 5 - 100 s and the last two can take over 1.5 min: recovery against the damped PvP damage (balance).
2. Minutes 3 - 4 are the slow part of a 15-player match; half the monsters are never fought. Earlier reveal / earlier
   bot hunting would close it but shortens the match: decide with real players.
3. Skill wind-ups are long (Sundering Blow with a sword: hit at 0.59 s of 0.96 s; Faultline Slam 0.83 s of 1.16 s) and
   only a roll cancels them; nobody has felt them in a fight yet.

- [x] Gameplay rounds 1 - 3: buffered taps (newest tap beats held slots), hit-stop and camera nudge on own hits, loot hop and pickup puff, 0.2 s follow-through at 80% speed, swing sound ends on the hit, Stormvault thunderclap

## Gameplay round 4 — 2026-11-11 — the slow middle of the match

Sims: `scratchpad/gp/lsim.ts` (16 seeds, one 15-bot match each) and the balance harness (`scratchpad/balance/`, 64 matches a run;
two identical runs differ by about 16 s of mean length). Bots stand in for players.

Finding: the sag is not walking. In minutes 3 - 4, 60 - 85% of the bots held a player target about 300 px away without
landing a hit (two bots circling each other), the rest roamed at random. Monsters left over were about ten outer camps,
the elite camps near the centre, shrines and the boss.

| Problem | Evidence | Change | Before -> after |
|---|---|---|---|
| Bots stand off against each other instead of fighting or farming | lsim: share of time within 3 s of a hit `56 66 71 61 52 56 64 66 %` per 30 s; nearest living monster 860 - 1300 px mid-match; 62 monsters alive at the end | `server/bots/bot.ts` `CHASE_GIVE_UP_MS` 7 s, `CHASE_IGNORE_MS` 15 s: a player target that took no damage for 7 s is dropped and not picked again for 15 s (not in the endgame). Before the random roam a bot now walks to the nearest camp spot it has not seen empty | Same seeds: `60 60 71 67 66 65 70 71 %`; nearest monster 550 - 720 px; 31 monsters left; monster kills per player 13.7 -> 16.9; mean length 352 -> 358 s. 64 matches: 371 -> 356 s, over 7:00 23% -> 14%, 0 stalls, level at 4:00 8.1 -> 8.7 |
| A player with nothing nearby gets no hint where the next fight is (camps are on the minimap only) | Code: nothing on screen points at a camp | `client/hud/minimap.ts` `drawCampHintHud`: in the fight, with no living monster within 700 px for 2.5 s and no waypoint set, an arrow at the screen edge with the tent glyph and the distance points at the nearest camp not seen emptied (red, amber for an elite camp). Gone as soon as a monster is near or the camp is on screen. No new text | `scratchpad/gp4-camp-pointer.png` (solo dev session). First build never drew: the "last survivors" list is an empty array, not null; fixed and re-shot |

Rejected: 4 s give-up (5 of 16 matches over 7:00); keeping bots out of the boss arena below a level (no change in boss deaths).
Cost: bots farm more, so more of them die to monsters: 41% -> 46% of deaths, Matriarch kills 76 -> 105 per 64 matches.

Not verified: whether real players stand off like bots at all (the bot rule changes bots, not the game); whether the arrow
reads as "camp" and is not noise in a real match.

## Gameplay round 5 — 2026-11-11 — skill wind-ups

PoE2 check: a roll cancels a skill, moving does not. Movement cancel rejected here too: with WASD the move keys are held
while casting, so they cannot mean "stop".

| Problem | Evidence | Change | Before -> after |
|---|---|---|---|
| The two heavy melee skills hit late | Sword: Sundering Blow hits at 0.59 s of 0.96 s, Faultline Slam at 0.83 s of 1.16 s (`time` x swing time x `commit`) | `shared/content/gems.ts`: Sundering Blow `time` 1.45 -> 1.25, `commit` 0.62 -> 0.58; Faultline Slam 1.75 -> 1.5, 0.72 -> 0.62; Rending Chop `commit` 0.65 -> 0.55 | Sword: Sundering 0.48 s of 0.83 s; Faultline 0.61 s of 0.99 s. Maul: Sundering 1.21 -> 0.98 s, Faultline 1.70 -> 1.26 s |
| Rolling out of a wind-up cost the full mana and cooldown for nothing | `server/skills.ts stepPending`: the pending hit was dropped, cost kept | A roll before the first hit gives the mana back and clears that skill's cooldown | Probe `scratchpad/gp/wind.ts`: mana back to full, cooldown 0 after the roll (was: mana spent, cooldown running) |

Not verified: feel in the hand; whether free cancels get abused as a feint against players.

## Gameplay round 6 — 2026-11-11 — skill numbers, results screen labels, monster scaling seen in a client

Skill numbers: `docs/BALANCE.md`, "Skill numbers". Short version (128 matches each, same bot code): skills 24.2 -> 27.0
damage per second of use and 1.69 -> 2.02 per mana against 13 for basic attacks; the weakest skill went from 12 to 21,
Pyre Effigy from 77 to 54; matches 358 -> 331 s, reaching sudden death 20% -> 10%, 0 stalls.

| Problem | Evidence | Change | Before -> after |
|---|---|---|---|
| Ground loot labels drew over "Click or press any key to continue" on the results screen | `render.ts`: the banner claimed the label lane down to `top + 27`, the line sits at `top + 30` | `client/render.ts` (phase "ended"): lane claim down to `top + 40`, backing band 34 -> 44 high | `scratchpad/gp6-results-labels.png`: ten items dropped under the banner, every label sits beside or below it |
| Monster scaling to the waking player never seen with a levelled hero | - | none | Solo dev session, hero set to level 8, camp of level 1 monsters woken: Barkgnaw 46 -> 93 life, 6.0 -> 9.7 damage; magic Barkgnaw 117 -> 236; Sapspitter 34 -> 69; all show level 8 on the server. Matches `monsterLevelScale(8)` (x2.02 life, x1.62 damage). `scratchpad/gp6-scaled-camp.png` |

Seen on the way: the client shows no monster level anywhere, so the player cannot see that a camp scaled. The naked level 8
hero died to that level 8 camp in about 10 s (expected without gear; not a finding about balance).

Still hurting, ranked:
1. Player fights against each other: bots circle without landing hits for long stretches; with real players this is
   either kiting that works too well or nothing at all. Needs people.
2. More farming means more deaths to monsters (about 48% of deaths, the Matriarch first). A third of matches end under 5:00.
3. Ranged basic attacks hit a third of the time and deal 7 damage per second; bow and wand skills were raised but the
   basic attack still does 12% of all damage by volume alone.

- [x] Gameplay rounds 4 - 6: bots drop a player they cannot hit and walk to unvisited camps, edge arrow to the nearest camp when nothing is near, earlier hits on Sundering Blow / Faultline Slam / Rending Chop, roll-cancel refunds mana and cooldown, skill numbers pass, results screen labels clear of the banner, monster scaling confirmed in a client

## Gameplay round 7 — 2026-11-11 — who dies to monsters, and why (bot behaviour first)

Baseline, 128 matches of 15 bots: 47.9% of deaths were to monsters (6.7 per match): exiles 1.96, boss 1.70 (+0.37 to
its adds), ordinary packs 1.71, shrine guards 0.88. Every death was logged with level, killer, distance to the lair, the
bot's goal and the last minute of its positions. Details and the before/after table: `docs/BALANCE.md`, "Monster lethality".

| Problem | Evidence (baseline) | Change | Before -> after (64-128 matches) |
|---|---|---|---|
| Bots gathered and fought inside the boss's reach | 66% of boss deaths at level 8 or lower; median 573 px from the lair; 65% within 6 s of a player fight; 89% of the damage was sap volleys, not the telegraphed attacks. The late-game gathering ring was 450 px round the map centre, the lair sits 300-420 px off it | `bots/bot.ts`: `BOSS_MIN_LV` 13 (was 9 for boss hunters, none for the rest); gathering point moved out of reach while the boss may live (`pickRoam`); no camps, monsters, loot or player targets inside the arena before the bot is ready (`pickTarget`); back out when it wakes (`think`) | boss deaths 1.70 -> 0.55 per match |
| Bots still cut through the arena on the way somewhere, and sidestepped shots into it | Position traces: 1000 px -> 300 px in 5 s with a camp goal on the far side or while "dodging" | `bot.ts moveDir`: an unready bot never steps deeper inside 700 px of the lair; it goes round the rim. (A route cost in `path.ts` was tried first and removed: no effect, the walk code cut the corner anyway) | included above |
| Bots traded blows with packs until dead | Deaths to packs took 25-36 s from 80% life, with 7-8 monsters near and no flask use left in 85% of them | `bot.ts think`: under 30% life with no flask use, back off from anything chasing, except one hurt normal monster; such a bot only starts on single normal monsters | pack + shrine deaths 2.59 -> 2.47 per match (noise); the gain went to fewer boss deaths, see below |
| Bots did not step off a shot's line | Sapspitter was the top ordinary killer (1.71 per match) | `bot.ts projDodge`: sidestep a monster projectile that would pass within 34 px in the next 0.8 s; 45-95% of shots are read, by bot skill. Line telegraphs: step sideways out of the lane, not along it | sapspitter deaths 1.71 -> 1.19 |
| Bots under level 10 picked fights with exiles | Level 1-5 bot that fought one: died 35%, won 1% | `bot.ts`: `EXILE_MIN_LV` 10: not targeted, and run from when one is on the bot | exile deaths 1.96 -> 1.34; a level 1-5 bot an exile reaches still dies 30% |
| Two finalists kept apart (1 stall in 64, twice) | Seed 6001: two alive from 380 s to the 700 s cap. The new retreats also applied to the last survivors | The last survivors (endgame reveal) skip the boss and low-life retreats; a finalist standing inside the arena is hunted there | 0 stalls in the 128 matches since |
| Matches got longer once fewer bots died to monsters | 8.5 alive at 4:00 against 5.6; reaching sudden death 16% -> 30% | `shared/constants.ts`: `BOT_LATE_SECS` 270 -> 240 (when bots stop farming and hunt). A bot constant, not a game rule | reaching sudden death 30% -> 15%; under 5:00 6% -> 11% |

Bot behaviour or real lethality: the boss was bot behaviour (walking in under-levelled, fighting each other next to it).
Ordinary packs are slow attrition, about half of it during a player fight; no single hit above 14% of the pool. Exiles are
real: not scaled to the player, a top hit of a third of a level 5 player's life and shield, faster than most players.

## Gameplay round 8 — 2026-11-11 — re-measure; no monster number changed

128 matches per arm (two sets of 64 with different seeds; the two halves of each arm differ by up to 17 s on the mean and
8 points on the tail shares).

| | Target | Before | After |
|---|---|---|---|
| Deaths to monsters | at most 35-40% | 47.9% (6.70 per match) | 32.7% (4.58) |
| Top monster killer | - | exile 1.96, sapspitter 1.71, Matriarch 1.70 | exile 1.34, sapspitter 1.19, barkgnaw 0.56, Matriarch 0.55 |
| Mean / median length | 5:00-7:00 | 329 / 324 s | 362 / 360 s |
| Under 5:00 | at most 20% | 38% | 11% |
| Reaching sudden death (7:00) | under 20% | 15% | 15% |
| Stalls | 0 | 0 | 0 |
| Level at 2:00 / 4:00 / 6:00 | - | 6.3 / 8.9 / 12.7 | 6.1 / 8.0 / 11.3 |

Decision: all targets are met by bot behaviour alone, so no monster, exile or boss number was changed. The "always a
challenge" check after the change: a normal pack costs 4% / 3% of life at level 1-5 / 6-10 (bots leave 14% / 33% of them
unfinished), an elite pack 27-33% / 17-27%, and bots clear only a third of the elite packs they start.

Side effect: bots farm about one level less by 4:00 (8.9 -> 8.0), because the camps round the lair are off limits to them
until level 13 and weak bots back off instead of dying mid-pack.

Still hurting, ranked:
1. Exiles against low levels are real lethality: a level 1-5 bot an exile reaches dies 30% of the time and wins 1%, and
   running does not shake it (exile speed 150-240 against the player's 230, it heals 30% under half life). No number was
   changed because the overall target is met; the owner question in `docs/BALANCE.md` stands.
2. Bots do not beat the boss in a real match (about 310 fights started in 128 matches, 1 won, a third of them fatal even
   at level 11-15), and it still kills 0.55 players per match, 84% of them in the late game next to a player fight. Whether the lair should sit 300-420 px from where the
   match ends is a map question.
3. Bots at low life with no flask use walk about for a minute or more: players have no life regeneration and charges
   come only from kills. With people this is either a tense stretch or a dead one. Needs people.

- [x] Gameplay rounds 7 - 8: bots keep out of the boss arena until level 13 and go round it, back off at low life, step off shots, leave exiles alone under level 10; deaths to monsters 48% -> 33%, matches under 5:00 38% -> 11%, 0 stalls; no monster number changed

## Gameplay round 9 — 2026-11-11 — rogue exiles on the level curve

Measured on the new open maps (walkable ground about 37% -> 55%, landed mid-pass): baseline and result use the same map
code, 128 matches of 15 bots per arm. A new recorder logs every exile-player meeting (level, hits, damage, outcome).

| Problem | Evidence (baseline) | Change | Before -> after |
|---|---|---|---|
| Exiles met every level at full strength | Gear of item level 8-17 from the first second: 354 life, 33 damage on average. With the bot rule switched off, a level 1-5 bot an exile damaged died 39% and won 6%; one that fought back (3+ hits) died 31%, won 17% and had lost 75% of its life when it won | `shared/content/monsters/exiles.ts`: `EXILE_LEVEL` 8, the level the rolled gear stands for. `server/ai/hooks.ts`: an exile starts at level 1 and `scaleToPlayer` raises it to whoever wakes it, on the same `monsterLevelScale` curve as every monster (also when a hit from outside its sight wakes it) | level 1-5, damaged by one: died 39% -> 13%, won 6% -> 22%; fought back: died 31% -> 9%, won 17% -> 45%, life lost by winners 75% -> 61%. Exile at level 1-5: 218 life, 23 damage; at 11-15: 426 / 34 (was 349 / 31); at 16+: 613 / 52 |
| It healed while chasing | 30% of its life every 9 s under half life, also when the player had backed off | `server/ai/exiles.ts exileStep`: it drinks only while it is being hit (hit in the last 4 s) | part of the numbers above |
| Bots under level 10 never fought one | `EXILE_MIN_LV` 10 hid the problem: 7 fights in 128 matches at level 1-5 | `server/bots/bot.ts`: the level rule is gone. A bot leaves an exile alone under 60% life (as before) and runs from one that is on it under 40% (`EXILE_FLEE_HP`) | 235 fights at level 1-5 in 128 matches; exile deaths per match 1.17 -> 1.17 with bots now fighting them (2.72 when they fought the old exile) |

Escape: no leash change was needed. Exiles already give up 650 px from their spot or after 3 s out of reach. A bot that
was damaged and ran (0-2 hits back) got away 83% of the time before and 79% now, in 7-10 s; these are now hurt bots
(under 40% life) instead of every bot under level 10, so the two numbers are not the same group. Tried and dropped:
reference level 10 (level 1-5 fighters won 53%, too soft) and 7 (died 31%), 32 matches each.

## Gameplay round 10 — 2026-11-11 — the low-life, no-flask stretch

PoE2 answer: life does not regenerate; flasks refill from kills and at wells and checkpoints. This game has kills only,
and no wells. A new recorder samples every living player twice a second.

| Problem | Evidence (baseline, 128 matches) | Change | Before -> after |
|---|---|---|---|
| Hurt with an empty flask, nothing to do but wait for a safe kill | 15.8% of all living player time was under 30% life with no flask use (594 player-seconds per match); 3.1 stretches per match longer than 60 s, the longest tenth over 80 s | `shared/constants.ts`: `FLASK_TRICKLE_DELAY` 6 s, `FLASK_TRICKLE_PER_SEC` 0.5. `server/damage.ts` (defence tick): a flask with less than one use left gains charges while its owner has taken no damage for 6 s, up to one use and no further. Flask tooltip line "Refills to one use while you take no damage" when it is out of uses (`client/hud/belt.ts`, Polish in `client/i18n/pl.ts`) | 15.8% -> 10.4% of living time; stretches over 60 s 3.13 -> 0.08 per match, over 30 s 5.24 -> 2.36; longest tenth 80 s -> 28 s; flask uses per player 4.0 -> 5.3 |

Why this one: it is the stand-in for the well (one sip, earned by getting out of the fight), it adds no object to the
map, and it cannot stack: more than one use still needs kills. Rate 0.25 was tried on 32 matches: 12.3% of living time
and 0.59 stretches over 60 s per match. The 10% that is left is mostly the wait itself (at most 26 s from empty).

Targets after both rounds, 128 matches per arm, same (new) map code:

| | Target | Before | After |
|---|---|---|---|
| Deaths to monsters | at most 35-40% | 22% (3.14 per match) | 22% (3.08) |
| Exile / pack / shrine / boss deaths per match | - | 1.17 / 1.06 / 0.55 / 0.22 | 1.17 / 1.07 / 0.41 / 0.30 |
| Mean / median length | 5:00-7:00 | 390 / 380 s | 370 / 369 s |
| Under 5:00 | at most 20% | 5% | 10% |
| Reaching sudden death (7:00) | under 20% | 28% | 16% |
| Stalls | 0 | 0 | 0 |
| Level at 2:00 / 4:00 / 6:00 | - | 6.1 / 7.7 / 11.1 | 6.9 / 9.2 / 12.8 |
| Under 30% life with no flask use, share of living time | - | 15.8% | 10.4% |

The baseline broke the sudden-death target before any change of this pass: 28% on the new maps, 23% on the old maps
with the same code (128 matches each; last pass reported 15%, and a re-run of last pass's own build gave 19%). Sets of
64 are not repeatable by seed: the same seed gives a different match each run. After the two rounds it is 16%
(16% and 17% in the two halves); round 9 alone, before the trickle, gave 20%.

Open maps alone (same code, 128 matches each, old -> new map): mean 380 -> 390 s, under 5:00 6% -> 5%, sudden death
23% -> 28%, stalls 0 -> 0, deaths to monsters 29% -> 22% (4.00 -> 3.14 per match; boss 0.52 -> 0.22, packs 1.33 -> 1.06,
shrine guards 0.73 -> 0.55, exiles 1.27 -> 1.17), so deaths to players 71% -> 78%.

Not verified: nothing was seen in a client (the tooltip line and its Polish text are checked by tsc only). Exile fights
at level 11+ are few (51 meetings at 11-15, 12 at 16+ in 128 matches), so "still dangerous at high level" rests on the
exile's numbers, not on outcomes. Farm-mode runs for more high-level fights did not work with this harness.

Still hurting, ranked:
1. The trickle rewards walking away for 6-26 s. With bots that is a short wait; with people it may become hit-and-hide.
   Needs people; the two constants are the levers.
2. Bots still do not beat the boss, and on open maps it kills fewer (0.22-0.30 per match): the mid-match has no big
   objective bots actually take.
3. Exile fights at level 6-10 end without a result 62% of the time (bots leave under 60% life); the exile then heals
   on the walk home. A player who brings one to half life and backs off loses the work.

- [x] Gameplay rounds 9 - 10: exiles scale to the player (level 1-5 fighters win 45%, die 9%; was 17% / 31%), the bot rule against exiles under level 10 is gone, empty flasks trickle back to one use out of the fight (time hurt with no flask 15.8% -> 10.4%, stretches over 60 s 3.1 -> 0.1 per match); sudden death 28% -> 16%

## Gameplay round 11 — 2026-11-11 — the boss as the mid-match objective

PoE2 answer: a map boss is the reason to go deeper, and its drop is the best in the area; it is meant to be beaten by a
player at the area's level with ordinary gear, not by one far above it. Here bots attempted the Matriarch in 56% of
matches and killed it in 1% (428 matches): about 2,600 life and 60 a hit met at level 14, against bot damage of
13-22 a second and a life pool of about 356.

| Problem | Evidence (baseline) | Change | Before -> after (428 -> 288 matches) |
|---|---|---|---|
| Boss cannot be beaten at level 12-14 | won 0% of 25 clean fights; median 78 damage dealt; 1% of matches | `shared/content/monsters/roster.ts:171` Matriarch `hp` 130 -> 65, `damage` 18 -> 12.6 (about 1,200 life met at level 13) | boss killed in 1% -> 24% of matches; clean level 11-15 fights: win 0% -> 34%, died 6% -> 9% |
| Bots try once and forget; one bot in three hunts | 56% attempted | `server/bots/bot.ts:61-64,177,184,1009-1011`: every bot hunts from level 12 (was 13), goes only with 70% life and a flask, tries again 40 s after leaving the lair | attempted 56% -> 75% |
| Bots drop a half-dead boss for a passing player | most "escapes" in a test arm were target switches | `server/bots/bot.ts:70,918-921`: a bot keeps a rare/unique monster under 50% life within 600 px unless a player is hitting it; a boss under 50% is finished even then | in-arm: boss kills 6% -> 17% before the other two changes |

Not changed: the reward. The boss already drops the best table in the match (about 3.5 magic/rare items at boss level +2,
extra drops, 20x XP: about +8 levels at 13) and every player is told when it wakes and when it falls. In bot data the
top-level player still wins only 60% of boss-kill matches against 64% otherwise, so the reward is not a decider.

Missed: the 30-60% target. 24-30% across arms (BMIN 11 25%, hp x0.4 24%): most boss fights have a player in them
(367 of 506), and those end badly (died 19%, won 7%). Lower numbers did not raise kills; the third party does.

## Gameplay round 12 — 2026-11-11 — an abandoned fight is not undone

PoE2 answer: monsters do not regenerate when you step back; a rare you brought to half life is still at half life when
you return. Here a hurt monster healed 12% a second walking home, and the whole camp was reset to full when no player
stood within 1,500 px.

| Problem | Evidence | Change | Before -> after |
|---|---|---|---|
| Exile healed after a fight with no result | 30 s after a level 1-10 no-result fight 63-71% of exiles were back to full (e0 arm, 144 matches); the wound memory alone did not help (63-71%) because the camp-asleep reset undid it | `server/ai/brain.ts:63,68` `WOUND_MEMORY` 60 s: no walk-home or idle healing for 60 s after a player hit. `server/ai/state.ts:72,101` field `woundT`; `server/ai/hooks.ts:254,448` set and count down. `server/monsters.ts:398-401`: the camp-asleep reset skips a wounded monster | back to full 30 s later 71% -> 0% (level 6-10); exile life at the next fight 73.8% -> 66.5% (full 23% -> 7%); exiles killed per match 1.5 -> 1.7 |

The no-result share itself barely moved: level 6-10 exile fights (merged when under 15 s apart) 52% -> 50% (428 -> 288
matches; 62% in one 144-match set). Fights still end because the exile leashes home or the bot leaves under 40% life;
the work is now kept, not lost. A shorter leash or a no-leash rule would cut the share but changes chase play: left alone.

The coordinator's change (every idle monster woken from outside its sight scales to the attacker, `server/ai/hooks.ts`
extIncoming) is in both arms. Against the old rule (284 matches each): deaths to monsters 25% vs 25%, sudden death 25%
vs 29%, boss attempted 56% vs 56%, pack deaths 0.96 vs 1.13 per match. No measurable effect.

Targets, 428 matches before / 288 after:

| | Target | Before | After |
|---|---|---|---|
| Boss attempted / killed | killed 30-60% | 56% / 1% | 75% / 24% |
| Deaths to monsters | at most 35-40% | 25% (3.48 per match) | 21% (2.88) |
| Exile / pack / shrine / boss+adds deaths per match | - | 1.35 / 1.00 / 0.60 / 0.49 | 1.20 / 0.79 / 0.47 / 0.39 |
| Mean / median length | 5:00-7:00 | 376 / 373 s | 384 / 380 s |
| Under 5:00 | at most 20% | 9% | 9% |
| Reaching sudden death (7:00) | under 20% | 25% | 29% |
| Stalls | 0 | 0 | 0 |
| Level 6-10 exile fights with no result | - | 52% | 50% |
| ... exile back to full 30 s later | - | 71% (e0 arm) | 0% |

Tried, not adopted: bots hunting at 3:30 instead of 4:00 (`BOT_LATE_SECS` 240 -> 210, 288 matches) brings sudden death
29% -> 17%, but under 5:00 9% -> 16%, mean 384 -> 358 s, and boss kills 24% -> 14% (bots stop hunting it to hunt
players). It trades the objective for the timer, and it is a bot constant that says little about people. Left at 240.

Not verified: nothing seen in a client; no new text, so no Polish entry needed. Boss fights with people are not tested:
bots never kite it round the arena or use its adds. Sudden death was over the target before this pass and is noisy
(23-35% across 144-match arms).

Still hurting, ranked:
1. Sudden death 25-29%, over the 20% target since before round 11. The bot hunt timer (`BOT_LATE_SECS`) is the lever in
   bot play; for people, map size and the circle.
2. The boss is killed in 24% of matches, not 30-60%: it is contested, and a contested fight usually ends with no kill.
   That may be right for a royale; it is the people test that tells.
3. Half of exile fights still end with no result (leash and bot retreat). The work is kept now, so this is pacing, not
   a lost effort.

- [x] Gameplay rounds 11 - 12: the Matriarch at half life and 70% damage, every bot hunts it from level 12 and finishes a half-dead one (attempted 56% -> 75%, killed 1% -> 24%); wounded monsters keep their wounds for 60 s and a sleeping camp no longer resets them (exile back to full 30 s after a no-result fight 71% -> 0%); deaths to monsters 25% -> 21%; sudden death 25% -> 29% (over target before and after)

## Gameplay round 13 — 2026-11-11 — the ending is brought on by game rules, not the bot timer

There is no zone or circle in the game, by design (no shrinking zone, no time limit; see the design decisions). The
rules that bring the last players together, for people as well as bots, are the survivor reveal (`server/snapshot.ts`:
every survivor shown on the map from `REVEAL_ALIVE` 5 left or after `REVEAL_AFTER` s), the final duel (`server/damage.ts`
`FINAL_DUEL_PVP_MULT`: two left, player hits stronger) and sudden death at 7:00 (not touched). Bots read the reveal like
people do: once it is on they walk to the survivors and stop farming. `BOT_LATE_SECS` stays at 240.

Evidence (264 matches, baseline): 4.5 players alive at 5:00 when the reveal starts, 2.5 at 7:00; the last two are left at
a median 5:52 and their duel lasts 28 s (p75 48 s). In sudden-death matches the last pair had already traded 40-280
hits before 7:00: they had found each other, the fight just did not end.

| Problem | Evidence | Change | Before -> after (264 -> 264 matches) |
|---|---|---|---|
| Survivors found too late | 2 left at 352 s median | `shared/constants.ts:143` `REVEAL_AFTER` 300 -> 240 | sudden death 35% -> 23% (alone); 2 left at 332 s |
| The last duel does not end | final duel p75 48 s, 60% of sudden-death matches had 2 left at 7:00 | `server/damage.ts:136` `FINAL_DUEL_PVP_MULT` 1.5 -> 2 | with the reveal: sudden death 23% -> 14-19% (three 264 arms), final duel med 28 -> 17-21 s |

Arms tried (264 each unless noted; sims are not deterministic, so about +-5 points of noise on 264):

| Arm | Sudden death | Mean | Under 5:00 | Boss killed |
|---|---|---|---|---|
| Baseline | 35% | 394 s | 7% | 22% |
| Reveal at 240 s | 23% | 374 s | 9% | 19% |
| Reveal at 210 s (132) | 23% | 374 s | 11% | 15% |
| Reveal at 240 s and at 7 left | 25% | 374 s | 13% | 25% |
| Final duel x2 only | 19% | 365 s | 13% | 23% |
| Reveal 240 s + final duel x2 | 14% | 359 s | 11% | 22% |
| Live tree after rounds 13-14 | 17% | 363 s | 14% | 23% |

Not changed: `REVEAL_ALIVE` (7 instead of 5 added nothing), sudden death, `BOT_LATE_SECS`. The baseline here (35%) is
higher than round 12's 29%; same code, different seeds and noise.

## Gameplay round 14 — 2026-11-11 — the boss reward

PoE2 answer: a map boss is worth a lot of experience, not a whole act of levels. Here the Matriarch gave 20x a normal
monster's XP at its level: about +8 levels (level 15 -> 23) for the killer.

| Problem | Evidence (264 matches) | Change | Before -> after |
|---|---|---|---|
| +8 levels for one fight | killer level after the kill 23.3; killer wins 62% of kill matches against a fair share of 18% (1 / players alive at the kill) | `shared/content/classes.ts:50-54` boss base XP 87 / 97 / 93 -> 30 / 34 / 33 (about +4 levels at level 13) | killer level 23.3 -> 17.9; killer top 3 88% -> 79%; killer wins 62% -> 62% |

The trim did not move the killer's win share. A control arm with no boss XP at all still had the killer win 51% (67
kills): the bot that kills the boss is already the strongest one left, and the drops add the rest. The XP was worth
about 10-15 points of win share at most (66% full XP, 64% at x0.35, 51% at none, about +-6 points each). The boss is
still clearly worth taking: +4 levels, the best drop table, attempted in 74% of matches, killed in 23%.

Targets, 264 matches before (rounds 12 tree) / 264 after (live tree, rounds 13-14):

| | Target | Before | After |
|---|---|---|---|
| Reaching sudden death (7:00) | under 20% | 35% | 17% |
| Mean / median length | 5:00-7:00 | 394 / 396 s | 363 / 357 s |
| Under 5:00 | at most 20% | 7% | 14% |
| Deaths to monsters | at most 35-40% | 21% (2.97 per match) | 21% (3.00) |
| Boss attempted / killed | - | 71% / 22% | 74% / 23% |
| Boss killer wins (fair share) | - | 62% (18%) | 62% (16%) |
| Stalls | 0 | 0 | 0 |

Not verified: nothing seen in a client; no new text (the reveal banner and the final duel already exist), so no Polish
entry needed. Whether people walk to the revealed survivors at 4:00 the way bots do is the open question: bots always
go, people may hide or wait for the others to fight. The final duel at x2 shortens a people duel too; 17-21 s median in
bot play.

Still hurting, ranked:
1. The boss killer wins 62% of the matches it is in; the XP was not the cause. It may be right (the strongest takes the
   objective), but it means the boss rarely turns a match around. People data needed.
2. Under 5:00 rose 7% -> 14%: still inside the 20% cap, but the margin is smaller.
3. Half of level 6-10 exile fights still end with no result (round 12), unchanged here.

- [x] Gameplay rounds 13 - 14: survivors revealed at 4:00 instead of 5:00 and the final duel at x2 player damage (sudden death 35% -> 17%, mean 394 -> 363 s, under 5:00 7% -> 14%); boss XP about +8 -> +4 levels (killer level 23 -> 18; killer win share 62% -> 62%, mostly the strongest bot taking it)

## Gameplay round 15 — 2026-11-11 — the open maps and new HUD lines, seen in the client

Solo headless-Chrome dev sessions at 1280x720 (dev teleport, /__god to stay alive in the boss camp); no bots, no sound.
Screenshots: scratchpad loop15-*.png.

Problems seen, with fixes:
- The heart plaza (boss arena) was a large upright top-down flagstone grid laid flat on the iso view: the single
  worst-looking ground in the game, and much bigger now that the clearings are open. Fix: cobble (ruins) and slabs
  (heart) are now drawn on an iso-projected tile matrix at 0.8 scale (ground.ts:83-112, 188-189); a low-frequency
  noise subtracts plain-ground patches from big places so they do not read as one stamped sheet (ground.ts:169).
  Seen: loop15-heart-plaza-before-flagstone-grid.png -> loop15-heart-plaza-after-iso-cobble.png.
- The first-spawn controls strip drew over the world map. Fix: it yields while the world map is open
  (minimap.ts:87, dock.ts:202). Seen: loop15-worldmap-hint-strip-overlap-before.png -> loop15-worldmap-after-no-hint-strip.png.
- The flask tooltip refill line was English in Polish and named no delay. Now "Refills to one use after 6 s without
  taking damage" from FLASK_TRICKLE_DELAY (belt.ts:144) with a Polish entry (pl.ts:117). Shown only at 0 uses.
- The trickle refill was nearly invisible on the belt. Fix: a 0.9 s light flash on the slot when it becomes usable
  again (belt.ts:62-63, 107). Seen in a frame strip: loop15-flask-refill-flash-strip.png.
- There was no boss wake announcement at all (only phase lines and "has fallen"). Fix: "<boss> awakens" once per boss
  to everyone (hooks.ts:31, 235-237), Polish "{x} – przebudzenie" (pl_content.ts:234); boss info lines are gold in the
  feed (killfeed.ts:22, 115). Seen: loop15-boss-wake-line.png, loop15-boss-fallen-gold-line.png.
- English leaking into the Polish UI: "1 of 1 alive" on the Tab overlay (pl.ts:133), "(Brutish)" (i18n/index.ts:150),
  multi-word monster modifiers like "Thirsting Presence Feral Wolf" (index.ts:201), and the kill feed shortened the
  English text before translating it (killfeed.ts:28).

## Gameplay round 16 — 2026-11-11 — feel items in the client and in code

- Loot hop: the first loot of a fresh match never hopped, because "already on the ground" meant the first batch ever
  seen. Now only items present in the first 0.6 s on a map count as already there (render.ts:196, 347, 391, 709-710).
  After the fix the drop frames show icons popping in with a glint ring, but the 13 px hop itself is not clearly
  visible in 1-frame-per-capture shots (loop15-loot-drop-frames-no-clear-hop.png).
- Nameplate at HERO_H + 10 clears the head by about 2 px; the sword hilt touches the bar in some poses
  (loop15-nameplate-clearance-zoom.png). Left as is. In melee crowds plates and monster labels stack
  (loop15-boss-bar-and-melee-label-pileup.png).
- Hit-stop (main.ts:423-438: 26/52/46/72 ms, 200 ms gap, tied to the screen-shake setting), camera nudge (render.ts:192:
  1.1/2.2 units, gone in about 60 ms) and swing sound (audio/game.ts:167: whoosh ends at the commit point, peak about
  66 ms before the hit) read right in code; no change.
- Boss bar at the top with phase notches is readable; the camp pointer ("28 m") helps and stays quiet, but it is hidden
  once the reveal starts, so it never shows after 4:00.
- Reveal at 4:00 (not changed): a 5 s banner and the alive count turns red; solo, so no survivor markers were seen.

Not fixed (client art / generator): wall edges show stepped black notches where trees do not cover them, and some
walls are flat dark slabs (loop15-wall-edge-black-notches-unfixed.png, loop15-flat-wall-slabs-unfixed.png). The
lumber-yard bark tile repeats (breakup applied, not seen after: the teleport landed in a thicket). The map generator's
layout numbers were not touched and do not need changing for any of this.

Not verified: the English refill line in a screenshot (the run had 1 use left, so it is correctly hidden); the Polish
fix for multi-word modifier names; the hint strip still touches the right end of the Tab overlay's helper text
(loop15-tab-overlay-en-hint-strip-touches-helper.png), left because the strip is still useful while the overlay is up.

- [x] Gameplay rounds 15 - 16: heart plaza and ruins ground on iso tiles, boss wake line and gold boss lines, flask
  refill line + flash, hint strip yields to the world map, first-match loot hop, four Polish leaks fixed

## Gameplay round 17 — 2026-11-11 — wall edges in the iso view

Solo headless-Chrome dev sessions at 1280x720, a fixed map seed (424242) so the before and after shots show the same
camera spot; the "before" client was built from the backed-up files. No bots, no sound. Shots: scratchpad loop17-*.png.

- Problem: where forest walls meet open ground, the raised wall mass followed the 64-unit cell grid. Its shadow faces
  showed as stepped black notches and its top as a flat dark slab with a bright rim line.
- Change (only with the painted ground on; the procedural fallback is unchanged):
  - The wall/water test is warped in screen space by smooth noise, so the cell staircase becomes a ragged edge
    (world.ts:152-157, 205-210, 246-276). The warp is computed on a 4-unit grid per chunk and interpolated.
  - The wall top is a translucent shade over the painted forest floor instead of a flat colour. It is feathered: its
    alpha rises from 110 at the border to 238 deep inside, from 4 samples toward and away from the camera
    (world.ts:137-150, 168-175).
  - The faces are a translucent shadow band, alpha 120 at the foot to 200 at the top (world.ts:199).
  - Ruins paving keeps the straight grid (world.ts:285).
  - The per-pixel unproject in the face loop is now inlined, so it allocates nothing (world.ts:190-196).
  - No new art. Map generator untouched.
- Seen: loop17-wall-edge-stairs-before-after-thicket.png and loop17-wall-edge-black-band-before-after-glade.png. The
  stairs and black notches are gone, and the forest reads as a dark shaded floor under the trees.
  loop17-wall-edge-before-after-subtle-glade2.png shows only a small difference.
- Draw cost (hnsFps drawMs, the dev counter's average; mean of 10 samples 3.5 s after arriving, same 6 spots):
  - Settled: 3.52 ms before, 3.50 ms after.
  - Chunk-building moment, sampled 0.4 s after a teleport at the 4 edge spots: 5.2 ms before, 5.9 ms after (noisy).
  - Ground chunk builds stay under the existing 6 ms per-frame budget.
- Lumber yard: the bark tile's grid repeat was still plain in the before shot (the earlier breakup only cut plain-ground
  holes). Now a second copy of the same bark tile is laid on top, turned 90 degrees, 1.27x larger and offset, in noisy
  patches (ground.ts:83-88, 191-196). Seen: loop17-lumber-yard-wall-stairs-and-bark-repeat-before-after.png. The
  repeat is broken up, but you can still pick out single leaf motifs if you look.
- Still wrong: deep wall interiors that no tree covers are a plain dark shade (better than a slab, but empty). On flat
  open edges the border between the walkable and the blocked area is now softer and slightly harder to read. Trees
  still mark it.

## Gameplay round 18 — 2026-11-11 — label pile-up in melee and the boss camp

- Problem: the focused monster had its full name and mods both overhead and in the top target bar. A damaged boss had
  its name and title both overhead and in the boss bar. Magic monsters and pack-granted normals ("Zdziczały Wilk" x5)
  each had a name. Up to 9 text lines piled on the player's own plate (loop15-boss-bar-and-melee-label-pileup.png).
- Change (PoE2 rule, smallest form; render.ts:1058-1070, monsters_fx.ts:164-165, 193-197):
  - The focused (hovered or last-hit) enemy and a damaged boss keep only the overhead life bar while the top bar shows
    them. With the target bar turned off in Options, the old plates come back.
  - Magic monsters and pack-granted normals show no name unless focused.
  - At most 3 other names per screen (rarest first).
  - No new strings.
- Hero plate raised 4 units (HERO_H + 14, render.ts:2031) so the raised sword hilt clears the bar:
  loop17-nameplate-clearance-before-after-zoom3x.png (gap over the head about 2 px -> about 6 px).
- Seen:
  - loop17-camp-crowd-labels-before-after-different-spawns.png: 7 name lines down to 1 rare plate plus bars. The
    monster rolls are random per run, so the packs differ.
  - loop17-boss-overhead-name-dropped-before-after.png: the overhead boss name and title are gone while the boss bar
    is up.
  - loop17-boss-fight-labels-before-after-pre-gm-fix.png was taken before the pack-granted fix, so 2 "Żywicopluj" names
    still show there.
- Not verified: with several rares fighting at once, plates still stack upward (the existing stacking). A rare's
  overhead plate can sit partly under the top target bar (seen once, top left of the camp shot).

- [x] Gameplay rounds 17 - 18: wall edges warped, feathered and translucent, no black notches; bark repeat broken with
  a turned copy; PoE2 label declutter (focused/boss bar only, magic unnamed, 3-name cap); hero plate +4

## Gameplay round 19 — 2026-11-11 — dressing the blocked ground

Same setup as round 17: solo headless Chrome at 1280x720, map seed 424242, a fresh dev server for each run, and the
"before" client built from the backed-up files. No bots, no sound. Shots are in the scratchpad as loop19-*.png.

- Problem: deep wall interiors and tree-less rim cells were an even dark shade. On open edges the line between walkable
  and blocked ground was hard to read.
- Change (client art only; map generator, biomes and collision untouched):
  - A per-map list of painted props on blocked cells, built once (render.ts:1261-1305), drawn depth-sorted like the
    obstacles (render.ts:933-937), and bucketed into the same 256-unit prop grid (render.ts:1309-1316).
  - Cells 3 or more deep in a wall get a tall conifer on about 60% of cells. The biome's rock share gets boulders
    instead. Layer-2 cells get one on 30% of cells. All are jittered inside the cell. Deep trees use the existing
    see-through fade.
  - Rim obstacles that render without a tree (the existing 45% skip) get a low fern, rock pile or small conifer.
    It is moved 20 units toward the open side, so the edge reads.
  - Pick lists are in decor.ts:193-211. bush_b..d were tried first and dropped: they read as dark thorn balls at
    this size. fern_e was also dropped because it shows a clipped square edge.
- Seen:
  - loop19-wall-interior-trees-and-rim-ferns-before-after-west-edge.png: the empty dark wall becomes forest, and
    ferns and a small tree mark the edge.
  - loop19-wall-rim-ferns-subtle-before-after-glade.png: only a few ferns.
  - loop19-wall-dressing-barely-visible-before-after-thicket.png: almost no difference on an open thicket spot.
- Draw cost (hnsFps drawMs, mean of 10 samples 3.5 s after the teleport, same spots):

  | Spot | Before | After |
  | --- | --- | --- |
  | edge0 | 3.32 | 3.43 |
  | edge1 | 3.46 | 3.58 |
  | edge2 | 3.33 | 3.55 |
  | edge3 | 3.24 | 3.38 |
  | Lumber yard 0 | 4.04 | 4.05 |
  | Lumber yard 1 | 3.75 | 4.92 (a camp fight moved the player; not comparable) |
  | Boss | 4.69 | 4.45 |
  | Boss, 700 W | 5.55 | 5.43 |
  | Boss, 700 S | 4.93 | 4.18 |

  - Edge spots: +0.11 to +0.22 ms. The boss camp is not higher.
- Place ground: the same turned-copy breakup was tried on the graveyard gravel and the bone-pit ground. No visible
  repeat was there to break (loop19-graveyard-gravel-turned-copy-no-visible-gain-reverted.png; the pit shots were in a
  fight), so it was reverted.

## Gameplay round 20 — 2026-11-11 — several rares at once

- Problem: with several rares fighting, their 2-line plates (name + mods) stacked into a column. A plate could sit under
  the top target bar, which clipped it. A later monster's life bar could be drawn over an earlier plate's name.
- Change:
  - With more than one rare near the player, no rare shows its mod line overhead. The focused rare's mods are in the
    top bar, or overhead when the bar is off (render.ts:1063-1066).
  - A text plate that would overlap a HUD-owned rect (target / boss bar, buffs, fixed HUD) is dropped and the life
    bar stays (monsters_fx.ts:234-235, render.ts:2064).
  - Plate text is queued and drawn after every monster's bar, so names are never covered by a bar
    (monsters_fx.ts:255-260, render.ts:1082-1083).
  - No new strings.
- Seen:
  - loop19-four-rare-wolves-mod-lines-dropped-before-after-different-camera.png: 4 dev-spawned rare wolves (scratchpad
    serve.ts /__rares). Before: "Ashtooth" has a mod line, and its plate stacks over "Cairncoil Gutripper". The 4-line
    list under the top bar is the HUD target block, not a plate. After: three single-line names and no overhead mod
    lines. The camera differs, because the fight moved the player.
  - loop19-four-rares-plate-under-target-bar-before-after-different-packs.png: before, the "Ashc..." plate is cut off
    under the target bar. After, none are. The rare types differ per run.
- Not verified: three single-line names can still stack a little in a tight melee (MAX_PUSH 22 keeps it short).

- [x] Gameplay rounds 19 - 20: blocked ground dressed with existing trees, rocks and ferns (+0.1-0.2 ms at edges); rare
  mod lines only for the focused one when several are near; plates kept out of HUD rects and drawn over all bars
