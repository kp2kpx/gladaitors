"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/lib/wagmi-config";
import { MiniKitProvider } from "@coinbase/onchainkit/minikit";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {/* MiniKitProvider handles Farcaster context injection and
            auto-connects the Farcaster wagmi connector when inside
            a Farcaster client (Warpcast etc). No-ops gracefully in browser. */}
        <MiniKitProvider enabled={true} autoConnect={true}>
          {children}
        </MiniKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
