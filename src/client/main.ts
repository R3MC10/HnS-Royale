// Client entry: join flow, fixed-rate input/prediction loop, render loop, loot interaction.
import "./gfx/softcanvas";
import { initI18n } from "./i18n";
import { DT, PICKUP_RANGE, PING_INTERVAL } from "../shared/constants";
import type { WeaponKind } from "../shared/content/types";
import type { Item } from "../shared/items";
import { HINT_PREFIX, type BoardEntry, type CampSnap, type GroundSnap, type HazardSnap, type InputCmd, type Phase, type PlayerSnap, type ServerMsg, type SnapMsg } from "../shared/protocol";
import { sanitizeStats } from "../shared/stats";
import { HARD_CC, hasAil } from "../shared/ailments";
import { BASE_BY_ID } from "../shared/content/bases";
import { initInput, input, moveAxes, taps, type Action } from "./input";
import { Interpolator } from "./interp";
import { Net } from "./net";
import { Predictor } from "./prediction";
import { screenMoveToWorld } from "./gfx/iso";
import { Renderer, type GroundView, type View } from "./render";
import { UI } from "./ui";
import { initJoinScreen } from "./joinfx";
import { initMenus } from "./menus/menus";
import { toggleSocial } from "./menus/ingame";
import { autoPickupTick, handleEscape, handleOptionAction, initOptions, registerPanel } from "./options";
import { frameAllowed, getSettings } from "./settings";
import { actionLabel } from "./keybinds";
import { showFirstHints } from "./firsthints";
import { itemCategory } from "../shared/grid";
import { currentBiome, onMapChange, setMap, type MapParams } from "../shared/map";
import { music } from "./audio/music";
import { setBuffShrines } from "./gfx/monsters_fx"; // monsters agent
import { audioEvents, audioFrame, audioOnMessage, audioSetView, hookNetAudio } from "./audio/index";
import { heldSlot, initSkills, skillOnMessage, skillOnSnap, togglePanel as toggleSkills } from "./skillbar";
import { clearSkillFx, setFxPlayers, skillFxEvents } from "./gfx/skills";
import { goreEvents, goreFrame, goreScreen, goreTimeScale } from "./gfx/gore/index";
import { prewarmTick } from "./gfx/sprites2d/prewarm";
// Progression (XP bar, shrines, passive tree, character sheet)
import { atShrine, drawProgWorld, layoutProgHud, progEvents, resetProgClient, setProg, setShrines } from "./prog";
import { initTreePanel, isTreeOpen, toggleTree } from "./tree";
import { isCharOpen, setCharStats, toggleChar } from "./charsheet";
import { hudClick, hudFrame, hudHint, hudOnMessage, hudOnSnap, hudReset, initHud } from "./hud/index"; // HUD core
import { REPLAYING, startReplay } from "./devreplay"; // dev-only match replay viewer
import { setWorldCursor } from "./gfx/worldui"; // worldui: context cursors
import { CINE, cineApply } from "./devcam"; // dev-only cinematic camera (?dev=1&cine=1)
import { initLaneHud, laneOnMessage } from "./lanehud"; // Breachway lane mode HUD + Quartermaster

const canvas = document.getElementById("game") as HTMLCanvasElement;
const overlay = document.getElementById("overlay") as HTMLDivElement;

const net = new Net();
hookNetAudio(net); // audio: inventory / progression action sounds
const renderer = new Renderer(canvas);
const predictor = new Predictor();
const interp = new Interpolator();
const ui = new UI((m) => net.send(m));
initSkills((m) => net.send(m)); // skill bar + Skills panel (skillbar.ts)
initHud({ send: (m) => net.send(m), ui: { isOpen: () => ui.open, toggle: (f) => ui.toggle(f) } }); // canvas HUD + panel docking (client/hud)
initLaneHud((m) => net.send(m), () => ui.inv);

