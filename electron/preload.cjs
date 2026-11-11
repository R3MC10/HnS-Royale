// Bridge for electron/friends.html (the "Play with friends" window): state in, retry/copy out.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("hns", {
  onState: (cb) => ipcRenderer.on("state", (_e, s) => cb(s)),
  onLang: (cb) => ipcRenderer.on("lang", (_e, l) => cb(l)),
  retry: () => ipcRenderer.send("friends:retry"),
  copy: () => ipcRenderer.send("friends:copy"),
});
