// Per-client snapshot building with interest management: each client only
// receives entities within VIEW_RADIUS of its camera (self, or spectate target).
// Entity JSON is serialized once per tick and string-joined per client.
import { BOARD_INTERVAL, REVEAL_AFTER, REVEAL_ALIVE, VIEW_RADIUS } from "../shared/constants";
import type { BoardEntry } from "../shared/protocol";
import type { Game } from "./game";
import { toSnap, type ServerPlayer } from "./player";
import { BucketGrid } from "../shared/spatial";
import type { Monster } from "./monsters";
import { monsterDefSnap, playerDefSnap } from "./damage";
import { selfHudJson } from "./hudsnap";

interface Pre {
  x: number;
  y: number;
  json: string;
}

const gotBoard = new WeakSet<ServerPlayer>();

/** Returns [player, snapshot JSON] for every joined player. */
export function buildSnapshots(game: Game, events: string): Map<ServerPlayer, string> {
  const out = new Map<ServerPlayer, string>();
  const joined = game.joined;
  const ms = game.monsters;

  const playerJson = new Map<number, string>();
  const playersPre: (Pre & { id: number })[] = [];
  for (const p of joined) {
    const json = JSON.stringify({ ...toSnap(p), ...playerDefSnap(p) }); // + energy shield / ailments (server/damage.ts)
    playerJson.set(p.id, json);
    if (p.alive) playersPre.push({ id: p.id, x: p.x, y: p.y, json });
  }
  // Monsters: bucket grid + lazy per-tick JSON, so only monsters near some camera get serialized
  // (a huge map holds hundreds of camps; most of them sleep far from everyone).
  const monGrid = new BucketGrid<Monster>(VIEW_RADIUS);
  for (const m of ms.monsters.values()) monGrid.insert(m);
  const monJson = new Map<Monster, string>();
  const monsterJsonNear = (cx: number, cy: number, R2: number) => {
    const out: string[] = [];
    monGrid.forNear(cx, cy, VIEW_RADIUS, (m) => {
      if ((m.x - cx) * (m.x - cx) + (m.y - cy) * (m.y - cy) > R2) return;
      let j = monJson.get(m);
      if (j === undefined) monJson.set(m, (j = JSON.stringify({ ...ms.monsterSnap(m), ...monsterDefSnap(m) })));
      out.push(j);
    });
    return out;
  };
  const projs: Pre[] = ms.projectiles.map((p) => ({ x: p.x, y: p.y, json: JSON.stringify(ms.projSnap(p)) }));
  const hazards: Pre[] = ms.hazards.map((h) => ({ x: h.x, y: h.y, json: JSON.stringify(ms.hazardSnap(h)) }));
  const ground = [...game.ground.values()];

  const boardTick = game.tick % BOARD_INTERVAL === 0;
  let boardJson = "";
  let campList: { c: ReturnType<typeof ms.campSnaps>[number]; j: string }[] = [];
  const needBoard = boardTick || joined.some((p) => !gotBoard.has(p));
  if (needBoard) {
    const board: BoardEntry[] = joined.map((p) => ({ id: p.id, name: p.name, color: p.color, kills: p.kills, wins: p.wins, alive: p.alive }));
    boardJson = JSON.stringify(board);
    campList = ms.campSnaps().map((c) => ({ c, j: JSON.stringify(c) }));
  }

  const header =
    `"t":"snap","tick":${game.tick},"phase":"${game.phase}","phaseLeft":${Math.round(game.phaseLeft * 100) / 100},` +
    (game.phase === "fight" || game.phase === "ended" ? `"ft":${Math.floor(game.fightTime)},` : "") +
    `"winner":${JSON.stringify(game.winner)},"alive":${game.aliveCount},"total":${joined.length},` +
    // Endgame: with REVEAL_ALIVE or fewer left, or after REVEAL_AFTER s, everyone sees where the survivors are (no zone, no timer: this ends the match).
    (game.phase === "fight" && !game.lanes && ((joined.length > REVEAL_ALIVE && playersPre.length <= REVEAL_ALIVE) || game.fightTime >= REVEAL_AFTER)
      ? `"last":[${playersPre.map((o) => `[${o.id},${Math.round(o.x)},${Math.round(o.y)}]`).join(",")}],`
      : "") +
    `"events":${events}`;

  const R2 = VIEW_RADIUS * VIEW_RADIUS;
  for (const p of joined) {
    let cx = p.x;
    let cy = p.y;
    if (!p.alive) {
      const t = game.players.get(p.specId);
      if (t) {
        cx = t.x;
        cy = t.y;
      }
    }
    const near = (e: { x: number; y: number }) => (e.x - cx) * (e.x - cx) + (e.y - cy) * (e.y - cy) <= R2;

    const pl = [playerJson.get(p.id)!];
    for (const o of playersPre) if (o.id !== p.id && near(o)) pl.push(o.json);

    const gs: string[] = [];
    const defs: string[] = [];
    for (const g of ground) {
      if (!near(g)) continue;
      gs.push(`[${g.g},${g.x},${g.y}]`);
      if (!p.knownGround.has(g.g)) {
        p.knownGround.add(g.g);
        defs.push(`{"g":${g.g},"it":${JSON.stringify(g.item)}}`);
      }
    }
    if (boardTick) for (const g of p.knownGround) if (!game.ground.has(g)) p.knownGround.delete(g);

    let s =
      `{"ack":${p.lastSeq},"spec":${p.specId},${header}` +
      `,"players":[${pl.join(",")}]` +
      `,"monsters":[${monsterJsonNear(cx, cy, R2).join(",")}]` +
      `,"projs":[${projs.filter(near).map((m) => m.json).join(",")}]` +
      `,"hazards":[${hazards.filter(near).map((m) => m.json).join(",")}]` +
      `,"ground":[${gs.join(",")}]` +
      `,"me":${selfHudJson(p)}`;
    if (defs.length) s += `,"defs":[${defs.join(",")}]`;
    if (needBoard && (boardTick || !gotBoard.has(p))) {
      // Only camps within 2x the view radius (big maps have 100+ camps).
      const CR2 = (VIEW_RADIUS * 2) ** 2;
      const campsJson = campList.filter((e) => (e.c.x - cx) ** 2 + (e.c.y - cy) ** 2 < CR2).map((e) => e.j).join(",");
      s += `,"board":${boardJson},"camps":[${campsJson}]`;
      gotBoard.add(p);
    }
    out.set(p, s + "}");
  }
  return out;
}
