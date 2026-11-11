// Glue between the game client and the audio: turns snapshots, events and outgoing messages into
// sounds, and drives the music state. main.ts calls audioFrame / audioEvents / audioOnMessage and
// hookNetAudio once; nothing here changes game state.
import { CURRENCY_BY_ID, isCurrency } from "../../shared/content/currency";
import { SKILL_GEM_BY_ID, type SkillGemDef } from "../../shared/content/gems";
import { MONSTER_BY_ID } from "../../shared/content/monsters";
import { isFlask, type Item } from "../../shared/items";
import { currentBiome, currentMap, isWaterAt } from "../../shared/map";
import type { ClientMsg, GameEvent, MonsterSnap, Phase, PlayerSnap, ServerMsg } from "../../shared/protocol";
import { isGem } from "../../shared/skills";
import { isStructKind } from "../../shared/lanes";
import { ambience } from "./ambience";
import { setListener } from "./engine";
import { music, type MusicScene } from "./music";
import { sfx } from "./sfx";

/** Typical length of a weapon whoosh (s); see the swing trigger below. */
const SWING_SFX_LEN = 0.22;

/** The subset of the renderer's View that audio reads. */
export interface AudioView {
  selfId: number;
  self: PlayerSnap | null;
  players: Map<number, PlayerSnap>;
  monsters: Map<number, MonsterSnap>;
  ground: { g: number; x: number; y: number; item: Item | undefined }[];
  phase: Phase;
  phaseLeft: number;
  winner: string | null;
  alive: number;
  total: number;
  camX: number;
  camY: number;
}

const now = () => performance.now() / 1000;

// ---- state ------------------------------------------------------------------------------

let menuScene: MusicScene = "menu";
/** Which scene plays while not in a match (the lobby / menus agent can switch to "lobby"). */
export function setMenuScene(s: MusicScene) {
  menuScene = s;
}

interface PTrack {
  x: number;
  y: number;
  atkT: number;
  rollT: number;
  acc: number;
  foot: number;
}
const ptrack = new Map<number, PTrack>();
const mtrack = new Map<number, { s: number; growlAt: number }>();
const mkinds = new Map<number, string>();
const knownGround = new Set<number>();
let groundPrimed = false;
let lastPhase: Phase | null = null;
let lastCountSec = -1;
let fewPlayed = false;
let heat = 0;
let lastT = now();
let lastGrowl = 0;
let selfName = "";
let joinedPrev = false;
let pendingPickup = 0;
let invOpen = false;
let frameN = 0;
let bossNear = 0;

// ---- per frame --------------------------------------------------------------------------

export function audioFrame(view: AudioView, joined: boolean) {
  const t = now();
  const dt = Math.min(0.25, t - lastT);
  lastT = t;
  frameN++;
  setListener(view.camX, view.camY);

  if (!joined) {
    if (joinedPrev) resetTracking();
    joinedPrev = false;
    music.setState({ scene: menuScene, combat: 0, late: 0, boss: 0 });
    ambience.setShrine(null);
    return;
  }
  joinedPrev = true;
  if (view.self) selfName = view.self.name;

  const biome = currentBiome().id;
  trackPlayers(view, biome);
  const nearMon = trackMonsters(view);
  trackGround(view);
  trackPhase(view);
  if ((frameN & 7) === 0) trackPanels();

  // music intensity: recent combat heat, aggroed monsters near, other living players near
  heat = Math.max(0, heat - dt * 0.12);
  let near = 0;
  if (view.self) {
    for (const p of view.players.values()) {
      if (p.id === view.selfId || !p.alive) continue;
      const d = Math.hypot(p.x - view.self.x, p.y - view.self.y);
      if (d < 750) near += 1 - d / 750;
    }
  }
  const combat = Math.min(1, Math.max(heat, nearMon * 0.55, Math.min(0.7, near * 0.45)));
  let late = 0;
  if (view.phase === "fight" && view.total >= 3) late = view.alive <= 2 ? 1 : view.alive <= 3 ? 0.7 : view.alive <= 5 ? 0.3 : 0;
  music.setState({ scene: "match", biome, combat, late, boss: bossNear, lanes: currentMap().params.mode === "lanes" });
  if ((frameN & 15) === 0) nearestShrine(view);
}

