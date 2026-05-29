"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createPublicClient, http, formatEther, formatUnits } from "viem";
import { baseSepolia } from "viem/chains";
import { useFarcasterAuth } from "@/lib/useFarcasterAuth";
import { PIT_ARENA_ABI, PIT_ARENA_ADDRESS, ERC20_ABI, USDC_ADDRESS } from "@/lib/contract";
import type { FreeMatch } from "@/lib/kv";
import Footer from "@/components/Footer";

// --------------------------------------------------------------------------
// Viem public client — Base Sepolia
// --------------------------------------------------------------------------
const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http("https://sepolia.base.org"),
});

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

interface OnChainMatch {
  matchId: string;
  player1: string;
  player2: string;
  betAmount: bigint;
  state: number;
  winner: string;
  role: "p1" | "p2";
  result: "WIN" | "LOSS" | "PENDING";
  usdcDelta: string;
  // winnerPayout from FightResolved event (only set for WINs, else 0n)
  winnerPayout: bigint;
}

interface Balances {
  eth: string;
  usdc: string;
  points: number;
}

type MatchTab = "matches" | "free";

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function shortAddrOrEmpty(addr?: string) {
  if (!addr || addr === "0x0000000000000000000000000000000000000000") return null;
  return shortAddr(addr);
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// --------------------------------------------------------------------------
// Profile page
// --------------------------------------------------------------------------

export default function ProfilePage() {
  const router = useRouter();
  const { isAuthed, address, fid, username, pfpUrl } = useFarcasterAuth();

  const [tab, setTab] = useState<MatchTab>("matches");
  const [balances, setBalances] = useState<Balances | null>(null);
  const [onChainMatches, setOnChainMatches] = useState<OnChainMatch[]>([]);
  const [freeMatches, setFreeMatches] = useState<FreeMatch[]>([]);
  const [loadingBalances, setLoadingBalances] = useState(true);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [loadingFree, setLoadingFree] = useState(true);

  // Claim state
  const [pendingUSDC, setPendingUSDC] = useState<bigint>(0n);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimTxHash, setClaimTxHash] = useState<string | null>(null);

  // --- Load balances + pending withdrawal amount ---
  const loadBalances = useCallback(async () => {
    if (!address) return;
    setLoadingBalances(true);
    try {
      const [ethRaw, usdcRaw, pendingRaw, leaderboard] = await Promise.all([
        publicClient.getBalance({ address: address as `0x${string}` }),
        publicClient.readContract({
          address: USDC_ADDRESS,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [address as `0x${string}`],
        }) as Promise<bigint>,
        publicClient.readContract({
          address: PIT_ARENA_ADDRESS,
          abi: PIT_ARENA_ABI,
          functionName: "pendingWithdrawals",
          args: [address as `0x${string}`],
        }) as Promise<bigint>,
        fetch("/api/points/leaderboard").then((r) => r.json()),
      ]);

      const board: { wallet: string; points: number }[] =
        leaderboard?.leaderboard ?? [];
      const myRecord = board.find(
        (e) => e.wallet.toLowerCase() === address.toLowerCase()
      );

      setBalances({
        eth: parseFloat(formatEther(ethRaw)).toFixed(4),
        usdc: parseFloat(formatUnits(usdcRaw, 6)).toFixed(2),
        points: myRecord?.points ?? 0,
      });

      setPendingUSDC(pendingRaw ?? 0n);
    } catch (e) {
      console.error("loadBalances error", e);
    } finally {
      setLoadingBalances(false);
    }
  }, [address]);

  // --- Load on-chain match history ---
  const loadOnChainMatches = useCallback(async () => {
    if (!address) return;
    setLoadingMatches(true);
    try {
      const addr = address.toLowerCase() as `0x${string}`;

      const [createdLogs, joinedLogs, resolvedLogs] = await Promise.all([
        publicClient.getLogs({
          address: PIT_ARENA_ADDRESS,
          event: {
            type: "event",
            name: "MatchCreated",
            inputs: [
              { indexed: true, name: "matchId", type: "uint256" },
              { indexed: true, name: "player1", type: "address" },
              { indexed: false, name: "betAmount", type: "uint256" },
            ],
          },
          args: { player1: addr },
          fromBlock: BigInt(0),
          toBlock: "latest",
        }),
        publicClient.getLogs({
          address: PIT_ARENA_ADDRESS,
          event: {
            type: "event",
            name: "MatchJoined",
            inputs: [
              { indexed: true, name: "matchId", type: "uint256" },
              { indexed: true, name: "player2", type: "address" },
            ],
          },
          args: { player2: addr },
          fromBlock: BigInt(0),
          toBlock: "latest",
        }),
        publicClient.getLogs({
          address: PIT_ARENA_ADDRESS,
          event: {
            type: "event",
            name: "FightResolved",
            inputs: [
              { indexed: true, name: "matchId", type: "uint256" },
              { indexed: true, name: "winner", type: "address" },
              { indexed: false, name: "rounds", type: "uint8" },
              { indexed: false, name: "winnerPayout", type: "uint256" },
            ],
          },
          fromBlock: BigInt(0),
          toBlock: "latest",
        }),
      ]);

      // Build a map of matchId -> { winner, winnerPayout } from FightResolved
      const resolvedMap = new Map<string, { winner: string; payout: bigint }>();
      for (const log of resolvedLogs) {
        const args = log.args as { matchId?: bigint; winner?: string; winnerPayout?: bigint };
        if (args.matchId !== undefined && args.winner) {
          resolvedMap.set(args.matchId.toString(), {
            winner: args.winner.toLowerCase(),
            payout: args.winnerPayout ?? 0n,
          });
        }
      }

      const myMatchIds = new Set<string>();
      const roleMap = new Map<string, "p1" | "p2">();

      for (const log of createdLogs) {
        const args = log.args as { matchId?: bigint };
        if (args.matchId !== undefined) {
          const id = args.matchId.toString();
          myMatchIds.add(id);
          roleMap.set(id, "p1");
        }
      }
      for (const log of joinedLogs) {
        const args = log.args as { matchId?: bigint };
        if (args.matchId !== undefined) {
          const id = args.matchId.toString();
          myMatchIds.add(id);
          roleMap.set(id, "p2");
        }
      }

      const matchDetails = await Promise.all(
        Array.from(myMatchIds).map(async (id) => {
          try {
            const data = await publicClient.readContract({
              address: PIT_ARENA_ADDRESS,
              abi: PIT_ARENA_ABI,
              functionName: "getMatch",
              args: [BigInt(id)],
            }) as readonly [string, string, bigint, number, string, boolean, boolean];
            return { id, data };
          } catch {
            return null;
          }
        })
      );

      const parsed: OnChainMatch[] = [];
      for (const entry of matchDetails) {
        if (!entry) continue;
        const [player1, player2, betAmount, state, winner] = entry.data;
        const role = roleMap.get(entry.id) ?? "p1";
        const resolved = resolvedMap.get(entry.id);
        const winnerLower = resolved?.winner ?? winner.toLowerCase();
        const isResolved = state === 3;

        let result: OnChainMatch["result"] = "PENDING";
        let usdcDelta = "0.00";
        let winnerPayout = 0n;

        if (isResolved && winnerLower) {
          const iWon = winnerLower === address.toLowerCase();
          result = iWon ? "WIN" : "LOSS";
          winnerPayout = resolved?.payout ?? (betAmount * 2n * 90n) / 100n;
          usdcDelta = iWon
            ? `+${formatUnits(winnerPayout - betAmount, 6)}`
            : `-${formatUnits(betAmount, 6)}`;
        }

        parsed.push({
          matchId: entry.id,
          player1: player1.toLowerCase(),
          player2: player2.toLowerCase(),
          betAmount,
          state,
          winner: winnerLower,
          role,
          result,
          usdcDelta,
          winnerPayout,
        });
      }

      parsed.sort((a, b) => Number(b.matchId) - Number(a.matchId));
      setOnChainMatches(parsed);
    } catch (e) {
      console.error("loadOnChainMatches error", e);
    } finally {
      setLoadingMatches(false);
    }
  }, [address]);

  // --- Load free match history ---
  const loadFreeMatches = useCallback(async () => {
    if (!fid) return;
    setLoadingFree(true);
    try {
      const res = await fetch(`/api/profile/free-matches?fid=${fid}`);
      const data = await res.json();
      setFreeMatches(data.matches ?? []);
    } catch (e) {
      console.error("loadFreeMatches error", e);
    } finally {
      setLoadingFree(false);
    }
  }, [fid]);

  useEffect(() => {
    if (isAuthed && address) {
      loadBalances();
      loadOnChainMatches();
    }
  }, [isAuthed, address, loadBalances, loadOnChainMatches]);

  useEffect(() => {
    if (isAuthed && fid) {
      loadFreeMatches();
    }
  }, [isAuthed, fid, loadFreeMatches]);

  // --- Claim all winnings (house-sponsored via /api/claim) ---
  async function handleClaim() {
    if (!address || claiming) return;
    setClaiming(true);
    setClaimError(null);
    setClaimTxHash(null);
    try {
      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winner: address }),
      });
      const data = await res.json();
      if (!res.ok) {
        setClaimError(data.error ?? "Claim failed");
      } else {
        setClaimTxHash(data.txHash);
        // Refresh balances to reflect the new USDC balance
        await loadBalances();
        // Update pending to 0 immediately in state
        setPendingUSDC(0n);
      }
    } catch (e) {
      setClaimError(String(e));
    } finally {
      setClaiming(false);
    }
  }

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  if (!isAuthed) {
    return (
      <div className="arena-bg min-h-screen flex items-center justify-center">
        <p className="text-gray-500 animate-pulse">Connecting to Farcaster...</p>
      </div>
    );
  }

  // Unclaimed wins: resolved matches where I won, used for per-fight breakdown
  const unclaimedWins = onChainMatches.filter(
    (m) => m.result === "WIN" && pendingUSDC > 0n
  );

  return (
    <div className="arena-bg min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <button onClick={() => router.push("/")} className="arena-title text-xl">
          GLADAITORS
        </button>
        <button
          onClick={() => router.push("/")}
          className="text-xs text-gray-500 hover:text-gray-300 uppercase tracking-widest transition-colors"
        >
          &larr; Back
        </button>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-8">

        {/* === SECTION 1: Identity === */}
        <div
          className="rounded-xl p-6 mb-6 border"
          style={{
            background: "linear-gradient(135deg, #1a0505 0%, #111111 100%)",
            borderColor: "#2a2a2a",
          }}
        >
          <div className="flex items-center gap-4">
            {pfpUrl ? (
              <Image
                src={pfpUrl}
                alt={username ?? "fighter"}
                width={64}
                height={64}
                className="rounded-full border-2 border-amber-600"
                unoptimized
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gray-800 border-2 border-amber-800 flex items-center justify-center text-amber-500 text-2xl font-bold">
                {username ? username[0].toUpperCase() : "?"}
              </div>
            )}
            <div>
              <div className="text-xl font-bold text-white tracking-wide">
                {username ? `@${username}` : "Unknown Fighter"}
              </div>
              {fid && (
                <div className="text-xs text-gray-500 mt-0.5">FID {fid}</div>
              )}
              {address && (
                <div className="text-xs text-gray-500 font-mono mt-0.5">
                  {shortAddr(address)}
                </div>
              )}
            </div>
            <div className="ml-auto">
              <div className="text-xs text-amber-700 uppercase tracking-widest font-bold">Fighter</div>
            </div>
          </div>
        </div>

        {/* === SECTION 2: Unclaimed Winnings === */}
        {(pendingUSDC > 0n || claimTxHash) && (
          <div
            className="rounded-xl p-5 mb-6 border"
            style={{
              background: "linear-gradient(135deg, #0d1f0a 0%, #0a1a07 100%)",
              borderColor: pendingUSDC > 0n ? "#2d6a1e" : "#1a3a12",
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs text-green-600 uppercase tracking-widest font-bold mb-1">
                  Unclaimed Winnings
                </div>
                <div className="text-3xl font-bold text-green-400 tabular-nums">
                  {formatUnits(pendingUSDC, 6)} USDC
                </div>
                <div className="text-xs text-green-700 mt-0.5">Ready to claim &bull; Gas free</div>
              </div>
              <button
                onClick={handleClaim}
                disabled={claiming || pendingUSDC === 0n}
                className="px-6 py-3 rounded-lg font-bold text-sm uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: claiming || pendingUSDC === 0n
                    ? "#1a3a12"
                    : "linear-gradient(135deg, #16a34a, #15803d)",
                  color: "#d1fae5",
                  border: "1px solid #166534",
                }}
              >
                {claiming ? "Claiming..." : "Claim All"}
              </button>
            </div>

            {/* Per-fight breakdown */}
            {unclaimedWins.length > 0 && (
              <div className="space-y-2 border-t border-green-900 pt-3 mt-1">
                {unclaimedWins.map((m) => {
                  const opponent =
                    m.role === "p1"
                      ? shortAddrOrEmpty(m.player2) ?? "Opponent"
                      : shortAddr(m.player1);
                  return (
                    <div key={m.matchId} className="flex items-center justify-between text-sm">
                      <div className="text-green-700">
                        Fight #{m.matchId} vs <span className="font-mono text-green-600">{opponent}</span>
                      </div>
                      <div className="text-green-400 font-bold font-mono">
                        +{formatUnits(m.winnerPayout, 6)} USDC
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {claimError && (
              <div className="mt-3 text-xs text-red-400 bg-red-950 border border-red-900 rounded p-2">
                {claimError}
              </div>
            )}
            {claimTxHash && (
              <div className="mt-3 text-xs text-green-500">
                Claimed!{" "}
                <a
                  href={`https://sepolia.basescan.org/tx/${claimTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  View tx
                </a>
              </div>
            )}
          </div>
        )}

        {/* === SECTION 3: Balances === */}
        <div className="mb-6">
          <div className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-3">
            Balances
          </div>
          {loadingBalances ? (
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-gray-900 border border-gray-800 rounded-lg p-4 animate-pulse">
                  <div className="h-3 bg-gray-800 rounded w-16 mb-2" />
                  <div className="h-6 bg-gray-800 rounded w-24" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {/* Points */}
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                <div className="text-xs text-gray-500 uppercase tracking-widest mb-1">Points</div>
                <div className="text-2xl font-bold text-amber-400 tabular-nums">
                  {(balances?.points ?? 0).toLocaleString()}
                </div>
                <div className="text-xs text-gray-600 mt-0.5">Arena points</div>
              </div>

              {/* ETH */}
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                <div className="text-xs text-gray-500 uppercase tracking-widest mb-1">ETH</div>
                <div className="text-2xl font-bold text-white tabular-nums">
                  {balances?.eth ?? "0.0000"}
                </div>
                <div className="text-xs text-gray-600 mt-0.5">Base Sepolia</div>
              </div>

              {/* USDC */}
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                <div className="text-xs text-gray-500 uppercase tracking-widest mb-1">USDC</div>
                <div className="text-2xl font-bold text-green-400 tabular-nums">
                  {balances?.usdc ?? "0.00"}
                </div>
                <div className="text-xs text-gray-600 mt-0.5">Base Sepolia</div>
              </div>

              {/* $GLADAITOR — coming soon */}
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 opacity-50">
                <div className="text-xs text-gray-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                  <span>$GLADAITOR</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-3 h-3 text-gray-600"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="text-xl font-bold text-gray-600">—</div>
                <div className="text-xs text-gray-600 mt-0.5">Coming soon</div>
              </div>
            </div>
          )}
        </div>

        {/* === SECTION 4: Fight History === */}
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-3">
            Fight History
          </div>

          {/* Tab switcher */}
          <div className="flex gap-1 mb-4 bg-gray-900 border border-gray-800 rounded-lg p-1">
            <button
              onClick={() => setTab("matches")}
              className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded transition-all ${
                tab === "matches"
                  ? "bg-red-900 text-red-300 border border-red-800"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              FIGHTS
            </button>
            <button
              onClick={() => setTab("free")}
              className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded transition-all ${
                tab === "free"
                  ? "bg-green-900 text-green-300 border border-green-800"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              FREE FIGHTS
            </button>
          </div>

          {/* Matches tab */}
          {tab === "matches" && (
            <div>
              {loadingMatches ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-gray-900 border border-gray-800 rounded-lg p-4 animate-pulse">
                      <div className="h-4 bg-gray-800 rounded w-32 mb-2" />
                      <div className="h-3 bg-gray-800 rounded w-48" />
                    </div>
                  ))}
                </div>
              ) : onChainMatches.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-gray-800 rounded-lg">
                  <p className="text-gray-600 text-sm">No fights yet.</p>
                  <button
                    className="btn-primary mt-4 text-sm py-2 px-6"
                    onClick={() => router.push("/create")}
                  >
                    Create a Fight
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {onChainMatches.map((m) => {
                    const opponent =
                      m.role === "p1"
                        ? shortAddrOrEmpty(m.player2) ?? "Waiting for opponent"
                        : shortAddr(m.player1);

                    return (
                      <button
                        key={m.matchId}
                        className="w-full text-left bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors"
                        onClick={() => router.push(`/match/${m.matchId}`)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 font-mono">
                              Fight #{m.matchId}
                            </span>
                            <ResultBadge result={m.result} />
                          </div>
                          <span className="text-xs text-amber-400 font-bold font-mono">
                            {formatUnits(m.betAmount, 6)} USDC
                          </span>
                        </div>
                        <div className="text-sm text-gray-400 mb-1">
                          vs{" "}
                          <span className="font-mono text-gray-300">{opponent}</span>
                        </div>
                        {m.result !== "PENDING" && (
                          <div
                            className={`text-xs font-bold font-mono ${
                              m.result === "WIN" ? "text-green-400" : "text-red-400"
                            }`}
                          >
                            {m.usdcDelta} USDC
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Free Matches tab */}
          {tab === "free" && (
            <div>
              {loadingFree ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-gray-900 border border-gray-800 rounded-lg p-4 animate-pulse">
                      <div className="h-4 bg-gray-800 rounded w-32 mb-2" />
                      <div className="h-3 bg-gray-800 rounded w-48" />
                    </div>
                  ))}
                </div>
              ) : freeMatches.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-gray-800 rounded-lg">
                  <p className="text-gray-600 text-sm">No free fights yet.</p>
                  <button
                    className="btn-secondary mt-4 text-sm py-2 px-6"
                    onClick={() => router.push("/free-fight")}
                  >
                    Start a Free Fight
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {freeMatches.map((m) => {
                    const isP1 = m.player1Fid === fid;
                    const opponentWallet = isP1 ? m.player2 : m.player1;
                    const opponentDisplay = opponentWallet
                      ? shortAddr(opponentWallet)
                      : "Waiting for opponent";
                    const myWallet = address?.toLowerCase();

                    let freeResult: "WIN" | "LOSS" | "PENDING" = "PENDING";
                    if (m.state === "resolved" && m.winner && myWallet) {
                      freeResult = m.winner === myWallet ? "WIN" : "LOSS";
                    }

                    return (
                      <button
                        key={m.id}
                        className="w-full text-left bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors"
                        onClick={() => router.push(`/free-fight/${m.id}`)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-green-700 bg-green-950 border border-green-900 rounded px-1.5 py-0.5 font-bold uppercase tracking-widest">
                              FREE
                            </span>
                            {m.state === "resolved"
                              ? <ResultBadge result={freeResult} />
                              : <FreeStateBadge state={m.state} />
                            }
                          </div>
                          <span className="text-xs text-gray-600 font-mono">
                            {formatDate(m.createdAt)}
                          </span>
                        </div>
                        <div className="text-sm text-gray-400">
                          vs{" "}
                          <span className="font-mono text-gray-300">{opponentDisplay}</span>
                        </div>
                        <div className="text-xs text-gray-600 mt-1 font-mono">
                          {m.id.slice(0, 8)}...
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

// --------------------------------------------------------------------------
// Sub-components
// --------------------------------------------------------------------------

function ResultBadge({ result }: { result: "WIN" | "LOSS" | "PENDING" }) {
  if (result === "WIN") {
    return (
      <span className="text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-green-900 text-green-400 border border-green-800">
        WIN
      </span>
    );
  }
  if (result === "LOSS") {
    return (
      <span className="text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-red-950 text-red-400 border border-red-900">
        LOSS
      </span>
    );
  }
  return (
    <span className="text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-gray-800 text-gray-500 border border-gray-700">
      PENDING
    </span>
  );
}

function FreeStateBadge({ state }: { state: string }) {
  if (state === "waiting") {
    return (
      <span className="text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-amber-950 text-amber-600 border border-amber-900">
        Waiting
      </span>
    );
  }
  if (state === "ready") {
    return (
      <span className="text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-900">
        Ready
      </span>
    );
  }
  return (
    <span className="text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-gray-800 text-gray-500 border border-gray-700">
      Resolved
    </span>
  );
}
