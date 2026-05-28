"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import WalletButton from "@/components/WalletButton";
import Footer from "@/components/Footer";

interface PointRecord {
  wallet: string;
  points: number;
  fightsPlayed: number;
  fightsWon: number;
}

function getNextDrop(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function Leaderboard() {
  const router = useRouter();
  const [board, setBoard] = useState<PointRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/points/leaderboard");
        const data = await res.json();
        setBoard(data.leaderboard ?? []);
      } catch {
        setBoard([]);
      } finally {
        setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="arena-bg min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <button onClick={() => router.push("/")} className="arena-title text-xl">
          GLADAITORS
        </button>
        <WalletButton />
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-10">
        {/* Airdrop banner */}
        <div
          className="rounded-xl p-5 mb-8 border text-center"
          style={{
            background: "linear-gradient(135deg, #1a0a00, #2d1a00)",
            borderColor: "#92400e",
          }}
        >
          <div className="text-xs text-amber-500 uppercase tracking-widest font-bold mb-1">
            Weekly Airdrop
          </div>
          <p className="text-white font-bold text-lg">
            Weekly GLADAITOR token airdrop &mdash; top fighters earn $GLADAITOR.
          </p>
          <p className="text-amber-400 text-sm mt-1">
            Next drop:{" "}
            <span className="font-bold text-amber-300">{getNextDrop()}</span>
          </p>
        </div>

        <h1 className="text-xl font-bold text-white uppercase tracking-widest mb-6 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse inline-block" />
          Top Fighters
        </h1>

        {loading ? (
          <div className="text-center py-20">
            <p className="text-gray-500 animate-pulse">Loading leaderboard...</p>
          </div>
        ) : board.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-gray-800 rounded-lg">
            <p className="text-gray-600">
              No fighters yet. Be the first to enter the pit.
            </p>
            <button
              className="btn-primary mt-6"
              onClick={() => router.push("/")}
            >
              Enter the Pit
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Header row */}
            <div className="grid grid-cols-[2rem_1fr_5rem_4rem_4rem] gap-2 px-3 mb-1">
              <span className="text-xs text-gray-600 uppercase tracking-widest">#</span>
              <span className="text-xs text-gray-600 uppercase tracking-widest">Wallet</span>
              <span className="text-xs text-gray-600 uppercase tracking-widest text-right">Points</span>
              <span className="text-xs text-gray-600 uppercase tracking-widest text-right">Fights</span>
              <span className="text-xs text-gray-600 uppercase tracking-widest text-right">Wins</span>
            </div>

            {board.map((entry, idx) => {
              const rank = idx + 1;
              const isTop3 = rank <= 3;
              return (
                <div
                  key={entry.wallet}
                  className="grid grid-cols-[2rem_1fr_5rem_4rem_4rem] gap-2 items-center px-3 py-3 rounded-lg border transition-all"
                  style={{
                    background:
                      rank === 1
                        ? "linear-gradient(135deg, #1a1200, #2d2000)"
                        : "#141414",
                    borderColor:
                      rank === 1
                        ? "#92400e"
                        : rank === 2
                        ? "#374151"
                        : rank === 3
                        ? "#44403c"
                        : "#1f2937",
                  }}
                >
                  <span
                    className="text-sm font-bold tabular-nums"
                    style={{
                      color:
                        rank === 1
                          ? "#f59e0b"
                          : rank === 2
                          ? "#9ca3af"
                          : rank === 3
                          ? "#92400e"
                          : "#6b7280",
                    }}
                  >
                    {rank === 1 ? "👑" : rank}
                  </span>
                  <span className="text-sm font-mono text-gray-300">
                    {entry.wallet.slice(0, 6)}...{entry.wallet.slice(-4)}
                    {isTop3 && (
                      <span className="ml-2 text-xs text-amber-600 font-bold uppercase tracking-widest">
                        {rank === 1 ? "CHAMPION" : rank === 2 ? "CONTENDER" : "VETERAN"}
                      </span>
                    )}
                  </span>
                  <span className="text-right font-bold tabular-nums text-amber-400">
                    {entry.points.toLocaleString()}
                  </span>
                  <span className="text-right text-sm text-gray-400 tabular-nums">
                    {entry.fightsPlayed}
                  </span>
                  <span className="text-right text-sm text-gray-400 tabular-nums">
                    {entry.fightsWon}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Points legend */}
        <div className="mt-10 bg-gray-900 border border-gray-800 rounded-lg p-5">
          <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-3">
            How Points Work
          </p>
          <div className="space-y-1.5">
            {[
              ["Cast to enter free match", "+20 pts"],
              ["Complete a free match", "+10 pts"],
              ["Complete a match", "+50 pts"],
              ["Win a match (bonus)", "+50 pts"],
              ["Share your fight result", "+30 pts"],
            ].map(([desc, pts]) => (
              <div key={desc} className="flex justify-between text-sm">
                <span className="text-gray-400">{desc}</span>
                <span className="text-amber-400 font-bold font-mono">{pts}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 text-center">
          <button
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
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
