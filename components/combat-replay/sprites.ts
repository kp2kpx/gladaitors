// ─── GLADAITORS combat-replay sprite factory ─────────────────────────────────
// All character art is procedural pixel art authored in code on a 64×64 grid,
// baked once at load time into offscreen canvases, then blitted by the renderer
// with nearest-neighbor scaling. No image assets.
//
// Concept: "GLAD-AI-TOR" — AI constructs in a digital coliseum. Roman gladiator
// silhouette fused with living machinery: glowing circuitry seams, energy
// weapons, data-glitch tells.
//
//   RED  — the Juggernaut. Walking siege engine, molten light in the plate seams.
//   BLUE — the Duelist. Lean chrome fencer, electric-blue energy rapier.
//   GOLD — the Wildcard. Ornate gambler, luck-runes, curved energy glaive.
//
// Grid conventions: characters face RIGHT. Feet baseline at y = 61.
// Body centre ≈ x 25. Weapons may extend to x 62.

export type FighterColor = "red" | "blue" | "gold";
export type AnimName = "idle" | "walk" | "attack" | "hit" | "death" | "victory";

export const CELL = 64;          // art cell is 64×64 px
export const ANCHOR_X = 26;      // horizontal anchor (body centre)
export const ANCHOR_Y = 61;      // feet baseline

export const FRAME_COUNT: Record<AnimName, number> = {
  idle: 4,
  walk: 4,
  attack: 6,
  hit: 2,
  death: 6,
  victory: 4,
};

// ── Tiny pixel pen ────────────────────────────────────────────────────────────

interface Pen {
  px(x: number, y: number, c: string): void;
  r(x: number, y: number, w: number, h: number, c: string): void;
  hl(x: number, y: number, len: number, c: string): void; // horizontal line
  vl(x: number, y: number, len: number, c: string): void; // vertical line
  chain(pts: [number, number][], c: string, thick?: number): void; // stepped poly-line
}

function makePen(g: CanvasRenderingContext2D): Pen {
  return {
    px(x, y, c) { g.fillStyle = c; g.fillRect(x, y, 1, 1); },
    r(x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); },
    hl(x, y, len, c) { g.fillStyle = c; g.fillRect(x, y, len, 1); },
    vl(x, y, len, c) { g.fillStyle = c; g.fillRect(x, y, 1, len); },
    chain(pts, c, thick = 1) {
      g.fillStyle = c;
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, y0] = pts[i];
        const [x1, y1] = pts[i + 1];
        const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
        for (let s = 0; s <= steps; s++) {
          const x = Math.round(x0 + ((x1 - x0) * s) / steps);
          const y = Math.round(y0 + ((y1 - y0) * s) / steps);
          g.fillRect(x, y, thick, thick);
        }
      }
    },
  };
}

// ── Pose derivation (shared across characters) ───────────────────────────────

type LegPose = "stand" | "stepA" | "stepB" | "brace" | "lunge" | "kneel" | "fallen";
type ArmPose = "guard" | "windup" | "strike" | "follow" | "recoil" | "raise" | "limp";

export interface Pose {
  bob: number;     // y offset of torso+head (positive = down)
  lean: number;    // x offset of torso+head (positive = toward opponent)
  legs: LegPose;
  arm: ArmPose;
  glow: number;    // 0..1 — energy/circuitry intensity
  fall: number;    // death-fall progression for "fallen" frames (0.5 mid, 1 flat)
  headDrop: number;
}

export function poseFor(anim: AnimName, fr: number): Pose {
  const base: Pose = { bob: 0, lean: 0, legs: "stand", arm: "guard", glow: 0.6, fall: 0, headDrop: 0 };
  switch (anim) {
    case "idle": {
      const bob = [0, 1, 2, 1][fr] ?? 0;
      const glow = [0.45, 0.65, 1, 0.65][fr] ?? 0.6;
      return { ...base, bob, glow };
    }
    case "walk": {
      const legs: LegPose = fr === 0 ? "stepA" : fr === 2 ? "stepB" : "stand";
      const bob = fr % 2 === 1 ? 1 : 0;
      return { ...base, legs, bob, glow: 0.7 };
    }
    case "attack": {
      switch (fr) {
        case 0:  return { ...base, lean: -1, legs: "brace", arm: "windup", glow: 0.8 };
        case 1:  return { ...base, lean: -2, legs: "brace", arm: "windup", glow: 1 };
        case 2:  return { ...base, lean: 3, legs: "lunge", arm: "strike", glow: 1 };
        case 3:  return { ...base, lean: 3, legs: "lunge", arm: "strike", glow: 0.85 };
        case 4:  return { ...base, lean: 1, legs: "brace", arm: "follow", glow: 0.7 };
        default: return { ...base, lean: 0, legs: "stand", arm: "guard", glow: 0.6 };
      }
    }
    case "hit": {
      return fr === 0
        ? { ...base, lean: -3, bob: 1, arm: "recoil", glow: 1 }
        : { ...base, lean: -2, bob: 0, arm: "recoil", glow: 0.5 };
    }
    case "death": {
      switch (fr) {
        case 0:  return { ...base, lean: -4, bob: 1, arm: "recoil", glow: 1 };
        case 1:  return { ...base, lean: -2, bob: 5, legs: "kneel", arm: "limp", glow: 0.7 };
        case 2:  return { ...base, lean: -1, bob: 7, legs: "kneel", arm: "limp", glow: 0.4, headDrop: 2 };
        case 3:  return { ...base, legs: "fallen", fall: 0.5, glow: 0.25 };
        case 4:  return { ...base, legs: "fallen", fall: 1, glow: 0.12 };
        default: return { ...base, legs: "fallen", fall: 1, glow: 0 };
      }
    }
    case "victory": {
      const bob = [0, -1, -2, -1][fr] ?? 0;
      const glow = [0.6, 0.8, 1, 0.8][fr] ?? 0.8;
      return { ...base, bob, arm: "raise", glow };
    }
  }
}

