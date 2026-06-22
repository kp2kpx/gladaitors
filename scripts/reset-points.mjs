/**
 * reset-points.mjs
 *
 * One-time script to flush all points-related keys from the production Vercel KV store.
 *
 * Keys deleted:
 *   leaderboard          — the main HASH holding all PointRecord entries
 *   points_awarded:*     — paid-fight dedup flags
 *   shared:*             — share dedup flags (per wallet per fight)
 *   free_fights_vs:*     — same-opponent abuse counters
 *   share_daily:*        — daily share cap counters per FID
 *
 * Usage:
 *   KV_REST_API_URL=<url> KV_REST_API_TOKEN=<token> node scripts/reset-points.mjs
 *
 * Or just run from the project root where .env.local / Vercel env is loaded:
 *   vercel env pull .env.local && node scripts/reset-points.mjs
 */

import { createClient } from "@vercel/kv";

const url = process.env.KV_REST_API_URL;
const token = process.env.KV_REST_API_TOKEN;

if (!url || !token) {
  console.error("KV_REST_API_URL and KV_REST_API_TOKEN must be set");
  process.exit(1);
}

const kv = createClient({ url, token });

const PATTERNS = [
  "points_awarded:*",
  "shared:*",
  "free_fights_vs:*",
  "share_daily:*",
];

async function deleteByPattern(pattern) {
  let cursor = 0;
  let total = 0;
  do {
    const [nextCursor, keys] = await kv.scan(cursor, { match: pattern, count: 200 });
    cursor = Number(nextCursor);
    if (keys.length > 0) {
      await Promise.all(keys.map((k) => kv.del(k)));
      total += keys.length;
      console.log(`  Deleted ${keys.length} keys matching ${pattern} (cursor=${cursor})`);
    }
  } while (cursor !== 0);
  return total;
}

async function main() {
  console.log("=== GLADAITORS points reset ===\n");

  // Delete the leaderboard hash
  const leaderboardDeleted = await kv.del("leaderboard");
  console.log(`Deleted leaderboard key: ${leaderboardDeleted}`);

  // Delete all pattern-matched keys
  let grandTotal = 0;
  for (const pattern of PATTERNS) {
    console.log(`\nScanning ${pattern}...`);
    const n = await deleteByPattern(pattern);
    console.log(`  Total for pattern: ${n}`);
    grandTotal += n;
  }

  console.log(`\nDone. Total keys deleted: ${grandTotal + leaderboardDeleted}`);

  // Verify leaderboard is empty
  const board = await kv.hgetall("leaderboard");
  if (!board || Object.keys(board).length === 0) {
    console.log("Leaderboard is empty — reset confirmed.");
  } else {
    console.warn("WARNING: leaderboard still has entries:", Object.keys(board).length);
  }
}

main().catch((err) => {
  console.error("Reset failed:", err);
  process.exit(1);
});
