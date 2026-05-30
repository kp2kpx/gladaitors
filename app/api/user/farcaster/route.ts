import { NextRequest, NextResponse } from "next/server";

// GET /api/user/farcaster?fid=<number>
// Returns { username: string | null, pfpUrl: string | null } — null if not found or lookup fails.
export async function GET(req: NextRequest) {
  // Read at request time, not module init — avoids stale cached value in warm lambdas.
  const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY ?? "";

  const fid = req.nextUrl.searchParams.get("fid");

  if (!fid || isNaN(Number(fid))) {
    return NextResponse.json({ username: null, pfpUrl: null });
  }

  if (!NEYNAR_API_KEY) {
    console.warn("[gladaitors] NEYNAR_API_KEY is not set — username resolution will return null.");
    return NextResponse.json({ username: null, pfpUrl: null });
  }

  try {
    const res = await fetch(
      `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`,
      {
        headers: {
          accept: "application/json",
          "x-api-key": NEYNAR_API_KEY,
        },
        // 3s timeout so it never blocks the fight screen
        signal: AbortSignal.timeout(3000),
      }
    );

    if (!res.ok) return NextResponse.json({ username: null, pfpUrl: null });

    const data = await res.json();
    const username: string | null = data?.users?.[0]?.username ?? null;
    const pfpUrl: string | null = data?.users?.[0]?.pfp_url ?? null;
    return NextResponse.json({ username, pfpUrl });
  } catch {
    return NextResponse.json({ username: null, pfpUrl: null });
  }
}