// ── RED — the Juggernaut ──────────────────────────────────────────────────────

const RP = {
  iron0: "#33261d", iron1: "#54402f", iron2: "#7a5c41",
  crim0: "#5a1010", crim1: "#8b1a1a", crim2: "#c43a24",
  mol0: "#ff7a1f", mol1: "#ffc94d", mol2: "#fff3d0",
  rim: "#d9c2a0", dark: "#16100a",
};

function redMol(glow: number): string {
  return glow > 0.8 ? RP.mol2 : glow > 0.45 ? RP.mol1 : RP.mol0;
}

function drawRedFallen(p: Pen, ps: Pose): void {
  if (ps.fall < 0.8) {
    // mid-fall — pitching forward
    p.r(10, 54, 10, 5, RP.crim0);            // bent legs
    p.r(7, 59, 7, 3, RP.iron1);              // rear foot
    p.r(18, 48, 12, 8, RP.iron1);            // torso diagonal upper
    p.r(27, 52, 10, 7, RP.crim1);            // torso lower
    p.r(26, 48, 9, 4, RP.crim1);             // pauldron bump
    p.hl(26, 48, 9, RP.crim2);
    p.r(36, 53, 10, 7, RP.iron1);            // helm heading down
    p.px(43, 57, RP.mol0);                   // dying eye
    p.r(33, 58, 8, 3, RP.crim0);             // arm
    p.r(44, 58, 14, 3, RP.iron1);            // dropped cleaver
    p.hl(46, 59, 10, ps.glow > 0 ? RP.mol0 : RP.iron0);
    return;
  }
  // flat on the ground, face down toward opponent
  p.r(6, 57, 12, 4, RP.crim0);               // legs
  p.r(4, 58, 4, 3, RP.iron1);                // sabatons
  p.r(17, 56, 7, 5, RP.iron0);               // hips
  p.r(23, 55, 14, 6, RP.iron1);              // torso slab
  p.hl(23, 55, 14, RP.crim1);                // chest plate edge
  p.r(26, 52, 9, 4, RP.crim1);               // pauldron bump
  p.hl(26, 52, 9, RP.crim2);
  p.r(38, 55, 9, 6, RP.iron1);               // helm
  p.hl(38, 55, 9, RP.iron2);
  p.px(44, 58, ps.glow > 0.05 ? RP.mol0 : "#3a2218"); // ember of an eye, fading
  p.r(33, 59, 9, 2, RP.crim0);               // arm
  p.r(45, 59, 15, 2, RP.iron1);              // cleaver flat
  if (ps.glow > 0.05) p.hl(48, 59, 8, RP.mol0);
}

function drawRedLegs(p: Pen, legs: LegPose): void {
  switch (legs) {
    case "stand":
      p.r(15, 47, 7, 12, RP.crim0); p.r(15, 51, 7, 3, RP.iron1);
      p.r(28, 47, 7, 12, RP.crim1); p.r(28, 51, 7, 3, RP.iron2);
      p.px(18, 52, RP.mol0); p.px(31, 52, RP.mol1);
      p.r(13, 59, 10, 3, RP.iron1); p.r(26, 59, 10, 3, RP.iron1);
      p.px(35, 59, RP.iron2);
      break;
    case "stepA":
      p.r(12, 48, 7, 11, RP.crim0); p.r(12, 52, 7, 3, RP.iron1);
      p.r(31, 47, 7, 12, RP.crim1); p.r(31, 51, 7, 3, RP.iron2);
      p.r(10, 59, 10, 3, RP.iron1); p.r(29, 59, 10, 3, RP.iron1);
      break;
    case "stepB":
      p.r(18, 47, 7, 12, RP.crim0); p.r(18, 51, 7, 3, RP.iron1);
      p.r(25, 48, 7, 11, RP.crim1); p.r(25, 52, 7, 3, RP.iron2);
      p.r(16, 59, 10, 3, RP.iron1); p.r(23, 59, 10, 3, RP.iron1);
      break;
    case "brace":
      p.r(12, 48, 7, 11, RP.crim0); p.r(12, 52, 7, 3, RP.iron1);
      p.r(31, 48, 7, 11, RP.crim1); p.r(31, 52, 7, 3, RP.iron2);
      p.r(10, 59, 10, 3, RP.iron1); p.r(29, 59, 10, 3, RP.iron1);
      p.px(34, 53, RP.mol0);
      break;
    case "lunge":
      p.r(9, 53, 9, 4, RP.crim0);             // back leg extended low
      p.r(7, 59, 8, 3, RP.iron1);
      p.r(33, 48, 7, 11, RP.crim1); p.r(33, 52, 7, 3, RP.iron2);
      p.r(31, 59, 10, 3, RP.iron1);
      p.px(36, 53, RP.mol1);
      break;
    case "kneel":
      p.r(26, 52, 9, 4, RP.crim1);            // front thigh horizontal
      p.r(33, 56, 4, 6, RP.crim1);            // front shin down
      p.r(31, 59, 8, 3, RP.iron1);
      p.r(16, 55, 6, 7, RP.crim0);            // back knee on ground
      p.r(11, 60, 7, 2, RP.iron1);
      // dropped cleaver beside him
      p.r(42, 57, 16, 3, RP.iron1);
      p.px(47, 58, RP.mol0);
      break;
    case "fallen":
      break;
  }
}

