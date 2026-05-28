"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { parseUnits } from "viem";
import StatAllocator from "@/components/StatAllocator";
import WalletButton from "@/components/WalletButton";
import {
  PIT_ARENA_ABI,
  PIT_ARENA_ADDRESS,
  ERC20_ABI,
  USDC_ADDRESS,
  GladiatorStats,
  TOTAL_POINTS,
} from "@/lib/contract";
import { useFarcasterAuth } from "@/lib/useFarcasterAuth";

const DEFAULT_STATS: GladiatorStats = {
  strength: 4,
  speed: 4,
  defense: 4,
  intel: 4,
  luck: 4,
};

type Step = "configure" | "approving" | "creating" | "done";

export default function CreateMatch() {
  const router = useRouter();
  const { address, isAuthed } = useFarcasterAuth();

  const [betAmountStr, setBetAmountStr] = useState("1");
  const [stats, setStats] = useState<GladiatorStats>(DEFAULT_STATS);
  const [step, setStep] = useState<Step>("configure");
  const [createdMatchId, setCreatedMatchId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const betAmount = parseUnits(betAmountStr || "0", 6);
  const statsValid = Object.values(stats).reduce((a, b) => a + b, 0) === TOTAL_POINTS;
  const betValid = Number(betAmountStr) >= 1;

  // Check current USDC allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [address ?? "0x0", PIT_ARENA_ADDRESS],
    query: { enabled: !!address && isAuthed },
  });

  // Approve USDC
  const {
    writeContract: writeApprove,
    data: approveTxHash,
    isPending: approveIsPending,
  } = useWriteContract();

  const { isLoading: approveConfirming, isSuccess: approveSuccess } =
    useWaitForTransactionReceipt({ hash: approveTxHash });

  // Create match
  const {
    writeContract: writeCreate,
    data: createTxHash,
    isPending: createIsPending,
  } = useWriteContract();

  const { isLoading: createConfirming, isSuccess: createSuccess, data: createReceipt } =
    useWaitForTransactionReceipt({ hash: createTxHash });

  // When approve succeeds, proceed to createMatch
  if (approveSuccess && step === "approving") {
    setStep("creating");
    refetchAllowance();
    writeCreate({
      address: PIT_ARENA_ADDRESS,
      abi: PIT_ARENA_ABI,
      functionName: "createMatch",
      args: [betAmount],
    });
  }

  // When create succeeds, extract match ID from logs
  if (createSuccess && createReceipt && step === "creating") {
    // Parse MatchCreated event: topic[1] is matchId (indexed)
    const matchCreatedEvent = createReceipt.logs.find(
      (log) => log.address.toLowerCase() === PIT_ARENA_ADDRESS.toLowerCase()
    );
    if (matchCreatedEvent && matchCreatedEvent.topics[1]) {
      const matchId = BigInt(matchCreatedEvent.topics[1]).toString();
      setCreatedMatchId(matchId);
      setStep("done");
    }
  }

  async function handleEnterPit() {
    if (!address || !isAuthed) return;
    setError(null);

    try {
      const needsApproval = !allowance || allowance < betAmount;

      if (needsApproval) {
        setStep("approving");
        writeApprove({
          address: USDC_ADDRESS,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [PIT_ARENA_ADDRESS, betAmount * 10n], // approve 10x to avoid repeated approvals
        });
      } else {
        setStep("creating");
        writeCreate({
          address: PIT_ARENA_ADDRESS,
          abi: PIT_ARENA_ABI,
          functionName: "createMatch",
          args: [betAmount],
        });
      }
    } catch (e) {
      setError(String(e));
      setStep("configure");
    }
  }

  const isBusy = step === "approving" || step === "creating";

  if (step === "done" && createdMatchId) {
    return (
      <div className="arena-bg min-h-screen">
        <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <button onClick={() => router.push("/")} className="arena-title text-xl">
            GLADAITORS
          </button>
          <WalletButton />
        </header>
        <main className="max-w-lg mx-auto px-6 py-16 text-center">
          <div className="text-5xl mb-6">FIGHT CREATED</div>
          <p className="text-gray-400 mb-2">Fight ID</p>
          <div className="text-4xl font-bold text-amber-400 mb-6">#{createdMatchId}</div>
          <p className="text-gray-500 text-sm mb-8">
            Share this ID with your opponent. They join from the home screen.
            Once they join, both of you submit gladiator stats and the fight begins.
          </p>
          <div className="space-y-3">
            <button
              className="btn-primary w-full"
              onClick={() => router.push(`/match/${createdMatchId}`)}
            >
              Go to Fight Lobby
            </button>
            <button
              className="btn-secondary w-full"
              onClick={() => router.push("/")}
            >
              Back to Home
            </button>
          </div>
        </main>
      </div>
    );
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
          Enter the Pit
        </h1>
        <p className="text-gray-500 text-sm mb-8">
          Set your bet and build your gladiator. Your opponent must meet the bet.
        </p>

        {/* Bet amount */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 mb-6">
          <label className="block text-xs text-gray-400 uppercase tracking-widest mb-3">
            Bet Amount (USDC)
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min="1"
              step="1"
              value={betAmountStr}
              onChange={(e) => setBetAmountStr(e.target.value)}
              className="flex-1 bg-black border border-gray-700 rounded px-4 py-2 text-white text-lg font-bold focus:outline-none focus:border-amber-500"
              disabled={isBusy}
            />
            <span className="text-gray-400 font-bold">USDC</span>
          </div>
          <p className="text-xs text-gray-600 mt-2">Minimum 1 USDC. Winner takes 90% of pot. Loser forfeits bet.</p>
        </div>

        {/* Stat allocation */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 mb-6">
          <label className="block text-xs text-gray-400 uppercase tracking-widest mb-4">
            Gladiator Stats
          </label>
          <StatAllocator stats={stats} onChange={setStats} disabled={isBusy} />
        </div>

        {error && (
          <div className="bg-red-950 border border-red-800 text-red-400 text-sm rounded p-3 mb-4">
            {error}
          </div>
        )}

        {/* Status */}
        {isBusy && (
          <div className="text-center py-3 mb-4 text-amber-400 text-sm animate-pulse">
            {step === "approving" && (approveIsPending || approveConfirming)
              ? "Approving USDC..."
              : step === "creating" && (createIsPending || createConfirming)
              ? "Creating fight on-chain..."
              : "Processing..."}
          </div>
        )}

        <button
          className="btn-primary w-full text-base py-4"
          onClick={handleEnterPit}
          disabled={!isAuthed || !statsValid || !betValid || isBusy}
        >
          {isBusy ? "Processing..." : "Enter the Pit"}
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

