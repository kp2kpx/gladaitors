import { NextRequest, NextResponse } from "next/server";
import { getFreeMatch, setFreeMatch } from "@/lib/kv";

export async function POST(req: NextRequest) {
  try {
    const { matchId, wallet, fid, stats } = await req.json();

    if (!matchId || !wallet) {
      return NextResponse.json(
        { error: "matchId and wallet required" },
        { status: 400 }
      );
    }

    const match = await getFreeMatch(matchId);
    if (!match) {
      return NextResponse.json({ error: "match not found" }, { status: 404 });
    }
    if (match.state !== "waiting") {
      return NextResponse.json(
        { error: "match already has an opponent" },
        { status: 409 }
      );
    }
    if (match.player1.toLowerCase() === wallet.toLowerCase()) {
      return NextResponse.json(
        { error: "cannot join your own match" },
        { status: 400 }
      );
    }

    await setFreeMatch({
      ...match,
      player2: wallet.toLowerCase(),
      player2Fid: fid ? Number(fid) : undefined,
      stats2: stats,
      state: "ready",
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("free-match/join error", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
