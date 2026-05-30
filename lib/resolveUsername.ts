/**
 * Resolve a player identifier to a display label.
 *
 * Priority:
 *   1. fidOverride → fetch /api/user/farcaster?fid=<fidOverride>
 *   2. playerId starts with "fid:" → extract FID and fetch
 *   3. Otherwise → truncate wallet address
 *
 * Returns "@username" on success, or a truncated ID on any failure/miss.
 */
export async function resolveUsername(
  playerId: string,
  fidOverride?: number
): Promise<string> {
  try {
    let fid: number | null = null;

    if (fidOverride) {
      fid = fidOverride;
    } else if (playerId.startsWith("fid:")) {
      const parsed = Number(playerId.slice(4));
      if (!isNaN(parsed) && parsed > 0) fid = parsed;
    }

    if (fid) {
      const res = await fetch(`/api/user/farcaster?fid=${fid}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.username) return `@${data.username}`;
      }
    }
  } catch {
    // fall through to truncation
  }

  // Wallet address fallback
  if (playerId.length >= 10) {
    return `${playerId.slice(0, 6)}...${playerId.slice(-4)}`;
  }
  return playerId;
}