function drawRedWeaponAndArm(p: Pen, ps: Pose): void {
  const ox = ps.lean, oy = ps.bob;
  const mol = redMol(ps.glow);
  switch (ps.arm) {
    case "guard": {
      p.r(36 + ox, 31 + oy, 5, 6, RP.crim1);
      p.r(37 + ox, 37 + oy, 5, 6, RP.iron1);
      p.r(37 + ox, 43 + oy, 6, 4, RP.iron0);
      p.px(42 + ox, 44 + oy, RP.mol0);
      // cleaver resting up over the shoulder
      p.chain([[41 + ox, 44 + oy], [48 + ox, 27 + oy]], RP.iron0, 2);
      p.r(44 + ox, 6 + oy, 10, 22, RP.iron1);
      p.vl(53 + ox, 6 + oy, 22, RP.iron2);
      p.vl(44 + ox, 6 + oy, 22, RP.iron0);
      p.hl(44 + ox, 6 + oy, 10, RP.rim);
      p.vl(49 + ox, 9 + oy, 16, RP.mol0);
      p.px(49 + ox, 13 + oy, mol);
      p.px(49 + ox, 19 + oy, mol);
      break;
    }
    case "windup": {
      p.r(33 + ox, 25 + oy, 5, 7, RP.crim1);
      // cleaver hauled overhead, pointing back
      p.chain([[36 + ox, 27 + oy], [32 + ox, 12 + oy]], RP.iron0, 2);
      p.r(12 + ox, 2 + oy, 22, 9, RP.iron1);
      p.hl(12 + ox, 2 + oy, 22, RP.iron2);
      p.hl(12 + ox, 10 + oy, 22, RP.iron0);
      p.hl(14 + ox, 6 + oy, 18, RP.mol0);
      p.px(18 + ox, 6 + oy, mol); p.px(26 + ox, 6 + oy, mol);
      break;
    }
    case "strike": {
      p.r(37 + ox, 33 + oy, 8, 4, RP.crim1);
      // cleaver slammed down in front — molten cutting edge
      p.r(41 + ox, 35 + oy, 4, 3, RP.iron0);
      p.r(45 + ox, 33 + oy, 16, 12, RP.iron1);
      p.hl(45 + ox, 33 + oy, 16, RP.iron2);
      p.vl(60 + ox, 33 + oy, 12, RP.iron2);
      p.hl(45 + ox, 44 + oy, 16, RP.mol1);
      p.hl(47 + ox, 38 + oy, 12, RP.mol0);
      p.px(52 + ox, 38 + oy, mol);
      break;
    }
    case "follow": {
      p.r(37 + ox, 35 + oy, 7, 4, RP.crim1);
      p.r(44 + ox, 36 + oy, 15, 11, RP.iron1);
      p.hl(44 + ox, 46 + oy, 15, RP.mol0);
      p.vl(58 + ox, 36 + oy, 11, RP.iron2);
      break;
    }
    case "recoil": {
      p.r(35 + ox, 29 + oy, 4, 7, RP.crim1);
      p.r(34 + ox, 36 + oy, 5, 4, RP.iron1);
      // blade dropped low, dragging
      p.r(41 + ox, 42 + oy, 8, 17, RP.iron1);
      p.vl(48 + ox, 42 + oy, 17, RP.iron2);
      p.vl(44 + ox, 46 + oy, 10, RP.mol0);
      break;
    }
    case "raise": {
      p.r(36 + ox, 22 + oy, 5, 9, RP.crim1);
      p.r(38 + ox, 19 + oy, 3, 4, RP.iron0);
      p.r(35 + ox, 2 + oy, 9, 18, RP.iron1);
      p.vl(43 + ox, 2 + oy, 18, RP.iron2);
      p.vl(35 + ox, 2 + oy, 18, RP.iron0);
      p.vl(39 + ox, 4 + oy, 14, RP.mol0);
      p.px(39 + ox, 8 + oy, mol);
      if (ps.glow > 0.85) { p.px(39 + ox, 1 + oy, RP.mol2); p.px(38 + ox, 0 + oy, RP.mol1); p.px(40 + ox, 0 + oy, RP.mol1); }
      break;
    }
    case "limp": {
      p.r(36 + ox, 33 + oy, 4, 10, RP.crim0);
      break;
    }
  }
}

