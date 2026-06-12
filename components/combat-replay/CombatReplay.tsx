"use client";

// ─── CombatReplay — GLADAITORS cinematic fight playback ──────────────────────
// Street Fighter-style side-view replay of a pre-computed fight on a 2D canvas.
// Client-only (no SSR), vanilla canvas, no Phaser. All art is procedural pixel
// art baked at mount (see ./sprites.ts) — no image assets.
//
// Consumes the fight engine event log as-is (FightResult / RoundLog). Never
// re-derives fight outcomes; never surfaces round counts.
//
// Cinematic systems:
//   • simTime + timeScale clock → hit-stop (freeze) and kill-cam slow-mo
//   • camera with zoom/focus for the killing blow
//   • bounded particle pool, pre-baked background/vignette/floor-glow
//     (no per-frame gradient allocation — mobile webview friendly)
//   • combo counter escalation 2×/3×/4×, crit flash + screen shake,
//     K.O. / DOUBLE K.O. beats, victory pose, draw handled as mutual kill.

import { useEffect, useRef, useState } from "react";
import type { FightResult, RoundLog } from "@/lib/fight-engine";
import { useFightAudio } from "@/lib/useAudio";
import {
  bakeSprites,
  CELL,
  ANCHOR_X,
  ANCHOR_Y,
  FRAME_COUNT,
  type AnimName,
  type FighterColor,
  type SpriteBank,
} from "./sprites";

export type { FighterColor };

export interface CombatReplayProps {
  result: FightResult;
  p1Color: FighterColor;
  p2Color: FighterColor;
  /** Farcaster usernames — rendered white above the HP bars */
  p1Name?: string;
  p2Name?: string;
  onDone: () => void;
}

// ── Identity accents (cosmetic only) ─────────────────────────────────────────

const IDENT: Record<FighterColor, { main: string; hot: string; deep: string }> = {
  red:  { main: "#ff7a1f", hot: "#ffc94d", deep: "#8b1a1a" },
  blue: { main: "#2ad8ff", hot: "#b8f4ff", deep: "#1e3a8a" },
  gold: { main: "#ffd24a", hot: "#ffe89a", deep: "#7a5a24" },
};

// ── Timing (ms, in simTime unless noted) ─────────────────────────────────────

const WINDUP_NORMAL = 240;
const WINDUP_CRIT   = 430;
const WINDUP_COMBO  = 60;
const RECOVER_MS    = 230;
const GAP_NORMAL    = 360;
const GAP_CRIT      = 680;
const GAP_COMBO     = 20;     // never scaled — the burst is the signature moment
const HIT_ANIM_MS   = 240;
const KNOCK_MS      = 260;
const DEATH_ANIM_MS = 1150;
const TARGET_FIGHT_MS = 26000; // long fights compress toward this
const MIN_PACE = 0.35;

// ── Internal types ────────────────────────────────────────────────────────────

interface FighterRT {
  side: "p1" | "p2";
  color: FighterColor;
  name: string;
  facing: 1 | -1;
  x: number;
  baseX: number;
  anim: AnimName;
  animStart: number;
  windup: number;
  lunge: number;
  knock: number;
  knockStart: number;
  knockDir: number;
  hpTarget: number;
  hpDisplay: number;
  hpChip: number;
  alive: boolean;
  emberAcc: number;
}

interface Ev {
  start: number;   // relative to fight start (sim ms)
  impact: number;
  entry: RoundLog;
  comboCont: boolean;
  lethal: boolean;
  isLast: boolean;
}

interface Spark { x: number; y: number; vx: number; vy: number; born: number; life: number; size: number; c: string; }
interface Slash { x: number; y: number; born: number; dur: number; r: number; c: string; crit: boolean; dir: number; }
interface Ring  { x: number; y: number; born: number; dur: number; rMax: number; c: string; }
interface DmgNum { x: number; y: number; born: number; dur: number; txt: string; crit: boolean; }
interface Flash { born: number; dur: number; c: string; peak: number; }

