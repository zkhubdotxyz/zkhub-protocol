import { h, clear } from "./dom.ts";
import { icon } from "./icons.ts";
import { state, commit, subscribe, resetAll } from "./store.ts";
import { live, onLive } from "./live.ts";
import { toast, popMenu, ask } from "./ui.ts";
import * as WM from "./windows.ts";
import type { Program, WinCtx } from "./windows.ts";
import { CA, CHAIN } from "../config.ts";
import { caState } from "../lib/ca.ts";
import { compactUsd, fmtInt, weiToGwei, pct } from "../lib/format.ts";
import {
  addNode, binNode, binned, childrenOf, emptyBin, fmtCountdown, manifest, MODELS, moveNode, nextLaunch, pathOf, renameNode, restoreNode, uid,
  validateLaunch, type FNode, type LaunchForm,
} from "../lib/wm.ts";
import pal from "../palette.json";

const usd = (n: number) => (!Number.isFinite(n) ? "—" : n >= 1 ? "$" + n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "$" + n.toPrecision(3));

/* ---------------- shared bits ---------------- */
function tabs(items: [string, string][], active: string, on: (id: string) => void) {
  const wrap = h("div", { class: "seg", role: "tablist" });
  for (const [id, label] of items) wrap.append(h("button", { role: "tab", "aria-selected": String(id === active), class: id === active ? "on" : "", onClick: () => on(id) }, label));
  return wrap;
}
function pill(kind: "live" | "plan" | "prev" | "poc" | "test", text: string) { return h("span", { class: "badge " + kind }, h("i", {}), text); }

/* ---------------- Launchpad ---------------- */
const LAUNCH_MODELS: Record<string, string> = {
  "Sealed Book": "Commitments are sealed during a window, then cleared together at one uniform price. Excess is refunded.",
  "Dutch Descent": "The price steps down on a fixed schedule until supply is taken or the floor is reached.",
  "Lottery Allocation": "Fixed-size tickets are registered, a verifiable draw picks winners and losers are refunded in full.",
  "Classic Curve": "A bonding curve prices every trade. Simple and continuous, but early buyers get the best price.",
};

