"use client";

// --- CanvasFight -- Street Fighter-style canvas renderer ---------------------
// Visual overhaul v1: cinematic timing, character visibility fix, screen shake,
// crit slow-motion, arena depth, dramatic death.
// Branch: visual-upgrade

import { useEffect, useRef } from "react";
import type { FightResult, RoundLog } from "@/lib/fight-engine";
import { useFightAudio } from "@/lib/useAudio";

export type FighterColor = "red" | "blue" | "gold";

interface CanvasFightProps {
  result: FightResult;
  p1Color: FighterColor;
  p2Color: FighterColor;
  onDone: () => void;
}

// -- Sprite sheet constants ---------------------------------------------------

const SPRITE_FRAME_W = 106;
const SPRITE_FRAMES  = 8;

// Art crop: actual gladiator art does not fill the full 1186px height.
// These values crop to only the visible art region.
const SPRITE_ART_Y = 200;
const SPRITE_ART_H = 750;

type AnimName = "idle" | "attack" | "hit" | "death";

function stateToAnim(state: FighterState): AnimName {
  if (state === "walk")   return "idle";
  if (state === "attack") return "attack";
  if (state === "hit")    return "hit";
  if (state === "death")  return "death";
  return "idle";
}

const COLOR_TO_FOLDER: Record<FighterColor, string> = {
  red:  "red",
  blue: "blue",
  gold: "blue",
};

const COLOR_TO_FILTER: Record<FighterColor, string | null> = {
  red:  null,
  blue: null,
  gold: "sepia(1) saturate(4) hue-rotate(10deg) brightness(1.1)",
};

const ANIM_FPS: Record<AnimName, number> = {
  idle:   8,
  attack: 16,
  hit:    16,
  death:  8,
};

const ANIM_LOOPS: Record<AnimName, boolean> = {
  idle:   true,
  attack: false,
  hit:    false,
  death:  false,
};

// -- Canvas dimensions --------------------------------------------------------

const W = 480;
const H = 320;
const FLOOR_Y = 258;

const CHAR_H = H * 0.58;
const CHAR_W = CHAR_H * 0.40;

const FIGHT_GAP = 140;
const HP_BAR_W = 180;
const HP_BAR_H = 12;
const HP_BAR_Y = 16;

// -- Timing constants ---------------------------------------------------------

const ATTACK_LUNGE_MS   = 120;
const ATTACK_RETRACT_MS = 100;
const HIT_FLASH_MS      = 180;
const HIT_KNOCKBACK_MS  = 140;
const NORMAL_GAP_MS     = 380;
const COMBO_GAP_MS      = 55;

const CRIT_LUNGE_MS     = 220;
const CRIT_RETRACT_MS   = 200;
const CRIT_FLASH_MS     = 350;
const CRIT_KNOCKBACK_MS = 220;
const CRIT_GAP_MS       = 600;

const DEATH_MS      = 1400;
const POST_DEATH_MS = 1800;

const SHAKE_MAG = 8;
const SHAKE_DUR = 320;

// -- VFX types ----------------------------------------------------------------

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
  duration: number;
  floatDist: number;
}

// -- Fighter state ------------------------------------------------------------

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
  isCritHit: boolean;
  attackLungeMs: number;
  attackRetractMs: number;
}

type SpriteKey = string;

// -- Main component -----------------------------------------------------------

