"use client";

// ─── Visual Test — canvas fight renderer sandbox ──────────────────────────────
// No auth, no wallet, no KV, no API calls. Pure client-side sandbox.
// Route: /visual-test (access directly — no nav link in production)
// Branch: visual-upgrade
//
// Same stat-allocator skeleton as /training, but the FIGHT button launches
// the Street Fighter-style canvas renderer (CanvasFight) instead of FightReplay.

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { simulateFight, FightResult } from "@/lib/fight-engine";
import {
  GladiatorStats,
  STAT_LABELS,
  TOTAL_POINTS,
  MAX_STAT,
  MIN_STAT,
} from "@/lib/contract";
import type { FighterColor } from "./CanvasFight";

// Dynamic import — canvas renderer must not SSR
const CanvasFight = dynamic(() => import("./CanvasFight"), { ssr: false });

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_STATS: GladiatorStats = {
  strength: 5,
  speed: 5,
  defense: 5,
  intel: 5,
  luck: 5,
};

const STAT_ICONS: Record<keyof GladiatorStats, string> = {
  strength: "STR",
  speed: "SPD",
  defense: "DEF",
  intel: "INT",
  luck: "LCK",
};

const STAT_FULL: Record<keyof GladiatorStats, string> = {
  strength: "Strength",
  speed: "Speed",
  defense: "Defense",
  intel: "Intel",
  luck: "Luck",
};

// ── Character options ─────────────────────────────────────────────────────────

const CHARACTER_OPTIONS: { id: FighterColor; label: string; color: string }[] = [
  { id: "red",  label: "R", color: "#dc2626" },
  { id: "blue", label: "B", color: "#3b82f6" },
  { id: "gold", label: "G", color: "#d4a853" },
];

// ── Stat allocator ────────────────────────────────────────────────────────────

function MiniAllocator({
  stats,
  onChange,
  accentColor,
}: {
  stats: GladiatorStats;
  onChange: (s: GladiatorStats) => void;
  accentColor: string;
}) {
  const used = Object.values(stats).reduce((a, b) => a + b, 0);
  const remaining = TOTAL_POINTS - used;

  function adjust(stat: keyof GladiatorStats, delta: number) {
    const next = stats[stat] + delta;
    if (next < MIN_STAT || next > MAX_STAT) return;
    if (delta > 0 && remaining <= 0) return;
    onChange({ ...stats, [stat]: next });
  }

  return (
    <div className="space-y-0.5">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs uppercase tracking-widest" style={{ color: "#6b4c2a" }}>
          Points
        </span>
        <span
          className="text-sm font-bold tabular-nums"
          style={{ color: remaining === 0 ? "#22c55e" : "#d97706" }}
        >
          {used}/{TOTAL_POINTS}
        </span>
      </div>

      {STAT_LABELS.map((stat) => {
        const val = stats[stat];
        const pct = (val / MAX_STAT) * 100;
        const canInc = remaining > 0 && val < MAX_STAT;
        const canDec = val > MIN_STAT;

        return (
          <div key={stat} className="flex items-center gap-2 py-1.5">
            <div
              className="w-8 text-xs font-bold uppercase tracking-widest shrink-0"
              style={{ color: accentColor, fontSize: "0.6rem" }}
            >
              {STAT_ICONS[stat]}
            </div>
            <button
              className="stat-btn"
              onClick={() => adjust(stat, -1)}
              disabled={!canDec}
              aria-label={`Decrease ${STAT_FULL[stat]}`}
            >
              -
            </button>
            <span className="w-5 text-center font-bold tabular-nums text-white text-sm">
              {val}
            </span>
            <button
              className="stat-btn"
              onClick={() => adjust(stat, 1)}
              disabled={!canInc}
              aria-label={`Increase ${STAT_FULL[stat]}`}
            >
              +
            </button>
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "#2a2218" }}>
              <div
                className="h-full rounded-full transition-all duration-150"
                style={{ width: `${pct}%`, background: accentColor }}
              />
            </div>
          </div>
        );
      })}

      <div className="pt-1 text-center">
        <button
          className="text-xs hover:underline focus:outline-none"
          style={{ color: "#4b3a28" }}
          onClick={() => onChange({ ...DEFAULT_STATS })}
        >
          reset
        </button>
      </div>
    </div>
  );
}

