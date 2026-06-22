// Server-side Farcaster notification helper.
// Resolves a wallet address → FID (via Neynar), then looks up stored
// notification token and POSTs to the user's notificationUrl.
//
// All failures are swallowed — notifications must never block the caller.

import { getNotifToken } from "@/lib/kv";

interface SendNotifOpts {
  toWallet: string;          // wallet address of recipient
  notificationId: string;    // idempotent key (dedupes within 24h on Farcaster side)
  title: string;             // max ~32 chars
  body: string;
  targetUrl: string;         // must match manifest domain exactly
}

/**
 * Resolve a wallet address to a Farcaster FID using Neynar.
 * Returns null if not found or NEYNAR_API_KEY is missing.
 */
async function resolveFidFromWallet(wallet: string): Promise<number | null> {
  const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY ?? "";
  if (!NEYNAR_API_KEY) return null;

  try {
    const res = await fetch(
      `https://api.neynar.com/v2/farcaster/user/bulk-by-address/?addresses=${wallet.toLowerCase()}`,
      {
        headers: {
          accept: "application/json",
          "x-api-key": NEYNAR_API_KEY,
        },
        signal: AbortSignal.timeout(4000),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const users = data?.[wallet.toLowerCase()];
    const user = Array.isArray(users) ? users[0] : null;
    return typeof user?.fid === "number" ? user.fid : null;
  } catch {
    return null;
  }
}

/**
 * Send a Farcaster notification to a wallet address owner.
 * Resolves wallet → FID → stored token, then POSTs to Farcaster.
 * Swallows all errors — caller must never await this for correctness.
 */
export async function sendNotification(opts: SendNotifOpts): Promise<void> {
  try {
    const fid = await resolveFidFromWallet(opts.toWallet);
    if (!fid) return;

    const stored = await getNotifToken(fid);
    if (!stored) return; // user hasn't added the app or has disabled notifications

    const payload = {
      notificationId: opts.notificationId,
      title: opts.title,
      body: opts.body,
      targetUrl: opts.targetUrl,
      tokens: [stored.token],
    };

    const res = await fetch(stored.notificationUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn("[notify] Farcaster notification failed", res.status, text);
    }
  } catch (err) {
    // Swallow — notifications must never block or throw to caller
    console.warn("[notify] sendNotification error (swallowed):", err);
  }
}