export default function CanvasFight({ result, p1Color, p2Color, onDone }: CanvasFightProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const doneCalledRef = useRef(false);
  const audio = useFightAudio();

  useEffect(() => {
    audio?.unlockAndPlay();
  }, [audio?.unlockAndPlay]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctxOrNull = canvas.getContext("2d");
    if (!ctxOrNull) return;
    const ctx: CanvasRenderingContext2D = ctxOrNull;

    doneCalledRef.current = false;

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
        img.onerror = tryStart;
        img.src = `/characters/${folder}/${anim}.png`;
        spriteImages[key] = img;
      }
    }

    function getSpriteImage(color: FighterColor, anim: AnimName): HTMLImageElement | null {
      return spriteImages[`${COLOR_TO_FOLDER[color]}/${anim}`] ?? null;
    }

    function getFrameIndex(f: Fighter, now: number): number {
      const anim = stateToAnim(f.state);
      const fps = ANIM_FPS[anim];
      const loops = ANIM_LOOPS[anim];
      const elapsed = now - f.stateStart;
      const rawFrame = Math.floor(elapsed / (1000 / fps));
      return loops ? rawFrame % SPRITE_FRAMES : Math.min(rawFrame, SPRITE_FRAMES - 1);
    }

    const p1: Fighter = {
      x: 90, baseX: 90, y: FLOOR_Y - CHAR_H,
      state: "walk", stateStart: 0, attackDir: 1,
      lungeOffset: 0, knockOffset: 0, knockDir: -1,
      deathAngle: 0, deathOpacity: 1,
      hpTarget: 100, hpDisplay: 100,
      color: p1Color, side: "p1", alive: true,
      isCritHit: false,
      attackLungeMs: ATTACK_LUNGE_MS, attackRetractMs: ATTACK_RETRACT_MS,
    };

    const p2: Fighter = {
      x: 390, baseX: 390, y: FLOOR_Y - CHAR_H,
      state: "walk", stateStart: 0, attackDir: -1,
      lungeOffset: 0, knockOffset: 0, knockDir: 1,
      deathAngle: 0, deathOpacity: 1,
      hpTarget: 100, hpDisplay: 100,
      color: p2Color, side: "p2", alive: true,
      isCritHit: false,
      attackLungeMs: ATTACK_LUNGE_MS, attackRetractMs: ATTACK_RETRACT_MS,
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
    let shakeStart = 0;

    const crowd = Array.from({ length: 18 }, () => ({
      x: 30 + Math.random() * 420,
      y: 50 + Math.random() * 50,
      r: 2.5 + Math.random() * 3,
      c: `rgba(${60 + Math.floor(Math.random() * 30)},${40 + Math.floor(Math.random() * 15)},${30 + Math.floor(Math.random() * 10)},${(0.25 + Math.random() * 0.2).toFixed(2)})`,
    }));

    function fightX(f: Fighter): number {
      return f.x + f.lungeOffset + f.knockOffset;
    }

    function spawnSlash(_attacker: Fighter, defender: Fighter, isCrit: boolean, isCombo: boolean, now: number) {
      vfxList.push({
        x: fightX(defender),
        y: FLOOR_Y - CHAR_H * 0.60,
        born: now,
        duration: isCrit ? 450 : 200,
        lineLen: isCrit ? 65 : 32,
        lineW: isCrit ? 5 : 2.5,
        color: isCrit ? "#ffd700" : "#ffe080",
        isCombo, isCrit,
      });
    }

    function spawnDamageNum(defender: Fighter, damage: number, isCrit: boolean, now: number) {
      const ix = fightX(defender) + (Math.random() * 24 - 12);
      const iy = FLOOR_Y - CHAR_H * 0.80;
      damageNums.push({
        x: ix, y: iy, startY: iy, born: now,
        text: isCrit ? `CRIT! +${damage}` : `+${damage}`,
        isCrit,
        duration: isCrit ? 1200 : 800,
        floatDist: isCrit ? 65 : 40,
      });
    }

    function triggerHit(defender: Fighter, now: number, isCrit: boolean) {
      defender.state = "hit";
      defender.stateStart = now;
      defender.knockDir = defender.side === "p1" ? -1 : 1;
      defender.isCritHit = isCrit;
    }

    function drawArena(_now: number) {
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, "#0a0804");
      grad.addColorStop(0.6, "#120e08");
      grad.addColorStop(1, "#1e1810");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      const spotlight = ctx.createRadialGradient(W / 2, FLOOR_Y - 30, 0, W / 2, FLOOR_Y - 30, 140);
      spotlight.addColorStop(0, "rgba(255, 240, 180, 0.07)");
      spotlight.addColorStop(1, "rgba(255, 240, 180, 0)");
      ctx.fillStyle = spotlight;
      ctx.fillRect(0, 0, W, H);

      for (const dot of crowd) {
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2);
        ctx.fillStyle = dot.c;
        ctx.fill();
      }

      ctx.fillStyle = "#3a2e1e";
      ctx.fillRect(0, FLOOR_Y, W, 2);

      ctx.save();
      ctx.globalAlpha = 0.15;
      ctx.strokeStyle = "#4a3a28";
      ctx.lineWidth = 1;
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(0, FLOOR_Y + i * 9);
        ctx.lineTo(W, FLOOR_Y + i * 9);
        ctx.stroke();
      }
      ctx.restore();

      const vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.8);
      vignette.addColorStop(0, "rgba(0,0,0,0)");
      vignette.addColorStop(1, "rgba(0,0,0,0.45)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, W, H);
    }

    function drawFighter(f: Fighter, now: number) {
      const cx = fightX(f);
      const anim = stateToAnim(f.state);
      const frameIdx = getFrameIndex(f, now);
      const img = getSpriteImage(f.color, anim);
      const filter = COLOR_TO_FILTER[f.color];

      const destX = cx - CHAR_W / 2;
      const destY = FLOOR_Y - CHAR_H;
      const destW = CHAR_W;
      const destH = CHAR_H;

      const srcX = frameIdx * SPRITE_FRAME_W;
      const srcW = SPRITE_FRAME_W;
      const srcY = SPRITE_ART_Y;
      const srcH = SPRITE_ART_H;

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

      if (f.state === "hit") {
        const elapsed = now - f.stateStart;
        const flashDur = f.isCritHit ? CRIT_FLASH_MS : HIT_FLASH_MS;
        if (elapsed < flashDur) {
          ctx.fillStyle = f.isCritHit ? "rgba(255, 200, 50, 0.88)" : "rgba(255, 255, 255, 0.85)";
          ctx.fillRect(destX, destY, destW, destH);
          ctx.restore();
          return;
        }
      }

      if (filter) ctx.filter = filter;

      if (img && img.complete && img.naturalWidth > 0) {
        if (f.side === "p2") {
          ctx.translate(cx + CHAR_W / 2, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(img, srcX, srcY, srcW, srcH, -CHAR_W / 2, destY, destW, destH);
        } else {
          ctx.drawImage(img, srcX, srcY, srcW, srcH, destX, destY, destW, destH);
        }
      } else {
        if (filter) ctx.filter = "none";
        const fallback: Record<FighterColor, string> = { red: "#c47070", blue: "#6090c8", gold: "#b8860b" };
        ctx.fillStyle = fallback[f.color];
        ctx.fillRect(destX, destY + destH * 0.1, destW, destH * 0.9);
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
      const g1 = ctx.createLinearGradient(20, 0, 20 + HP_BAR_W, 0);
      g1.addColorStop(0, "#e05555"); g1.addColorStop(1, "#8b1a1a");
      ctx.fillStyle = g1;
      ctx.fillRect(20, HP_BAR_Y, hp1w, HP_BAR_H);

      ctx.fillStyle = "#e8dcc8";
      ctx.textAlign = "right";
      ctx.fillText("P2", 460, HP_BAR_Y - 3);
      ctx.fillStyle = "#1c1608";
      ctx.strokeStyle = "#2a2218";
      ctx.fillRect(280, HP_BAR_Y, HP_BAR_W, HP_BAR_H);
      ctx.strokeRect(280, HP_BAR_Y, HP_BAR_W, HP_BAR_H);
      const hp2w = Math.max(0, HP_BAR_W * p2.hpDisplay / 100);
      const g2 = ctx.createLinearGradient(280, 0, 280 + HP_BAR_W, 0);
      g2.addColorStop(0, "#60a0e8"); g2.addColorStop(1, "#1e3a8a");
      ctx.fillStyle = g2;
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
          ctx.arc(vfx.x, vfx.y, 30, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255, 215, 0, 0.12)";
          ctx.fill();
        }

        const primaryAngles = [0, Math.PI / 3, (2 * Math.PI) / 3];
        for (const angle of primaryAngles) {
          ctx.beginPath();
          ctx.moveTo(vfx.x - Math.cos(angle) * vfx.lineLen / 2, vfx.y - Math.sin(angle) * vfx.lineLen / 2);
          ctx.lineTo(vfx.x + Math.cos(angle) * vfx.lineLen / 2, vfx.y + Math.sin(angle) * vfx.lineLen / 2);
          ctx.strokeStyle = vfx.color;
          ctx.lineWidth = vfx.lineW;
          ctx.stroke();
        }

        if (vfx.isCrit) {
          const innerAngles = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4];
          ctx.globalAlpha = opacity * 0.65;
          for (const angle of innerAngles) {
            const len = vfx.lineLen * 0.55;
            ctx.beginPath();
            ctx.moveTo(vfx.x - Math.cos(angle) * len / 2, vfx.y - Math.sin(angle) * len / 2);
            ctx.lineTo(vfx.x + Math.cos(angle) * len / 2, vfx.y + Math.sin(angle) * len / 2);
            ctx.strokeStyle = "#ff8800";
            ctx.lineWidth = 2;
            ctx.stroke();
          }
          ctx.globalAlpha = opacity;
        }

        if (vfx.isCombo && !vfx.isCrit) {
          const comboAngles = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4];
          ctx.globalAlpha = opacity * 0.6;
          for (const angle of comboAngles) {
            ctx.beginPath();
            ctx.moveTo(vfx.x - Math.cos(angle) * 7, vfx.y - Math.sin(angle) * 7);
            ctx.lineTo(vfx.x + Math.cos(angle) * 7, vfx.y + Math.sin(angle) * 7);
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
        if (elapsed >= dn.duration) continue;
        const progress = elapsed / dn.duration;
        const currentY = dn.startY - dn.floatDist * progress;
        const fadeStart = dn.duration * 0.6;
        const opacity = elapsed > fadeStart ? 1 - (elapsed - fadeStart) / (dn.duration - fadeStart) : 1;

        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.textAlign = "center";

        if (dn.isCrit) {
          ctx.font = "bold 20px monospace";
          ctx.lineWidth = 3;
          ctx.strokeStyle = "rgba(0,0,0,0.8)";
          ctx.strokeText(dn.text, dn.x, currentY);
          ctx.fillStyle = "#ffd700";
        } else {
          ctx.font = "bold 14px monospace";
          ctx.fillStyle = "#ffffff";
        }

        ctx.fillText(dn.text, dn.x, currentY);
        ctx.restore();
      }
    }

    function drawHitCounter() {
      if (logIdx === 0) return;
      ctx.font = "9px monospace";
      ctx.fillStyle = "#4b3a28";
      ctx.textAlign = "center";
      ctx.fillText(`HIT ${hitDisplayIdx}/${log.length}`, W / 2, H - 8);
    }

    function updateFighter(f: Fighter, now: number, dt: number) {
      const elapsed = now - f.stateStart;

      switch (f.state) {
        case "walk": {
          const dir = f.side === "p1" ? 1 : -1;
          f.x += dir * 80 * (dt / 1000);
          break;
        }
        case "attack": {
          const half = f.attackLungeMs;
          const full = f.attackLungeMs + f.attackRetractMs;
          if (elapsed < half) {
            f.lungeOffset = f.attackDir * 22 * (elapsed / half);
          } else if (elapsed < full) {
            f.lungeOffset = f.attackDir * 22 * (1 - (elapsed - half) / f.attackRetractMs);
          } else {
            f.lungeOffset = 0;
            f.state = "idle";
            f.stateStart = now;
          }
          break;
        }
        case "hit": {
          const knockMs = f.isCritHit ? CRIT_KNOCKBACK_MS : HIT_KNOCKBACK_MS;
          const flashDur = f.isCritHit ? CRIT_FLASH_MS : HIT_FLASH_MS;
          const knockDuration = knockMs * 2;
          if (elapsed < flashDur) {
            // flash phase
          } else if (elapsed < flashDur + knockMs) {
            const t = (elapsed - flashDur) / knockMs;
            f.knockOffset = f.knockDir * 18 * t;
          } else if (elapsed < flashDur + knockDuration) {
            const t = (elapsed - flashDur - knockMs) / knockMs;
            f.knockOffset = f.knockDir * 18 * (1 - t);
          } else {
            f.knockOffset = 0;
            f.isCritHit = false;
            f.state = "idle";
            f.stateStart = now;
          }
          break;
        }
        case "death": {
          const t = Math.min(elapsed / DEATH_MS, 1);
          f.deathAngle = (Math.PI / 2) * t;
          f.deathOpacity = Math.max(0, 1 - t * 0.92);
          break;
        }
        case "idle": {
          break;
        }
      }

      f.hpDisplay += (f.hpTarget - f.hpDisplay) * 0.12;
    }

    let lastTime = 0;
    let rafId = 0;

    function tick(now: number) {
      const dt = lastTime === 0 ? 16 : now - lastTime;
      lastTime = now;

      if (phaseStart === 0) {
        phaseStart = now;
        nextHitAt = now + 900;
      }

      if (phase === "intro") {
        const gap = p2.x - p1.x;
        if (gap > FIGHT_GAP) {
          updateFighter(p1, now, dt);
          updateFighter(p2, now, dt);
        } else {
          p1.state = "idle"; p1.stateStart = now;
          p2.state = "idle"; p2.stateStart = now;
          phase = "fight";
          nextHitAt = now + 280;
        }
      }

      if (phase === "fight" || phase === "waiting") {
        if (now >= nextHitAt && logIdx < log.length) {
          const entry = log[logIdx];
          logIdx++;
          hitDisplayIdx = logIdx;

          const attacker = entry.attacker === "p1" ? p1 : p2;
          const defender = entry.attacker === "p1" ? p2 : p1;

          attacker.attackLungeMs   = entry.isCrit ? CRIT_LUNGE_MS   : ATTACK_LUNGE_MS;
          attacker.attackRetractMs = entry.isCrit ? CRIT_RETRACT_MS : ATTACK_RETRACT_MS;
          attacker.state = "attack";
          attacker.stateStart = now;

          const lungeSnapshot = attacker.attackLungeMs;

          setTimeout(() => {
            const perfNow = performance.now();
            triggerHit(defender, perfNow, entry.isCrit);
            spawnSlash(attacker, defender, entry.isCrit, entry.isCombo && entry.comboStep >= 2, perfNow);
            spawnDamageNum(defender, entry.damage, entry.isCrit, perfNow);
            p1.hpTarget = entry.hp1After;
            p2.hpTarget = entry.hp2After;

            if (entry.isCrit) shakeStart = perfNow;

            if (entry.isCrit) audio?.playSfx("crit");
            audio?.playSfx("hit");

            if (entry.hp1After <= 0 && p1.alive) {
              p1.alive = false;
              setTimeout(() => { p1.state = "death"; p1.stateStart = performance.now(); audio?.playSfx("death"); }, HIT_FLASH_MS);
            }
            if (entry.hp2After <= 0 && p2.alive) {
              p2.alive = false;
              setTimeout(() => { p2.state = "death"; p2.stateStart = performance.now(); audio?.playSfx("death"); }, HIT_FLASH_MS);
            }
          }, lungeSnapshot);

          const isComboHit = entry.isCombo && entry.comboStep >= 2;
          const fullAttackMs = attacker.attackLungeMs + attacker.attackRetractMs;
          const gapAfter = entry.isCrit ? CRIT_GAP_MS : (isComboHit ? COMBO_GAP_MS : NORMAL_GAP_MS);

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

      if (phase === "death") {
        updateFighter(p1, now, dt);
        updateFighter(p2, now, dt);

        const deadFighter = !p1.alive ? p1 : p2;
        const deathElapsed = now - deadFighter.stateStart;
        if (deadFighter.state === "death" && deathElapsed > DEATH_MS + POST_DEATH_MS) {
          phase = "done";
        }
      }

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
      ctx.save();

      const shakeT = shakeStart > 0 ? Math.max(0, 1 - (now - shakeStart) / SHAKE_DUR) : 0;
      if (shakeT > 0) {
        const sx = shakeT * SHAKE_MAG * (Math.random() * 2 - 1);
        const sy = shakeT * SHAKE_MAG * (Math.random() * 2 - 1);
        ctx.translate(sx, sy);
      }

      ctx.clearRect(-SHAKE_MAG, -SHAKE_MAG, W + SHAKE_MAG * 2, H + SHAKE_MAG * 2);
      drawArena(now);
      drawHpBars();
      drawVFX(now);
      drawFighter(p1, now);
      drawFighter(p2, now);
      drawDamageNums(now);
      drawHitCounter();

      ctx.restore();
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