export function drawRed(g: CanvasRenderingContext2D, anim: AnimName, fr: number): void {
  const p = makePen(g);
  const ps = poseFor(anim, fr);
  if (ps.legs === "fallen") { drawRedFallen(p, ps); return; }
  const ox = ps.lean, oy = ps.bob;
  const mol = redMol(ps.glow);

  drawRedLegs(p, ps.legs);

  // hips / belt
  p.r(14 + ox, 45 + oy, 23, 3, RP.iron0);
  p.r(24 + ox, 45 + oy, 3, 3, ps.glow > 0.5 ? RP.mol0 : RP.crim0);

  // torso — a slab of iron with a molten core seam
  p.r(13 + ox, 30 + oy, 25, 16, RP.iron1);
  p.hl(13 + ox, 30 + oy, 25, RP.rim);
  p.r(15 + ox, 31 + oy, 21, 8, RP.crim1);
  p.hl(15 + ox, 31 + oy, 21, RP.crim2);
  p.r(16 + ox, 40 + oy, 19, 5, RP.iron0);
  p.vl(25 + ox, 39 + oy, 6, RP.mol0);
  p.px(25 + ox, 41 + oy, mol);
  p.px(15 + ox, 38 + oy, RP.mol0);
  p.px(35 + ox, 38 + oy, RP.mol0);
  p.px(17 + ox, 33 + oy, RP.crim2);
  p.px(33 + ox, 33 + oy, RP.crim2);

  // back arm
  p.r(9 + ox, 31 + oy, 5, 11, RP.iron0);
  p.r(9 + ox, 42 + oy, 5, 4, RP.iron1);

  // pauldrons — oversized
  p.r(8 + ox, 27 + oy, 8, 8, RP.crim0);
  p.hl(8 + ox, 27 + oy, 8, RP.crim1);
  p.px(7 + ox, 26 + oy, RP.iron2);
  p.r(33 + ox, 26 + oy, 12, 9, RP.crim1);
  p.hl(33 + ox, 26 + oy, 12, RP.crim2);
  p.px(44 + ox, 26 + oy, RP.rim);
  p.hl(33 + ox, 34 + oy, 12, RP.iron0);
  p.px(45 + ox, 24 + oy, RP.iron2);
  p.px(44 + ox, 25 + oy, RP.iron1);

  // head — squat helm, forge-coal eyes
  const hd = ps.headDrop;
  p.r(24 + ox, 29 + oy, 5, 2, RP.iron0); // neck
  p.r(20 + ox, 18 + oy + hd, 12, 11, RP.iron1);
  p.hl(20 + ox, 18 + oy + hd, 12, RP.iron2);
  p.px(20 + ox, 18 + oy + hd, RP.rim);
  p.hl(20 + ox, 22 + oy + hd, 12, RP.iron0);
  p.r(22 + ox, 23 + oy + hd, 8, 3, RP.dark);
  p.px(24 + ox, 24 + oy + hd, mol);
  p.px(28 + ox, 24 + oy + hd, mol);
  p.r(20 + ox, 26 + oy + hd, 3, 3, RP.iron0);
  p.r(29 + ox, 26 + oy + hd, 3, 3, RP.iron0);
  p.r(22 + ox, 15 + oy + hd, 8, 3, RP.crim0);
  p.hl(22 + ox, 15 + oy + hd, 8, RP.crim1);

  drawRedWeaponAndArm(p, ps);
}

// ── BLUE — the Duelist ────────────────────────────────────────────────────────

const BP = {
  st0: "#232c38", st1: "#46566a", st2: "#7e93aa", st3: "#c6d6e4",
  en0: "#0e7e9e", en1: "#2ad8ff", en2: "#b8f4ff",
  rim: "#e8f4ff", dark: "#0c1016",
};

function blueEn(glow: number): string {
  return glow > 0.8 ? BP.en2 : glow > 0.4 ? BP.en1 : BP.en0;
}

function drawBlueFallen(p: Pen, ps: Pose): void {
  if (ps.fall < 0.8) {
    // mid-fall — collapsing backward
    p.r(14, 50, 9, 7, BP.st1);                // helm tilting back
    p.px(18, 53, blueEn(ps.glow));
    p.r(22, 52, 10, 6, BP.st1);               // torso
    p.r(31, 55, 12, 4, BP.st0);               // legs swinging up
    p.r(20, 46, 3, 6, BP.st1);                // arm flail
    p.chain([[34, 47], [50, 42]], BP.st2, 1); // rapier leaving the hand
    return;
  }
  // flat on back, head away from opponent
  p.r(8, 56, 8, 6, BP.st1);                   // helm
  p.hl(8, 56, 8, BP.st2);
  p.px(13, 58, ps.glow > 0.05 ? BP.en0 : "#1d2630"); // visor going dark
  p.r(16, 57, 12, 4, BP.st1);                 // torso
  p.px(22, 58, ps.glow > 0.05 ? BP.en0 : BP.st0);    // core flicker
  p.r(28, 58, 7, 3, BP.st0);                  // hips
  p.r(35, 58, 12, 3, BP.st0);                 // legs
  p.r(46, 57, 5, 4, BP.st0);                  // boots
  p.hl(34, 60, 18, BP.st2);                   // rapier on the ground
  p.px(52, 60, ps.glow > 0.05 ? BP.en0 : BP.st1);
}

