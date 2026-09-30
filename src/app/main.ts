import "../palette.css";
import "./app.css";
import { X_URL, GITHUB_URL, CHAIN } from "../config.ts";
import { armCa, armSocial } from "../lib/caslot.ts";
import { caState } from "../lib/ca.ts";
import { CA, CA_DATE } from "../config.ts";
import { h, clear } from "./dom.ts";
import { icon } from "./icons.ts";
import { state, commit, subscribe } from "./store.ts";
import { live, onLive, startLive } from "./live.ts";
import { toast, popMenu, closeMenu, type MenuItem } from "./ui.ts";
import * as WM from "./windows.ts";
import { programs, tokenValue } from "./programs.ts";
import { fmtClock, fmtCountdown, magnifyScale, nextLaunch } from "../lib/wm.ts";
import { compactUsd, fmtInt, weiToGwei, pct, shortAddr } from "../lib/format.ts";

armCa();
armSocial("social-x", X_URL, "ZKHUB on X");
armSocial("social-gh", GITHUB_URL, "ZKHUB on GitHub");

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const root = document.documentElement;
const $id = (id: string) => document.getElementById(id) as HTMLElement;
const desktop = programs.filter((p) => p.desktop);
const openProgram = (id: string, o?: { payload?: Record<string, unknown>; title?: string }) => { const w = WM.open(id, o); if (w) bounce(id); return w; };

// --top-h drives window bounds: CA bar + menubar
new ResizeObserver(() => root.style.setProperty("--top-h", $id("ca").offsetHeight + $id("menubar").offsetHeight + "px")).observe($id("ca"));
root.style.setProperty("--top-h", "62px");
WM.mount($id("windows"), programs);

/* ---------- appearance from settings (accent / wallpaper come from the sampled palette) ---------- */
function applyLook() {
  const a = { lime: "--accent", white: "--fg", moss: "--green-mid" }[state.settings.accent];
  root.style.setProperty("--accent", tokenValue(a));
  root.style.setProperty("--accent-fg", tokenValue("--accent-fg"));
  document.body.className = "wallpaper-" + state.settings.wallpaper;
}
applyLook(); subscribe(applyLook);

