import { NextRequest, NextResponse } from "next/server";
import { awardPoints, hasSharedFight, markFightShared } from "@/lib/kv";

// Action type -> points delta + stats update
const ACTION_CONFIG: Record<
  string,
  {
    points: number;
    fightsPlayed?: number;
    fightsWon?: number;
  }
> = {
  free_fight_cast_verified: { points: 20 },
  free_fight_completed: { points: 10, fightsPlayed: 1 },
  // "paid_fight_completed" kept as alias for backwards compat; canonical name is "match_completed"
  paid_fight_completed: { points: 50, fightsPlayed: 1 },
  match_completed: { points: 50, fightsPlayed: 1 },
  // "paid_fight_won" kept as alias; canonical name is "match_won"
  paid_fight_won: { points: 50, fightsWon: 1 },
  match_won: { points: 50, fightsWon: 1 },
  share_fight_result: { points: 30 },
};

export async function POST(req: NextRequest) {
  try {
    const { wallet, action, matchId } = await req.json();

    if (!wallet || !action) {
      return NextResponse.json(
        { error: "wallet and action required" },
        { status: 400 }
      );
    }

    const config = ACTION_CONFIG[action];
    if (!config) {
      return NextResponse.json({ error: "unknown action" }, { status: 400 });
    }

    // Deduplicate share actions — only award once per fight per wallet
    if (action === "share_fight_result") {
      if (!matchId) {
        return NextResponse.json(
          { error: "matchId required for share action" },
          { status: 400 }
        );
      }
      const alreadyShared = await hasSharedFight(wallet, matchId);
      if (alreadyShared) {
        return NextResponse.json({
          ok: true,
          skipped: true,
          reason: "already rewarded for this fight",
        });
      }
      await markFightShared(wallet, matchId);
    }

    const record = await awardPoints(wallet, config.points, {
      fightsPlayed: config.fightsPlayed,
      fightsWon: config.fightsWon,
    });

    return NextResponse.json({ ok: true, record });
  } catch (err) {
    console.error("points/award error", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
