// Pure logic for the desktop shell: window geometry, dock magnify, clock, and the My Launches file tree.
export interface Rect { x: number; y: number; w: number; h: number }
export interface Bounds { w: number; h: number; top: number; bottom: number }

export function clampRect(r: Rect, b: Bounds, min = { w: 280, h: 160 }): Rect {
  const w = Math.max(min.w, Math.min(r.w, b.w - 16));
  const h = Math.max(min.h, Math.min(r.h, b.h - b.top - b.bottom));
  const x = Math.max(8 - w + 80, Math.min(r.x, b.w - 80)); // keep >=80px of the title bar reachable
  const y = Math.max(b.top, Math.min(r.y, b.h - b.bottom - 32));
  return { x, y, w, h };
}

export type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export function resizeRect(r: Rect, handle: Handle, dx: number, dy: number, min = { w: 300, h: 180 }): Rect {
  let { x, y, w, h } = r;
  if (handle.includes("e")) w = Math.max(min.w, r.w + dx);
  if (handle.includes("s")) h = Math.max(min.h, r.h + dy);
  if (handle.includes("w")) { w = Math.max(min.w, r.w - dx); x = r.x + (r.w - w); }
  if (handle.includes("n")) { h = Math.max(min.h, r.h - dy); y = r.y + (r.h - h); }
  return { x, y, w, h };
}