// ── Character picker ──────────────────────────────────────────────────────────

function CharPicker({
  value,
  onChange,
}: {
  value: FighterColor;
  onChange: (c: FighterColor) => void;
}) {
  return (
    <div className="flex gap-2 justify-center mb-3">
      {CHARACTER_OPTIONS.map((opt) => {
        const selected = opt.id === value;
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            style={{
              width: 40,
              height: 40,
              background: opt.color,
              border: selected ? "2px solid #ffffff" : "2px solid transparent",
              boxShadow: selected ? `0 0 10px ${opt.color}` : "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: "0.75rem",
              color: "#ffffff",
              textShadow: "0 1px 2px rgba(0,0,0,0.6)",
              transition: "all 0.1s ease",
            }}
            aria-label={`${opt.id} gladiator`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Gladiator panel ───────────────────────────────────────────────────────────

function GladPanel({
  label,
  side,
  stats,
  onStatsChange,
  color,
  onColorChange,
}: {
  label: string;
  side: "p1" | "p2";
  stats: GladiatorStats;
  onStatsChange: (s: GladiatorStats) => void;
  color: FighterColor;
  onColorChange: (c: FighterColor) => void;
}) {
  const accentByColor: Record<FighterColor, string> = {
    red:  "#dc2626",
    blue: "#3b82f6",
    gold: "#d4a853",
  };
  const bgByColor: Record<FighterColor, string> = {
    red:  "#200a0a",
    blue: "#0a1020",
    gold: "#1a1408",
  };
  const borderByColor: Record<FighterColor, string> = {
    red:  "#7f1d1d",
    blue: "#1e3a5f",
    gold: "#4a3010",
  };

  const accent = accentByColor[color];

  return (
    <div
      className="flex-1 rounded-lg p-4"
      style={{
        background: bgByColor[color],
        border: `1px solid ${borderByColor[color]}`,
        transition: "background 0.2s, border-color 0.2s",
      }}
    >
      <div className="flex flex-col items-center mb-3">
        {/* Color swatch preview */}
        <div
          style={{
            width: 48,
            height: 64,
            background: accentByColor[color],
            borderRadius: "3px",
            border: `2px solid ${accent}`,
            marginBottom: 8,
            opacity: 0.85,
          }}
        />
        <span
          className="text-xs font-bold uppercase tracking-widest"
          style={{ color: accent }}
        >
          {label}
        </span>
      </div>

      <CharPicker value={color} onChange={onColorChange} />
      <MiniAllocator stats={stats} onChange={onStatsChange} accentColor={accent} />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Step = "configure" | "replay";

export default function VisualTestPage() {
  const [step, setStep] = useState<Step>("configure");
  const [stats1, setStats1] = useState<GladiatorStats>({ ...DEFAULT_STATS });
  const [stats2, setStats2] = useState<GladiatorStats>({ ...DEFAULT_STATS });
  const [color1, setColor1] = useState<FighterColor>("red");
  const [color2, setColor2] = useState<FighterColor>("blue");
  const [fightResult, setFightResult] = useState<FightResult | null>(null);

  const used1 = Object.values(stats1).reduce((a, b) => a + b, 0);
  const used2 = Object.values(stats2).reduce((a, b) => a + b, 0);
  const bothReady = used1 === TOTAL_POINTS && used2 === TOTAL_POINTS;

  function startFight() {
    if (!bothReady) return;
    const result = simulateFight(stats1, stats2);
    setFightResult(result);
    setStep("replay");
  }

  function resetToConfig() {
    setFightResult(null);
    setStep("configure");
  }

  return (
    <div
      style={{
        background: "#0d0b08",
        minHeight: "100vh",
        color: "#e8dcc8",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          textAlign: "center",
          padding: "12px 0",
          borderBottom: "1px solid #2a2218",
          background: "#120f0a",
        }}
      >
        <span
          style={{
            fontSize: "0.65rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.2em",
            color: "#6b4c2a",
          }}
        >
          VISUAL TEST
        </span>
        <span
          style={{
            marginLeft: 12,
            fontSize: "0.65rem",
            borderRadius: 2,
            padding: "2px 8px",
            background: "#1a1208",
            color: "#d97706",
            border: "1px solid #3a2a10",
          }}
        >
          visual-upgrade branch
        </span>
      </div>

      <div style={{ flex: 1, width: "100%", maxWidth: 480, margin: "0 auto", padding: "16px 12px" }}>

        {/* ── Configure step ──────────────────────────────────────────────── */}
        {step === "configure" && (
          <>
            <div
              style={{
                borderRadius: 4,
                padding: "10px 12px",
                marginBottom: 16,
                background: "#15120a",
                border: "1px solid #2a2010",
                color: "#8b6c3a",
                fontSize: "0.7rem",
              }}
            >
              <span style={{ fontWeight: "bold", color: "#f59e0b" }}>Canvas Renderer:</span>{" "}
              Street Fighter-style side-view fight. Fighters move, attack, and die on a canvas.
              Pick colors, allocate 25 points each, then fight.
            </div>

            {/* Two gladiator panels */}
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <GladPanel
                label="P1"
                side="p1"
                stats={stats1}
                onStatsChange={setStats1}
                color={color1}
                onColorChange={setColor1}
              />
              <GladPanel
                label="P2"
                side="p2"
                stats={stats2}
                onStatsChange={setStats2}
                color={color2}
                onColorChange={setColor2}
              />
            </div>

            {/* Readiness + fight button */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", gap: 24, fontSize: "0.7rem", marginBottom: 4 }}>
                <span style={{ color: used1 === TOTAL_POINTS ? "#22c55e" : "#6b7280" }}>
                  P1: {used1}/{TOTAL_POINTS} {used1 === TOTAL_POINTS ? "READY" : "pts"}
                </span>
                <span style={{ color: used2 === TOTAL_POINTS ? "#22c55e" : "#6b7280" }}>
                  P2: {used2}/{TOTAL_POINTS} {used2 === TOTAL_POINTS ? "READY" : "pts"}
                </span>
              </div>

              <button
                className="btn-primary w-full"
                disabled={!bothReady}
                onClick={startFight}
                style={{ fontSize: "1rem", letterSpacing: "0.15em", padding: "0.85rem", width: "100%" }}
              >
                FIGHT
              </button>

              {!bothReady && (
                <p style={{ fontSize: "0.7rem", color: "#4b3a28", textAlign: "center" }}>
                  Allocate all 25 points for each gladiator to unlock
                </p>
              )}
            </div>
          </>
        )}

        {/* ── Replay step ─────────────────────────────────────────────────── */}
        {step === "replay" && fightResult && (
          <div>
            {/* Winner label */}
            <div
              style={{
                textAlign: "center",
                marginBottom: 12,
                fontSize: "0.7rem",
                fontWeight: "bold",
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                color: "#6b4c2a",
              }}
            >
              WATCH THE FIGHT
            </div>

            <CanvasFight
              result={fightResult}
              p1Color={color1}
              p2Color={color2}
              onDone={() => {
                // show result overlay after death animation
              }}
            />

            {/* Fight stats */}
            <div
              style={{
                marginTop: 12,
                padding: "10px 12px",
                background: "#15120a",
                border: "1px solid #2a2010",
                borderRadius: 4,
                fontSize: "0.7rem",
                color: "#8b6c3a",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>
                Winner:{" "}
                <span style={{ color: "#e8dcc8", fontWeight: "bold" }}>
                  {fightResult.winner === "p1" ? "P1" : "P2"}
                </span>
              </span>
              <span>
                Hits:{" "}
                <span style={{ color: "#e8dcc8" }}>{fightResult.log.length}</span>
              </span>
              <span>
                Crits:{" "}
                <span style={{ color: "#ffd700" }}>
                  {fightResult.critsP1 + fightResult.critsP2}
                </span>
              </span>
            </div>

            <div style={{ marginTop: 12 }}>
              <button
                className="btn-primary w-full"
                onClick={resetToConfig}
                style={{ fontSize: "0.85rem", letterSpacing: "0.12em", padding: "0.75rem", width: "100%" }}
              >
                FIGHT AGAIN
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
