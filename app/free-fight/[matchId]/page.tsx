"use client";

import { use, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import WalletButton from "@/components/WalletButton";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import StatAllocator from "@/components/StatAllocator";
import FightReplay from "@/components/FightReplay";
import FightSummary from "@/components/FightSummary";
import { simulateFight, FightResult } from "@/lib/fight-engine";
import type { GladiatorStats } from "@/lib/contract";
import { TOTAL_POINTS } from "@/lib/contract";
import type { FreeMatch } from "@/lib/kv";
import { useFarcasterAuth } from "@/lib/useFarcasterAuth";

const DEFAULT_STATS: GladiatorStats = {
  strength: 5,
  speed: 5,
  defense: 5,
  intel: 5,
  luck: 5,
};

type ViewState =
  | "loading"
  | "configure"
  | "joining"
  | "waiting_p2"
  | "replay"
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
  const [opponentUsername, setOpponentUsername] = useState<string | null>(null);

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
          runFight(m);
        } else {
          setView("result");
        }
      } else {
        setMyRole(m.player2 === me ? "p2" : "spectator");
        if (m.player2 === me && m.state !== "waiting") {
          if (m.state === "ready") runFight(m);
          else setView("result");
        } else if (!m.player2) {
          setView("configure");
        } else {
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
    setView("replay");

    // Resolve opponent's Farcaster username for taunts — fire and forget,
    // never blocks the fight screen. Viewer's opponent is the other player.
    const myAddr = address?.toLowerCase() ?? "";
    const iAmP1 = m.player1 === myAddr;
    const opponentFid = iAmP1 ? m.player2Fid : m.player1Fid;
    if (opponentFid) {
      fetch(`/api/user/farcaster?fid=${opponentFid}`)
        .then((r) => r.json())
        .then((d) => {
          if (d?.username) setOpponentUsername(`@${d.username}`);
        })
        .catch(() => {});
    }

    const winner = result.winner === "p1" ? m.player1 : m.player2!;
    const loser = result.winner === "p1" ? m.player2! : m.player1;
    const winnerFid = result.winner === "p1" ? m.player1Fid : m.player2Fid;

    // Persist winner to KV so profile history can show WIN/LOSS instead of PENDING.
    // Fire-and-forget; idempotent if both players trigger runFight simultaneously.
    fetch("/api/free-match/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId, winnerAddress: winner, winnerFid }),
    }).catch(() => {});

    fetch("/api/points/award", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: winner, action: "free_fight_completed", matchId }),
    }).catch(() => {});

    fetch("/api/points/award", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: loser, action: "free_fight_completed", matchId }),
    }).catch(() => {});
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

    await fetch("/api/points/award", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: address, action: "free_fight_cast_verified" }),
    }).catch(() => {});

    const m = await loadMatch();
    if (m?.stats1) {
      runFight({ ...m, stats2: stats });
    }
  }

  async function handleShare() {
    if (!address || sharedPoints || !fightResult || !match) return;

    const winner = fightResult.winner === "p1" ? match.player1 : match.player2;
    const myWinner = address?.toLowerCase() === winner?.toLowerCase();
    const shareText = encodeURIComponent(
      `My gladiator just ${myWinner ? "WON" : "fought hard"} in GLADAITOR (FREE FIGHT) ⚔️ — gladaitors.vercel.app`
    );
    window.open(
      `https://warpcast.com/~/compose?text=${shareText}`,
      "_blank",
      "noopener,noreferrer"
    );

    await fetch("/api/points/award", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: address, action: "share_fight_result", matchId }),
    }).catch(() => {});

    setSharedPoints(true);
  }

  // ── RENDER ─────────────────────────────────────────────────────────────────

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

  if (view === "configure") {
    return (
      <div className="arena-bg min-h-screen flex flex-col">
        <Header router={router} />
        <main className="flex-1 max-w-lg mx-auto w-full px-4 py-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="bg-green-900 text-green-400 text-xs font-bold uppercase tracking-widest px-2 py-1 rounded">
              FREE FIGHT
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white uppercase tracking-widest mb-2">
            Build Your Gladiator
          </h1>
          <p className="text-gray-500 text-sm mb-6">
            You are joining fight {matchId.slice(0, 8)}... — configure your gladiator and enter the pit.
          </p>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 mb-5">
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
        <main className="flex-1 max-w-lg mx-auto w-full px-4 py-16 text-center">
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

  if (view === "replay" && fightResult && match) {
    const p1Addr = match.player1;
    const p2Addr = match.player2 ?? "???";
    return (
      <div className="arena-bg min-h-screen flex flex-col">
        <Header router={router} />
        <main className="flex-1 flex items-center justify-center px-4 py-8">
          <div className="w-full max-w-sm">
            <FightReplay
              result={fightResult}
              p1Label={`${p1Addr.slice(0, 6)}...${p1Addr.slice(-4)}`}
              p2Label={`${p2Addr.slice(0, 6)}...${p2Addr.slice(-4)}`}
              viewerRole={myRole}
              onDone={() => setView("result")}
              onPlayAgain={() => router.push("/free-fight")}
              onHome={() => router.push("/")}
            />
          </div>
        </main>
      </div>
    );
  }

  if (view === "result" && fightResult && match) {
    const p1Stats = match.stats1!;
    const p2Stats = match.stats2!;
    const isP1Winner = fightResult.winner === "p1";
    const myAddress = address?.toLowerCase() ?? "";
    const iAmP1 = match.player1 === myAddress;
    const iAmP2 = match.player2 === myAddress;
    const viewerRole = iAmP1 ? "p1" : iAmP2 ? "p2" : "spectator";

    const p1Addr = match.player1;
    const p2Addr = match.player2 ?? "???";

    // Derive opponent name for taunts — prefer Farcaster username, fall back to "your opponent"
    const resolvedOpponentName =
      viewerRole === "spectator"
        ? "your opponent"
        : opponentUsername ?? "your opponent";

    return (
      <div className="arena-bg min-h-screen flex flex-col">
        <Header router={router} />
        <main className="flex-1 max-w-lg mx-auto w-full px-4 py-8">
          <FightSummary
            result={fightResult}
            p1Label={`${p1Addr.slice(0, 6)}...${p1Addr.slice(-4)}`}
            p2Label={`${p2Addr.slice(0, 6)}...${p2Addr.slice(-4)}`}
            p1Stats={p1Stats}
            p2Stats={p2Stats}
            isP1Winner={isP1Winner}
            viewerRole={viewerRole}
            opponentName={resolvedOpponentName}
            onShare={handleShare}
            shareLabel={sharedPoints ? "Shared!" : "Share Your Battle"}
            sharedAlready={sharedPoints}
            onHome={() => router.push("/")}
          />
          <div className="mt-2 text-xs text-gray-600 text-center">FREE FIGHT — no USDC at stake</div>
        </main>
        <Footer />
      </div>
    );
  }

  return null;
}

function Header({ router }: { router: ReturnType<typeof useRouter> }) {
  return (
    <Navbar><WalletButton /></Navbar>
  );
}
