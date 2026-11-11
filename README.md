# HnS Royale

A 2D online multiplayer hack-and-slash full-loot royale browser game (prototype, Phase 2 core loop).
2–20 players, last one standing. Gear is fresh every match: pick a starting weapon, clear monster
camps for loot and flask charges, and take everything from the players you kill.
TypeScript everywhere: a Node server (authoritative, 30 Hz) and a canvas client with
client-side prediction, sharing one deterministic movement simulation.

The client renders a dark, isometric (2:1) pixel-art world. Every sprite is generated in code
at startup: there are no image assets. The look is grim and low-lit: each player carries a
small light radius, and camp braziers give off warm torchlight. Everything else stays in
darkness, with a vignette over the edges. Open `/sprites.html` for an art review sheet showing
the hero in 8 directions with every animation and gear set, plus monsters, props, HUD globes,
the title font and item icons.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000 in **two browser tabs** (or two machines on your LAN), enter a
name, pick a starting weapon and press Play. With 1 player you're in practice mode (respawn on death); once
`MIN_PLAYERS_FOR_ROUND` (2) players are in, a countdown starts and the round begins.

`npm run dev` rebuilds the client bundle on change and restarts the server on change
(reload the page after server restarts).

Other scripts:

| Script              | What it does                                              |
| ------------------- | --------------------------------------------------------- |
| `npm run typecheck` | `tsc --noEmit` over `src/`                                 |
| `npm run build`     | minified `public/bundle.js` + bundled `dist/server.js`     |
| `npm start`         | runs `dist/server.js` (run `build` first)                  |

## Controls

| Action                     | Input                                                    |
| -------------------------- | -------------------------------------------------------- |
| Move                       | WASD / arrow keys, **screen-relative** (W = up the screen) |
| Aim                        | Mouse                                                    |
| Attack                     | Left mouse (hold to keep swinging)                       |
| Dodge roll                 | Space (short invulnerability; cooldown bar in the bottom panel) |
| Pick up loot               | F (hovered item, else nearest in range) or click its label |
| Equip straight from ground | Shift+F or Shift+click the label                         |
| Inventory / equipment      | I (Esc closes)                                           |
| Use flask                  | 1 / 2 / 3                                                |
| Scoreboard                 | hold Tab                                                 |

In the inventory panel: click a bag item to equip it, right-click to drop it, click an
equipped item to unequip it, Shift+click a ring to put it in the second ring slot. Hovering a
ground label or an inventory cell shows a tooltip with a quick compare against what you have
in that slot (green better, red worse).

## Core loop (Phase 2)

- **Starting loadout:** sword (wide arc), spear (long reach, narrow arc), axe (slow, heavy
  knockback) or dagger (fast, short), plus one Tin Draught life flask at half charges. No other gear.
- **Slots:** main hand, off-hand (a plain stat stick for now), helmet, body, gloves, boots, amulet,
  two rings, belt. The belt sets the flask slots (1 without a belt, 2–3 with one). The bag holds 12.
- **Items:** normal (0 mods), magic (1–2) or rare (3–6). Prefix and suffix affixes have tiers, and
  item level gates the tiers. Equipping recomputes your Stats on the server (base + weapon +
  implicits + affixes, clamped) and sends a `stats` message that the client predicts with.
- **Monsters:** `CAMP_COUNT` camps of 3–6: the Gnashling (melee chaser), the Bog Seer (ranged
  caster with a slow, dodgeable bolt) and the Cragback (brute with a telegraphed slam). Some camps
  have a rare elite with 1–2 modifiers (Frenzied, Ironhide, Volatile, Rimecloaked). Monsters go
  idle → aggro → chase → attack → leash home. Normal monsters drop low-ilvl loot; elites drop
  mid-ilvl loot, and more often.
- **Flasks:** charges come from kills (normal small, elite medium, player kill large). Using a
  flask heals over time. Flasks drop with magic mods (recovery, instant, max charges, charge gain).
