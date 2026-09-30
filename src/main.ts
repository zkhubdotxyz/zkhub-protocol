import "./palette.css";
import "./style.css";
import { X_URL, GITHUB_URL, CHAIN, POLL } from "./config.ts";
import { armCa } from "./lib/caslot.ts";
import { compactUsd, fmtInt, weiToGwei, pct, ago } from "./lib/format.ts";
import {
  rpc, parseBlock, parseRpcNumber, parseChainTvl, parseTvlSeries, parsePairs,
  fetchChains, fetchTvlHistory, fetchPairs, type Pair, type Block,
} from "./lib/data.ts";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- CA slot (inert until stated) ---------- */
armCa();

/* ---------- socials (icon-only, inert until stated) ---------- */
function armSocial(id: string, url: string, label: string) {
  if (!/^https:\/\//.test(url)) return;
  const el = $(id); const a = document.createElement("a");
  a.className = el.className; a.innerHTML = el.innerHTML; a.href = url; a.target = "_blank"; a.rel = "noreferrer noopener";
  a.setAttribute("aria-label", label); el.replaceWith(a);
}
armSocial("social-x", X_URL, "ZKHUB on X");
armSocial("social-gh", GITHUB_URL, "ZKHUB on GitHub");

/* ---------- chrome: offsets, scroll state, progress, nav ---------- */
const stack = $("top-stack"), hdr = $("hdr"), bar = $("progress");
new ResizeObserver(() => document.documentElement.style.setProperty("--top-h", $("ca").offsetHeight + "px")).observe($("ca"));
document.documentElement.style.setProperty("scroll-padding-top", stack.offsetHeight + 16 + "px");
let ticking = false;
addEventListener("scroll", () => {
  if (ticking) return; ticking = true;
  requestAnimationFrame(() => {
    const y = scrollY, h = document.documentElement.scrollHeight - innerHeight;
    hdr.classList.toggle("scrolled", y > 8);
    bar.style.transform = "scaleX(" + (h > 0 ? Math.min(1, y / h) : 0) + ")";
    ticking = false;
  });
}, { passive: true });

const navLinks = [...document.querySelectorAll<HTMLAnchorElement>(".nav a")];
const secObs = new IntersectionObserver((es) => {
  for (const e of es) if (e.isIntersecting) navLinks.forEach((a) => a.classList.toggle("on", a.getAttribute("href") === "#" + e.target.id));
}, { rootMargin: "-45% 0px -50% 0px" });
navLinks.forEach((a) => { const s = document.querySelector(a.getAttribute("href")!); if (s) secObs.observe(s); });

const burger = $("burger"), drawer = $("drawer");
const setMenu = (open: boolean) => {
  burger.setAttribute("aria-expanded", String(open)); drawer.hidden = !open;
  document.body.style.overflow = open ? "hidden" : ""; burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
};
burger.addEventListener("click", () => setMenu(drawer.hidden));
drawer.addEventListener("click", (e) => { if ((e.target as HTMLElement).closest("a")) setMenu(false); });
addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });
matchMedia("(min-width: 821px)").addEventListener("change", (m) => { if (m.matches) setMenu(false); });

