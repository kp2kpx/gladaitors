"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useReadContract } from "wagmi";
import { formatUnits } from "viem";
import Image from "next/image";
import sdk from "@farcaster/miniapp-sdk";
import WalletButton from "@/components/WalletButton";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { PIT_ARENA_ABI, PIT_ARENA_ADDRESS } from "@/lib/contract";
import { useFarcasterAuth } from "@/lib/useFarcasterAuth";

export default function Home() {
  const router = useRouter();
  const { isAuthed, address, pfpUrl, username } = useFarcasterAuth();

  // Signal to Farcaster client that the app is ready — hides the splash screen.
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
      <Navbar>
        <WalletButton />
        {/* Profile avatar — clickable, navigates to /profile */}
        <button
          onClick={() => router.push("/profile")}
          className="flex items-center gap-2 rounded-full border transition-colors px-2 py-1"
          style={{ borderColor: "#c4a882" }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#b8860b")}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#c4a882")}
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
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: "#d8ccb4", color: "#6b4c2a" }}
            >
              {username ? username[0].toUpperCase() : "?"}
            </div>
          )}
          {username && (
            <span className="text-xs hidden sm:block" style={{ color: "#6b4c2a" }}>
              @{username}
            </span>
          )}
        </button>
      </Navbar>

      <main className="max-w-2xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="arena-title mb-3">GLADAITORS</h1>
          <p
            className="text-lg tracking-widest uppercase font-bold"
            style={{ color: "#6b4c2a" }}
          >
            Configure. Bet. Dominate.
          </p>
          <p className="text-sm mt-2" style={{ color: "#8b6a40" }}>
            Where ancient glory meets algorithmic fury.
          </p>
          <p className="text-sm mt-1" style={{ color: "#9e7a50" }}>
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
            + CREATE FIGHT
          </button>
          <button
            className="btn-secondary text-base py-3 px-8"
            onClick={() => router.push("/free-fight")}
            disabled={!isAuthed}
          >
            FREE FIGHT
          </button>
        </div>

        {/* Fight Aitor card */}
        <div className="flex justify-center mb-4">
          <button
            className="btn-bot text-base py-3 px-8 w-full sm:w-auto"
            onClick={() => router.push("/fight-aitor")}
            disabled={!isAuthed}
          >
            ⚔️ FIGHT AITOR
          </button>
        </div>
        <p className="text-center text-xs mb-6 tracking-wide" style={{ color: "#5a7a8a" }}>
          Challenge the bot &bull; Free &bull; Earn points
        </p>

        {!isAuthed && (
          <p
            className="text-xs text-center mb-4 animate-pulse"
            style={{ color: "#8b6a40" }}
          >
            Connecting to Farcaster...
          </p>
        )}

        {/* Leaderboard link */}
        <div className="text-center mb-10">
          <button
            className="text-xs font-bold uppercase tracking-widest transition-colors"
            style={{ color: "#8b1a1a" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#b8860b")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#8b1a1a")}
            onClick={() => router.push("/leaderboard")}
          >
            Leaderboard &amp; Points &rarr;
          </button>
        </div>

        <div>
          <h2
            className="text-sm font-bold uppercase tracking-widest mb-4 flex items-center gap-2"
            style={{ color: "#6b4c2a" }}
          >
            <span
              className="w-2 h-2 rounded-full animate-pulse inline-block"
              style={{ background: "#8b1a1a" }}
            />
            Open Fights
          </h2>

          {!openIds || openIds.length === 0 ? (
            <div
              className="text-center py-12 border border-dashed rounded-lg"
              style={{ borderColor: "#c4a882" }}
            >
              <p style={{ color: "#9a7a50" }}>
                No open fights. Be the first to enter the pit.
              </p>
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
        <div className="text-xs mb-1" style={{ color: "#9a7a50" }}>
          Fight #{matchId.toString()}
        </div>
        <div className="text-sm font-mono" style={{ color: "#3a2010" }}>
          {player1.slice(0, 8)}...{player1.slice(-4)}
        </div>
        {isOwn && (
          <div className="text-xs mt-0.5" style={{ color: "#b8860b" }}>
            Your fight — waiting for opponent
          </div>
        )}
      </div>
      <div className="text-right">
        <div className="text-lg font-bold" style={{ color: "#b8860b" }}>
          {formatUnits(betAmount, 6)} USDC
        </div>
        {!isOwn && (
          <div
            className="text-xs font-bold uppercase tracking-widest mt-0.5"
            style={{ color: "#8b1a1a" }}
          >
            Challenge
          </div>
        )}
      </div>
    </div>
  );
}
