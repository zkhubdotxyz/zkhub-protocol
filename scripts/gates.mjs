// Gates: synthetic fixtures only, no network, no clock dependence. 28 gates (max 30).
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const p = (...a) => join(root, ...a);
const read = (...a) => readFileSync(p(...a), "utf8");
const imp = (f) => import(pathToFileURL(p(f)).href);

const { caState } = await imp("src/lib/ca.ts");
const F = await imp("src/lib/format.ts");
const D = await imp("src/lib/data.ts");
const W = await imp("src/lib/wm.ts");

const gates = [];
const gate = (name, fn) => gates.push([name, fn]);
const eq = (a, b, m = "") => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m} expected ${JSON.stringify(b)} got ${JSON.stringify(a)}`); };
const ok = (c, m) => { if (!c) throw new Error(m); };

const ADDR = "0x" + "ab12".repeat(10); // synthetic
const distAssets = () => readdirSync(p("dist", "assets")).map((f) => join("dist", "assets", f));
const allJs = () => distAssets().filter((f) => f.endsWith(".js")).map((f) => read(f)).join("\n");
const pages = () => ({ landing: read("dist/index.html"), app: read("dist/app/index.html") });
const srcFiles = (dir, exts = [".ts", ".css", ".html"]) => readdirSync(p(dir), { withFileTypes: true }).flatMap((e) => e.isDirectory() ? srcFiles(join(dir, e.name), exts) : exts.some((x) => e.name.endsWith(x)) ? [join(dir, e.name)] : []);
const hexAt = async (file, x, y) => { const { data, info } = await sharp(p(file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); const i = (y * info.width + x) * 4; return "#" + [data[i], data[i + 1], data[i + 2]].map((v) => v.toString(16).padStart(2, "0")).join(""); };

// ---- CA slot + socials (both pages)
gate("ca: absent -> inert, malformed -> inert, valid -> live (+date only when set)", () => {
  eq(caState("", "2026-01-01").live, false); eq(caState("", "2026-01-01").date, null); eq(caState("0x123", "").live, false);
  const s = caState(ADDR, ""); eq([s.live, s.text, s.date], [true, ADDR, null]); eq(caState(ADDR, "2026-01-01").date, "2026-01-01");
});
gate("ca: config ships empty and no built file carries an address", () => {
  const cfg = read("src/config.ts");
  for (const k of ["CA", "CA_DATE", "X_URL", "GITHUB_URL"]) ok(new RegExp(`export const ${k} = "";`).test(cfg), k + " not empty");
  for (const f of ["dist/index.html", "dist/app/index.html", ...distAssets()]) ok(!/0x[0-9a-fA-F]{40}/.test(read(f)), "address-like string in " + f);
});
gate("ca: slot first on landing (sticky stack) and app (top of shell); date hidden", () => {
  const { landing, app } = pages();
  const a = landing.indexOf('id="ca"'), b = landing.indexOf('id="hdr"'), s = landing.indexOf('id="top-stack"');
  ok(s > -1 && s < a && a < b, "landing order"); ok(/id="ca-date"[^>]*hidden/.test(landing), "landing date");
  ok(app.indexOf('id="shell"') < app.indexOf('id="ca"') && app.indexOf('id="ca"') < app.indexOf('id="menubar"'), "app order"); ok(/id="ca-date"[^>]*hidden/.test(app), "app date");
});
gate("socials: X + GitHub icon-only and inert (no href) on both pages", () => {
  for (const h of Object.values(pages())) for (const id of ["social-x", "social-gh"]) { const m = h.match(new RegExp(`<span[^>]*id="${id}"[^>]*>`)); ok(m && !/href/.test(m[0]) && /aria-disabled="true"/.test(m[0]), id); }
});

// ---- format / parse (synthetic fixtures)
gate("format: compactUsd, hexToNumber, weiToGwei, pct, ago", () => {
  eq([F.compactUsd(1.02e9), F.compactUsd(3.4e6), F.compactUsd(1500), F.compactUsd(NaN)], ["$1.02B", "$3.40M", "$1.5K", "—"]);
  eq([F.hexToNumber("0x10"), Number.isNaN(F.hexToNumber("zz")), Number.isNaN(F.hexToNumber(null))], [16, true, true]);
  eq([F.weiToGwei(2e10), F.weiToGwei(2.06e7), F.pct(1.234), F.pct(-2), F.ago(0, 90000)], ["20.00", "0.0206", "+1.23%", "-2.00%", "1m"]);
});
gate("data: parseBlock, parseChainTvl, parseTvlSeries", () => {
  eq(D.parseBlock({ result: { number: "0x64", timestamp: "0x3e8", transactions: ["a", "b"] } }), { number: 100, timestamp: 1000, txs: 2 });
  eq([D.parseBlock({}), D.parseBlock({ result: { number: "nope" } }), D.parseBlock(null)], [null, null, null]);
  eq([D.parseChainTvl([{ name: "X", tvl: 1 }, { name: "Robinhood Chain", tvl: 42 }], "Robinhood Chain"), Number.isNaN(D.parseChainTvl(null, "A"))], [42, true]);
  eq(D.parseTvlSeries([{ tvl: 1 }, { tvl: "x" }, { tvl: 2 }, { tvl: 3 }], 2), [2, 3]);
});
gate("data: parsePairs filters chain, sorts by volume, rejects foreign urls, survives junk", () => {
  const mk = (chainId, v, url) => ({ chainId, url, dexId: "d", baseToken: { name: "N" + v, symbol: "S" + v, address: "0x1" }, priceUsd: "1.5", priceChange: { h24: 2 }, volume: { h24: v }, liquidity: { usd: 10 }, pairCreatedAt: 1 });
  const r = D.parsePairs({ pairs: [mk("robinhood", 5, "https://dexscreener.com/a"), mk("solana", 99, ""), mk("robinhood", 50, "https://evil.example/x")] }, "robinhood");
  eq(r.map((x) => x.vol24h), [50, 5]); eq([r[0].url, r[1].url], ["", "https://dexscreener.com/a"]);
  eq([D.parsePairs(null, "robinhood"), D.parsePairs({ pairs: "x" }, "robinhood"), D.parsePairs({ pairs: [null, 3] }, "robinhood")], [[], [], []]);
});

// ---- build output
gate("build: dist has landing + app, and every referenced local asset exists", () => {
  for (const [n, h] of Object.entries(pages())) for (const m of h.matchAll(/(?:src|href)="(\/[^"#?]+)"/g)) ok(existsSync(p("dist", m[1].replace(/^\//, ""))), `${n}: missing ${m[1]}`);
  ok(/src="\/assets\/[^"]+\.js"/.test(pages().app), "app script not bundled");
});
gate("build: chain wiring (id 4663, RPC url) in bundles", () => { const j = allJs(); ok(j.includes("4663") && j.includes("rpc.mainnet.chain.robinhood.com"), "chain"); });
gate("build: only allow-listed external hosts in both pages", () => {
  for (const h of Object.values(pages())) for (const m of h.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)) ok(["fonts.googleapis.com", "fonts.gstatic.com", "robinhoodchain.blockscout.com"].includes(new URL(m[1]).hostname), "external " + m[1]);
});
gate("build: size budget (each js<80KB, css<40KB)", () => { for (const f of distAssets()) { const n = read(f).length; if (f.endsWith(".js")) ok(n < 80000, f + " " + n); if (f.endsWith(".css")) ok(n < 40000, f + " " + n); } });
gate("build: every element id used by scripts exists in its page", () => {
  const chk = (script, page, re) => { const ids = new Set([...read(script).matchAll(re)].map((m) => m[1])); const h = read(page); for (const id of ids) ok(h.includes(`id="${id}"`), `${script}: missing #${id}`); };
  chk("src/main.ts", "index.html", /\$(?:<[^>]+>)?\("([a-z0-9-]+)"\)/g);
  chk("src/app/main.ts", "src/app/index.html", /\$id\("([a-z0-9-]+)"\)/g);
  chk("src/lib/caslot.ts", "src/app/index.html", /getElementById\("(ca|ca-val|ca-copy|ca-date)"\)/g);
});
gate("security: no HTML injection of external data, no signing or transaction methods anywhere", () => {
  const all = srcFiles("src", [".ts"]).map((f) => [f, read(f)]);
  for (const [f, s] of all) for (const l of s.split("\n")) {
    if (/\.innerHTML\s*=/.test(l)) ok(/dom\.ts|main\.ts|caslot\.ts/.test(f), "innerHTML in " + f);
    if (/\bhtml:\s/.test(l) && !/html:\s*icon\(/.test(l)) throw new Error("non-icon html: in " + f + ": " + l.trim().slice(0, 80));
    ok(!/eth_sendTransaction|eth_sendRawTransaction|personal_sign|eth_signTypedData|eth_sign\b|wallet_addEthereumChain|wallet_switchEthereumChain/.test(l), "wallet write method in " + f);
  }
});

// ---- brand + palette provenance (real pixels)
gate("brand: RGBA logo has black transparent regions -> premultiplied path recorded", async () => {
  const meta = JSON.parse(read("src/logo-meta.json")); const buf = readFileSync(p(meta.source));
  eq(buf.subarray(0, 8).toString("hex"), "89504e470d0a1a0a"); eq(buf[25], 6, "IHDR colortype"); ok(meta.transparent > 0 && meta.blackTransparent / meta.transparent > 0.5, "no black transparency"); eq(meta.premultiplied, true);
});
gate("palette: every sampled role is an exact real pixel of its file; palette.css matches palette.json", async () => {
  const pal = JSON.parse(read("src/palette.json")); const css = read("src/palette.css");
  ok(/k-means\+\+/.test(css) && /pixel \(/.test(css), "provenance comment");
  for (const [role, r] of Object.entries(pal.roles)) eq(await hexAt(r.file, r.x, r.y), r.hex, "role " + role);
  const roleHex = new Set(Object.values(pal.roles).map((r) => r.hex));
  for (const [k, t] of Object.entries(pal.tokens)) { ok(css.includes(`${k}: ${t.value};`), "css missing " + k); if (t.from === "sampled") ok(roleHex.has(t.value), k + " not a snapped pixel"); }
  ok(pal.method.k >= 8 && pal.method.samples > 50000, "method");
});
gate("palette: stylesheets and pages use tokens only (no literal colours except white/black alpha overlays)", () => {
  const src = [...srcFiles("src", [".css"]), "index.html", "src/app/index.html"].map((f) => [f, read(f)]).filter(([f]) => !f.endsWith("palette.css"));
  for (const [f, s] of src) {
    const body = s.replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<meta name="theme-color"[^>]*>/, "");
    ok(!/#[0-9a-fA-F]{3,8}\b/.test(body.replace(/href="#[^"]*"/g, "")), "hex literal in " + f);
    ok(!/\b(hsla?|rgba?|lab|lch)\(/.test(body), "non-token colour fn in " + f);
    for (const m of body.matchAll(/oklch\(\s*([\d.]+)%\s+([\d.]+)/g)) ok(Number(m[2]) === 0 && (Number(m[1]) === 100 || Number(m[1]) === 0), "oklch literal " + m[0] + " in " + f);
  }
});
gate("favicon: PNG set + pixel-grid SVG rebuilt from the real logo", async () => {
  for (const [f, s] of [["favicon-16.png", 16], ["favicon-32.png", 32], ["apple-touch-icon.png", 180], ["icon-512.png", 512]]) { const m = await sharp(p("public", f)).metadata(); eq([m.width, m.height], [s, s], f); }
  const svg = read("public/favicon.svg"); ok(/viewBox="0 0 32 32"/.test(svg) && (svg.match(/<rect /g) || []).length > 80, "svg grid");
  const pal = JSON.parse(read("src/palette.json")); ok(svg.includes(pal.roles.dark.hex) && svg.includes(pal.roles.white.hex), "svg colours not sampled");
});
gate("favicon: premultiplied resize leaves no dark fringe on semi-transparent edges", async () => {
  const { data, info } = await sharp(p("public/logo.png")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let edge = 0, dark = 0; for (let i = 0; i < data.length; i += 4) { const a = data[i + 3]; if (a > 24 && a < 247) { edge++; if (Math.min(data[i], data[i + 1], data[i + 2]) < 180) dark++; } }
  ok(edge > 100, "no edge pixels " + edge); ok(dark / edge < 0.01, `dark fringe ${dark}/${edge} of ${info.width}px logo`);
});

// ---- design / a11y / motion
gate("a11y+mobile: reduced motion, viewport-fit, lang, labelled buttons, 44px targets, dvh, safe-area", () => {
  for (const f of ["index.html", "src/app/index.html"]) { const h = read(f); ok(/viewport-fit=cover/.test(h) && /<html lang="en"/.test(h), f); for (const b of h.match(/<button[^>]*>/g) || []) ok(/aria-label/.test(b), "unlabelled " + b); }
  const land = read("src/style.css"), app = read("src/app/app.css");
  for (const c of [land, app]) ok(/prefers-reduced-motion/.test(c) && /safe-area-inset/.test(c) && /max-width: 640px/.test(c), "css");
  ok(/height: 44px/.test(land) && /100dvh/.test(land), "landing mobile"); ok(/max-width: 640px[^}]*\.win/.test(app) || /\.win \{ left: 0 !important/.test(app), "app mobile windows");
});
gate("landing premium: reveal, spotlight, count-up, canvas, marquee, progress, launch-app links", () => {
  const m = read("src/main.ts"), c = read("src/style.css"), h = read("index.html");
  ok(/IntersectionObserver/.test(m) && /pointermove/.test(m) && /countUp/.test(m) && /getContext\("2d"\)/.test(m), "js");
  ok(/\.rv\.in/.test(c) && /@keyframes marquee/.test(c) && /\.progress/.test(c), "css"); ok((h.match(/href="\/app\/[^"]*"/g) || []).length >= 4, "app links");
});

// ---- desktop shell logic
gate("wm: clampRect keeps title bar reachable; resizeRect honours min + anchors; dock magnify curve", () => {
  const b = { w: 1000, h: 700, top: 62, bottom: 84 };
  const c = W.clampRect({ x: -5000, y: -5000, w: 400, h: 300 }, b); ok(c.x + c.w >= 80 && c.y >= 62, "off-screen"); const d = W.clampRect({ x: 5000, y: 5000, w: 400, h: 300 }, b); ok(d.x <= 920 && d.y <= 700 - 84 - 32, "far bottom-right");
  eq(W.resizeRect({ x: 100, y: 100, w: 400, h: 300 }, "se", 50, 20), { x: 100, y: 100, w: 450, h: 320 });
  eq(W.resizeRect({ x: 100, y: 100, w: 400, h: 300 }, "nw", 500, 500), { x: 200, y: 220, w: 300, h: 180 }, "min + anchor");
  ok(Math.abs(W.magnifyScale(50, 50) - 1.75) < 1e-9 && W.magnifyScale(Infinity, 50) === 1 && W.magnifyScale(500, 50) === 1, "peak/rest");
  ok(W.magnifyScale(50, 50) > W.magnifyScale(80, 50) && W.magnifyScale(80, 50) > W.magnifyScale(110, 50) && W.magnifyScale(110, 50) > 1, "monotonic");
});
gate("wm: fmtClock + fmtCountdown", () => {
  eq(W.fmtClock(new Date(2026, 8, 29, 16, 13)), "Tue, Sep 29 4:13 PM"); eq(W.fmtClock(new Date(2026, 0, 1, 0, 5)), "Thu, Jan 1 12:05 AM");
  eq([W.fmtCountdown(3661000), W.fmtCountdown(90061000), W.fmtCountdown(-1), W.fmtCountdown(NaN)], ["01:01:01", "1d 01:01:01", "now", "now"]);
});
gate("wm: My Launches tree (folders, unique names, move without cycles, bin cascade, restore, empty)", () => {
  let t = W.seedTree(); eq(t.map((n) => n.name), ["Drafts", "Scheduled", "Archive"]);
  t = W.addNode(t, { id: "a", kind: "folder", name: "Drafts", parent: null }); eq(t.find((n) => n.id === "a").name, "Drafts 2");
  t = W.addNode(t, { id: "b", kind: "folder", name: "Sub", parent: "a" }); t = W.addNode(t, { id: "l1", kind: "launch", name: "Tok", parent: "b" });
  eq(W.moveNode(t, "a", "b"), t, "cycle blocked"); eq(W.moveNode(t, "a", "a"), t, "self blocked"); eq(W.pathOf(t, "l1").map((n) => n.id), ["a", "b", "l1"]);
  t = W.moveNode(t, "l1", "f-drafts"); eq(t.find((n) => n.id === "l1").parent, "f-drafts");
  let t2 = W.binNode(t, "a"); ok(t2.find((n) => n.id === "b").binned && !W.childrenOf(t2, null).some((n) => n.id === "a"), "cascade");
  t2 = W.restoreNode(t2, "a"); ok(!t2.find((n) => n.id === "b").binned && W.childrenOf(t2, null).some((n) => n.id === "a"), "restore");
  t2 = W.emptyBin(W.binNode(t2, "a")); ok(!t2.some((n) => n.id === "a" || n.id === "b"), "empty"); eq(W.renameNode(t, "l1", "  "), t, "blank rename ignored");
});
gate("launchpad logic: validation, inert manifest, next planned launch", () => {
  const f = { name: "T", symbol: "TST", supply: 1e6, model: "Sealed Book", startPrice: 0.1, walletCap: 2, privacy: "Public", clusterCap: true, opensAt: "" };
  eq(W.validateLaunch(f), []); ok(W.validateLaunch({ ...f, symbol: "x", walletCap: 500, model: "?" }).length === 3, "errors");
  eq(JSON.parse(W.manifest(f)).status, "draft-local-only"); eq(JSON.parse(W.manifest(f)).chainId, 4663);
  const now = Date.parse("2026-01-01T00:00:00Z"); const tree = [{ id: "1", kind: "launch", name: "Late", parent: null, data: { scheduledAt: "2026-03-01T00:00:00Z" } }, { id: "2", kind: "launch", name: "Soon", parent: null, data: { scheduledAt: "2026-02-01T00:00:00Z" } }, { id: "3", kind: "launch", name: "Past", parent: null, data: { scheduledAt: "2025-01-01T00:00:00Z" } }, { id: "4", kind: "launch", name: "Bin", parent: null, binned: { from: null }, data: { scheduledAt: "2026-01-02T00:00:00Z" } }];
  eq(W.nextLaunch(tree, now).name, "Soon"); eq(W.nextLaunch([], now), null);
});
gate("app registry: all required programs, Launchpad deploy disabled, others are 'coming soon'", () => {
  const s = read("src/app/programs.ts"); const ids = [...s.matchAll(/\{ id: "([a-z]+)", title: /g)].map((m) => m[1]);
  for (const need of ["launchpad", "launches", "scheduler", "swap", "pool", "terminal", "docs", "settings", "recycle", "tools", "fractal", "entropy", "privacy", "lab", "proofs", "taskmgr"]) ok(ids.includes(need), "missing program " + need);
  ok(/Review & Deploy/.test(s) && /disabled: true, title: "Launching is not live yet"/.test(s), "deploy not disabled");
  ok((s.match(/render: soon\(/g) || []).length >= 9 && /Coming soon/.test(s), "coming-soon panels");
});
gate("app shell: windows (drag/resize/min/max/close), menubar clock+Connect+menus, dock magnify, widgets, overlays, boot", () => {
  const w = read("src/app/windows.ts"), m = read("src/app/main.ts");
  for (const k of ["setPointerCapture", "function minimize", "function toggleMax", "function close", "rz-", "dblclick"]) ok(w.includes(k), "windows: " + k);
  for (const k of ["fmtClock", "setInterval", 'id: "connect"', "File", "Edit", "View", "Window", "Help", "About ZKHUB", "Lock Screen"]) ok(m.includes(k), "menubar: " + k);
  for (const k of ["magnifyScale", "pointermove", "Next planned launch", "Live stats", "Watchlist", "overlay(", "Mission Control", "skip", "booting zkhub"]) ok(k.split("|").some((x) => m.includes(x)), "shell: " + k);
});

// ---- standing constraints
gate("repo: no .git / CLAUDE.md / .claude; brand + reference untouched; gate count within cap", () => {
  for (const f of [".git", "CLAUDE.md", ".claude"]) ok(!existsSync(p(f)), f + " exists");
  ok(readdirSync(p("brand")).length === 3 && readdirSync(p("reference")).length === 7, "brand/reference contents changed");
  ok(gates.length <= 30, "gates " + gates.length);
});

let fail = 0;
for (const [name, fn] of gates) {
  try { await fn(); console.log("PASS", name); } catch (e) { fail++; console.log("FAIL", name, "-", e.message); }
}
console.log(`\n${gates.length - fail}/${gates.length} gates passed`);
process.exit(fail ? 1 : 0);
