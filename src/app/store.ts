import { seedTree, type FNode } from "../lib/wm.ts";

export interface Settings { accent: "lime" | "white" | "moss"; wallpaper: "drift" | "trench" | "static"; sound: boolean }
export interface State { tree: FNode[]; settings: Settings; watch: string[]; drafts: number }
const KEY = "zkhub.desktop.v1";

const fresh = (): State => ({ tree: seedTree(), settings: { accent: "lime", wallpaper: "drift", sound: false }, watch: [], drafts: 0 });

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const j = JSON.parse(raw) as Partial<State>;
    const base = fresh();
    return {
      tree: Array.isArray(j.tree) && j.tree.length ? j.tree : base.tree,
      settings: { ...base.settings, ...(j.settings ?? {}) },
      watch: Array.isArray(j.watch) ? j.watch.filter((x) => typeof x === "string").slice(0, 50) : [],
      drafts: typeof j.drafts === "number" ? j.drafts : 0,
    };
  } catch { return fresh(); }
}

export const state: State = load();
const subs = new Set<() => void>();
export const subscribe = (fn: () => void) => { subs.add(fn); return () => subs.delete(fn); };
export function commit(patch: Partial<State>) {
  Object.assign(state, patch);
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode: keep in memory */ }
  subs.forEach((f) => f());
}
export function resetAll() { commit(fresh()); }
