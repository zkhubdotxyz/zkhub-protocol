// Samples the real brand assets and writes src/palette.json, src/palette.css and the favicon set.
//  - k-means (k-means++ init, seeded PRNG, OKLab space) over stride-sampled REAL pixels of every opaque asset
//  - each centroid is snapped to the nearest real pixel (file + x,y) so every token is an actual pixel
//  - the RGBA logo has pure-black transparent regions, so it is resized PREMULTIPLIED (no dark fringes)
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const STRIDE = 8, K = 16, ITER = 40;

// ---- colour math
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
function toOklab(r, g, b) {
  const R = lin(r), G = lin(g), B = lin(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
const hex = (r, g, b) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
const lch = ([L, a, b]) => ({ L, C: Math.hypot(a, b), h: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360 });
let seed = 0x5eed1234; const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);

// ---- gather real pixels
const files = [];
for (const d of ["brand", "reference"]) for (const f of readdirSync(join(root, d))) files.push(join(d, f));
const pts = []; // {lab, file, x, y, rgb}
const seen = new Set();
for (const f of files) {
  const buf = readFileSync(join(root, f));
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  // the two 2000px logo files (jpeg + opaque png) are the same picture; sample it once via its size+first bytes
  const key = info.width + "x" + info.height + ":" + data.subarray(0, 64).toString("hex");
  if (seen.has(key)) continue; seen.add(key);
  for (let y = 0; y < info.height; y += STRIDE) for (let x = 0; x < info.width; x += STRIDE) {
    const i = (y * info.width + x) * 4;
    if (data[i + 3] !== 255) continue; // only fully opaque pixels are real colour
    pts.push({ lab: toOklab(data[i], data[i + 1], data[i + 2]), file: f.replaceAll("\\", "/"), x, y, rgb: [data[i], data[i + 1], data[i + 2]] });
  }
}

// ---- k-means++
const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
let cents = [pts[Math.floor(rand() * pts.length)].lab.slice()];
while (cents.length < K) {
  const ds = pts.map((p) => Math.min(...cents.map((c) => d2(p.lab, c))));
  const tot = ds.reduce((s, v) => s + v, 0); let r = rand() * tot, i = 0;
  while ((r -= ds[i]) > 0 && i < ds.length - 1) i++;
  cents.push(pts[i].lab.slice());
}
let assign = new Int32Array(pts.length);
for (let it = 0; it < ITER; it++) {
  const sum = cents.map(() => [0, 0, 0, 0]);
  pts.forEach((p, i) => { let b = 0, bd = Infinity; cents.forEach((c, k) => { const d = d2(p.lab, c); if (d < bd) { bd = d; b = k; } }); assign[i] = b; const s = sum[b]; s[0] += p.lab[0]; s[1] += p.lab[1]; s[2] += p.lab[2]; s[3]++; });
  cents = cents.map((c, k) => (sum[k][3] ? [sum[k][0] / sum[k][3], sum[k][1] / sum[k][3], sum[k][2] / sum[k][3]] : c));
}
// snap each centroid to the nearest real pixel
const clusters = cents.map((c, k) => {
  let best = null, bd = Infinity, n = 0;
  pts.forEach((p, i) => { if (assign[i] === k) { n++; const d = d2(p.lab, c); if (d < bd) { bd = d; best = p; } } });
  return best && { ...best, n, share: n / pts.length };
}).filter(Boolean);
const row = (c) => ({ hex: hex(...c.rgb), file: c.file, x: c.x, y: c.y, share: +c.share.toFixed(4), ...Object.fromEntries(Object.entries(lch(c.lab)).map(([k, v]) => [k, +v.toFixed(3)])) });
const rows = clusters.map(row).sort((a, b) => b.share - a.share);

// ---- roles (chosen from the snapped clusters by rule, never invented)
const pick = (fn, cmp) => rows.filter(fn).sort(cmp)[0];
const dark = pick((c) => c.L < 0.3, (a, b) => a.L - b.L) ; // deepest sampled colour
const bgGreen = pick((c) => c.L < 0.35 && c.C > 0.03, (a, b) => b.share - a.share);
const accent = pick((c) => c.L > 0.75 && c.C > 0.14, (a, b) => b.C - a.C);
const white = pick((c) => c.L > 0.95 && c.C < 0.03, (a, b) => b.L - a.L);
const mid = pick((c) => c.L > 0.4 && c.L < 0.62 && c.C > 0.06, (a, b) => b.share - a.share);
if (!dark || !accent || !white) throw new Error("role selection failed: " + JSON.stringify(rows));
const roles = { dark, bgGreen: bgGreen || dark, accent, white, mid: mid || accent };

// ---- tokens: sampled where a role exists, derived (lightness steps at the sampled dark hue) otherwise
const hueD = roles.dark.h;
const L2rgb = (L, C, h) => { // OKLCH -> sRGB hex (gamut-clamped)
  const a = C * Math.cos((h * Math.PI) / 180), b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const f = (x) => { x = Math.max(0, Math.min(1, x)); return Math.round(255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055)); };
  return hex(f(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), f(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), f(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s));
};
const step = (L, C = roles.dark.C) => L2rgb(L, C, hueD);
const tokens = {
  "--bg": { value: roles.dark.hex, from: "sampled", role: "dark" },
  "--bg-2": { value: step(roles.dark.L + 0.025), from: "derived", role: "dark L+0.025" },
  "--card": { value: step(roles.dark.L + 0.06), from: "derived", role: "dark L+0.06" },
  "--card-2": { value: step(roles.dark.L + 0.1), from: "derived", role: "dark L+0.10" },
  "--fg": { value: roles.white.hex, from: "sampled", role: "white" },
  "--muted": { value: L2rgb(0.74, 0.012, hueD), from: "derived", role: "fg toned to L0.74" },
  "--dim": { value: L2rgb(0.56, 0.02, hueD), from: "derived", role: "fg toned to L0.56" },
  "--accent": { value: roles.accent.hex, from: "sampled", role: "accent" },
  "--accent-fg": { value: roles.dark.hex, from: "sampled", role: "dark" },
  "--green-mid": { value: roles.mid.hex, from: "sampled", role: "mid green" },
  "--green-deep": { value: roles.bgGreen.hex, from: "sampled", role: "deep green" },
};