- **Death drops everything** (equipment, bag and flasks) around the corpse.
- **PvP damage** is multiplied by `PVP_DAMAGE_MULT` (0.4). Monsters take full damage.

## Round flow

`waiting` (fewer than 2 players: free practice, respawn after 2 s) →
`countdown` (everyone respawned on a ring, full HP, frozen) →
`fight` (no respawns; people who join mid-round spectate) →
`ended` (≤ 1 alive; winner shown, +1 win) → next countdown, or back to waiting.
There is no shrinking zone and no timer. At round start the ground is cleared, everyone gets a fresh
starter kit and the camps are populated. In `waiting` (practice), cleared camps respawn after
`CAMP_PRACTICE_RESPAWN` seconds.

## Project layout

```
public/index.html           page, join overlay (name + weapon), inventory panel / tooltip / toast CSS
src/shared/constants.ts     gameplay tunables (speeds, dodge, PvP mult, camps, loot limits, net)
src/shared/stats.ts         derived per-player Stats + clamp bounds
src/shared/items.ts         item model, computeStats(equipment), tooltip text, quick compare
src/shared/content/         CONTENT AS DATA (tune here, no logic):
  types.ts                    slots, item classes, mod keys
  bases.ts                    item bases (weapons per kind, armour, jewellery, belts) + starters
  affixes.ts                  prefixes / suffixes with ilvl-gated tiers, rarity mod counts
  flasks.ts                   flask bases + flask affixes
  monsters.ts                 monster types, pack size, elite modifiers + name parts
  loot.ts                     drop tables (normal / elite), rare names, rarity colours
src/shared/map.ts           seeded deterministic rock obstacles
src/shared/protocol.ts      JSON message types (client <-> server)
src/shared/sim.ts           deterministic player movement / dodge roll / swing timing
src/server/index.ts         HTTP + WebSocket server, message validation, 30 Hz loop
src/server/game.ts          players, ground items, pickup, flasks, kills, round phases, dev cmds
src/server/inventory.ts     equip / unequip / store / drop (all validated), stat refresh
src/server/loot.ts          item / flask rolling, drops, starter kit
src/server/monsters.ts      camps, monster AI, projectiles, telegraphed hazards, elite mods
src/server/combat.ts        swing hit detection, player damage (i-frames, PvP mult), kills
src/server/snapshot.ts      per-client snapshots with interest management
src/server/player.ts        server player record + snapshot serialization
src/client/main.ts          entry: join, input loop, snapshot handling, loot interaction
src/client/ui.ts            DOM inventory / equipment panel, tooltips, toasts
src/client/render.ts        iso canvas world, depth sort, light pass, loot labels, effects, HUD, minimap
src/client/gfx/             procedural pixel art: iso.ts projection, rig.ts 3D-rig rasterizer,
                            hero.ts / monsters.ts animated sprites, props.ts obstacles and
                            dressing, world.ts ground, light.ts light map, hud.ts panel and
                            globes, font.ts pixel and title fonts, icons.ts item icons
src/client/sprites.ts       art review page (public/sprites.html)
src/client/joinfx.ts        join screen title and embers
src/client/input.ts, net.ts, prediction.ts, interp.ts
src/server/host.ts          GameHost: transport-agnostic message dispatch + tick (ws server and P2P host)
src/net/                    P2P: transport.ts, loopback.ts, rtc.ts (WebRTC), lobbyclient.ts,
                            lobbyproto.ts, roomproto.ts, hostruntime.ts (room + match lifecycle),
                            hostworker.ts (host loop Web Worker), hostbridge.ts (main-thread side)
src/lobby/                  service.ts (lobby list + signalling, rate-limited), server.ts (standalone)
src/client/menus/           main menu, lobby browser, lobby room, post-match, in-match chat / social
scripts/dev.mjs, build.mjs  esbuild / tsx runners
```

