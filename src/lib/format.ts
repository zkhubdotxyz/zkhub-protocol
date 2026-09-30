export function compactUsd(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e9) return "$" + (n / 1e9).toFixed(2) + "B";
  if (a >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M";
  if (a >= 1e3) return "$" + (n / 1e3).toFixed(1) + "K";
  return "$" + n.toFixed(2);
}

export function fmtInt(n: number): string {
  return Number.isFinite(n) ? Math.round(n).toLocaleString("en-US") : "—";
}

export function hexToNumber(hex: unknown): number {
  if (typeof hex !== "string" || !/^0x[0-9a-fA-F]+$/.test(hex)) return NaN;
  return Number(BigInt(hex));
}

export function weiToGwei(wei: number): string {
  if (!Number.isFinite(wei)) return "—";
  const g = wei / 1e9;
  return g >= 1 ? g.toFixed(2) : g.toFixed(4);
}

export function shortAddr(a: string): string {
  return /^0x[0-9a-fA-F]{40}$/.test(a) ? a.slice(0, 6) + "…" + a.slice(-4) : a;
}

export function pct(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return (n > 0 ? "+" : "") + n.toFixed(2) + "%";
}

export function ago(ms: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return s + "s";
  if (s < 3600) return Math.floor(s / 60) + "m";
  if (s < 86400) return Math.floor(s / 3600) + "h";
  return Math.floor(s / 86400) + "d";
}
