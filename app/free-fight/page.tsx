"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import WalletButton from "@/components/WalletButton";
import Footer from "@/components/Footer";
import StatAllocator from "@/components/StatAllocator";
import CastGate from "@/components/CastGate";
import { GladiatorStats, TOTAL_POINTS } from "@/lib/contract";
import { useFarcasterAuth } from "@/lib/useFarcasterAuth";

const DEFAULT_STATS: GladiatorStats = {
  strength: 4,
  speed: 4,
  defense: 4,
  intel: 4,
  luck: 4,
};

type Step = "cast_gate" | "configure" | "creating" | "done";

export default function FreeFightCreate() {
  const router = useRouter();
  const { address, fid, isAuthed } = useFarcasterAuth();

  const [step, setStep] = useState<Step>("cast_gate");
  const [stats, setStats] = useState<GladiatorStats>(DEFAULT_STATS);
  const [createdMatchId, setCreatedMatchId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const statsValid =
    Object.values(stats).reduce((a, b) => a + b, 0) === TOTAL_POINTS;

  async function handleCreate() {
    if (!address || !isAuthed || !statsValid) return;
    setStep("creating");
    setError(null);

    try {
      const res = await fetch("/api/free-match/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: address, fid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create fight");

      const matchId: string = data.matchId;

      // Store player1 stats on the match record
      await fetch(`/api/free-match/${matchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stats1: stats }),
      });

      // Award cast-verified points (cast gate already passed)
      await fetch("/api/points/award", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: address,
          action: "free_fight_cast_verified",
        }),
      }).catch(() => {});

      setCreatedMatchId(matchId);
      setStep("done");
    } catch (e) {
      setError(String(e));
      setStep("configure");
    }
  }

  if (step === "cast_gate") {
    return (
      <CastGate
        fid={fid}
        onVerified={() => setStep("configure")}
      />
    );
  }

  if (step === "done" && createdMatchId) {
    const shareUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/free-fight/${createdMatchId}`
        : `https://gladaitors.vercel.app/free-fight/${createdMatchId}`;

    return (
      <div className="arena-bg min-h-screen flex flex-col">
        <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <button onClick={() => router.push("/")} className="arena-title text-xl">
            GLADAITORS
          </button>
          <WalletButton />
        </header>
        <main className="flex-1 max-w-lg mx-auto w-full px-6 py-16 text-center">
          <div className="text-4xl font-bold text-amber-400 mb-2">FREE FIGHT CREATED</div>
          <p className="text-gray-400 text-sm mb-8">
            Share this link with your opponent. They cast their entry, configure their gladiator,
            and the fight resolves instantly in the browser.
          </p>
          <div className="bg-black border border-gray-700 rounded-lg px-4 py-3 mb-6 font-mono text-sm text-gray-300 break-all">
            {shareUrl}
          </div>
          <div className="space-y-3">
            <button
              className="btn-primary w-full"
              onClick={() => {
                navigator.clipboard.writeText(shareUrl).catch(() => {});
              }}
            >
              Copy Link
            </button>
            <button
              className="btn-secondary w-full"
              onClick={() => router.push(`/free-fight/${createdMatchId}`)}
            >
              Go to Fight Room
            </button>
            <button
              className="text-xs text-gray-600 hover:text-gray-400 transition-colors mt-2 block mx-auto"
              onClick={() => router.push("/")}
            >
              Back to Home
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="arena-bg min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <button onClick={() => router.push("/")} className="arena-title text-xl">
          GLADAITORS
        </button>
        <WalletButton />
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-6 py-10">
        <div className="flex items-center gap-3 mb-2">
          <span className="bg-green-900 text-green-400 text-xs font-bold uppercase tracking-widest px-2 py-1 rounded">
            FREE
          </span>
          <h1 className="text-2xl font-bold text-white uppercase tracking-widest">
            Free Fight
          </h1>
        </div>
        <p className="text-gray-500 text-sm mb-8">
          No USDC required. Build your gladiator and challenge anyone. Fight resolves
          instantly, off-chain.
        </p>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 mb-6">
          <label className="block text-xs text-gray-400 uppercase tracking-widest mb-4">
            Build Your Gladiator
          </label>
          <StatAllocator
            stats={stats}
            onChange={setStats}
            disabled={step === "creating"}
          />
        </div>

        {error && (
          <div className="bg-red-950 border border-red-800 text-red-400 text-sm rounded p-3 mb-4">
            {error}
          </div>
        )}

        {step === "creating" && (
          <div className="text-center py-3 mb-4 text-amber-400 text-sm animate-pulse">
            Creating free fight...
          </div>
        )}

        <button
          className="btn-primary w-full text-base py-4"
          onClick={handleCreate}
          disabled={!isAuthed || !statsValid || step === "creating"}
        >
          {step === "creating" ? "Creating..." : "Create Free Fight"}
        </button>

        {!statsValid && isAuthed && (
          <p className="text-xs text-red-400 text-center mt-2">
            Allocate all {TOTAL_POINTS} stat points before continuing.
          </p>
        )}
      </main>
      <Footer />
    </div>
  );
}
