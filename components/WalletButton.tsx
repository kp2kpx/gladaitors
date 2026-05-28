"use client";

import { useFarcasterAuth } from "@/lib/useFarcasterAuth";

/**
 * Auth header widget — Farcaster Mini App only.
 *
 * Shows user identity (username / address / FID) once MiniKit resolves.
 * Shows a subtle connecting indicator while the connector is initialising.
 */
export default function WalletButton() {
  const { isAuthed, fid, username, address } = useFarcasterAuth();

  if (!isAuthed) {
    return (
      <div className="text-xs text-gray-600 animate-pulse">Connecting...</div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400 font-mono">
        {username ? `@${username}` : address ? `${address.slice(0, 6)}...${address.slice(-4)}` : `FID ${fid}`}
      </span>
    </div>
  );
}
