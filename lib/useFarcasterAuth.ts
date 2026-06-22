"use client";

import { useEffect, useRef, useState } from "react";
import { useMiniKit } from "@coinbase/onchainkit/minikit";
import { useAccount, useConnect, useConnectors, useDisconnect } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import sdk from "@farcaster/miniapp-sdk";

/**
 * Single source of truth for "is the user authenticated?"
 *
 * This app is a Farcaster Mini App. MiniKit injects Farcaster context inside
 * the client iframe. Wallet connect is handled here (not MiniKit autoConnect):
 * after context resolves we call connect() on the custom farcasterMiniAppAsync
 * connector when the host exposes an Ethereum provider.
 *
 * isAuthed = true when we have a FID (from MiniKit context) OR a connected
 * wallet address (from the Farcaster connector).
 *
 * isInMiniApp = true when context is non-null, i.e. we are running inside
 * the Farcaster client iframe. Used to hide logout on the profile page.
 *
 * isContextReady = true once MiniKit context resolves, a wallet connects, or
 * a 2s fallback timeout fires (whichever comes first).
 *
 * isWalletReady = true once wagmi is not reconnecting or connecting.
 *
 * miniAppWalletFailed = true when inside the mini app, context and wallet are
 * ready, but no address could be obtained (provider missing or connect failed).
 *
 * logout = disconnects the wagmi connector (web-only). After disconnect,
 * isConnected becomes false and address becomes undefined.
 */
export function useFarcasterAuth() {
  const { context, isMiniAppReady } = useMiniKit();
  const { address, isConnected, status } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const connectors = useConnectors();

  const fid = context?.user?.fid ?? null;
  const username = context?.user?.username ?? null;
  const pfpUrl = context?.user?.pfpUrl ?? null;

  const isAuthed = fid !== null || isConnected;
  const isInMiniApp = context !== null && context !== undefined;

  const [isContextReady, setIsContextReady] = useState(false);
  const [miniAppWalletFailed, setMiniAppWalletFailed] = useState(false);
  const connectSettledRef = useRef(false);

  const isWalletReady =
    status !== "connecting" && status !== "reconnecting";

  // Flip isContextReady when context resolves, wallet connects, or 2s elapses.
  useEffect(() => {
    if (context !== null && context !== undefined) {
      setIsContextReady(true);
      return;
    }
    if (address) {
      setIsContextReady(true);
      return;
    }

    const timer = setTimeout(() => {
      setIsContextReady(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, [context, address]);

  // Explicit connect after context resolves and host exposes a wallet provider.
  useEffect(() => {
    if (!isContextReady || !isWalletReady) return;
    if (address) {
      setMiniAppWalletFailed(false);
      return;
    }
    if (connectSettledRef.current) return;
    if (!isInMiniApp) {
      connectSettledRef.current = true;
      return;
    }

    let cancelled = false;

    async function attemptConnect() {
      try {
        const provider = await sdk.wallet.getEthereumProvider();
        if (cancelled) return;

        if (!provider) {
          console.log("[gladaitors] host does not support wallet.getEthereumProvider");
          setMiniAppWalletFailed(true);
          connectSettledRef.current = true;
          return;
        }

        const connector = connectors.find((c) => c.id === "farcaster");
        if (!connector) {
          console.error("[gladaitors] farcaster connector not found in wagmi config");
          setMiniAppWalletFailed(true);
          connectSettledRef.current = true;
          return;
        }

        console.log("[gladaitors] wallet provider available, attempting wagmi connect");
        connect(
          { connector, chainId: baseSepolia.id },
          {
            onSuccess: () => {
              if (!cancelled) {
                connectSettledRef.current = true;
                setMiniAppWalletFailed(false);
              }
            },
            onError: (err) => {
              console.error("[gladaitors] mini app wallet connect failed", err);
              if (!cancelled) {
                setMiniAppWalletFailed(true);
                connectSettledRef.current = true;
              }
            },
          }
        );
      } catch (err) {
        console.error("[gladaitors] mini app wallet connect failed", err);
        if (!cancelled) {
          setMiniAppWalletFailed(true);
          connectSettledRef.current = true;
        }
      }
    }

    attemptConnect();

    return () => {
      cancelled = true;
    };
  }, [
    isContextReady,
    isWalletReady,
    address,
    isInMiniApp,
    connect,
    connectors,
  ]);

  // Flag failure when mini app context is ready but no wallet address resolved.
  useEffect(() => {
    if (
      isInMiniApp &&
      isContextReady &&
      isWalletReady &&
      !address &&
      connectSettledRef.current
    ) {
      setMiniAppWalletFailed(true);
    }
  }, [isInMiniApp, isContextReady, isWalletReady, address]);

  function logout() {
    disconnect();
  }

  return {
    isMiniAppReady,
    isAuthed,
    isInMiniApp,
    isContextReady,
    isWalletReady,
    miniAppWalletFailed,
    logout,
    fid,
    username,
    pfpUrl,
    address: address ?? null,
  };
}