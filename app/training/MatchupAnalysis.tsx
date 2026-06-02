"use client";

// ─── Matchup Analysis Table ───────────────────────────────────────────────────
// Pre-fight intelligence panel. Updates live as sliders move.
// All math mirrors fight-engine.ts exactly — no simulation needed.

import { GladiatorStats } from "@/lib/contract";

interface Props {
  stats1: GladiatorStats; // RED
  stats2: GladiatorStats; // BLUE
}

// ── Math helpers (must match fight-engine.ts calcDamage exactly) ──────────────

function baseDamage(own: GladiatorStats, opp: GladiatorStats): number {
  const effectiveDef = Math.max(0, opp.defense - own.intel);
  return Math.max(1, own.strength - effectiveDef);
}

function effectiveDef(own: GladiatorStats, opp: GladiatorStats): number {
  return Math.max(0, own.defense - opp.intel);
}

function critChance(own: GladiatorStats): number {
  // floor(LCK / 2) × 10  → expressed as 0–40 (pct)
  return Math.floor(own.luck / 2) * 10;
}

function hitsToKillBase(dmg: number): number {
  return Math.ceil(100 / dmg);
}

function hitsToKillAvg(dmg: number, critPct: number): number {
  // floor(100 / (base_dmg × (1 + crit_chance)))
  return Math.floor(100 / (dmg * (1 + critPct / 100)));
}

// ATB speed advantage: faster gets (10 + diff)/10 attacks per 1 of slower.
// Expressed as pct more attacks: ((10 + diff) / 10 - 1) × 100 = diff × 10
function attackRateAdvantage(s1: GladiatorStats, s2: GladiatorStats): {
  label1: string;
  label2: string;
} {
  const diff = Math.abs(s1.speed - s2.speed);
  if (diff === 0) {
    return { label1: "Equal", label2: "Equal" };
  }
  const pct = diff * 10;
  if (s1.speed > s2.speed) {
    return {
      label1: `+${pct}% faster`,
      label2: `-${Math.round((1 - 10 / (10 + diff)) * 100)}% slower`,
    };
  } else {
    return {
      label1: `-${Math.round((1 - 10 / (10 + diff)) * 100)}% slower`,
      label2: `+${pct}% faster`,
    };
  }
}

// DPS proxy: base_dmg × (1 + crit_chance) × attack_rate_multiplier
function dpsProxy(own: GladiatorStats, opp: GladiatorStats, isG1: boolean, s1: GladiatorStats, s2: GladiatorStats): number {
  const dmg = baseDamage(own, opp);
  const crit = critChance(own) / 100;
  const diff = Math.abs(s1.speed - s2.speed);
  const g1Faster = s1.speed >= s2.speed;
  const rate = isG1
    ? g1Faster ? (10 + diff) / 10 : 1.0
    : !g1Faster ? (10 + diff) / 10 : 1.0;
  return dmg * (1 + crit) * rate;
}

// ── Cell comparison helper ────────────────────────────────────────────────────

type CellSide = "red" | "blue" | "neutral";

function compareHigherBetter(v1: number, v2: number): { r: CellSide; b: CellSide } {
  if (v1 > v2) return { r: "red", b: "neutral" };
  if (v2 > v1) return { r: "neutral", b: "blue" };
  return { r: "neutral", b: "neutral" };
}

function compareLowerBetter(v1: number, v2: number): { r: CellSide; b: CellSide } {
  if (v1 < v2) return { r: "red", b: "neutral" };
  if (v2 < v1) return { r: "neutral", b: "blue" };
  return { r: "neutral", b: "neutral" };
}

// ── Cell styling ──────────────────────────────────────────────────────────────

function cellStyle(side: CellSide, winner: "red" | "blue"): React.CSSProperties {
  if (side === "red" && winner === "red") {
    return { background: "rgba(220,38,38,0.18)", color: "#f87171" };
  }
  if (side === "blue" && winner === "blue") {
    return { background: "rgba(59,130,246,0.18)", color: "#60a5fa" };
  }
  // "loser" side: subtle dim
  if (side === "neutral" && winner === "red") {
    return { color: "#6b7280" };
  }
  if (side === "neutral" && winner === "blue") {
    return { color: "#6b7280" };
  }
  return {};
}

// ── Sub-component: one stat cell ──────────────────────────────────────────────

