// 24x24 stroke icons (drawn for ZKHUB). Returned as inline SVG strings; static, no external data.
const P: Record<string, string> = {
  rocket: "M12 3c3 2 4.5 5.5 4.5 9l-2 3h-5l-2-3C7.5 8.5 9 5 12 3zM12 10.5h.01M9.5 15 7 18l1 2 2.5-1.5M14.5 15l2.5 3-1 2-2.5-1.5",
  folder: "M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z",
  calendar: "M4.5 7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2zM4.5 10h15M8.5 3v4M15.5 3v4M8 14h2M12 14h2M8 17h2",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM16.5 16.5 21 21M8.5 11h5",
  swap: "M4 8h13l-3-3M20 16H7l3 3",
  network: "M12 5v4M12 15v4M5 12h4M15 12h4M12 3.5a1.5 1.5 0 1 0 .01 0M12 20.5a1.5 1.5 0 1 0 .01 0M3.5 12a1.5 1.5 0 1 0 .01 0M20.5 12a1.5 1.5 0 1 0 .01 0M12 10.5a1.5 1.5 0 1 0 .01 0",
  pool: "M4 9c2 2 4 2 6 0s4-2 6 0 3 2 4 1M4 14c2 2 4 2 6 0s4-2 6 0 3 2 4 1M4 19c2 2 4 2 6 0s4-2 6 0 3 2 4 1M8 3v6M14 3v6",
  entropy: "M4 18c2-8 4-12 6-12s2 12 4 12 3-8 6-8M4 21h16",
  shield: "M12 3.5 19 6v5.5c0 4.2-3 7.6-7 9-4-1.4-7-4.8-7-9V6zM9 12l2 2 4-4",
  flask: "M9.5 3.5h5M10.5 3.5v5.2L5 18.2a1.6 1.6 0 0 0 1.4 2.3h11.2a1.6 1.6 0 0 0 1.4-2.3l-5.5-9.5V3.5M8 15h8",
  hash: "M8.5 4 7 20M17 4l-1.5 16M4.5 9h15M4 15h15",
  gauge: "M4 16a8 8 0 1 1 16 0M12 16l4-5M7 16h.01M17 16h.01",
  terminal: "M4 6.5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM8 10l2.5 2L8 14M13 15h3",
  bin: "M5 7h14M9.5 7V5h5v2M7 7l.8 11.5a2 2 0 0 0 2 1.5h4.4a2 2 0 0 0 2-1.5L17 7M10.5 11v5M13.5 11v5",
  cog: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8",
  file: "M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5A1.5 1.5 0 0 1 7 3.5zM14 3.5V8h4M9 12h6M9 15.5h6",
  info: "M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 11v5M12 8h.01",
  lock: "M6.5 11h11a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 18.5v-6A1.5 1.5 0 0 1 6.5 11zM8 11V8a4 4 0 0 1 8 0v3",
  star: "M12 4l2.4 5 5.4.7-4 3.7 1 5.4L12 16.2 7.2 18.8l1-5.4-4-3.7 5.4-.7z",
  grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  plus: "M12 5v14M5 12h14",
  wallet: "M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3M4 7.5v9A2.5 2.5 0 0 0 6.5 19H19a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1H6.5A2.5 2.5 0 0 1 4 7.5zM16 14h.01",
  chevL: "m14.5 6-6 6 6 6",
  chevR: "m9.5 6 6 6-6 6",
  up: "M12 19V6M6.5 11.5 12 6l5.5 5.5",
};

export function icon(name: string, size = 20, cls = ""): string {
  const d = P[name] ?? P.file;
  return `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
}
export const ICON_NAMES = Object.keys(P);
