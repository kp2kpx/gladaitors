/**
 * Trims 30px from the bottom of all character PNGs to remove the Grok watermark.
 * Overwrites files in place.
 */
import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const FILES = [
  "public/characters/red/idle.png",
  "public/characters/red/attack.png",
  "public/characters/red/hit.png",
  "public/characters/red/death.png",
  "public/characters/blue/idle.png",
  "public/characters/blue/attack.png",
  "public/characters/blue/hit.png",
  "public/characters/blue/death.png",
];

const TRIM_BOTTOM = 30;

async function trimFile(relPath) {
  const fullPath = path.join(ROOT, relPath);
  const { width, height } = await sharp(fullPath).metadata();
  const newHeight = height - TRIM_BOTTOM;

  // Extract to a temp buffer then overwrite in place
  const buffer = await sharp(fullPath)
    .extract({ left: 0, top: 0, width, height: newHeight })
    .png({ compressionLevel: 9 })
    .toBuffer();

  await sharp(buffer).toFile(fullPath);
  console.log(`  ${relPath}: ${width}x${height} → ${width}x${newHeight}`);
}

async function main() {
  console.log(`=== Trimming ${TRIM_BOTTOM}px from bottom of character PNGs ===\n`);
  for (const f of FILES) {
    await trimFile(f);
  }
  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