/* ---------- entrance reveals ---------- */
const rv = new IntersectionObserver((es) => {
  for (const e of es) if (e.isIntersecting) { e.target.classList.add("in"); rv.unobserve(e.target); }
}, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
document.querySelectorAll(".rv, .steps li").forEach((el) => (reduced ? el.classList.add("in") : rv.observe(el)));

/* ---------- card spotlight ---------- */
document.querySelectorAll<HTMLElement>(".card").forEach((c) =>
  c.addEventListener("pointermove", (e) => {
    const r = c.getBoundingClientRect();
    c.style.setProperty("--mx", e.clientX - r.left + "px"); c.style.setProperty("--my", e.clientY - r.top + "px");
  }));

/* ---------- hero canvas: drifting network graph ---------- */
(function hero() {
  const cv = $("hero-canvas") as unknown as HTMLCanvasElement;
  const ctx = cv.getContext("2d"); if (!ctx) return;
  type N = { x: number; y: number; vx: number; vy: number; r: number };
  let W = 0, H = 0, dpr = 1, nodes: N[] = [], mx = 0.7, my = 0.5, run = true;
  const hx = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
  const rgb = /^#[0-9a-f]{6}$/i.test(hx) ? [1, 3, 5].map((i) => parseInt(hx.slice(i, i + 2), 16)).join(",") : "255,255,255";
  const rnd = (a: number, b: number) => a + Math.random() * (b - a);
  function size() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(Math.min(90, Math.max(28, (W * H) / 14000)));
    nodes = Array.from({ length: n }, () => ({ x: rnd(0, W), y: rnd(0, H), vx: rnd(-.12, .12), vy: rnd(-.12, .12), r: rnd(.8, 2.2) }));
  }
  function frame() {
    if (!run) return;
    ctx!.clearRect(0, 0, W, H);
    const link = Math.min(150, W / 6);
    for (const n of nodes) {
      n.x += n.vx; n.y += n.vy;
      if (n.x < -20) n.x = W + 20; if (n.x > W + 20) n.x = -20; if (n.y < -20) n.y = H + 20; if (n.y > H + 20) n.y = -20;
    }
    const ox = (mx - .5) * 24, oy = (my - .5) * 16;
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j], dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy);
        if (d < link) { ctx!.strokeStyle = "rgba(" + rgb + "," + (0.22 * (1 - d / link)).toFixed(3) + ")"; ctx!.lineWidth = 1; ctx!.beginPath(); ctx!.moveTo(a.x + ox * a.r * .2, a.y + oy * a.r * .2); ctx!.lineTo(b.x + ox * b.r * .2, b.y + oy * b.r * .2); ctx!.stroke(); }
      }
    }
    for (const n of nodes) { ctx!.fillStyle = "rgba(" + rgb + "," + (0.3 + n.r * 0.25).toFixed(2) + ")"; ctx!.beginPath(); ctx!.arc(n.x + ox * n.r * .2, n.y + oy * n.r * .2, n.r, 0, 6.283); ctx!.fill(); }
    if (!reduced) requestAnimationFrame(frame);
  }
  size(); frame();
  addEventListener("resize", () => { size(); if (reduced) frame(); });
  if (!reduced) {
    addEventListener("pointermove", (e) => { mx = e.clientX / innerWidth; my = e.clientY / innerHeight; }, { passive: true });
    new IntersectionObserver((es) => { const v = es[0].isIntersecting; if (v && !run) { run = true; frame(); } else if (!v) run = false; }).observe(cv);
    document.addEventListener("visibilitychange", () => { if (document.hidden) run = false; else if (!run) { run = true; frame(); } });
  }
})();

/* ---------- live values ---------- */
function setNum(el: HTMLElement, text: string) {
  if (el.textContent === text) return;
  el.textContent = text;
  if (!reduced) { el.classList.remove("tick"); void el.offsetWidth; el.classList.add("tick"); }
}
function countUp(el: HTMLElement, to: number, fmt: (n: number) => string) {
  if (reduced) { el.textContent = fmt(to); return; }
  const t0 = performance.now(), dur = 1100;
  const step = (t: number) => { const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3); el.textContent = fmt(to * e); if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
  setTimeout(() => { el.textContent = fmt(to); }, dur + 150); // rAF is paused in hidden tabs
}
function pill(el: HTMLElement, state: "on" | "off" | "", text: string) { el.className = "live-pill " + state; el.innerHTML = "<i></i>"; el.append(text); }

/* --- blocks / gas --- */
const feed = $("feed"); const blocks: Block[] = []; let lastBlock = 0, firstBlock = true, blockFails = 0;
async function pollBlock() {
  try {
    const [b, g] = await Promise.all([rpc(CHAIN.rpc, "eth_getBlockByNumber", ["latest", false]), rpc(CHAIN.rpc, "eth_gasPrice")]);
    const blk = parseBlock(b), gas = parseRpcNumber(g);
    if (!blk) throw new Error("bad block");
    blockFails = 0;
    if (firstBlock) { countUp($("s-block"), blk.number, fmtInt); firstBlock = false; }
    else setNum($("s-block"), fmtInt(blk.number));
    setNum($("n-block"), fmtInt(blk.number));
    $("s-block-sub").textContent = "updated " + new Date().toLocaleTimeString("en-GB");
    if (Number.isFinite(gas)) { setNum($("s-gas"), weiToGwei(gas)); setNum($("n-gas"), weiToGwei(gas) + " gwei"); }
    if (blk.number > lastBlock) {
      lastBlock = blk.number; blocks.unshift(blk); blocks.length = Math.min(blocks.length, 7);
      const li = document.createElement("li");
      const h = document.createElement("span"); h.className = "h"; h.textContent = "#" + fmtInt(blk.number);
      const g2 = document.createElement("span"); g2.className = "g"; g2.textContent = blk.txs + (blk.txs === 1 ? " tx" : " txs");
      const t = document.createElement("span"); t.className = "t"; t.dataset.ts = String(blk.timestamp * 1000); t.textContent = ago(blk.timestamp * 1000);
      li.append(h, g2, t); feed.prepend(li); while (feed.children.length > 7) feed.lastElementChild!.remove();
    }
    pill($("feed-status"), "on", "Live");
  } catch {
    if (++blockFails >= 2) { pill($("feed-status"), "off", "Offline"); $("s-block-sub").textContent = "rpc unreachable"; }
  }
}
setInterval(() => feed.querySelectorAll<HTMLElement>(".t").forEach((t) => (t.textContent = ago(Number(t.dataset.ts)))), 1000);

