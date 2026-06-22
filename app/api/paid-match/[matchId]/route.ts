import { NextRequest, NextResponse } from "next/server";
import { getPaidMatchStats } from "@/lib/kv";

// GET /api/paid-match/:matchId
// Returns KV stats for a paid match — used by the match page to load stats
// for the fight replay (stats are stored off-chain, never submitted on-chain).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const { matchId } = await params;
  const data = await getPaidMatchStats(matchId);
  if (!data) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(data);
}