function launchpad(ctx: WinCtx): HTMLElement {
  let tab = "market";
  const root = h("div", { class: "col" });
  const head = h("div", { class: "pad-b row" });
  const body = h("div", { class: "grow scroll" });
  root.append(head, body);
  const draw = () => {
    clear(head); head.append(tabs([["market", "Market"], ["launch", "New launch"]], tab, (t) => { tab = t; draw(); }), h("span", { class: "sp" }), pill("test", "Launching: testing"));
    clear(body); body.append(tab === "market" ? market() : launchForm());
  };
  function market() {
    const wrap = h("div", { class: "pad" });
    const rows = live.pairs;
    if (rows === null) return h("div", { class: "empty" }, "Loading market data…");
    if (!rows.length) return h("div", { class: "empty" }, "No pairs returned for this chain right now.");
    const tbl = h("div", { class: "tbl" }, h("div", { class: "tr th" }, h("span", {}), h("span", {}, "Token"), h("span", { class: "r" }, "Price"), h("span", { class: "r" }, "24h"), h("span", { class: "r hide-s" }, "Vol 24h"), h("span", { class: "r hide-s" }, "Liquidity")));
    for (const p of rows) {
      const on = state.watch.includes(p.address);
      tbl.append(h("div", { class: "tr" },
        h("button", { class: "star" + (on ? " on" : ""), "aria-label": on ? "Remove from watchlist" : "Add to watchlist", "aria-pressed": String(on), html: icon("star", 16), onClick: () => { commit({ watch: on ? state.watch.filter((a) => a !== p.address) : [...state.watch, p.address] }); toast(on ? "Removed from watchlist" : "Added to watchlist"); } }),
        h("a", { class: "nm", href: p.url || undefined, target: "_blank", rel: "noreferrer noopener" }, h("b", {}, p.symbol || "?"), h("span", {}, p.name)),
        h("span", { class: "r mono" }, usd(p.priceUsd)), h("span", { class: "r mono " + (p.change24h >= 0 ? "up" : "dn") }, pct(p.change24h)),
        h("span", { class: "r mono hide-s" }, compactUsd(p.vol24h)), h("span", { class: "r mono hide-s" }, compactUsd(p.liqUsd))));
    }
    wrap.append(tbl, h("p", { class: "fine" }, "DexScreener data, Robinhood Chain only. Names are self-declared and unverified. Stars stay on this device."));
    return wrap;
  }
  function launchForm() {
    const f: LaunchForm = { name: "", symbol: "", supply: 1_000_000_000, model: "Sealed Book", startPrice: 0.0001, walletCap: 2, privacy: "Public", clusterCap: true, opensAt: "" };
    const errs = h("ul", { class: "errs", role: "alert" });
    const mani = h("pre", { class: "mani" });
    const desc = h("p", { class: "fine" }, LAUNCH_MODELS[f.model]);
    const upd = () => { mani.textContent = manifest(f); desc.textContent = LAUNCH_MODELS[f.model]; };
    const field = (label: string, el: HTMLElement) => h("label", { class: "fld" }, h("span", { class: "label" }, label), el);
    const inp = (k: keyof LaunchForm, type = "text", ph = "") => {
      const i = h("input", { class: "field", type, placeholder: ph, value: String(f[k]), step: "any", onInput: (e: Event) => { const v = (e.target as HTMLInputElement).value; (f as unknown as Record<string, unknown>)[k] = type === "number" ? Number(v) : v; upd(); } });
      return i;
    };
    const model = h("select", { class: "field", onChange: (e: Event) => { f.model = (e.target as HTMLSelectElement).value; upd(); } }, MODELS.map((m) => h("option", { value: m }, m)));
    const priv = h("select", { class: "field", onChange: (e: Event) => { f.privacy = (e.target as HTMLSelectElement).value; upd(); } },
      [["Public", "All orders and balances are visible"], ["Sealed order book", "Order sizes hidden until clear (preview)"], ["Fully shielded", "Balances shielded by proofs (preview)"]].map(([v, l]) => h("option", { value: v }, `${v}: ${l}`)));
    const cap = h("input", { type: "checkbox", checked: true, onChange: (e: Event) => { f.clusterCap = (e.target as HTMLInputElement).checked; upd(); } });
    const save = () => {
      const es = validateLaunch(f); clear(errs); es.forEach((e) => errs.append(h("li", {}, e)));
      if (es.length) return;
      const at = f.opensAt ? Date.parse(f.opensAt) : NaN;
      const folder = Number.isFinite(at) && at > Date.now() ? "f-scheduled" : "f-drafts";
      const tree = addNode(state.tree, { id: uid("l"), kind: "launch", name: f.name.trim(), parent: folder, data: { ...f, symbol: f.symbol.toUpperCase(), scheduledAt: Number.isFinite(at) && at > Date.now() ? f.opensAt : "" } });
      commit({ tree, drafts: state.drafts + 1 });
      toast("Draft saved to My Launches. Nothing was deployed.");
    };
    upd();
    return h("div", { class: "pad lp-grid" },
      h("form", { class: "lp-form chrome", onSubmit: (e: Event) => { e.preventDefault(); save(); } },
        h("p", { class: "label" }, "Token launch (draft only)"),
        h("div", { class: "g2" }, field("Name", inp("name", "text", "e.g. Example Token")), field("Symbol", inp("symbol", "text", "EXMPL"))),
        h("div", { class: "g2" }, field("Total supply", inp("supply", "number")), field("Start price (ETH)", inp("startPrice", "number"))),
        field("Launch model", model), desc,
        h("div", { class: "g2" }, field("Wallet cap (%)", inp("walletCap", "number")), field("Opens at", inp("opensAt", "datetime-local"))),
        field("Privacy level", priv),
        h("label", { class: "chk" }, cap, h("span", {}, "Merge wallet clusters when applying the cap")),
        errs,
        h("div", { class: "row end" },
          h("button", { type: "submit", class: "btn" }, "Save draft"),
          h("button", { type: "button", class: "btn btn-accent", disabled: true, title: "Launching is not live yet" }, "Review & Deploy")),
        h("p", { class: "fine" }, "Inert form: drafts are stored on this device only. Deploying is disabled until launching goes live.")),
      h("div", { class: "chrome" }, h("p", { class: "label" }, "Manifest preview"), mani));
  }
  const off = onLive(() => { if (!root.isConnected) { off(); return; } if (tab === "market" && !body.querySelector("input:focus")) { clear(body); body.append(market()); } });
  void ctx; draw();
  return root;
}