let selfId = -1;
let joined = false;
let phase: Phase = "waiting";
let phaseLeft = 0;
let winner: string | null = null;
let alive = 0;
let total = 0;
let lastSeen: [number, number, number][] = [];
let specId = -1;
let latestPlayers = new Map<number, PlayerSnap>();
let hazards: HazardSnap[] = [];
let ground: GroundSnap[] = [];
const defs = new Map<number, Item>(); // ground id -> item details (sent once by the server)
let board: BoardEntry[] = [];
let camps: CampSnap[] = [];
let selfAlive = false;
let ping = 0;
let outgoing: InputCmd[] = [];
let hoverG = -1;
/** worldui: label clicked out of reach -> walk to it (inputStep) and pick it up on arrival. */
let pendingPickup: { g: number; equip: boolean; t: number } | null = null;

const nowSec = () => performance.now() / 1000;
// Hard CC (stun / freeze / electrocute) from our own snapshot: prediction must stand still too, or the
// server snaps us back (server/game.ts isFrozen uses playerLocked). Chill already arrives in stats.moveSpeed.
let selfLocked = false;
/** Shield in the offhand (raise shield is only sent with one, so prediction matches the server). */
let selfHasShield = false;
const isFrozen = () => !selfAlive || phase === "countdown" || selfLocked;

// ---- menus (main menu, lobby browser, lobby room, post-match: src/client/menus) ----

/** Clear in-match client state (match over or connection gone). */
function resetSession() {
  joined = false;
  selfId = -1;
  predictor.reset();
  outgoing = [];
  defs.clear();
  ground = [];
  ui.toggle(false);
  toggleTree(false);
  toggleChar(false);
  resetProgClient();
  toggleSkills(false);
  clearSkillFx();
  hudReset();
}

// ---- loot interaction -----------------------------------------------------

function selfPos(): { x: number; y: number } | null {
  if (!selfAlive || !predictor.initialized) return null;
  return { x: predictor.cur.x, y: predictor.cur.y };
}

function nearestGround(): number | null {
  const me = selfPos();
  if (!me) return null;
  let best: number | null = null;
  let bd = PICKUP_RANGE;
  for (const [g, x, y] of ground) {
    const d = Math.hypot(x - me.x, y - me.y);
    if (d <= bd) {
      bd = d;
      best = g;
    }
  }
  return best;
}

/** worldui: pick up now when in reach, else walk to the item first (cancelled by moving, dodging, skills, another click). */
function requestPickup(g: number, equip: boolean) {
  const me = selfPos();
  const e = ground.find((x) => x[0] === g);
  if (!me || !e || Math.hypot(e[1] - me.x, e[2] - me.y) <= PICKUP_RANGE) {
    pendingPickup = null;
    net.send({ t: "pickup", g, equip, ...(getSettings().game.autoEquip ? { ae: true } : {}) });
  } else pendingPickup = { g, equip, t: performance.now() };
}

/** worldui: world move vector toward the pending pickup (null = none / cancelled / arrived). */
function pendingPickupStep(moving: boolean): { x: number; y: number } | null {
  const pp = pendingPickup;
  if (!pp) return null;
  const e = ground.find((x) => x[0] === pp.g);
  const me = selfPos();
  if (moving || input.dodge || input.attackInPlace || input.skills.some(Boolean) || !e || !me || isFrozen() || performance.now() - pp.t > 6000) {
    pendingPickup = null;
    return null;
  }
  const dx = e[1] - me.x;
  const dy = e[2] - me.y;
  const d = Math.hypot(dx, dy);
  if (d <= PICKUP_RANGE - 8) {
    net.send({ t: "pickup", g: pp.g, equip: pp.equip, ...(getSettings().game.autoEquip ? { ae: true } : {}) });
    pendingPickup = null;
    return null;
  }
  return { x: dx / d, y: dy / d };
}

