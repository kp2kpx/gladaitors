import { NextRequest, NextResponse } from "next/server";
import { setFreeMatch } from "@/lib/kv";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  try {
    const { wallet, fid } = await req.json();

    if (!wallet || typeof wallet !== "string") {
      return NextResponse.json({ error: "wallet required" }, { status: 400 });
    }

    const id = randomUUID();

    await setFreeMatch({
      id,
      player1: wallet.toLowerCase(),
      player1Fid: fid ? Number(fid) : undefined,
      state: "waiting",
      createdAt: Date.now(),
    });

    return NextResponse.json({ matchId: id });
  } catch (err) {
    console.error("free-match/create error", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
