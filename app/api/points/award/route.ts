import { NextRequest, NextResponse } from "next/server";
import {
  awardPoints,
  hasSharedFight,
  markFightShared,
  hasPointsAwarded,
  markPointsAwarded,
} from "@/lib/kv";

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
  // Bot fights (vs Aitor) — same points as free fights
  bot_fight_completed: { points: 10, fightsPlayed: 1 },
  bot_fight_won: { points: 20, fightsWon: 1 },
  // "paid_fight_completed" kept as alias for backwards compat; canonical name is "match_completed"
  paid_fight_completed: { points: 50, fightsPlayed: 1 },
  match_completed: { points: 50, fightsPlayed: 1 },
  // "paid_fight_won" kept as alias; canonical name is "match_won"
  paid_fight_won: { points: 50, fightsWon: 1 },
  match_won: { points: 50, fightsWon: 1 },
  share_fight_result: { points: 20 },
};

// Paid fight actions that need per-matchId dedup.
// Free fights and bot fights are one-shot client-side and don't need it.
const PAID_FIGHT_DEDUP_ACTIONS = new Set([
  "paid_fight_completed",
  "match_completed",
  "paid_fight_won",
  "match_won",
]);

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

    // Deduplicate paid-fight point awards — prevents re-award on page refresh
    if (PAID_FIGHT_DEDUP_ACTIONS.has(action)) {
      if (!matchId) {
        return NextResponse.json(
          { error: "matchId required for paid fight action" },
          { status: 400 }
        );
      }
      const alreadyAwarded = await hasPointsAwarded(action, matchId, wallet);
      if (alreadyAwarded) {
        return NextResponse.json({
          ok: true,
          skipped: true,
          reason: "points already awarded for this fight",
        });
      }
      await markPointsAwarded(action, matchId, wallet);
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
