"use client";

// ─── CanvasFight — Street Fighter-style canvas renderer ──────────────────────
// Plays back a FightResult as a side-view arena animation.
// No Phaser, no game libraries — vanilla JS canvas inside a React component.
// Dynamically imported (ssr: false) from visual-test/page.tsx.
//
// Characters are rendered from the 10 inline SVG designs in FightReplay.tsx
// (same 80×96 viewBox). Each SVG is serialised to a data URL and drawn via
// ctx.drawImage().  P2 is horizontally flipped with ctx.scale(-1, 1).
//
// Color → character mapping:
//   red  → Maximus  (Roman sword & shield, crimson/gold)
//   blue → Spartax  (Greek spear warrior, royal blue/silver)
//   gold → Gruk     (Axe berserker, iron/dark brown)

import { useEffect, useRef } from "react";
import type { FightResult, RoundLog } from "@/lib/fight-engine";

export type FighterColor = "red" | "blue" | "gold";

interface CanvasFightProps {
  result: FightResult;
  p1Color: FighterColor;
  p2Color: FighterColor;
  onDone: () => void;
}

// ── SVG character bodies (extracted from FightReplay.tsx) ─────────────────────
// viewBox="0 0 80 96" — all characters face RIGHT by default.
// Wrapped in a full <svg> tag before being turned into a data URL.