// guarded buff shrines (from "bshrine" messages): the nearest unused one hums
let shrineList: [number, number, number, string, 0 | 1][] = [];
let hadBuff = false;
function nearestShrine(view: AudioView) {
  let best: { x: number; y: number } | null = null;
  let bd = 900;
  for (const s of shrineList) {
    if (s[4]) continue;
    const d = Math.hypot(s[1] - view.camX, s[2] - view.camY);
    if (d < bd) {
      bd = d;
      best = { x: s[1], y: s[2] };
    }
  }
  ambience.setShrine(best);
}

function resetTracking() {
  ptrack.clear();
  mtrack.clear();
  knownGround.clear();
  groundPrimed = false;
  lastPhase = null;
  fewPlayed = false;
  heat = 0;
  bossNear = 0;
  shrineList = [];
  hadBuff = false;
}

function stepId(biome: string, x: number, y: number, n: number): string {
  if (isWaterAt(x, y)) return "step.water";
  if (biome === "gloamwater") return n % 3 === 0 ? "step.dirt" : "step.mud";
  if (biome === "brokenspire") return n % 4 === 0 ? "step.dirt" : "step.stone";
  return n % 2 ? "step.grass" : "step.dirt";
}

function trackPlayers(view: AudioView, biome: string) {
  const seen = new Set<number>();
  for (const p of view.players.values()) {
    seen.add(p.id);
    const isSelf = p.id === view.selfId;
    let tr = ptrack.get(p.id);
    if (!tr) {
      ptrack.set(p.id, { x: p.x, y: p.y, atkT: p.atkT, rollT: p.rollT, acc: 0, foot: 0 });
      continue;
    }
    if (p.alive) {
      if (p.atkT > tr.atkT + 0.02) {
        const id = sfx.swingFor(p.wk);
        if (p.wk === "bow") sfx.play("bow.draw", { x: p.x, y: p.y, vol: 0.6 });
        // game feel: the whoosh (about SWING_SFX_LEN long) ends on the hit (the commit point, half-way into the
        // swing) instead of starting with the wind-up, which left a silent gap before the impact on slow weapons
        sfx.play(id, { x: p.x, y: p.y, vol: isSelf ? 1 : 0.8, delay: p.wk === "bow" ? Math.min(0.25, p.atkT * 0.5) : Math.min(0.6, Math.max(0, p.atkT * 0.5 - SWING_SFX_LEN)) });
      }
      if (p.rollT > tr.rollT + 0.05) sfx.play("dodge.roll", { x: p.x, y: p.y, vol: isSelf ? 1 : 0.8 });
      const d = Math.hypot(p.x - tr.x, p.y - tr.y);
      if (d < 60 && p.rollT <= 0) {
        tr.acc += d;
        if (tr.acc > 62) {
          tr.acc = 0;
          tr.foot++;
          sfx.play(stepId(biome, p.x, p.y, tr.foot), { x: p.x, y: p.y, vol: isSelf ? 0.85 : 0.6 });
        }
      } else if (d >= 60) tr.acc = 0;
    }
    tr.x = p.x;
    tr.y = p.y;
    tr.atkT = p.atkT;
    tr.rollT = p.rollT;
  }
  for (const id of ptrack.keys()) if (!seen.has(id)) ptrack.delete(id);
}