/* ---------------- My Launches (file manager) ---------------- */
function launches(ctx: WinCtx): HTMLElement {
  let cur: string | null = null, sel: string | null = null;
  const root = h("div", { class: "fm" });
  const side = h("aside", { class: "fm-side glass scroll" }), main = h("div", { class: "fm-main col" }), bar = h("div", { class: "fm-bar" }), grid = h("div", { class: "fm-grid scroll" });
  main.append(bar, grid); root.append(side, main);
  const drop = (el: HTMLElement, target: string | null) => {
    el.addEventListener("dragover", (e) => { e.preventDefault(); el.classList.add("over"); });
    el.addEventListener("dragleave", () => el.classList.remove("over"));
    el.addEventListener("drop", (e) => { e.preventDefault(); el.classList.remove("over"); const id = e.dataTransfer?.getData("text/plain"); if (id) { const t = moveNode(state.tree, id, target); if (t !== state.tree) { commit({ tree: t }); toast("Moved"); } } });
  };
  const ctxMenu = (e: MouseEvent, n: FNode) => {
    e.preventDefault(); sel = n.id;
    popMenu(e.clientX, e.clientY, [
      { label: "Open", run: () => openNode(n) },
      { label: "Rename…", run: async () => { const v = await ask("Rename", n.name); if (v) commit({ tree: renameNode(state.tree, n.id, v) }); } },
      { sep: true, label: "" },
      { label: "Move to Recycle Bin", run: () => { commit({ tree: binNode(state.tree, n.id) }); toast("Moved to Recycle Bin"); } },
    ]);
  };
  const openNode = (n: FNode) => { if (n.kind === "folder") { cur = n.id; sel = null; draw(); } else WM.open("launchdetail", { payload: { id: n.id }, title: n.name }); };
  function sideTree(parent: string | null, depth: number, into: HTMLElement) {
    for (const n of childrenOf(state.tree, parent).filter((x) => x.kind === "folder")) {
      const b = h("button", { class: "fm-nav" + (cur === n.id ? " on" : ""), style: { paddingLeft: 10 + depth * 14 + "px" }, onClick: () => { cur = n.id; sel = null; draw(); } }, h("span", { html: icon("folder", 15) }), n.name);
      drop(b, n.id); into.append(b); sideTree(n.id, depth + 1, into);
    }
  }
  function draw() {
    clear(side); clear(bar); clear(grid);
    side.append(h("p", { class: "label pad-s" }, "Favorites"));
    const all = h("button", { class: "fm-nav" + (cur === null ? " on" : ""), onClick: () => { cur = null; sel = null; draw(); } }, h("span", { html: icon("rocket", 15) }), "All launches");
    drop(all, null); side.append(all, h("p", { class: "label pad-s" }, "Folders")); sideTree(null, 0, side);
    const crumbs = pathOf(state.tree, cur);
    bar.append(
      h("button", { class: "ib", "aria-label": "Up one level", disabled: cur === null, html: icon("up", 16), onClick: () => { cur = crumbs.length > 1 ? crumbs[crumbs.length - 2].id : null; draw(); } }),
      h("nav", { class: "crumbs", "aria-label": "Path" }, h("button", { onClick: () => { cur = null; draw(); } }, "My Launches"), crumbs.map((c) => [h("span", {}, "/"), h("button", { onClick: () => { cur = c.id; draw(); } }, c.name)])),
      h("span", { class: "sp" }),
      h("button", { class: "btn btn-sm", onClick: async () => { const v = await ask("New folder name", "New Folder"); if (v) commit({ tree: addNode(state.tree, { id: uid("f"), kind: "folder", name: v.trim().slice(0, 60) || "New Folder", parent: cur }) }); } }, h("span", { html: icon("plus", 14) }), "New Folder"),
      h("button", { class: "btn btn-sm", disabled: !sel, onClick: () => { if (sel) { commit({ tree: binNode(state.tree, sel) }); sel = null; toast("Moved to Recycle Bin"); } } }, h("span", { html: icon("bin", 14) }), "Delete"));
    const items = childrenOf(state.tree, cur).sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "folder" ? -1 : 1));
    if (!items.length) grid.append(h("div", { class: "empty" }, cur ? "This folder is empty." : "No launches yet. Save a draft from Launchpad, or create a folder."));
    for (const n of items) {
      const el = h("button", { class: "fm-item" + (sel === n.id ? " sel" : ""), draggable: "true", title: n.name,
        onClick: () => { sel = n.id; grid.querySelectorAll(".sel").forEach((x) => x.classList.remove("sel")); el.classList.add("sel"); (bar.querySelectorAll("button.btn")[1] as HTMLButtonElement).disabled = false; },
        onDblclick: () => openNode(n), onContextmenu: (e: MouseEvent) => ctxMenu(e, n),
        onKeydown: (e: KeyboardEvent) => { if (e.key === "Enter") openNode(n); if (e.key === "Delete") { commit({ tree: binNode(state.tree, n.id) }); } },
        onDragstart: (e: DragEvent) => e.dataTransfer?.setData("text/plain", n.id) },
        h("span", { class: "fm-ic", html: icon(n.kind === "folder" ? "folder" : "file", 34) }), h("span", { class: "fm-nm" }, n.name),
        n.kind === "launch" && n.data?.scheduledAt ? h("span", { class: "fm-sub" }, "scheduled") : null);
      if (n.kind === "folder") drop(el, n.id);
      grid.append(el);
    }
    ctx.setTitle(cur ? "My Launches · " + (crumbs[crumbs.length - 1]?.name ?? "") : "My Launches");
  }
  drop(grid, cur);
  const un = subscribe(() => { if (!root.isConnected) { un(); return; } if (cur && !state.tree.some((n) => n.id === cur && !n.binned)) cur = null; draw(); });
  draw();
  return root;
}

