"use client";

import { useConnect, useDisconnect } from "wagmi";
import { useFarcasterAuth } from "@/lib/useFarcasterAuth";

/**
 * Browser wallet connect button.
 *
 * Used on two paths:
 *  1. Direct browser (non-MiniApp): no Farcaster context, no wallet yet.
 *  2. MiniApp fallback: Farcaster context resolved (FID present) but the
 *     embedded wallet connector failed to auto-connect (miniAppWalletFailed=true).
 *     This happens on farcaster.xyz web client and developer preview. We offer
 *     WalletConnect / MetaMask as a fallback so paid fights still work.
 *
 * Callers must decide when to render this component — either when !isInMiniApp
 * or when miniAppWalletFailed=true. This component does not self-gate on isInMiniApp
 * so it can serve both paths.
 *
 * Supports WalletConnect (QR modal) and injected connectors (MetaMask etc.).
 * NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID must be set for WalletConnect to appear.
 */
export default function ConnectWalletButton() {
  const { address } = useFarcasterAuth();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  // Already connected — show address + disconnect
  if (address) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div
          className="text-xs font-mono px-3 py-1 rounded"
          style={{ background: "#1a1200", border: "1px solid #4a3010", color: "#b8860b" }}
        >
          {address.slice(0, 6)}...{address.slice(-4)}
        </div>
        <button
          onClick={() => disconnect()}
          className="text-xs uppercase tracking-widest transition-colors"
          style={{ color: "#8b6a40" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#c4a882")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#8b6a40")}
        >
          Disconnect
        </button>
      </div>
    );
  }

  // Find available connectors — prefer WalletConnect, then injected.
  // Exclude the farcasterMiniApp connector — it's what already failed to auto-connect.
  const wcConnector = connectors.find((c) => c.id === "walletConnect");
  const injectedConnector = connectors.find((c) => c.id === "injected");

  return (
    <div className="flex flex-col gap-3 w-full">
      {wcConnector && (
        <button
          className="btn-primary w-full py-3"
          disabled={isPending}
          onClick={() => connect({ connector: wcConnector })}
        >
          {isPending ? "Connecting..." : "Connect via WalletConnect (QR)"}
        </button>
      )}
      {injectedConnector && (
        <button
          className="btn-secondary w-full py-3"
          disabled={isPending}
          onClick={() => connect({ connector: injectedConnector })}
        >
          {isPending ? "Connecting..." : "Connect Browser Wallet (MetaMask)"}
        </button>
      )}
      {!wcConnector && !injectedConnector && (
        <div
          className="text-xs text-center py-3 rounded"
          style={{ color: "#8b6a40", border: "1px solid #4a3010" }}
        >
          No wallet connector available.
          <br />
          Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to enable QR connect.
        </div>
      )}
      <p className="text-xs text-center" style={{ color: "#6b4c2a" }}>
        Scan QR with a wallet app or connect a browser extension wallet
      </p>
    </div>
  );
}
