import { h } from "./dom.ts";
import { icon } from "./icons.ts";
import { clampRect, resizeRect, type Rect, type Handle } from "../lib/wm.ts";

export interface WinCtx { win: Win; close(): void; setTitle(t: string): void; payload?: Record<string, unknown> }
export interface Program {
  id: string; title: string; icon: string; w: number; h: number; badge?: string; desktop: boolean; dock?: boolean; blurb: string;
  render(ctx: WinCtx): HTMLElement;
}
export interface Win {
  id: string; programId: string; title: string; rect: Rect; z: number; minimized: boolean; maximized: boolean; prev?: Rect; el: HTMLElement; payload?: Record<string, unknown>;
}

const wins: Win[] = [];
let zTop = 10, seq = 0;
const subs = new Set<() => void>();
export const onWindows = (fn: () => void) => { subs.add(fn); return () => subs.delete(fn); };
const emit = () => subs.forEach((f) => f());
export const list = () => wins;
export const isMobile = () => matchMedia("(max-width: 640px)").matches;

let layer: HTMLElement;
let registry: Program[] = [];
export function mount(l: HTMLElement, programs: Program[]) { layer = l; registry = programs; addEventListener("resize", refit); }
export const program = (id: string) => registry.find((p) => p.id === id);

const bounds = () => {
  const cs = getComputedStyle(document.documentElement);
  return { w: innerWidth, h: innerHeight, top: parseFloat(cs.getPropertyValue("--top-h")) || 62, bottom: 84 };
};

function apply(w: Win) {
  const s = w.el.style;
  if (w.maximized && !isMobile()) { const b = bounds(); Object.assign(s, { left: "0px", top: b.top + "px", width: b.w + "px", height: b.h - b.top - 0 + "px" }); }
  else Object.assign(s, { left: w.rect.x + "px", top: w.rect.y + "px", width: w.rect.w + "px", height: w.rect.h + "px" });
  s.zIndex = String(w.z);
}
function refit() { for (const w of wins) { w.rect = clampRect(w.rect, bounds()); apply(w); } }

export function focus(id: string) {
  const w = wins.find((x) => x.id === id); if (!w) return;
  if (w.minimized) restore(id);
  w.z = ++zTop; apply(w);
  wins.forEach((x) => x.el.classList.toggle("focused", x === w));
  emit();
}
export const focused = () => wins.filter((w) => !w.minimized).sort((a, b) => b.z - a.z)[0];

export function open(programId: string, opts: { payload?: Record<string, unknown>; title?: string } = {}): Win | null {
  const p = program(programId); if (!p) return null;
  if (innerWidth < 200 || innerHeight < 200) { requestAnimationFrame(() => open(programId, opts)); return null; } // pane not laid out yet
  const existing = wins.find((w) => w.programId === programId && JSON.stringify(w.payload ?? null) === JSON.stringify(opts.payload ?? null));
  if (existing) { focus(existing.id); return existing; }
  const b = bounds(), n = wins.length;
  const rect = clampRect({ x: 70 + n * 28, y: b.top + 24 + n * 24, w: p.w, h: p.h }, b);
  const id = "w" + ++seq;
  const win: Win = { id, programId, title: opts.title ?? p.title, rect, z: ++zTop, minimized: false, maximized: false, el: document.createElement("section"), payload: opts.payload };
  const ctx: WinCtx = { win, close: () => close(id), setTitle: (t) => { win.title = t; tt.textContent = t; emit(); }, payload: opts.payload };
  const tt = h("span", { class: "win-title" }, win.title);
  const bar = h("header", { class: "win-bar" },
    h("div", { class: "tl" },
      h("button", { class: "tl-c", "aria-label": "Close", onClick: (e: Event) => { e.stopPropagation(); close(id); } }),
      h("button", { class: "tl-m", "aria-label": "Minimize", onClick: (e: Event) => { e.stopPropagation(); minimize(id); } }),
      h("button", { class: "tl-x", "aria-label": "Maximize", onClick: (e: Event) => { e.stopPropagation(); toggleMax(id); } })),
    h("span", { class: "win-ic", html: icon(p.icon, 14) }), tt,
    p.badge ? h("span", { class: "win-badge" }, p.badge) : null);
  const body = h("div", { class: "win-body" }, p.render(ctx));
  const el = win.el;
  el.className = "win opening"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", win.title); el.dataset.win = id;
  el.append(bar, body);
  for (const hd of ["n", "s", "e", "w", "ne", "nw", "se", "sw"] as Handle[]) el.append(h("i", { class: "rz rz-" + hd, "data-h": hd }));
  layer.append(el); wins.push(win); apply(win);
  requestAnimationFrame(() => el.classList.remove("opening"));
  wireDrag(win, bar); wireResize(win);
  el.addEventListener("pointerdown", () => { if (focused()?.id !== id) focus(id); }, true);
  bar.addEventListener("dblclick", (e) => { if (!(e.target as HTMLElement).closest("button")) toggleMax(id); });
  focus(id);
  return win;
}

