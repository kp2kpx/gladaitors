"use client";

import { useMiniKit } from "@coinbase/onchainkit/minikit";
import { useAccount } from "wagmi";

/**
 * Single source of truth for "is the user authenticated?"
 *
 * This app is a Farcaster Mini App — it only runs inside Warpcast.
 * MiniKit auto-connects the Farcaster wagmi connector on mount.
 * No login button, no "Open in Farcaster" prompt — sdk.actions.ready()
 * fires on mount and that's the entire auth flow.
 *
 * isAuthed = true when we have a FID (from MiniKit context) OR a connected
 * wallet address (from the auto-connected Farcaster connector).
 */
export function useFarcasterAuth() {
  const { context, isMiniAppReady } = useMiniKit();
  const { address, isConnected } = useAccount();

  const fid = context?.user?.fid ?? null;
  const username = context?.user?.username ?? null;
  const pfpUrl = context?.user?.pfpUrl ?? null;

  // Authed as soon as we have either a FID from context or a connected address.
  const isAuthed = fid !== null || isConnected;

  return {
    isMiniAppReady,
    isAuthed,
    fid,
    username,
    pfpUrl,
    address: address ?? null,
  };
}
