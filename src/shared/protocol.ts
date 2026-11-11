// Network message shapes (JSON over WebSocket).
import type { Slot, WeaponKind } from "./content/types";
import type { Item } from "./items";
import type { GridEntry } from "./grid";
import type { Stats } from "./stats";
import type { AilmentKind, AilShort, AilSnap } from "./ailments";
import type { DamageType } from "./defence";
import type { ProgMsg, ShrinesMsg } from "./progression";
import type { BarMsg, CdMsg, SkillFx } from "./skills";

export type Phase = "waiting" | "countdown" | "fight" | "ended";

/** One fixed-timestep worth of player intent. */
export interface InputCmd {
  seq: number;
  mx: number; // -1..1
  my: number; // -1..1
  angle: number; // facing, radians
  attack: boolean;
  dodge: boolean;
  sk?: number; // held skill bar slot 0..15 (shared/skills.ts)
  blk?: boolean; // shield raised (held; only honoured with a shield equipped, see shared/sim.ts)
}

/** The part of a player's state that the movement simulation touches. */
export interface PhysState {
  x: number;
  y: number;
  angle: number;
  kbx: number;
  kby: number;
  rollT: number; // time left in the current dodge roll
  rollCd: number;
  rollDx: number;
  rollDy: number;
  atkT: number;
  atkCd: number;
}

export interface PlayerSnap extends PhysState {
  id: number;
  name: string;
  color: string;
  hp: number;
  maxHp: number;
  // Public, render-only stats so others can see your weapon reach/arc.
  atkRange: number;
  atkArc: number;
  swingTime: number;
  wk: WeaponKind | null; // equipped weapon kind (null = unarmed)
  lk: string; // paper-doll look code (see shared/look.ts)
  lv?: number; // character level (progression)
  cl?: number; // class look index 1..8 (content/classes.ts look / tint)
  mp?: number; // current mana (skills)
  es?: number; // current energy shield (server/damage.ts)
  esm?: number; // max energy shield
  st?: AilSnap; // ailment status / buildup meters (shared/ailments.ts)
  alive: boolean;
  tm?: 0 | 1; // Breachway lane mode: team
}

export interface MonsterSnap {
  id: number;
  k: string; // monster type id
  x: number;
  y: number;
  a: number; // facing
  hp: number;
  mhp: number;
  r: number; // radius
  s: 0 | 1 | 2 | 3; // idle / chase / winding up / returning
  w: number; // windup progress 0..1 (0 when not winding up)
  e?: string[]; // elite modifier ids
  n?: string; // elite name
  st?: AilSnap; // ailment status / buildup meters (shared/ailments.ts)
  // ---- monsters agent (server/ai) ----
  rr?: 1 | 2 | 3; // rarity: magic / rare / unique (absent = normal)
  gm?: string; // modifier granted by the pack's rare leader
  at?: string; // attack id being wound up
  ph?: number; // boss phase (0-based); roaring while iv is set
  iv?: 1; // invulnerable right now (phasing, last breath, boss roar, exile roll)
  bb?: number; // immunity bubble radius (Veiled Sphere) / near-only range (negative)
  lk?: string; // rogue exile paper-doll look code
  wk?: string; // rogue exile weapon kind
  cl?: string; // rogue exile colour
  rl?: 1; // rogue exile is dodge-rolling
  tm?: 0 | 1; // Breachway lane mode: team (mobs, exiles, structures)
}

export interface ProjSnap {
  id: number;
  x: number;
  y: number;
  r: number;
}

/** Telegraphed area attack (brute slam, death blast). */
export interface HazardSnap {
  id: number;
  x: number;
  y: number;
  r: number;
  f: number; // 0..1 progress to detonation
  // ---- shaped / lingering hazards (monsters agent) ----
  sh?: "cone" | "line" | "pool" | "ring"; // absent = circle
  a?: number; // cone / line direction (world angle)
  arc?: number; // cone width (radians)
  len?: number; // line length
  w?: number; // line width
  c?: string; // tint (css)
}

/** Ground item position: [groundId, x, y]. Details are sent once per client in `defs`. */
export type GroundSnap = [number, number, number];

export interface BoardEntry {
  id: number;
  name: string;
  color: string;
  kills: number;
  wins: number;
  alive: boolean;
}

/** Monster camp marker for the minimap. */
export interface CampSnap {
  x: number;
  y: number;
  n: number; // living monsters
  e: boolean; // has a living elite
}

/** Optional gore hints on hit / kill / mdie events (client gfx/gore). All fields optional; omit when unknown. */
export interface GoreFx {
  dt?: "p" | "f" | "c" | "l" | "x"; // dominant damage type: phys / fire / cold / lightning / chaos
  cr?: 1; // critical strike
  es?: number; // damage absorbed by energy shield (no blood for this part)
  lf?: number; // damage dealt to life
  mx?: number; // victim max life
  ok?: number; // overkill (damage beyond remaining life) on the killing blow
  dx?: number; // hit direction (world, unit vector from attacker to victim)
  dy?: number;
  fo?: "melee" | "proj" | "spell" | "area" | "dot"; // hit form (area = slams / explosions)
  bl?: 1; // victim is bleeding (ailment)
}