const SVG_CHAR_BODIES: Record<string, string> = {
  Maximus: `<path d="M28 3 Q40 -1 52 3 Q47 11 40 9 Q33 11 28 3Z" fill="#dc2626" />
      <ellipse cx="40" cy="17" rx="14" ry="13" fill="#d97706" />
      <rect x="30" y="15" width="20" height="9" rx="2" fill="#1c1917" />
      <rect x="32" y="18" width="5" height="2" rx="1" fill="#fbbf24" />
      <rect x="43" y="18" width="5" height="2" rx="1" fill="#fbbf24" />
      <rect x="37" y="29" width="6" height="5" rx="1" fill="#b45309" />
      <ellipse cx="14" cy="52" rx="10" ry="14" fill="#b8860b" stroke="#8b6914" stroke-width="1" />
      <ellipse cx="14" cy="52" rx="7" ry="10" fill="#8b1a1a" />
      <circle cx="14" cy="52" r="2.5" fill="#d97706" />
      <path d="M22 34 L58 34 L60 65 L20 65Z" fill="#dc2626" />
      <path d="M22 34 L58 34 L56 47 L24 47Z" fill="#b91c1c" />
      <rect x="11" y="36" width="14" height="7" rx="3.5" fill="#dc2626" />
      <rect x="55" y="34" width="14" height="7" rx="3.5" fill="#dc2626" />
      <rect x="67" y="19" width="3" height="36" rx="1.5" fill="#d1d5db" />
      <rect x="62" y="31" width="12" height="3" rx="1" fill="#d97706" />
      <rect x="68" y="15" width="2" height="8" rx="1" fill="#f3f4f6" />
      <rect x="22" y="62" width="36" height="5" rx="1" fill="#b8860b" />
      <rect x="24" y="65" width="12" height="22" rx="2" fill="#991b1b" />
      <rect x="44" y="65" width="12" height="22" rx="2" fill="#991b1b" />
      <rect x="22" y="81" width="16" height="7" rx="2" fill="#78350f" />
      <rect x="42" y="81" width="16" height="7" rx="2" fill="#78350f" />`,

  Spartax: `<polygon points="40,1 48,8 40,12 32,8" fill="#94a3b8" />
      <ellipse cx="40" cy="18" rx="13" ry="13" fill="#2563eb" />
      <path d="M27 15 Q40 10 53 15 L53 24 Q40 20 27 24Z" fill="#1d4ed8" />
      <rect x="33" y="17" width="14" height="7" rx="2" fill="#0f172a" />
      <rect x="35" y="20" width="4" height="2" rx="1" fill="#bfdbfe" />
      <rect x="41" y="20" width="4" height="2" rx="1" fill="#bfdbfe" />
      <rect x="37" y="30" width="6" height="4" rx="1" fill="#1e40af" />
      <path d="M24 34 L56 34 L58 65 L22 65Z" fill="#2563eb" />
      <rect x="24" y="34" width="32" height="10" fill="#1d4ed8" />
      <ellipse cx="16" cy="50" rx="9" ry="12" fill="#94a3b8" stroke="#64748b" stroke-width="1" />
      <circle cx="16" cy="50" r="3" fill="#2563eb" />
      <rect x="12" y="36" width="13" height="6" rx="3" fill="#2563eb" />
      <rect x="55" y="33" width="13" height="6" rx="3" fill="#2563eb" />
      <rect x="65" y="1" width="3" height="56" rx="1.5" fill="#94a3b8" />
      <polygon points="65,1 68,1 66.5,-6" fill="#e2e8f0" />
      <rect x="22" y="63" width="36" height="4" rx="1" fill="#1e40af" />
      <rect x="25" y="66" width="11" height="22" rx="2" fill="#1e3a8a" />
      <rect x="44" y="66" width="11" height="22" rx="2" fill="#1e3a8a" />
      <rect x="23" y="81" width="15" height="7" rx="2" fill="#0f172a" />
      <rect x="42" y="81" width="15" height="7" rx="2" fill="#0f172a" />`,

  Gruk: `<path d="M30 8 Q33 3 36 6 Q38 1 40 4 Q42 1 44 6 Q47 3 50 8 Q45 12 40 10 Q35 12 30 8Z" fill="#6b7280" />
      <ellipse cx="40" cy="19" rx="15" ry="13" fill="#44403c" />
      <rect x="31" y="17" width="18" height="8" rx="1" fill="#1c1917" />
      <rect x="33" y="20" width="4" height="3" rx="1" fill="#ef4444" />
      <rect x="43" y="20" width="4" height="3" rx="1" fill="#ef4444" />
      <path d="M28 16 L32 17 L30 22 L28 16Z" fill="#6b7280" />
      <path d="M52 16 L48 17 L50 22 L52 16Z" fill="#6b7280" />
      <rect x="36" y="31" width="8" height="5" rx="1" fill="#292524" />
      <path d="M18 35 L62 35 L65 66 L15 66Z" fill="#292524" />
      <path d="M18 35 L62 35 L60 50 L20 50Z" fill="#1c1917" />
      <rect x="12" y="36" width="16" height="8" rx="4" fill="#44403c" />
      <rect x="52" y="34" width="16" height="8" rx="4" fill="#44403c" />
      <rect x="66" y="20" width="4" height="48" rx="2" fill="#78350f" />
      <path d="M62 18 Q66 10 74 14 Q74 28 66 28 Z" fill="#9ca3af" stroke="#6b7280" stroke-width="0.5" />
      <path d="M62 34 Q66 42 74 38 Q74 24 66 24 Z" fill="#9ca3af" stroke="#6b7280" stroke-width="0.5" />
      <rect x="15" y="64" width="50" height="5" rx="1" fill="#78350f" />
      <rect x="22" y="67" width="14" height="22" rx="2" fill="#292524" />
      <rect x="44" y="67" width="14" height="22" rx="2" fill="#292524" />
      <rect x="20" y="82" width="18" height="7" rx="2" fill="#1c1917" />
      <rect x="42" y="82" width="18" height="7" rx="2" fill="#1c1917" />`,
};

// Map FighterColor → character name
const COLOR_TO_CHAR: Record<FighterColor, string> = {
  red:  "Maximus",
  blue: "Spartax",
  gold: "Gruk",
};