function onAction(act: Action) {
  switch (act.a) {
    case "pickup": {
      // In reach wins: the hovered item when it is in reach, else the nearest item in reach; a hovered label
      // out of reach is walked to only when nothing can be taken right now (else the key read as "did nothing").
      const me = selfPos();
      const hov = hoverG >= 0 ? ground.find((e) => e[0] === hoverG) : undefined;
      const hovNear = !!hov && !!me && Math.hypot(hov[1] - me.x, hov[2] - me.y) <= PICKUP_RANGE;
      const g = hov && hovNear ? hoverG : (nearestGround() ?? (hov ? hoverG : null));
      if (!hov && atShrine()) net.send({ t: "trial" }); // trial shrine (progression)
      else if (g !== null) requestPickup(g, act.equip); // worldui: walks to a hovered label out of reach
      break;
    }
    case "flask":
      net.send({ t: "flask", i: act.i });
      break;
    case "inventory":
      ui.toggle();
      break;
    case "weaponSwap":
      net.send({ t: "weaponSwap" });
      break;
    case "charm":
      net.send({ t: "charm", i: act.i });
      break;
    case "specPrev":
    case "specNext":
      if (!selfAlive) net.send({ t: "spec", dir: act.a === "specNext" ? 1 : -1 });
      break;
    case "close":
      handleEscape(); // closes open panels first, then opens the Esc menu
      break;
    case "panel":
      if (act.p === "skills") toggleSkills();
      else if (act.p === "map") renderer.bigMapOpen = !renderer.bigMapOpen;
      else if (act.p === "mapOverlay") renderer.mapOverlayOpen = !renderer.mapOverlayOpen;
      else if (act.p === "tree") toggleTree();
      else if (act.p === "character") toggleChar();
      else if (!menus.action(act.p)) handleOptionAction(act.a);
      break;
    default:
      if (!menus.action(act.a)) handleOptionAction(act.a);
  }
}

// Esc menu / options (settings.ts, keybinds.ts, options.ts)
let leaving = false;
registerPanel({ isOpen: () => ui.open, close: () => ui.toggle(false) });
registerPanel({ isOpen: () => renderer.bigMapOpen, close: () => (renderer.bigMapOpen = false), layer: "full" });
registerPanel({ isOpen: isTreeOpen, close: () => toggleTree(false), layer: "full" });
registerPanel({ isOpen: isCharOpen, close: () => toggleChar(false) });
initTreePanel((m) => net.send(m));
renderer.worldFx = (g, to, up) => drawProgWorld(g, to, up, selfAlive ? latestSelf : null);
let latestSelf: PlayerSnap | null = null;
// Music follows the match biome (world agent).
music.setState({ biome: currentBiome().id });
onMapChange((m) => music.setState({ biome: m.biome.id }));
initI18n();
initOptions({
  inMatch: () => joined,
  onLeave: () => {
    if (menus.leaveMatch()) return; // match loop: in a hall, leave the match but stay in the hall
    leaving = true;
    net.detach(); // closes the transport without its onClose; run ours to return to the join screen
    net.onClose();
  },
});

initInput(canvas, {
  enabled: () => joined,
  onAction,
  onCanvasClick: (x, y, shift) => {
    if (hudClick(x, y)) return true;
    const g = renderer.groundLabelAt(x, y);
    if (g === null) {
      pendingPickup = null; // worldui: any other click cancels walk-to-pickup
      return false;
    }
    requestPickup(g, shift); // worldui: walk to the item when out of reach
    return true;
  },
});

// ---- networking -----------------------------------------------------------

net.onOpen = () => menus.onOpen();

net.onClose = () => {
  const wasJoined = joined;
  resetSession();
  const left = leaving;
  leaving = false;
  menus.onDisconnected(left, wasJoined);
};

net.onMessage = (msg: ServerMsg) => {
  hudOnMessage(msg);
  audioOnMessage(msg);
  skillOnMessage(msg);
  switch (msg.t) {
    case "welcome":
      selfId = msg.id;
      joined = true;
      overlay.style.display = "none";
      canvas.focus();
      menus.onWelcome();
      showFirstHints();
      break;
    case "full":
      menus.status("Server is full.");
      break;
    case "pong": {
      const rtt = performance.now() - msg.c;
      ping = ping === 0 ? rtt : ping * 0.7 + rtt * 0.3;
      break;
    }
    case "stats":
      predictor.stats = sanitizeStats(msg.stats);
      ui.setStats(predictor.stats);
      setCharStats(predictor.stats);
      break;
    case "prog":
      setProg(msg);
      break;
    case "bshrine": // monsters agent: guarded buff shrines + my shrine buff
      setBuffShrines(msg);
      break;
    case "shrines":
      setShrines(msg.list);
      break;
    case "inv":
      selfHasShield = BASE_BY_ID.get(msg.equip.offhand?.b ?? "")?.sub === "shield";
      ui.setInv(msg);
      break;
    case "toast":
      if (msg.text.startsWith(HINT_PREFIX)) hudHint(msg.text.slice(HINT_PREFIX.length)); // low priority: left message log
      else ui.toast(msg.text);
      break;
    case "map":
      // Regenerate the match map locally from the server's params (renderer listens via onMapChange).
      setMap({ seed: msg.seed, players: msg.players, biome: (msg.biome || undefined) as MapParams["biome"], mode: msg.mode });
      break;
    case "lane":
      laneOnMessage(msg);
      break;
    case "noroom":
      ui.noRoom();
      break;
    case "snap":
      onSnap(msg);
      break;
  }
};

