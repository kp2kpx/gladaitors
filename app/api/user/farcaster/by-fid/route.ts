import { NextRequest, NextResponse } from "next/server";

// POST /api/user/farcaster/by-fid
// Body: { fids: number[] }
// Returns { [fid]: { username: string | null, pfpUrl: string | null } }
//
// Uses Neynar bulk?fids= endpoint (comma-separated) to resolve up to 100 FIDs in one call.
// Used by the leaderboard to batch-resolve fid:XXXXX player IDs to Farcaster usernames.
export async function POST(req: NextRequest) {
  const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY ?? "";

  if (!NEYNAR_API_KEY) {
    return NextResponse.json({});
  }

  let fids: number[] = [];
  try {
    const body = await req.json();
    fids = Array.isArray(body.fids)
      ? body.fids.filter((f: unknown) => typeof f === "number" && f > 0).slice(0, 100)
      : [];
  } catch {
    return NextResponse.json({});
  }

  if (fids.length === 0) return NextResponse.json({});

  try {
    const res = await fetch(
      `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fids.join(",")}`,
      {
        headers: {
          accept: "application/json",
          "x-api-key": NEYNAR_API_KEY,
        },
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!res.ok) return NextResponse.json({});

    const data = await res.json();
    const result: Record<number, { username: string | null; pfpUrl: string | null }> = {};

    // Initialize all requested FIDs as null so the caller can distinguish
    // "resolved but not found" from "not in response"
    for (const fid of fids) {
      result[fid] = { username: null, pfpUrl: null };
    }

    const users: Array<{ fid: number; username: string; pfp_url?: string }> =
      data?.users ?? [];
    for (const user of users) {
      result[user.fid] = {
        username: user.username ?? null,
        pfpUrl: user.pfp_url ?? null,
      };
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({});
  }
}
