import { NextRequest, NextResponse } from "next/server";
import { getFreeMatch, setFreeMatch } from "@/lib/kv";

// GET /api/free-match/:matchId — poll match state
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const { matchId } = await params;
  const match = await getFreeMatch(matchId);
  if (!match) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(match);
}

// PATCH /api/free-match/:matchId — update player1's stats or mark resolved
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const { matchId } = await params;
  try {
    const body = await req.json();
    const match = await getFreeMatch(matchId);
    if (!match) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    const updated = { ...match, ...body };
    await setFreeMatch(updated);
    return NextResponse.json(updated);
  } catch (err) {
    console.error("free-match PATCH error", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