// Winner screen: any key or click (after 1.5 s) asks the host for the results now (hall matches only).
let endedSince = 0;
let skipSent = false;
const skipWinner = () => {
  if (phase !== "ended" || skipSent || performance.now() - endedSince < 1500) return;
  if (net.mode !== "p2p" && net.mode !== "host") return;
  skipSent = true;
  net.sendRaw({ t: "r-skip" });
};
window.addEventListener("keydown", (e) => { if (!e.repeat) skipWinner(); });
window.addEventListener("mousedown", skipWinner);

function onSnap(msg: SnapMsg) {
  if (msg.phase === "ended" && phase !== "ended") {
    endedSince = performance.now();
    skipSent = false;
    // The winner banner is centred on the screen: the docked panels would cover the ends of its lines.
    ui.toggle(false);
    toggleChar(false);
    toggleSkills(false);
    toggleSocial(false);
  }
  phase = msg.phase;
  phaseLeft = msg.phaseLeft;
  winner = msg.winner;
  alive = msg.alive;
  total = msg.total;
  lastSeen = msg.last ?? [];
  specId = msg.spec;
  hazards = msg.hazards;
  ground = msg.ground;
  if (msg.defs) for (const d of msg.defs) defs.set(d.g, d.it);
  if (defs.size > 3000) {
    // Ground ids are never reused; forget the oldest details we can't currently see.
    const visible = new Set(ground.map((e) => e[0]));
    for (const g of defs.keys()) {
      if (defs.size <= 2000) break;
      if (!visible.has(g)) defs.delete(g);
    }
  }
  if (msg.board) board = msg.board;
  if (msg.camps) camps = msg.camps;
  latestPlayers = new Map(msg.players.map((p) => [p.id, p]));
  interp.push(msg.tick, msg.players, msg.monsters, msg.projs, nowSec());

  const me = latestPlayers.get(selfId);
  if (me) {
    selfAlive = me.alive;
    selfLocked = HARD_CC.some((k) => hasAil(me.st, k));
    predictor.reconcile(me, msg.ack, isFrozen());
  }
  if (msg.events.length) renderer.onEvents(msg.events, selfId);
  if (msg.events.length) hitStopEvents(msg.events);
  if (msg.events.length) goreEvents(msg.events, selfId);
  if (msg.events.length) audioEvents(msg.events, selfId);
  skillOnSnap(me);
  if (msg.events.length) skillFxEvents(msg.events);
  if (msg.events.length) progEvents(msg.events, selfId);
  hudOnSnap(msg, selfId);
}

setInterval(() => {
  if (net.connected) net.send({ t: "ping", c: performance.now() });
}, PING_INTERVAL * 1000);

// ---- main loop ------------------------------------------------------------

let acc = 0;
let last = nowSec();
let camX = 1200;
let camY = 1200;

// ---- game feel: input buffering + hit-stop ----------------------------------------------------
/** A tap made while the hero is busy (swing, cast, roll, roll cooldown) is kept this long and fires on the first free tick. */
const TAP_BUFFER_MS = 300;
/** A buffered tap is sent on this many free ticks, then dropped (one could be lost to a reconciliation; two cannot double-fire: no use is shorter than 0.12 s). */
const TAP_SEND_TICKS = 2;
const tapSent = { skills: new Array<number>(taps.skills.length).fill(0), dodge: 0 };

