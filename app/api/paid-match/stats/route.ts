import { NextRequest, NextResponse } from "next/server";
import { getPaidMatchStats, setPaidMatchStats } from "@/lib/kv";

// POST /api/paid-match/stats
// Store a player's gladiator stats for a paid match in KV.
// Called by:
//   - Creator: after createMatch tx confirms (role = "player1")
//   - Joiner:  after joinMatch tx confirms   (role = "player2")
//
// Body: { matchId, role: "player1" | "player2", wallet, stats: { strength, speed, defense, intel, luck } }
export async function POST(req: NextRequest) {
  try {
    const { matchId, role, wallet, stats } = await req.json();

    if (!matchId || !role || !wallet || !stats) {
      return NextResponse.json({ error: "matchId, role, wallet, stats required" }, { status: 400 });
    }
    if (role !== "player1" && role !== "player2") {
      return NextResponse.json({ error: "role must be player1 or player2" }, { status: 400 });
    }

    const statKeys = ["strength", "speed", "defense", "intel", "luck"] as const;
    for (const k of statKeys) {
      const v = (stats as Record<string, unknown>)[k];
      if (typeof v !== "number" || v < 1 || v > 10) {
        return NextResponse.json({ error: `invalid stat: ${k}` }, { status: 400 });
      }
    }
    const validStats = {
      strength: stats.strength as number,
      speed: stats.speed as number,
      defense: stats.defense as number,
      intel: stats.intel as number,
      luck: stats.luck as number,
    };
    const total = statKeys.reduce((sum, k) => sum + validStats[k], 0);
    if (total !== 25) {
      return NextResponse.json({ error: "stats must sum to 25" }, { status: 400 });
    }

    const existing = await getPaidMatchStats(matchId) ?? { matchId, stats1: undefined, stats2: undefined };

    const updated = role === "player1"
      ? { ...existing, matchId, player1: wallet.toLowerCase(), stats1: validStats }
      : { ...existing, matchId, player2: wallet.toLowerCase(), stats2: validStats };

    await setPaidMatchStats(updated);

    return NextResponse.json({ ok: true, hasStats1: !!updated.stats1, hasStats2: !!updated.stats2 });
  } catch (err) {
    console.error("[/api/paid-match/stats]", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

// GET /api/paid-match/stats?matchId=X
// Check whether stats have been submitted for both players.
export async function GET(req: NextRequest) {
  const matchId = req.nextUrl.searchParams.get("matchId");
  if (!matchId) {
    return NextResponse.json({ error: "matchId required" }, { status: 400 });
  }

  const data = await getPaidMatchStats(matchId);
  if (!data) {
    return NextResponse.json({ hasStats1: false, hasStats2: false, resolved: false });
  }

  return NextResponse.json({
    hasStats1: !!data.stats1,
    hasStats2: !!data.stats2,
    resolved: !!data.winner,
    winner: data.winner ?? null,
  });
}
