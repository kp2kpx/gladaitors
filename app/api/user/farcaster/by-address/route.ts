import { NextRequest, NextResponse } from "next/server";

// POST /api/user/farcaster/by-address
// Body: { addresses: string[] }
// Returns { [address_lowercase]: { username: string | null, pfpUrl: string | null } }
//
// Uses Neynar bulk-by-address to resolve up to 350 wallet addresses in one call.
// Used by the leaderboard to batch-resolve wallet addresses to Farcaster usernames.
export async function POST(req: NextRequest) {
  const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY ?? "";

  if (!NEYNAR_API_KEY) {
    return NextResponse.json({});
  }

  let addresses: string[] = [];
  try {
    const body = await req.json();
    addresses = Array.isArray(body.addresses) ? body.addresses.slice(0, 350) : [];
  } catch {
    return NextResponse.json({});
  }

  if (addresses.length === 0) return NextResponse.json({});

  const normalized = addresses.map((a) => a.toLowerCase());

  try {
    const res = await fetch(
      `https://api.neynar.com/v2/farcaster/user/bulk-by-address/?addresses=${normalized.join(",")}`,
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
    // data shape: { [address]: [user, ...] }
    const result: Record<string, { username: string | null; pfpUrl: string | null }> = {};

    for (const addr of normalized) {
      const users = data?.[addr];
      const user = Array.isArray(users) ? users[0] : null;
      result[addr] = {
        username: user?.username ?? null,
        pfpUrl: user?.pfp_url ?? null,
      };
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({});
  }
}
