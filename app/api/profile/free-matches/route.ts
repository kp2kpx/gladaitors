import { NextRequest, NextResponse } from "next/server";
import { getFreeMatchesByIdentifier } from "@/lib/kv";

// GET /api/profile/free-matches?fid=<fid>&wallet=<address>
// Returns all free matches (last 1h TTL window) where the user was player1 or player2.
// At least one of fid or wallet must be provided.
export async function GET(req: NextRequest) {
  const fidParam = req.nextUrl.searchParams.get("fid");
  const walletParam = req.nextUrl.searchParams.get("wallet");

  const fid = fidParam && !isNaN(Number(fidParam)) ? Number(fidParam) : undefined;
  const wallet = walletParam && walletParam.length > 0 ? walletParam : undefined;

  if (!fid && !wallet) {
    return NextResponse.json({ error: "fid or wallet required" }, { status: 400 });
  }

  try {
    const matches = await getFreeMatchesByIdentifier({ fid, wallet });
    return NextResponse.json({ matches });
  } catch (err) {
    console.error("profile/free-matches error", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
