// Bridge for the game page: LAN room discovery (UDP beacon) and the LAN relay hub (electron/main.mjs).
// The game uses it in src/net/p2p.ts; in a plain browser window.HNS_LAN is simply missing.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("HNS_LAN", {
  setBeacon: (d) => ipcRenderer.send("lan:beacon-set", d),
  onBeacon: (cb) => ipcRenderer.on("lan:beacon", (_e, m) => cb(m)),
  hubStart: () => ipcRenderer.invoke("lan:hub-start"),
  hubStop: () => ipcRenderer.invoke("lan:hub-stop"),
});
