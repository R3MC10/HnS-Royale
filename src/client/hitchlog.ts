// Always-on freeze log. Any frame over HITCH_MS is recorded with the script that took longest in it
// (Long Animation Frames API, Chromium / Electron) and what happened just before (panel opened,
// teleport, phase change...). The newest freeze shows next to the FPS counter (Options > Graphics >
// Show FPS, or ?dev=1), and Options > Graphics > Copy freeze log puts the whole log on the clipboard
// so players can paste it into a report. Costs nothing between freezes: the browser does the timing.

declare const __APP_VERSION__: string;

/** A frame at least this long counts as a freeze. */
export const HITCH_MS = 150;
const KEEP = 30;
const CTX_KEEP = 24;
/** Context lines older than this (before the freeze started) are not attached to it. */
const CTX_WINDOW_MS = 4000;

export interface Hitch {
  /** performance.now() at the frame's start. */
  at: number;
  ms: number;
  /** ms of it spent in scripts (the rest: style, layout, paint, decode, GC outside scripts). */
  scriptMs: number;
  /** Longest script: "function (invoker) file:pos 123 ms". */
  top: string;
  /** Recent context, oldest first: "panel inventory -0.3s". */
  ctx: string[];
  phase: string;
}

const hitches: Hitch[] = [];
const ctxLog: [number, string][] = [];
let phase = "";
let installed = false;
let loafOk = false;

/** Note something that may explain a later freeze (cheap: a ring buffer push). */
export function hitchCtx(what: string): void {
  ctxLog.push([performance.now(), what]);
  if (ctxLog.length > CTX_KEEP) ctxLog.shift();
}

/** Current game phase (attached to every freeze). */
export function hitchPhase(p: string): void {
  if (p === phase) return;
  phase = p;
  hitchCtx("phase " + p);
}

function contextFor(start: number, end: number): string[] {
  const out: string[] = [];
  for (const [t, w] of ctxLog) if (t >= start - CTX_WINDOW_MS && t <= end) out.push(`${w} ${((t - start) / 1000).toFixed(1)}s`);
  return out;
}

function push(h: Hitch) {
  hitches.push(h);
  if (hitches.length > KEEP) hitches.shift();
  if (isDev()) console.warn(`freeze ${h.ms} ms (${h.top || "no script"})`, h.ctx.join(", "));
}

let dev: boolean | null = null;
function isDev(): boolean {
  if (dev === null) {
    try {
      dev = new URLSearchParams(location.search).get("dev") === "1";
    } catch {
      dev = false;
    }
  }
  return dev;
}

interface LoafScript {
  duration: number;
  invoker?: string;
  sourceFunctionName?: string;
  sourceURL?: string;
  sourceCharPosition?: number;
}
interface LoafEntry extends PerformanceEntry {
  scripts?: LoafScript[];
}

/** Start observing (idempotent). */
export function initHitchLog(): void {
  if (installed || typeof PerformanceObserver === "undefined") return;
  installed = true;
  try {
    if (PerformanceObserver.supportedEntryTypes?.includes("long-animation-frame")) {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as LoafEntry[]) {
          if (e.duration < HITCH_MS || document.hidden) continue;
          let scriptMs = 0;
          let best: LoafScript | null = null;
          for (const s of e.scripts ?? []) {
            scriptMs += s.duration;
            if (!best || s.duration > best.duration) best = s;
          }
          const file = best?.sourceURL ? best.sourceURL.split(/[/\\]/).pop()!.split("?")[0] : "";
          const top = best ? `${best.sourceFunctionName || "(anonymous)"} (${best.invoker ?? "?"}) ${file}:${best.sourceCharPosition ?? -1} ${Math.round(best.duration)} ms` : "";
          push({ at: e.startTime, ms: Math.round(e.duration), scriptMs: Math.round(scriptMs), top, ctx: contextFor(e.startTime, e.startTime + e.duration), phase });
        }
      }).observe({ type: "long-animation-frame", buffered: false });
      loafOk = true;
    }
  } catch {
    loafOk = false;
  }
}

/** Fallback for browsers without the Long Animation Frames API: main.ts reports each rAF interval. */
export function hitchFrameGap(gapMs: number): void {
  if (loafOk || gapMs < HITCH_MS || document.hidden) return;
  const now = performance.now();
  push({ at: now - gapMs, ms: Math.round(gapMs), scriptMs: -1, top: "", ctx: contextFor(now - gapMs, now), phase });
}

/** The newest freeze, for the FPS overlay. */
export function lastHitch(): Hitch | null {
  return hitches[hitches.length - 1] ?? null;
}

export function hitchCount(): number {
  return hitches.length;
}

/** Plain-text report for the clipboard (English: it is read by the developers). */
export function hitchReport(): string {
  const ver = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";
  const now = performance.now();
  const lines = [
    `HnS Royale ${ver} freeze log (frames over ${HITCH_MS} ms), ${new Date().toISOString()}`,
    `${navigator.userAgent}`,
    `cores ${navigator.hardwareConcurrency ?? "?"} · screen ${screen.width}x${screen.height}@${devicePixelRatio} · uptime ${Math.round(now / 1000)} s${loafOk ? "" : " · no LoAF"}`,
  ];
  if (!hitches.length) lines.push("No freezes recorded.");
  for (const h of hitches) {
    lines.push(`- ${Math.round((now - h.at) / 1000)} s ago: ${h.ms} ms (scripts ${h.scriptMs < 0 ? "?" : h.scriptMs} ms) phase ${h.phase || "-"}`);
    if (h.top) lines.push(`    top: ${h.top}`);
    if (h.ctx.length) lines.push(`    before: ${h.ctx.join(", ")}`);
  }
  return lines.join("\n");
}

/** Copy the report; resolves to false when the clipboard refused. */
export async function copyHitchReport(): Promise<boolean> {
  const text = hitchReport();
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;left:-9999px;top:0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
