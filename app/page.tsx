"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useReadContract } from "wagmi";
import { formatUnits } from "viem";
import Image from "next/image";
import sdk from "@farcaster/miniapp-sdk";
import WalletButton from "@/components/WalletButton";
import Footer from "@/components/Footer";
import { PIT_ARENA_ABI, PIT_ARENA_ADDRESS } from "@/lib/contract";
import { useFarcasterAuth } from "@/lib/useFarcasterAuth";

export default function Home() {
  const router = useRouter();
  const { isAuthed, address, pfpUrl, username } = useFarcasterAuth();

  // Signal to Farcaster client that the app is ready â€” hides the splash screen.
  useEffect(() => {
    sdk.actions.ready().catch(() => {});
  }, []);

  const { data: openIds, refetch } = useReadContract({
    address: PIT_ARENA_ADDRESS,
    abi: PIT_ARENA_ABI,
    functionName: "getOpenMatches",
  });

  useEffect(() => {
    const interval = setInterval(() => refetch(), 10000);
    return () => clearInterval(interval);
  }, [refetch]);

  return (
    <div className="arena-bg min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div className="arena-title text-2xl">GLADAITORS</div>
        <div className="flex items-center gap-3">
          <WalletButton />
          {/* Profile avatar â€” clickable, navigates to /profile */}
          <button
            onClick={() => router.push("/profile")}
            className="flex items-center gap-2 rounded-full border border-gray-700 hover:border-amber-600 transition-colors px-2 py-1"
            title="View profile"
          >
            {pfpUrl ? (
              <Image
                src={pfpUrl}
                alt={username ?? "profile"}
                width={28}
                height={28}
                className="rounded-full"
                unoptimized
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-gray-400 text-xs font-bold">
                {username ? username[0].toUpperCase() : "?"}
              </div>
            )}
            {username && (
              <span className="text-xs text-gray-400 hidden sm:block">@{username}</span>
            )}
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="arena-title mb-3">GLADAITORS</h1>
          <p className="text-gray-400 text-lg tracking-widest uppercase">
            Configure. Bet. Dominate.
          </p>
          <p className="text-gray-500 text-sm mt-2">
            Build your champion. Lock your bet. Watch them fight to the death.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-4">
          <button
            className="btn-primary text-base py-3 px-8"
            onClick={() => router.push("/create")}
            disabled={!isAuthed}
          >
            + Create Match
          </button>
          <button
            className="btn-secondary text-base py-3 px-8"
            onClick={() => router.push("/free-fight")}
            disabled={!isAuthed}
          >
            FREE MATCH
          </button>
        </div>
        {!isAuthed && (
          <p className="text-gray-500 text-xs text-center mb-4 animate-pulse">
            Connecting to Farcaster...
          </p>
        )}

        {/* Leaderboard link */}
        <div className="text-center mb-10">
          <button
            className="text-xs text-amber-700 hover:text-amber-500 uppercase tracking-widest font-bold transition-colors"
            onClick={() => router.push("/leaderboard")}
          >
            Leaderboard &amp; Points &rarr;
          </button>
        </div>

        <div>
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />
            Open Matches
          </h2>

          {!openIds || openIds.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-gray-800 rounded-lg">
              <p className="text-gray-600">No open matches. Be the first to enter the pit.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {openIds.map((id) => (
                <MatchRow
                  key={id.toString()}
                  matchId={id}
                  currentAddress={address ?? undefined}
                  onJoin={(id) => router.push(`/join/${id}`)}
                />
              ))}
            </div>
          )}
        </div>

      </main>
      <Footer />
    </div>
  );
}

function MatchRow({
  matchId,
  currentAddress,
  onJoin,
}: {
  matchId: bigint;
  currentAddress?: string;
  onJoin: (id: string) => void;
}) {
  const { data } = useReadContract({
    address: PIT_ARENA_ADDRESS,
    abi: PIT_ARENA_ABI,
    functionName: "getMatch",
    args: [matchId],
  });

  if (!data) return null;
  const [player1, , betAmount] = data;
  const isOwn = currentAddress?.toLowerCase() === player1.toLowerCase();

  return (
    <div
      className="match-card flex items-center justify-between"
      onClick={() => !isOwn && onJoin(matchId.toString())}
      style={{ cursor: isOwn ? "default" : "pointer" }}
    >
      <div>
        <div className="text-xs text-gray-500 mb-1">Match #{matchId.toString()}</div>
        <div className="text-sm text-gray-300 font-mono">
          {player1.slice(0, 8)}...{player1.slice(-4)}
        </div>
        {isOwn && (
          <div className="text-xs text-amber-500 mt-0.5">Your match - waiting for opponent</div>
        )}
      </div>
      <div className="text-right">
        <div className="text-lg font-bold text-amber-400">
          {formatUnits(betAmount, 6)} USDC
        </div>
        {!isOwn && (
          <div className="text-xs text-red-400 font-bold uppercase tracking-widest mt-0.5">
            Challenge
          </div>
        )}
      </div>
    </div>
  );
}