function launchDetail(ctx: WinCtx): HTMLElement {
  const n = state.tree.find((x) => x.id === ctx.payload?.id);
  if (!n) return h("div", { class: "empty" }, "This draft no longer exists.");
  const d = (n.data ?? {}) as unknown as LaunchForm;
  return h("div", { class: "pad col gap" },
    h("div", { class: "row" }, h("b", { class: "big" }, n.name), h("span", { class: "sp" }), pill("test", "Draft, local only")),
    h("dl", { class: "dl" }, ...[["Symbol", d.symbol], ["Model", d.model], ["Supply", fmtInt(Number(d.supply))], ["Wallet cap", d.walletCap + "%"], ["Privacy", d.privacy], ["Opens", d.opensAt ? new Date(d.opensAt).toLocaleString() : "Not scheduled"]].flatMap(([k, v]) => [h("dt", {}, k), h("dd", {}, String(v ?? "—"))])),
    h("pre", { class: "mani" }, manifest(d)));
}

/* ---------------- Scheduler ---------------- */
function scheduler(_ctx: WinCtx): HTMLElement {
  const now = new Date(); let y = now.getFullYear(), m = now.getMonth();
  const root = h("div", { class: "sched" });
  const draw = () => {
    clear(root);
    const items = state.tree.filter((n) => n.kind === "launch" && !n.binned && n.data?.scheduledAt);
    const dayKeys = new Set(items.map((n) => { const d = new Date(String(n.data?.scheduledAt)); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }));
    const first = new Date(y, m, 1), days = new Date(y, m + 1, 0).getDate();
    const cal = h("div", { class: "cal" });
    for (const d of ["S", "M", "T", "W", "T", "F", "S"]) cal.append(h("span", { class: "label c" }, d));
    for (let i = 0; i < first.getDay(); i++) cal.append(h("span", {}));
    for (let d = 1; d <= days; d++) {
      const isToday = y === now.getFullYear() && m === now.getMonth() && d === now.getDate();
      cal.append(h("span", { class: "day" + (isToday ? " today" : "") + (dayKeys.has(`${y}-${m}-${d}`) ? " has" : "") }, d));
    }
    const list = h("div", { class: "col gap-s" }, h("p", { class: "label" }, "Scheduled launches"));
    const sorted = items.sort((a, b) => Date.parse(String(a.data?.scheduledAt)) - Date.parse(String(b.data?.scheduledAt)));
    if (!sorted.length) list.append(h("p", { class: "fine" }, "Nothing scheduled. Set an “Opens at” time when saving a draft in Launchpad."));
    for (const n of sorted) list.append(h("div", { class: "chrome row" }, h("div", {}, h("b", {}, n.name), h("div", { class: "fine" }, new Date(String(n.data?.scheduledAt)).toLocaleString())), h("span", { class: "sp" }),
      h("button", { class: "btn btn-sm", onClick: () => { commit({ tree: state.tree.map((x) => (x.id === n.id ? { ...x, data: { ...x.data, scheduledAt: "" } } : x)) }); } }, "Unschedule")));
    root.append(h("div", { class: "pad" },
      h("div", { class: "row" }, h("button", { class: "ib", "aria-label": "Previous month", html: icon("chevL", 16), onClick: () => { if (--m < 0) { m = 11; y--; } draw(); } }), h("b", { class: "mo" }, first.toLocaleString("en-US", { month: "long", year: "numeric" })), h("button", { class: "ib", "aria-label": "Next month", html: icon("chevR", 16), onClick: () => { if (++m > 11) { m = 0; y++; } draw(); } })),
      cal), h("div", { class: "pad" }, list));
  };
  const un = subscribe(() => { if (!root.isConnected) { un(); return; } draw(); });
  draw();
  return root;
}