// Build a data URL from an SVG body string
function svgToDataUrl(charName: string): string {
  const body = SVG_CHAR_BODIES[charName] ?? SVG_CHAR_BODIES["Maximus"];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 96">${body}</svg>`;
  // Use encodeURIComponent-based approach for full Unicode safety
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

// ── Constants ─────────────────────────────────────────────────────────────────

const W = 480;
const H = 240;
const FLOOR_Y = 188;

// Character sprite dimensions (drawn at 2× the 80×96 viewBox)
const CHAR_W = 80;
const CHAR_H = 96;

const FIGHT_GAP = 110; // center-to-center distance when fighters are "in range"
const HP_BAR_W = 180;
const HP_BAR_H = 12;
const HP_BAR_Y = 16;

// Timings (ms)
const ATTACK_LUNGE_MS = 80;
const ATTACK_RETRACT_MS = 80;
const HIT_FLASH_MS = 100;
const HIT_KNOCKBACK_MS = 80;
const NORMAL_GAP_MS = 140;
const COMBO_GAP_MS = 20;
const DEATH_MS = 500;
const POST_DEATH_MS = 600;

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

    // ── Preload character images ───────────────────────────────────────────
    // Load one image per unique character needed (p1 and p2 may be same)
    const charNames = [COLOR_TO_CHAR[p1Color], COLOR_TO_CHAR[p2Color]];
    const uniqueNames = Array.from(new Set(charNames));
    const charImages: Record<string, HTMLImageElement> = {};
    let loadedCount = 0;
    let started = false;

    function tryStart() {
      loadedCount++;
      if (loadedCount >= uniqueNames.length && !started) {
        started = true;
        startAnimation();
      }
    }

    for (const name of uniqueNames) {
      const img = new window.Image();
      img.onload = tryStart;
      img.onerror = tryStart; // degrade gracefully if SVG fails
      img.src = svgToDataUrl(name);
      charImages[name] = img;
    }

    // ── State ────────────────────────────────────────────────────────────────

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
    let attackAnimDone = 0;

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
      let charY = f.y;
      const charName = COLOR_TO_CHAR[f.color];
      const img = charImages[charName];

      // Idle bob
      if (f.state === "idle") {
        const elapsed = now - f.stateStart;
        charY += Math.sin((elapsed / 1000) * Math.PI * 2) * 2;
      }

      ctx.save();
      ctx.globalAlpha = f.state === "death" ? f.deathOpacity : 1;

      if (f.state === "death") {
        const pivotX = cx;
        const pivotY = FLOOR_Y;
        ctx.translate(pivotX, pivotY);
        const dir = f.side === "p1" ? -1 : 1;
        ctx.rotate(f.deathAngle * dir);
        ctx.translate(-pivotX, -pivotY);
      }

      // Hit flash: white overlay drawn before character
      if (f.state === "hit") {
        const elapsed = now - f.stateStart;
        if (elapsed < HIT_FLASH_MS) {
          ctx.fillStyle = "rgba(255,255,255,0.85)";
          ctx.fillRect(cx - CHAR_W / 2, charY, CHAR_W, CHAR_H);
          ctx.restore();
          return;
        }
      }

      // Draw SVG character sprite
      if (img && img.complete && img.naturalWidth > 0) {
        if (f.side === "p2") {
          // Flip horizontally around the center x of the character
          ctx.translate(cx + CHAR_W / 2, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(img, 0, charY, CHAR_W, CHAR_H);
        } else {
          ctx.drawImage(img, cx - CHAR_W / 2, charY, CHAR_W, CHAR_H);
        }
      } else {
        // Fallback: simple colored rectangle if image not ready
        const fallbackColors: Record<FighterColor, string> = {
          red: "#c47070",
          blue: "#6090c8",
          gold: "#b8860b",
        };
        ctx.fillStyle = fallbackColors[f.color];
        ctx.fillRect(cx - CHAR_W / 2, charY, CHAR_W, CHAR_H);
      }

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
            // flash — no movement
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
          // bob handled in draw
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
            triggerHit(defender, performance.now());
            spawnSlash(attacker, defender, entry.isCrit, entry.isCombo && entry.comboStep >= 2, performance.now());
            spawnDamageNum(defender, entry.damage, entry.isCrit, performance.now());
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
