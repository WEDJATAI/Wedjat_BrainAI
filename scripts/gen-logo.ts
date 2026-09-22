// Generate a clean, transparent-background version of the WEDJAT Eye of Horus
// logo from the uploaded emsss.jpg. Uses z-ai-web-dev-sdk image-edit, then
// Sharp to chroma-key any residual dark background to true transparency.
import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";
import sharp from "sharp";

const SRC = "/home/z/my-project/upload/emsss.jpg";
const OUT_RAW = "/home/z/my-project/upload/wedjat-raw.png";
const OUT_FINAL = "/home/z/my-project/public/wedjat-logo.png";
const OUT_FAV = "/home/z/my-project/public/wedjat-favicon.png";
const OUT_MASK = "/home/z/my-project/public/wedjat-logo-mask.png";

async function main() {
  console.log("→ Reading source image:", SRC);
  const buf = fs.readFileSync(SRC);
  const b64 = buf.toString("base64");
  const dataUrl = `data:image/jpeg;base64,${b64}`;

  console.log("→ Calling z-ai image-edit to isolate the Eye of Horus symbol…");
  const zai = await ZAI.create();
  const resp = await zai.images.generations.edit({
    prompt:
      "Isolate ONLY the central Eye of Horus (Wedjat) symbol with its glowing neon cyan circuit-board lines, hexagonal iris, and hanging geometric data nodes. " +
      "Remove ALL text, remove the dark charcoal background, make the background pure transparent (alpha=0). " +
      "Keep the luminous cyan/electric-blue glow (#00D9FF) intact. Keep the futuristic cyber-tech circuit-trace aesthetic. " +
      "Center the symbol with generous padding. Output a clean transparent PNG.",
    images: [{ url: dataUrl }],
    size: "1024x1024",
  });

  const outB64 = resp.data?.[0]?.base64;
  if (!outB64) throw new Error("image-edit returned no data");
  fs.writeFileSync(OUT_RAW, Buffer.from(outB64, "base64"));
  console.log("  ✓ raw edit saved:", OUT_RAW, `(${Math.round(outB64.length * 0.75 / 1024)} KB)`);

  console.log("→ Chroma-keying residual dark pixels to true transparency with Sharp…");
  const rawData = await sharp(OUT_RAW)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const data = rawData.data;
  const info = rawData.info;

  const channels = info.channels;
  if (channels !== 4) {
    throw new Error(`expected 4 channels, got ${channels}`);
  }
  const w = info.width;
  const h = info.height;

  let touched = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    const isBackground = lum < 70 && sat < 0.45;
    const isCyanSymbol = b > 90 && (b - r) > 30 && (g - r) > 10;
    if (isBackground && !isCyanSymbol) {
      data[i + 3] = 0;
      touched++;
    } else if (lum < 40 && !isCyanSymbol) {
      data[i + 3] = 0;
      touched++;
    } else {
      if (isCyanSymbol) {
        data[i] = Math.max(0, r - 20);
        data[i + 1] = Math.min(255, g + 10);
        data[i + 2] = Math.min(255, b + 10);
        data[i + 3] = 255;
      } else if (lum > 60 && lum < 130 && sat < 0.4) {
        data[i + 3] = Math.min(255, data[i + 3]);
      } else if (lum <= 60) {
        data[i + 3] = 0;
        touched++;
      }
    }
  }
  console.log(`  ✓ ${touched} pixels made transparent (${((touched / (w * h)) * 100).toFixed(1)}%)`);

  await sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .png({ compressionLevel: 9, quality: 95 })
    .toFile(OUT_FINAL);
  console.log("  ✓ final transparent logo saved:", OUT_FINAL);

  const trimmed = await sharp(OUT_FINAL).trim({ threshold: 12 }).toBuffer();
  await sharp(trimmed).png({ compressionLevel: 9 }).toFile(OUT_FINAL);
  const trimmed2 = await sharp(OUT_FINAL).trim({ threshold: 8 }).toBuffer();
  await sharp(trimmed2).png({ compressionLevel: 9 }).toFile(OUT_FINAL);
  console.log("  ✓ trimmed to content bbox");

  const meta = await sharp(OUT_FINAL).metadata();
  const targetSize = 256;
  const resizeW = meta.width ?? targetSize;
  const resizeH = meta.height ?? targetSize;
  await sharp(OUT_FINAL)
    .resize({
      width: Math.min(targetSize, Math.round(targetSize * (resizeW / Math.max(resizeW, resizeH)))),
      height: Math.min(targetSize, Math.round(targetSize * (resizeH / Math.max(resizeW, resizeH)))),
      fit: "inside",
      withoutEnlargement: true,
    })
    .extend({
      top: Math.max(0, Math.round((targetSize - (meta.height ?? targetSize)) / 2)),
      bottom: Math.max(0, Math.round((targetSize - (meta.height ?? targetSize)) / 2)),
      left: Math.max(0, Math.round((targetSize - (meta.width ?? targetSize)) / 2)),
      right: Math.max(0, Math.round((targetSize - (meta.width ?? targetSize)) / 2)),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toFile(OUT_FAV);
  console.log("  ✓ favicon saved:", OUT_FAV);

  await sharp(OUT_FINAL)
    .extractChannel(3)
    .toColorspace("b-w")
    .png({ compressionLevel: 9 })
    .toFile(OUT_MASK)
    .catch(() => {});
  console.log("  ✓ mask saved:", OUT_MASK);

  const finalMeta = await sharp(OUT_FINAL).metadata();
  const finalStat = fs.statSync(OUT_FINAL);
  console.log(`\n✅ Done. Final logo: ${finalMeta.width}×${finalMeta.height}, ${Math.round(finalStat.size / 1024)} KB, transparent=${finalMeta.hasAlpha}`);
}

main().catch((e) => { console.error("✗ failed:", e); process.exit(1); });