// ---- output palette files
mkdirSync(join(root, "src"), { recursive: true });
writeFileSync(join(root, "src/palette.json"), JSON.stringify({ method: { algo: "k-means++ (seeded), OKLab", k: K, iterations: ITER, stride: STRIDE, samples: pts.length, files: [...seen].length }, clusters: rows, roles: Object.fromEntries(Object.entries(roles).map(([k, v]) => [k, v])), tokens }, null, 1));
const prov = Object.entries(tokens).map(([k, t]) => `   ${k.padEnd(13)} ${t.value}  ${t.from === "sampled" ? `pixel (${roles[{ dark: "dark", white: "white", accent: "accent", "mid green": "mid", "deep green": "bgGreen" }[t.role]].x}, ${roles[{ dark: "dark", white: "white", accent: "accent", "mid green": "mid", "deep green": "bgGreen" }[t.role]].y}) of ${roles[{ dark: "dark", white: "white", accent: "accent", "mid green": "mid", "deep green": "bgGreen" }[t.role]].file}` : "derived: " + t.role}`).join("\n");
writeFileSync(join(root, "src/palette.css"), `/* GENERATED by scripts/sample-brand.mjs. Do not edit by hand.
 * Provenance: k-means++ (seeded, k=${K}, ${ITER} iterations) in OKLab over ${pts.length} stride-${STRIDE} opaque pixels of brand/ and reference/.
 * Each "sampled" token is snapped to a real pixel coordinate of a real file (see src/palette.json, verified by gates).
${prov}
 */
:root {
${Object.entries(tokens).map(([k, t]) => `  ${k}: ${t.value};`).join("\n")}
}
`);

