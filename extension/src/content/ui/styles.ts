// Scoped to the shadow root. Brand: deep civic navy + warm gold.
export const CSS = `
:host { all: initial; }
.root {
  --navy: #13294B; --navy-2: #1E3A66; --gold: #F4B740; --ink: #1B2333; --muted: #5E6878; --line: #E3E7EE;
  --bg: #FFFFFF; --soft: #F5F7FA; --bad: #C2372B; --bad-bg: #FDF1F0; --warn: #9A6400; --warn-bg: #FFF7E6; --ok: #19744B; --ok-bg: #EEF8F2;
  font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: var(--ink); -webkit-font-smoothing: antialiased;
}
* { box-sizing: border-box; }
button { font: inherit; color: inherit; cursor: pointer; }
button:focus-visible, textarea:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }

.launcher {
  position: fixed; right: 20px; bottom: 20px; width: 56px; height: 56px; border-radius: 50%; border: 0;
  background: var(--navy); box-shadow: 0 6px 20px rgba(19,41,75,.35); display: grid; place-items: center; padding: 0;
  transition: transform .12s ease;
}
.launcher:hover { transform: translateY(-1px); }
.launcher.open { background: var(--navy-2); }
.badge {
  position: absolute; top: -2px; right: -2px; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 10px;
  background: var(--gold); color: var(--navy); font-size: 11px; font-weight: 700; display: grid; place-items: center; border: 2px solid #fff;
}
.avatar { display: inline-grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; background: var(--navy); flex: none; }
.avatar.lg { width: 44px; height: 44px; background: transparent; }

.panel {
  position: fixed; right: 20px; bottom: 88px; width: min(380px, calc(100vw - 32px)); height: min(600px, calc(100vh - 110px));
  background: var(--bg); border: 1px solid var(--line); border-radius: 16px; box-shadow: 0 18px 48px rgba(16,24,40,.22);
  display: flex; flex-direction: column; overflow: hidden;
}
.head { display: flex; align-items: center; gap: 10px; padding: 12px 12px 10px 14px; background: var(--navy); color: #fff; }
.who { flex: 1; display: flex; flex-direction: column; }
.who strong { font-size: 15px; letter-spacing: .2px; }
.mode { font-size: 12px; opacity: .85; display: inline-flex; align-items: center; gap: 6px; }
.mode::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: #9AA6B8; }
.mode.ai::before { background: #4ADE80; } .mode.offline-guidance::before { background: var(--gold); } .mode.unreachable::before { background: #F87171; }
.icon-btn { background: transparent; border: 0; color: inherit; width: 30px; height: 30px; border-radius: 8px; display: grid; place-items: center; }
.icon-btn:hover { background: rgba(255,255,255,.12); }
.icon-btn.sm { width: 24px; height: 24px; color: var(--muted); font-size: 16px; }
.icon-btn.sm:hover { background: var(--line); }

.page-id { display: flex; align-items: center; gap: 8px; padding: 9px 14px; background: var(--soft); border-bottom: 1px solid var(--line); font-size: 12.5px; }
.page-dot { width: 8px; height: 8px; border-radius: 2px; background: var(--gold); flex: none; }
.page-name { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.page-meta { margin-left: auto; color: var(--muted); white-space: nowrap; }

.tabs { display: flex; gap: 4px; padding: 8px 12px 0; border-bottom: 1px solid var(--line); }
.tabs button { border: 0; background: none; padding: 8px 10px; font-weight: 600; color: var(--muted); border-bottom: 2px solid transparent; margin-bottom: -1px; display: inline-flex; align-items: center; gap: 6px; }
.tabs button.on { color: var(--navy); border-bottom-color: var(--gold); }
.pill { background: var(--bad); color: #fff; border-radius: 9px; font-size: 11px; padding: 0 6px; line-height: 17px; }

.msgs { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
.bubble { max-width: 92%; padding: 10px 12px; border-radius: 12px; }
.bubble p { margin: 0 0 6px; } .bubble p:last-child { margin-bottom: 0; }
.bubble.bot { background: var(--soft); border: 1px solid var(--line); align-self: flex-start; border-top-left-radius: 4px; }
.bubble.me { background: var(--navy); color: #fff; align-self: flex-end; border-top-right-radius: 4px; white-space: pre-wrap; }
.bubble.err { background: var(--bad-bg); color: var(--bad); border: 1px solid #F3C8C3; align-self: flex-start; }
.fine { font-size: 12px; color: var(--muted); }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chips.inline { margin-top: 8px; }
.chips button { border: 1px solid var(--navy); background: #fff; color: var(--navy); border-radius: 999px; padding: 5px 11px; font-size: 12.5px; font-weight: 600; }
.chips button:hover { background: #EEF2F8; }
.chips button.soft { border-color: var(--line); color: var(--ink); font-weight: 500; text-align: left; }

.answer .row { display: grid; grid-template-columns: 104px 1fr; gap: 8px; padding: 6px 0; border-top: 1px dashed var(--line); font-size: 13px; }
.answer .row:first-of-type { margin-top: 6px; }
.k { color: var(--muted); font-size: 11.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .3px; }
.answer .row.ex .v { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; background: #fff; border: 1px solid var(--line); border-radius: 6px; padding: 2px 6px; }
.needs { margin-top: 8px; padding: 8px 10px; background: var(--warn-bg); border-radius: 8px; }
.needs ul { margin: 4px 0 0; padding-left: 18px; font-size: 13px; }
.field-tag { border: 0; background: #E7ECF4; color: var(--navy); font-weight: 600; font-size: 12px; border-radius: 6px; padding: 2px 8px; margin-bottom: 6px; }
.meta { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.src, .conf { font-size: 11px; border-radius: 4px; padding: 1px 6px; font-weight: 600; }
.src.ai { background: #E7ECF4; color: var(--navy); } .src.offline { background: #F0EEE8; color: #6B5B2E; }
.conf.medium { background: var(--soft); color: var(--muted); } .conf.low { background: var(--warn-bg); color: var(--warn); }
.typing { display: flex; gap: 4px; padding: 12px 14px; }
.typing i { width: 6px; height: 6px; border-radius: 50%; background: var(--muted); animation: blink 1.2s infinite; }
.typing i:nth-child(2) { animation-delay: .2s; } .typing i:nth-child(3) { animation-delay: .4s; }
@keyframes blink { 0%, 80%, 100% { opacity: .25; } 40% { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .typing i { animation: none; } .launcher { transition: none; } }

.focus-bar { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-top: 1px solid var(--line); background: #FBF6EA; font-size: 12.5px; }
.focus-bar > div { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.focus-k { color: var(--muted); }
.focus-meta { color: var(--muted); margin-left: 6px; }
.mini { border: 0; background: var(--navy); color: #fff; border-radius: 7px; padding: 5px 9px; font-size: 12px; font-weight: 600; white-space: nowrap; }
.mini:disabled { opacity: .5; cursor: default; }
.link { border: 0; background: none; color: var(--navy); font-weight: 600; text-decoration: underline; padding: 0; font-size: 12.5px; }
.bubble.err .link { color: var(--bad); }

.composer { display: flex; gap: 8px; padding: 10px 12px; border-top: 1px solid var(--line); align-items: flex-end; }
.composer textarea { flex: 1; resize: none; border: 1px solid var(--line); border-radius: 10px; padding: 9px 11px; font: inherit; color: inherit; background: #fff; max-height: 96px; min-height: 38px; }
.send { width: 38px; height: 38px; border: 0; border-radius: 10px; background: var(--navy); color: var(--gold); display: grid; place-items: center; flex: none; }
.send:disabled { background: #C9D0DB; color: #fff; cursor: default; }
.foot { font-size: 11px; color: var(--muted); text-align: center; padding: 6px 12px 8px; border-top: 1px solid var(--line); }

.review { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 12px; }
.review.empty { align-items: center; justify-content: center; color: var(--muted); }
.progress-top { display: flex; align-items: baseline; gap: 6px; font-size: 13px; }
.progress-top .link { margin-left: auto; }
.bar { height: 8px; background: var(--line); border-radius: 4px; margin-top: 6px; overflow: hidden; }
.bar i { display: block; height: 100%; background: var(--ok); border-radius: 4px; }
.ok-box { background: var(--ok-bg); color: var(--ok); border-radius: 10px; padding: 10px 12px; font-size: 13px; font-weight: 600; }
.group h4 { margin: 0 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: .4px; color: var(--muted); display: flex; gap: 6px; align-items: center; }
.group h4 span { background: var(--soft); border-radius: 8px; padding: 0 6px; }
.group ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.group li { display: flex; gap: 6px; }
.group .item { flex: 1; text-align: left; border: 1px solid var(--line); background: #fff; border-left: 3px solid var(--muted); border-radius: 8px; padding: 7px 10px; display: grid; gap: 1px; }
.group.bad .item { border-left-color: var(--bad); } .group.warn .item { border-left-color: #E0A100; }
.group .item:hover { background: var(--soft); }
.item b { font-size: 13px; } .item span { font-size: 12.5px; color: var(--muted); } .item em { font-size: 11px; color: #8A93A3; font-style: normal; }
.group .ask { width: 30px; border: 1px solid var(--line); background: #fff; border-radius: 8px; color: var(--navy); font-weight: 700; }
.checklist { font-size: 13px; }
.checklist li { display: block; padding-left: 22px; position: relative; }
.checklist li::before { content: ""; position: absolute; left: 2px; top: 3px; width: 12px; height: 12px; border: 1.5px solid var(--muted); border-radius: 3px; }

.chip-float {
  position: fixed; z-index: 1; display: inline-flex; align-items: center; gap: 5px; height: 26px; padding: 0 9px 0 3px;
  border: 1px solid var(--navy); background: #fff; color: var(--navy); border-radius: 13px; font-size: 12px; font-weight: 600;
  box-shadow: 0 2px 8px rgba(19,41,75,.18); white-space: nowrap;
}
.chip-float .avatar { width: 20px; height: 20px; } .chip-float .avatar svg { width: 16px; height: 16px; }
.chip-float.quiet { opacity: .9; }

.guide {
  position: fixed; z-index: 1; background: #fff; border: 1px solid var(--line); border-left: 3px solid var(--navy); border-radius: 10px;
  box-shadow: 0 6px 18px rgba(16,24,40,.14); padding: 8px 10px; font-size: 12.5px; max-height: min(320px, calc(100vh - 16px)); overflow-y: auto;
}
.guide.verify { border-left-color: #E0A100; }
.guide.quiet { border-left-color: var(--line); box-shadow: 0 2px 8px rgba(16,24,40,.08); }
.guide.dim { opacity: .9; }
.guide-head { display: flex; align-items: flex-start; gap: 7px; }
.guide-head .avatar { width: 20px; height: 20px; } .guide-head .avatar svg { width: 16px; height: 16px; }
.guide-title { flex: 1; margin: 1px 0 0; font-weight: 600; line-height: 1.35; }
.guide.quiet .guide-title { font-weight: 500; color: var(--muted); }
.guide-steps { margin: 6px 0 0; padding-left: 18px; display: grid; gap: 3px; }
.guide-detail { margin: 6px 0 0; color: var(--muted); }
.guide-foot { display: flex; align-items: center; gap: 10px; margin-top: 7px; }
.guide-foot .link { font-size: 12px; white-space: nowrap; }
.guide-src { margin-left: auto; font-size: 11px; color: var(--muted); text-align: right; }
.guide .typing { padding: 6px 0 0 27px; }
.highlight { position: fixed; pointer-events: none; border: 3px solid var(--gold); border-radius: 8px; box-shadow: 0 0 0 4000px rgba(19,41,75,.12); z-index: 0; }
`;
