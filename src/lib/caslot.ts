import { CA, CA_DATE } from "../config.ts";
import { caState } from "./ca.ts";

// Social icons stay inert (no link) until a https URL is stated in config.
export function armSocial(id: string, url: string, label: string): void {
  if (!/^https:\/\//.test(url)) return;
  const el = document.getElementById(id); if (!el) return;
  const a = document.createElement("a");
  a.className = el.className; a.innerHTML = el.innerHTML; a.href = url; a.target = "_blank"; a.rel = "noreferrer noopener";
  a.setAttribute("aria-label", label); el.replaceWith(a);
}

// Arms the always-visible CA bar. Inert until CA is stated: no handlers, no copy affordance, no date.
export function armCa(): void {
  const st = caState(CA, CA_DATE);
  const caEl = document.getElementById("ca"); if (!caEl) return;
  const val = document.getElementById("ca-val"), copyEl = document.getElementById("ca-copy"), dateEl = document.getElementById("ca-date"), tok = document.getElementById("tok-ca");
  if (val) val.textContent = st.text;
  if (tok) tok.textContent = st.text;
  if (!st.live) return;
  caEl.dataset.live = "true"; caEl.setAttribute("role", "button"); caEl.tabIndex = 0;
  caEl.setAttribute("aria-label", "Contract address " + st.text + ". Click to copy.");
  if (copyEl) copyEl.hidden = false;
  if (dateEl && st.date) { dateEl.textContent = st.date; dateEl.hidden = false; }
  if (tok) tok.style.color = "var(--fg)";
  const copy = async () => {
    try { await navigator.clipboard.writeText(CA); } catch {
      const t = document.createElement("textarea"); t.value = CA; document.body.appendChild(t); t.select();
      try { document.execCommand("copy"); } finally { t.remove(); }
    }
    caEl.dataset.copied = "true"; if (copyEl) copyEl.textContent = "Copied";
    setTimeout(() => { caEl.dataset.copied = "false"; if (copyEl) copyEl.textContent = "Copy"; }, 1600);
  };
  caEl.addEventListener("click", copy);
  caEl.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); copy(); } });
}
