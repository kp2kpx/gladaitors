/**
 * Character image processor for GLADAITORS
 * Step 1: Remove grey background from source JPGs → transparent PNG
 * Step 2: Create blue variant by shifting red hues to blue
 *
 * Background is uniform grey (~rgb(170-200, 170-200, 170-200))
 * Uses flood-fill style erosion from edges + color similarity threshold
 */

import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const SOURCES = [
  { src: "C:/Users/kamal/Downloads/LXh3q.jpg", name: "idle" },
  { src: "C:/Users/kamal/Downloads/hnRDi.jpg", name: "attack" },
  { src: "C:/Users/kamal/Downloads/gMZYc.jpg", name: "hit" },
  { src: "C:/Users/kamal/Downloads/1Y5uz.jpg", name: "death" },
];

const RED_OUT_DIR = path.join(ROOT, "public/characters/red");
const BLUE_OUT_DIR = path.join(ROOT, "public/characters/blue");

// ─── Step 1: Background removal ───────────────────────────────────────────────
// Strategy:
// 1. Sample the corner pixels to get background color reference
// 2. Mark all pixels within threshold of background color as transparent
// 3. Apply a slight edge feather to avoid hard cutouts
// The images have a smooth gradient background (grey→white near bottom)
// so we use a generous threshold and also erode from corners inward

function rgbDistance(r1, g1, b1, r2, g2, b2) {
  return Math.sqrt(
    (r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2
  );
}

function colorToHSL(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToRGB(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

// Is this pixel "background-like"?
// Background is grey/white: low saturation, mid-high lightness
// The death image has a darker grey gradient sky that goes down to ~l=60
function isBackground(r, g, b) {
  const { h, s, l } = colorToHSL(r, g, b);
  // Strict grey: very low saturation, any lightness > 50 (catches dark grey bg)
  if (s < 8 && l > 50) return true;
  // Light grey/white
  if (s < 14 && l > 62) return true;
  // Warm-tinted grey (the Grok watermark area)
  if (s < 22 && l > 78) return true;
  return false;
}

// Flood fill from corners to find all connected background pixels
function floodFillBackground(data, width, height) {
  const transparent = new Uint8Array(width * height);
  const visited = new Uint8Array(width * height);

  function getPixel(x, y) {
    const i = (y * width + x) * 4;
    return { r: data[i], g: data[i+1], b: data[i+2], a: data[i+3] };
  }

  // BFS from all 4 corners + edge pixels
  const queue = [];

  // Seed from all edge pixels that are background
  for (let x = 0; x < width; x++) {
    for (const y of [0, height - 1]) {
      const idx = y * width + x;
      if (!visited[idx]) {
        const p = getPixel(x, y);
        if (isBackground(p.r, p.g, p.b)) {
          queue.push([x, y]);
          visited[idx] = 1;
        }
      }
    }
  }
  for (let y = 0; y < height; y++) {
    for (const x of [0, width - 1]) {
      const idx = y * width + x;
      if (!visited[idx]) {
        const p = getPixel(x, y);
        if (isBackground(p.r, p.g, p.b)) {
          queue.push([x, y]);
          visited[idx] = 1;
        }
      }
    }
  }

  // BFS
  let qi = 0;
  while (qi < queue.length) {
    const [cx, cy] = queue[qi++];
    transparent[cy * width + cx] = 1;

    const neighbors = [
      [cx-1, cy], [cx+1, cy], [cx, cy-1], [cx, cy+1],
      // Also diagonal neighbors to prevent thin grey fringes
      [cx-1, cy-1], [cx+1, cy-1], [cx-1, cy+1], [cx+1, cy+1],
    ];

    for (const [nx, ny] of neighbors) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const nidx = ny * width + nx;
      if (visited[nidx]) continue;
      const p = getPixel(nx, ny);
      if (isBackground(p.r, p.g, p.b)) {
        visited[nidx] = 1;
        queue.push([nx, ny]);
      }
    }
  }

  return transparent;
}

async function removeBackground(srcPath, dstPath) {
  console.log(`  Removing background: ${path.basename(srcPath)} → ${path.basename(dstPath)}`);

  const { data, info } = await sharp(srcPath)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  // data is RGB or RGBA
  // We need RGBA output
  const rgba = new Uint8Array(width * height * 4);

  // Convert to RGBA
  for (let i = 0; i < width * height; i++) {
    if (channels === 3) {
      rgba[i*4]   = data[i*3];
      rgba[i*4+1] = data[i*3+1];
      rgba[i*4+2] = data[i*3+2];
      rgba[i*4+3] = 255;
    } else {
      rgba[i*4]   = data[i*4];
      rgba[i*4+1] = data[i*4+1];
      rgba[i*4+2] = data[i*4+2];
      rgba[i*4+3] = data[i*4+3];
    }
  }

  // Find background pixels via flood fill
  const bgMask = floodFillBackground(rgba, width, height);

  // Apply transparency with soft edge feathering
  // For pixels right on the edge of background, feather them
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (bgMask[idx]) {
        rgba[idx*4+3] = 0; // fully transparent
      } else {
        // Check if any neighbor is background → feather this edge pixel
        let bgNeighbors = 0;
        let totalNeighbors = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            totalNeighbors++;
            if (bgMask[ny * width + nx]) bgNeighbors++;
          }
        }
        if (bgNeighbors > 0) {
          // Feather: reduce alpha proportionally
          const featherFactor = 1 - (bgNeighbors / totalNeighbors) * 0.7;
          rgba[idx*4+3] = Math.round(rgba[idx*4+3] * featherFactor);
        }
      }
    }
  }

  await sharp(Buffer.from(rgba), {
    raw: { width, height, channels: 4 },
  })
    .png({ compressionLevel: 9 })
    .toFile(dstPath);

  console.log(`    Done: ${width}x${height}`);
}