/* ---------- menubar ---------- */
let menuOpen: string | null = null;
const wallpapers = ["drift", "trench", "static"] as const;
function menus(): Record<string, MenuItem[]> {
  const f = WM.focused();
  const p = f ? WM.program(f.programId) : null;
  const fileFor: Record<string, MenuItem[]> = {
    launchpad: [{ label: "New Launch…", run: () => openProgram("launchpad") }],
    launches: [{ label: "Open My Launches", run: () => openProgram("launches") }],
    scheduler: [{ label: "Open Scheduler", run: () => openProgram("scheduler") }],
    recycle: [{ label: "Open Recycle Bin", run: () => openProgram("recycle") }],
  };
  return {
    File: [...(p ? fileFor[p.id] ?? [] : []), { label: "Search…", kbd: "Ctrl K", run: () => overlay("palette") }, { sep: true, label: "" }, { label: "Close Window", disabled: !f, run: () => f && WM.close(f.id) }],
    Edit: [{ label: "Undo", disabled: true, kbd: "Ctrl Z" }, { label: "Copy", disabled: true, kbd: "Ctrl C" }, { label: "Paste", disabled: true, kbd: "Ctrl V" }],
    View: [{ label: "Mission Control", kbd: "F3", run: () => overlay("mission") }, { label: "Launcher", run: () => overlay("launcher") }, { label: "Toggle Full Size", disabled: !f, run: () => f && WM.toggleMax(f.id) }],
    Window: [{ label: "Minimize", disabled: !f, run: () => f && WM.minimize(f.id) }, ...(WM.list().length ? [{ sep: true, label: "" } as MenuItem] : []), ...WM.list().map((w) => ({ label: w.title, run: () => WM.focus(w.id) }))],
    Help: [{ label: "About ZKHUB", run: () => openProgram("about") }, { label: "Docs", run: () => openProgram("docs") }, { label: "Terminal commands", run: () => openProgram("terminal") }, { label: "Lock Screen", run: () => overlay("lock") }],
  };
}
let wallet: string | null = null;
async function connect() {
  const eth = (window as unknown as { ethereum?: { request(a: { method: string }): Promise<string[]> } }).ethereum;
  if (wallet) { wallet = null; toast("Wallet disconnected (this page only)"); drawBar(); return; }
  if (!eth) { toast("No browser wallet found. ZKHUB works read-only without one."); return; }
  try { const a = await eth.request({ method: "eth_requestAccounts" }); if (a?.[0]) { wallet = a[0]; toast("Connected read-only. Nothing is signed or sent."); drawBar(); } }
  catch { toast("Connection cancelled"); }
}
function drawBar() {
  const bar = $id("menubar"); clear(bar);
  const f = WM.focused(), p = f ? WM.program(f.programId) : null;
  const top = (id: string, label: string | HTMLElement, bold = false) => {
    const b = h("button", { class: "mb" + (bold ? " bold" : "") + (menuOpen === id ? " on" : ""), "aria-haspopup": "menu", "aria-expanded": String(menuOpen === id), role: "menuitem",
      onClick: () => { menuOpen = menuOpen === id ? null : id; show(b, id); }, onMouseenter: () => { if (menuOpen && menuOpen !== id) { menuOpen = id; show(b, id); } } }, label);
    return b;
  };
  const show = (anchor: HTMLElement, id: string) => {
    closeMenu();
    if (!menuOpen) { drawBar(); return; }
    const r = anchor.getBoundingClientRect();
    const items: Record<string, MenuItem[]> = {
      zk: [{ label: "About ZKHUB", run: () => openProgram("about") }, { label: "Settings…", run: () => openProgram("settings") }, { sep: true, label: "" }, { label: "Lock Screen", run: () => overlay("lock") }],
      app: [{ label: "About " + (p?.title ?? "ZKHUB"), run: () => openProgram("about") }, { sep: true, label: "" }, { label: "Quit", disabled: !f, run: () => f && WM.close(f.id) }],
      ...menus(),
    };
    popMenu(r.left, r.bottom + 2, (items[id] ?? []).map((i) => ({ ...i, run: i.run && (() => { menuOpen = null; i.run!(); drawBar(); }) })));
    drawBar();
  };
  bar.append(
    top("zk", h("img", { src: "/logo.png", alt: "ZKHUB", width: "15", height: "15" })),
    top("app", p?.title ?? "Finder", true),
    h("div", { class: "mb-set" }, Object.keys(menus()).map((k) => top(k, k))),
    h("div", { class: "mb-r" },
      h("span", { class: "chip", title: "Robinhood Chain block height" }, h("i", { class: "led" + (live.rpcOk === false ? " off" : live.rpcOk ? " on" : "") }), h("span", { id: "mb-block" }, Number.isFinite(live.block) ? fmtInt(live.block) : "—")),
      h("button", { class: "mb", "aria-label": "Search", title: "Search (Ctrl K)", html: icon("search", 15), onClick: () => overlay("palette") }),
      h("button", { class: "mb", "aria-label": "Launcher", title: "Launcher", html: icon("grid", 15), onClick: () => overlay("launcher") }),
      h("button", { class: "btn btn-accent btn-xs", id: "connect", onClick: connect }, wallet ? shortAddr(wallet) : "Connect"),
      h("time", { class: "clock", id: "clock" }, fmtClock(new Date()))));
}
document.addEventListener("pointerdown", (e) => { if (menuOpen && !(e.target as HTMLElement).closest(".menu, .mb")) { menuOpen = null; closeMenu(); drawBar(); } });
addEventListener("keydown", (e) => { if (e.key === "Escape" && menuOpen) { menuOpen = null; closeMenu(); drawBar(); } });
WM.onWindows(() => { if (!menuOpen) drawBar(); syncDock(); });
drawBar();
setInterval(() => { const c = document.getElementById("clock"); const t = fmtClock(new Date()); if (c && c.textContent !== t) c.textContent = t; tickWidgets(); }, 1000);