function drawBlueLegs(p: Pen, legs: LegPose): void {
  switch (legs) {
    case "stand":
      p.r(19, 46, 4, 12, BP.st1); p.r(29, 46, 4, 12, BP.st1);
      p.px(20, 51, BP.st2); p.px(30, 51, BP.st2);
      p.r(17, 58, 6, 4, BP.st0); p.r(28, 58, 6, 4, BP.st0);
      p.hl(17, 58, 6, BP.st1); p.hl(28, 58, 6, BP.st1);
      break;
    case "stepA":
      p.r(16, 47, 4, 11, BP.st1); p.r(31, 46, 4, 12, BP.st1);
      p.r(14, 58, 6, 4, BP.st0); p.r(30, 58, 6, 4, BP.st0);
      break;
    case "stepB":
      p.r(22, 46, 4, 12, BP.st1); p.r(26, 47, 4, 11, BP.st1);
      p.r(20, 58, 6, 4, BP.st0); p.r(25, 58, 6, 4, BP.st0);
      break;
    case "brace":
      p.r(16, 47, 4, 11, BP.st1); p.r(31, 47, 4, 11, BP.st1);
      p.r(14, 58, 6, 4, BP.st0); p.r(30, 58, 6, 4, BP.st0);
      break;
    case "lunge":
      p.r(11, 53, 10, 3, BP.st1);              // back leg extended
      p.r(8, 58, 6, 4, BP.st0);
      p.r(32, 48, 5, 10, BP.st1);              // front leg deep bend
      p.r(31, 58, 7, 4, BP.st0);
      break;
    case "kneel":
      p.r(27, 52, 8, 4, BP.st1);
      p.r(33, 56, 3, 6, BP.st1);
      p.r(31, 59, 7, 3, BP.st0);
      p.r(18, 55, 5, 7, BP.st0);
      p.r(14, 60, 6, 2, BP.st0);
      p.hl(38, 59, 16, BP.st2);                // dropped rapier
      p.px(54, 59, BP.en0);
      break;
    case "fallen":
      break;
  }
}

function drawBlueWeaponAndArm(p: Pen, ps: Pose): void {
  const ox = ps.lean, oy = ps.bob;
  const en = blueEn(ps.glow);
  switch (ps.arm) {
    case "guard": {
      p.r(32 + ox, 30 + oy, 4, 8, BP.st1);
      p.r(33 + ox, 38 + oy, 4, 3, BP.st2);
      p.px(36 + ox, 39 + oy, BP.st2);
      p.px(37 + ox, 39 + oy, BP.st3);
      // rapier at rest, angled down
      p.chain([[38 + ox, 40 + oy], [56 + ox, 46 + oy]], BP.st3, 1);
      p.px(57 + ox, 46 + oy, en);
      p.px(58 + ox, 47 + oy, BP.en0);
      break;
    }
    case "windup": {
      p.r(29 + ox, 31 + oy, 4, 7, BP.st1);
      p.r(31 + ox, 36 + oy, 4, 3, BP.st2);
      // blade drawn vertical — fencer's salute
      p.chain([[35 + ox, 37 + oy], [39 + ox, 16 + oy]], BP.st3, 1);
      p.px(39 + ox, 15 + oy, en);
      p.px(40 + ox, 14 + oy, BP.en1);
      break;
    }
    case "strike": {
      // full extension — blade horizontal with an energy core
      p.r(33 + ox, 32 + oy, 10, 3, BP.st1);
      p.r(41 + ox, 32 + oy, 3, 3, BP.st2);
      p.hl(44 + ox, 32 + oy, 18, BP.en0);
      p.hl(44 + ox, 33 + oy, 18, "#ffffff");
      p.hl(44 + ox, 34 + oy, 18, BP.en1);
      p.px(62 + ox > 63 ? 63 : 62 + ox, 33 + oy, BP.en2);
      p.px(61 + ox, 32 + oy, BP.en1);
      p.px(61 + ox, 34 + oy, BP.en1);
      break;
    }
    case "follow": {
      p.r(33 + ox, 33 + oy, 9, 3, BP.st1);
      p.chain([[42 + ox, 35 + oy], [59 + ox, 40 + oy]], BP.st3, 1);
      p.px(60 + ox, 40 + oy, BP.en0);
      break;
    }
    case "recoil": {
      p.r(31 + ox, 28 + oy, 4, 6, BP.st1);
      p.chain([[35 + ox, 38 + oy], [50 + ox, 52 + oy]], BP.st2, 1);
      break;
    }
    case "raise": {
      p.r(33 + ox, 22 + oy, 4, 8, BP.st1);
      p.vl(35 + ox, 3 + oy, 18, BP.st3);
      p.px(35 + ox, 8 + oy, en);
      p.px(35 + ox, 14 + oy, en);
      p.px(35 + ox, 2 + oy, BP.en2);
      if (ps.glow > 0.85) { p.px(34 + ox, 1 + oy, BP.en1); p.px(36 + ox, 1 + oy, BP.en1); }
      break;
    }
    case "limp": {
      p.r(33 + ox, 33 + oy, 3, 9, BP.st0);
      break;
    }
  }
}