/** Returns 0..1 "monsters engaged near the listener". */
function trackMonsters(view: AudioView): number {
  const t = now();
  let engaged = 0;
  let boss = 0;
  const seen = new Set<number>();
  for (const m of view.monsters.values()) {
    seen.add(m.id);
    mkinds.set(m.id, m.k);
    const fam = sfx.monFamily(m.k);
    let tr = mtrack.get(m.id);
    if (!tr) {
      tr = { s: m.s, growlAt: 0 };
      mtrack.set(m.id, tr);
      continue;
    }
    if (m.s !== tr.s) {
      if (m.s === 1 && tr.s === 0 && t - tr.growlAt > 4 && t - lastGrowl > 0.35) {
        tr.growlAt = t;
        lastGrowl = t;
        sfx.play(`mon.${fam}.growl`, { x: m.x, y: m.y, vol: m.e ? 1 : 0.8 });
      }
      if (m.s === 2) {
        sfx.play(`mon.${fam}.attack`, { x: m.x, y: m.y });
        if (fam === "brute") sfx.play("mon.windup", { x: m.x, y: m.y });
      }
      tr.s = m.s;
    }
    if ((m.s === 1 || m.s === 2) && Math.hypot(m.x - view.camX, m.y - view.camY) < 650) engaged += m.e ? 0.6 : 0.3;
    if ((m.s === 1 || m.s === 2) && MONSTER_BY_ID.get(m.k)?.ai === "boss" && Math.hypot(m.x - view.camX, m.y - view.camY) < 900) boss = 1;
  }
  for (const id of mtrack.keys()) if (!seen.has(id)) mtrack.delete(id);
  if (mkinds.size > 600) for (const id of mkinds.keys()) if (!seen.has(id)) mkinds.delete(id);
  bossNear = boss;
  return Math.min(1, engaged);
}

export function lootSoundFor(it: Item | undefined): string {
  if (!it) return "loot.normal";
  const r = it.r;
  if (r === 3) return "loot.unique";
  if (isCurrency(it)) return (CURRENCY_BY_ID.get(it.b)?.weight ?? 99) <= 4 ? "loot.currency.rare" : "loot.currency";
  if (isGem(it)) return "loot.gem";
  if (isFlask(it)) return "loot.flask";
  return r === 2 ? "loot.rare" : r === 1 ? "loot.magic" : "loot.normal";
}

function trackGround(view: AudioView) {
  let played = 0;
  const seen = new Set<number>();
  for (const g of view.ground) {
    seen.add(g.g);
    if (knownGround.has(g.g) || !g.item) continue; // wait for details before the clink
    knownGround.add(g.g);
    if (groundPrimed && played < 4) {
      played++;
      sfx.play(lootSoundFor(g.item), { x: g.x, y: g.y, delay: played * 0.04 });
    }
  }
  for (const g of knownGround) if (!seen.has(g)) knownGround.delete(g);
  groundPrimed = true;
}

function trackPhase(view: AudioView) {
  if (view.phase !== lastPhase) {
    if (lastPhase !== null) {
      if (view.phase === "countdown") sfx.play("round.countdown");
      else if (view.phase === "fight") {
        sfx.play("round.start");
        fewPlayed = false;
      } else if (view.phase === "ended") sfx.play(view.winner && view.winner === selfName ? "victory" : "defeat");
    }
    lastPhase = view.phase;
  }
  if (view.phase === "countdown") {
    const s = Math.ceil(view.phaseLeft);
    if (s !== lastCountSec && s <= 5 && s > 0) sfx.play("round.countdown", { pitch: s === 1 ? 1.5 : 1 });
    lastCountSec = s;
  }
  if (view.phase === "fight" && view.total >= 4 && view.alive <= 3 && !fewPlayed) {
    fewPlayed = true;
    sfx.play("players.few");
  }
}

function trackPanels() {
  const el = typeof document !== "undefined" ? document.getElementById("inv-panel") : null;
  if (!el) return;
  const open = el.offsetParent !== null && getComputedStyle(el).display !== "none";
  if (open !== invOpen) sfx.play(open ? "ui.open" : "ui.close");
  invOpen = open;
}

// ---- events -----------------------------------------------------------------------------

const ELEM: Record<string, string> = { f: "fire", c: "cold", l: "lightning", x: "chaos" };
const projSkill = new Map<number, string>();
let lastBurn = 0;
let lastChill = 0;

function skillElem(d: SkillGemDef | undefined): string | null {
  if (!d) return null;
  for (const e of ["fire", "cold", "lightning", "chaos"]) if ((d.tags as string[]).includes(e)) return e;
  return null;
}