/** Skill slots held this tick, plus buffered taps. `first` is the newest live tap: it wins over held slots (tap a skill while holding attack). */
function bufferedSkills(now: number, free: boolean): { held: boolean[]; first: number } {
  const held = input.skills.slice();
  let first = -1;
  for (let i = 0; i < taps.skills.length; i++) {
    const t = taps.skills[i];
    if (!t) continue;
    if (now - t > TAP_BUFFER_MS || tapSent.skills[i] >= TAP_SEND_TICKS) {
      taps.skills[i] = tapSent.skills[i] = 0;
      continue;
    }
    held[i] = true;
    if (first < 0 || t > taps.skills[first]) first = i;
  }
  if (first >= 0 && (free || tapSent.skills[first] > 0)) tapSent.skills[first]++; // counts from the first free tick on
  return { held, first };
}

/** Dodge held, or tapped within the buffer window and not yet rolled. */
function bufferedDodge(now: number): boolean {
  if (taps.dodge) {
    const canRoll = predictor.cur.rollCd <= 0 && predictor.cur.rollT <= 0;
    if (now - taps.dodge > TAP_BUFFER_MS || tapSent.dodge >= TAP_SEND_TICKS) taps.dodge = tapSent.dodge = 0;
    else {
      if (canRoll || tapSent.dodge > 0) tapSent.dodge++;
      return true;
    }
  }
  return input.dodge;
}

/**
 * Hit-stop: after one of your own hits lands the picture holds for a few frames (the frame that shows the
 * flash and the number), so a blow reads as contact. Simulation, prediction and networking keep running.
 * Follows Options > Graphics > Screen shake. Never more than one hold per HIT_STOP_GAP_MS.
 */
const HIT_STOP_MS = { hit: 0, heavy: 0, kill: 0, bigKill: 45 }; // camera: freezing the picture on every hit read as camera lag; only rare / unique kills hold now
const HIT_STOP_GAP_MS = 1500;
let hitStopPending = 0;
let hitStopUntil = 0;
function hitStopEvents(events: SnapMsg["events"]) {
  if (!getSettings().graphics.screenShake) return;
  let ms = 0;
  const mine = new Set<number>();
  for (const e of events) {
    if (e.k === "hit" && e.by === selfId && !e.dot && !e.sn && !(!e.m && e.target === selfId)) {
      if (e.m) mine.add(e.target);
      const heavy = e.cr || (e.mx !== undefined && e.mx > 0 && e.dmg >= e.mx * 0.25);
      ms = Math.max(ms, heavy ? HIT_STOP_MS.heavy : HIT_STOP_MS.hit);
    } else if (e.k === "mdie" && mine.has(e.id)) ms = Math.max(ms, e.el ? HIT_STOP_MS.bigKill : HIT_STOP_MS.kill);
  }
  if (ms > 0 && performance.now() - hitStopUntil > HIT_STOP_GAP_MS) hitStopPending = Math.max(hitStopPending, ms);
}

function inputStep() {
  // WASD is screen-relative (W = up on screen); convert to a world vector before the command
  // is built so prediction and the server see the same input.
  const keys = moveAxes();
  if (input.attackInPlace) keys.mx = keys.my = 0; // "attack in place" key: stand still while held
  let { mx, my } = screenMoveToWorld(keys.mx, keys.my);
  const walk = pendingPickupStep(keys.mx !== 0 || keys.my !== 0); // worldui: walk to a clicked label
  if (walk) ({ x: mx, y: my } = walk);
  // Aim at the hovered enemy itself (its body is drawn above its feet), else the ground under the cursor.
  const hp = renderer.hoverAimPoint();
  const angle = hp && Math.hypot(hp.x - predictor.cur.x, hp.y - predictor.cur.y) > 8
    ? Math.atan2(hp.y - predictor.cur.y, hp.x - predictor.cur.x)
    : renderer.aimAngle(input.mouseX, input.mouseY, predictor.cur.x, predictor.cur.y);
  // game feel: taps are buffered (a press during a swing / cast / roll fires when the hero is free) and the newest tap wins over held slots
  const nowMs = performance.now();
  const buf = bufferedSkills(nowMs, predictor.cur.atkCd <= 0 && predictor.cur.rollT <= 0);
  let held = heldSlot(buf.held); // skill bar: lowest held slot with a gem; slot 0 without one = basic attack
  if (buf.first >= 0) {
    const only = heldSlot(buf.held.map((h, i) => h && i === buf.first));
    if (only.attack || only.sk !== undefined) held = only;
  }
  const dodge = bufferedDodge(nowMs);
  const cmd = predictor.step(() => ({ mx, my, angle, attack: held.attack, dodge, ...(input.block && selfHasShield ? { blk: true } : held.sk !== undefined ? { sk: held.sk } : {}) }), isFrozen());
  outgoing.push(cmd);
}