export function drawBlue(g: CanvasRenderingContext2D, anim: AnimName, fr: number): void {
  const p = makePen(g);
  const ps = poseFor(anim, fr);
  if (ps.legs === "fallen") { drawBlueFallen(p, ps); return; }
  const ox = ps.lean, oy = ps.bob;
  const en = blueEn(ps.glow);

  drawBlueLegs(p, ps.legs);

  // hips
  p.r(18 + ox, 43 + oy, 15, 4, BP.st0);
  p.px(25 + ox, 44 + oy, en);

  // torso — slim chrome shell with a vertical energy core
  p.r(19 + ox, 29 + oy, 14, 14, BP.st1);
  p.hl(19 + ox, 29 + oy, 14, BP.st3);
  p.hl(19 + ox, 30 + oy, 14, BP.st2);
  p.vl(25 + ox, 32 + oy, 9, ps.glow > 0.4 ? BP.en1 : BP.en0);
  p.px(25 + ox, 35 + oy, ps.glow > 0.75 ? BP.en2 : BP.en1);
  p.px(19 + ox, 40 + oy, BP.st0);
  p.px(32 + ox, 40 + oy, BP.st0);

  // back arm
  p.r(15 + ox, 29 + oy, 4, 10, BP.st0);
  p.r(15 + ox, 39 + oy, 4, 3, BP.st1);

  // shoulders — angular fin on the lead shoulder
  p.r(16 + ox, 26 + oy, 5, 4, BP.st1);
  p.r(30 + ox, 25 + oy, 7, 4, BP.st2);
  p.px(37 + ox, 24 + oy, BP.st3);
  p.hl(30 + ox, 29 + oy, 7, BP.st0);

  // head — sleek helm, single glowing visor slit, swept crest
  const hd = ps.headDrop;
  p.r(24 + ox, 27 + oy, 5, 2, BP.st0); // neck
  p.r(21 + ox, 17 + oy + hd, 11, 10, BP.st1);
  p.hl(21 + ox, 17 + oy + hd, 11, BP.st3);
  p.r(15 + ox, 15 + oy + hd, 9, 3, BP.st2);  // crest swept back
  p.px(14 + ox, 16 + oy + hd, BP.st2);
  p.r(23 + ox, 21 + oy + hd, 8, 2, en);      // the visor IS the face
  p.px(30 + ox, 21 + oy + hd, BP.en2);
  p.r(24 + ox, 25 + oy + hd, 6, 2, BP.st0);

  drawBlueWeaponAndArm(p, ps);
}

// ── GOLD — the Wildcard ───────────────────────────────────────────────────────

const GP = {
  br0: "#4a3414", br1: "#7a5a24", br2: "#b08a3a",
  au0: "#d4a853", au1: "#f0d488", au2: "#fbeec4",
  crim: "#8b1a1a", crimD: "#5e1010", crimL: "#b3302a",
  spark: "#ffe89a", dark: "#170f06",
};

function goldSp(glow: number): string {
  return glow > 0.8 ? "#ffffff" : glow > 0.4 ? GP.spark : GP.au0;
}

function drawGoldFallen(p: Pen, ps: Pose): void {
  if (ps.fall < 0.8) {
    // mid-fall — crumpling forward, cape lifting
    p.r(10, 54, 10, 5, GP.br0);
    p.r(7, 59, 7, 3, GP.br0);
    p.r(17, 49, 12, 8, GP.br1);
    p.r(14, 46, 8, 7, GP.crim);               // cape billowing
    p.r(27, 52, 9, 7, GP.br1);
    p.hl(27, 52, 9, GP.au0);
    p.r(36, 53, 9, 7, GP.br2);                // helm
    p.px(42, 56, GP.spark);
    p.chain([[40, 59], [54, 56]], GP.br2, 1); // glaive slipping
    return;
  }
  // flat, cape settled over the body
  p.r(6, 57, 11, 4, GP.br0);                  // legs
  p.r(4, 58, 4, 3, GP.br0);
  p.r(16, 53, 10, 6, GP.crim);                // cape draped
  p.vl(16, 53, 6, GP.crimD);
  p.r(20, 56, 14, 5, GP.br1);                 // torso
  p.hl(20, 56, 14, GP.au0);
  p.r(37, 55, 9, 6, GP.br2);                  // helm
  p.hl(37, 55, 9, GP.au1);
  p.px(43, 58, ps.glow > 0.05 ? GP.spark : "#3a2c14");
  p.r(46, 59, 5, 2, GP.crim);                 // plume on the sand
  p.chain([[44, 60], [58, 58]], GP.br2, 1);   // glaive
  if (ps.glow > 0.05) p.px(58, 57, GP.au1);
}

function drawGoldLegs(p: Pen, legs: LegPose): void {
  switch (legs) {
    case "stand":
      p.r(18, 47, 5, 11, GP.br1); p.r(29, 47, 5, 11, GP.br1);
      p.px(20, 51, GP.au0); p.px(31, 51, GP.au0);
      p.r(16, 58, 7, 4, GP.br0); p.r(28, 58, 7, 4, GP.br0);
      p.hl(16, 58, 7, GP.au0); p.hl(28, 58, 7, GP.au0);
      break;
    case "stepA":
      p.r(15, 48, 5, 10, GP.br1); p.r(31, 47, 5, 11, GP.br1);
      p.r(13, 58, 7, 4, GP.br0); p.r(30, 58, 7, 4, GP.br0);
      break;
    case "stepB":
      p.r(21, 47, 5, 11, GP.br1); p.r(26, 48, 5, 10, GP.br1);
      p.r(19, 58, 7, 4, GP.br0); p.r(24, 58, 7, 4, GP.br0);
      break;
    case "brace":
      p.r(14, 48, 5, 10, GP.br1); p.r(31, 48, 5, 10, GP.br1);
      p.r(12, 58, 7, 4, GP.br0); p.r(30, 58, 7, 4, GP.br0);
      break;
    case "lunge":
      p.r(10, 53, 9, 4, GP.br1);
      p.r(7, 59, 8, 3, GP.br0);
      p.r(32, 48, 6, 10, GP.br1);
      p.r(31, 58, 8, 4, GP.br0);
      break;
    case "kneel":
      p.r(26, 52, 9, 4, GP.br1);
      p.r(33, 56, 4, 6, GP.br1);
      p.r(31, 59, 8, 3, GP.br0);
      p.r(16, 55, 6, 7, GP.br0);
      p.r(11, 60, 7, 2, GP.br0);
      p.chain([[40, 58], [56, 55]], GP.br2, 1); // dropped glaive
      p.px(56, 54, GP.au0);
      break;
    case "fallen":
      break;
  }
}

