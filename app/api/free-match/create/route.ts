import { NextRequest, NextResponse } from "next/server";
import { setFreeMatch } from "@/lib/kv";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  try {
    const { wallet, fid, isPublic } = await req.json();

    if (!wallet || typeof wallet !== "string") {
      return NextResponse.json({ error: "wallet required" }, { status: 400 });
    }

    // Accept both 0x wallet addresses and fid: prefixed identifiers for wallet-less users.
    // fid: prefixed IDs are stored as-is (lowercase); wallet addresses are also lowercased.
    const isFidId = wallet.startsWith("fid:");
    const playerId = isFidId ? wallet.toLowerCase() : wallet.toLowerCase();

    // If the wallet is a fid: prefixed string, extract the FID from it as a fallback
    // (the client also sends fid separately, but this ensures consistency).
    const resolvedFid = fid
      ? Number(fid)
      : isFidId
      ? Number(wallet.slice(4))
      : undefined;

    const id = randomUUID();

    await setFreeMatch({
      id,
      player1: playerId,
      player1Fid: resolvedFid,
      state: "waiting",
      isPublic: !!isPublic,
      createdAt: Date.now(),
    });

    return NextResponse.json({ matchId: id });
  } catch (err) {
    console.error("free-match/create error", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
