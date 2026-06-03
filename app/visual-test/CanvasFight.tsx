"use client";

// ─── CanvasFight — Street Fighter-style canvas renderer ──────────────────────
// Plays back a FightResult as a side-view arena animation.
// No Phaser, no game libraries — vanilla JS canvas inside a React component.
// Dynamically imported (ssr: false) from visual-test/page.tsx.

import { useEffect, useRef } from "react";
import type { FightResult, RoundLog } from "@/lib/fight-engine";

export type FighterColor = "red" | "blue" | "gold";

interface CanvasFightProps {
  result: FightResult;
  p1Color: FighterColor;
  p2Color: FighterColor;
  onDone: () => void;
}

// ── Color palettes ────────────────────────────────────────────────────────────

const COLOR_MAP: Record<FighterColor, { body: string; head: string }> = {
  red:  { body: "#c47070", head: "#e8a0a0" },
  blue: { body: "#6090c8", head: "#90b8e8" },
  gold: { body: "#b8860b", head: "#d4a853" },
};

// ── Constants ─────────────────────────────────────────────────────────────────

const W = 480;
const H = 240;
const FLOOR_Y = 180;
const BODY_W = 32;
const BODY_H = 64;
const HEAD_W = 20;
const HEAD_H = 20;
const FIGHT_GAP = 100; // center-to-center distance when fighters are "in range"
const HP_BAR_W = 180;
const HP_BAR_H = 12;
const HP_BAR_Y = 16;