### Networking model

- Client samples input at a fixed 30 Hz, each `InputCmd` has an incrementing `seq`,
  is simulated locally with `stepPlayer` (prediction) and sent to the server.
- Server queues commands per client and simulates each one as one tick (rate-limited by
  a token bucket: average 1 input/tick, bursts up to `MAX_INPUTS_PER_TICK`), then
  broadcasts a snapshot every tick with `ack` = last processed `seq` for that client.
- Client resets to the server state, drops acked inputs, replays the rest, and hides the
  difference with a decaying visual offset.
- Combat is resolved only on the server when a swing starts. A player's sim (including
  cooldowns) advances once per input that player sends, exactly like the client's prediction.
- **Interest management:** each client gets only the players, monsters, projectiles, hazards and
  ground items within `VIEW_RADIUS` of its camera (itself, or the player it spectates).
  Ground items go out as `[groundId, x, y]`; full item details are sent once per client
  (`defs`). The scoreboard and the camp markers (minimap) go out every `BOARD_INTERVAL` ticks.
- Nothing item-related is trusted from the client: pickup range, slot type, inventory
  indices and flask use are all validated on the server.

### Peer-to-peer play (host's browser is the server)

```
 lobby service (/lobby ws)   register / heartbeat / list / signal relay; no game traffic
        ▲            ▲
        │ signalling │
 host browser                                  joiner browser
  main thread: menus, RTCPeerConnections  ◄── WebRTC DataChannels ──►  menus, Net, prediction
   │ postMessage                                "rel" (reliable, ordered)
  Web Worker (hostworker.js):                   "fast" (unordered, no retransmit: snap/input)
   HostRuntime (lobby room + match) → GameHost (same authoritative sim as the ws server) @ 30 Hz
```

- Main menu → **Host** publishes an open lobby; **Browse** lists lobbies (players x/max, biome, size,
  ping estimate, in-match state). There are no join codes. In the room, players pick a class, ready up and chat. The host
  sets biome / map size / max players, can kick, and starts once ≥2 are ready. After the match everyone gets
  a post-match screen (kills, damage, level, notable loot) and returns to the room.
