"use client";

import { use, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import WalletButton from "@/components/WalletButton";
import Footer from "@/components/Footer";
import StatAllocator from "@/components/StatAllocator";
import CastGate from "@/components/CastGate";
import { simulateFight, FightResult } from "@/lib/fight-engine";
import type { GladiatorStats } from "@/lib/contract";
import { TOTAL_POINTS, STAT_LABELS } from "@/lib/contract";
import type { FreeMatch } from "@/lib/kv";
import { useFarcasterAuth } from "@/lib/useFarcasterAuth";

const DEFAULT_STATS: GladiatorStats = {
  strength: 4,
  speed: 4,
  defense: 4,
  intel: 4,
  luck: 4,
};

type ViewState =
  | "loading"
  | "cast_gate"
  | "configure"
  | "joining"
  | "waiting_p2"
  | "fighting"
  | "result"
  | "error";

export default function FreeFightRoom({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = use(params);
  const router = useRouter();
  const { address, fid, isAuthed } = useFarcasterAuth();

  const [view, setView] = useState<ViewState>("loading");
  const [match, setMatch] = useState<FreeMatch | null>(null);
  const [myRole, setMyRole] = useState<"p1" | "p2" | "spectator">("spectator");
  const [stats, setStats] = useState<GladiatorStats>(DEFAULT_STATS);
  const [fightResult, setFightResult] = useState<FightResult | null>(null);
  const [sharedPoints, setSharedPoints] = useState(false);

  const statsValid =
    Object.values(stats).reduce((a, b) => a + b, 0) === TOTAL_POINTS;

  const loadMatch = useCallback(async () => {
    const res = await fetch(`/api/free-match/${matchId}`);
    if (!res.ok) {
      setView("error");
      return null;
    }
    const m: FreeMatch = await res.json();
    setMatch(m);
    return m;
  }, [matchId]);

  // Initial load
  useEffect(() => {
    if (!address) return;
    loadMatch().then((m) => {
      if (!m) return;
      const me = address.toLowerCase();
      if (m.player1 === me) {
        setMyRole("p1");
        if (m.state === "waiting") {
          setView("waiting_p2");
        } else if (m.state === "ready") {
          // Both players configured — run the fight
          runFight(m);
        } else {
          setView("result");
        }
      } else {
        // potential player2 or spectator — show cast gate first
        setMyRole(m.player2 === me ? "p2" : "spectator");
        if (m.player2 === me && m.state !== "waiting") {
          if (m.state === "ready") runFight(m);
          else setView("result");
        } else if (!m.player2) {
          setView("cast_gate");
        } else {
          // already has two players, they're a spectator
          if (m.state === "ready") runFight(m);
          else setView("result");
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  // Poll while waiting for player2
  useEffect(() => {
    if (view !== "waiting_p2") return;
    const interval = setInterval(async () => {
      const m = await loadMatch();
      if (m?.state === "ready") {
        clearInterval(interval);
        runFight(m);
      }
    }, 3000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  function runFight(m: FreeMatch) {
    if (!m.stats1 || !m.stats2) return;
    const result = simulateFight(m.stats1, m.stats2);
    setFightResult(result);
    setView("result");

    // Award points for both players (fire-and-forget)
    const winner = result.winner === "p1" ? m.player1 : m.player2!;
    const loser = result.winner === "p1" ? m.player2! : m.player1;

    fetch("/api/points/award", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wallet: winner,
        action: "free_fight_completed",
        matchId,
      }),
    }).catch(() => {});

    fetch("/api/points/award", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wallet: loser,
        action: "free_fight_completed",
        matchId,
      }),
    }).catch(() => {});
  }

  async function handleCastVerified() {
    setView("configure");
  }

  async function handleJoin() {
    if (!address || !isAuthed || !statsValid) return;
    setView("joining");

    const res = await fetch("/api/free-match/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId, wallet: address, fid, stats }),
    });

    if (!res.ok) {
      setView("error");
      return;
    }

    // Award cast-verified points for player2
    await fetch("/api/points/award", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wallet: address,
        action: "free_fight_cast_verified",
      }),
    }).catch(() => {});

    const m = await loadMatch();
    if (m?.stats1) {
      runFight({ ...m, stats2: stats });
    }
  }

  async function handleShare() {
    if (!address || sharedPoints) return;

    const winner = fightResult?.winner === "p1" ? match?.player1 : match?.player2;
    const myWinner = address?.toLowerCase() === winner?.toLowerCase();
    const shareText = encodeURIComponent(
      `My gladiator just ${myWinner ? "WON" : "fought hard"} in GLADAITOR (FREE FIGHT) 🗡️ — STR:${match?.stats1?.strength ?? "?"} SPD:${match?.stats1?.speed ?? "?"} DEF:${match?.stats1?.defense ?? "?"} — gladaitors.vercel.app`
    );
    window.open(
      `https://warpcast.com/~/compose?text=${shareText}`,
      "_blank",
      "noopener,noreferrer"
    );

    // Award share points
    await fetch("/api/points/award", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wallet: address,
        action: "share_fight_result",
        matchId,
      }),
    }).catch(() => {});

    setSharedPoints(true);
  }

  // --- RENDER ---

  if (view === "loading") {
    return (
      <div className="arena-bg min-h-screen flex items-center justify-center">
        <p className="text-gray-500 animate-pulse">Loading fight...</p>
      </div>
    );
  }

  if (view === "error") {
    return (
      <div className="arena-bg min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-red-400">Fight not found or expired.</p>
        <button className="btn-secondary" onClick={() => router.push("/")}>
          Back to Home
        </button>
      </div>
    );
  }

  if (view === "cast_gate") {
    return <CastGate fid={fid} onVerified={handleCastVerified} />;
  }

  if (view === "configure") {
    return (
      <div className="arena-bg min-h-screen flex flex-col">
        <Header router={router} />
        <main className="flex-1 max-w-lg mx-auto w-full px-6 py-10">
          <div className="flex items-center gap-3 mb-2">
            <span className="bg-green-900 text-green-400 text-xs font-bold uppercase tracking-widest px-2 py-1 rounded">
              FREE FIGHT
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white uppercase tracking-widest mb-2">
            Build Your Gladiator
          </h1>
          <p className="text-gray-500 text-sm mb-8">
            You are joining fight {matchId.slice(0, 8)}... — configure your gladiator and enter the pit.
          </p>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 mb-6">
            <StatAllocator stats={stats} onChange={setStats} disabled={false} />
          </div>
          <button
            className="btn-primary w-full text-base py-4"
            onClick={handleJoin}
            disabled={!isAuthed || !statsValid}
          >
            Enter the Pit (FREE)
          </button>
          {!statsValid && (
            <p className="text-xs text-red-400 text-center mt-2">
              Allocate all {TOTAL_POINTS} stat points first.
            </p>
          )}
        </main>
        <Footer />
      </div>
    );
  }

  if (view === "joining") {
    return (
      <div className="arena-bg min-h-screen flex items-center justify-center">
        <p className="text-amber-400 animate-pulse">Entering the pit...</p>
      </div>
    );
  }

  if (view === "waiting_p2") {
    const shareUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/free-fight/${matchId}`
        : `https://gladaitors.vercel.app/free-fight/${matchId}`;

    return (
      <div className="arena-bg min-h-screen flex flex-col">
        <Header router={router} />
        <main className="flex-1 max-w-lg mx-auto w-full px-6 py-16 text-center">
          <div className="text-3xl font-bold text-amber-400 mb-2">WAITING FOR OPPONENT</div>
          <p className="text-gray-400 text-sm mb-6">
            Share this link. The fight resolves the moment they join.
          </p>
          <div className="bg-black border border-gray-700 rounded-lg px-4 py-3 mb-6 font-mono text-sm text-gray-300 break-all">
            {shareUrl}
          </div>
          <button
            className="btn-primary w-full mb-3"
            onClick={() => navigator.clipboard.writeText(shareUrl).catch(() => {})}
          >
            Copy Link
          </button>
          <p className="text-gray-600 text-xs animate-pulse">Checking for opponent...</p>
        </main>
        <Footer />
      </div>
    );
  }

  if (view === "fighting") {
    return (
      <div className="arena-bg min-h-screen flex items-center justify-center">
        <p className="text-amber-400 animate-pulse text-xl font-bold">FIGHTING...</p>
      </div>
    );
  }

  if (view === "result" && fightResult && match) {
    const p1Stats = match.stats1;
    const p2Stats = match.stats2;
    const isP1Winner = fightResult.winner === "p1";
    const myAddress = address?.toLowerCase() ?? "";
    const iAmP1 = match.player1 === myAddress;
    const iAmP2 = match.player2 === myAddress;
    const iWon =
      (iAmP1 && isP1Winner) || (iAmP2 && !isP1Winner);

    return (
      <div className="arena-bg min-h-screen">
        <Header router={router} />
        <main className="max-w-2xl mx-auto px-6 py-10">
          {/* Winner banner */}
          <div className="bg-amber-950 border border-amber-600 rounded-lg p-6 text-center winner-glow mb-6">
            <div className="text-xs text-amber-400 uppercase tracking-widest mb-2">
              {myRole !== "spectator" ? (iWon ? "YOU WIN" : "YOU LOSE") : "WINNER"}
            </div>
            <div className="text-3xl font-bold text-white font-mono mb-1">
              {isP1Winner
                ? `${match.player1.slice(0, 8)}...${match.player1.slice(-4)}`
                : `${(match.player2 ?? "???").slice(0, 8)}...${(match.player2 ?? "").slice(-4)}`}
            </div>
            <div className="text-sm text-amber-400 mt-1">
              {fightResult.rounds} rounds &middot; HP: {isP1Winner ? fightResult.hp1Final : fightResult.hp2Final} remaining
            </div>
            <div className="text-xs text-gray-500 mt-1">FREE FIGHT — no USDC at stake</div>
          </div>

          {/* Stat comparison */}
          {p1Stats && p2Stats && (
            <div className="grid grid-cols-2 gap-4 mb-6">
              <GladCard
                label="Player 1"
                address={match.player1}
                stats={p1Stats}
                isWinner={isP1Winner}
                isYou={iAmP1}
              />
              <GladCard
                label="Player 2"
                address={match.player2 ?? "???"}
                stats={p2Stats}
                isWinner={!isP1Winner}
                isYou={iAmP2}
              />
            </div>
          )}

          {/* Fight log */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">
              Fight Log
            </p>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {fightResult.log.map((entry, i) => (
                <div key={i} className="text-xs text-gray-400 font-mono">
                  R{entry.round}{" "}
                  <span className={entry.attacker === "p1" ? "text-red-400" : "text-blue-400"}>
                    {entry.attacker === "p1" ? "P1" : "P2"}
                  </span>
                  {" "}hits for{" "}
                  <span className={entry.isCrit ? "text-amber-400 font-bold" : ""}>
                    {entry.damage}{entry.isCrit ? " CRIT!" : ""}
                  </span>
                  {" "}— HP: {entry.hp1After} vs {entry.hp2After}
                </div>
              ))}
            </div>
          </div>

          {/* Share CTA */}
          <button
            className="btn-secondary w-full text-center block mb-2"
            onClick={handleShare}
          >
            {sharedPoints ? "Shared!" : "Share Your Battle"}
          </button>
          <div className="text-center">
            <button
              className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
              onClick={() => router.push("/")}
            >
              Continue
            </button>
          </div>
        </main>
      </div>
    );
  }

  return null;
}

function Header({ router }: { router: ReturnType<typeof useRouter> }) {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
      <button onClick={() => router.push("/")} className="arena-title text-xl">
        GLADAITORS
      </button>
      <WalletButton />
    </header>
  );
}

function GladCard({
  label,
  address,
  stats,
  isWinner,
  isYou,
}: {
  label: string;
  address: string;
  stats: GladiatorStats;
  isWinner: boolean;
  isYou: boolean;
}) {
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
        {address.length > 8
          ? `${address.slice(0, 6)}...${address.slice(-4)}`
          : address}
      </div>
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
    </div>
  );
}
