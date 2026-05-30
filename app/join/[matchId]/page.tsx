"use client";

import { useState, use, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from "wagmi";
import { formatUnits, parseUnits } from "viem";
import StatAllocator from "@/components/StatAllocator";
import WalletButton from "@/components/WalletButton";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
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
  strength: 5,
  speed: 5,
  defense: 5,
  intel: 5,
  luck: 5,
};

type Step = "configure" | "approving" | "joining" | "submitting" | "done";

export default function JoinMatch({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = use(params);
  const router = useRouter();
  const { address, fid, isAuthed } = useFarcasterAuth();

  // Wallet-less Farcaster users cannot do paid fights
  const hasFidButNoWallet = fid !== null && !address && isAuthed;

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

  // State machine — useEffect prevents double-firing in React StrictMode / concurrent renders.
  useEffect(() => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveSuccess]);

  useEffect(() => {
    if (joinSuccess && step === "joining") {
      setStep("submitting");
      writeSubmit({
        address: PIT_ARENA_ADDRESS,
        abi: PIT_ARENA_ABI,
        functionName: "submitGladiator",
        args: [matchIdBig, [stats.strength, stats.speed, stats.defense, stats.intel, stats.luck]],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinSuccess]);

  useEffect(() => {
    if (submitSuccess && step === "submitting") {
      setStep("done");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitSuccess]);

  if (!matchData) {
    return (
      <div className="arena-bg min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading fight...</p>
      </div>
    );
  }

  // Wallet-less Farcaster users cannot join paid fights — show a clear prompt
  if (hasFidButNoWallet) {
    return (
      <div className="arena-bg min-h-screen flex flex-col">
        <Navbar><WalletButton /></Navbar>
        <main className="flex-1 max-w-lg mx-auto w-full px-6 py-16 text-center">
          <div className="text-4xl mb-4">⚔️</div>
          <h1 className="text-xl font-bold uppercase tracking-widest mb-3" style={{ color: "#b8860b" }}>
            Wallet Required
          </h1>
          <p className="text-sm mb-6" style={{ color: "#8b6a40" }}>
            A connected wallet is required for paid fights. Connect your wallet to place a bet and join this fight.
          </p>
          <div
            className="rounded-lg p-4 mb-6 text-sm"
            style={{ background: "#1a1200", border: "1px solid #b8860b", color: "#d4a843" }}
          >
            Paid fights require a wallet to approve USDC and sign on-chain transactions.
            Free fights and Fight Aitor work without a wallet.
          </div>
          <WalletButton />
          <div className="mt-6 space-y-2">
            <button className="btn-secondary w-full" onClick={() => router.push("/free-fight")}>
              Play Free Fight Instead
            </button>
            <button className="btn-secondary w-full" onClick={() => router.push("/fight-aitor")}>
              Fight Aitor (Bot) Instead
            </button>
            <button
              className="text-xs transition-colors mt-2 block mx-auto"
              style={{ color: "#9a7a50" }}
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
        <Navbar><WalletButton /></Navbar>
        <main className="max-w-lg mx-auto px-6 py-16 text-center">
          <div className="text-4xl font-bold text-amber-400 mb-4">CHALLENGE ACCEPTED</div>
          <p className="text-gray-400 mb-8">
            Your gladaitor has entered the arena. Both fighters are ready.
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
    if (step === "submitting" && (submitIsPending || submitConfirming)) return "Submitting gladaitor...";
    return "Processing...";
  }

  return (
    <div className="arena-bg min-h-screen flex flex-col">
      <Navbar><WalletButton /></Navbar>

      <main className="flex-1 max-w-lg mx-auto w-full px-6 py-10">
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
        <div className="rounded-lg p-4 mb-6 flex items-center justify-between" style={{ background: "#1a1200", border: "1px solid #4a3010" }}>
          <span className="text-sm text-gray-400 uppercase tracking-widest">Your stake</span>
          <span className="text-2xl font-bold text-amber-400">
            {formatUnits(betAmount, 6)} USDC
          </span>
        </div>

        {/* Stat allocation */}
        <div className="rounded-lg p-5 mb-6" style={{ background: "#1a1200", border: "1px solid #4a3010" }}>
          <label className="block text-xs uppercase tracking-widest mb-4" style={{ color: "#9a7a50" }}>
            Build Your Gladaitor
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
      <Footer />
    </div>
  );
}
