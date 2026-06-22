import { NextRequest, NextResponse } from "next/server";
import { setNotifToken, deleteNotifToken } from "@/lib/kv";

// POST /api/farcaster/webhook
// Receives Farcaster mini app lifecycle events and stores/deletes notification tokens.
//
// Events handled:
//   miniapp_added           → store notificationUrl + token for the user's FID
//   notifications_enabled   → same (re-enabled)
//   notifications_disabled  → clear token (stop sending)
//   miniapp_removed         → clear token
//
// Farcaster POSTs a signed payload. We don't verify the signature here
// (no sensitive action is taken — we only store/delete tokens), but we
// validate the shape before writing to KV.
//
// Spec reference: miniapps.farcaster.xyz/llms-full.txt
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Farcaster sends: { header, payload, signature } where payload is base64url JSON
    // OR it sends the decoded body directly depending on client version.
    // Handle both: if body has a "payload" string, decode it; otherwise use body directly.
    let event: {
      event?: string;
      notificationDetails?: { url: string; token: string };
      fid?: number;
    };

    if (typeof body.payload === "string") {
      // base64url-encoded JSON payload
      try {
        const decoded = Buffer.from(body.payload, "base64url").toString("utf8");
        event = JSON.parse(decoded);
      } catch {
        return NextResponse.json({ ok: false, error: "invalid payload encoding" }, { status: 400 });
      }
    } else {
      event = body;
    }

    const { event: eventType, notificationDetails, fid } = event;

    if (!fid || typeof fid !== "number") {
      return NextResponse.json({ ok: false, error: "missing fid" }, { status: 400 });
    }

    switch (eventType) {
      case "miniapp_added":
      case "notifications_enabled":
        if (notificationDetails?.url && notificationDetails?.token) {
          await setNotifToken(fid, {
            notificationUrl: notificationDetails.url,
            token: notificationDetails.token,
          });
        }
        break;

      case "notifications_disabled":
      case "miniapp_removed":
        await deleteNotifToken(fid);
        break;

      default:
        // Unknown event — acknowledge without action
        break;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[farcaster/webhook]", err);
    // Always return 200 to Farcaster — retries on non-2xx can cause duplicate events
    return NextResponse.json({ ok: false, error: "internal error" });
  }
}
