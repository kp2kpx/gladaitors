// Thin wrapper around @vercel/kv with typed helpers for GLADAITORS data

import { kv } from "@vercel/kv";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export type FreeMatchState = "waiting" | "ready" | "resolved";

export interface FreeMatch {
  id: string;
  player1: string; // wallet address
  player1Fid?: number;
  player2?: string;
  player2Fid?: number;
  state: FreeMatchState;
  // Stats stored after both configure
  stats1?: {
    strength: number;
    speed: number;
    defense: number;
    intel: number;
    luck: number;
  };
  stats2?: {
    strength: number;
    speed: number;
    defense: number;
    intel: number;
    luck: number;
  };
  createdAt: number;
}

export interface PointRecord {
  wallet: string;
  points: number;
  fightsPlayed: number;
  fightsWon: number;
}

// --------------------------------------------------------------------------
// Free match helpers
// --------------------------------------------------------------------------

const FREE_MATCH_TTL = 60 * 60; // 1 hour

export async function setFreeMatch(match: FreeMatch): Promise<void> {
  await kv.set(`free_match:${match.id}`, match, { ex: FREE_MATCH_TTL });
}

export async function getFreeMatch(matchId: string): Promise<FreeMatch | null> {
  return await kv.get<FreeMatch>(`free_match:${matchId}`);
}

/**
 * Scan all free_match:* keys and return matches involving the given FID.
 * Free matches have a 1h TTL and volume is low, so full scan is acceptable.
 */
export async function getFreeMatchesByFid(fid: number): Promise<FreeMatch[]> {
  const results: FreeMatch[] = [];
  let cursor = 0;
  do {
    const [nextCursor, keys] = await kv.scan(cursor, {
      match: "free_match:*",
      count: 100,
    });
    cursor = Number(nextCursor);

    if (keys.length > 0) {
      const values = await Promise.all(
        keys.map((k) => kv.get<FreeMatch>(k))
      );
      for (const m of values) {
        if (
          m &&
          (m.player1Fid === fid || m.player2Fid === fid)
        ) {
          results.push(m);
        }
      }
    }
  } while (cursor !== 0);

  return results.sort((a, b) => b.createdAt - a.createdAt);
}

// --------------------------------------------------------------------------
// Cast verification cache
// FIDs that have verified a cast in the last 24h get a TTL key
// --------------------------------------------------------------------------

const CAST_VERIFIED_TTL = 60 * 60 * 24; // 24h

export async function setCastVerified(fid: number): Promise<void> {
  await kv.set(`cast_verified:${fid}`, 1, { ex: CAST_VERIFIED_TTL });
}

export async function isCastVerified(fid: number): Promise<boolean> {
  const v = await kv.get(`cast_verified:${fid}`);
  return v !== null;
}

// --------------------------------------------------------------------------
// Share tracking (once per fight per wallet)
// --------------------------------------------------------------------------

const SHARE_TTL = 60 * 60 * 24 * 7; // 7 days — enough to dedupe within a fight cycle

export async function hasSharedFight(
  wallet: string,
  fightId: string
): Promise<boolean> {
  const key = `shared:${wallet.toLowerCase()}:${fightId}`;
  const v = await kv.get(key);
  return v !== null;
}

export async function markFightShared(
  wallet: string,
  fightId: string
): Promise<void> {
  const key = `shared:${wallet.toLowerCase()}:${fightId}`;
  await kv.set(key, 1, { ex: SHARE_TTL });
}

// --------------------------------------------------------------------------
// Points
// --------------------------------------------------------------------------

const POINTS_KEY = "leaderboard";

export async function getPoints(wallet: string): Promise<PointRecord> {
  const w = wallet.toLowerCase();
  const rec = await kv.hget<PointRecord>(POINTS_KEY, w);
  return (
    rec ?? {
      wallet: w,
      points: 0,
      fightsPlayed: 0,
      fightsWon: 0,
    }
  );
}

export async function awardPoints(
  wallet: string,
  delta: number,
  opts?: { fightsPlayed?: number; fightsWon?: number }
): Promise<PointRecord> {
  const w = wallet.toLowerCase();
  const current = await getPoints(w);
  const updated: PointRecord = {
    wallet: w,
    points: current.points + delta,
    fightsPlayed: current.fightsPlayed + (opts?.fightsPlayed ?? 0),
    fightsWon: current.fightsWon + (opts?.fightsWon ?? 0),
  };
  await kv.hset(POINTS_KEY, { [w]: updated });
  return updated;
}

export async function getLeaderboard(): Promise<PointRecord[]> {
  // Returns all entries sorted by points descending, capped at 50
  const all = await kv.hgetall<Record<string, PointRecord>>(POINTS_KEY);
  if (!all) return [];
  return Object.values(all)
    .sort((a, b) => b.points - a.points)
    .slice(0, 50);
}