// ---- favicon + logo from the real RGBA logo (premultiplied resize: transparent RGB is pure black)
const logoFile = files.find((f) => /PNG\.\.\.png$/.test(f));
const src = await sharp(join(root, logoFile)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = src.info; const px = src.data;
let x0 = W, y0 = H, x1 = 0, y1 = 0, blackT = 0, transp = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = (y * W + x) * 4, a = px[i + 3];
  if (a > 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (a < 255) { transp++; if (!px[i] && !px[i + 1] && !px[i + 2]) blackT++; }
}
const premul = blackT / transp > 0.5; // pure-black transparent regions found -> premultiplied path
const cw = x1 - x0 + 1, ch = y1 - y0 + 1, side = Math.max(cw, ch);
const crop = Buffer.alloc(side * side * 4); // square, centred, transparent padding
for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
  const s = ((y0 + y) * W + (x0 + x)) * 4, d = ((y + ((side - ch) >> 1)) * side + (x + ((side - cw) >> 1))) * 4;
  const a = px[s + 3];
  crop[d] = premul ? Math.round((px[s] * a) / 255) : px[s]; crop[d + 1] = premul ? Math.round((px[s + 1] * a) / 255) : px[s + 1]; crop[d + 2] = premul ? Math.round((px[s + 2] * a) / 255) : px[s + 2]; crop[d + 3] = a;
}
const raw = { raw: { width: side, height: side, channels: 4, premultiplied: premul } };
const bgRgb = sharp({ create: { width: 1, height: 1, channels: 3, background: roles.dark.hex } });
async function icon(size, pad, out, onDark) {
  const inner = Math.round(size * (1 - pad * 2));
  let img = sharp(crop, raw).resize(inner, inner, { kernel: "lanczos3" }).extend({ top: (size - inner) >> 1, bottom: size - inner - ((size - inner) >> 1), left: (size - inner) >> 1, right: size - inner - ((size - inner) >> 1), background: { r: 0, g: 0, b: 0, alpha: 0 } });
  if (onDark) { // sit on the sampled dark colour so the transparent Z cut-out reads as brand dark
    const r = parseInt(roles.dark.hex.slice(1, 3), 16), g = parseInt(roles.dark.hex.slice(3, 5), 16), b = parseInt(roles.dark.hex.slice(5, 7), 16);
    img = img.flatten({ background: { r, g, b } });
  }
  await img.png().toFile(join(root, "public", out));
}
mkdirSync(join(root, "public"), { recursive: true });
await icon(16, 0.04, "favicon-16.png", true); await icon(32, 0.04, "favicon-32.png", true);
await icon(180, 0.08, "apple-touch-icon.png", true); await icon(512, 0.06, "icon-512.png", true);
await icon(256, 0, "logo.png", false); // transparent, for in-page use
void bgRgb;
// favicon.svg: literal 32x32 pixel grid of the real logo (premultiplied downsample, run-length merged rects)
{
  const G = 32, cells = await sharp(crop, raw).resize(G, G, { kernel: "lanczos3" }).ensureAlpha().raw().toBuffer();
  let rects = "";
  for (let y = 0; y < G; y++) {
    let x = 0;
    while (x < G) {
      const a = cells[(y * G + x) * 4 + 3];
      if (a < 96) { x++; continue; }
      const op = Math.round(a / 255 * 100) / 100; let e = x + 1;
      while (e < G && Math.round(cells[(y * G + e) * 4 + 3] / 255 * 100) / 100 === op) e++;
      rects += `<rect x="${x}" y="${y}" width="${e - x}" height="1"${op < 1 ? ` fill-opacity="${op}"` : ""}/>`;
      x = e;
    }
  }
  writeFileSync(join(root, "public/favicon.svg"), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${G} ${G}" shape-rendering="crispEdges"><rect width="${G}" height="${G}" fill="${roles.dark.hex}"/><g fill="${roles.white.hex}">${rects}</g></svg>\n`);
}
writeFileSync(join(root, "src/logo-meta.json"), JSON.stringify({ source: logoFile.replaceAll("\\", "/"), bbox: [x0, y0, x1, y1], premultiplied: premul, blackTransparent: blackT, transparent: transp }, null, 1));
console.log("clusters:\n" + rows.map((r) => `${r.hex} share=${(r.share * 100).toFixed(1)}% L=${r.L} C=${r.C} h=${r.h} @ ${r.file} (${r.x},${r.y})`).join("\n"));
console.log("roles:", Object.fromEntries(Object.entries(roles).map(([k, v]) => [k, v.hex])));
console.log("logo bbox", [x0, y0, x1, y1], "premultiplied:", premul);