/** Cast sound id for a skill gem id (archetype by kind, element by tags). */
export function skillCastSound(sid: string): string | null {
  const d = SKILL_GEM_BY_ID.get(sid);
  if (!d) return "skill.projectile";
  const el = skillElem(d);
  switch (d.kind) {
    case "strike":
      return null; // weapon swing covers it
    case "slam":
      return null; // the landing makes the noise
    case "chain":
      return "skill.chain";
    case "dash":
      return "skill.dash";
    case "buff":
      return "skill.buff";
    case "aura":
      return "skill.aura";
    case "totem":
      return "skill.summon";
    case "cone":
      return el ? `skill.${el}` : "skill.nova";
    case "volley":
    case "bolt":
      return el ? `skill.${el}` : "skill.projectile";
    default:
      return el ? `skill.${el}` : "skill.nova";
  }
}

function playerPos(id: number, view: { players: Map<number, PlayerSnap> } | null) {
  const p = view?.players.get(id);
  return p ? { x: p.x, y: p.y } : {};
}
let lastView: AudioView | null = null;
export function audioSetView(v: AudioView) {
  lastView = v;
}

export function audioEvents(events: GameEvent[], selfId: number) {
  for (const e of events) {
    switch (e.k) {
      case "hit": {
        const self = !e.m && e.target === selfId;
        const mine = e.by === selfId;
        if (self || mine) heat = Math.min(1, heat + (self ? 0.35 : 0.2));
        const fam = e.m ? sfx.monFamily(mkinds.get(e.target) ?? "") : null;
        let id = "hit.flesh";
        if (e.cr) id = "hit.crit";
        else if (fam === "brute") id = "hit.stone";
        else if (e.es && e.es >= e.dmg * 0.5) id = "hit.armour";
        const vol = Math.min(1.2, 0.6 + e.dmg / 60) * (mine || self ? 1 : 0.75);
        sfx.play(id, { x: e.x, y: e.y, vol });
        if (self) sfx.play("hit.self");
        const el = e.dt ? ELEM[e.dt] : undefined;
        if (el) sfx.play(`impact.${el}`, { x: e.x, y: e.y, vol: 0.45 });
        if (e.cr && e.dt === "c") sfx.play("ailment.freeze", { x: e.x, y: e.y });
        if (e.cr && e.dt === "l") sfx.play("ailment.shock", { x: e.x, y: e.y });
        if (e.cr && e.dt === "f") sfx.play("ailment.ignite", { x: e.x, y: e.y });
        if (fam && Math.random() < 0.3) sfx.play(`mon.${fam}.hurt`, { x: e.x, y: e.y, vol: 0.7 });
        break;
      }
      case "evade":
        sfx.play("hit.evade", { x: e.x, y: e.y });
        break;
      case "kill":
        if (e.vid === selfId) sfx.play("player.death");
        else if (selfName && e.killer === selfName) sfx.play("kill.player");
        else sfx.play("kill.distant", { vol: 0.8 });
        break;
      case "gold":
        if (e.id === selfId) sfx.play("lane.gold");
        break;
      case "wp":
        sfx.play("lane.waypoint", { x: e.x2, y: e.y2 });
        break;
      case "mdie": {
        if (isStructKind(e.mk)) {
          sfx.play("struct.collapse", { x: e.x, y: e.y }); // Breachway: a structure falls (no monster death cry)
          break;
        }
        const fam = sfx.monFamily(e.mk);
        sfx.play(`mon.${fam}.death`, { x: e.x, y: e.y, vol: e.el ? 1.2 : 1 });
        heat = Math.min(1, heat + 0.05);
        break;
      }
      case "heal":
        if (e.target === selfId) sfx.play("flask.drink");
        else sfx.play("flask.drink", { ...playerPos(e.target, lastView), vol: 0.6 });
        break;
      case "boom":
        sfx.play("boom", { x: e.x, y: e.y });
        break;
      case "lvl":
        if (e.id === selfId) sfx.play(e.asc ? "ascendancy" : "levelup");
        else sfx.play("levelup", { x: e.x, y: e.y, vol: 0.4 });
        break;
      case "fx":
        onSkillFx(e.f, selfId);
        break;
    }
  }
}

