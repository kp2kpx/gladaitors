import { NextRequest, NextResponse } from "next/server";
import { getFreeMatch, setFreeMatch } from "@/lib/kv";

const FREE_MATCH_TTL = 60 * 60; // 1 hour — matches the TTL used in setFreeMatch

// POST /api/free-match/resolve
// Persists the winner of a free fight after the client-side simulation resolves.
// Called by the free fight page once it knows the winner; idempotent — safe to
// call twice (will just overwrite with the same data).
export async function POST(req: NextRequest) {
  try {
    const { matchId, winnerAddress, winnerFid } = await req.json();

    if (!matchId || !winnerAddress) {
      return NextResponse.json(
        { error: "matchId and winnerAddress required" },
        { status: 400 }
      );
    }

    const match = await getFreeMatch(matchId);
    if (!match) {
      return NextResponse.json({ error: "match not found" }, { status: 404 });
    }

    // Validate winnerAddress is actually a player in this match
    const winner = winnerAddress.toLowerCase();
    if (match.player1 !== winner && match.player2 !== winner) {
      return NextResponse.json(
        { error: "winnerAddress is not a player in this match" },
        { status: 400 }
      );
    }

    await setFreeMatch({
      ...match,
      winner,
      winnerFid: winnerFid ? Number(winnerFid) : undefined,
      state: "resolved",
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("free-match/resolve error", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
