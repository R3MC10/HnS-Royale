// Lobby-room protocol between a P2P host (src/net/hostruntime.ts) and its members. These messages
// share the game connection (reliable channel) and all start with "r-", so the client's menus
// (src/client/menus/*) can intercept them before main.ts sees a game message.

export interface RoomSettings {
  name: string; // lobby name shown in the browser
  max: number; // 2..20
  biome: string; // biome id or "random"
  size: string; // "auto" | "small" | "medium" | "large"
  mode?: "royale" | "lanes"; // match mode: the royale, or Breachway (two teams, one lane: server/modes/lanes.ts)
}

export interface RoomMember {
  id: number;
  name: string;
  cls: string;
  ready: boolean;
  host: boolean;
  inMatch: boolean;
  practice?: boolean; // in the practice arena while the hall waits
  bot?: true; // a bot the host added (src/server/bots)
}

export interface ResultRow {
  name: string;
  cls: string;
  kills: number;
  dmg: number; // damage dealt to players
  mdmg: number; // damage dealt to monsters
  level: number;
  won: boolean;
  alive: boolean;
  loot: { n: string; r: number }[]; // notable gear held at the end (best rarity first)
  place: number; // 1 = winner; 0 = left before the fight began
  secs: number; // seconds alive in the fight
  left?: boolean; // quit / disconnected mid-match
  bot?: true; // a bot the host added
}

export interface MatchResult {
  winner: string | null;
  secs: number;
  rows: ResultRow[];
}

export type RoomClientMsg =
  | { t: "r-hello"; name: string; cls: string; rid?: string } // rid: per-tab token, lets a dropped player back in during the countdown
  | { t: "r-cls"; cls: string }
  | { t: "r-ready"; v: boolean }
  | { t: "r-chat"; text: string }
  | { t: "r-practice"; v: boolean } // enter / leave the practice arena (hall only, no match running)
  | { t: "r-leave" } // leave the match / practice but stay in the hall
  | { t: "r-skip" } // winner screen: this player is done looking (results come once every human player has skipped)
  | { t: "r-spawn"; i: number } // spawn-point pick during the countdown (index into r-spawns pts)
  // host only (ignored from anyone else):
  | { t: "r-set"; settings: Partial<RoomSettings> }
  | { t: "r-kick"; id: number } // also removes a bot
  // Bots (src/server/bots): add `add` bots, or add bots until the hall holds `fill` players, or remove them all.
  // They join the hall like players (always ready); added during a match, they play the next one.
  | { t: "r-bot"; add?: number; fill?: number; clear?: true }
  | { t: "r-start" }
  | { t: "r-abort" };

export type RoomServerMsg =
  | { t: "r-state"; you: number; members: RoomMember[]; settings: RoomSettings; state: "room" | "match"; hostHidden: boolean }
  | { t: "r-chat"; from: string; text: string; sys?: 1 }
  | { t: "r-go" } // you're in the match that's starting now (the game's welcome follows)
  | { t: "r-practice" } // you're entering the practice arena (the game's welcome follows)
  | { t: "r-left" } // you're out of the match / practice and back in the hall
  // Spawn-point pick (countdown): candidate points, who stands where, seconds left. done = the fight began.
  | { t: "r-spawns"; pts: [number, number][]; taken: { i: number; name: string; me?: 1 }[]; left: number; w: number; h: number; done?: 1 }
  | { t: "r-end"; result: MatchResult } // match over: show the post-match screen, then the room
  | { t: "r-full" }
  | { t: "r-kicked" }
  | { t: "r-closed"; reason: string };

export const CHAT_MAX = 160;
export const isRoomMsg = (t: unknown) => typeof t === "string" && t.startsWith("r-");
