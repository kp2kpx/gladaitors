"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from "wagmi";
import { formatUnits } from "viem";
import WalletButton from "@/components/WalletButton";
import StatAllocator from "@/components/StatAllocator";
import {
  PIT_ARENA_ABI,
  PIT_ARENA_ADDRESS,
  GladiatorStats,
  MatchState,
  TOTAL_POINTS,
  STAT_LABELS,
} from "@/lib/contract";
import { useFarcasterAuth } from "@/lib/useFarcasterAuth";

export default function MatchPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = use(params);
  const router = useRouter();
  const { address } = useFarcasterAuth();
  const matchIdBig = BigInt(matchId);

  const [error, setError] = useState<string | null>(null);
  const [sharedFight, setSharedFight] = useState(false);

  // Read match data - poll every 5s
  const { data: matchData, refetch: refetchMatch } = useReadContract({
    address: PIT_ARENA_ADDRESS,
    abi: PIT_ARENA_ABI,
    functionName: "getMatch",
    args: [matchIdBig],
  });

  const { data: g1Data } = useReadContract({
    address: PIT_ARENA_ADDRESS,
    abi: PIT_ARENA_ABI,
    functionName: "getGladiator",
    args: [matchIdBig, true],
  });

  const { data: g2Data } = useReadContract({
    address: PIT_ARENA_ADDRESS,
    abi: PIT_ARENA_ABI,
    functionName: "getGladiator",
    args: [matchIdBig, false],
  });

  useEffect(() => {
    const interval = setInterval(() => refetchMatch(), 5000);
    return () => clearInterval(interval);
  }, [refetchMatch]);

  const [pendingStats, setPendingStats] = useState<GladiatorStats>({
    strength: 4, speed: 4, defense: 4, intel: 4, luck: 4,
  });
  const pendingStatsValid = Object.values(pendingStats).reduce((a, b) => a + b, 0) === TOTAL_POINTS;

  const { writeContract: writeSubmit, data: submitTxHash, isPending: submitPending } =
    useWriteContract();
  const { isLoading: submitConfirming, isSuccess: submitSuccess } =
    useWaitForTransactionReceipt({ hash: submitTxHash });

  if (submitSuccess) refetchMatch();

  const { writeContract: writeResolve, data: resolveTxHash, isPending: resolvePending } =
    useWriteContract();
  const { isLoading: resolveConfirming, isSuccess: resolveSuccess } =
    useWaitForTransactionReceipt({ hash: resolveTxHash });

  if (resolveSuccess) refetchMatch();

  if (!matchData) {
    return (
      <div className="arena-bg min-h-screen flex items-center justify-center">
        <p className="text-gray-500 animate-pulse">Loading fight...</p>
      </div>
    );
  }

  const [player1, player2, betAmount, state, winner, g1Submitted, g2Submitted] = matchData;

  const isPlayer1 = address?.toLowerCase() === player1.toLowerCase();
  const isPlayer2 = address?.toLowerCase() === player2?.toLowerCase();
  const isParticipant = isPlayer1 || isPlayer2;
  const myGladiatorSubmitted = isPlayer1 ? g1Submitted : isPlayer2 ? g2Submitted : false;

  function handleSubmitGladiator() {
    setError(null);
    writeSubmit({
      address: PIT_ARENA_ADDRESS,
      abi: PIT_ARENA_ABI,
      functionName: "submitGladiator",
      args: [
        matchIdBig,
        [pendingStats.strength, pendingStats.speed, pendingStats.defense, pendingStats.intel, pendingStats.luck],
      ],
    });
  }

  function handleResolveFight() {
    setError(null);
    writeResolve({
      address: PIT_ARENA_ADDRESS,
      abi: PIT_ARENA_ABI,
      functionName: "resolveFight",
      args: [matchIdBig],
    });
  }

  async function handleShare(won: boolean) {
    const statsStr = g1Data
      ? `STR:${g1Data[0]} SPD:${g1Data[1]} DEF:${g1Data[2]}`
      : "";
    const text = encodeURIComponent(
      `My gladiator just ${won ? "WON" : "fought hard"} in GLADAITOR on Base! ${statsStr}\nFight #${matchId} - gladaitors.vercel.app`
    );
    window.open(
      `https://warpcast.com/~/compose?text=${text}`,
      "_blank",
      "noopener,noreferrer"
    );
    if (address && !sharedFight) {
      await fetch("/api/points/award", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: address,
          action: "share_fight_result",
          matchId,
        }),
      }).catch(() => {});
      setSharedFight(true);
    }
  }

  return (
    <div className="arena-bg min-h-screen">
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <button onClick={() => router.push("/")} className="arena-title text-xl">
          GLADAITORS
        </button>
        <WalletButton />
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl font-bold text-white uppercase tracking-widest">
            Fight #{matchId}
          </h1>
          <StateBadge state={state} />
        </div>

        <div className="text-sm text-amber-400 font-bold mb-6">
          Pot: {formatUnits(betAmount * 2n, 6)} USDC &middot; Winner gets{" "}
          {formatUnits((betAmount * 2n * 90n) / 100n, 6)} USDC
        </div>

        {/* WAITING FOR OPPONENT */}
        {state === MatchState.WaitingForOpponent && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 text-center">
            <div className="text-4xl mb-4">WAITING FOR OPPONENT</div>
            <p className="text-gray-400 text-sm mb-4">Share this fight ID with your opponent:</p>
            <div className="bg-black rounded px-6 py-3 text-2xl font-bold text-amber-400 font-mono mb-4 inline-block">
              #{matchId}
            </div>
            <p className="text-gray-500 text-xs">
              Or share the URL: gladaitors.vercel.app/join/{matchId}
            </p>
          </div>
        )}

        {/* WAITING FOR GLADIATORS */}
        {state === MatchState.WaitingForGladiators && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <PlayerCard
                label="Player 1"
                address={player1}
                submitted={g1Submitted}
                gladiatorData={g1Data}
                isYou={isPlayer1}
              />
              <PlayerCard
                label="Player 2"
                address={player2}
                submitted={g2Submitted}
                gladiatorData={g2Data}
                isYou={isPlayer2}
              />
            </div>

            {isParticipant && !myGladiatorSubmitted && (
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
                <p className="text-sm text-gray-400 uppercase tracking-widest mb-4">
                  Submit Your Gladiator
                </p>
                <StatAllocator
                  stats={pendingStats}
                  onChange={setPendingStats}
                  disabled={submitPending || submitConfirming}
                />
                {error && (
                  <div className="text-red-400 text-xs mt-2">{error}</div>
                )}
                <button
                  className="btn-primary w-full mt-4"
                  onClick={handleSubmitGladiator}
                  disabled={!pendingStatsValid || submitPending || submitConfirming}
                >
                  {submitPending || submitConfirming ? "Submitting..." : "Submit Gladiator"}
                </button>
              </div>
            )}

            {isParticipant && myGladiatorSubmitted && !g1Submitted !== !g2Submitted && (
              <div className="text-center text-amber-400 text-sm animate-pulse py-4">
                Waiting for opponent to submit their gladiator...
              </div>
            )}
          </div>
        )}

        {/* FIGHTING */}
        {state === MatchState.Fighting && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <PlayerCard
                label="Player 1"
                address={player1}
                submitted={g1Submitted}
                gladiatorData={g1Data}
                isYou={isPlayer1}
              />
              <PlayerCard
                label="Player 2"
                address={player2}
                submitted={g2Submitted}
                gladiatorData={g2Data}
                isYou={isPlayer2}
              />
            </div>

            <div className="bg-gray-900 border border-amber-900 rounded-lg p-6 text-center">
              <div className="text-2xl font-bold text-amber-400 mb-2 animate-pulse">
                GLADIATORS READY
              </div>
              <p className="text-gray-400 text-sm mb-4">
                Both gladiators have been submitted. Anyone can trigger the fight.
              </p>
              <button
                className="btn-primary"
                onClick={handleResolveFight}
                disabled={resolvePending || resolveConfirming}
              >
                {resolvePending || resolveConfirming ? "Resolving..." : "RESOLVE FIGHT"}
              </button>
            </div>
          </div>
        )}

        {/* RESOLVED */}
        {state === MatchState.Resolved && (
          <div className="space-y-6">
            <div className="bg-amber-950 border border-amber-600 rounded-lg p-6 text-center winner-glow">
              <div className="text-xs text-amber-400 uppercase tracking-widest mb-2">Winner</div>
              <div className="text-3xl font-bold text-white font-mono mb-1">
                {winner.slice(0, 8)}...{winner.slice(-4)}
              </div>
              {winner.toLowerCase() === address?.toLowerCase() && (
                <div className="text-amber-400 font-bold text-lg mt-2">That&apos;s you. Well fought.</div>
              )}
              <div className="text-2xl font-bold text-amber-400 mt-2">
                +{formatUnits((betAmount * 2n * 90n) / 100n, 6)} USDC
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <PlayerCard
                label="Player 1"
                address={player1}
                submitted={g1Submitted}
                gladiatorData={g1Data}
                isYou={isPlayer1}
                isWinner={winner.toLowerCase() === player1.toLowerCase()}
              />
              <PlayerCard
                label="Player 2"
                address={player2}
                submitted={g2Submitted}
                gladiatorData={g2Data}
                isYou={isPlayer2}
                isWinner={winner.toLowerCase() === player2.toLowerCase()}
              />
            </div>

            {/* Points awarder */}
            <PaidFightPointsAwarder
              address={address ?? null}
              matchId={matchId}
              winner={winner}
            />

            {/* Share CTA - prominent button, Continue is just a text link */}
            <button
              className="btn-secondary w-full text-center block"
              onClick={() =>
                handleShare(winner.toLowerCase() === address?.toLowerCase())
              }
            >
              {sharedFight
                ? "Shared!"
                : winner.toLowerCase() === address?.toLowerCase()
                ? "Share Your Victory"
                : "Share Your Battle"}
            </button>
            <div className="text-center">
              <button
                className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
                onClick={() => router.push("/")}
              >
                Continue
              </button>
            </div>
          </div>
        )}

        <div className="mt-8 text-center">
          <button
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
            onClick={() => router.push("/")}
          >
            Back to Home
          </button>
        </div>
      </main>
    </div>
  );
}

