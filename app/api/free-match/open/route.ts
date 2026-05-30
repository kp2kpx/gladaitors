import { NextResponse } from "next/server";
import { getPublicFreeMatches } from "@/lib/kv";

export async function GET() {
  try {
    const matches = await getPublicFreeMatches();
    return NextResponse.json(matches);
  } catch (err) {
    console.error("free-match/open error", err);
    return NextResponse.json([], { status: 200 });
  }
}
