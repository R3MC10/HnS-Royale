// Menu styles (main menu, lobby browser, lobby room, post-match). Smooth, anti-aliased gothic
// look: carved dark stone panels, thin gilt rules, ember accents. Fonts come from the look agent's
// --font-title / --font-body variables when they exist, with serif fallbacks.
export const MENU_CSS = `
#overlay:has(#menu-root) { background: radial-gradient(ellipse at 50% 42%, rgba(36,15,9,0.68), rgba(4,3,5,0.93) 80%), url("keyart/menu.jpg") center / cover no-repeat, #050405; }
#menu-root { --m-title: var(--font-title, "Cinzel", "Trajan Pro", "Palatino Linotype", "Book Antiqua", Georgia, serif);
  --m-body: var(--font-body, "Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif);
  --m-gold: #d9b26a; --m-gold-dim: #8c7448; --m-line: rgba(140,116,72,0.28); --m-ember: #e0743a; --m-blood: #8e1a12;
  --m-ink: #e4d6b8; --m-dim: #9a8c72; --m-faint: #5e5444;
  position: relative; z-index: 1; width: 100%; height: 100%; display: flex;
  font-family: var(--m-body); color: var(--m-ink); -webkit-font-smoothing: antialiased; font-smooth: auto;
  box-sizing: border-box; padding: 16px; overflow: auto; transition: opacity 0.25s ease-out; }
#menu-root.m-fonts-wait { opacity: 0; }
#menu-root * { box-sizing: border-box; }
#menu-root > * { margin: auto; }
.m-panel { position: relative; padding: 22px 24px 18px; max-width: 100%;
  background: linear-gradient(180deg, rgba(30,24,28,0.94), rgba(12,10,13,0.96));
  border: 1px solid rgba(217,178,106,0.35); border-radius: 6px;
  box-shadow: 0 0 0 1px #050405, 0 0 0 4px rgba(18,14,16,0.9), 0 0 0 5px rgba(140,116,72,0.25), 0 24px 70px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,220,160,0.08), inset 0 0 60px rgba(0,0,0,0.5); }
.m-panel::before, .m-panel::after { content: ""; position: absolute; left: 22px; right: 22px; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(217,178,106,0.55), transparent); }
.m-panel::before { top: 8px; } .m-panel::after { bottom: 8px; }
.m-title { font-family: var(--m-title); font-weight: 700; text-align: center; letter-spacing: 0.12em; margin: 0;
  background: linear-gradient(180deg, #f6dfae 0%, #d9a650 45%, #8a4a1e 100%); -webkit-background-clip: text; background-clip: text; color: transparent;
  filter: drop-shadow(0 2px 0 #1a0805) drop-shadow(0 0 18px rgba(200,80,30,0.35)); }
.m-title.big { font-size: clamp(42px, 8vw, 84px); line-height: 1; }
.m-title.mid { font-size: clamp(26px, 4vw, 36px); }
.m-sub { text-align: center; color: var(--m-dim); font-style: italic; letter-spacing: 0.08em; margin: 6px 0 18px; font-size: 15px; }
.m-h { font-family: var(--m-title); color: var(--m-gold); letter-spacing: 0.14em; text-transform: uppercase; font-size: 13px;
  margin: 0 0 8px; padding-bottom: 5px; border-bottom: 1px solid var(--m-line); }
.m-col { display: flex; flex-direction: column; gap: 10px; }
.m-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.m-btn { font-family: var(--m-title); font-size: 15px; letter-spacing: 0.16em; text-transform: uppercase; cursor: pointer;
  color: #ead8b4; padding: 11px 22px; border-radius: 4px; border: 1px solid rgba(217,178,106,0.35);
  background: linear-gradient(180deg, rgba(48,38,40,0.95), rgba(22,18,21,0.95));
  box-shadow: inset 0 1px 0 rgba(255,220,160,0.1), 0 2px 8px rgba(0,0,0,0.6); transition: background .15s, color .15s, box-shadow .15s, transform .05s; }
.m-btn:hover:not(:disabled) { color: #fff1d4; border-color: rgba(240,190,110,0.7); box-shadow: inset 0 1px 0 rgba(255,220,160,0.18), 0 0 14px rgba(224,116,58,0.35); }
.m-btn:active:not(:disabled) { transform: translateY(1px); }
.m-btn:disabled { opacity: 0.45; cursor: default; }
.m-btn.primary { background: linear-gradient(180deg, #8a2216, #4c0d08); border-color: rgba(255,140,90,0.55); }
.m-btn.primary:hover:not(:disabled) { background: linear-gradient(180deg, #a62c1c, #5e120a); }
.m-btn.small { font-size: 11px; padding: 6px 12px; letter-spacing: 0.12em; }
.m-btn.wide { width: 100%; }
.m-btn.on { border-color: #7fbf6a; color: #c8f0b0; box-shadow: inset 0 0 0 1px rgba(127,191,106,0.35), 0 0 12px rgba(127,191,106,0.25); }
.m-input, .m-select { font-family: var(--m-body); font-size: 16px; color: #f2e4c6; background: rgba(6,5,7,0.85);
  border: 1px solid rgba(140,116,72,0.4); border-radius: 4px; padding: 9px 11px; outline: none; }
.m-input:focus, .m-select:focus { border-color: var(--m-ember); box-shadow: 0 0 0 2px rgba(224,116,58,0.18); }
.m-select { font-size: 14px; padding: 6px 8px; }
.m-label { color: var(--m-dim); font-size: 13px; letter-spacing: 0.06em; }
.m-status { min-height: 20px; color: #ff9f7a; text-align: center; font-size: 14px; }
.m-note { color: var(--m-faint); font-size: 12px; line-height: 1.5; }
.m-ver { position: fixed; right: 12px; bottom: 8px; color: rgba(232, 214, 186, 0.6); font-size: 13px; text-shadow: 0 1px 2px #000; z-index: 5; pointer-events: none; user-select: none; letter-spacing: 0.04em; }
.m-main { width: min(440px, 100%); }
.m-main .m-btn { width: 100%; }
.m-browser { width: min(980px, 100%); }
.m-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.m-table th { font-family: var(--m-title); font-weight: 600; text-align: left; color: var(--m-gold-dim); font-size: 11px; letter-spacing: 0.14em;
  text-transform: uppercase; padding: 6px 8px; border-bottom: 1px solid var(--m-line); }
.m-table td { padding: 9px 8px; border-bottom: 1px solid rgba(140,116,72,0.12); }
.m-table tr.lob:hover td { background: rgba(224,116,58,0.07); }
.m-table .num { text-align: right; font-variant-numeric: tabular-nums; }
.m-empty { text-align: center; color: var(--m-faint); padding: 34px 8px; font-style: italic; }
.m-scroll { max-height: min(56vh, 520px); overflow: auto; }
.m-tag { display: inline-block; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; padding: 2px 7px; border-radius: 3px;
  border: 1px solid rgba(127,191,106,0.45); color: #a8dc90; }
.m-tag.busy { border-color: rgba(224,116,58,0.5); color: #f0a070; }
.m-room { width: min(1240px, 100%); display: grid; grid-template-columns: 260px 1fr 300px; gap: 18px; align-items: start; }
.m-room > .m-col { min-width: 0; }
@media (max-width: 1000px) { .m-room { grid-template-columns: 1fr; } }
.m-member { display: flex; align-items: center; gap: 8px; padding: 7px 9px; border-radius: 4px; background: rgba(0,0,0,0.25); border: 1px solid rgba(140,116,72,0.14); }
.m-member .nm { font-weight: 700; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.m-member .cl { color: var(--m-dim); font-size: 12px; font-style: italic; }
.m-member.me { border-color: rgba(217,178,106,0.45); }
.m-bot { flex: none; padding: 1px 5px; border-radius: 3px; font-size: 10px; font-weight: 700; letter-spacing: 0.08em; color: var(--m-dim); border: 1px solid rgba(140,116,72,0.4); vertical-align: 1px; }
.m-bots { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.m-bots .m-select { width: auto; min-width: 56px; }
.m-dot { width: 9px; height: 9px; border-radius: 50%; background: #3a3238; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.6); flex: none; }
.m-dot.ready { background: #7fbf6a; box-shadow: 0 0 8px rgba(127,191,106,0.7); }
.m-crown { color: var(--m-gold); font-size: 13px; }
.m-x { cursor: pointer; color: #b05a48; border: none; background: none; font-size: 16px; padding: 0 4px; }
.m-x:hover { color: #ff7a5a; }
.m-classes { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; }
.m-class { cursor: pointer; padding: 7px 9px; border-radius: 4px; border: 1px solid rgba(140,116,72,0.22); background: rgba(0,0,0,0.28); transition: border-color .15s, background .15s; }
.m-class:hover { border-color: rgba(217,178,106,0.55); }
.m-class.sel { border-color: var(--m-ember); background: rgba(120,30,16,0.28); box-shadow: 0 0 14px rgba(224,116,58,0.22); }
.m-class b { display: block; font-family: var(--m-title); letter-spacing: 0.08em; color: #f0dcb4; font-size: 14px; }
.m-class i { display: block; font-size: 11px; color: var(--m-gold-dim); font-style: normal; letter-spacing: 0.1em; margin: 1px 0 3px; }
.m-class span { font-size: 12px; color: var(--m-dim); line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.m-chat { height: 300px; overflow: auto; background: rgba(0,0,0,0.3); border: 1px solid rgba(140,116,72,0.16); border-radius: 4px; padding: 8px; font-size: 14px; line-height: 1.45; }
.m-chat .sys { color: var(--m-faint); font-style: italic; }
.m-chat b { color: var(--m-gold); }
.m-settings { display: grid; grid-template-columns: auto 1fr; gap: 7px 10px; align-items: center; }
.m-warn { padding: 8px 12px; border-radius: 4px; background: rgba(120,40,10,0.35); border: 1px solid rgba(224,116,58,0.5); color: #ffc9a0; font-size: 13px; }
.m-post { width: min(960px, 100%); }
.m-winner { text-align: center; margin: 4px 0 16px; font-size: 18px; color: var(--m-dim); }
.m-winner b { display: block; font-family: var(--m-title); font-size: clamp(26px, 4vw, 40px); color: #ffd890; letter-spacing: 0.1em; text-shadow: 0 0 22px rgba(255,170,60,0.45); }
.m-table tr.won td { background: rgba(217,178,106,0.08); }
.m-loot { font-size: 12px; line-height: 1.35; }
.m-spin { display: inline-block; width: 12px; height: 12px; border: 2px solid rgba(217,178,106,0.25); border-top-color: var(--m-gold); border-radius: 50%; animation: m-spin .8s linear infinite; vertical-align: -1px; margin-right: 6px; }
@keyframes m-spin { to { transform: rotate(360deg); } }
.m-title-screen { text-align: center; cursor: pointer; user-select: none; }
.m-title-screen .m-press { margin-top: 26px; color: var(--m-dim); letter-spacing: 0.3em; text-transform: uppercase; font-family: var(--m-title); font-size: 14px; animation: m-pulse 2.2s ease-in-out infinite; }
@keyframes m-pulse { 50% { opacity: 0.35; } }
#hns-hidden-warn { position: fixed; top: 10px; left: 50%; transform: translateX(-50%); z-index: 35; display: none; pointer-events: none; }
/* Spawn-point pick (countdown of a hall match): placeholder map + candidate points */
#m-spawnpick { position: fixed; right: 16px; top: 50%; transform: translateY(-50%); z-index: 30; display: none; width: min(340px, calc(100vw - 32px));
  padding: 12px 12px 10px; border-radius: 6px; color: #e4d6b8; font-family: var(--font-body, "Palatino Linotype", Georgia, serif);
  background: linear-gradient(180deg, rgba(30,24,28,0.95), rgba(12,10,13,0.97)); border: 1px solid rgba(217,178,106,0.35);
  box-shadow: 0 0 0 1px #050405, 0 18px 50px rgba(0,0,0,0.8); }
#m-spawnpick .sp-h { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px;
  font-family: var(--font-title, "Cinzel", Georgia, serif); color: #d9b26a; letter-spacing: 0.12em; text-transform: uppercase; font-size: 13px; }
#m-spawnpick .sp-t { color: #ffd890; font-size: 18px; }
#m-spawnpick canvas { display: block; width: 100%; aspect-ratio: 1; cursor: pointer; border: 1px solid rgba(140,116,72,0.35); background: #0b0a0c; }
#m-spawnpick .sp-n { margin-top: 6px; font-size: 12px; color: #9a8c72; text-align: center; }
.m-table td.m-place { color: var(--m-gold); font-family: var(--m-title); }
.m-code { font-family: var(--m-title); color: var(--m-gold); letter-spacing: 0.22em; font-weight: 700; }
.m-input.m-code-in { width: 7.5em; text-transform: uppercase; letter-spacing: 0.25em; font-family: var(--m-title); text-align: center; }
.m-coderow { justify-content: center; gap: 8px; } .m-coderow .m-code { font-size: 20px; }
`;