/* ---------- desktop icons ---------- */
const badgeKind = (b?: string) => (b === "Beta" ? "test" : "poc");
function drawIcons() {
  const box = $id("icons"); clear(box);
  for (const p of desktop) {
    const b = h("button", { class: "di", "data-prog": p.id, "aria-label": p.title + (p.badge ? ", " + p.badge : ""),
      onClick: (e: MouseEvent) => { document.querySelectorAll(".di.sel").forEach((x) => x.classList.remove("sel")); b.classList.add("sel"); if (matchMedia("(pointer: coarse)").matches || e.detail === 0) openProgram(p.id); },
      onDblclick: () => openProgram(p.id),
      onKeydown: (e: KeyboardEvent) => { if (e.key === "Enter") openProgram(p.id); } },
      h("span", { class: "di-ic", html: icon(p.icon, 30) }), h("span", { class: "di-nm" }, p.title), p.badge ? h("span", { class: "di-b " + badgeKind(p.badge), title: p.badge }, p.badge === "Proof of concept" ? "PoC" : p.badge) : null);
    box.append(b);
  }
}
drawIcons();
$id("desktop").addEventListener("pointerdown", (e) => { if (!(e.target as HTMLElement).closest(".di")) document.querySelectorAll(".di.sel").forEach((x) => x.classList.remove("sel")); });
$id("desktop").addEventListener("contextmenu", (e) => {
  if ((e.target as HTMLElement).closest(".di")) return;
  e.preventDefault();
  popMenu(e.clientX, e.clientY, [
    { label: "Open Launchpad", run: () => openProgram("launchpad") }, { label: "New Folder…", run: () => openProgram("launches") },
    { label: "Change Wallpaper", run: () => { const i = wallpapers.indexOf(state.settings.wallpaper); commit({ settings: { ...state.settings, wallpaper: wallpapers[(i + 1) % 3] } }); } },
    { sep: true, label: "" }, { label: "Settings…", run: () => openProgram("settings") }, { label: "Lock Screen", run: () => overlay("lock") }]);
});

/* ---------- dock (magnify) ---------- */
const dockProgs = programs.filter((p) => p.dock);
let pointerX = Infinity;
const dockEl = $id("dock");
function drawDock() {
  clear(dockEl);
  const mk = (p: (typeof programs)[number]) => {
    const b = h("button", { class: "dk", "data-dock": p.id, "aria-label": p.title, onClick: () => { const w = WM.list().filter((x) => x.programId === p.id); if (w.length) { const m = w.find((x) => x.minimized); WM.focus((m ?? w[w.length - 1]).id); } else openProgram(p.id); } },
      h("span", { class: "dk-ic", html: icon(p.icon, 28) }), h("span", { class: "dk-tip" }, p.title), h("i", { class: "dk-dot" }));
    return b;
  };
  dockProgs.forEach((p) => dockEl.append(mk(p)));
  dockEl.append(h("span", { class: "dk-sep", "aria-hidden": "true" }), mk(programs.find((p) => p.id === "recycle")!));
  syncDock();
}
function syncDock() {
  const running = new Set(WM.list().map((w) => w.programId));
  dockEl.querySelectorAll<HTMLElement>(".dk").forEach((b) => b.classList.toggle("run", running.has(b.dataset.dock!)));
}
function magnify() {
  dockEl.querySelectorAll<HTMLElement>(".dk").forEach((b) => {
    const r = b.getBoundingClientRect(); const s = magnifyScale(pointerX, r.left + r.width / 2);
    (b.firstElementChild as HTMLElement).style.transform = s === 1 ? "" : `scale(${s.toFixed(3)})`;
    b.style.zIndex = s > 1.05 ? "2" : "";
  });
}
if (!reduced) {
  dockEl.addEventListener("pointermove", (e) => { if (e.pointerType === "touch") return; pointerX = e.clientX; requestAnimationFrame(magnify); });
  dockEl.addEventListener("pointerleave", () => { pointerX = Infinity; requestAnimationFrame(magnify); });
}
function bounce(id: string) { if (reduced) return; const b = dockEl.querySelector<HTMLElement>(`[data-dock="${id}"]`); if (!b) return; b.classList.remove("bounce"); void b.offsetWidth; b.classList.add("bounce"); }
drawDock();