export type GameEvent =
  // m: target is a monster. Defence fields (server/damage.ts): ty dominant damage type, es absorbed by energy shield,
  // rs resisted amount, o "deflect" for a deflected hit, dot 1 for damage-over-time ticks.
  | ({ k: "hit"; x: number; y: number; target: number; by: number; dmg: number; m?: 1; ty?: DamageType; es?: number; rs?: number; o?: "deflect"; dot?: 1; sn?: string } & GoreFx) // sn: source name when the attacker is not a player (death recap, royale HUD)
  | ({ k: "kill"; killer: string; victim: string; vid: number; x: number; y: number; kid?: number; pl?: number } & GoreFx)
  | ({ k: "mdie"; id: number; mk: string; x: number; y: number; r: number; a: number; el?: 1 } & GoreFx) // monster died (death animation)
  | { k: "heal"; target: number }
  | { k: "boom"; x: number; y: number; r: number }
  | { k: "info"; text: string }
  | { k: "lvl"; id: number; lv: number; x: number; y: number; asc?: 1 } // level up (asc: ascended)
  | { k: "evade"; target: number; x: number; y: number; cd?: 1 } // hit evaded (cd: cheat death / second wind)
  | { k: "fx"; f: SkillFx } // skill effect (shared/skills.ts)
  | { k: "def"; target: number; x: number; y: number; o: "evade" | "block" | "deflect" | "immune"; m?: 1 } // hit avoided (server/damage.ts)
  | { k: "ail"; target: number; a: AilmentKind; x: number; y: number; m?: 1 }; // ailment triggered (server/damage.ts)

/** Where an inventory item can be equipped: a gear slot or a flask slot (0..2). */
export type EquipTarget = Slot | `flask${0 | 1 | 2}` | `charm${0 | 1 | 2}`;

export type ClientMsg =
  | { t: "join"; name: string; weapon: WeaponKind; cls?: string } // cls: class id (content/classes.ts); its starter weapon wins
  // Progression (server/progression.ts)
  | { t: "alloc"; id: string } // allocate a passive tree node
  | { t: "ascalloc"; id: string } // allocate an ascendancy node
  | { t: "ascend"; id: string } // choose an ascendancy (after clearing a trial)
  | { t: "trial" } // activate a nearby trial shrine
  | { t: "jewel"; node?: string; id?: number } // socket grid jewel `id` into tree socket `node` (no id: take it out; no node: first free socket)
  | { t: "input"; cmds: InputCmd[] }
  | { t: "ping"; c: number }
  | { t: "pickup"; g: number; equip?: boolean; ae?: boolean } // ground item; equip = equip directly
  // Inventory (see shared/grid.ts). Items are addressed by item id.
  | { t: "equip"; id: number; to?: EquipTarget } // grid item (or an equipped one, to move slots) into a slot
  | { t: "unequip"; from: EquipTarget; x?: number; y?: number } // to the grid: at (x, y), else first fit
  | { t: "move"; id: number; x: number; y: number } // grid item to (x, y); swaps with a single overlapped item
  | { t: "drop"; id: number } // grid or equipped item to the ground
  | { t: "split"; id: number; n: number; x?: number; y?: number } // take n off a stack into the grid (at x, y, else first fit)
  | { t: "useCurrency"; id: number; on: number } // apply currency stack `id` to item `on` (server/crafting.ts)
  | { t: "weaponSwap" } // swap the active weapon set (mainhand/offhand) with the inactive one
  | { t: "charm"; i: number } // manually fire charm slot i (server/charms.ts)
  | { t: "flask"; i: number } // use flask slot i
  // Skills (server/skills.ts): gem `id` from the grid into bar slot `slot` (sup: support socket; inner: a meta gem's spell)
  | { t: "socket"; id: number; slot: number; sup?: number; inner?: 1 }
  | { t: "unsocket"; slot: number; sup?: number; inner?: 1 }
  | { t: "cut"; id: number; gem?: string; target?: number } // rough crystal: cut into gem, or raise gem item `target`
  | { t: "spec"; dir: 1 | -1 } // cycle spectate target while dead (server/hudsnap.ts)
  // In-match chat (menus/ingame.ts -> server/host.ts). to: whisper target name; item: id of a carried item to link.
  | { t: "chat"; text: string; to?: string; item?: number }
  | { t: "dev"; cmd: string; [k: string]: unknown } // only when the server runs with HNS_DEV=1
  // Breachway shop (server/modes/lanes.ts): gamble a slot, buy a rough crystal (lv: crystal level / support tier), sell item `id`.
  | { t: "shop"; a: "gamble" | "skill" | "support" | "spirit" | "sell"; slot?: string; lv?: number; id?: number };

