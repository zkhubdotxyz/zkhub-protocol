// One-off inspection of brand/ and reference/ files: format, PNG IHDR, alpha histogram, black-transparent test.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
for (const d of ["brand", "reference"]) for (const f of readdirSync(d)) {
  const buf = readFileSync(join(d, f));
  const isPng = buf.subarray(0, 8).toString("hex") === "89504e470d0a1a0a";
  let ihdr = "";
  if (isPng) { const ct = buf[25]; ihdr = `IHDR ${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)} depth=${buf[24]} colortype=${ct}(${{ 0: "gray", 2: "rgb", 3: "palette", 4: "gray+a", 6: "rgba" }[ct]}) interlace=${buf[28]}`; }
  const m = await sharp(buf).metadata();
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const hist = new Array(4).fill(0); let blackT = 0, transp = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]; hist[a === 0 ? 0 : a < 128 ? 1 : a < 255 ? 2 : 3]++;
    if (a < 255) { transp++; if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0) blackT++; }
  }
  const n = info.width * info.height;
  console.log(`${d}/${f}\n  magic=${isPng ? "PNG" : buf.subarray(0, 3).toString("hex")} sharp=${m.format} ${m.width}x${m.height} channels=${m.channels} hasAlpha=${m.hasAlpha} space=${m.space}\n  ${ihdr}\n  alpha (0 | 1-127 | 128-254 | 255) = ${hist.map((h) => (100 * h / n).toFixed(2) + "%").join(" | ")}  pureBlackTransparent=${blackT}/${transp}`);
}
