import { NextRequest, NextResponse } from "next/server";
import { isCastVerified, setCastVerified } from "@/lib/kv";

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY ?? "";

// Warn once at startup (visible in Vercel logs) if key is missing.
if (!NEYNAR_API_KEY) {
  console.warn("[gladaitors] NEYNAR_API_KEY is not set — cast verification will always return unverified. Set it in Vercel env vars.");
}

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
      // Graceful degradation — don't 500, just tell the caller it couldn't be verified.
      return NextResponse.json({ verified: false, reason: "API key not configured" });
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
      console.error("[gladaitors] Neynar error:", res.status, body);
      // Return 200 with verified:false rather than propagating a 5xx to the client.
      return NextResponse.json({ verified: false, reason: "Neynar API error" });
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
    console.error("[gladaitors] cast/verify error", err);
    return NextResponse.json({ verified: false, reason: "internal error" });
  }
}
