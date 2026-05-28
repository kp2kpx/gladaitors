"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from "wagmi";
import { formatUnits, parseUnits } from "viem";
import StatAllocator from "@/components/StatAllocator";
import WalletButton from "@/components/WalletButton";
import {
  PIT_ARENA_ABI,
  PIT_ARENA_ADDRESS,
  ERC20_ABI,
  USDC_ADDRESS,
  GladiatorStats,
  TOTAL_POINTS,
  MatchState,
} from "@/lib/contract";
import { useFarcasterAuth } from "@/lib/useFarcasterAuth";

const DEFAULT_STATS: GladiatorStats = {
  strength: 4,
  speed: 4,
  defense: 4,
  intel: 4,
  luck: 4,
};

type Step = "configure" | "approving" | "joining" | "submitting" | "done";

export default function JoinMatch({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = use(params);
  const router = useRouter();
  const { address, isAuthed } = useFarcasterAuth();

  const [stats, setStats] = useState<GladiatorStats>(DEFAULT_STATS);
  const [step, setStep] = useState<Step>("configure");
  const [error, setError] = useState<string | null>(null);

  const matchIdBig = BigInt(matchId);
  const statsValid = Object.values(stats).reduce((a, b) => a + b, 0) === TOTAL_POINTS;

  // Read match state
  const { data: matchData } = useReadContract({
    address: PIT_ARENA_ADDRESS,
    abi: PIT_ARENA_ABI,
    functionName: "getMatch",
    args: [matchIdBig],
  });

  // Allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [address ?? "0x0", PIT_ARENA_ADDRESS],
    query: { enabled: !!address && isAuthed },
  });

  // Approve
  const { writeContract: writeApprove, data: approveTxHash, isPending: approveIsPending } =
    useWriteContract();
  const { isLoading: approveConfirming, isSuccess: approveSuccess } =
    useWaitForTransactionReceipt({ hash: approveTxHash });

  // Join
  const { writeContract: writeJoin, data: joinTxHash, isPending: joinIsPending } =
    useWriteContract();
  const { isLoading: joinConfirming, isSuccess: joinSuccess } =
    useWaitForTransactionReceipt({ hash: joinTxHash });

  // Submit gladiator
  const { writeContract: writeSubmit, data: submitTxHash, isPending: submitIsPending } =
    useWriteContract();
  const { isLoading: submitConfirming, isSuccess: submitSuccess } =
    useWaitForTransactionReceipt({ hash: submitTxHash });

  // State machine
  if (approveSuccess && step === "approving") {
    setStep("joining");
    refetchAllowance();
    writeJoin({
      address: PIT_ARENA_ADDRESS,
      abi: PIT_ARENA_ABI,
      functionName: "joinMatch",
      args: [matchIdBig],
    });
  }

  if (joinSuccess && step === "joining") {
    setStep("submitting");
    writeSubmit({
      address: PIT_ARENA_ADDRESS,
      abi: PIT_ARENA_ABI,
      functionName: "submitGladiator",
      args: [matchIdBig, [stats.strength, stats.speed, stats.defense, stats.intel, stats.luck]],
    });
  }

  if (submitSuccess && step === "submitting") {
    setStep("done");
  }

  if (!matchData) {
    return (
      <div className="arena-bg min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading fight...</p>
      </div>
    );
  }

  const [player1, , betAmount, state] = matchData;
  const betAmountUsdc = parseUnits(formatUnits(betAmount, 6), 6);

  if (state !== MatchState.WaitingForOpponent && step === "configure") {
    return (
      <div className="arena-bg min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-gray-400">
          This fight is no longer open (state: {MatchState[state]}).
        </p>
        <button className="btn-secondary" onClick={() => router.push("/")}>
          Back to Home
        </button>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="arena-bg min-h-screen">
        <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <button onClick={() => router.push("/")} className="arena-title text-xl">
            GLADAITORS
          </button>
          <WalletButton />
        </header>
        <main className="max-w-lg mx-auto px-6 py-16 text-center">
          <div className="text-4xl font-bold text-amber-400 mb-4">CHALLENGE ACCEPTED</div>
          <p className="text-gray-400 mb-8">
            Your gladiator has entered the arena. Both fighters are ready.
            The fight will resolve on-chain.
          </p>
          <div className="space-y-3">
            <button
              className="btn-primary w-full"
              onClick={() => router.push(`/match/${matchId}`)}
            >
              Go to Fight
            </button>
            <button className="btn-secondary w-full" onClick={() => router.push("/")}>
              Home
            </button>
          </div>
        </main>
      </div>
    );
  }

  const isBusy = step !== "configure";

  async function handleChallenge() {
    if (!address || !isAuthed) return;
    setError(null);

    try {
      const needsApproval = !allowance || allowance < betAmountUsdc;

      if (needsApproval) {
        setStep("approving");
        writeApprove({
          address: USDC_ADDRESS,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [PIT_ARENA_ADDRESS, betAmountUsdc * 10n],
        });
      } else {
        setStep("joining");
        writeJoin({
          address: PIT_ARENA_ADDRESS,
          abi: PIT_ARENA_ABI,
          functionName: "joinMatch",
          args: [matchIdBig],
        });
      }
    } catch (e) {
      setError(String(e));
      setStep("configure");
    }
  }

  function getStatusText() {
    if (step === "approving" && (approveIsPending || approveConfirming)) return "Approving USDC...";
    if (step === "joining" && (joinIsPending || joinConfirming)) return "Joining fight on-chain...";
    if (step === "submitting" && (submitIsPending || submitConfirming)) return "Submitting gladiator...";
    return "Processing...";
  }

  return (
    <div className="arena-bg min-h-screen">
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <button onClick={() => router.push("/")} className="arena-title text-xl">
          GLADAITORS
        </button>
        <WalletButton />
      </header>

      <main className="max-w-lg mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-white uppercase tracking-widest mb-2">
          Challenge Accepted?
        </h1>
        <p className="text-gray-500 text-sm mb-6">
          Fight #{matchId} &middot; Opponent:{" "}
          <span className="font-mono text-gray-400">
            {player1.slice(0, 8)}...{player1.slice(-4)}
          </span>
        </p>

        {/* Bet display */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6 flex items-center justify-between">
          <span className="text-sm text-gray-400 uppercase tracking-widest">Your stake</span>
          <span className="text-2xl font-bold text-amber-400">
            {formatUnits(betAmount, 6)} USDC
          </span>
        </div>

        {/* Stat allocation */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 mb-6">
          <label className="block text-xs text-gray-400 uppercase tracking-widest mb-4">
            Build Your Gladiator
          </label>
          <StatAllocator stats={stats} onChange={setStats} disabled={isBusy} />
        </div>

        {error && (
          <div className="bg-red-950 border border-red-800 text-red-400 text-sm rounded p-3 mb-4">
            {error}
          </div>
        )}

        {isBusy && (
          <div className="text-center py-3 mb-4 text-amber-400 text-sm animate-pulse">
            {getStatusText()}
          </div>
        )}

        <button
          className="btn-primary w-full text-base py-4"
          onClick={handleChallenge}
          disabled={!isAuthed || !statsValid || isBusy}
        >
          {isBusy ? "Processing..." : "Challenge Accepted"}
        </button>

        {!statsValid && (
          <p className="text-xs text-red-400 text-center mt-2">
            Allocate all {TOTAL_POINTS} stat points before continuing.
          </p>
        )}
      </main>
    </div>
  );
}
