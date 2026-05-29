import { NextRequest, NextResponse } from "next/server";

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY!;

// GET /api/user/farcaster?fid=<number>
// Returns { username: string | null } — null if not found or lookup fails.
export async function GET(req: NextRequest) {
  const fid = req.nextUrl.searchParams.get("fid");

  if (!fid || isNaN(Number(fid))) {
    return NextResponse.json({ username: null });
  }

  if (!NEYNAR_API_KEY) {
    return NextResponse.json({ username: null });
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

    if (!res.ok) return NextResponse.json({ username: null });

    const data = await res.json();
    const username: string | null = data?.users?.[0]?.username ?? null;
    return NextResponse.json({ username });
  } catch {
    return NextResponse.json({ username: null });
  }
}
