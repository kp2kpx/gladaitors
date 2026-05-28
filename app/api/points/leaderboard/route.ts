import { NextResponse } from "next/server";
import { getLeaderboard } from "@/lib/kv";

export async function GET() {
  try {
    const board = await getLeaderboard();
    return NextResponse.json({ leaderboard: board });
  } catch (err) {
    console.error("points/leaderboard error", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