function drawGoldWeaponAndArm(p: Pen, ps: Pose): void {
  const ox = ps.lean, oy = ps.bob;
  const sp = goldSp(ps.glow);
  switch (ps.arm) {
    case "guard": {
      p.r(33 + ox, 31 + oy, 4, 8, GP.br1);
      p.r(34 + ox, 39 + oy, 4, 3, GP.br2);
      // curved glaive at rest — sweeping up to the right
      const pts: [number, number][] = [[38 + ox, 41 + oy], [42 + ox, 39 + oy], [46 + ox, 35 + oy], [49 + ox, 30 + oy], [51 + ox, 26 + oy]];
      p.chain(pts, GP.br2, 2);
      p.chain([[39 + ox, 40 + oy], [50 + ox, 26 + oy]], GP.au1, 1);
      p.px(52 + ox, 24 + oy, GP.au1);
      p.px(52 + ox, 23 + oy, sp);
      break;
    }
    case "windup": {
      p.r(30 + ox, 27 + oy, 4, 7, GP.br1);
      // glaive swept back overhead — coiled spin
      const pts: [number, number][] = [[32 + ox, 27 + oy], [27 + ox, 20 + oy], [21 + ox, 15 + oy], [15 + ox, 12 + oy]];
      p.chain(pts, GP.br2, 2);
      p.chain([[30 + ox, 25 + oy], [16 + ox, 12 + oy]], GP.au1, 1);
      p.px(13 + ox, 11 + oy, sp);
      break;
    }
    case "strike": {
      p.r(36 + ox, 32 + oy, 8, 3, GP.br1);
      // wide crescent sweep in front
      const pts: [number, number][] = [[45 + ox, 20 + oy], [50 + ox, 23 + oy], [54 + ox, 27 + oy], [57 + ox, 32 + oy], [59 + ox, 37 + oy], [60 + ox, 42 + oy]];
      p.chain(pts, GP.br2, 2);
      p.chain([[46 + ox, 21 + oy], [58 + ox, 36 + oy]], GP.au1, 1);
      p.px(46 + ox, 19 + oy, sp);
      p.px(53 + ox, 26 + oy, sp);
      p.px(59 + ox, 36 + oy, sp);
      break;
    }
    case "follow": {
      p.r(36 + ox, 34 + oy, 8, 3, GP.br1);
      const pts: [number, number][] = [[45 + ox, 46 + oy], [50 + ox, 45 + oy], [55 + ox, 43 + oy], [59 + ox, 40 + oy]];
      p.chain(pts, GP.br2, 2);
      p.px(60 + ox, 39 + oy, GP.au1);
      break;
    }
    case "recoil": {
      p.r(33 + ox, 28 + oy, 4, 7, GP.br1);
      p.chain([[36 + ox, 40 + oy], [50 + ox, 50 + oy]], GP.br2, 1);
      break;
    }
    case "raise": {
      p.r(34 + ox, 22 + oy, 4, 8, GP.br1);
      // crescent held high like a trophy
      const pts: [number, number][] = [[22 + ox, 8 + oy], [27 + ox, 5 + oy], [33 + ox, 4 + oy], [39 + ox, 5 + oy], [44 + ox, 8 + oy]];
      p.chain(pts, GP.br2, 2);
      p.chain([[24 + ox, 7 + oy], [42 + ox, 7 + oy]], GP.au1, 1);
      p.px(33 + ox, 3 + oy, sp);
      p.chain([[36 + ox, 21 + oy], [34 + ox, 9 + oy]], GP.br0, 1);
      break;
    }
    case "limp": {
      p.r(34 + ox, 33 + oy, 3, 9, GP.br0);
      break;
    }
  }
}

