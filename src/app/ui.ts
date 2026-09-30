import { h } from "./dom.ts";

export function toast(msg: string, ms = 2600) {
  const host = document.getElementById("toasts"); if (!host) return;
  const t = h("div", { class: "toast", role: "status" }, msg);
  host.append(t); requestAnimationFrame(() => t.classList.add("in"));
  setTimeout(() => { t.classList.remove("in"); setTimeout(() => t.remove(), 250); }, ms);
}

export interface MenuItem { label: string; run?: () => void; kbd?: string; disabled?: boolean; sep?: boolean }
let openMenu: HTMLElement | null = null;
export function closeMenu() { openMenu?.remove(); openMenu = null; }
export function popMenu(x: number, y: number, items: MenuItem[]): HTMLElement {
  closeMenu();
  const m = h("div", { class: "menu glass", role: "menu" }, items.map((it) => it.sep
    ? h("hr", {})
    : h("button", { role: "menuitem", disabled: it.disabled, onClick: () => { closeMenu(); it.run?.(); } }, h("span", {}, it.label), it.kbd ? h("kbd", {}, it.kbd) : null)));
  document.body.append(m);
  const r = m.getBoundingClientRect();
  m.style.left = Math.max(6, Math.min(x, innerWidth - r.width - 6)) + "px";
  m.style.top = Math.max(6, Math.min(y, innerHeight - r.height - 6)) + "px";
  openMenu = m;
  return m;
}
addEventListener("pointerdown", (e) => { if (openMenu && !(e.target as HTMLElement).closest(".menu, [aria-haspopup]")) closeMenu(); }, true);
addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });

export function ask(title: string, initial = ""): Promise<string | null> {
  return new Promise((resolve) => {
    const input = h("input", { class: "field", value: initial, maxlength: "60", "aria-label": title });
    const done = (v: string | null) => { scrim.remove(); resolve(v); };
    const scrim = h("div", { class: "scrim" }, h("form", { class: "dialog glass-strong", onSubmit: (e: Event) => { e.preventDefault(); done(input.value); } },
      h("p", { class: "label" }, title), input,
      h("div", { class: "row end" }, h("button", { type: "button", class: "btn", onClick: () => done(null) }, "Cancel"), h("button", { type: "submit", class: "btn btn-accent" }, "OK"))));
    scrim.addEventListener("keydown", (e) => { if ((e as KeyboardEvent).key === "Escape") done(null); });
    document.body.append(scrim); input.focus(); input.select();
  });
}