// Timings (ms)
const INTRO_DURATION = 800;
const ATTACK_LUNGE_MS = 80;
const ATTACK_RETRACT_MS = 80;
const HIT_FLASH_MS = 100;
const HIT_KNOCKBACK_MS = 80;
const NORMAL_GAP_MS = 140;  // pause after attack+hit completes (normal hit)
const COMBO_GAP_MS = 20;    // ultra-short pause for combo continuation
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
  // Visual position (center-x of body, top-y of body)
  x: number;
  baseX: number;
  y: number; // body top y — always FLOOR_Y - BODY_H
  // State
  state: FighterState;
  stateStart: number;
  // For attack: direction (+1 = right, -1 = left)
  attackDir: number;
  lungeOffset: number; // current lunge offset
  // For hit: knockback offset
  knockOffset: number;
  knockDir: number;
  // For death: angle and opacity
  deathAngle: number;
  deathOpacity: number;
  // HP display
  hpTarget: number;
  hpDisplay: number;
  // Color
  color: FighterColor;
  // Which side
  side: "p1" | "p2";
  // Alive
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
    // Alias as non-null for use in closures — null already checked above
    const ctx: CanvasRenderingContext2D = ctxOrNull;

    doneCalledRef.current = false;

    // ── State ────────────────────────────────────────────────────────────────

    const p1: Fighter = {
      x: 80,
      baseX: 80,
      y: FLOOR_Y - BODY_H,
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
      y: FLOOR_Y - BODY_H,
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

    // Fight playback queue
    const log = result.log;
    let logIdx = 0;
    let hitDisplayIdx = 0; // for "HIT X/Y" counter

    // Phase: "intro" | "fight" | "death" | "done"
    type Phase = "intro" | "fight" | "waiting" | "death" | "done";
    let phase: Phase = "intro";
    let phaseStart = 0;

    // For fight phase: next-hit scheduled time
    let nextHitAt = 0;
    let currentEntry: RoundLog | null = null;
    let attackAnimDone = 0; // when the current attack animation ends

    // Crowd dots (pre-generated)
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
      const ix = fightX(defender);
      const iy = FLOOR_Y - 32;
      vfxList.push({
        x: ix,
        y: iy,
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
      const iy = FLOOR_Y - 50;
      damageNums.push({
        x: ix,
        y: iy,
        startY: iy,
        born: now,
        text: isCrit ? `+${damage} CRIT` : `+${damage}`,
        isCrit,
      });
    }

    function triggerHit(defender: Fighter, now: number) {
      defender.state = "hit";
      defender.stateStart = now;
      defender.knockDir = defender.side === "p1" ? -1 : 1;
    }

    // ── Draw functions ────────────────────────────────────────────────────────

    function drawArena(now: number) {
      // Background gradient
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, "#0d0b08");
      grad.addColorStop(1, "#1a1510");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // Crowd
      for (const dot of crowd) {
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2);
        ctx.fillStyle = dot.c;
        ctx.fill();
      }

      // Floor line
      ctx.fillStyle = "#2a2218";
      ctx.fillRect(0, FLOOR_Y, W, 2);
    }

    function drawFighter(f: Fighter, now: number) {
      const palette = COLOR_MAP[f.color];
      const cx = fightX(f); // center-x of body
      const bodyX = cx - BODY_W / 2;
      let bodyY = f.y;

      // Idle bob
      if (f.state === "idle") {
        const elapsed = now - f.stateStart;
        bodyY += Math.sin(elapsed / 1000 * Math.PI * 2) * 2;
      }

      ctx.save();
      ctx.globalAlpha = f.state === "death" ? f.deathOpacity : 1;

      if (f.state === "death") {
        // Rotate around bottom-center of body
        const pivotX = cx;
        const pivotY = FLOOR_Y;
        ctx.translate(pivotX, pivotY);
        const dir = f.side === "p1" ? -1 : 1;
        ctx.rotate(f.deathAngle * dir);
        ctx.translate(-pivotX, -pivotY);
      }

      const headX = cx - HEAD_W / 2;
      const headY = bodyY - HEAD_H;

      // Hit flash: white overlay
      if (f.state === "hit") {
        const elapsed = now - f.stateStart;
        if (elapsed < HIT_FLASH_MS) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(bodyX, headY, BODY_W, HEAD_H + BODY_H);
          ctx.restore();
          return;
        }
      }

      // Draw head
      ctx.fillStyle = palette.head;
      ctx.fillRect(headX, headY, HEAD_W, HEAD_H);

      // Draw body
      ctx.fillStyle = palette.body;
      ctx.fillRect(bodyX, bodyY, BODY_W, BODY_H);

      // Simple eye dots
      ctx.fillStyle = "#1a1208";
      if (f.side === "p1") {
        ctx.fillRect(headX + HEAD_W - 7, headY + 6, 3, 3);
      } else {
        ctx.fillRect(headX + 4, headY + 6, 3, 3);
      }

      ctx.restore();
    }

    function drawHpBars() {
      // P1 bar
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

      // P2 bar
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
          // Crit flash circle
          ctx.beginPath();
          ctx.arc(vfx.x, vfx.y, 20, 0, Math.PI * 2);
          ctx.fillStyle = "#ffd70020";
          ctx.fill();
        }

        // 3 base slash lines
        const angles = [0, Math.PI / 3, (2 * Math.PI) / 3];
        for (const angle of angles) {
          ctx.beginPath();
          ctx.moveTo(vfx.x - Math.cos(angle) * vfx.lineLen / 2, vfx.y - Math.sin(angle) * vfx.lineLen / 2);
          ctx.lineTo(vfx.x + Math.cos(angle) * vfx.lineLen / 2, vfx.y + Math.sin(angle) * vfx.lineLen / 2);
          ctx.strokeStyle = vfx.color;
          ctx.lineWidth = vfx.lineW;
          ctx.stroke();
        }

        // Combo burst: 4 extra short lines at 45-deg offsets
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
            // flash — no position change
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

      // HP lerp
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
        nextHitAt = now + INTRO_DURATION;
      }

      // ── Phase: intro ──────────────────────────────────────────────────────
      if (phase === "intro") {
        // Walk fighters toward each other until gap = FIGHT_GAP
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
          currentEntry = entry;

          const attacker = entry.attacker === "p1" ? p1 : p2;
          const defender = entry.attacker === "p1" ? p2 : p1;

          // Start attack animation
          attacker.state = "attack";
          attacker.stateStart = now;

          // Hit + VFX fires at lunge peak (ATTACK_LUNGE_MS in)
          const hitAt = now + ATTACK_LUNGE_MS;

          // Schedule hit
          setTimeout(() => {
            triggerHit(defender, performance.now());
            spawnSlash(attacker, defender, entry.isCrit, entry.isCombo && entry.comboStep >= 2, performance.now());
            spawnDamageNum(defender, entry.damage, entry.isCrit, performance.now());
            // Update HP targets
            p1.hpTarget = entry.hp1After;
            p2.hpTarget = entry.hp2After;

            // Check death
            if (entry.hp1After <= 0 && p1.alive) {
              p1.alive = false;
              setTimeout(() => {
                p1.state = "death";
                p1.stateStart = performance.now();
              }, HIT_FLASH_MS);
            }
            if (entry.hp2After <= 0 && p2.alive) {
              p2.alive = false;
              setTimeout(() => {
                p2.state = "death";
                p2.stateStart = performance.now();
              }, HIT_FLASH_MS);
            }
          }, ATTACK_LUNGE_MS);

          // Schedule next hit
          const isComboHit = entry.isCombo && entry.comboStep >= 2;
          const fullAttackMs = ATTACK_LUNGE_MS + ATTACK_RETRACT_MS;
          const gapAfter = isComboHit ? COMBO_GAP_MS : NORMAL_GAP_MS;

          if (entry.hp1After <= 0 || entry.hp2After <= 0) {
            // Death — schedule done after death animation
            nextHitAt = now + fullAttackMs + DEATH_MS + POST_DEATH_MS;
            phase = "death";
          } else {
            nextHitAt = now + fullAttackMs + gapAfter;
            phase = "fight";
          }
        } else if (logIdx >= log.length) {
          // All hits done, no death triggered (shouldn't happen normally)
          phase = "done";
        }

        // Update fighters
        updateFighter(p1, now, dt);
        updateFighter(p2, now, dt);
      }

      // ── Phase: death ──────────────────────────────────────────────────────
      if (phase === "death") {
        updateFighter(p1, now, dt);
        updateFighter(p2, now, dt);

        // Check if death animation is done
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
        // Final draw
        draw(now);
        onDone();
        return;
      }

      // ── Draw ──────────────────────────────────────────────────────────────
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

    rafId = requestAnimationFrame(tick);

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