// ─── Step 2: Red → Blue color shift ───────────────────────────────────────────
// Red pixels in these images: hue 330-20° (wrapping through 0°)
// Red chest armor: vivid red (s>50, h around 0-15°)
// Red crest/hair: also red-magenta range (h 340-360°)
// Target hue: ~220° (mid blue, matching a royal blue)
//
// Strategy: for pixels with high saturation and red hue, rotate hue to blue.
// Keep gold (h 35-55°, s>40), bronze (h 25-40°, s>30), cyan (h 170-210°) unchanged.
// Keep dark greys/blacks unchanged (l < 15%).

function shiftRedToBlue(r, g, b, alpha) {
  if (alpha === 0) return { r, g, b, a: 0 };

  const { h, s, l } = colorToHSL(r, g, b);

  // Skip very dark pixels (blacks/very dark metals)
  if (l < 12) return { r, g, b, a: alpha };

  // Skip very desaturated pixels (whites, light greys)
  if (s < 15) return { r, g, b, a: alpha };

  // Skip gold/bronze range (hue 25-65°) — keep these as-is
  if (h >= 25 && h <= 65) return { r, g, b, a: alpha };

  // Skip cyan/teal range (hue 160-210°) — these are the eye glows
  if (h >= 155 && h <= 215) return { r, g, b, a: alpha };

  // Skip brown/leather range (hue 15-28°, lower saturation)
  if (h >= 15 && h <= 28 && s < 60) return { r, g, b, a: alpha };

  // Target: red/crimson range → shift to blue
  // Red wraps around 0°: hue > 330° OR hue < 20°
  // Also include deeper reds up to ~25° for the chest armor
  const isRed = (h > 330 || h < 25) && s > 35;
  // Also catch slightly orange-red chest accents (h 15-25, s>50)
  const isOrangeRed = (h >= 15 && h <= 30) && s > 50;

  if (isRed || isOrangeRed) {
    // Map red hue (0° center) → blue (220°)
    // Reds near 0°: shift directly to 220°
    // Preserve relative hue variation within reds for natural look

    let newH;
    if (h > 330) {
      // e.g. 350° → normalize to -10° → shift to 220° + small offset
      const offset = (h - 360); // negative, -30 to 0
      newH = 220 + offset * 0.5;
    } else {
      // e.g. 0-25° → shift to 220° + proportional offset
      const offset = h; // 0 to 25
      newH = 220 + offset * 0.5;
    }
    // Keep within 0-360
    newH = ((newH % 360) + 360) % 360;

    // Slightly boost saturation for the blue to look vivid
    const newS = Math.min(100, s * 1.1);
    // Keep lightness as-is to preserve the 3D shading

    const { r: nr, g: ng, b: nb } = hslToRGB(newH, newS, l);
    return { r: nr, g: ng, b: nb, a: alpha };
  }

  // All other colors unchanged
  return { r, g, b, a: alpha };
}

async function createBlueVariant(srcPath, dstPath) {
  console.log(`  Creating blue variant: ${path.basename(srcPath)} → ${path.basename(dstPath)}`);

  const { data, info } = await sharp(srcPath)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  if (channels !== 4) {
    throw new Error(`Expected RGBA input, got ${channels} channels`);
  }

  const out = Buffer.from(data);

  for (let i = 0; i < width * height; i++) {
    const r = data[i*4], g = data[i*4+1], b = data[i*4+2], a = data[i*4+3];
    const shifted = shiftRedToBlue(r, g, b, a);
    out[i*4]   = shifted.r;
    out[i*4+1] = shifted.g;
    out[i*4+2] = shifted.b;
    out[i*4+3] = shifted.a;
  }

  await sharp(out, {
    raw: { width, height, channels: 4 },
  })
    .png({ compressionLevel: 9 })
    .toFile(dstPath);

  console.log(`    Done: ${width}x${height}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== GLADAITORS Character Processing ===\n");

  // Ensure output dirs exist
  fs.mkdirSync(RED_OUT_DIR, { recursive: true });
  fs.mkdirSync(BLUE_OUT_DIR, { recursive: true });

  // Step 1: Remove backgrounds
  console.log("STEP 1: Removing backgrounds...");
  for (const { src, name } of SOURCES) {
    const dstPath = path.join(RED_OUT_DIR, `${name}.png`);
    await removeBackground(src, dstPath);
  }

  // Step 2: Create blue variants from the transparent red PNGs
  console.log("\nSTEP 2: Creating blue variants...");
  for (const { name } of SOURCES) {
    const srcPath = path.join(RED_OUT_DIR, `${name}.png`);
    const dstPath = path.join(BLUE_OUT_DIR, `${name}.png`);
    await createBlueVariant(srcPath, dstPath);
  }

  console.log("\n=== Done! ===");
  console.log(`Red PNGs: ${RED_OUT_DIR}`);
  console.log(`Blue PNGs: ${BLUE_OUT_DIR}`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
