"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import WalletButton from "@/components/WalletButton";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import StatAllocator from "@/components/StatAllocator";
import { GladiatorStats, TOTAL_POINTS } from "@/lib/contract";
import { useFarcasterAuth } from "@/lib/useFarcasterAuth";

const DEFAULT_STATS: GladiatorStats = {
  strength: 5,
  speed: 5,
  defense: 5,
  intel: 5,
  luck: 5,
};

const FIGHT_TYPE = "free";

function lsKey(wallet: string) {
  return `gladaitor_last_stats_${FIGHT_TYPE}_${wallet.toLowerCase()}`;
}

function loadSavedStats(wallet: string): GladiatorStats | null {
  try {
    const raw = localStorage.getItem(lsKey(wallet));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GladiatorStats;
    const keys: (keyof GladiatorStats)[] = ["strength", "speed", "defense", "intel", "luck"];
    if (keys.every((k) => typeof parsed[k] === "number")) return parsed;
  } catch {
    // ignore
  }
  return null;
}

function saveStats(wallet: string, stats: GladiatorStats) {
  try {
    localStorage.setItem(lsKey(wallet), JSON.stringify(stats));
  } catch {
    // ignore
  }
}

type Step = "configure" | "creating" | "done";

export default function FreeFightCreate() {
  const router = useRouter();
  const { address, fid, isAuthed } = useFarcasterAuth();

  const [step, setStep] = useState<Step>("configure");
  const [isPublic, setIsPublic] = useState(true);
  const [stats, setStats] = useState<GladiatorStats>(DEFAULT_STATS);
  const [createdMatchId, setCreatedMatchId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const statsValid =
    Object.values(stats).reduce((a, b) => a + b, 0) === TOTAL_POINTS;

  // Use wallet address if available, otherwise fall back to fid: prefix for wallet-less users
  const playerId = address ?? (fid ? `fid:${fid}` : null);

  useEffect(() => {
    if (!playerId) return;
    const saved = loadSavedStats(playerId);
    if (saved) setStats(saved);
  }, [playerId]);

  async function handleCreate() {
    if (!playerId || !isAuthed || !statsValid) return;
    setStep("creating");
    setError(null);

    saveStats(playerId, stats);

    try {
      const res = await fetch("/api/free-match/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: playerId, fid, isPublic }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create fight");

      const matchId: string = data.matchId;

      await fetch(`/api/free-match/${matchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stats1: stats }),
      });

      await fetch("/api/points/award", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: playerId, action: "free_fight_created" }),
      }).catch(() => {});

      setCreatedMatchId(matchId);
      setStep("done");
    } catch (e) {
      setError(String(e));
      setStep("configure");
    }
  }

  // Bug 1 fix: skip the intermediate confirmation screen entirely.
  // Redirect straight to the fight room as soon as the match is created.
  if (step === "done" && createdMatchId) {
    router.push(`/free-fight/${createdMatchId}`);
    return (
      <div className="arena-bg min-h-screen flex items-center justify-center">
        <p className="text-amber-400 animate-pulse">Entering fight room...</p>
      </div>
    );
  }

  return (
    <div className="arena-bg min-h-screen flex flex-col">
      <Navbar><WalletButton /></Navbar>

      <main className="flex-1 max-w-lg mx-auto w-full px-6 py-10">
        <div className="flex items-center gap-3 mb-2">
          <span
            className="text-xs font-bold uppercase tracking-widest px-2 py-1 rounded"
            style={{ background: "#2a4a2a", color: "#6abf6a" }}
          >
            FREE
          </span>
          <h1 className="text-2xl font-bold uppercase tracking-widest" style={{ color: "#3a2010" }}>
            Free Fight
          </h1>
        </div>
        <p className="text-sm mb-8" style={{ color: "#8b6a40" }}>
          No USDC required. Build your gladaitor and challenge anyone. Fight resolves instantly, off-chain.
        </p>

        {/* Public / Private toggle */}
        <div
          className="rounded-lg p-4 mb-5 flex items-center justify-between"
          style={{ background: "#e8dcc8", border: "1px solid #c4a882" }}
        >
          <div>
            <div className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{ color: "#6b4c2a" }}>
              {isPublic ? "Public Fight" : "Private Fight"}
            </div>
            <div className="text-xs" style={{ color: "#9a7a50" }}>
              {isPublic ? "Listed in Open Fights on the home screen" : "Join via link only"}
            </div>
          </div>
          <button
            onClick={() => setIsPublic(!isPublic)}
            className="relative inline-flex items-center w-12 h-6 rounded-full transition-colors focus:outline-none"
            style={{ background: isPublic ? "#8b1a1a" : "#c4a882" }}
          >
            <span
              className="inline-block w-5 h-5 rounded-full transition-transform"
              style={{
                background: "#fff",
                transform: isPublic ? "translateX(26px)" : "translateX(2px)",
              }}
            />
          </button>
        </div>

        {/* Stat allocator */}
        <div
          className="rounded-lg p-5 mb-6"
          style={{ background: "#e8dcc8", border: "1px solid #c4a882" }}
        >
          <label className="block text-xs uppercase tracking-widest mb-4" style={{ color: "#6b4c2a" }}>
            Build Your Gladaitor
          </label>
          <StatAllocator
            stats={stats}
            onChange={setStats}
            disabled={step === "creating"}
            onReset={() => setStats(DEFAULT_STATS)}
          />
        </div>

        {error && (
          <div className="rounded p-3 mb-4 text-sm" style={{ background: "#3a0a0a", border: "1px solid #8b1a1a", color: "#e88" }}>
            {error}
          </div>
        )}

        {step === "creating" && (
          <div className="text-center py-3 mb-4 text-sm animate-pulse" style={{ color: "#b8860b" }}>
            Creating free fight...
          </div>
        )}

        <button
          className="btn-primary w-full text-base py-4"
          onClick={handleCreate}
          disabled={!isAuthed || !playerId || !statsValid || step === "creating"}
        >
          {step === "creating" ? "Creating..." : "Create Free Fight"}
        </button>

        {!statsValid && isAuthed && (
          <p className="text-xs text-center mt-2" style={{ color: "#c04040" }}>
            Allocate all {TOTAL_POINTS} stat points before continuing.
          </p>
        )}
      </main>
      <Footer />
    </div>
  );
}