/* --- TVL + sparkline --- */
function drawSpark(vals: number[]) {
  const svg = $("spark"); if (vals.length < 2) return;
  const min = Math.min(...vals), max = Math.max(...vals), rng = max - min || 1;
  const pts = vals.map((v, i) => [(i / (vals.length - 1)) * 100, 22 - ((v - min) / rng) * 20] as const);
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(2) + " " + p[1].toFixed(2)).join("");
  svg.innerHTML = '<defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--accent)" stop-opacity=".35"/><stop offset="1" style="stop-color:var(--accent)" stop-opacity="0"/></linearGradient></defs><path class="area" d="' + d + 'L100 24L0 24Z"/><path d="' + d + '" pathLength="1"/>';
}
let tvlFirst = true;
async function pollMarket() {
  try {
    const [chains, hist] = await Promise.all([fetchChains(), fetchTvlHistory(CHAIN.llamaName)]);
    const tvl = parseChainTvl(chains, CHAIN.llamaName);
    if (Number.isFinite(tvl)) {
      if (tvlFirst) { countUp($("s-tvl"), tvl, compactUsd); tvlFirst = false; } else setNum($("s-tvl"), compactUsd(tvl));
      $("n-tvl").textContent = compactUsd(tvl);
    }
    drawSpark(parseTvlSeries(hist));
  } catch { /* leave em dash; never fabricate */ }
  try {
    const pairs = parsePairs(await fetchPairs(), CHAIN.dexChainId);
    renderPairs(pairs);
  } catch { renderPairs(null); }
}

function cell(cls: string, text: string) { const s = document.createElement("span"); if (cls) s.className = cls; s.textContent = text; return s; }
function usd(n: number) { return !Number.isFinite(n) ? "—" : n >= 1 ? "$" + n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "$" + n.toPrecision(3); }
function renderPairs(pairs: Pair[] | null) {
  const body = $("pairs-body"), tk = $("ticker");
  body.replaceChildren();
  if (!pairs || !pairs.length) {
    const e = document.createElement("div"); e.className = "empty"; e.textContent = pairs ? "No pairs returned for this chain right now." : "Market data unavailable. Retrying.";
    body.append(e); pill($("pairs-status"), "off", pairs ? "Empty" : "Offline");
    if (!pairs) { $("s-pairs").textContent = "—"; }
    return;
  }
  for (const p of pairs) {
    const row = document.createElement(p.url ? "a" : "div") as HTMLElement; row.className = "tr"; row.setAttribute("role", "row");
    if (p.url && row instanceof HTMLAnchorElement) { row.href = p.url; row.target = "_blank"; row.rel = "noreferrer noopener"; }
    const nm = document.createElement("div"); nm.className = "tk-name";
    const b = document.createElement("b"); b.textContent = p.symbol || p.name || "?"; const sp = document.createElement("span"); sp.textContent = (p.name || "") + (p.dex ? " · " + p.dex : "");
    nm.append(b, sp);
    row.append(nm, cell("r", usd(p.priceUsd)), cell("r chg " + (p.change24h >= 0 ? "up" : "dn"), pct(p.change24h)), cell("r hide-s", compactUsd(p.vol24h)), cell("r hide-s", compactUsd(p.liqUsd)));
    body.append(row);
  }
  const vol = pairs.reduce((s, p) => s + (Number.isFinite(p.vol24h) ? p.vol24h : 0), 0);
  setNum($("s-pairs"), String(pairs.length)); $("s-vol").textContent = "24h vol " + compactUsd(vol);
  pill($("pairs-status"), "on", "Live");
  const mk = () => pairs.map((p) => {
    const s = document.createElement("span"); s.className = "tk";
    const a = document.createElement("b"); a.textContent = p.symbol || "?";
    const c = document.createElement("span"); c.className = p.change24h >= 0 ? "up" : "dn"; c.textContent = pct(p.change24h);
    s.append(a, usd(p.priceUsd), c); return s;
  });
  tk.replaceChildren(...mk(), ...mk());
}

/* --- decorative block chain band --- */
(function band() {
  const b = $("band"); const frag = document.createDocumentFragment();
  for (let i = 0; i < 48; i++) { const d = document.createElement("div"); d.className = "blk"; d.textContent = (i * 7919 % 4096).toString(16).padStart(3, "0"); frag.append(d); }
  b.append(frag);
})();

pollBlock(); pollMarket();
setInterval(pollBlock, POLL.blockMs);
setInterval(pollMarket, POLL.marketMs);