function buildSchedule(log: RoundLog[]): { evs: Ev[]; total: number } {
  // Dry pass at pace 1 to estimate, then compress gaps for long fights.
  function pass(pace: number): { evs: Ev[]; total: number } {
    const evs: Ev[] = [];
    let t = 0;
    for (let i = 0; i < log.length; i++) {
      const e = log[i];
      const comboCont = e.isCombo && e.comboStep >= 2;
      // combo continuation outranks crit: the 4x chain is crit-extended by the
      // engine, and the burst must stay a ~80ms drumroll, not 430ms telegraphs
      const windup = comboCont ? WINDUP_COMBO : e.isCrit ? WINDUP_CRIT : WINDUP_NORMAL;
      const lethal = e.hp1After <= 0 || e.hp2After <= 0 || i === log.length - 1;
      const impact = t + windup;
      evs.push({ start: t, impact, entry: e, comboCont, lethal: e.hp1After <= 0 || e.hp2After <= 0, isLast: i === log.length - 1 });
      const next = i + 1 < log.length ? log[i + 1] : null;
      const nextCont = !!next && next.isCombo && next.comboStep >= 2 && next.attacker === e.attacker;
      if (lethal) { t = impact; break; }
      if (nextCont) t = impact + GAP_COMBO;
      else t = impact + RECOVER_MS + (e.isCrit ? GAP_CRIT : GAP_NORMAL) * pace;
    }
    return { evs, total: t };
  }
  const dry = pass(1);
  const pace = Math.max(MIN_PACE, Math.min(1, TARGET_FIGHT_MS / Math.max(dry.total, 1)));
  return pace >= 1 ? dry : pass(pace);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CombatReplay({
  result,
  p1Color,
  p2Color,
  p1Name = "P1",
  p2Name = "P2",
  onDone,
}: CombatReplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const audio = useFightAudio();
  const audioRef = useRef(audio);
  audioRef.current = audio;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    audioRef.current?.unlockAndPlay();
  }, []);

  // Measure container once
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const w = Math.min(el.clientWidth || 390, 520);
    const h = Math.round(w * 0.86);
    setDims({ w, h });
  }, []);

  useEffect(() => {
    if (!dims) return;
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const canvas: HTMLCanvasElement = canvasEl;

    // ── Canvas + scale setup ─────────────────────────────────────────────────
    const W = dims.w;
    const H = dims.h;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = "100%";
    canvas.style.height = "auto";
    const ctx0 = canvas.getContext("2d");
    if (!ctx0) return;
    const ctx: CanvasRenderingContext2D = ctx0;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    const FLOOR_Y = Math.round(H * 0.80);
    const S = Math.max(2, Math.round((H * 0.46) / 46)); // integer sprite scale
    const ENGAGE_HALF = S * 23;

    const setBeat = (b: string) => { canvas.dataset.beat = b; };
    setBeat("intro");

    // ── Bake everything ──────────────────────────────────────────────────────
    const bank: SpriteBank = bakeSprites([p1Color, p2Color]);

    const tint = document.createElement("canvas");
    tint.width = CELL; tint.height = CELL;
    const tintG = tint.getContext("2d")!;

    const bg = bakeBackground(W, H, FLOOR_Y);
    const vig = bakeVignette(W, H);
    const floorGlow = bakeFloorGlow(W, H, FLOOR_Y);

    // crowd twinkles — little screens/eyes in the dark stands
    const twinkleColors = ["#ffd24a", "#2ad8ff", "#ff7a5a", "#e8dcc8", "#b48aff"];
    const twinkles = Array.from({ length: 72 }, () => ({
      x: 8 + Math.random() * (W - 16),
      y: H * 0.13 + Math.random() * H * 0.34,
      phase: Math.random() * Math.PI * 2,
      speed: 0.0012 + Math.random() * 0.0035,
      c: twinkleColors[Math.floor(Math.random() * twinkleColors.length)],
      s: Math.random() < 0.25 ? 2 : 1,
    }));

    // drifting haze motes
    const motes = Array.from({ length: 22 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vy: 4 + Math.random() * 9,
      a: 0.03 + Math.random() * 0.07,
      s: 1 + Math.random() * 2,
    }));

    // HP bar gradients — baked once
    const HP_W = Math.round(W * 0.42);
    const HP_H = 9;
    const HP_Y = 30;
    const hpGrad = (color: FighterColor, x: number) => {
      const g = ctx.createLinearGradient(x, 0, x + HP_W, 0);
      g.addColorStop(0, IDENT[color].main);
      g.addColorStop(1, IDENT[color].deep);
      return g;
    };
    const hpGrad1 = hpGrad(p1Color, 10);
    const hpGrad2 = hpGrad(p2Color, W - 10 - HP_W);

    // ── Fighters ─────────────────────────────────────────────────────────────
    const mkFighter = (side: "p1" | "p2", color: FighterColor, name: string): FighterRT => ({
      side, color, name,
      facing: side === "p1" ? 1 : -1,
      x: side === "p1" ? -S * 14 : W + S * 14,
      baseX: side === "p1" ? W / 2 - ENGAGE_HALF : W / 2 + ENGAGE_HALF,
      anim: "walk", animStart: 0, windup: 0,
      lunge: 0, knock: 0, knockStart: 0, knockDir: 0,
      hpTarget: 100, hpDisplay: 100, hpChip: 100,
      alive: true, emberAcc: 0,
    });
    const f1 = mkFighter("p1", p1Color, p1Name);
    const f2 = mkFighter("p2", p2Color, p2Name);

    // ── Schedule + state ─────────────────────────────────────────────────────
    const { evs } = buildSchedule(result.log);
    let evIdx = 0;
    type Phase = "intro" | "vs" | "fightText" | "fight" | "end";
    let phase: Phase = "intro";
    let fightZero = 0;
    let vsAt = 0;
    let fightTextAt = 0;

    let sim = 0;
    let lastReal = 0;
    let freezeUntilReal = 0;
    let slowUntilReal = 0;
    let shake = 0;          // 0..~2 magnitude factor
    let hype = 0.15;        // crowd excitement
    let flare = 0;          // floor glow flare
    const cam = { zoom: 1, fx: W / 2, fy: H / 2, tz: 1, tfx: W / 2, tfy: H / 2 };

    const pendings: { at: number; fn: () => void }[] = [];
    const sparks: Spark[] = [];           // ring buffer, capped
    const MAX_SPARKS = 220;
    let sparkIdx = 0;
    const slashes: Slash[] = [];
    const rings: Ring[] = [];
    const dmgNums: DmgNum[] = [];
    const flashes: Flash[] = [];
    const ghosts: { x: number; facing: number; cell: HTMLCanvasElement; born: number }[] = [];

    let combo: { step: number; at: number } | null = null;
    let koText: { txt: string; at: number } | null = null;
    let card: { title: string; sub: string; color: string; at: number } | null = null;
    let doneCalled = false;

    const isDraw = result.winner === "draw";

    function schedule(at: number, fn: () => void) { pendings.push({ at, fn }); }

    function spawnSpark(x: number, y: number, c: string, speed: number) {
      const a = -Math.PI * (0.15 + Math.random() * 0.7);
      const sp: Spark = {
        x, y,
        vx: Math.cos(a) * speed * (Math.random() < 0.5 ? -1 : 1),
        vy: Math.sin(a) * speed,
        born: sim, life: 280 + Math.random() * 420,
        size: Math.random() < 0.3 ? S : Math.max(1, S - 1),
        c,
      };
      if (sparks.length < MAX_SPARKS) sparks.push(sp);
      else { sparks[sparkIdx] = sp; sparkIdx = (sparkIdx + 1) % MAX_SPARKS; }
    }

    function burst(x: number, y: number, color: FighterColor, n: number, speed: number) {
      const id = IDENT[color];
      for (let i = 0; i < n; i++) {
        const c = i % 3 === 0 ? "#ffffff" : i % 3 === 1 ? id.main : id.hot;
        spawnSpark(x, y, c, speed * (0.5 + Math.random()));
      }
    }

    // ── Impact handler ───────────────────────────────────────────────────────
    function doImpact(ev: Ev) {
      const e = ev.entry;
      const atk = e.attacker === "p1" ? f1 : f2;
      const def = e.attacker === "p1" ? f2 : f1;
      const realNow = performance.now();

      const mutual = (e.hp1After <= 0 && e.hp2After <= 0) || (ev.isLast && isDraw);
      const lethal = e.hp1After <= 0 || e.hp2After <= 0 || mutual;

      // defender reaction
      def.anim = "hit";
      def.animStart = sim;
      def.knockStart = sim;
      def.knockDir = e.attacker === "p1" ? 1 : -1;

      f1.hpTarget = mutual ? 0 : e.hp1After;
      f2.hpTarget = mutual ? 0 : e.hp2After;

      const hitX = def.x + def.knock;
      const chestY = FLOOR_Y - 26 * S;
      slashes.push({
        x: hitX, y: chestY, born: sim,
        dur: e.isCrit ? 280 : 170,
        r: (e.isCrit ? 13 : 8) * S,
        c: IDENT[atk.color].main,
        crit: e.isCrit,
        dir: e.attacker === "p1" ? 1 : -1,
      });
      burst(hitX, chestY, atk.color, e.isCrit ? 18 : 8, e.isCrit ? 260 : 160);
      dmgNums.push({
        x: hitX, y: FLOOR_Y - 49 * S, born: sim,
        dur: e.isCrit ? 1000 : 750,
        txt: `-${e.damage}`,
        crit: e.isCrit,
      });

      audioRef.current?.playSfx("hit");

      if (e.isCombo && e.comboStep >= 2) {
        combo = { step: Math.min(e.comboStep, 4), at: sim };
        setBeat(`combo${Math.min(e.comboStep, 4)}`);
        hype = Math.min(1, hype + 0.18);
        if (combo.step >= 4) shake = Math.max(shake, 0.8);
      }

      if (e.isCrit) {
        audioRef.current?.playSfx("crit");
        freezeUntilReal = realNow + 90;
        shake = Math.max(shake, 1.0);
        flashes.push({ born: sim, dur: 160, c: "#ffd24a", peak: 0.16 });
        rings.push({ x: hitX, y: chestY, born: sim, dur: 320, rMax: 22 * S, c: IDENT[atk.color].hot });
        flare = Math.max(flare, 0.8);
        hype = Math.min(1, hype + 0.35);
        // combo-continuation crits keep their combo beat (the 4x crit-extend
        // is tagged combo4, not crit — the combo burst is the headline moment)
        if (!lethal && !(e.isCombo && e.comboStep >= 2)) setBeat("crit");
      }

      if (lethal) {
        phase = "end";
        const killAt = sim;
        freezeUntilReal = realNow + 170;
        slowUntilReal = realNow + 950;
        shake = 1.8;
        flashes.push({ born: sim, dur: 230, c: "#ffffff", peak: 0.5 });
        rings.push({ x: hitX, y: chestY, born: sim, dur: 460, rMax: 34 * S, c: "#ffffff" });
        burst(hitX, chestY, atk.color, 26, 320);
        flare = 1;
        hype = 1;

        const dying: FighterRT[] = mutual ? [f1, f2] : e.hp1After <= 0 ? [f1] : [f2];
        const winner: FighterRT | null = mutual ? null : e.hp1After <= 0 ? f2 : f1;

        // kill-cam: zoom onto the dying fighter
        cam.tz = 1.32;
        cam.tfx = (dying[0].x + (mutual ? dying[1].x : atk.x)) / 2;
        cam.tfy = FLOOR_Y - 22 * S;

        schedule(killAt + 200, () => {
          koText = { txt: mutual ? "DOUBLE K.O." : "K.O.", at: sim };
          setBeat(mutual ? "double-ko" : "ko");
        });
        schedule(killAt + 250, () => {
          for (const d of dying) {
            d.alive = false;
            d.anim = "death";
            d.animStart = sim;
          }
          audioRef.current?.playSfx("death");
        });
        schedule(killAt + 1250, () => { cam.tz = 1; cam.tfx = W / 2; cam.tfy = H / 2; });
        schedule(killAt + 1550, () => {
          if (winner) {
            winner.anim = "victory";
            winner.animStart = sim;
            audioRef.current?.playSfx("victory");
            setBeat("victory");
          }
        });
        schedule(killAt + 1800, () => {
          if (mutual) {
            card = { title: "DRAW", sub: "DOUBLE K.O. — BOTH GLADAITORS FALL", color: "#e8dcc8", at: sim };
            setBeat("draw-card");
          } else if (winner) {
            card = {
              title: `${winner.name.toUpperCase()} WINS`,
              sub: "GLORY IN THE ARENA",
              color: IDENT[winner.color].hot,
              at: sim,
            };
          }
        });
        schedule(killAt + 4400, () => {
          if (!doneCalled) {
            doneCalled = true;
            setBeat("done");
            onDoneRef.current();
          }
        });
      }
    }

    // ── Fighter update ───────────────────────────────────────────────────────
    function updateFighter(f: FighterRT, dt: number) {
      const t = sim - f.animStart;

      if (f.anim === "attack") {
        const total = f.windup + RECOVER_MS;
        if (t < f.windup) {
          f.lunge = -2 * S * (t / f.windup) * f.facing * -1; // pull back
          f.lunge = -(2 * S) * (t / f.windup) * f.facing;
        } else if (t < total) {
          const tt = (t - f.windup) / RECOVER_MS;
          f.lunge = 5 * S * (1 - tt) * f.facing;
        } else {
          f.lunge = 0;
          if (f.alive) { f.anim = "idle"; f.animStart = sim; }
        }
      } else {
        f.lunge = 0;
      }

      if (f.anim === "hit" && t > HIT_ANIM_MS && f.alive) {
        f.anim = "idle";
        f.animStart = sim;
      }

      if (f.knockStart > 0) {
        const kt = (sim - f.knockStart) / KNOCK_MS;
        if (kt >= 1) { f.knock = 0; f.knockStart = 0; }
        else f.knock = f.knockDir * 4 * S * Math.sin(Math.min(kt, 1) * Math.PI);
      }

      // HP easing — fast bar + slow white chip (classic fighting-game drain)
      f.hpDisplay += (f.hpTarget - f.hpDisplay) * Math.min(1, dt * 0.012);
      if (f.hpChip > f.hpDisplay) f.hpChip += (f.hpDisplay - f.hpChip) * Math.min(1, dt * 0.004);
      else f.hpChip = f.hpDisplay;

      // RED ambient: embers rising from the plate seams
      if (f.color === "red" && f.alive) {
        f.emberAcc += dt;
        if (f.emberAcc > 300) {
          f.emberAcc = 0;
          const sp: Spark = {
            x: f.x + (Math.random() * 14 - 7) * S * 0.4,
            y: FLOOR_Y - (20 + Math.random() * 20) * S * 0.8,
            vx: (Math.random() - 0.5) * 8,
            vy: -14 - Math.random() * 18,
            born: sim, life: 700 + Math.random() * 500,
            size: 1, c: Math.random() < 0.5 ? "#ff7a1f" : "#ffc94d",
          };
          if (sparks.length < MAX_SPARKS) sparks.push(sp);
        }
      }
    }

    function frameOf(f: FighterRT): number {
      const t = sim - f.animStart;
      const n = FRAME_COUNT[f.anim];
      switch (f.anim) {
        case "attack": {
          if (t < f.windup) return t / f.windup < 0.5 ? 0 : 1;
          return Math.min(5, 2 + Math.floor(((t - f.windup) / RECOVER_MS) * 4));
        }
        case "hit": return t < HIT_ANIM_MS * 0.5 ? 0 : 1;
        case "death": return Math.min(n - 1, Math.floor((t / DEATH_ANIM_MS) * n));
        case "victory": return Math.floor(t / 150) % n;
        case "walk": return Math.floor(t / 130) % n;
        default: return Math.floor(t / 210) % n;
      }
    }

    // ── Drawing ──────────────────────────────────────────────────────────────
    function blitFighter(f: FighterRT, realNow: number) {
      const cell = bank[`${f.color}/${f.anim}`][frameOf(f)];
      const x = Math.round(f.x + f.lunge + f.knock);

      // ground shadow
      if (f.anim !== "death" || frameOf(f) < 3) {
        ctx.save();
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = "#000000";
        ctx.beginPath();
        ctx.ellipse(x, FLOOR_Y + 2, 11 * S, 2.4 * S * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // BLUE ambient: afterimage ghosts while striking
      if (f.color === "blue" && f.anim === "attack") {
        const t = sim - f.animStart;
        if (t >= f.windup && t < f.windup + 140) {
          ghosts.push({ x: x - f.facing * 6 * S * ((t - f.windup) / 140), facing: f.facing, cell, born: sim });
          if (ghosts.length > 6) ghosts.shift();
        }
      }

      ctx.save();
      ctx.translate(x, FLOOR_Y);
      if (f.facing < 0) ctx.scale(-1, 1);
      ctx.drawImage(cell, 0, 0, CELL, CELL, -ANCHOR_X * S, -ANCHOR_Y * S, CELL * S, CELL * S);

      // BLUE ambient: data-glitch slice every ~1.7s
      if (f.color === "blue" && f.alive && realNow % 1700 < 70) {
        const band = 16 + Math.floor((realNow % 13) * 2);
        ctx.globalAlpha = 0.7;
        ctx.drawImage(cell, 0, band, CELL, 5, -ANCHOR_X * S + 2 * S, (-ANCHOR_Y + band) * S, CELL * S, 5 * S);
        ctx.globalAlpha = 1;
      }
      ctx.restore();

      // hit flash — white silhouette overlay via shared tint canvas
      if (f.anim === "hit" || (f.anim === "death" && sim - f.animStart < 160)) {
        const ft = sim - f.animStart;
        const dur = 150;
        if (ft < dur) {
          tintG.globalCompositeOperation = "source-over";
          tintG.clearRect(0, 0, CELL, CELL);
          tintG.drawImage(cell, 0, 0);
          tintG.globalCompositeOperation = "source-in";
          tintG.fillStyle = "#ffffff";
          tintG.fillRect(0, 0, CELL, CELL);
          ctx.save();
          ctx.globalAlpha = 0.85 * (1 - ft / dur);
          ctx.translate(x, FLOOR_Y);
          if (f.facing < 0) ctx.scale(-1, 1);
          ctx.drawImage(tint, 0, 0, CELL, CELL, -ANCHOR_X * S, -ANCHOR_Y * S, CELL * S, CELL * S);
          ctx.restore();
        }
      }

      // GOLD ambient: orbiting luck-runes
      if (f.color === "gold" && f.alive) {
        for (let i = 0; i < 3; i++) {
          const a = realNow / 650 + (i * Math.PI * 2) / 3;
          const rx = 13 * S, ry = 5 * S;
          const gx = x + Math.cos(a) * rx;
          const gy = FLOOR_Y - 24 * S + Math.sin(a) * ry;
          const bright = Math.sin(realNow / 180 + i * 2) > 0.6;
          ctx.fillStyle = bright ? "#ffffff" : "#ffe89a";
          ctx.globalAlpha = Math.sin(a) > 0 ? 0.9 : 0.35; // dimmer behind the body
          ctx.fillRect(gx - 1, gy, 2, 2);
          ctx.fillRect(gx, gy - 1, 2, 2);
          ctx.globalAlpha = 1;
        }
      }

      // dying core flicker
      if (f.anim === "death") {
        const dt2 = sim - f.animStart;
        if (dt2 > 300 && dt2 < DEATH_ANIM_MS && Math.random() < 0.25) {
          spawnSpark(x + (Math.random() - 0.5) * 10 * S, FLOOR_Y - Math.random() * 10 * S, IDENT[f.color].main, 60);
        }
      }
    }

    function drawHud(realNow: number) {
      // usernames — white, readable, never colored
      ctx.font = `800 ${Math.max(11, Math.round(W * 0.034))}px Arial, sans-serif`;
      ctx.textBaseline = "alphabetic";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0,0,0,0.75)";
      ctx.fillStyle = "#ffffff";
      const trunc = (s: string) => (s.length > 14 ? s.slice(0, 13) + "…" : s);
      ctx.textAlign = "left";
      ctx.strokeText(trunc(f1.name).toUpperCase(), 10, HP_Y - 7, HP_W);
      ctx.fillText(trunc(f1.name).toUpperCase(), 10, HP_Y - 7, HP_W);
      ctx.textAlign = "right";
      ctx.strokeText(trunc(f2.name).toUpperCase(), W - 10, HP_Y - 7, HP_W);
      ctx.fillText(trunc(f2.name).toUpperCase(), W - 10, HP_Y - 7, HP_W);

      // HP bars + white damage chip
      const drawBar = (x: number, f: FighterRT, grad: CanvasGradient, rightAnchored: boolean) => {
        ctx.fillStyle = "rgba(8,6,4,0.9)";
        ctx.fillRect(x - 1, HP_Y - 1, HP_W + 2, HP_H + 2);
        const wMain = Math.max(0, (HP_W * f.hpDisplay) / 100);
        const wChip = Math.max(0, (HP_W * f.hpChip) / 100);
        if (wChip > wMain) {
          ctx.fillStyle = "#f3e3bd";
          if (rightAnchored) ctx.fillRect(x + HP_W - wChip, HP_Y, wChip, HP_H);
          else ctx.fillRect(x, HP_Y, wChip, HP_H);
        }
        ctx.fillStyle = grad;
        if (rightAnchored) ctx.fillRect(x + HP_W - wMain, HP_Y, wMain, HP_H);
        else ctx.fillRect(x, HP_Y, wMain, HP_H);
        // low-HP pulse
        if (f.hpDisplay < 25 && f.alive) {
          ctx.globalAlpha = 0.25 + 0.2 * Math.sin(realNow / 110);
          ctx.fillStyle = "#ff3020";
          if (rightAnchored) ctx.fillRect(x + HP_W - wMain, HP_Y, wMain, HP_H);
          else ctx.fillRect(x, HP_Y, wMain, HP_H);
          ctx.globalAlpha = 1;
        }
        ctx.strokeStyle = "rgba(255,255,255,0.22)";
        ctx.lineWidth = 1;
        ctx.strokeRect(x - 0.5, HP_Y - 0.5, HP_W + 1, HP_H + 1);
      };
      drawBar(10, f1, hpGrad1, false);
      drawBar(W - 10 - HP_W, f2, hpGrad2, true);
    }

    function drawComboCounter() {
      if (!combo) return;
      const age = sim - combo.at;
      const dur = 850;
      if (age > dur) { combo = null; return; }
      const t = age / dur;
      const alpha = t < 0.08 ? t / 0.08 : t > 0.65 ? 1 - (t - 0.65) / 0.35 : 1;
      const punch = t < 0.1 ? 1.5 - 5 * t : 1;
      const colors = ["", "", "#ffd24a", "#ff8a2a", "#ff4020"];
      const c = colors[combo.step] || "#ff4020";
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(W / 2, H * 0.22);
      ctx.scale(punch, punch);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const fs = Math.round(W * (combo.step >= 4 ? 0.085 : 0.065));
      ctx.font = `900 ${fs}px Arial, sans-serif`;
      ctx.lineWidth = 5;
      ctx.strokeStyle = "rgba(0,0,0,0.85)";
      const txt = `${combo.step}× COMBO`;
      ctx.strokeText(txt, 0, 0);
      ctx.fillStyle = c;
      ctx.fillText(txt, 0, 0);
      // 4× — radiating burst lines
      if (combo.step >= 4 && t < 0.5) {
        ctx.strokeStyle = c;
        ctx.lineWidth = 2;
        ctx.globalAlpha = alpha * (1 - t * 2);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + 0.4;
          const r0 = fs * 1.1, r1 = fs * (1.5 + t);
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0 * 0.6);
          ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1 * 0.6);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    function drawVfx() {
      // slash arcs
      for (let i = slashes.length - 1; i >= 0; i--) {
        const s = slashes[i];
        const t = (sim - s.born) / s.dur;
        if (t >= 1) { slashes.splice(i, 1); continue; }
        const sweepFrom = s.dir > 0 ? -2.4 : Math.PI + 0.7;
        const sweep = 2.2 * s.dir;
        const a0 = sweepFrom + sweep * Math.max(0, t - 0.35);
        const a1 = sweepFrom + sweep * Math.min(1, t * 1.6);
        ctx.save();
        ctx.globalAlpha = 1 - t * t;
        ctx.lineCap = "round";
        ctx.strokeStyle = s.c;
        ctx.lineWidth = (s.crit ? 2.2 : 1.4) * S;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, Math.min(a0, a1), Math.max(a0, a1));
        ctx.stroke();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = (s.crit ? 1 : 0.6) * S;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, Math.min(a0, a1), Math.max(a0, a1));
        ctx.stroke();
        if (s.crit) {
          ctx.globalAlpha = (1 - t) * 0.5;
          ctx.strokeStyle = s.c;
          ctx.lineWidth = 0.8 * S;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r * 1.35, Math.min(a0, a1) - 0.2, Math.max(a0, a1) + 0.2);
          ctx.stroke();
        }
        ctx.restore();
      }

      // impact rings
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        const t = (sim - r.born) / r.dur;
        if (t >= 1) { rings.splice(i, 1); continue; }
        ctx.save();
        ctx.globalAlpha = (1 - t) * 0.8;
        ctx.strokeStyle = r.c;
        ctx.lineWidth = Math.max(1, (1 - t) * 3 * S * 0.6);
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.rMax * (0.2 + 0.8 * t), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // sparks
      for (let i = sparks.length - 1; i >= 0; i--) {
        const sp = sparks[i];
        const age = sim - sp.born;
        if (age > sp.life) { sparks.splice(i, 1); continue; }
        const t = age / sp.life;
        ctx.globalAlpha = 1 - t;
        ctx.fillStyle = sp.c;
        ctx.fillRect(sp.x, sp.y, sp.size, sp.size);
      }
      ctx.globalAlpha = 1;

      // blue afterimage ghosts
      for (let i = ghosts.length - 1; i >= 0; i--) {
        const gh = ghosts[i];
        const age = sim - gh.born;
        if (age > 220) { ghosts.splice(i, 1); continue; }
        ctx.save();
        ctx.globalAlpha = 0.22 * (1 - age / 220);
        ctx.translate(Math.round(gh.x), FLOOR_Y);
        if (gh.facing < 0) ctx.scale(-1, 1);
        ctx.drawImage(gh.cell, 0, 0, CELL, CELL, -ANCHOR_X * S, -ANCHOR_Y * S, CELL * S, CELL * S);
        ctx.restore();
      }
    }

    function drawDmgNums() {
      for (let i = dmgNums.length - 1; i >= 0; i--) {
        const d = dmgNums[i];
        const t = (sim - d.born) / d.dur;
        if (t >= 1) { dmgNums.splice(i, 1); continue; }
        const y = d.y - t * 9 * S;
        const alpha = t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        if (d.crit) {
          const pop = t < 0.12 ? 1.6 - 5 * t : 1;
          ctx.translate(d.x, y);
          ctx.scale(pop, pop);
          ctx.font = `900 ${Math.round(6.4 * S)}px Arial, sans-serif`;
          ctx.lineWidth = 4;
          ctx.strokeStyle = "rgba(0,0,0,0.85)";
          ctx.strokeText(d.txt, 0, 0);
          ctx.fillStyle = "#ffd24a";
          ctx.fillText(d.txt, 0, 0);
          ctx.font = `800 ${Math.round(2.6 * S)}px Arial, sans-serif`;
          ctx.lineWidth = 3;
          ctx.strokeText("CRITICAL", 0, -5 * S);
          ctx.fillStyle = "#ffe89a";
          ctx.fillText("CRITICAL", 0, -5 * S);
        } else {
          ctx.font = `800 ${Math.round(4 * S)}px Arial, sans-serif`;
          ctx.lineWidth = 3;
          ctx.strokeStyle = "rgba(0,0,0,0.8)";
          ctx.strokeText(d.txt, d.x, y);
          ctx.fillStyle = "#ffffff";
          ctx.fillText(d.txt, d.x, y);
        }
        ctx.restore();
      }
    }

    function drawCenterText(txt: string, sub: string | null, color: string, age: number, dur: number, slam: boolean) {
      if (age > dur) return;
      const t = age / dur;
      const alpha = t < 0.06 ? t / 0.06 : t > 0.8 ? 1 - (t - 0.8) / 0.2 : 1;
      const scale = slam && t < 0.12 ? 2.6 - 13.3 * t : 1;
      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.translate(W / 2, H * 0.42);
      ctx.scale(scale, scale);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const fs = Math.round(W * (txt.length > 8 ? 0.105 : 0.155));
      ctx.font = `900 ${fs}px Arial, sans-serif`;
      ctx.lineWidth = 7;
      ctx.strokeStyle = "rgba(0,0,0,0.9)";
      ctx.strokeText(txt, 0, 0);
      ctx.fillStyle = color;
      ctx.fillText(txt, 0, 0);
      if (sub) {
        ctx.font = `700 ${Math.round(W * 0.034)}px Arial, sans-serif`;
        ctx.lineWidth = 3;
        ctx.strokeText(sub, 0, fs * 0.75);
        ctx.fillStyle = "#e8dcc8";
        ctx.fillText(sub, 0, fs * 0.75);
      }
      ctx.restore();
    }

    function drawIntroCards() {
      if (phase === "vs") {
        const age = sim - vsAt;
        const t = Math.min(1, age / 250);
        ctx.save();
        ctx.fillStyle = `rgba(5,3,2,${0.4 * t})`;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = t;
        ctx.textBaseline = "middle";
        const fsN = Math.round(W * 0.052);
        ctx.font = `900 ${fsN}px Arial, sans-serif`;
        const slide = (1 - t) * 30;
        ctx.textAlign = "right";
        ctx.lineWidth = 4;
        ctx.strokeStyle = "rgba(0,0,0,0.9)";
        const n1 = f1.name.toUpperCase().slice(0, 12);
        const n2 = f2.name.toUpperCase().slice(0, 12);
        ctx.strokeText(n1, W * 0.40 - slide, H * 0.40);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(n1, W * 0.40 - slide, H * 0.40);
        ctx.textAlign = "left";
        ctx.strokeText(n2, W * 0.60 + slide, H * 0.50);
        ctx.fillText(n2, W * 0.60 + slide, H * 0.50);
        ctx.textAlign = "center";
        ctx.font = `900 ${Math.round(W * 0.075)}px Arial, sans-serif`;
        ctx.strokeText("VS", W / 2, H * 0.45);
        ctx.fillStyle = "#d4a853";
        ctx.fillText("VS", W / 2, H * 0.45);
        ctx.restore();
      }
      if (phase === "fightText" || (phase === "fight" && sim - fightTextAt < 520)) {
        drawCenterText("FIGHT", null, "#d4a853", sim - fightTextAt, 620, true);
      }
    }

    function drawEndTexts() {
      if (koText) {
        drawCenterText(koText.txt, null, "#ffffff", sim - koText.at, 1500, true);
      }
      if (card) {
        const age = sim - card.at;
        const t = Math.min(1, age / 350);
        ctx.save();
        ctx.fillStyle = `rgba(5,3,2,${0.55 * t})`;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = t;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const fs = Math.round(W * (card.title.length > 10 ? 0.072 : 0.12));
        ctx.font = `900 ${fs}px Arial, sans-serif`;
        ctx.lineWidth = 6;
        ctx.strokeStyle = "rgba(0,0,0,0.9)";
        ctx.strokeText(card.title, W / 2, H * 0.44, W * 0.92);
        ctx.fillStyle = card.color;
        ctx.fillText(card.title, W / 2, H * 0.44, W * 0.92);
        ctx.font = `700 ${Math.round(W * 0.032)}px Arial, sans-serif`;
        ctx.lineWidth = 3;
        ctx.strokeText(card.sub, W / 2, H * 0.44 + fs * 0.8, W * 0.94);
        ctx.fillStyle = "#e8dcc8";
        ctx.fillText(card.sub, W / 2, H * 0.44 + fs * 0.8, W * 0.94);
        ctx.restore();
      }
    }

    function drawFlashes() {
      for (let i = flashes.length - 1; i >= 0; i--) {
        const fl = flashes[i];
        const t = (sim - fl.born) / fl.dur;
        if (t >= 1) { flashes.splice(i, 1); continue; }
        ctx.save();
        ctx.globalAlpha = fl.peak * (t < 0.25 ? t / 0.25 : 1 - (t - 0.25) / 0.75);
        ctx.fillStyle = fl.c;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
    }

    // ── Main loop ────────────────────────────────────────────────────────────
    let rafId = 0;
    let fpsCount = 0;
    let fpsAt = 0;

    function tick(realNow: number) {
      const dtReal = lastReal === 0 ? 16 : Math.min(realNow - lastReal, 64);
      lastReal = realNow;

      const frozen = realNow < freezeUntilReal;
      const ts = frozen ? 0 : realNow < slowUntilReal ? 0.35 : 1;
      const dt = dtReal * ts;
      sim += dt;

      // pendings
      for (let i = pendings.length - 1; i >= 0; i--) {
        if (pendings[i].at <= sim) {
          const fn = pendings[i].fn;
          pendings.splice(i, 1);
          fn();
        }
      }

      // phase logic
      if (phase === "intro") {
        const speed = 0.072 * S; // px per ms
        if (f1.x < f1.baseX) f1.x = Math.min(f1.baseX, f1.x + speed * dtReal);
        if (f2.x > f2.baseX) f2.x = Math.max(f2.baseX, f2.x - speed * dtReal);
        if (f1.x >= f1.baseX && f2.x <= f2.baseX) {
          f1.anim = "idle"; f1.animStart = sim;
          f2.anim = "idle"; f2.animStart = sim;
          phase = "vs";
          vsAt = sim;
        }
      } else if (phase === "vs") {
        if (sim - vsAt > 1100) {
          phase = "fightText";
          fightTextAt = sim;
          audioRef.current?.playSfx("round_start");
        }
      } else if (phase === "fightText") {
        if (sim - fightTextAt > 620) {
          phase = "fight";
          fightZero = sim;
          setBeat("fight");
          if (evs.length === 0) {
            // degenerate: empty log
            phase = "end";
            schedule(sim + 400, () => {
              if (!doneCalled) { doneCalled = true; setBeat("done"); onDoneRef.current(); }
            });
          }
        }
      } else if (phase === "fight") {
        const ft = sim - fightZero;
        while (evIdx < evs.length && ft >= evs[evIdx].start) {
          const ev = evs[evIdx];
          evIdx++;
          const atk = ev.entry.attacker === "p1" ? f1 : f2;
          atk.anim = "attack";
          atk.animStart = fightZero + ev.start;
          atk.windup = ev.comboCont ? WINDUP_COMBO : ev.entry.isCrit ? WINDUP_CRIT : WINDUP_NORMAL;
          schedule(fightZero + ev.impact, () => doImpact(ev));
          if (phase !== "fight") break;
        }
      }

      // updates
      updateFighter(f1, dt);
      updateFighter(f2, dt);
      for (let i = sparks.length - 1; i >= 0; i--) {
        const sp = sparks[i];
        sp.x += (sp.vx * dt) / 1000;
        sp.y += (sp.vy * dt) / 1000;
        sp.vy += (520 * dt) / 1000;
      }
      shake = Math.max(0, shake - dtReal * 0.0035);
      hype = Math.max(0.15, hype - dtReal * 0.00012);
      flare = Math.max(0, flare - dtReal * 0.0014);
      const cl = Math.min(1, dtReal * 0.006);
      cam.zoom += (cam.tz - cam.zoom) * cl;
      cam.fx += (cam.tfx - cam.fx) * cl;
      cam.fy += (cam.tfy - cam.fy) * cl;

      // ── draw ──
      ctx.fillStyle = "#060503";
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      // camera
      ctx.translate(W / 2, H / 2);
      ctx.scale(cam.zoom, cam.zoom);
      ctx.translate(-cam.fx, -cam.fy);
      // shake
      if (shake > 0.01) {
        const m = shake * S * 1.1;
        ctx.translate((Math.random() * 2 - 1) * m, (Math.random() * 2 - 1) * m);
      }

      ctx.drawImage(bg, 0, 0);

      // crowd twinkles
      for (const tw of twinkles) {
        const a = (0.18 + 0.55 * hype) * (0.5 + 0.5 * Math.sin(realNow * tw.speed + tw.phase));
        if (a < 0.06) continue;
        ctx.globalAlpha = a;
        ctx.fillStyle = tw.c;
        ctx.fillRect(tw.x, tw.y, tw.s, tw.s);
      }
      ctx.globalAlpha = 1;

      // haze motes
      for (const mo of motes) {
        mo.y -= (mo.vy * dtReal) / 1000;
        if (mo.y < -4) { mo.y = H + 4; mo.x = Math.random() * W; }
        ctx.globalAlpha = mo.a * (0.7 + hype * 0.6);
        ctx.fillStyle = "#e8dcc8";
        ctx.fillRect(mo.x, mo.y, mo.s, mo.s);
      }
      ctx.globalAlpha = 1;

      // reactive floor glow
      if (flare > 0.02) {
        ctx.globalAlpha = Math.min(1, flare);
        ctx.drawImage(floorGlow, 0, FLOOR_Y - 30);
        ctx.globalAlpha = 1;
      }

      blitFighter(f1, realNow);
      blitFighter(f2, realNow);
      drawVfx();
      drawDmgNums();

      ctx.drawImage(vig, 0, 0);
      ctx.restore();

      // HUD + overlay texts (not camera-transformed)
      drawHud(realNow);
      drawComboCounter();
      drawIntroCards();
      drawEndTexts();
      drawFlashes();

      // fps debug
      fpsCount++;
      if (realNow - fpsAt > 500) {
        canvas.dataset.fps = String(Math.round((fpsCount * 1000) / (realNow - fpsAt)));
        fpsAt = realNow;
        fpsCount = 0;
      }

      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, p1Color, p2Color, p1Name, p2Name, dims]);

  return (
    <div ref={containerRef} style={{ width: "100%" }}>
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "auto",
          display: "block",
          borderRadius: "8px",
          border: "1px solid rgba(212,168,83,0.25)",
          background: "#060503",
          touchAction: "none",
        }}
      />
    </div>
  );
}