/* ---------------- Terminal ---------------- */
function terminal(_ctx: WinCtx): HTMLElement {
  const out = h("div", { class: "term-out scroll" });
  const input = h("input", { class: "term-in", spellcheck: "false", autocomplete: "off", "aria-label": "Terminal input" });
  const hist: string[] = []; let hi = 0;
  const print = (t: string, cls = "") => { out.append(h("div", { class: cls }, t)); out.scrollTop = out.scrollHeight; };
  print("ZKHUB shell 0.1.0, read-only chain access"); print("type `help` for commands", "dim");
  const cmds: Record<string, (a: string[]) => void> = {
    help: () => ["help              this list", "ls                list programs", "status            chain and system status", "launches         list local drafts", "schedule         list scheduled launches", "clear             clear the screen"].forEach((l) => print(l)),
    ls: () => WM.list().length >= 0 && print(programs.filter((p) => p.desktop).map((p) => p.title).join("   ")),
    status: () => { print(`chain      ${CHAIN.name} (${CHAIN.id})`); print(`block      ${fmtInt(live.block)}`); print(`gas        ${weiToGwei(live.gas)} gwei`); print(`tvl        ${compactUsd(live.tvl)}`); print("data       live, read-only (DexScreener, DefiLlama, RPC)"); print("launching  not live yet"); },
    launches: () => { const l = state.tree.filter((n) => n.kind === "launch" && !n.binned); print(l.length ? l.map((n) => n.name).join("\n") : "no local drafts"); },
    schedule: () => { const l = state.tree.filter((n) => n.kind === "launch" && !n.binned && n.data?.scheduledAt); print(l.length ? l.map((n) => `${n.name}  ${new Date(String(n.data?.scheduledAt)).toLocaleString()}`).join("\n") : "no scheduled launches"); },
    clear: () => clear(out),
  };
  const run = (line: string) => {
    print("$ " + line, "cmd"); const [c, ...a] = line.trim().split(/\s+/); if (!c) return;
    if (cmds[c]) cmds[c](a); else if (["coin", "scan", "pool", "exposure", "verify-seed"].includes(c)) print(`${c}: not live yet`, "dim"); else print(`${c}: command not found`, "err");
  };
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { const v = input.value; if (v.trim()) { hist.push(v); hi = hist.length; } run(v); input.value = ""; }
    else if (e.key === "ArrowUp") { e.preventDefault(); if (hi > 0) input.value = hist[--hi]; }
    else if (e.key === "ArrowDown") { e.preventDefault(); input.value = hi < hist.length - 1 ? hist[++hi] : ((hi = hist.length), ""); }
  });
  const root = h("div", { class: "term", onClick: () => input.focus() }, out, h("div", { class: "term-line" }, h("span", {}, "$"), input));
  setTimeout(() => input.focus(), 60);
  return root;
}