export function drawGold(g: CanvasRenderingContext2D, anim: AnimName, fr: number): void {
  const p = makePen(g);
  const ps = poseFor(anim, fr);
  if (ps.legs === "fallen") { drawGoldFallen(p, ps); return; }
  const ox = ps.lean, oy = ps.bob;

  // half-cape behind everything
  p.r(11 + ox, 28 + oy, 6, 17, GP.crim);
  p.vl(11 + ox, 28 + oy, 17, GP.crimD);
  p.px(12 + ox, 45 + oy, GP.crim);
  p.px(15 + ox, 46 + oy, GP.crim);

  drawGoldLegs(p, ps.legs);

  // faulds — crimson sash with gold trim
  p.r(15 + ox, 43 + oy, 21, 5, GP.crim);
  p.hl(15 + ox, 43 + oy, 21, GP.au0);
  p.px(17 + ox, 48 + oy, GP.crim);
  p.px(33 + ox, 48 + oy, GP.crim);

  // torso — ornate, filigreed
  p.r(16 + ox, 29 + oy, 19, 14, GP.br1);
  p.r(16 + ox, 29 + oy, 19, 3, GP.au0);
  p.hl(16 + ox, 29 + oy, 19, GP.au1);
  p.px(20 + ox, 33 + oy, GP.au1);
  p.px(24 + ox, 32 + oy, GP.au1);
  p.px(28 + ox, 33 + oy, GP.au1);
  p.px(22 + ox, 36 + oy, GP.au0);
  p.px(26 + ox, 36 + oy, GP.au0);
  // luck-rune diamond at the heart
  p.px(25 + ox, 34 + oy, ps.glow > 0.7 ? GP.au2 : GP.au1);
  p.px(24 + ox, 35 + oy, GP.au1);
  p.px(26 + ox, 35 + oy, GP.au1);
  p.px(25 + ox, 36 + oy, GP.au1);

  // back arm (mostly behind the cape)
  p.r(14 + ox, 31 + oy, 4, 9, GP.br0);

  // shoulders — one huge ornate pauldron
  p.r(15 + ox, 27 + oy, 5, 4, GP.br1);
  p.r(32 + ox, 24 + oy, 11, 10, GP.au0);
  p.hl(32 + ox, 24 + oy, 11, GP.au1);
  p.hl(32 + ox, 30 + oy, 11, GP.br1);
  p.px(42 + ox, 24 + oy, GP.au2);
  p.px(43 + ox, 22 + oy, GP.au1);
  p.px(44 + ox, 21 + oy, GP.au0);

  // head — gilded helm, mischief eyes, crimson plume
  const hd = ps.headDrop;
  p.r(24 + ox, 28 + oy, 5, 2, GP.br0); // neck
  p.r(20 + ox, 17 + oy + hd, 12, 11, GP.br2);
  p.hl(20 + ox, 17 + oy + hd, 12, GP.au1);
  p.r(22 + ox, 21 + oy + hd, 8, 5, GP.br0);
  p.px(24 + ox, 23 + oy + hd, goldSp(ps.glow));
  p.px(28 + ox, 23 + oy + hd, goldSp(ps.glow));
  p.hl(22 + ox, 26 + oy + hd, 8, GP.br1);
  p.r(17 + ox, 12 + oy + hd, 7, 3, GP.crim);
  p.r(14 + ox, 13 + oy + hd, 4, 3, GP.crim);
  p.px(12 + ox, 15 + oy + hd, GP.crim);
  p.px(20 + ox, 12 + oy + hd, GP.crimL);

  drawGoldWeaponAndArm(p, ps);
}

// ── Bake ─────────────────────────────────────────────────────────────────────

const DRAW_FN: Record<FighterColor, (g: CanvasRenderingContext2D, anim: AnimName, fr: number) => void> = {
  red: drawRed,
  blue: drawBlue,
  gold: drawGold,
};

export type SpriteBank = Record<string, HTMLCanvasElement[]>; // key: `${color}/${anim}`

export function bakeSprites(colors: FighterColor[]): SpriteBank {
  const bank: SpriteBank = {};
  const anims = Object.keys(FRAME_COUNT) as AnimName[];
  for (const color of Array.from(new Set(colors))) {
    for (const anim of anims) {
      const frames: HTMLCanvasElement[] = [];
      for (let fr = 0; fr < FRAME_COUNT[anim]; fr++) {
        const c = document.createElement("canvas");
        c.width = CELL;
        c.height = CELL;
        const g = c.getContext("2d")!;
        g.imageSmoothingEnabled = false;
        DRAW_FN[color](g, anim, fr);
        frames.push(c);
      }
      bank[`${color}/${anim}`] = frames;
    }
  }
  return bank;
}

// ── Debug sheet (used by /visual-test?auto=sheet) ────────────────────────────

export function drawDebugSheet(canvas: HTMLCanvasElement, scale = 3): void {
  const colors: FighterColor[] = ["red", "blue", "gold"];
  const anims = Object.keys(FRAME_COUNT) as AnimName[];
  const maxFrames = Math.max(...Object.values(FRAME_COUNT));
  const pad = 4;
  canvas.width = (maxFrames * (CELL + pad)) * scale + 90;
  canvas.height = colors.length * anims.length * (CELL + pad) * scale;
  const g = canvas.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  g.fillStyle = "#0d0b08";
  g.fillRect(0, 0, canvas.width, canvas.height);
  const bank = bakeSprites(colors);
  let row = 0;
  for (const color of colors) {
    for (const anim of anims) {
      const frames = bank[`${color}/${anim}`];
      const y = row * (CELL + pad) * scale;
      g.fillStyle = "#8b6c3a";
      g.font = "12px monospace";
      g.textAlign = "left";
      g.fillText(`${color}/${anim}`, 4, y + 14);
      frames.forEach((f, i) => {
        g.drawImage(f, 90 + i * (CELL + pad) * scale, y, CELL * scale, CELL * scale);
      });
      row++;
    }
  }
}
