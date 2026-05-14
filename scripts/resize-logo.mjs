/**
 * Generate properly-sized PWA/favicon derivatives from the master flf-logo.png.
 *
 * The master /public/images/flf-logo.png is ~672KB at 1024×1024 — too heavy to
 * ship as a favicon. This script produces lean per-size variants under
 * /public/icons/ that layout.tsx, manifest.json, and sw.js/route.ts point to.
 *
 * Usage:
 *   npm install --save-dev sharp
 *   node scripts/resize-logo.mjs
 *
 * Or with the Python fallback that was actually used in CI/the audit sandbox:
 *   python3 scripts/resize-logo.py
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const SRC = "public/images/flf-logo.png";
const OUT_DIR = "public/icons";

// Each browser/OS only needs the smallest sharp size for its slot.
const SIZES = [32, 152, 180, 192, 512];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  for (const size of SIZES) {
    const pngOut = path.join(OUT_DIR, `icon-${size}.png`);
    const webpOut = path.join(OUT_DIR, `icon-${size}.webp`);

    await sharp(SRC)
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9, palette: true })
      .toFile(pngOut);

    await sharp(SRC)
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 82 })
      .toFile(webpOut);

    console.log(`wrote ${pngOut} + ${webpOut}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