- The transports (`src/net/transport.ts`) are a ws adapter (dedicated server), WebRTC (`rtc.ts`) and an
  in-memory loopback (the host's own client). `GameHost` (`src/server/host.ts`) doesn't depend on any of them.
- Lobby protocol: `src/net/lobbyproto.ts`. Room protocol (`r-*` messages): `src/net/roomproto.ts`.
- Run it: `npm run dev` serves the game **and** `/lobby` on :3000. For a standalone static + lobby
  deployment, use `npm run lobby` (dev) or `npm run build && npm run start:lobby` (env `PORT`, default 3001).
  `?lobby=wss://host/lobby` or `window.HNS_LOBBY` points the client at another lobby service.
- ICE: public Google STUN by default. Set `HNS_ICE='[{"urls":"turn:...","username":"..","credential":".."}]'`
  to add TURN. Set `HNS_TRUST_PROXY=1` behind a reverse proxy (per-IP limits use X-Forwarded-For).

**Known limits**
- **NAT:** STUN only, so two peers behind symmetric NAT / strict firewalls can't connect until TURN is
  configured. The joiner then sees a timeout message after 15 s.
- **Host cheating:** the host runs the authoritative sim, so a modified host client can cheat. This is
  accepted for casual P2P; use the dedicated server for anything competitive.
- **Tab throttling:** the host loop runs in a Web Worker, so backgrounded tabs keep ticking, but the
  browser may still throttle a hidden tab. The host gets a warning and all players see a "host hidden" note.
- **No host migration:** if the host leaves, the match and the room end, and everyone returns to the main menu.

### Dev mode (testing only)

`HNS_DEV=1 npm run dev` enables `{t:"dev"}` messages: `spawn` (a monster near you), `hp`,
`tp`, `give` (an item onto the ground) and `clear` (removes monsters and loot). The server
ignores them unless it was started with `HNS_DEV=1`.

### Prototype: one biome, solo testing

- **One biome only.** Every match generates **Hollowpine Blight** (`PROTOTYPE_BIOME` in
  `src/shared/biomes.ts`); the lobby's biome pick is ignored. The Node server accepts
  `HNS_BIOME=<id>` to override it. Packs are Hollowpine families only: Barkgnaw, Feral Wolf,
  Sapspitter, Hollow Tender, Stumpfather (boss: Rotwood Matriarch).
- **Start a match alone.** Open the client with `?dev=1` (e.g. `http://localhost:3000/?dev=1`),
  host a lobby and press *Begin the match*: one ready player is enough, and the round runs until
  you die. The hosted game also accepts dev commands. On the Node server, `HNS_DEV=1` does the same
  (a round starts with one player).
- **Raise shield:** hold **V** (rebindable: Options > Keybinds) with a shield in the off hand.
  You walk slowly, cannot attack, and frontal hits are blocked (each block builds heavy stun).

## Changing the design

- Items, affixes, flasks, monsters, drop rates: `src/shared/content/*.ts`.
- Numbers: `src/shared/constants.ts` (used by both server and client).
- How gear becomes Stats: `computeStats` in `src/shared/items.ts`.
- Hit rules: `src/server/combat.ts`. Monster AI: `src/server/monsters.ts`.
- Movement / dodge / swing timing: `src/shared/sim.ts` (must stay deterministic: the client
  and the server both run it).

## Deploy

Any host that runs Node 20+ and supports WebSockets (Render, Railway, Fly.io, a VPS, …):

```bash
npm install
npm run build
PORT=8080 npm start      # PORT defaults to 3000
```

The server serves `public/` and the WebSocket on the same port; the client connects to
`ws(s)://<same host>`, so it works behind HTTPS (wss) without config. `public/` must be
deployed alongside `dist/` (the server finds it relative to its own location or the cwd).

## Windows app (installer + auto-update)

`npm run app` runs the desktop app from source; `npm run dist:win` builds the installer into
`release/` (`HnS-Royale-Setup-<version>.exe`, per-user, no admin). The app starts the lobby /
game server with Electron's own Node (players need no Node install), opens the game, and has
**Play with friends** in its menu bar: it opens the Cloudflare link and shows it to copy. Friends can
join with the app or just a browser. Closing the game window stops the server and the link.
The installer is not code-signed, so Windows SmartScreen shows "Windows protected your PC" on
first run: click **More info -> Run anyway**.

The installed app updates itself from GitHub Releases of the repo in `package.json`
`"repository"`: it checks on start, downloads in the background, offers a restart, and otherwise
installs the update when the game is closed. Offline or no release: it just starts.

### Releasing an update

1. Raise `"version"` in `package.json` (e.g. `0.1.0` -> `0.1.1`).
2. Commit: `git commit -am "Release 0.1.1"`.
3. Tag with the same version: `git tag v0.1.1`.
4. Push both: `git push && git push origin v0.1.1`.

The `release` workflow (`.github/workflows/release.yml`) then builds the installer on Windows and
publishes it with `latest.yml` to GitHub Releases; installed games pick it up on their next start.

## Updates (source copy / `Play with friends.bat`)

`Play with friends.bat` runs `scripts/update.mjs` first. It compares `version` in this folder's
`package.json` with the one on GitHub and, if GitHub is newer, downloads and installs that copy.

- Set the repo once in `package.json`: `"repository": "github:OWNER/REPO"` (the repo must be public).
- To ship an update: raise `version` in `package.json` and push to the default branch.
- A folder with `.git` (a developer copy) is never auto-updated; use `git pull` there.
- `node scripts/update.mjs --check` only reports; `--force` reinstalls; `HNS_NO_UPDATE=1` skips it.