export function close(id: string) {
  const i = wins.findIndex((w) => w.id === id); if (i < 0) return;
  const w = wins[i]; wins.splice(i, 1);
  w.el.classList.add("closing"); setTimeout(() => w.el.remove(), 170);
  const nxt = focused(); if (nxt) focus(nxt.id); else emit();
}
export function minimize(id: string) {
  const w = wins.find((x) => x.id === id); if (!w || w.minimized) return;
  w.minimized = true;
  const dock = document.querySelector<HTMLElement>(`[data-dock="${w.programId}"]`)?.getBoundingClientRect();
  const r = w.el.getBoundingClientRect();
  if (dock) w.el.style.transform = `translate(${dock.left + dock.width / 2 - (r.left + r.width / 2)}px, ${dock.top - r.top - r.height / 2}px) scale(.08)`;
  w.el.classList.add("min");
  const nxt = focused(); if (nxt) focus(nxt.id); else emit();
}
export function restore(id: string) {
  const w = wins.find((x) => x.id === id); if (!w) return;
  w.minimized = false; w.el.classList.remove("min"); w.el.style.transform = "";
  w.z = ++zTop; apply(w); wins.forEach((x) => x.el.classList.toggle("focused", x === w)); emit();
}
export function toggleMax(id: string) {
  const w = wins.find((x) => x.id === id); if (!w) return;
  w.maximized = !w.maximized; w.el.classList.toggle("max", w.maximized); apply(w); emit();
}

function wireDrag(w: Win, bar: HTMLElement) {
  bar.addEventListener("pointerdown", (e) => {
    if ((e.target as HTMLElement).closest("button") || isMobile() || e.button !== 0) return;
    const sx = e.clientX, sy = e.clientY, r0 = { ...w.rect };
    if (w.maximized) { // pull out of maximised: restore size under the cursor
      w.maximized = false; w.el.classList.remove("max"); r0.x = e.clientX - w.rect.w / 2; r0.y = e.clientY - 14;
    }
    bar.setPointerCapture(e.pointerId); w.el.classList.add("dragging");
    const move = (ev: PointerEvent) => { w.rect = clampRect({ ...r0, x: r0.x + ev.clientX - sx, y: r0.y + ev.clientY - sy }, bounds()); apply(w); };
    const up = () => { bar.removeEventListener("pointermove", move); bar.removeEventListener("pointerup", up); bar.removeEventListener("pointercancel", up); w.el.classList.remove("dragging"); };
    bar.addEventListener("pointermove", move); bar.addEventListener("pointerup", up); bar.addEventListener("pointercancel", up);
  });
}
function wireResize(w: Win) {
  w.el.querySelectorAll<HTMLElement>(".rz").forEach((hd) => hd.addEventListener("pointerdown", (e) => {
    if (isMobile() || w.maximized || e.button !== 0) return;
    e.preventDefault(); e.stopPropagation(); focus(w.id);
    const sx = e.clientX, sy = e.clientY, r0 = { ...w.rect }, handle = hd.dataset.h as Handle;
    hd.setPointerCapture(e.pointerId); w.el.classList.add("dragging");
    const move = (ev: PointerEvent) => { w.rect = clampRect(resizeRect(r0, handle, ev.clientX - sx, ev.clientY - sy), bounds()); apply(w); };
    const up = () => { hd.removeEventListener("pointermove", move); hd.removeEventListener("pointerup", up); hd.removeEventListener("pointercancel", up); w.el.classList.remove("dragging"); };
    hd.addEventListener("pointermove", move); hd.addEventListener("pointerup", up); hd.addEventListener("pointercancel", up);
  }));
}