/* ---------------- Docs ---------------- */
const DOCS: [string, string, string[]][] = [
  ["overview", "Overview", ["ZKHUB is a desktop for Robinhood Chain (chain id 4663). It combines a launchpad, on-chain analysis tools and zero-knowledge verification in one place.", "Today the desktop is read-only: live market and chain data are real, launching is in testing and proof tooling is a preview. Every window states its status."]],
  ["data", "Data sources", ["Blocks and gas come from the public Robinhood Chain RPC. TVL comes from DefiLlama. Pairs come from DexScreener.", "All requests are made from your browser. There is no account, no wallet connection required and nothing is sent about you."]],
  ["launchpad", "Launchpad status", ["Market view: live. Launch form: draft only. Deploying is disabled and nothing is ever sent on-chain from this desktop yet.", "Drafts are saved to My Launches in this browser. Clearing site data removes them."]],
  ["models", "Launch models", Object.entries(LAUNCH_MODELS).map(([k, v]) => `${k}. ${v}`)],
  ["local", "My Launches & Scheduler", ["My Launches is a file manager for your local drafts: folders, drag and drop, rename and a Recycle Bin. The Scheduler shows drafts that have an opening time, and the sidebar counts down to the next one."]],
  ["privacy", "Privacy & proofs", ["Privacy Lab, Proof Explorer, Entropy, Pool and FractalNets are planned or preview programs. They are listed so the shape of the product is visible; they do nothing yet."]],
  ["notice", "Contract address & notice", [caState(CA, "").live ? `The only official contract address is shown in the bar at the top of the screen: ${CA}.` : "No token contract has been announced. When one is, it will appear in the bar at the top of the screen and nowhere else. Treat any other address, airdrop or account claiming to be ZKHUB as fraudulent."]],
  ["legal", "Disclaimers", ["Not financial advice. Third-party token names and prices are unverified. ZKHUB is not affiliated with Robinhood."]],
];
function docs(_ctx: WinCtx): HTMLElement {
  let cur = "overview";
  const side = h("aside", { class: "fm-side glass scroll" }), main = h("article", { class: "docs scroll" });
  const draw = () => {
    clear(side); clear(main);
    side.append(h("p", { class: "label pad-s" }, "Docs"), ...DOCS.map(([id, t]) => h("button", { class: "fm-nav" + (cur === id ? " on" : ""), onClick: () => { cur = id; draw(); } }, t)));
    const d = DOCS.find((x) => x[0] === cur)!;
    main.append(h("h2", {}, d[1]), ...d[2].map((p) => h("p", {}, p)));
  };
  draw();
  return h("div", { class: "fm" }, side, main);
}

/* ---------------- Settings ---------------- */
const ACCENTS: { id: "lime" | "white" | "moss"; label: string; token: string }[] = [
  { id: "lime", label: "Lime", token: "--accent" }, { id: "white", label: "White", token: "--fg" }, { id: "moss", label: "Moss", token: "--green-mid" },
];
export const tokenValue = (t: string) => (pal.tokens as Record<string, { value: string }>)[t]?.value ?? "#ffffff";
function settings(_ctx: WinCtx): HTMLElement {
  let tab = "appearance";
  const root = h("div", { class: "col" }), body = h("div", { class: "pad grow scroll col gap" });
  const draw = () => {
    clear(root); clear(body);
    root.append(h("div", { class: "pad-b row" }, tabs([["appearance", "Appearance"], ["wallpaper", "Wallpaper"], ["system", "System"]], tab, (t) => { tab = t; draw(); })), body);
    if (tab === "appearance") {
      body.append(h("p", { class: "label" }, "Accent (from the sampled brand palette)"), h("div", { class: "row gap" }, ACCENTS.map((a) =>
        h("button", { class: "swatch" + (state.settings.accent === a.id ? " on" : ""), style: { "--sw": tokenValue(a.token) }, "aria-label": a.label, "aria-pressed": String(state.settings.accent === a.id), onClick: () => { commit({ settings: { ...state.settings, accent: a.id } }); draw(); } }, h("i", {}), a.label))));
    } else if (tab === "wallpaper") {
      body.append(h("p", { class: "label" }, "Wallpaper"), h("div", { class: "row gap wrap" }, (["drift", "trench", "static"] as const).map((w) =>
        h("button", { class: "wp wallpaper-" + w + (state.settings.wallpaper === w ? " on" : ""), "aria-pressed": String(state.settings.wallpaper === w), onClick: () => { commit({ settings: { ...state.settings, wallpaper: w } }); draw(); } }, h("span", {}, w)))));
    } else {
      body.append(h("p", { class: "fine" }, "Preferences and drafts are saved to this browser only."), h("div", { class: "row" }, h("button", { class: "btn", onClick: async () => { if (confirm("Delete all local drafts, folders and settings on this device?")) { resetAll(); toast("Local data cleared"); draw(); } } }, "Reset local data")));
    }
  };
  draw();
  return root;
}