function updateHoverTip() {
  hoverG = renderer.groundLabelAt(input.mouseX, input.mouseY) ?? -1;
  const item = hoverG >= 0 ? defs.get(hoverG) : undefined;
  if (item) {
    const pk = actionLabel("pickup");
    ui.showTip(item, input.mouseX, input.mouseY, true, `${pk} / click: pick up · Shift+${pk} / Shift+click: equip`);
  } else if (canvasTipShown) {
    // Only hide tooltips the canvas owns (inventory cells manage their own).
    ui.hideTip();
  }
  canvasTipShown = !!item;
  // worldui: context cursor (held item -> its ghost is the cursor; loot label; hostile; shrine; default)
  setWorldCursor(canvas, ui.holding ? "held" : !input.overCanvas ? "default" : hoverG >= 0 ? "loot" : (renderer.hoverKind() ?? "default"));
}
let canvasTipShown = false;
let drawMs = 0;

/**
 * Fixed-rate input / prediction / networking step. Shared by the rAF frame and the hidden-tab ticker
 * (engine: rAF stops while the tab or pane is hidden; the sim must keep stepping or nothing moves).
 */
function simStep(now: number): number {
  const dt = Math.min(0.25, Math.max(0, now - last));
  last = now;
  if (joined && predictor.initialized && !REPLAYING) {
    acc = Math.min(acc + dt, DT * 5);
    while (acc >= DT) {
      inputStep();
      acc -= DT;
    }
    if (outgoing.length) {
      net.send({ t: "input", cmds: outgoing });
      outgoing = [];
    }
    autoPickupTick(performance.now(), selfPos(), ground, (g) => {
      const it = defs.get(g);
      return it ? itemCategory(it) : null;
    }, PICKUP_RANGE, (g) => net.send({ t: "pickup", g, equip: false, ...(getSettings().game.autoEquip ? { ae: true } : {}) }));
  }
  predictor.decay(dt);
  return dt;
}