function Cell({
  value,
  side,
  winner,
}: {
  value: string;
  side: CellSide;
  winner: "red" | "blue";
}) {
  const style = cellStyle(side, winner);
  return (
    <td
      className="px-2 py-1.5 text-center text-xs font-bold tabular-nums"
      style={{
        borderRadius: "3px",
        ...style,
      }}
    >
      {value}
    </td>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MatchupAnalysis({ stats1, stats2 }: Props) {
  // ── Compute all values ──────────────────────────────────────────────────────
  const dmg1 = baseDamage(stats1, stats2);
  const dmg2 = baseDamage(stats2, stats1);

  const crit1 = critChance(stats1);
  const crit2 = critChance(stats2);

  const critDmg1 = dmg1 * 2;
  const critDmg2 = dmg2 * 2;

  const effDef1 = effectiveDef(stats1, stats2);
  const effDef2 = effectiveDef(stats2, stats1);

  const hitsBase1 = hitsToKillBase(dmg1);
  const hitsBase2 = hitsToKillBase(dmg2);

  const hitsAvg1 = hitsToKillAvg(dmg1, crit1);
  const hitsAvg2 = hitsToKillAvg(dmg2, crit2);

  const atkRate = attackRateAdvantage(stats1, stats2);

  const dps1 = dpsProxy(stats1, stats2, true, stats1, stats2);
  const dps2 = dpsProxy(stats2, stats1, false, stats1, stats2);

  const favored: "RED" | "BLUE" | "EVEN" =
    Math.abs(dps1 - dps2) < 0.15
      ? "EVEN"
      : dps1 > dps2
      ? "RED"
      : "BLUE";

  const favorMargin =
    favored === "EVEN"
      ? "roughly even"
      : `${Math.round((Math.abs(dps1 - dps2) / Math.min(dps1, dps2)) * 100)}% DPS edge`;

  // ── Row definitions ─────────────────────────────────────────────────────────
  // Each row: label, red value string, blue value string, comparison result
  type RowDef = {
    label: string;
    v1: string;
    v2: string;
    cmp: { r: CellSide; b: CellSide };
  };

  const rows: RowDef[] = [
    {
      label: "Base damage",
      v1: String(dmg1),
      v2: String(dmg2),
      cmp: compareHigherBetter(dmg1, dmg2),
    },
    {
      label: "Crit chance",
      v1: `${crit1}%`,
      v2: `${crit2}%`,
      cmp: compareHigherBetter(crit1, crit2),
    },
    {
      label: "Crit damage",
      v1: String(critDmg1),
      v2: String(critDmg2),
      cmp: compareHigherBetter(critDmg1, critDmg2),
    },
    {
      label: "Effective DEF",
      v1: String(effDef1),
      v2: String(effDef2),
      cmp: compareHigherBetter(effDef1, effDef2),
    },
    {
      label: "Hits to kill (no crits)",
      v1: String(hitsBase1),
      v2: String(hitsBase2),
      cmp: compareLowerBetter(hitsBase1, hitsBase2),
    },
    {
      label: "Avg hits to kill",
      v1: `~${hitsAvg1}`,
      v2: `~${hitsAvg2}`,
      cmp: compareLowerBetter(hitsAvg1, hitsAvg2),
    },
    {
      label: "Attack rate",
      v1: atkRate.label1,
      v2: atkRate.label2,
      // For attack rate, color whichever has + advantage
      cmp: {
        r: atkRate.label1.startsWith("+") ? "red" : atkRate.label1 === "Equal" ? "neutral" : "neutral",
        b: atkRate.label2.startsWith("+") ? "blue" : atkRate.label2 === "Equal" ? "neutral" : "neutral",
      },
    },
  ];

  return (
    <div
      className="rounded-lg p-3 mb-4"
      style={{
        background: "#15120a",
        border: "1px solid #2a2010",
      }}
    >
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-xs font-bold uppercase tracking-widest"
          style={{ color: "#b8860b" }}
        >
          Live Matchup Analysis
        </span>
        <span
          className="text-xs"
          style={{ color: "#4b3a28" }}
        >
          updates as you adjust stats
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "40%" }} />
            <col style={{ width: "30%" }} />
            <col style={{ width: "30%" }} />
          </colgroup>
          <thead>
            <tr style={{ borderBottom: "1px solid #2a2010" }}>
              <th
                className="text-left px-2 pb-1.5 text-xs uppercase tracking-widest"
                style={{ color: "#4b3a28" }}
              >
                Stat
              </th>
              <th
                className="px-2 pb-1.5 text-center text-xs font-bold uppercase tracking-widest"
                style={{ color: "#dc2626" }}
              >
                RED
              </th>
              <th
                className="px-2 pb-1.5 text-center text-xs font-bold uppercase tracking-widest"
                style={{ color: "#3b82f6" }}
              >
                BLUE
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.label}
                style={{ borderBottom: "1px solid #1c1608" }}
              >
                <td
                  className="px-2 py-1.5 text-xs"
                  style={{ color: "#8b6c3a" }}
                >
                  {row.label}
                </td>
                <Cell value={row.v1} side={row.cmp.r} winner="red" />
                <Cell value={row.v2} side={row.cmp.b} winner="blue" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Outcome prediction */}
      <div
        className="mt-3 pt-2 flex items-center justify-between"
        style={{ borderTop: "1px solid #2a2010" }}
      >
        <span className="text-xs" style={{ color: "#4b3a28" }}>
          Expected outcome
        </span>
        <span
          className="text-xs font-bold uppercase tracking-wide"
          style={{
            color:
              favored === "RED"
                ? "#f87171"
                : favored === "BLUE"
                ? "#60a5fa"
                : "#b8860b",
          }}
        >
          {favored === "EVEN"
            ? "EVEN MATCH"
            : `${favored} FAVORED`}{" "}
          <span
            className="font-normal lowercase"
            style={{ color: "#6b4c2a", letterSpacing: "0" }}
          >
            ({favorMargin})
          </span>
        </span>
      </div>
    </div>
  );
}