// Dock magnify: cosine falloff around the pointer. Infinity (pointer away) means rest size.
export function magnifyScale(pointerX: number, centerX: number, max = 1.75, range = 120): number {
  if (!Number.isFinite(pointerX)) return 1;
  const d = Math.abs(pointerX - centerX);
  if (d >= range) return 1;
  return 1 + (max - 1) * (0.5 + 0.5 * Math.cos((d / range) * Math.PI));
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function fmtClock(d: Date): string {
  const h = d.getHours(), m = d.getMinutes();
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()} ${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

export function fmtCountdown(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "now";
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400);
  const p = (n: number) => String(n).padStart(2, "0");
  return (d ? d + "d " : "") + `${p(Math.floor((s % 86400) / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

// ---- My Launches file tree (folders + local launch drafts), with a recycle bin
export interface FNode {
  id: string;
  kind: "folder" | "launch";
  name: string;
  parent: string | null; // null = root
  binned?: { from: string | null } | null;
  data?: Record<string, unknown>;
}

export const ROOT_FOLDERS = ["Drafts", "Scheduled", "Archive"];
export function seedTree(): FNode[] {
  return ROOT_FOLDERS.map((n) => ({ id: "f-" + n.toLowerCase(), kind: "folder" as const, name: n, parent: null }));
}

export function uniqueName(tree: FNode[], parent: string | null, base: string): string {
  const taken = new Set(tree.filter((n) => n.parent === parent && !n.binned).map((n) => n.name));
  if (!taken.has(base)) return base;
  let i = 2; while (taken.has(`${base} ${i}`)) i++;
  return `${base} ${i}`;
}

export const childrenOf = (tree: FNode[], parent: string | null) => tree.filter((n) => n.parent === parent && !n.binned);
export const binned = (tree: FNode[]) => tree.filter((n) => n.binned);

export function pathOf(tree: FNode[], id: string | null): FNode[] {
  const out: FNode[] = []; let cur = id;
  for (let guard = 0; cur && guard < 64; guard++) { const n = tree.find((x) => x.id === cur); if (!n) break; out.unshift(n); cur = n.parent; }
  return out;
}

export function isDescendant(tree: FNode[], id: string, ancestor: string): boolean {
  return pathOf(tree, id).some((n) => n.id === ancestor);
}

export function addNode(tree: FNode[], n: Omit<FNode, "name"> & { name: string }): FNode[] {
  return [...tree, { ...n, name: uniqueName(tree, n.parent, n.name) }];
}

export function moveNode(tree: FNode[], id: string, to: string | null): FNode[] {
  const n = tree.find((x) => x.id === id);
  if (!n || n.binned || n.parent === to) return tree;
  if (to !== null) {
    const dest = tree.find((x) => x.id === to);
    if (!dest || dest.kind !== "folder" || dest.binned) return tree;
    if (n.kind === "folder" && (to === id || isDescendant(tree, to, id))) return tree; // no cycles
  }
  return tree.map((x) => (x.id === id ? { ...x, parent: to, name: uniqueName(tree.filter((y) => y.id !== id), to, x.name) } : x));
}

export function renameNode(tree: FNode[], id: string, name: string): FNode[] {
  const clean = name.trim().slice(0, 60);
  const n = tree.find((x) => x.id === id);
  if (!n || !clean || clean === n.name) return tree;
  return tree.map((x) => (x.id === id ? { ...x, name: uniqueName(tree.filter((y) => y.id !== id), x.parent, clean) } : x));
}

// Deleting a folder bins the folder and everything under it.
export function binNode(tree: FNode[], id: string): FNode[] {
  const gone = new Set(tree.filter((n) => n.id === id || isDescendant(tree, n.id, id)).map((n) => n.id));
  return tree.map((n) => (gone.has(n.id) ? { ...n, binned: { from: n.id === id ? n.parent : n.parent } } : n));
}

export function restoreNode(tree: FNode[], id: string): FNode[] {
  const gone = new Set(tree.filter((n) => n.id === id || isDescendant(tree, n.id, id)).map((n) => n.id));
  return tree.map((n) => {
    if (!gone.has(n.id)) return n;
    const parentAlive = n.parent === null || tree.some((p) => p.id === n.parent && (!p.binned || gone.has(p.id)));
    return { ...n, binned: null, parent: parentAlive ? n.parent : null };
  });
}

export const emptyBin = (tree: FNode[]) => tree.filter((n) => !n.binned);

let seq = 0;
export const uid = (p = "n") => `${p}-${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

// ---- Launch manifest (inert: describes a draft, deploys nothing)
export interface LaunchForm { name: string; symbol: string; supply: number; model: string; startPrice: number; walletCap: number; privacy: string; clusterCap: boolean; opensAt: string }
export const MODELS = ["Sealed Book", "Dutch Descent", "Lottery Allocation", "Classic Curve"] as const;

export function validateLaunch(f: LaunchForm): string[] {
  const errs: string[] = [];
  if (!f.name.trim()) errs.push("Name is required");
  if (!/^[A-Za-z0-9]{2,8}$/.test(f.symbol)) errs.push("Symbol must be 2-8 letters or digits");
  if (!(f.supply > 0) || !Number.isFinite(f.supply)) errs.push("Supply must be greater than 0");
  if (!MODELS.includes(f.model as (typeof MODELS)[number])) errs.push("Choose a launch model");
  if (!(f.startPrice >= 0)) errs.push("Start price cannot be negative");
  if (!(f.walletCap > 0 && f.walletCap <= 100)) errs.push("Wallet cap must be 1-100%");
  if (f.opensAt && Number.isNaN(Date.parse(f.opensAt))) errs.push("Open time is not a valid date");
  return errs;
}

export function manifest(f: LaunchForm): string {
  return JSON.stringify({ version: 0, status: "draft-local-only", chainId: 4663, token: { name: f.name, symbol: f.symbol.toUpperCase(), supply: f.supply }, model: f.model, startPriceEth: f.startPrice, walletCapPct: f.walletCap, privacy: f.privacy, clusterCap: f.clusterCap, opensAt: f.opensAt || null }, null, 2);
}

export function nextLaunch(tree: FNode[], now: number): { name: string; at: number } | null {
  let best: { name: string; at: number } | null = null;
  for (const n of tree) {
    if (n.binned || n.kind !== "launch") continue;
    const at = Date.parse(String(n.data?.scheduledAt ?? ""));
    if (Number.isFinite(at) && at > now && (!best || at < best.at)) best = { name: n.name, at };
  }
  return best;
}