/* ---------------- Recycle Bin ---------------- */
function recycle(_ctx: WinCtx): HTMLElement {
  const root = h("div", { class: "col" });
  const draw = () => {
    clear(root);
    const items = binned(state.tree).filter((n) => !n.binned || n.parent === null || !state.tree.find((p) => p.id === n.parent)?.binned);
    root.append(h("div", { class: "pad-b row" }, h("b", {}, `${items.length} item${items.length === 1 ? "" : "s"}`), h("span", { class: "sp" }), h("button", { class: "btn btn-sm", disabled: !items.length, onClick: () => { if (confirm("Permanently delete everything in the Recycle Bin?")) { commit({ tree: emptyBin(state.tree) }); toast("Recycle Bin emptied"); } } }, "Empty bin")));
    const body = h("div", { class: "pad grow scroll col gap-s" });
    if (!items.length) body.append(h("div", { class: "empty" }, "The Recycle Bin is empty."));
    for (const n of items) body.append(h("div", { class: "chrome row" }, h("span", { html: icon(n.kind === "folder" ? "folder" : "file", 18) }), h("b", {}, n.name), h("span", { class: "sp" }), h("button", { class: "btn btn-sm", onClick: () => commit({ tree: restoreNode(state.tree, n.id) }) }, "Restore")));
    root.append(body);
  };
  const un = subscribe(() => { if (!root.isConnected) { un(); return; } draw(); });
  draw();
  return root;
}

/* ---------------- About + Coming soon ---------------- */
function about(_ctx: WinCtx): HTMLElement {
  return h("div", { class: "about col" }, h("img", { src: "/logo.png", alt: "", width: "84", height: "84" }), h("b", { class: "big" }, "ZKHUB"), h("p", { class: "fine" }, "Version 0.1.0 · Robinhood Chain (4663)"),
    h("p", { class: "center-t" }, "The ZK layer for Robinhood Chain. Read-only by default."), h("p", { class: "fine" }, "Not affiliated with Robinhood. © 2026 zkhub.xyz"));
}
function soon(title: string, ic: string, kind: "plan" | "prev" | "poc", label: string, blurb: string, will: string[]): (c: WinCtx) => HTMLElement {
  return () => h("div", { class: "soon" }, h("div", { class: "soon-ic", html: icon(ic, 40) }), h("h2", {}, title), pill(kind, label), h("p", { class: "lede" }, blurb),
    h("ul", { class: "will" }, will.map((w) => h("li", {}, w))), h("p", { class: "fine" }, "Coming soon. Nothing here is live and no data is collected."));
}

