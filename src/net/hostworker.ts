// Web Worker entry (built to public/hostworker.js): runs the host's authoritative game + lobby
// room off the render thread, at a fixed 30 Hz. The main thread (src/net/hostbridge.ts) owns the
// WebRTC connections (RTCPeerConnection isn't available in workers) and relays bytes.
// Dedicated workers aren't subject to the heavy timer throttling that hidden tabs get on the main
// thread, so the tick keeps going while the host's tab is in the background.
// The logic lives in ./hostcore.ts (shared with the bridge's main-thread fallback).
import { createHostCore, type FromWorker, type ToWorker } from "./hostcore";

export type { FromWorker, ToWorker } from "./hostcore";

const scope = self as unknown as Worker;
const post = (m: FromWorker) => scope.postMessage(m);
const core = createHostCore(post);

self.onmessage = (e: MessageEvent<ToWorker>) => core.handle(e.data);
// Anything that escapes the core's own try/catch: report it with a readable message instead of the
// bridge's bare ErrorEvent.
self.addEventListener("error", (e: Event) => {
  const ee = e as ErrorEvent;
  post({ k: "error", text: `${ee.message ?? "unknown error"}${ee.filename ? ` (${ee.filename}:${ee.lineno})` : ""}` });
});
self.addEventListener("unhandledrejection", (e: Event) => {
  const r = (e as PromiseRejectionEvent).reason as { message?: string } | undefined;
  post({ k: "error", text: `unhandled rejection: ${r?.message ?? String(r)}` });
});

post({ k: "ready" }); // the script loaded: the bridge stops considering the inline fallback