/* ---------- widgets (draggable) ---------- */
const wEl = $id("widgets");
const cards: Record<string, HTMLElement> = {};
function card(id: string, label: string, y: number, body: () => HTMLElement) {
  const c = h("section", { class: "widget glass", "data-w": id, style: { top: y + "px" }, "aria-label": label });
  const draw = () => { clear(c); c.append(h("p", { class: "label grab" }, label), body()); };
  draw(); wEl.append(c); cards[id] = c;
  let sx = 0, sy = 0, ox = 0, oy = 0;
  c.addEventListener("pointerdown", (e) => {
    if ((e.target as HTMLElement).closest("button, a")) return;
    sx = e.clientX; sy = e.clientY; ox = c.offsetLeft; oy = c.offsetTop; c.setPointerCapture(e.pointerId); c.classList.add("drag");
    const mv = (ev: PointerEvent) => { c.style.left = Math.max(0, Math.min(ox + ev.clientX - sx, wEl.clientWidth - c.offsetWidth)) + "px"; c.style.right = "auto"; c.style.top = Math.max(0, Math.min(oy + ev.clientY - sy, wEl.clientHeight - 40)) + "px"; };
    const up = () => { c.removeEventListener("pointermove", mv); c.removeEventListener("pointerup", up); c.classList.remove("drag"); };
    c.addEventListener("pointermove", mv); c.addEventListener("pointerup", up);
  });
  return draw;
}
const ca = caState(CA, CA_DATE);
card("notice", "Token notice", 12, () => h("div", {}, h("p", { class: "wt" }, ca.live ? "Official contract" : "No token announced"),
  h("p", { class: "fine" }, ca.live ? "The only official address is the one in the bar at the top of the screen." : "When a contract is announced it will appear in the bar at the top of the screen and nowhere else.")));
