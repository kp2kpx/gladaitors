"use client";

import {
  GladiatorStats,
  STAT_LABELS,
  STAT_DESCRIPTIONS,
  TOTAL_POINTS,
  MAX_STAT,
  MIN_STAT,
} from "@/lib/contract";

interface Props {
  stats: GladiatorStats;
  onChange: (stats: GladiatorStats) => void;
  disabled?: boolean;
}

const STAT_ICONS: Record<keyof GladiatorStats, string> = {
  strength: "STR",
  speed: "SPD",
  defense: "DEF",
  intel: "INT",
  luck: "LCK",
};

export default function StatAllocator({ stats, onChange, disabled }: Props) {
  const used = Object.values(stats).reduce((a, b) => a + b, 0);
  const remaining = TOTAL_POINTS - used;

  function adjust(stat: keyof GladiatorStats, delta: number) {
    const next = stats[stat] + delta;
    if (next < MIN_STAT || next > MAX_STAT) return;
    if (delta > 0 && remaining <= 0) return;
    onChange({ ...stats, [stat]: next });
  }

  return (
    <div className="space-y-1">
      {/* Points counter */}
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm text-gray-400 uppercase tracking-widest">Allocate Points</span>
        <span
          className={`text-lg font-bold tabular-nums ${
            remaining === 0 ? "text-green-400" : "text-amber-400"
          }`}
        >
          {remaining} / {TOTAL_POINTS} remaining
        </span>
      </div>

      {STAT_LABELS.map((stat) => {
        const val = stats[stat];
        const pct = (val / MAX_STAT) * 100;
        const canInc = !disabled && remaining > 0 && val < MAX_STAT;
        const canDec = !disabled && val > MIN_STAT;

        return (
          <div key={stat} className="flex items-center gap-3 py-2">
            {/* Label */}
            <div className="w-10 text-xs font-bold text-amber-500 uppercase tracking-widest">
              {STAT_ICONS[stat]}
            </div>

            {/* Description */}
            <div className="w-28 text-xs text-gray-500 hidden sm:block">
              {STAT_DESCRIPTIONS[stat]}
            </div>

            {/* Decrement */}
            <button
              className="stat-btn"
              onClick={() => adjust(stat, -1)}
              disabled={!canDec}
              aria-label={`Decrease ${stat}`}
            >
              -
            </button>

            {/* Value */}
            <span className="w-6 text-center font-bold tabular-nums text-white text-sm">
              {val}
            </span>

            {/* Increment */}
            <button
              className="stat-btn"
              onClick={() => adjust(stat, 1)}
              disabled={!canInc}
              aria-label={`Increase ${stat}`}
            >
              +
            </button>

            {/* Bar */}
            <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-200"
                style={{
                  width: `${pct}%`,
                  background: "linear-gradient(90deg, #dc2626, #d97706)",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