function frame() {
  lastRafMs = performance.now();
  if (!frameAllowed(performance.now())) {
    requestAnimationFrame(frame); // FPS cap (Graphics option)
    return;
  }
  const now = nowSec();
  const dt = simStep(now);
  if (performance.now() < hitStopUntil) {
    requestAnimationFrame(frame); // hit-stop: hold the last picture (the sim above keeps stepping)
    return;
  }

  // Remote entities interpolated in the past; self from prediction.
  const sampled = interp.sample(now);
  const players = sampled.players;
  setFxPlayers(players);
  let self: PlayerSnap | null = null;
  const meSnap = latestPlayers.get(selfId);
  if (REPLAYING) {
    // dev replay: the recorded player is drawn like any remote one (interpolated), never predicted
    self = players.get(selfId) ?? null;
  } else if (meSnap && predictor.initialized) {
    const pos = predictor.renderPos(acc / DT);
    self = { ...meSnap, ...predictor.cur, x: pos.x, y: pos.y };
    players.set(selfId, self);
  }
  latestSelf = self;
  layoutProgHud(joined, renderer.panelTopCss());

  let spectating: PlayerSnap | null = null;
  if (self?.alive) {
    camX = self.x;
    camY = self.y;
  } else {
    spectating = players.get(specId) ?? null;
    if (spectating && spectating.alive) {
      camX += (spectating.x - camX) * Math.min(1, dt * 8);
      camY += (spectating.y - camY) * Math.min(1, dt * 8);
    } else if (self) {
      camX = self.x;
      camY = self.y;
    }
  }

  let viewX = camX;
  let viewY = camY;
  if (CINE) {
    // dev-only cinematic camera: overrides this frame's view only (camX / camY keep following as usual)
    const c = cineApply(camX, camY);
    if (c) {
      viewX = c.x;
      viewY = c.y;
      (renderer as unknown as { zoomTarget: number }).zoomTarget = c.zoom;
    }
  }

  const groundView: GroundView[] = ground.map(([g, x, y]) => ({ g, x, y, item: defs.get(g) }));

  const view: View = {
    selfId,
    self,
    selfStats: predictor.stats,
    players,
    monsters: sampled.monsters,
    projs: sampled.projs,
    hazards,
    ground: groundView,
    flasks: ui.flasks,
    phase,
    phaseLeft,
    winner,
    alive,
    total,
    last: lastSeen,
    ping,
    camX: viewX,
    camY: viewY,
    spectating,
    showScoreboard: input.scoreboard,
    connected: net.connected,
    board,
    camps,
    hoverG,
    pendingG: pendingPickup?.g ?? -1, // worldui
  };
  const t0 = performance.now();
  goreFrame(view, dt); // gore sim (gfx/gore); its layers draw inside renderer.draw
  // Idle-time art warm-up (decode before first use): generous in the menu / lobby, a thin slice in a fight.
  prewarmTick(joined && phase === "fight" ? 1.5 : 6, currentBiome().id);
  renderer.draw(view, dt * goreTimeScale()); // PvP-kill hit-stop
  if (hitStopPending > 0) {
    hitStopUntil = performance.now() + hitStopPending; // starts after the frame that shows the impact
    hitStopPending = 0;
  }
  hudFrame(view, joined);
  goreScreen(canvas.getContext("2d")!, canvas.width, canvas.height);
  audioSetView(view);
  audioFrame(view, joined);
  drawMs = drawMs * 0.95 + (performance.now() - t0) * 0.05;
  if (joined) updateHoverTip();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// ---- hidden-tab ticker ----------------------------------------------------
// rAF does not fire while the tab / pane is hidden, so a ~30 Hz background tick keeps simulation,
// prediction and networking stepping (no drawing). It also covers a stalled rAF (a hidden pane that
// still reports visible). A tiny Worker timer is used because page timers are throttled to ~1 Hz
// in background tabs; plain setTimeout is the fallback when Workers are unavailable.
let lastRafMs = performance.now();
const BG_TICK_MS = 33;
function bgTick() {
  const nowMs = performance.now();
  if (!document.hidden && nowMs - lastRafMs < 250) return; // rAF is running: it owns the loop
  simStep(nowMs / 1000);
}
(function startBgTicker() {
  try {
    const src = "let id=0;onmessage=(e)=>{clearInterval(id);if(e.data>0)id=setInterval(()=>postMessage(0),e.data);};";
    const url = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
    const w = new Worker(url);
    w.onmessage = bgTick;
    w.onerror = () => {
      w.terminate();
      timeoutTicker();
    };
    w.postMessage(BG_TICK_MS);
    return;
  } catch {
    /* CSP / no Worker support: fall through */
  }
  timeoutTicker();
  function timeoutTicker() {
    const loop = () => {
      bgTick();
      setTimeout(loop, BG_TICK_MS);
    };
    setTimeout(loop, BG_TICK_MS);
  }
})();

const menus = initMenus({ net, overlay, resetMatch: resetSession, focusGame: () => canvas.focus() });
initJoinScreen(overlay);
if (REPLAYING) startReplay((c) => menus.replayAttach?.(c)); // dev replay (?dev=1&replay=...)

// Console helpers for solo testing (the server ignores dev commands unless HNS_DEV=1).
Object.assign(window, {
  hnsDev: (cmd: string, args: Record<string, unknown> = {}) => net.send({ t: "dev", cmd, ...args }),
  hnsSelf: () => ({ x: predictor.cur.x, y: predictor.cur.y, angle: predictor.cur.angle }),
  hnsProf: () => Object.fromEntries(Object.entries(renderer.prof).map(([k, v]) => [k, Math.round(v * 100) / 100])),
  hnsFps: () => ({ fps: renderer.fpsEstimate, drawMs: Math.round(drawMs * 100) / 100 }),
  hnsFaded: () => (renderer as unknown as { propFadeA: Map<number, number> }).propFadeA.size, // props faded over an actor
});
