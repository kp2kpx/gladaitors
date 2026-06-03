"use client";

// ─── CanvasFight — Street Fighter-style canvas renderer ──────────────────────
// Plays back a FightResult as a side-view arena animation.
// No Phaser, no game libraries — vanilla JS canvas inside a React component.
// Dynamically imported (ssr: false) from visual-test/page.tsx.
//
// Characters are rendered from real pixel art sprite sheets in /public/characters/.
// Each animation (idle/attack/hit/death) is a horizontal strip of 8 frames,
// each frame 106px wide × 1186px tall (sheet: 848 × 1186).
//
// Color → sprite folder mapping:
//   red  → /characters/red/   (Maximus)
//   blue → /characters/blue/  (Spartax)
//   gold → /characters/blue/  (Gruk — uses blue sheet with golden CSS filter tint)

import { useEffect, useRef } from "react";
import type { FightResult, RoundLog } from "@/lib/fight-engine";

export type FighterColor = "red" | "blue" | "gold";

interface CanvasFightProps {
  result: FightResult;
  p1Color: FighterColor;
  p2Color: FighterColor;
  onDone: () => void;
}

// ── Sprite sheet constants ────────────────────────────────────────────────────

const SPRITE_FRAME_W = 106;   // px per frame (848 / 8)
const SPRITE_FRAME_H = 1186;  // full sheet height
const SPRITE_FRAMES  = 8;     // frames per animation

type AnimName = "idle" | "attack" | "hit" | "death";

// Map fighter state → animation name
function stateToAnim(state: FighterState): AnimName {
  if (state === "walk")   return "idle";
  if (state === "attack") return "attack";
  if (state === "hit")    return "hit";
  if (state === "death")  return "death";
  return "idle";
}

// Folder for each color (gold reuses blue)
const COLOR_TO_FOLDER: Record<FighterColor, string> = {
  red:  "red",
  blue: "blue",
  gold: "blue",
};

// CSS filter tint for gold (sepia+saturate gives warm amber-gold look)
const COLOR_TO_FILTER: Record<FighterColor, string | null> = {
  red:  null,
  blue: null,
  gold: "sepia(1) saturate(4) hue-rotate(10deg) brightness(1.1)",
};

// Animation playback FPS per state
const ANIM_FPS: Record<AnimName, number> = {
  idle:   8,
  attack: 16,
  hit:    16,
  death:  8,
};

// Whether an animation loops
const ANIM_LOOPS: Record<AnimName, boolean> = {
  idle:   true,
  attack: false,
  hit:    false,
  death:  false,
};

// ── Constants ─────────────────────────────────────────────────────────────────

const W = 480;
const H = 240;
const FLOOR_Y = 188;

// Character render width on canvas. Aspect ratio is 106:1186 = 0.089.
// At CHAR_W=52, height = 52 * (1186/106) = ~582px — most clips above canvas top.
// Feet land at FLOOR_Y, so we see roughly the lower ~180px of the 582px render.
// This shows legs, torso, weapons — the interesting part.
const CHAR_W = 52;
const CHAR_H = CHAR_W * (SPRITE_FRAME_H / SPRITE_FRAME_W); // ≈ 582px

const FIGHT_GAP = 110;
const HP_BAR_W = 180;
const HP_BAR_H = 12;
const HP_BAR_Y = 16;

// Timings (ms)
const ATTACK_LUNGE_MS  = 80;
const ATTACK_RETRACT_MS = 80;
const HIT_FLASH_MS     = 100;
const HIT_KNOCKBACK_MS = 80;
const NORMAL_GAP_MS    = 140;
const COMBO_GAP_MS     = 20;
const DEATH_MS         = 500;
const POST_DEATH_MS    = 600;

// ── VFX types ─────────────────────────────────────────────────────────────────

interface SlashVFX {
  x: number;
  y: number;
  born: number;
  duration: number;
  lineLen: number;
  lineW: number;
  color: string;
  isCombo: boolean;
  isCrit: boolean;
}