// ── Baked scenery ─────────────────────────────────────────────────────────────
// The digital coliseum: stone and circuitry, glowing crowd in the dark.
// All gradients live here, created exactly once.

function bakeBackground(W: number, H: number, FLOOR_Y: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d")!;

  // night sky over the arena
  const sky = g.createLinearGradient(0, 0, 0, FLOOR_Y);
  sky.addColorStop(0, "#050402");
  sky.addColorStop(0.7, "#0d0a06");
  sky.addColorStop(1, "#161009");
  g.fillStyle = sky;
  g.fillRect(0, 0, W, FLOOR_Y);

  // far wall masonry band
  g.fillStyle = "#130e08";
  g.fillRect(0, H * 0.10, W, FLOOR_Y - H * 0.10);

  // upper + lower crowd tiers (dark silhouettes — twinkles animate at runtime)
  const tier = (y0: number, y1: number) => {
    g.fillStyle = "#0b0805";
    g.fillRect(0, y0, W, y1 - y0);
    g.fillStyle = "#070503";
    for (let x = 0; x < W; x += 7) {
      const r = 2 + ((x * 7919) % 4);
      g.beginPath();
      g.arc(x + 3, y1 - r, r + 1.5, Math.PI, 0);
      g.fill();
    }
    // ledge under the tier
    g.fillStyle = "#1d150c";
    g.fillRect(0, y1, W, 4);
    g.fillStyle = "rgba(255,230,180,0.07)";
    g.fillRect(0, y1, W, 1);
  };
  tier(H * 0.12, H * 0.30);
  tier(H * 0.34, H * 0.50);

  // holo banners hanging between tiers
  const banner = (x: number, hue: string, glyph: string) => {
    g.fillStyle = hue;
    g.globalAlpha = 0.5;
    g.fillRect(x, H * 0.30, W * 0.045, H * 0.17);
    g.globalAlpha = 0.9;
    g.fillStyle = glyph;
    const bw = W * 0.045;
    for (let i = 0; i < 3; i++) {
      g.fillRect(x + bw * 0.3, H * (0.33 + i * 0.045), bw * 0.4, 2);
    }
    g.globalAlpha = 1;
  };
  banner(W * 0.16, "#3a0d0d", "#8b1a1a");
  banner(W * 0.79, "#2a2010", "#d4a853");

  // arch row at the base of the wall — dark doorways with a faint inner glow
  const archTop = H * 0.54;
  const archBottom = FLOOR_Y;
  const archH = archBottom - archTop;
  const nArch = 5;
  for (let i = 0; i < nArch; i++) {
    const ax = (W / nArch) * i + W / nArch / 2;
    const aw = (W / nArch) * 0.52;
    // glow inside the arch
    g.fillStyle = "rgba(212,168,83,0.05)";
    g.fillRect(ax - aw / 2, archTop + archH * 0.25, aw, archH * 0.75);
    // opening
    g.fillStyle = "#040302";
    g.beginPath();
    g.moveTo(ax - aw / 2, archBottom);
    g.lineTo(ax - aw / 2, archTop + aw / 2);
    g.arc(ax, archTop + aw / 2, aw / 2, Math.PI, 0);
    g.lineTo(ax + aw / 2, archBottom);
    g.closePath();
    g.fill();
    // circuit seam rising beside each arch
    g.strokeStyle = "rgba(212,168,83,0.13)";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(ax + aw * 0.72, archBottom);
    g.lineTo(ax + aw * 0.72, archTop + archH * 0.3);
    g.lineTo(ax + aw * 0.85, archTop + archH * 0.18);
    g.stroke();
    g.fillStyle = "rgba(255,210,74,0.35)";
    g.fillRect(ax + aw * 0.85 - 1, archTop + archH * 0.18 - 1, 2, 2);
  }

  // framing columns, left and right edge
  for (const cx of [0, W - W * 0.05]) {
    g.fillStyle = "#080503";
    g.fillRect(cx, 0, W * 0.05, FLOOR_Y);
    g.fillStyle = "rgba(255,230,180,0.05)";
    g.fillRect(cx + (cx === 0 ? W * 0.05 - 2 : 0), 0, 2, FLOOR_Y);
  }

  // arena floor — packed sand over machine tile
  const fl = g.createLinearGradient(0, FLOOR_Y, 0, H);
  fl.addColorStop(0, "#2a2114");
  fl.addColorStop(0.25, "#221a10");
  fl.addColorStop(1, "#120d08");
  g.fillStyle = fl;
  g.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);
  // floor edge highlight
  g.fillStyle = "rgba(255,220,160,0.16)";
  g.fillRect(0, FLOOR_Y, W, 1);
  // perspective tile seams
  g.strokeStyle = "rgba(0,0,0,0.35)";
  g.lineWidth = 1;
  for (let i = 1; i <= 4; i++) {
    const y = FLOOR_Y + (H - FLOOR_Y) * (i / 4.6);
    g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
  }
  for (let i = 0; i <= 6; i++) {
    const xTop = (W / 6) * i;
    const xBot = W / 2 + (xTop - W / 2) * 1.5;
    g.beginPath(); g.moveTo(xTop, FLOOR_Y); g.lineTo(xBot, H); g.stroke();
  }
  // glowing circuit inlay across the floor
  g.strokeStyle = "rgba(212,168,83,0.14)";
  g.beginPath();
  const cy = FLOOR_Y + (H - FLOOR_Y) * 0.5;
  g.moveTo(W * 0.06, cy);
  g.lineTo(W * 0.3, cy);
  g.lineTo(W * 0.34, cy - 4);
  g.moveTo(W * 0.94, cy);
  g.lineTo(W * 0.7, cy);
  g.lineTo(W * 0.66, cy + 4);
  g.stroke();
  g.fillStyle = "rgba(255,210,74,0.4)";
  g.fillRect(W * 0.34 - 1, cy - 5, 2, 2);
  g.fillRect(W * 0.66 - 1, cy + 3, 2, 2);
  // centre emblem ellipse
  g.strokeStyle = "rgba(212,168,83,0.18)";
  g.beginPath();
  g.ellipse(W / 2, FLOOR_Y + (H - FLOOR_Y) * 0.45, W * 0.17, (H - FLOOR_Y) * 0.26, 0, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = "rgba(212,168,83,0.10)";
  g.beginPath();
  g.ellipse(W / 2, FLOOR_Y + (H - FLOOR_Y) * 0.45, W * 0.12, (H - FLOOR_Y) * 0.18, 0, 0, Math.PI * 2);
  g.stroke();

  // spotlight pool over the centre of the pit
  const spot = g.createRadialGradient(W / 2, FLOOR_Y - 20, 10, W / 2, FLOOR_Y - 20, W * 0.34);
  spot.addColorStop(0, "rgba(255,236,190,0.10)");
  spot.addColorStop(1, "rgba(255,236,190,0)");
  g.fillStyle = spot;
  g.fillRect(0, 0, W, H);

  return c;
}

function bakeVignette(W: number, H: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  const v = g.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.85);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.5)");
  g.fillStyle = v;
  g.fillRect(0, 0, W, H);
  return c;
}

function bakeFloorGlow(W: number, H: number, FLOOR_Y: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  const gh = H - FLOOR_Y + 60;
  c.width = W; c.height = gh;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(W / 2, 30, 5, W / 2, 30, W * 0.42);
  r.addColorStop(0, "rgba(255,200,90,0.22)");
  r.addColorStop(1, "rgba(255,200,90,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, W, gh);
  return c;
}