type SkillFxEv = Extract<GameEvent, { k: "fx" }>["f"];

function onSkillFx(f: SkillFxEv, selfId: number) {
  const t = now();
  switch (f.e) {
    case "cast": {
      const id = skillCastSound(f.s);
      if (id) sfx.play(id, { x: f.x, y: f.y, vol: f.p === selfId ? 1 : 0.8 });
      if (f.r && f.tx !== undefined) sfx.play("mon.windup", { x: f.tx, y: f.ty, vol: 0.5 });
      if (f.p === selfId) heat = Math.min(1, heat + 0.1);
      break;
    }
    case "land": {
      const d = SKILL_GEM_BY_ID.get(f.s);
      if (d?.kind === "slam") sfx.play("skill.slam", { x: f.x, y: f.y });
      break;
    }
    case "proj":
      projSkill.set(f.id, f.s);
      if (projSkill.size > 300) projSkill.delete(projSkill.keys().next().value as number);
      break;
    case "pend": {
      const s = projSkill.get(f.id);
      projSkill.delete(f.id);
      if (!f.hit) break;
      const el = skillElem(s ? SKILL_GEM_BY_ID.get(s) : undefined);
      sfx.play(el ? `impact.${el}` : "impact.projectile", { x: f.x, y: f.y, vol: 0.8 });
      break;
    }
    case "chain":
      if (f.pts.length >= 4) sfx.play("impact.lightning", { x: f.pts[f.pts.length - 2], y: f.pts[f.pts.length - 1], vol: 0.6 });
      break;
    case "buff":
      break; // cast already played skill.buff
    case "aura":
      if (f.on) sfx.play("skill.aura", { ...playerPos(f.p, lastView), vol: 0.7 });
      break;
    case "totem":
      break; // cast covers it
    case "burn":
      if (t - lastBurn > 0.6) {
        lastBurn = t;
        sfx.play("ailment.ignite", { x: f.x, y: f.y, vol: 0.5 });
      }
      break;
    case "chill":
      if (t - lastChill > 0.8) {
        lastChill = t;
        sfx.play("ailment.chill", { x: f.x, y: f.y, vol: 0.6 });
      }
      break;
  }
}

// ---- messages ---------------------------------------------------------------------------

export function audioOnMessage(msg: ServerMsg) {
  switch (msg.t) {
    case "noroom":
      sfx.play("ui.error");
      break;
    case "bshrine":
      shrineList = msg.list;
      if (msg.buff && !hadBuff) sfx.play("shrine.buff");
      hadBuff = !!msg.buff;
      break;
    case "inv":
      if (now() - pendingPickup < 1.5) {
        pendingPickup = 0;
        sfx.play("loot.pickup");
      }
      break;
  }
}

/** Wrap net.send so outgoing inventory / progression actions make their UI sounds. */
export function hookNetAudio(net: { send: (m: ClientMsg) => void }) {
  const orig = net.send.bind(net);
  net.send = (m: ClientMsg) => {
    try {
      onSend(m);
    } catch {
      /* never break networking for a sound */
    }
    orig(m);
  };
}

function onSend(m: ClientMsg) {
  switch (m.t) {
    case "pickup":
      pendingPickup = now();
      break;
    case "equip":
      sfx.play("inv.equip");
      break;
    case "unequip":
    case "split":
    case "unsocket":
      sfx.play("inv.pick");
      break;
    case "move":
      sfx.play("inv.place");
      break;
    case "drop":
      sfx.play("inv.drop");
      break;
    case "alloc":
    case "ascalloc":
      sfx.play("passive.allocate");
      break;
    case "ascend":
      sfx.play("ascendancy");
      break;
    case "trial":
      sfx.play("shrine.trial");
      break;
    case "socket":
      sfx.play("gem.socket");
      break;
    case "useCurrency":
      sfx.play("loot.currency", { vol: 0.8 });
      break;
    case "join":
      sfx.play("ui.confirm");
      break;
  }
}