interface DamageNum {
  x: number;
  y: number;
  startY: number;
  born: number;
  text: string;
  isCrit: boolean;
}

// ── Fighter state ─────────────────────────────────────────────────────────────

type FighterState = "idle" | "walk" | "attack" | "hit" | "death";

interface Fighter {
  x: number;
  baseX: number;
  y: number;
  state: FighterState;
  stateStart: number;
  attackDir: number;
  lungeOffset: number;
  knockOffset: number;
  knockDir: number;
  deathAngle: number;
  deathOpacity: number;
  hpTarget: number;
  hpDisplay: number;
  color: FighterColor;
  side: "p1" | "p2";
  alive: boolean;
}

// ── Sprite image cache key: "{folder}/{anim}" ─────────────────────────────────

type SpriteKey = string; // e.g. "red/idle"

// ── Main component ────────────────────────────────────────────────────────────

export default function CanvasFight({ result, p1Color, p2Color, onDone }: CanvasFightProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const doneCalledRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctxOrNull = canvas.getContext("2d");
    if (!ctxOrNull) return;
    const ctx: CanvasRenderingContext2D = ctxOrNull;

    doneCalledRef.current = false;

    // ── Preload all sprite images ──────────────────────────────────────────
    const anims: AnimName[] = ["idle", "attack", "hit", "death"];
    const foldersNeeded = Array.from(new Set([
      COLOR_TO_FOLDER[p1Color],
      COLOR_TO_FOLDER[p2Color],
    ]));

    const spriteImages: Record<SpriteKey, HTMLImageElement> = {};
    const totalImages = foldersNeeded.length * anims.length;
    let loadedCount = 0;
    let started = false;

    function tryStart() {
      loadedCount++;
      if (loadedCount >= totalImages && !started) {
        started = true;
        startAnimation();
      }
    }

    for (const folder of foldersNeeded) {
      for (const anim of anims) {
        const key: SpriteKey = `${folder}/${anim}`;
        const img = new window.Image();
        img.onload = tryStart;
        img.onerror = tryStart; // degrade gracefully
        img.src = `/characters/${folder}/${anim}.png`;
        spriteImages[key] = img;
      }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    function getSpriteImage(color: FighterColor, anim: AnimName): HTMLImageElement | null {
      const folder = COLOR_TO_FOLDER[color];
      const key: SpriteKey = `${folder}/${anim}`;
      return spriteImages[key] ?? null;
    }

    function getFrameIndex(f: Fighter, now: number): number {
      const anim = stateToAnim(f.state);
      const fps = ANIM_FPS[anim];
      const loops = ANIM_LOOPS[anim];
      const elapsed = now - f.stateStart;
      const totalFrames = SPRITE_FRAMES;
      const frameDuration = 1000 / fps;
      const rawFrame = Math.floor(elapsed / frameDuration);
      if (loops) {
        return rawFrame % totalFrames;
      } else {
        return Math.min(rawFrame, totalFrames - 1);
      }
    }

    // ── State ─────────────────────────────────────────────────────────────────

    const p1: Fighter = {
      x: 80,
      baseX: 80,
      y: FLOOR_Y - CHAR_H,
      state: "walk",
      stateStart: 0,
      attackDir: 1,
      lungeOffset: 0,
      knockOffset: 0,
      knockDir: -1,
      deathAngle: 0,
      deathOpacity: 1,
      hpTarget: 100,
      hpDisplay: 100,
      color: p1Color,
      side: "p1",
      alive: true,
    };

    const p2: Fighter = {
      x: 368,
      baseX: 368,
      y: FLOOR_Y - CHAR_H,
      state: "walk",
      stateStart: 0,
      attackDir: -1,
      lungeOffset: 0,
      knockOffset: 0,
      knockDir: 1,
      deathAngle: 0,
      deathOpacity: 1,
      hpTarget: 100,
      hpDisplay: 100,
      color: p2Color,
      side: "p2",
      alive: true,
    };

    const vfxList: SlashVFX[] = [];
    const damageNums: DamageNum[] = [];

    const log = result.log;
    let logIdx = 0;
    let hitDisplayIdx = 0;

    type Phase = "intro" | "fight" | "waiting" | "death" | "done";
    let phase: Phase = "intro";
    let phaseStart = 0;
    let nextHitAt = 0;

    const crowd = Array.from({ length: 14 }, () => ({
      x: 50 + Math.random() * 380,
      y: 40 + Math.random() * 40,
      r: 3 + Math.random() * 3,
      c: `rgba(${60 + Math.floor(Math.random() * 20)},${40 + Math.floor(Math.random() * 10)},${30 + Math.floor(Math.random() * 10)},0.3)`,
    }));

    // ── Helpers ───────────────────────────────────────────────────────────────

    function fightX(f: Fighter): number {
      return f.x + f.lungeOffset + f.knockOffset;
    }

    function spawnSlash(attacker: Fighter, defender: Fighter, isCrit: boolean, isCombo: boolean, now: number) {
      vfxList.push({
        x: fightX(defender),
        y: FLOOR_Y - 48,
        born: now,
        duration: isCrit ? 200 : 150,
        lineLen: isCrit ? 32 : 20,
        lineW: isCrit ? 3 : 2,
        color: isCrit ? "#ffd700" : "#ffe080",
        isCombo,
        isCrit,
      });
    }

    function spawnDamageNum(defender: Fighter, damage: number, isCrit: boolean, now: number) {
      const ix = fightX(defender) + (Math.random() * 20 - 10);
      const iy = FLOOR_Y - 64;
      damageNums.push({ x: ix, y: iy, startY: iy, born: now, text: isCrit ? `+${damage} CRIT` : `+${damage}`, isCrit });
    }

    function triggerHit(defender: Fighter, now: number) {
      defender.state = "hit";
      defender.stateStart = now;
      defender.knockDir = defender.side === "p1" ? -1 : 1;
    }

    // ── Draw functions ────────────────────────────────────────────────────────

    function drawArena(now: number) {
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, "#0d0b08");
      grad.addColorStop(1, "#1a1510");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      for (const dot of crowd) {
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2);
        ctx.fillStyle = dot.c;
        ctx.fill();
      }

      ctx.fillStyle = "#2a2218";
      ctx.fillRect(0, FLOOR_Y, W, 2);
    }

    function drawFighter(f: Fighter, now: number) {
      const cx = fightX(f);
      const anim = stateToAnim(f.state);
      const frameIdx = getFrameIndex(f, now);
      const img = getSpriteImage(f.color, anim);
      const filter = COLOR_TO_FILTER[f.color];

      // Destination rect: feet at FLOOR_Y
      const destX = cx - CHAR_W / 2;
      const destY = FLOOR_Y - CHAR_H;
      const destW = CHAR_W;
      const destH = CHAR_H;

      // Source rect: one frame from the horizontal strip
      const srcX = frameIdx * SPRITE_FRAME_W;
      const srcY = 0;
      const srcW = SPRITE_FRAME_W;
      const srcH = SPRITE_FRAME_H;

      ctx.save();
      ctx.globalAlpha = f.state === "death" ? f.deathOpacity : 1;

      // Death: rotate the fighter to fall sideways
      if (f.state === "death") {
        const pivotX = cx;
        const pivotY = FLOOR_Y;
        ctx.translate(pivotX, pivotY);
        const dir = f.side === "p1" ? -1 : 1;
        ctx.rotate(f.deathAngle * dir);
        ctx.translate(-pivotX, -pivotY);
      }

      // Hit flash: white rect overlay (skip sprite draw)
      if (f.state === "hit") {
        const elapsed = now - f.stateStart;
        if (elapsed < HIT_FLASH_MS) {
          ctx.fillStyle = "rgba(255,255,255,0.85)";
          ctx.fillRect(destX, destY + destH * 0.55, destW, destH * 0.45);
          ctx.restore();
          return;
        }
      }

      // Apply golden tint filter if needed
      if (filter) {
        ctx.filter = filter;
      }

      if (img && img.complete && img.naturalWidth > 0) {
        if (f.side === "p2") {
          // Flip P2 horizontally around their center X
          ctx.translate(cx + CHAR_W / 2, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(img, srcX, srcY, srcW, srcH, -CHAR_W / 2, destY, destW, destH);
        } else {
          ctx.drawImage(img, srcX, srcY, srcW, srcH, destX, destY, destW, destH);
        }
      } else {
        // Fallback: colored rectangle while image loads
        if (filter) ctx.filter = "none";
        const fallbackColors: Record<FighterColor, string> = {
          red:  "#c47070",
          blue: "#6090c8",
          gold: "#b8860b",
        };
        ctx.fillStyle = fallbackColors[f.color];
        ctx.fillRect(destX, destY + destH * 0.6, destW, destH * 0.4);
      }

      ctx.filter = "none";
      ctx.restore();
    }

    function drawHpBars() {
      ctx.font = "bold 10px monospace";
      ctx.fillStyle = "#e8dcc8";
      ctx.textAlign = "left";
      ctx.fillText("P1", 20, HP_BAR_Y - 3);

      ctx.fillStyle = "#1c1608";
      ctx.strokeStyle = "#2a2218";
      ctx.lineWidth = 1;
      ctx.fillRect(20, HP_BAR_Y, HP_BAR_W, HP_BAR_H);
      ctx.strokeRect(20, HP_BAR_Y, HP_BAR_W, HP_BAR_H);
      const hp1w = Math.max(0, HP_BAR_W * p1.hpDisplay / 100);
      ctx.fillStyle = "#c47070";
      ctx.fillRect(20, HP_BAR_Y, hp1w, HP_BAR_H);

      ctx.fillStyle = "#e8dcc8";
      ctx.textAlign = "right";
      ctx.fillText("P2", 460, HP_BAR_Y - 3);

      ctx.fillStyle = "#1c1608";
      ctx.strokeStyle = "#2a2218";
      ctx.fillRect(280, HP_BAR_Y, HP_BAR_W, HP_BAR_H);
      ctx.strokeRect(280, HP_BAR_Y, HP_BAR_W, HP_BAR_H);
      const hp2w = Math.max(0, HP_BAR_W * p2.hpDisplay / 100);
      ctx.fillStyle = "#6090c8";
      ctx.fillRect(280 + HP_BAR_W - hp2w, HP_BAR_Y, hp2w, HP_BAR_H);
    }

    function drawVFX(now: number) {
      for (const vfx of vfxList) {
        const elapsed = now - vfx.born;
        if (elapsed >= vfx.duration) continue;
        const opacity = 1 - elapsed / vfx.duration;

        ctx.save();
        ctx.globalAlpha = opacity;

        if (vfx.isCrit) {
          ctx.beginPath();
          ctx.arc(vfx.x, vfx.y, 20, 0, Math.PI * 2);
          ctx.fillStyle = "#ffd70020";
          ctx.fill();
        }

        const angles = [0, Math.PI / 3, (2 * Math.PI) / 3];
        for (const angle of angles) {
          ctx.beginPath();
          ctx.moveTo(vfx.x - Math.cos(angle) * vfx.lineLen / 2, vfx.y - Math.sin(angle) * vfx.lineLen / 2);
          ctx.lineTo(vfx.x + Math.cos(angle) * vfx.lineLen / 2, vfx.y + Math.sin(angle) * vfx.lineLen / 2);
          ctx.strokeStyle = vfx.color;
          ctx.lineWidth = vfx.lineW;
          ctx.stroke();
        }

        if (vfx.isCombo) {
          const comboAngles = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4];
          for (const angle of comboAngles) {
            ctx.beginPath();
            ctx.moveTo(vfx.x - Math.cos(angle) * 6, vfx.y - Math.sin(angle) * 6);
            ctx.lineTo(vfx.x + Math.cos(angle) * 6, vfx.y + Math.sin(angle) * 6);
            ctx.strokeStyle = "#ff8800";
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        }

        ctx.restore();
      }
    }

    function drawDamageNums(now: number) {
      for (const dn of damageNums) {
        const elapsed = now - dn.born;
        const duration = 600;
        if (elapsed >= duration) continue;
        const progress = elapsed / duration;
        const currentY = dn.startY - 30 * progress;
        const opacity = elapsed > 400 ? 1 - (elapsed - 400) / 200 : 1;

        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.font = dn.isCrit ? "bold 16px monospace" : "bold 14px monospace";
        ctx.fillStyle = dn.isCrit ? "#ffd700" : "#ffffff";
        ctx.textAlign = "center";
        ctx.fillText(dn.text, dn.x, currentY);
        ctx.restore();
      }
    }

    function drawHitCounter() {
      if (logIdx === 0) return;
      ctx.font = "9px monospace";
      ctx.fillStyle = "#4b3a28";
      ctx.textAlign = "center";
      ctx.fillText(`HIT ${hitDisplayIdx}/${log.length}`, W / 2, H - 10);
    }

    // ── Update functions ──────────────────────────────────────────────────────

    function updateFighter(f: Fighter, now: number, dt: number) {
      const elapsed = now - f.stateStart;

      switch (f.state) {
        case "walk": {
          const dir = f.side === "p1" ? 1 : -1;
          f.x += dir * 80 * (dt / 1000);
          break;
        }
        case "attack": {
          const half = ATTACK_LUNGE_MS;
          const full = ATTACK_LUNGE_MS + ATTACK_RETRACT_MS;
          if (elapsed < half) {
            f.lungeOffset = f.attackDir * 20 * (elapsed / half);
          } else if (elapsed < full) {
            f.lungeOffset = f.attackDir * 20 * (1 - (elapsed - half) / half);
          } else {
            f.lungeOffset = 0;
            f.state = "idle";
            f.stateStart = now;
          }
          break;
        }
        case "hit": {
          const knockDuration = HIT_KNOCKBACK_MS * 2;
          if (elapsed < HIT_FLASH_MS) {
            // flash phase — no movement
          } else if (elapsed < HIT_FLASH_MS + HIT_KNOCKBACK_MS) {
            const t = (elapsed - HIT_FLASH_MS) / HIT_KNOCKBACK_MS;
            f.knockOffset = f.knockDir * 15 * t;
          } else if (elapsed < HIT_FLASH_MS + knockDuration) {
            const t = (elapsed - HIT_FLASH_MS - HIT_KNOCKBACK_MS) / HIT_KNOCKBACK_MS;
            f.knockOffset = f.knockDir * 15 * (1 - t);
          } else {
            f.knockOffset = 0;
            f.state = "idle";
            f.stateStart = now;
          }
          break;
        }
        case "death": {
          const t = Math.min(elapsed / DEATH_MS, 1);
          f.deathAngle = (Math.PI / 2) * t;
          f.deathOpacity = 1 - t;
          break;
        }
        case "idle": {
          // animation handled by getFrameIndex
          break;
        }
      }

      f.hpDisplay += (f.hpTarget - f.hpDisplay) * 0.15;
    }

    // ── Main loop ─────────────────────────────────────────────────────────────

    let lastTime = 0;
    let rafId = 0;

    function tick(now: number) {
      const dt = lastTime === 0 ? 16 : now - lastTime;
      lastTime = now;

      if (phaseStart === 0) {
        phaseStart = now;
        nextHitAt = now + 800;
      }

      // ── Phase: intro ──────────────────────────────────────────────────────
      if (phase === "intro") {
        const gap = p2.x - p1.x;
        if (gap > FIGHT_GAP) {
          updateFighter(p1, now, dt);
          updateFighter(p2, now, dt);
        } else {
          p1.state = "idle";
          p1.stateStart = now;
          p2.state = "idle";
          p2.stateStart = now;
          phase = "fight";
          nextHitAt = now + 200;
        }
      }

      // ── Phase: fight ──────────────────────────────────────────────────────
      if (phase === "fight" || phase === "waiting") {
        if (now >= nextHitAt && logIdx < log.length) {
          const entry = log[logIdx];
          logIdx++;
          hitDisplayIdx = logIdx;

          const attacker = entry.attacker === "p1" ? p1 : p2;
          const defender = entry.attacker === "p1" ? p2 : p1;

          attacker.state = "attack";
          attacker.stateStart = now;

          setTimeout(() => {
            const perfNow = performance.now();
            triggerHit(defender, perfNow);
            spawnSlash(attacker, defender, entry.isCrit, entry.isCombo && entry.comboStep >= 2, perfNow);
            spawnDamageNum(defender, entry.damage, entry.isCrit, perfNow);
            p1.hpTarget = entry.hp1After;
            p2.hpTarget = entry.hp2After;

            if (entry.hp1After <= 0 && p1.alive) {
              p1.alive = false;
              setTimeout(() => { p1.state = "death"; p1.stateStart = performance.now(); }, HIT_FLASH_MS);
            }
            if (entry.hp2After <= 0 && p2.alive) {
              p2.alive = false;
              setTimeout(() => { p2.state = "death"; p2.stateStart = performance.now(); }, HIT_FLASH_MS);
            }
          }, ATTACK_LUNGE_MS);

          const isComboHit = entry.isCombo && entry.comboStep >= 2;
          const fullAttackMs = ATTACK_LUNGE_MS + ATTACK_RETRACT_MS;
          const gapAfter = isComboHit ? COMBO_GAP_MS : NORMAL_GAP_MS;

          if (entry.hp1After <= 0 || entry.hp2After <= 0) {
            nextHitAt = now + fullAttackMs + DEATH_MS + POST_DEATH_MS;
            phase = "death";
          } else {
            nextHitAt = now + fullAttackMs + gapAfter;
            phase = "fight";
          }
        } else if (logIdx >= log.length) {
          phase = "done";
        }

        updateFighter(p1, now, dt);
        updateFighter(p2, now, dt);
      }

      // ── Phase: death ──────────────────────────────────────────────────────
      if (phase === "death") {
        updateFighter(p1, now, dt);
        updateFighter(p2, now, dt);

        const deadFighter = !p1.alive ? p1 : p2;
        const deathElapsed = now - deadFighter.stateStart;
        if (deadFighter.state === "death" && deathElapsed > DEATH_MS + POST_DEATH_MS) {
          phase = "done";
        }
      }

      // ── Phase: done ───────────────────────────────────────────────────────
      if (phase === "done" && !doneCalledRef.current) {
        doneCalledRef.current = true;
        cancelAnimationFrame(rafId);
        draw(now);
        onDone();
        return;
      }

      draw(now);
      rafId = requestAnimationFrame(tick);
    }

    function draw(now: number) {
      ctx.clearRect(0, 0, W, H);
      drawArena(now);
      drawHpBars();
      drawVFX(now);
      drawFighter(p1, now);
      drawFighter(p2, now);
      drawDamageNums(now);
      drawHitCounter();
    }

    function startAnimation() {
      rafId = requestAnimationFrame(tick);
    }

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [result, p1Color, p2Color, onDone]);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      style={{
        width: "100%",
        maxWidth: `${W}px`,
        height: "auto",
        display: "block",
        margin: "0 auto",
        imageRendering: "pixelated",
        borderRadius: "4px",
        border: "1px solid #2a2218",
      }}
    />
  );
}
