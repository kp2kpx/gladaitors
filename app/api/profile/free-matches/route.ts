import { NextRequest, NextResponse } from "next/server";
import { getFreeMatchesByFid } from "@/lib/kv";

// GET /api/profile/free-matches?fid=<fid>
// Returns all free matches (last 1h TTL window) where the user was player1 or player2.
export async function GET(req: NextRequest) {
  const fid = req.nextUrl.searchParams.get("fid");
  if (!fid || isNaN(Number(fid))) {
    return NextResponse.json({ error: "fid required" }, { status: 400 });
  }

  try {
    const matches = await getFreeMatchesByFid(Number(fid));
    return NextResponse.json({ matches });
  } catch (err) {
    console.error("profile/free-matches error", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
