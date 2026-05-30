"use client";

import { useMiniKit } from "@coinbase/onchainkit/minikit";
import { useAccount, useDisconnect } from "wagmi";

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
 *
 * isInMiniApp = true when context is non-null, i.e. we are running inside
 * the Farcaster / Warpcast iframe. Used to hide logout on the profile page —
 * inside the Mini App the user is always auto-authed and can't log out.
 *
 * logout = disconnects the wagmi connector (web-only). After disconnect,
 * isConnected → false and address → undefined, so isAuthed becomes false.
 * Callers should redirect to "/" after calling logout().
 */
export function useFarcasterAuth() {
  const { context, isMiniAppReady } = useMiniKit();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  const fid = context?.user?.fid ?? null;
  const username = context?.user?.username ?? null;
  const pfpUrl = context?.user?.pfpUrl ?? null;

  // Authed as soon as we have either a FID from context or a connected address.
  const isAuthed = fid !== null || isConnected;

  // True when running inside the Farcaster / Warpcast Mini App iframe.
  // context is populated by MiniKit only inside the iframe; null on web.
  const isInMiniApp = context !== null && context !== undefined;

  function logout() {
    disconnect();
  }

  return {
    isMiniAppReady,
    isAuthed,
    isInMiniApp,
    logout,
    fid,
    username,
    pfpUrl,
    address: address ?? null,
  };
}
