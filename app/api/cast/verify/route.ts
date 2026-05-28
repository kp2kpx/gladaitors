import { NextRequest, NextResponse } from "next/server";
import { isCastVerified, setCastVerified } from "@/lib/kv";

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY!;
// Check for casts in the last 10 minutes to give some buffer
const LOOKBACK_SECONDS = 10 * 60;

export async function POST(req: NextRequest) {
  try {
    const { fid } = await req.json();

    if (!fid || typeof fid !== "number") {
      return NextResponse.json({ error: "fid required" }, { status: 400 });
    }

    // Fast path: already verified within 24h
    if (await isCastVerified(fid)) {
      return NextResponse.json({ verified: true, cached: true });
    }

    if (!NEYNAR_API_KEY) {
      return NextResponse.json(
        { error: "Neynar API key not configured" },
        { status: 500 }
      );
    }

    // Fetch recent casts by this FID
    const url = `https://api.neynar.com/v2/farcaster/feed/user/casts?fid=${fid}&limit=10&include_replies=false`;
    const res = await fetch(url, {
      headers: {
        accept: "application/json",
        "x-api-key": NEYNAR_API_KEY,
      },
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("Neynar error:", res.status, body);
      return NextResponse.json(
        { error: "Neynar API error", details: body },
        { status: 502 }
      );
    }

    const data = await res.json();
    const casts: Array<{ text: string; timestamp: string }> =
      data?.casts ?? [];

    const cutoff = Date.now() - LOOKBACK_SECONDS * 1000;
    const found = casts.some((cast) => {
      const ts = new Date(cast.timestamp).getTime();
      return (
        ts >= cutoff &&
        cast.text.toLowerCase().includes("gladaitors.vercel.app")
      );
    });

    if (found) {
      await setCastVerified(fid);
      return NextResponse.json({ verified: true });
    }

    return NextResponse.json({ verified: false });
  } catch (err) {
    console.error("cast/verify error", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