const drawNext = card("next", "Next planned launch", 132, () => {
  const n = nextLaunch(state.tree, Date.now());
  return n ? h("div", {}, h("p", { class: "wt" }, n.name), h("p", { class: "cd", id: "cd" }, fmtCountdown(n.at - Date.now()))) : h("p", { class: "fine mt" }, "Nothing planned. Drafts you schedule show here.");
});
const drawStats = card("stats", "Live stats", 252, () => {
  const ok = live.rpcOk;
  return h("div", {}, h("span", { class: "livep " + (ok ? "on" : ok === false ? "off" : "") }, h("i", {}), ok ? "LIVE" : ok === false ? "OFFLINE" : "CONNECTING"),
    h("dl", { class: "stats" }, h("dt", {}, "Block"), h("dd", {}, Number.isFinite(live.block) ? fmtInt(live.block) : "—"), h("dt", {}, "Gas"), h("dd", {}, Number.isFinite(live.gas) ? weiToGwei(live.gas) + " gwei" : "—"), h("dt", {}, "TVL"), h("dd", {}, compactUsd(live.tvl)), h("dt", {}, "Chain"), h("dd", {}, CHAIN.id + "")));
});
const drawWatch = card("watch", "Watchlist", 402, () => {
  if (!state.watch.length) return h("p", { class: "fine mt" }, "Star a coin in Launchpad Market.");
  if (!live.pairs) return h("p", { class: "fine mt" }, "Loading prices…");
  const rows = live.pairs.filter((p) => state.watch.includes(p.address)).slice(0, 5);
  if (!rows.length) return h("p", { class: "fine mt" }, "Prices unavailable for your list right now.");
  return h("ul", { class: "wl" }, rows.map((p) => h("li", {}, h("button", { onClick: () => openProgram("launchpad") }, h("b", {}, p.symbol), h("span", { class: "mono" }, p.priceUsd >= 1 ? "$" + p.priceUsd.toFixed(2) : "$" + p.priceUsd.toPrecision(3)), h("span", { class: "mono " + (p.change24h >= 0 ? "up" : "dn") }, pct(p.change24h))))));
});
function tickWidgets() { const cd = document.getElementById("cd"); const n = nextLaunch(state.tree, Date.now()); if (cd && n) cd.textContent = fmtCountdown(n.at - Date.now()); else if (cd && !n) drawNext(); }
onLive(() => { drawStats(); drawWatch(); const b = document.getElementById("mb-block"); if (b) b.textContent = Number.isFinite(live.block) ? fmtInt(live.block) : "—"; const led = document.querySelector(".chip .led"); if (led) led.className = "led" + (live.rpcOk === false ? " off" : live.rpcOk ? " on" : ""); });
subscribe(() => { drawNext(); drawWatch(); });

/* ---------- overlays: palette, mission control, launcher, lock ---------- */
type Ov = "palette" | "mission" | "launcher" | "lock";
let ovKind: Ov | null = null;
const ov = $id("overlay");
function closeOv() { ovKind = null; clear(ov); }
function overlay(k: Ov) {
  closeMenu(); menuOpen = null; drawBar();
  if (ovKind === k) { closeOv(); return; }
  closeOv(); ovKind = k;
  if (k === "palette") {
    const acts: { label: string; group: string; run: () => void }[] = [
      ...programs.filter((p) => p.desktop).map((p) => ({ label: p.title, group: "Programs", run: () => openProgram(p.id) })),
      { label: "Lock screen", group: "System", run: () => overlay("lock") }, { label: "Mission Control", group: "System", run: () => overlay("mission") },
      { label: "Change wallpaper", group: "Settings", run: () => { const i = wallpapers.indexOf(state.settings.wallpaper); commit({ settings: { ...state.settings, wallpaper: wallpapers[(i + 1) % 3] } }); } },
    ];
    let idx = 0; const list = h("div", { class: "pal-list", role: "listbox" });
    const input = h("input", { class: "pal-in", placeholder: "Search programs and actions…", "aria-label": "Search" });
    const filtered = () => acts.filter((a) => a.label.toLowerCase().includes(input.value.trim().toLowerCase()));
    const paint = () => { clear(list); const f = filtered(); idx = Math.min(idx, Math.max(0, f.length - 1)); f.forEach((a, i) => list.append(h("button", { role: "option", class: i === idx ? "on" : "", onClick: () => { closeOv(); a.run(); } }, h("span", {}, a.label), h("span", { class: "label" }, a.group)))); if (!f.length) list.append(h("div", { class: "empty" }, "Nothing found")); };
    input.addEventListener("input", () => { idx = 0; paint(); });
    input.addEventListener("keydown", (e) => { const f = filtered(); if (e.key === "ArrowDown") { e.preventDefault(); idx = Math.min(f.length - 1, idx + 1); paint(); } else if (e.key === "ArrowUp") { e.preventDefault(); idx = Math.max(0, idx - 1); paint(); } else if (e.key === "Enter" && f[idx]) { const a = f[idx]; closeOv(); a.run(); } });
    ov.append(h("div", { class: "ov glass-strong top", onClick: (e: Event) => { if (e.target === e.currentTarget) closeOv(); } }, h("div", { class: "pal chrome" }, input, list)));
    paint(); input.focus();
  } else if (k === "launcher") {
    ov.append(h("div", { class: "ov glass-strong", onClick: (e: Event) => { if (e.target === e.currentTarget) closeOv(); } }, h("div", { class: "lgrid" }, desktop.map((p) => h("button", { class: "di", onClick: () => { closeOv(); openProgram(p.id); } }, h("span", { class: "di-ic", html: icon(p.icon, 30) }), h("span", { class: "di-nm" }, p.title))))));
  } else if (k === "mission") {
    const ws = WM.list();
    ov.append(h("div", { class: "ov glass-strong", onClick: (e: Event) => { if (e.target === e.currentTarget) closeOv(); } }, ws.length ? h("div", { class: "mgrid" }, ws.map((w) => h("button", { class: "mtile chrome", onClick: () => { closeOv(); WM.focus(w.id); } }, h("span", { html: icon(WM.program(w.programId)?.icon ?? "file", 28) }), h("b", {}, w.title), h("span", { class: "fine" }, w.minimized ? "minimized" : "open")))) : h("p", { class: "fine" }, "No open windows.")));
  } else {
    const t = h("div", { class: "lock-t" }), d = h("div", { class: "lock-d" });
    const tick = () => { const n = new Date(); t.textContent = n.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); d.textContent = n.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }); };
    tick(); const iv = setInterval(() => { if (ovKind !== "lock") clearInterval(iv); else tick(); }, 1000);
    ov.append(h("div", { class: "ov lock glass-strong", tabindex: "0", onClick: closeOv }, h("img", { src: "/logo.png", alt: "", width: "56", height: "56" }), t, d, h("p", { class: "fine" }, "Click or press any key to unlock")));
    (ov.firstElementChild as HTMLElement).focus();
  }
}
addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); overlay("palette"); }
  else if (e.key === "F3") { e.preventDefault(); overlay("mission"); }
  else if (e.key === "Escape" && ovKind && ovKind !== "lock") closeOv();
  else if (ovKind === "lock") closeOv();
});