function StateBadge({ state }: { state: number }) {
  const configs: Record<number, { label: string; color: string }> = {
    [MatchState.WaitingForOpponent]: { label: "Open", color: "bg-green-900 text-green-400" },
    [MatchState.WaitingForGladiators]: { label: "Configuring", color: "bg-amber-900 text-amber-400" },
    [MatchState.Fighting]: { label: "Ready to Fight", color: "bg-red-900 text-red-400" },
    [MatchState.Resolved]: { label: "Resolved", color: "bg-gray-800 text-gray-400" },
  };
  const cfg = configs[state] ?? { label: "Unknown", color: "bg-gray-800 text-gray-400" };
  return (
    <span className={`text-xs font-bold uppercase tracking-widest px-2 py-1 rounded ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function PlayerCard({
  label,
  address,
  submitted,
  gladiatorData,
  isYou,
  isWinner,
}: {
  label: string;
  address: string;
  submitted: boolean;
  gladiatorData?: readonly [number, number, number, number, number, boolean];
  isYou?: boolean;
  isWinner?: boolean;
}) {
  const stats = gladiatorData && gladiatorData[5]
    ? { strength: gladiatorData[0], speed: gladiatorData[1], defense: gladiatorData[2], intel: gladiatorData[3], luck: gladiatorData[4] }
    : null;

  return (
    <div
      className={`bg-gray-900 border rounded-lg p-4 ${
        isWinner ? "border-amber-500 winner-glow" : "border-gray-800"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500 uppercase tracking-widest">{label}</span>
        {isYou && <span className="text-xs text-amber-500 font-bold">YOU</span>}
        {isWinner && <span className="text-xs text-amber-400 font-bold">WINNER</span>}
      </div>
      <div className="text-xs font-mono text-gray-400 mb-3">
        {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "-"}
      </div>
      {!submitted && (
        <div className="text-xs text-gray-600 italic">Not submitted yet</div>
      )}
      {stats && (
        <div className="space-y-1.5">
          {STAT_LABELS.map((stat) => (
            <div key={stat} className="flex items-center gap-2">
              <span className="text-xs text-amber-600 uppercase w-8 font-bold">
                {stat.slice(0, 3).toUpperCase()}
              </span>
              <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(stats[stat] / 10) * 100}%`,
                    background: isWinner
                      ? "linear-gradient(90deg, #d97706, #f59e0b)"
                      : "linear-gradient(90deg, #dc2626, #ef4444)",
                  }}
                />
              </div>
              <span className="text-xs text-gray-500 w-4 text-right tabular-nums">
                {stats[stat]}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Awards paid fight points once per resolved match, fire-and-forget
function PaidFightPointsAwarder({
  address,
  matchId,
  winner,
}: {
  address: string | null;
  matchId: string;
  winner: string;
}) {
  useEffect(() => {
    if (!address) return;
    const w = address.toLowerCase();
    const isWinner = winner.toLowerCase() === w;

    fetch("/api/points/award", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: w, action: "paid_fight_completed", matchId }),
    }).catch(() => {});

    if (isWinner) {
      fetch("/api/points/award", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: w, action: "paid_fight_won", matchId }),
      }).catch(() => {});
    }
  // Only run once when component mounts (resolved state renders this once)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