/* ---------------- registry ---------------- */
export const programs: Program[] = [
  { id: "launchpad", title: "Launchpad", icon: "rocket", w: 920, h: 600, desktop: true, dock: true, blurb: "Live market data. Launching is in testing.", render: launchpad },
  { id: "launches", title: "My Launches", icon: "folder", w: 720, h: 480, desktop: true, dock: true, blurb: "Local drafts in folders.", render: launches },
  { id: "scheduler", title: "Scheduler", icon: "calendar", w: 800, h: 520, desktop: true, dock: true, blurb: "Scheduled launches.", render: scheduler },
  { id: "tools", title: "Privacy Tools", icon: "search", w: 760, h: 520, desktop: true, blurb: "Wallet forensics.", render: soon("Privacy Tools", "search", "plan", "Planned", "Bundle Scanner and wallet association tools for tracing shared funding behind a token.", ["Find wallets that bought in the same block", "Group wallets by shared funding source", "Show evidence for every finding"]) },
  { id: "swap", title: "Swap", icon: "swap", w: 560, h: 560, desktop: true, dock: true, badge: "Beta", blurb: "Swaps and bridges.", render: soon("Swap", "swap", "plan", "Planned", "Same-chain swaps and bridges routed through an aggregator.", ["Quote and compare routes", "Read-only until you sign", "Fee transparency"]) },
  { id: "fractal", title: "FractalNets", icon: "network", w: 760, h: 520, desktop: true, badge: "Proof of concept", blurb: "Wallet networks.", render: soon("FractalNets", "network", "poc", "Proof of concept", "Explore how large wallet networks branch, on synthetic demo data first.", ["Interactive branching graph", "Synthetic data only at first"]) },
  { id: "pool", title: "Pool", icon: "pool", w: 760, h: 520, desktop: true, dock: true, badge: "Proof of concept", blurb: "Sealed batch venue.", render: soon("Pool", "pool", "poc", "Proof of concept", "A simulated venue for sealed-batch clearing.", ["Batch clock and phases", "Simulated orders only", "Uniform clearing price"]) },
  { id: "entropy", title: "Entropy", icon: "entropy", w: 760, h: 520, desktop: true, blurb: "Verifiable randomness.", render: soon("Entropy", "entropy", "plan", "Planned", "Verifiable randomness for lottery allocations.", ["Committed seeds", "Reproducibility checks"]) },
  { id: "privacy", title: "Privacy Control Panel", icon: "shield", w: 560, h: 480, desktop: true, blurb: "Default privacy level.", render: soon("Privacy Control Panel", "shield", "prev", "Preview", "Choose how much of a launch is public.", ["Public, sealed or shielded levels", "Disclosure limits", "Viewing-key expiry"]) },
  { id: "lab", title: "Privacy Lab", icon: "flask", w: 760, h: 520, desktop: true, blurb: "Simulations.", render: soon("Privacy Lab", "flask", "prev", "Preview", "Illustrative simulations of how on-chain privacy leaks and holds.", ["Guided scenarios", "Illustrative, not real data"]) },
  { id: "proofs", title: "Proof Explorer", icon: "hash", w: 760, h: 520, desktop: true, blurb: "Inspect proofs.", render: soon("Proof Explorer", "hash", "prev", "Preview", "Browse and re-verify proofs from launch receipts.", ["Receipt lookup", "Public-input display", "Independent re-verification"]) },
  { id: "taskmgr", title: "Task Manager", icon: "gauge", w: 680, h: 420, desktop: true, blurb: "Wallet holdings.", render: soon("Task Manager", "gauge", "plan", "Planned", "Your wallet's token holdings shown as processes, read-only.", ["Connect a wallet read-only", "Token balances and value"]) },
  { id: "terminal", title: "Terminal", icon: "terminal", w: 560, h: 360, desktop: true, dock: true, blurb: "Command line.", render: terminal },
  { id: "recycle", title: "Recycle Bin", icon: "bin", w: 480, h: 360, desktop: true, blurb: "Deleted items.", render: recycle },
  { id: "settings", title: "Settings", icon: "cog", w: 520, h: 420, desktop: true, dock: true, blurb: "Appearance and data.", render: settings },
  { id: "docs", title: "Docs", icon: "file", w: 1000, h: 640, desktop: true, dock: true, blurb: "Read the docs.", render: docs },
  { id: "launchdetail", title: "Launch", icon: "file", w: 460, h: 420, desktop: false, blurb: "", render: launchDetail },
  { id: "about", title: "About ZKHUB", icon: "info", w: 380, h: 340, desktop: false, blurb: "", render: about },
];