/** Breachway HUD state for one player. */
export interface LaneMsg {
  t: "lane";
  tm: 0 | 1; // your team
  g: number; // gold
  lv: number; // lane level
  me: number; // your level (capped), for the shop
  wv: number; // seconds to the next wave
  n: number; // wave number
  /** Structures [kind, team, life 0..1 (0 = down), respawn s (wards)]. */
  st: [string, 0 | 1, number, number][];
  k: [number, number]; // team kills
  dead: number; // seconds to respawn (0 = alive)
  shop: 0 | 1; // shop usable now (on your platform or dead)
  win?: 0 | 1; // winning team once a Core falls
}

export interface SnapMsg {
  t: "snap";
  tick: number;
  ack: number; // last input seq processed for the receiving client
  phase: Phase;
  phaseLeft: number; // seconds left in the current phase (if timed)
  ft?: number; // whole seconds of fight played this round (fight / ended phases): the HUD match clock
  winner: string | null;
  alive: number; // living players
  last?: [id: number, x: number, y: number][]; // endgame reveal: positions of all survivors once three or fewer are left
  total: number; // joined players
  spec: number; // player id the camera should follow when dead (-1 none)
  players: PlayerSnap[]; // self + players within view
  monsters: MonsterSnap[];
  projs: ProjSnap[];
  hazards: HazardSnap[];
  ground: GroundSnap[];
  defs?: { g: number; it: Item }[]; // ground items this client hasn't seen yet
  events: GameEvent[];
  board?: BoardEntry[]; // every BOARD_INTERVAL ticks
  camps?: CampSnap[]; // every BOARD_INTERVAL ticks
  me?: SelfHud; // private HUD block (server/hudsnap.ts)
}

/** One timed effect on the receiving player (server/hudsnap.ts). */
export interface BuffSnap {
  id: string; // stable: "<src>:<fxKey>" for charm buffs, "haste", "chill", "shrine:<defId>"
  t: number; // seconds left (0.1 s precision)
  d?: 1; // debuff
  n?: number; // stacks (absent = 1)
  k?: string; // FxKey (charm buffs) for FX_LABELS
  src?: string; // "charm<itemId>" for charm buffs
}

/** Private HUD block, sent only to its own client in every snap (server/hudsnap.ts). */
export interface SelfHud {
  k: number; // kills this match
  pl?: number; // placement (1 = winner), set once eliminated or the round is won
  kb?: string; // who / what eliminated you
  bf?: BuffSnap[]; // timed effects on you (omitted when empty)
  fl?: number[]; // per flask slot: seconds of recovery left (omitted when all 0)
  am?: Partial<Record<AilShort, number>>; // seconds left per active ailment (optional, see 4.4)
  ci?: number; // seconds of CC immunity left (optional, see 4.4)
}

export interface InvMsg {
  t: "inv";
  equip: Record<Slot, Item | null>;
  inv: GridEntry[]; // GRID_W x GRID_H grid, each item at its top-left cell
  flasks: (Item | null)[]; // length MAX_FLASK_SLOTS; slots >= stats.flaskSlots are locked
  charms?: (Item | null)[]; // length MAX_CHARM_SLOTS; slots >= charmSlotsFor(equip) are locked
  alt?: { mainhand: Item | null; offhand: Item | null }; // inactive weapon set
  set?: number; // active weapon set: 0 = I, 1 = II
}

export type ServerMsg =
  | { t: "welcome"; id: number }
  | { t: "full" }
  | SnapMsg
  | { t: "pong"; c: number }
  /** Full derived stats of the receiving player; sent on join and whenever they change. */
  | { t: "stats"; stats: Stats }
  | InvMsg
  /** Pickup refused: the item (id) doesn't fit in the grid. */
  | { t: "noroom"; id: number }
  | { t: "toast"; text: string } // text starting with HINT_PREFIX is a low-priority hint (left message log, not a toast)
  | ProgMsg
  | ShrinesMsg
  | BarMsg
  | CdMsg
  /** Procedural map of the match: the client regenerates it with setMap({seed, players, biome}). v = server map version. */
  | { t: "map"; seed: number; players: number; biome: string; v: number; mode?: "lanes" }
  /** Breachway lane mode HUD (server/modes/lanes.ts), a few times a second. */
  | LaneMsg
  /** monsters agent: guarded buff shrines [id, x, y, defId, used] + the receiver's buff (ids in content/monsters/shrines.ts). */
  | { t: "bshrine"; list: [number, number, number, string, 0 | 1][]; buff: { id: string; t: number } | null }
  /** In-match chat line (server/host.ts). ch: all | w (whisper; `to` set on the sender's echo) | spec (dead-only) | sys. */
  | ChatMsg;

export interface ChatMsg {
  t: "chat";
  from: string;
  text: string;
  ch: "all" | "w" | "spec" | "sys";
  to?: string;
  item?: Item; // linked item (copied server-side from the sender's carried items)
}

/** Toast text prefix for low-priority hints: shown as one line in the left message log. */
export const HINT_PREFIX = "hint:";