/* ---------- boot ---------- */
const params = new URLSearchParams(location.search);
function afterBoot() { startLive(); const o = params.get("open"); if (o && programs.some((p) => p.id === o)) openProgram(o); else if (!WM.list().length && innerWidth > 900) openProgram("launchpad"); }
function boot() {
  let seen = false; try { seen = sessionStorage.getItem("zkhub.booted") === "1"; } catch { /* ignore */ }
  const el = $id("boot");
  if (seen || reduced || params.has("noboot")) { afterBoot(); return; }
  el.hidden = false;
  const lines = ["booting zkhub…", "mounting registry", "loading manifests", `connecting to robinhood chain (${CHAIN.id})`, "establishing rpc", "initializing desktop shell"];
  const log = h("div", { class: "boot-log" }), bar = h("i", {}), skip = h("p", { class: "fine" }, "click or press any key to skip");
  el.append(h("div", { class: "boot-in" }, h("img", { src: "/logo.png", alt: "", width: "40", height: "40" }), log, h("div", { class: "boot-bar" }, bar), skip));
  let i = 0, done = false;
  const finish = () => { if (done) return; done = true; try { sessionStorage.setItem("zkhub.booted", "1"); } catch { /* ignore */ } el.classList.add("out"); setTimeout(() => { el.hidden = true; clear(el); el.classList.remove("out"); }, 350); removeEventListener("keydown", finish); afterBoot(); };
  const step = () => { if (done) return; if (i < lines.length) { log.append(h("div", {}, h("span", { class: "ok" }, "[ ok ]"), " " + lines[i])); bar.style.width = Math.round(((i + 1) / lines.length) * 100) + "%"; i++; setTimeout(step, 170); } else setTimeout(finish, 260); };
  el.addEventListener("click", finish); addEventListener("keydown", finish, { once: true }); step();
}
boot();
